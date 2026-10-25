import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import mongoose from 'mongoose';
import app from '../server.js';
import * as authService from '../services/authService.js';
import * as groupService from '../services/groupService.js';

describe('Day 6: Group Service Business Logic & Embedded Members', () => {
  beforeEach(async () => {
    await authService.resetUsers();
    await groupService.resetGroups();
  });

  test('createGroup embeds creator as first member with admin role', async () => {
    const creatorUser = {
      _id: new mongoose.Types.ObjectId().toString(),
      name: 'Alice Johnson',
      email: 'alice@example.com',
    };

    const group = await groupService.createGroup(
      {
        name: 'Goa Summer Trip',
        description: 'Beach vacation expenses',
        groupType: 'Trip',
        baseCurrency: 'INR',
        simplifyDebts: true,
      },
      creatorUser
    );

    assert.ok(group.id || group._id);
    assert.strictEqual(group.name, 'Goa Summer Trip');
    assert.strictEqual(group.groupType, 'Trip');
    assert.strictEqual(group.baseCurrency, 'INR');
    assert.strictEqual(group.simplifyDebts, true);
    assert.strictEqual(group.members.length, 1);

    const firstMember = group.members[0];
    assert.strictEqual(String(firstMember.userId), String(creatorUser._id));
    assert.strictEqual(firstMember.name, 'Alice Johnson');
    assert.strictEqual(firstMember.role, 'admin');
    assert.ok(firstMember.joinedAt);
  });

  test('createGroup rejects invalid name (< 2 characters)', async () => {
    const creatorUser = {
      _id: new mongoose.Types.ObjectId().toString(),
      name: 'Alice',
      email: 'alice@example.com',
    };

    await assert.rejects(
      async () => {
        await groupService.createGroup({ name: 'A' }, creatorUser);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /at least 2 characters/i);
        return true;
      }
    );
  });

  test('addMemberToGroup adds new member and prevents duplicate memberships', async () => {
    const creatorUser = {
      _id: new mongoose.Types.ObjectId().toString(),
      name: 'Alice',
      email: 'alice@example.com',
    };

    const group = await groupService.createGroup({ name: 'Flatmates' }, creatorUser);
    const groupId = group.id || group._id;

    // Add Bob as new member
    const bobUserId = new mongoose.Types.ObjectId().toString();
    const updated = await groupService.addMemberToGroup(
      groupId,
      {
        userId: bobUserId,
        name: 'Bob Smith',
        email: 'bob@example.com',
        role: 'member',
      },
      creatorUser
    );

    assert.strictEqual(updated.members.length, 2);
    assert.strictEqual(updated.members[1].name, 'Bob Smith');
    assert.strictEqual(updated.members[1].role, 'member');

    // Attempt to add Bob again (duplicate check)
    await assert.rejects(
      async () => {
        await groupService.addMemberToGroup(
          groupId,
          {
            userId: bobUserId,
            name: 'Bob Duplicate',
            email: 'bob@example.com',
          },
          creatorUser
        );
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /already a member/i);
        return true;
      }
    );
  });

  test('removeMemberFromGroup removes member and prevents removing last member', async () => {
    const creatorUser = {
      _id: new mongoose.Types.ObjectId().toString(),
      name: 'Alice',
      email: 'alice@example.com',
    };

    const group = await groupService.createGroup({ name: 'Project Alpha' }, creatorUser);
    const groupId = group.id || group._id;

    // Add Charlie
    const charlieId = new mongoose.Types.ObjectId().toString();
    const groupWithCharlie = await groupService.addMemberToGroup(
      groupId,
      {
        userId: charlieId,
        name: 'Charlie',
        email: 'charlie@example.com',
      },
      creatorUser
    );

    assert.strictEqual(groupWithCharlie.members.length, 2);

    // Remove Charlie
    const groupAfterRemoval = await groupService.removeMemberFromGroup(
      groupId,
      charlieId,
      creatorUser
    );
    assert.strictEqual(groupAfterRemoval.members.length, 1);

    // Attempt to remove the only remaining member (Alice)
    await assert.rejects(
      async () => {
        await groupService.removeMemberFromGroup(groupId, creatorUser._id, creatorUser);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /at least one member/i);
        return true;
      }
    );
  });

  test('updateGroup modifies group settings and fields', async () => {
    const creatorUser = {
      _id: new mongoose.Types.ObjectId().toString(),
      name: 'Alice',
      email: 'alice@example.com',
    };

    const group = await groupService.createGroup({ name: 'Old Name', groupType: 'Other' }, creatorUser);
    const groupId = group.id || group._id;

    const updated = await groupService.updateGroup(
      groupId,
      {
        name: 'New Group Name',
        groupType: 'Home',
        baseCurrency: 'EUR',
        simplifyDebts: false,
      },
      creatorUser
    );

    assert.strictEqual(updated.name, 'New Group Name');
    assert.strictEqual(updated.groupType, 'Home');
    assert.strictEqual(updated.baseCurrency, 'EUR');
    assert.strictEqual(updated.simplifyDebts, false);
  });
});

describe('Day 6: Authentication vs Authorization (Two Users & Group Permission Guard)', () => {
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
    await groupService.resetGroups();
  });

  test('POST /api/groups creates a group and returns 201 with embedded members', async () => {
    // 1. Register Alice
    const regResp = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Johnson',
        email: 'alice@test.com',
        password: 'Password123',
      }),
    });
    const { data: { token } } = await regResp.json();

    // 2. Create Group
    const groupResp = await fetch(`${baseUrl}/api/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Roommates 2026',
        description: 'Apartment shared bills',
        groupType: 'Home',
        baseCurrency: 'USD',
        simplifyDebts: true,
      }),
    });

    assert.strictEqual(groupResp.status, 201);
    const body = await groupResp.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.name, 'Roommates 2026');
    assert.strictEqual(body.data.groupType, 'Home');
    assert.strictEqual(body.data.baseCurrency, 'USD');
    assert.strictEqual(body.data.simplifyDebts, true);
    assert.strictEqual(body.data.members.length, 1);
    assert.strictEqual(body.data.members[0].name, 'Alice Johnson');
    assert.strictEqual(body.data.members[0].role, 'admin');
  });

  test('GET /api/groups returns only groups where the user is a member', async () => {
    // 1. Register Alice
    const aliceReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@test.com', password: 'Password123' }),
    });
    const { data: { token: aliceToken } } = await aliceReg.json();

    // 2. Register Charlie
    const charlieReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Charlie', email: 'charlie@test.com', password: 'Password123' }),
    });
    const { data: { token: charlieToken } } = await charlieReg.json();

    // 3. Alice creates a group
    await fetch(`${baseUrl}/api/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ name: 'Alice Private Trip', groupType: 'Trip' }),
    });

    // 4. Alice views her groups (Expect 1 group)
    const aliceGroupsResp = await fetch(`${baseUrl}/api/groups`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(aliceGroupsResp.status, 200);
    const aliceBody = await aliceGroupsResp.json();
    assert.strictEqual(aliceBody.data.length, 1);
    assert.strictEqual(aliceBody.data[0].name, 'Alice Private Trip');

    // 5. Charlie views his groups (Expect 0 groups)
    const charlieGroupsResp = await fetch(`${baseUrl}/api/groups`, {
      headers: { Authorization: `Bearer ${charlieToken}` },
    });
    assert.strictEqual(charlieGroupsResp.status, 200);
    const charlieBody = await charlieGroupsResp.json();
    assert.strictEqual(charlieBody.data.length, 0);
  });

  test('PROVE AUTHORIZATION: Charlie (valid logged-in user) is rejected with 403 Forbidden from Alice private group', async () => {
    // 1. Register Alice
    const aliceReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice_guard@test.com', password: 'Password123' }),
    });
    const { data: { token: aliceToken } } = await aliceReg.json();

    // 2. Register Charlie
    const charlieReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Charlie', email: 'charlie_guard@test.com', password: 'Password123' }),
    });
    const { data: { token: charlieToken } } = await charlieReg.json();

    // 3. Alice creates private group
    const groupResp = await fetch(`${baseUrl}/api/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ name: 'Alice & Bob Private House', groupType: 'Home' }),
    });
    const { data: aliceGroup } = await groupResp.json();
    const groupId = aliceGroup.id || aliceGroup._id;

    // 4. Unauthenticated client (no token) -> 401 Unauthorized (Authentication failure)
    const unauthResp = await fetch(`${baseUrl}/api/groups/${groupId}`);
    assert.strictEqual(unauthResp.status, 401);
    const unauthBody = await unauthResp.json();
    assert.match(unauthBody.error, /no token provided/i);

    // 5. Charlie (authenticated with valid JWT) attempts GET /api/groups/:id -> 403 Forbidden (Authorization failure)
    const charlieGetResp = await fetch(`${baseUrl}/api/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${charlieToken}` },
    });
    assert.strictEqual(charlieGetResp.status, 403);
    const charlieGetBody = await charlieGetResp.json();
    assert.strictEqual(charlieGetBody.success, false);
    assert.match(charlieGetBody.error, /Forbidden.*not a member/i);

    // 6. Charlie attempts POST /api/groups/:id/members (add unauthorized member) -> 403 Forbidden
    const charliePostResp = await fetch(`${baseUrl}/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${charlieToken}` },
      body: JSON.stringify({ name: 'Hacker', email: 'hacker@test.com' }),
    });
    assert.strictEqual(charliePostResp.status, 403);

    // 7. Charlie attempts PUT /api/groups/:id (modify group settings) -> 403 Forbidden
    const charliePutResp = await fetch(`${baseUrl}/api/groups/${groupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${charlieToken}` },
      body: JSON.stringify({ name: 'Hacked Group Name' }),
    });
    assert.strictEqual(charliePutResp.status, 403);

    // 8. Alice (authorized admin) calls GET /api/groups/:id -> 200 OK
    const aliceGetResp = await fetch(`${baseUrl}/api/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.strictEqual(aliceGetResp.status, 200);
    const aliceGetBody = await aliceGetResp.json();
    assert.strictEqual(aliceGetBody.success, true);
    assert.strictEqual(aliceGetBody.data.name, 'Alice & Bob Private House');
  });

  test('Admin can add member and updated member can now access group (200 OK)', async () => {
    // 1. Register Alice & Bob
    const aliceReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice_admin@test.com', password: 'Password123' }),
    });
    const { data: { token: aliceToken } } = await aliceReg.json();

    const bobReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob', email: 'bob_admin@test.com', password: 'Password123' }),
    });
    const { data: { token: bobToken, user: bobUser } } = await bobReg.json();

    // 2. Alice creates group
    const groupResp = await fetch(`${baseUrl}/api/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ name: 'Europe Trip 2026', groupType: 'Trip' }),
    });
    const { data: group } = await groupResp.json();
    const groupId = group.id || group._id;

    // 3. Before being added: Bob gets 403 Forbidden
    const bobBeforeResp = await fetch(`${baseUrl}/api/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    assert.strictEqual(bobBeforeResp.status, 403);

    // 4. Alice adds Bob as a member
    const addMemberResp = await fetch(`${baseUrl}/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({
        userId: bobUser._id || bobUser.id,
        name: bobUser.name,
        email: bobUser.email,
        role: 'member',
      }),
    });
    assert.strictEqual(addMemberResp.status, 201);
    const addMemberBody = await addMemberResp.json();
    assert.strictEqual(addMemberBody.data.members.length, 2);

    // 5. After being added: Bob now gets 200 OK!
    const bobAfterResp = await fetch(`${baseUrl}/api/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    assert.strictEqual(bobAfterResp.status, 200);
    const bobAfterBody = await bobAfterResp.json();
    assert.strictEqual(bobAfterBody.data.name, 'Europe Trip 2026');

    // 6. View members endpoint: GET /api/groups/:id/members
    const membersResp = await fetch(`${baseUrl}/api/groups/${groupId}/members`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    assert.strictEqual(membersResp.status, 200);
    const membersBody = await membersResp.json();
    assert.strictEqual(membersBody.count, 2);
  });
});
