import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import app from '../server.js';
import * as activityService from '../services/activityService.js';
import * as expenseService from '../services/expenseService.js';
import * as groupService from '../services/groupService.js';
import * as authService from '../services/authService.js';
import * as settlementPaymentService from '../services/settlementPaymentService.js';

describe('Day 13: History & Activity Log (Audit Trail & Authorization)', () => {
  let server;
  let baseUrl;
  let aliceToken;
  let aliceUser;
  let bobToken;
  let bobUser;
  let aliceGroup;

  before(async () => {
    process.env.NODE_ENV = 'test';
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
    await activityService.resetActivityLogs();
    await settlementPaymentService.resetSettlements();
    await expenseService.resetExpenses();
    await groupService.resetGroups();
    await authService.resetUsers();

    // Register Alice
    const regAlice = await authService.registerUser({
      name: 'Alice',
      email: 'alice.activity@example.com',
      password: 'password123',
    });
    aliceUser = regAlice.user;
    aliceToken = regAlice.token;

    // Register Bob (separate user)
    const regBob = await authService.registerUser({
      name: 'Bob',
      email: 'bob.activity@example.com',
      password: 'password123',
    });
    bobUser = regBob.user;
    bobToken = regBob.token;

    // Alice creates a private group
    aliceGroup = await groupService.createGroup({
      name: 'Alice Private Project',
      groupType: 'Project',
    }, aliceUser);
  });

  test('records activity logs when expenses and settlements are created', async () => {
    const groupId = aliceGroup.id || aliceGroup._id;

    // 1. Create Expense
    const expense = await expenseService.createExpense({
      title: 'Server Hosting',
      amount: 60.00,
      paidBy: 'Alice',
      group: groupId,
      category: 'Utilities',
    }, aliceUser);

    // 2. Add Bob to group
    await groupService.addMemberToGroup(groupId, {
      name: 'Bob',
      email: 'bob.activity@example.com',
    }, aliceUser);

    // 3. Record Settlement
    await settlementPaymentService.recordSettlementPayment({
      group: groupId,
      senderName: 'Bob',
      receiverName: 'Alice',
      amount: 30.00,
    }, aliceUser);

    // 4. Retrieve Group Activity Logs as Alice (member)
    const logs = await activityService.getGroupActivity(groupId, aliceUser);
    assert.strictEqual(logs.length >= 3, true);

    const actions = logs.map((l) => l.action);
    assert.ok(actions.includes('GROUP_CREATED'));
    assert.ok(actions.includes('EXPENSE_CREATED'));
    assert.ok(actions.includes('MEMBER_ADDED'));
    assert.ok(actions.includes('SETTLEMENT_RECORDED'));
  });

  test('AUTHORIZATION: Non-member is rejected with 403 Forbidden from viewing another group activity', async () => {
    const groupId = aliceGroup.id || aliceGroup._id;

    // Bob attempts to fetch Alice's group activity before being added as a member
    const response = await fetch(`${baseUrl}/api/activity/group/${groupId}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });

    assert.strictEqual(response.status, 403);
    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Forbidden.*not a member/);
  });

  test('GET /api/activity returns all activities for groups the authenticated user belongs to', async () => {
    const response = await fetch(`${baseUrl}/api/activity`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(Array.isArray(body.data), true);
    assert.strictEqual(body.count >= 1, true);
  });
});
