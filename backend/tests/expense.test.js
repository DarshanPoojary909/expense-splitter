import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import mongoose from 'mongoose';
import app from '../server.js';
import * as expenseService from '../services/expenseService.js';
import { User, Group, Expense, SettlementPayment, ActivityLog } from '../models/index.js';

describe('Day 4: Mongoose Models & Schema Validation', () => {
  test('User model requires valid email and minimum password length', async () => {
    const invalidUser = new User({
      name: 'A', // too short
      email: 'invalid-email',
      password: '123', // too short (< 6)
    });

    let validationErr = null;
    try {
      await invalidUser.validate();
    } catch (err) {
      validationErr = err;
    }

    assert.ok(validationErr);
    assert.ok(validationErr.errors.email);
    assert.ok(validationErr.errors.password);
    assert.ok(validationErr.errors.name);
  });

  test('Group model validates embedded members array and groupType', async () => {
    const group = new Group({
      name: 'Goa Vacation',
      groupType: 'Trip',
      createdBy: new mongoose.Types.ObjectId(),
      members: [
        {
          userId: new mongoose.Types.ObjectId(),
          name: 'Alice',
          role: 'admin',
        },
      ],
    });

    await group.validate();
    assert.strictEqual(group.members.length, 1);
    assert.strictEqual(group.members[0].role, 'admin');
    assert.ok(group.members[0].joinedAt instanceof Date);
  });

  test('Group model rejects empty members array', async () => {
    const group = new Group({
      name: 'Empty Group',
      createdBy: new mongoose.Types.ObjectId(),
      members: [],
    });

    await assert.rejects(
      async () => {
        await group.validate();
      },
      (err) => {
        assert.ok(err.errors.members);
        return true;
      }
    );
  });

  test('Expense model embeds payers and splits arrays and validates positive amount', async () => {
    const expense = new Expense({
      title: 'Dinner at Bistro',
      amount: 150.00,
      paidBy: 'Alice',
      category: 'Food & Dining',
      payers: [{ name: 'Alice', amount: 150.00 }],
      splitType: 'EQUAL',
      splits: [
        { name: 'Alice', amountOwed: 50.00 },
        { name: 'Bob', amountOwed: 50.00 },
        { name: 'Charlie', amountOwed: 50.00 },
      ],
      expenseDate: new Date(),
    });

    await expense.validate();
    assert.strictEqual(expense.payers.length, 1);
    assert.strictEqual(expense.splits.length, 3);
    assert.ok(expense.expenseDate instanceof Date);
  });

  test('Expense model rejects negative or zero amounts', async () => {
    const expense = new Expense({
      title: 'Invalid Amount Expense',
      amount: -25.00,
      paidBy: 'Bob',
    });

    await assert.rejects(
      async () => {
        await expense.validate();
      },
      (err) => {
        assert.ok(err.errors.amount);
        return true;
      }
    );
  });

  test('SettlementPayment model validates references and status enum', async () => {
    const payment = new SettlementPayment({
      group: new mongoose.Types.ObjectId(),
      sender: new mongoose.Types.ObjectId(),
      senderName: 'Bob',
      receiver: new mongoose.Types.ObjectId(),
      receiverName: 'Alice',
      amount: 50.00,
      status: 'completed',
      paymentMethod: 'UPI',
    });

    await payment.validate();
    assert.strictEqual(payment.status, 'completed');
    assert.strictEqual(payment.paymentMethod, 'UPI');
    assert.ok(payment.paymentDate instanceof Date);
  });

  test('ActivityLog model validates action enum and entityType', async () => {
    const log = new ActivityLog({
      group: new mongoose.Types.ObjectId(),
      action: 'EXPENSE_CREATED',
      entityType: 'Expense',
      entityId: new mongoose.Types.ObjectId(),
      description: 'Alice added Team Lunch for $120.00',
    });

    await log.validate();
    assert.strictEqual(log.action, 'EXPENSE_CREATED');
    assert.strictEqual(log.entityType, 'Expense');
  });
});

describe('Day 4: Expense Service (Business Logic & Monetary Precision)', () => {
  beforeEach(async () => {
    await expenseService.resetExpenses();
  });

  test('formatMoney handles floating-point precision properly', () => {
    // In raw JS: 0.1 + 0.2 === 0.30000000000000004
    const sum = 0.1 + 0.2;
    assert.notStrictEqual(sum, 0.3); // Proves standard floating point drift

    const formatted = expenseService.formatMoney(sum);
    assert.strictEqual(formatted, 0.30); // Solved by formatMoney

    assert.strictEqual(expenseService.formatMoney(10 / 3), 3.33);
    assert.strictEqual(expenseService.formatMoney('45.678'), 45.68);
  });

  test('getAllExpenses returns array of expenses', async () => {
    const list = await expenseService.getAllExpenses();
    assert.strictEqual(Array.isArray(list), true);
    assert.strictEqual(list.length >= 1, true);
    assert.ok(list[0].id || list[0]._id);
  });

  test('createExpense successfully creates valid expense with embedded payers & splits', async () => {
    const newExpense = await expenseService.createExpense({
      title: 'Groceries',
      amount: 60.50,
      paidBy: 'Alice',
      category: 'Groceries',
      participants: ['Alice', 'Bob'],
    });

    assert.ok(newExpense.id || newExpense._id);
    assert.strictEqual(newExpense.title, 'Groceries');
    assert.strictEqual(newExpense.amount, 60.50);
    assert.strictEqual(newExpense.paidBy, 'Alice');
    assert.strictEqual(newExpense.payers.length, 1);
    assert.strictEqual(newExpense.splits.length, 2);

    const found = await expenseService.getExpenseById(newExpense.id || newExpense._id);
    assert.strictEqual(found.title, 'Groceries');
  });

  test('createExpense throws validation error on missing title', async () => {
    await assert.rejects(
      async () => {
        await expenseService.createExpense({
          amount: 50,
          paidBy: 'Alice',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /Title\/description is required/);
        return true;
      }
    );
  });

  test('createExpense throws validation error on invalid amount', async () => {
    await assert.rejects(
      async () => {
        await expenseService.createExpense({
          title: 'Lunch',
          amount: -10,
          paidBy: 'Alice',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /Amount must be a positive number/);
        return true;
      }
    );
  });

  test('updateExpense updates specified fields', async () => {
    const list = await expenseService.getAllExpenses();
    const targetId = list[0].id || list[0]._id;

    const updated = await expenseService.updateExpense(targetId, {
      title: 'Updated Lunch Title',
      amount: 150.00,
    });

    assert.ok(updated);
    assert.strictEqual(updated.title, 'Updated Lunch Title');
    assert.strictEqual(updated.amount, 150.00);
  });

  test('updateExpense returns null for non-existent ID', async () => {
    const res = await expenseService.updateExpense('507f1f77bcf86cd799439099', { title: 'Test' });
    assert.strictEqual(res, null);
  });

  test('deleteExpense removes the expense', async () => {
    const list = await expenseService.getAllExpenses();
    const targetId = list[0].id || list[0]._id;

    const deleted = await expenseService.deleteExpense(targetId);
    assert.ok(deleted);

    const check = await expenseService.getExpenseById(targetId);
    assert.strictEqual(check, null);
  });
});

describe('Day 4: Expense HTTP Endpoints (Express Routes & Controller)', () => {
  let server;
  let baseUrl;

  before(async () => {
    process.env.NODE_ENV = 'test';
    // Start test server on ephemeral port
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
    await expenseService.resetExpenses();
  });

  test('GET /api/health returns 200 OK and database status', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(response.status, 200);

    const body = await response.json();
    assert.strictEqual(body.status, 'healthy');
    assert.strictEqual(body.project, 'Expense Splitter with Settlement Optimization');
    assert.ok(body.database);
  });

  test('GET /api/expenses returns 200 and list of expenses', async () => {
    const response = await fetch(`${baseUrl}/api/expenses`);
    assert.strictEqual(response.status, 200);

    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(Array.isArray(body.data), true);
    assert.strictEqual(body.count >= 1, true);
  });

  test('POST /api/expenses creates a new expense and returns 201 Created', async () => {
    const payload = {
      title: 'Dinner with Team',
      amount: 85.50,
      paidBy: 'Bob',
      category: 'Food & Dining',
      participants: ['Bob', 'Alice'],
    };

    const response = await fetch(`${baseUrl}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(response.status, 201);
    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.title, 'Dinner with Team');
    assert.strictEqual(body.data.amount, 85.50);
    assert.strictEqual(body.data.paidBy, 'Bob');
  });

  test('POST /api/expenses with missing fields returns 400 Bad Request', async () => {
    const payload = {
      amount: 100, // missing title and paidBy
    };

    const response = await fetch(`${baseUrl}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Title/description is required'));
  });

  test('GET /api/expenses/:id returns 200 for existing expense', async () => {
    const listResp = await fetch(`${baseUrl}/api/expenses`);
    const listBody = await listResp.json();
    const firstId = listBody.data[0].id || listBody.data[0]._id;

    const response = await fetch(`${baseUrl}/api/expenses/${firstId}`);
    assert.strictEqual(response.status, 200);

    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.id || body.data._id, firstId);
  });

  test('GET /api/expenses/:id returns 404 for non-existent ID', async () => {
    const response = await fetch(`${baseUrl}/api/expenses/507f1f77bcf86cd799439099`);
    assert.strictEqual(response.status, 404);

    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Expense not found'));
  });

  test('PUT /api/expenses/:id updates expense and returns 200', async () => {
    const listResp = await fetch(`${baseUrl}/api/expenses`);
    const listBody = await listResp.json();
    const firstId = listBody.data[0].id || listBody.data[0]._id;

    const response = await fetch(`${baseUrl}/api/expenses/${firstId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Updated Team Lunch',
        amount: 140.00,
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.title, 'Updated Team Lunch');
    assert.strictEqual(body.data.amount, 140.00);
  });

  test('PUT /api/expenses/:id returns 404 for non-existent ID', async () => {
    const response = await fetch(`${baseUrl}/api/expenses/507f1f77bcf86cd799439099`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title' }),
    });

    assert.strictEqual(response.status, 404);
  });

  test('DELETE /api/expenses/:id deletes expense and returns 200', async () => {
    const listResp = await fetch(`${baseUrl}/api/expenses`);
    const listBody = await listResp.json();
    const firstId = listBody.data[0].id || listBody.data[0]._id;

    const response = await fetch(`${baseUrl}/api/expenses/${firstId}`, {
      method: 'DELETE',
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.success, true);

    // Confirm it is deleted
    const verifyResp = await fetch(`${baseUrl}/api/expenses/${firstId}`);
    assert.strictEqual(verifyResp.status, 404);
  });

  test('DELETE /api/expenses/:id returns 404 for non-existent ID', async () => {
    const response = await fetch(`${baseUrl}/api/expenses/507f1f77bcf86cd799439099`, {
      method: 'DELETE',
    });

    assert.strictEqual(response.status, 404);
  });

  test('GET /api/non-existent-route triggers 404 Not Found handler', async () => {
    const response = await fetch(`${baseUrl}/api/non-existent-route`);
    assert.strictEqual(response.status, 404);

    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Resource Not Found'));
  });
});

describe('Day 8: Expense Management & Multi-layer Validation Tests', () => {
  let server;
  let baseUrl;
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
    await expenseService.resetExpenses();
  });

  test('createExpense rejects invalid date format with 400', async () => {
    await assert.rejects(
      async () => {
        await expenseService.createExpense({
          title: 'Movie Night',
          amount: 25.00,
          paidBy: 'Alice',
          expenseDate: 'not-a-valid-date-string',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /Invalid expense date/);
        return true;
      }
    );
  });

  test('createExpense rejects non-existent group ID with 400', async () => {
    await assert.rejects(
      async () => {
        await expenseService.createExpense({
          title: 'Trip Snacks',
          amount: 45.00,
          paidBy: 'Alice',
          group: new mongoose.Types.ObjectId().toString(),
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /Group not found/);
        return true;
      }
    );
  });

  test('createExpense rejects mismatched multi-payer amounts with 400', async () => {
    await assert.rejects(
      async () => {
        await expenseService.createExpense({
          title: 'Dinner',
          amount: 100.00,
          paidBy: 'Alice',
          payers: [
            { name: 'Alice', amount: 40.00 },
            { name: 'Bob', amount: 40.00 }, // sum = 80, not 100
          ],
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /Total payer amounts.*does not match/);
        return true;
      }
    );
  });

  test('POST /api/expenses with negative amount returns 400 Bad Request', async () => {
    const response = await fetch(`${baseUrl}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Negative Expense',
        amount: -50.00,
        paidBy: 'Alice',
      }),
    });

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Amount must be a positive number/);
  });

  test('POST /api/expenses with empty title returns 400 Bad Request', async () => {
    const response = await fetch(`${baseUrl}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '   ',
        amount: 50.00,
        paidBy: 'Alice',
      }),
    });

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Title\/description is required/);
  });

  test('POST /api/expenses with invalid category returns 400 Bad Request', async () => {
    const response = await fetch(`${baseUrl}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Invalid Category Expense',
        amount: 50.00,
        paidBy: 'Alice',
        category: 'NonExistentCategory',
      }),
    });

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Category must be one of/);
  });

  test('Complete CRUD cycle: Add -> View -> Edit -> Delete', async () => {
    // 1. Add Expense
    const addResp = await fetch(`${baseUrl}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Cycle Test Expense',
        amount: 88.75,
        paidBy: 'Alice',
        category: 'Entertainment',
        currency: 'USD',
        notes: 'Testing full CRUD lifecycle',
      }),
    });
    assert.strictEqual(addResp.status, 201);
    const addData = await addResp.json();
    const createdId = addData.data.id || addData.data._id;
    assert.strictEqual(addData.data.title, 'Cycle Test Expense');
    assert.strictEqual(addData.data.amount, 88.75);

    // 2. View Expense by ID
    const viewResp = await fetch(`${baseUrl}/api/expenses/${createdId}`);
    assert.strictEqual(viewResp.status, 200);
    const viewData = await viewResp.json();
    assert.strictEqual(viewData.data.title, 'Cycle Test Expense');
    assert.strictEqual(viewData.data.notes, 'Testing full CRUD lifecycle');

    // 3. Edit Expense
    const editResp = await fetch(`${baseUrl}/api/expenses/${createdId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Updated Cycle Expense',
        amount: 95.00,
        category: 'Shopping',
      }),
    });
    assert.strictEqual(editResp.status, 200);
    const editData = await editResp.json();
    assert.strictEqual(editData.data.title, 'Updated Cycle Expense');
    assert.strictEqual(editData.data.amount, 95.00);
    assert.strictEqual(editData.data.category, 'Shopping');

    // 4. Delete Expense
    const delResp = await fetch(`${baseUrl}/api/expenses/${createdId}`, {
      method: 'DELETE',
    });
    assert.strictEqual(delResp.status, 200);

    // 5. Verify Not Found
    const verifyResp = await fetch(`${baseUrl}/api/expenses/${createdId}`);
    assert.strictEqual(verifyResp.status, 404);
  });
});

