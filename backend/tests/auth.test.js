import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import app from '../server.js';
import { User } from '../models/index.js';
import * as authService from '../services/authService.js';

describe('Day 5: Password Hashing & User Model Security', () => {
  beforeEach(async () => {
    await authService.resetUsers();
  });

  test('User schema validates email format and password length', async () => {
    const invalidUser = new User({
      name: 'A', // too short
      email: 'invalid-email-format',
      password: '123', // too short (< 6)
    });

    let validationErr = null;
    try {
      await invalidUser.validate();
    } catch (err) {
      validationErr = err;
    }

    assert.ok(validationErr);
    assert.ok(validationErr.errors.name);
    assert.ok(validationErr.errors.email);
    assert.ok(validationErr.errors.password);
  });

  test('User schema accepts valid user document structure', async () => {
    const validUser = new User({
      name: 'Alice Johnson',
      email: 'alice@example.com',
      password: 'SecurePassword123',
      defaultCurrency: 'EUR',
    });

    await validUser.validate();
    assert.strictEqual(validUser.name, 'Alice Johnson');
    assert.strictEqual(validUser.email, 'alice@example.com');
    assert.strictEqual(validUser.defaultCurrency, 'EUR');
  });

  test('User matchPassword method accurately verifies bcrypt hashes', async () => {
    const plainPassword = 'CorrectHorseBatteryStaple123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    // Create user instance with hashed password
    const user = new User({
      name: 'Security Tester',
      email: 'tester@example.com',
      password: hashedPassword,
    });

    // Check that stored password is a 60-char bcrypt hash
    assert.match(user.password, /^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/);

    // Verify correct password
    const matchCorrect = await user.matchPassword(plainPassword);
    assert.strictEqual(matchCorrect, true);

    // Verify wrong password
    const matchWrong = await user.matchPassword('WrongGuess999');
    assert.strictEqual(matchWrong, false);
  });

  test('User toJSON transformation strips password and __v fields', () => {
    const user = new User({
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      password: 'HiddenPassword123',
    });

    const json = user.toJSON();
    assert.strictEqual(json.password, undefined);
    assert.strictEqual(json.__v, undefined);
    assert.strictEqual(json.email, 'charlie@example.com');
  });
});

describe('Day 5: Authentication Service Business Logic', () => {
  beforeEach(async () => {
    await authService.resetUsers();
  });

  test('generateToken creates valid JWT token signed with JWT_SECRET', () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const token = authService.generateToken(userId);

    assert.ok(token);
    assert.strictEqual(typeof token, 'string');

    // Decode and verify signature & payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    assert.strictEqual(decoded.id, userId);
    assert.ok(decoded.exp);
    assert.ok(decoded.iat);
  });

  test('registerUser creates user, hashes password, and returns JWT + sanitized user', async () => {
    const result = await authService.registerUser({
      name: 'David Miller',
      email: 'david@example.com',
      password: 'Password1234',
      defaultCurrency: 'EUR',
    });

    assert.ok(result.token);
    assert.strictEqual(result.user.name, 'David Miller');
    assert.strictEqual(result.user.email, 'david@example.com');
    assert.strictEqual(result.user.defaultCurrency, 'EUR');
    assert.strictEqual(result.user.password, undefined); // Password is never returned
  });

  test('registerUser rejects duplicate email with 400 error', async () => {
    await authService.registerUser({
      name: 'User One',
      email: 'duplicate@example.com',
      password: 'Password123',
    });

    await assert.rejects(
      async () => {
        await authService.registerUser({
          name: 'User Two',
          email: 'duplicate@example.com',
          password: 'Password456',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /already exists/);
        return true;
      }
    );
  });

  test('loginUser successfully authenticates with valid credentials', async () => {
    await authService.registerUser({
      name: 'Emma Watson',
      email: 'emma@example.com',
      password: 'HermionePassword123',
    });

    const loginResult = await authService.loginUser({
      email: 'emma@example.com',
      password: 'HermionePassword123',
    });

    assert.ok(loginResult.token);
    assert.strictEqual(loginResult.user.name, 'Emma Watson');
    assert.strictEqual(loginResult.user.email, 'emma@example.com');
    assert.strictEqual(loginResult.user.password, undefined);
  });

  test('loginUser rejects incorrect password with 401 status', async () => {
    await authService.registerUser({
      name: 'Frank Sinatra',
      email: 'frank@example.com',
      password: 'CorrectPassword123',
    });

    await assert.rejects(
      async () => {
        await authService.loginUser({
          email: 'frank@example.com',
          password: 'WrongPassword999',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.message, 'Invalid email or password');
        return true;
      }
    );
  });

  test('loginUser rejects non-existent email with 401 status', async () => {
    await assert.rejects(
      async () => {
        await authService.loginUser({
          email: 'nonexistent@example.com',
          password: 'SomePassword123',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.message, 'Invalid email or password');
        return true;
      }
    );
  });
});

describe('Day 5: Authentication HTTP Endpoints & Protected Routes', () => {
  let server;
  let baseUrl;

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'isolated_test_jwt_secret_key_1234567890';

    await new Promise((resolve) => {
      server = http.createServer(app).listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async () => {
    await authService.resetUsers();
  });

  test('POST /api/auth/register creates a user and returns 201 Created with JWT', async () => {
    const payload = {
      name: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'CompilerPassword123',
      defaultCurrency: 'USD',
    };

    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(response.status, 201);
    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.name, 'Grace Hopper');
    assert.strictEqual(body.data.user.email, 'grace@example.com');
    assert.strictEqual(body.data.user.password, undefined);
    assert.ok(body.data.token);
  });

  test('POST /api/auth/register returns 400 Bad Request for short password', async () => {
    const payload = {
      name: 'Grace Hopper',
      email: 'grace_short@example.com',
      password: '123', // < 6 chars
    };

    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.success, false);
  });

  test('POST /api/auth/login returns 200 OK and JWT for valid credentials', async () => {
    // 1. Register user first
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alan Turing',
        email: 'alan@example.com',
        password: 'EnigmaPassword123',
      }),
    });

    // 2. Login
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alan@example.com',
        password: 'EnigmaPassword123',
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.email, 'alan@example.com');
    assert.ok(body.data.token);
  });

  test('POST /api/auth/login returns 401 Unauthorized for incorrect password', async () => {
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'CorrectPassword123',
      }),
    });

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ada@example.com',
        password: 'IncorrectPassword',
      }),
    });

    assert.strictEqual(response.status, 401);
    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error, 'Invalid email or password');
  });

  test('GET /api/auth/me with valid Bearer token returns 200 and user profile', async () => {
    // 1. Register user to obtain token
    const regResp = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Margaret Hamilton',
        email: 'margaret@example.com',
        password: 'Apollo11Password',
      }),
    });

    const regData = await regResp.json();
    const token = regData.data.token;

    // 2. Call protected route with Bearer token header
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.name, 'Margaret Hamilton');
    assert.strictEqual(body.data.email, 'margaret@example.com');
    assert.strictEqual(body.data.password, undefined);
  });

  test('GET /api/auth/me without Authorization header returns 401 Unauthorized', async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`);
    assert.strictEqual(response.status, 401);

    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /no token provided/);
  });

  test('GET /api/auth/me with invalid or tampered token returns 401 Unauthorized', async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: 'Bearer invalid.tampered.jwttoken',
      },
    });

    assert.strictEqual(response.status, 401);
    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /invalid or has expired/);
  });

  test('GET /api/auth/me with expired token returns 401 Unauthorized', async () => {
    // Create an expired token manually
    const expiredToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString() },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' } // Expired 1 second ago
    );

    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    });

    assert.strictEqual(response.status, 401);
    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /invalid or has expired/);
  });

  test('POST /api/auth/logout returns 200 OK and informs client to discard token', async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.match(body.message, /discard/i);
  });
});
