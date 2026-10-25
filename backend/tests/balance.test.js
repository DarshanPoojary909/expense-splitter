import { test, describe } from 'node:test';
import assert from 'node:assert';
import { calculateBalances } from '../services/balanceService.js';

describe('Day 10: Net Balance Calculation (Pure Business Logic)', () => {
  test('calculates correct net balances for standard 3-person split (Alice +$700, Bob -$400, Charlie -$300)', () => {
    // Alice paid $1000 for dinner with Alice ($300), Bob ($400), Charlie ($300)
    const expenses = [
      {
        title: 'Team Dinner',
        amount: 1000.00,
        paidBy: 'Alice',
        payers: [{ name: 'Alice', amount: 1000.00 }],
        splits: [
          { name: 'Alice', amountOwed: 300.00 },
          { name: 'Bob', amountOwed: 400.00 },
          { name: 'Charlie', amountOwed: 300.00 },
        ],
      },
    ];

    const result = calculateBalances(expenses, [], ['Alice', 'Bob', 'Charlie']);
    const { balances } = result;

    assert.strictEqual(balances.length, 3);

    const alice = balances.find((b) => b.name === 'Alice');
    const bob = balances.find((b) => b.name === 'Bob');
    const charlie = balances.find((b) => b.name === 'Charlie');

    assert.strictEqual(alice.totalPaid, 1000.00);
    assert.strictEqual(alice.totalOwed, 300.00);
    assert.strictEqual(alice.netBalance, 700.00); // Creditor (+700)

    assert.strictEqual(bob.totalPaid, 0.00);
    assert.strictEqual(bob.totalOwed, 400.00);
    assert.strictEqual(bob.netBalance, -400.00); // Debtor (-400)

    assert.strictEqual(charlie.totalPaid, 0.00);
    assert.strictEqual(charlie.totalOwed, 300.00);
    assert.strictEqual(charlie.netBalance, -300.00); // Debtor (-300)

    // Sum of all net balances in any closed system must equal 0
    const netSum = balances.reduce((sum, b) => sum + b.netBalance, 0);
    assert.strictEqual(Math.abs(netSum) < 0.001, true);
  });

  test('calculates correct net balances across multiple expenses with different payers', () => {
    // Expense 1: Alice pays $120, split equally between Alice, Bob, Charlie ($40 each)
    // Expense 2: Bob pays $60, split equally between Alice, Bob, Charlie ($20 each)
    // Expense 3: Charlie pays $30, split equally between Alice, Bob, Charlie ($10 each)
    const expenses = [
      {
        amount: 120.00,
        paidBy: 'Alice',
        payers: [{ name: 'Alice', amount: 120.00 }],
        splits: [
          { name: 'Alice', amountOwed: 40.00 },
          { name: 'Bob', amountOwed: 40.00 },
          { name: 'Charlie', amountOwed: 40.00 },
        ],
      },
      {
        amount: 60.00,
        paidBy: 'Bob',
        payers: [{ name: 'Bob', amount: 60.00 }],
        splits: [
          { name: 'Alice', amountOwed: 20.00 },
          { name: 'Bob', amountOwed: 20.00 },
          { name: 'Charlie', amountOwed: 20.00 },
        ],
      },
      {
        amount: 30.00,
        paidBy: 'Charlie',
        payers: [{ name: 'Charlie', amount: 30.00 }],
        splits: [
          { name: 'Alice', amountOwed: 10.00 },
          { name: 'Bob', amountOwed: 10.00 },
          { name: 'Charlie', amountOwed: 10.00 },
        ],
      },
    ];

    const result = calculateBalances(expenses, [], ['Alice', 'Bob', 'Charlie']);
    const { balances } = result;

    // Alice: Paid = 120, Owed = 40+20+10 = 70 -> Net = +50
    // Bob:   Paid = 60,  Owed = 40+20+10 = 70 -> Net = -10
    // Charlie: Paid = 30, Owed = 40+20+10 = 70 -> Net = -40
    const alice = balances.find((b) => b.name === 'Alice');
    const bob = balances.find((b) => b.name === 'Bob');
    const charlie = balances.find((b) => b.name === 'Charlie');

    assert.strictEqual(alice.netBalance, 50.00);
    assert.strictEqual(bob.netBalance, -10.00);
    assert.strictEqual(charlie.netBalance, -40.00);
  });

  test('settlement payments properly offset net balances towards zero', () => {
    // Initial: Alice +$700, Bob -$400, Charlie -$300
    const expenses = [
      {
        amount: 1000.00,
        paidBy: 'Alice',
        payers: [{ name: 'Alice', amount: 1000.00 }],
        splits: [
          { name: 'Alice', amountOwed: 300.00 },
          { name: 'Bob', amountOwed: 400.00 },
          { name: 'Charlie', amountOwed: 300.00 },
        ],
      },
    ];

    // Bob pays Alice $400 settlement
    const settlements = [
      {
        senderName: 'Bob',
        receiverName: 'Alice',
        amount: 400.00,
        paidAmount: 400.00,
        status: 'completed',
      },
    ];

    const result = calculateBalances(expenses, settlements, ['Alice', 'Bob', 'Charlie']);
    const { balances } = result;

    const alice = balances.find((b) => b.name === 'Alice');
    const bob = balances.find((b) => b.name === 'Bob');
    const charlie = balances.find((b) => b.name === 'Charlie');

    // Bob should now be fully settled ($0.00)
    assert.strictEqual(bob.netBalance, 0.00);
    // Alice remaining credit should be $300.00
    assert.strictEqual(alice.netBalance, 300.00);
    // Charlie still owes $300.00
    assert.strictEqual(charlie.netBalance, -300.00);
  });

  test('calculates zero balances for empty group or settled group', () => {
    const result = calculateBalances([], [], ['Alice', 'Bob']);
    assert.strictEqual(result.balances.length, 2);
    assert.strictEqual(result.balances[0].netBalance, 0.00);
    assert.strictEqual(result.balances[1].netBalance, 0.00);
    assert.strictEqual(result.summary.totalGroupSpending, 0.00);
  });
});
