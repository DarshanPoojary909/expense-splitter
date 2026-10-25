import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import app from '../server.js';
import * as authService from '../services/authService.js';
import * as groupService from '../services/groupService.js';

describe('Day 15: Security Audit, Authorization, & Hardening', () => {
  let server;
  let baseUrl;
  let user1;
  let user1Token;
  let user2;
  let user2Token;
  let privateGroup;

  before(async () => {
    process.env.NODE_ENV = 'test';
    await new Promise((resolve) => {
      server = http.createServer(app).listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    await authService.resetUsers();
    await groupService.resetGroups();

    // User 1 (Alice)
    const reg1 = await authService.registerUser({
      name: 'Alice Security',
      email: 'alice.sec@example.com',
      password: 'StrongSecretPassword123!',
    });
    user1 = reg1.user;
    user1Token = reg1.token;

    // User 2 (Eve / External Hacker)
    const reg2 = await authService.registerUser({
      name: 'Eve Intruder',
      email: 'eve.sec@example.com',
      password: 'EvePassword456!',
    });
    user2 = reg2.user;
    user2Token = reg2.token;

    // Create Private Group for Alice
    privateGroup = await groupService.createGroup({
      name: 'Alice Top Secret Group',
      groupType: 'Other',
      baseCurrency: 'USD',
    }, user1);
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('SECURITY: Passwords must be hashed with bcrypt (never stored plaintext)', async () => {
    const rawUser = await authService.getUserByEmail('alice.sec@example.com');
    assert.ok(rawUser.password, 'Password hash exists');
    assert.notStrictEqual(rawUser.password, 'StrongSecretPassword123!', 'Password must NOT be plaintext');
    assert.ok(rawUser.password.startsWith('$2'), 'Must be a valid bcrypt hash format');

    const isMatch = await bcrypt.compare('StrongSecretPassword123!', rawUser.password);
    assert.strictEqual(isMatch, true, 'bcrypt.compare validates correctly against hash');
  });

  test('SECURITY: Helmet HTTP headers protect against XSS and clickjacking', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(response.status, 200);

    // Helmet security headers
    assert.strictEqual(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(response.headers.get('x-frame-options') || response.headers.get('content-security-policy'));
  });

  test('SECURITY: Requests without Bearer token are rejected with 401 Unauthorized', async () => {
    const response = await fetch(`${baseUrl}/api/groups`);
    assert.strictEqual(response.status, 401);
    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Not authorized|Token/i);
  });

  test('SECURITY: Forged or corrupted JWT tokens are rejected with 401 Unauthorized', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fakePayload.fakeSignature';
    const response = await fetch(`${baseUrl}/api/groups`, {
      headers: { Authorization: `Bearer ${fakeToken}` },
    });
    assert.strictEqual(response.status, 401);
    const body = await response.json();
    assert.strictEqual(body.success, false);
  });

  test('AUTHORIZATION: User 2 is rejected with 403 Forbidden when accessing User 1 private group', async () => {
    const gId = privateGroup.id || privateGroup._id;
    const response = await fetch(`${baseUrl}/api/groups/${gId}`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    assert.strictEqual(response.status, 403);
    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Forbidden/i);
  });

  test('AUTHORIZATION: User 2 cannot access private group reports (403 Forbidden)', async () => {
    const gId = privateGroup.id || privateGroup._id;
    const response = await fetch(`${baseUrl}/api/reports/group/${gId}`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    assert.strictEqual(response.status, 403);
    const body = await response.json();
    assert.strictEqual(body.success, false);
  });

  test('INPUT HARDENING: Invalid or malformed ObjectId in URL parameter is safely caught', async () => {
    const response = await fetch(`${baseUrl}/api/groups/non-existent-or-malformed-id`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    // Either 400 Bad Request or 404 Not Found, never an uncaught 500
    assert.ok(response.status === 400 || response.status === 404);
  });
});
