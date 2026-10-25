import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import mongoose from 'mongoose';
import app from '../server.js';
import * as settlementPaymentService from '../services/settlementPaymentService.js';
import * as expenseService from '../services/expenseService.js';
import * as groupService from '../services/groupService.js';
import * as authService from '../services/authService.js';

describe('Day 12: Settlement Payments & Partial Settlements', () => {
  let server;
  let baseUrl;
  let authToken;
  let testUser;
  let testGroup;

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
    await settlementPaymentService.resetSettlements();
    await expenseService.resetExpenses();
    await groupService.resetGroups();
    await authService.resetUsers();

    // Create user and group
    const reg = await authService.registerUser({
      name: 'Alice',
      email: 'alice.settle@example.com',
      password: 'password123',
    });
    testUser = reg.user;
    authToken = reg.token;

    testGroup = await groupService.createGroup({
      name: 'Trip to Tokyo',
      groupType: 'Trip',
    }, testUser);

    // Add Bob to group
    await groupService.addMemberToGroup(testGroup.id || testGroup._id, {
      name: 'Bob',
      email: 'bob.settle@example.com',
    }, testUser);
  });

  test('records full settlement payment with completed status', async () => {
    const payment = await settlementPaymentService.recordSettlementPayment({
      group: testGroup.id || testGroup._id,
      senderName: 'Bob',
      receiverName: 'Alice',
      amount: 400.00,
      paymentMethod: 'UPI',
      notes: 'Full settle up for Tokyo hotel',
    }, testUser);

    assert.ok(payment.id || payment._id);
    assert.strictEqual(payment.amount, 400.00);
    assert.strictEqual(payment.status, 'completed');
    assert.strictEqual(payment.paidAmount, 400.00);
    assert.strictEqual(payment.remainingAmount, 0.00);
    assert.strictEqual(payment.senderName, 'Bob');
    assert.strictEqual(payment.receiverName, 'Alice');
  });

  test('records partial settlement payment and computes remaining amount (Alice pays Bob $400 of $1000)', async () => {
    const payment = await settlementPaymentService.recordSettlementPayment({
      group: testGroup.id || testGroup._id,
      senderName: 'Alice',
      receiverName: 'Bob',
      amount: 400.00,
      originalAmount: 1000.00,
      paymentMethod: 'Cash',
      notes: 'Part 1 of loan repayment',
    }, testUser);

    assert.ok(payment.id || payment._id);
    assert.strictEqual(payment.amount, 400.00);
    assert.strictEqual(payment.originalAmount, 1000.00);
    assert.strictEqual(payment.paidAmount, 400.00);
    assert.strictEqual(payment.remainingAmount, 600.00);
    assert.strictEqual(payment.status, 'partial');
  });

  test('rejects settlement payment when sender and receiver are the same person', async () => {
    await assert.rejects(
      async () => {
        await settlementPaymentService.recordSettlementPayment({
          group: testGroup.id || testGroup._id,
          senderName: 'Alice',
          receiverName: 'Alice',
          amount: 50.00,
        }, testUser);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /cannot be the same person/);
        return true;
      }
    );
  });

  test('rejects negative or zero settlement amounts', async () => {
    await assert.rejects(
      async () => {
        await settlementPaymentService.recordSettlementPayment({
          group: testGroup.id || testGroup._id,
          senderName: 'Bob',
          receiverName: 'Alice',
          amount: -50.00,
        }, testUser);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /must be greater than 0/);
        return true;
      }
    );
  });

  test('HTTP POST /api/settlements creates settlement and GET /api/settlements/group/:id retrieves it', async () => {
    const groupId = testGroup.id || testGroup._id;

    // 1. Create Settlement via POST
    const createResp = await fetch(`${baseUrl}/api/settlements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        group: groupId,
        senderName: 'Bob',
        receiverName: 'Alice',
        amount: 250.00,
        originalAmount: 500.00,
        paymentMethod: 'Bank Transfer',
        notes: 'Half payment for flights',
      }),
    });

    assert.strictEqual(createResp.status, 201);
    const createBody = await createResp.json();
    assert.strictEqual(createBody.success, true);
    assert.strictEqual(createBody.data.amount, 250.00);
    assert.strictEqual(createBody.data.status, 'partial');
    assert.strictEqual(createBody.data.remainingAmount, 250.00);

    // 2. Fetch Group Settlements
    const getResp = await fetch(`${baseUrl}/api/settlements/group/${groupId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    assert.strictEqual(getResp.status, 200);
    const getBody = await getResp.json();
    assert.strictEqual(getBody.success, true);
    assert.strictEqual(getBody.count, 1);
    assert.strictEqual(getBody.data[0].amount, 250.00);

    // 3. Fetch Group Balances endpoint
    const balResp = await fetch(`${baseUrl}/api/settlements/group/${groupId}/balances`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.strictEqual(balResp.status, 200);
    const balBody = await balResp.json();
    assert.strictEqual(balBody.success, true);
    assert.ok(balBody.data.balances);

    // 4. Fetch Group Optimized Plan endpoint
    const optResp = await fetch(`${baseUrl}/api/settlements/group/${groupId}/optimized`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.strictEqual(optResp.status, 200);
    const optBody = await optResp.json();
    assert.strictEqual(optBody.success, true);
    assert.ok(optBody.data.suggestedTransactions);
  });
});
