import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import app from '../server.js';
import * as reportService from '../services/reportService.js';
import * as expenseService from '../services/expenseService.js';
import * as groupService from '../services/groupService.js';
import * as authService from '../services/authService.js';
import * as settlementPaymentService from '../services/settlementPaymentService.js';
import * as activityService from '../services/activityService.js';

describe('Day 14: Reports & Analytics + CSV Export', () => {
  let server;
  let baseUrl;
  let aliceToken;
  let aliceUser;
  let bobToken;
  let bobUser;
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
    await activityService.resetActivityLogs();
    await settlementPaymentService.resetSettlements();
    await expenseService.resetExpenses();
    await groupService.resetGroups();
    await authService.resetUsers();

    // Register Alice
    const regAlice = await authService.registerUser({
      name: 'Alice',
      email: 'alice.reports@example.com',
      password: 'password123',
    });
    aliceUser = regAlice.user;
    aliceToken = regAlice.token;

    // Register Bob
    const regBob = await authService.registerUser({
      name: 'Bob',
      email: 'bob.reports@example.com',
      password: 'password123',
    });
    bobUser = regBob.user;
    bobToken = regBob.token;

    // Create Group with Alice and Bob
    testGroup = await groupService.createGroup({
      name: 'European Roadtrip',
      groupType: 'Trip',
      baseCurrency: 'USD',
    }, aliceUser);

    await groupService.addMemberToGroup(testGroup.id || testGroup._id, {
      name: 'Bob',
      email: 'bob.reports@example.com',
    }, aliceUser);

    const groupId = testGroup.id || testGroup._id;

    // Expense 1: Food & Dining ($120.00)
    await expenseService.createExpense({
      title: 'Restaurant Dinner',
      amount: 120.00,
      category: 'Food & Dining',
      paidBy: 'Alice',
      group: groupId,
      participants: ['Alice', 'Bob'],
    }, aliceUser);

    // Expense 2: Transportation ($80.00)
    await expenseService.createExpense({
      title: 'Rental Car Fuel',
      amount: 80.00,
      category: 'Transportation',
      paidBy: 'Bob',
      group: groupId,
      participants: ['Alice', 'Bob'],
    }, bobUser);
  });

  test('generateGroupReport produces accurate category metrics, member balances, and itemized lists', async () => {
    const groupId = testGroup.id || testGroup._id;
    const report = await reportService.generateGroupReport(groupId, aliceUser);

    assert.ok(report.group);
    assert.strictEqual(report.group.name, 'European Roadtrip');

    // Total Spending: 120 + 80 = 200.00
    assert.strictEqual(report.summary.totalSpending, 200.00);
    assert.strictEqual(report.summary.expenseCount, 2);
    assert.strictEqual(report.summary.memberCount, 2);

    // Category Breakdown
    assert.strictEqual(report.categoryBreakdown.length, 2);
    const foodCat = report.categoryBreakdown.find((c) => c.category === 'Food & Dining');
    const transCat = report.categoryBreakdown.find((c) => c.category === 'Transportation');

    assert.strictEqual(foodCat.totalAmount, 120.00);
    assert.strictEqual(foodCat.percentage, 60.00);
    assert.strictEqual(transCat.totalAmount, 80.00);
    assert.strictEqual(transCat.percentage, 40.00);

    // Member Balances
    // Alice paid 120, owes 100 -> Net = +20
    // Bob paid 80, owes 100 -> Net = -20
    const aliceMember = report.memberBreakdown.find((m) => m.name === 'Alice');
    const bobMember = report.memberBreakdown.find((m) => m.name === 'Bob');

    assert.strictEqual(aliceMember.netBalance, 20.00);
    assert.strictEqual(bobMember.netBalance, -20.00);

    // Suggested Transaction: Bob pays Alice $20
    assert.strictEqual(report.suggestedTransactions.length, 1);
    assert.strictEqual(report.suggestedTransactions[0].from, 'Bob');
    assert.strictEqual(report.suggestedTransactions[0].to, 'Alice');
    assert.strictEqual(report.suggestedTransactions[0].amount, 20.00);
  });

  test('generateGroupReportCSV produces valid CSV content matching report numbers', async () => {
    const groupId = testGroup.id || testGroup._id;
    const { csvText, filename } = await reportService.generateGroupReportCSV(groupId, aliceUser);

    assert.ok(filename.includes('european_roadtrip'));
    assert.ok(csvText.includes('EXPENSE SPLITTER FINANCIAL REPORT'));
    assert.ok(csvText.includes('Total Group Spending,$200.00'));
    assert.ok(csvText.includes('Food & Dining,120.00,1,60.0%'));
    assert.ok(csvText.includes('Transportation,80.00,1,40.0%'));
    assert.ok(csvText.includes('Bob,Alice,20.00'));
  });

  test('HTTP GET /api/reports/group/:id returns 200 with JSON report', async () => {
    const groupId = testGroup.id || testGroup._id;
    const response = await fetch(`${baseUrl}/api/reports/group/${groupId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.summary.totalSpending, 200.00);
  });

  test('HTTP GET /api/reports/group/:id/csv returns 200 with text/csv content type', async () => {
    const groupId = testGroup.id || testGroup._id;
    const response = await fetch(`${baseUrl}/api/reports/group/${groupId}/csv`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.ok(response.headers.get('content-disposition').includes('attachment; filename='));

    const csvContent = await response.text();
    assert.ok(csvContent.includes('EXPENSE SPLITTER FINANCIAL REPORT'));
  });

  test('AUTHORIZATION: Non-member user is rejected with 403 Forbidden', async () => {
    // Register Charlie (separate user who is not in testGroup)
    const regCharlie = await authService.registerUser({
      name: 'Charlie',
      email: 'charlie.outsider@example.com',
      password: 'password123',
    });

    const groupId = testGroup.id || testGroup._id;
    const response = await fetch(`${baseUrl}/api/reports/group/${groupId}`, {
      headers: { Authorization: `Bearer ${regCharlie.token}` },
    });

    assert.strictEqual(response.status, 403);
    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Forbidden/);
  });
});
