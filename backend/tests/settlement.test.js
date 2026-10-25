import { test, describe } from 'node:test';
import assert from 'node:assert';
import { optimizeSettlements } from '../services/settlementService.js';
import { formatMoney } from '../services/splitService.js';

describe('Day 11: Settlement Optimization (Min-Cash-Flow Greedy Algorithm)', () => {
  test('2 Users: Single debtor to single creditor (Bob -$100 -> Alice +$100)', () => {
    const balances = [
      { name: 'Alice', netBalance: 100.00 },
      { name: 'Bob', netBalance: -100.00 },
    ];

    const plan = optimizeSettlements(balances);
    assert.strictEqual(plan.length, 1);
    assert.strictEqual(plan[0].from, 'Bob');
    assert.strictEqual(plan[0].to, 'Alice');
    assert.strictEqual(plan[0].amount, 100.00);
  });

  test('3 Users: One creditor, two debtors (Alice +$700, Bob -$400, Charlie -$300)', () => {
    const balances = [
      { name: 'Alice', netBalance: 700.00 },
      { name: 'Bob', netBalance: -400.00 },
      { name: 'Charlie', netBalance: -300.00 },
    ];

    const plan = optimizeSettlements(balances);
    assert.strictEqual(plan.length, 2);

    // Sorted greedy picks largest debtor first (Bob) then Charlie
    assert.strictEqual(plan[0].from, 'Bob');
    assert.strictEqual(plan[0].to, 'Alice');
    assert.strictEqual(plan[0].amount, 400.00);

    assert.strictEqual(plan[1].from, 'Charlie');
    assert.strictEqual(plan[1].to, 'Alice');
    assert.strictEqual(plan[1].amount, 300.00);

    const totalVolume = plan.reduce((sum, tx) => formatMoney(sum + tx.amount), 0);
    assert.strictEqual(totalVolume, 700.00);
  });

  test('4 Users: Two creditors, two debtors (Alice +$500, Bob +$300, Charlie -$600, David -$200)', () => {
    const balances = [
      { name: 'Alice', netBalance: 500.00 },
      { name: 'Bob', netBalance: 300.00 },
      { name: 'Charlie', netBalance: -600.00 },
      { name: 'David', netBalance: -200.00 },
    ];

    const plan = optimizeSettlements(balances);
    // At most (4 - 1) = 3 transactions
    assert.strictEqual(plan.length <= 3, true);

    const totalVolume = plan.reduce((sum, tx) => formatMoney(sum + tx.amount), 0);
    assert.strictEqual(totalVolume, 800.00); // 500 + 300 = 800 total debt/credit

    // Verify all transactions have valid positive amounts
    for (const tx of plan) {
      assert.ok(tx.amount > 0);
      assert.ok(tx.from);
      assert.ok(tx.to);
      assert.notStrictEqual(tx.from, tx.to);
    }
  });

  test('Cycle Elimination: Pairwise debt loop (A->B $50, B->C $50, C->A $50) optimizes to 0 transactions', () => {
    // In a cyclic debt, net balances are all 0:
    // A paid 50, owes 50 -> net = 0
    // B paid 50, owes 50 -> net = 0
    // C paid 50, owes 50 -> net = 0
    const balances = [
      { name: 'Alice', netBalance: 0.00 },
      { name: 'Bob', netBalance: 0.00 },
      { name: 'Charlie', netBalance: 0.00 },
    ];

    const plan = optimizeSettlements(balances);
    assert.strictEqual(plan.length, 0); // No transactions needed!
  });

  test('Already settled group returns empty transaction array', () => {
    const balances = [
      { name: 'Alice', netBalance: 0.00 },
      { name: 'Bob', netBalance: 0.00 },
    ];

    const plan = optimizeSettlements(balances);
    assert.strictEqual(plan.length, 0);
  });

  test('Uneven cents and floating precision (Alice +$33.34, Bob -$16.67, Charlie -$16.67)', () => {
    const balances = [
      { name: 'Alice', netBalance: 33.34 },
      { name: 'Bob', netBalance: -16.67 },
      { name: 'Charlie', netBalance: -16.67 },
    ];

    const plan = optimizeSettlements(balances);
    assert.strictEqual(plan.length, 2);

    const totalVolume = plan.reduce((sum, tx) => formatMoney(sum + tx.amount), 0);
    assert.strictEqual(totalVolume, 33.34);
  });
});
