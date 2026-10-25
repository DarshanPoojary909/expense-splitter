import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  formatMoney,
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
  validateAndFormatPayers,
  calculateExpenseSplits,
} from '../services/splitService.js';

describe('Day 9: Four Expense Splitting Methods & Multiple Payers (Pure Business Logic)', () => {
  // --- 1. EQUAL SPLIT ---
  describe('1. Equal Split Method', () => {
    test('splits evenly divisible amount without remainder', () => {
      const result = calculateEqualSplit({
        amount: 900.00,
        participants: ['Alice', 'Bob', 'Charlie'],
      });

      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].amountOwed, 300.00);
      assert.strictEqual(result[1].amountOwed, 300.00);
      assert.strictEqual(result[2].amountOwed, 300.00);

      const total = result.reduce((sum, s) => formatMoney(sum + s.amountOwed), 0);
      assert.strictEqual(total, 900.00);
    });

    test('handles remainder cents drift accurately (e.g. $100 among 3 people)', () => {
      const result = calculateEqualSplit({
        amount: 100.00,
        participants: ['Alice', 'Bob', 'Charlie'],
      });

      assert.strictEqual(result.length, 3);
      // 100 / 3 = 33.33 each with 1 cent remainder allocated to first person
      assert.strictEqual(result[0].amountOwed, 33.34);
      assert.strictEqual(result[1].amountOwed, 33.33);
      assert.strictEqual(result[2].amountOwed, 33.33);

      const total = result.reduce((sum, s) => formatMoney(sum + s.amountOwed), 0);
      assert.strictEqual(total, 100.00);
    });

    test('handles remainder cents for 7 participants ($10 among 7)', () => {
      const participants = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      const result = calculateEqualSplit({
        amount: 10.00,
        participants,
      });

      assert.strictEqual(result.length, 7);
      const total = result.reduce((sum, s) => formatMoney(sum + s.amountOwed), 0);
      assert.strictEqual(total, 10.00);
    });

    test('rejects empty participants or non-positive amount', () => {
      assert.throws(
        () => calculateEqualSplit({ amount: -50, participants: ['Alice'] }),
        /Expense amount must be greater than 0/
      );
      assert.throws(
        () => calculateEqualSplit({ amount: 100, participants: [] }),
        /At least one participant is required/
      );
    });
  });

  // --- 2. EXACT SPLIT ---
  describe('2. Exact Amount Split Method', () => {
    test('validates correct exact split summing to total', () => {
      const result = calculateExactSplit({
        amount: 900.00,
        splits: [
          { name: 'Alice', amountOwed: 300.00 },
          { name: 'Bob', amountOwed: 250.00 },
          { name: 'Charlie', amountOwed: 350.00 },
        ],
      });

      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].amountOwed, 300.00);
      assert.strictEqual(result[1].amountOwed, 250.00);
      assert.strictEqual(result[2].amountOwed, 350.00);

      const total = result.reduce((sum, s) => formatMoney(sum + s.amountOwed), 0);
      assert.strictEqual(total, 900.00);
    });

    test('throws error if exact split sum does not match total amount', () => {
      assert.throws(
        () =>
          calculateExactSplit({
            amount: 900.00,
            splits: [
              { name: 'Alice', amountOwed: 300.00 },
              { name: 'Bob', amountOwed: 200.00 },
              { name: 'Charlie', amountOwed: 350.00 }, // sum = 850 != 900
            ],
          }),
        /Exact split amounts total \$850\.00, which does not match/
      );
    });

    test('rejects negative exact amounts', () => {
      assert.throws(
        () =>
          calculateExactSplit({
            amount: 100.00,
            splits: [
              { name: 'Alice', amountOwed: -20.00 },
              { name: 'Bob', amountOwed: 120.00 },
            ],
          }),
        /cannot be negative/
      );
    });
  });

  // --- 3. PERCENTAGE SPLIT ---
  describe('3. Percentage Split Method', () => {
    test('calculates correct shares for 50%, 30%, 20% on $1000', () => {
      const result = calculatePercentageSplit({
        amount: 1000.00,
        splits: [
          { name: 'Alice', percentage: 50 },
          { name: 'Bob', percentage: 30 },
          { name: 'Charlie', percentage: 20 },
        ],
      });

      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].amountOwed, 500.00);
      assert.strictEqual(result[1].amountOwed, 300.00);
      assert.strictEqual(result[2].amountOwed, 200.00);

      const total = result.reduce((sum, s) => formatMoney(sum + s.amountOwed), 0);
      assert.strictEqual(total, 1000.00);
    });

    test('handles rounding cents drift with percentages (33.33%, 33.33%, 33.34% on $100)', () => {
      const result = calculatePercentageSplit({
        amount: 100.00,
        splits: [
          { name: 'Alice', percentage: 33.33 },
          { name: 'Bob', percentage: 33.33 },
          { name: 'Charlie', percentage: 33.34 },
        ],
      });

      const total = result.reduce((sum, s) => formatMoney(sum + s.amountOwed), 0);
      assert.strictEqual(total, 100.00);
    });

    test('rejects percentages that do not total 100%', () => {
      assert.throws(
        () =>
          calculatePercentageSplit({
            amount: 500.00,
            splits: [
              { name: 'Alice', percentage: 40 },
              { name: 'Bob', percentage: 40 }, // total = 80%
            ],
          }),
        /Percentages must total exactly 100%/
      );
    });

    test('rejects negative percentages', () => {
      assert.throws(
        () =>
          calculatePercentageSplit({
            amount: 100.00,
            splits: [
              { name: 'Alice', percentage: -10 },
              { name: 'Bob', percentage: 110 },
            ],
          }),
        /Invalid percentage/
      );
    });
  });

  // --- 4. SHARES SPLIT ---
  describe('4. Shares Split Method', () => {
    test('calculates shares split for 1 share, 2 shares, 3 shares on $600', () => {
      const result = calculateSharesSplit({
        amount: 600.00,
        splits: [
          { name: 'Alice', shares: 1 },
          { name: 'Bob', shares: 2 },
          { name: 'Charlie', shares: 3 },
        ],
      });

      // Total shares = 6. Alice = 1/6 * 600 = 100, Bob = 2/6 * 600 = 200, Charlie = 3/6 * 600 = 300
      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].amountOwed, 100.00);
      assert.strictEqual(result[1].amountOwed, 200.00);
      assert.strictEqual(result[2].amountOwed, 300.00);

      const total = result.reduce((sum, s) => formatMoney(sum + s.amountOwed), 0);
      assert.strictEqual(total, 600.00);
    });

    test('handles rounding cents drift with uneven shares (1 share, 1 share, 1 share on $100)', () => {
      const result = calculateSharesSplit({
        amount: 100.00,
        splits: [
          { name: 'Alice', shares: 1 },
          { name: 'Bob', shares: 1 },
          { name: 'Charlie', shares: 1 },
        ],
      });

      const total = result.reduce((sum, s) => formatMoney(sum + s.amountOwed), 0);
      assert.strictEqual(total, 100.00);
    });

    test('rejects 0 total shares or negative shares', () => {
      assert.throws(
        () =>
          calculateSharesSplit({
            amount: 100.00,
            splits: [
              { name: 'Alice', shares: 0 },
              { name: 'Bob', shares: 0 },
            ],
          }),
        /Total shares must be greater than 0/
      );
      assert.throws(
        () =>
          calculateSharesSplit({
            amount: 100.00,
            splits: [{ name: 'Alice', shares: -1 }],
          }),
        /Invalid shares/
      );
    });
  });

  // --- 5. MULTIPLE PAYERS ---
  describe('5. Multiple Payers Support', () => {
    test('validates multiple payers summing to total expense amount', () => {
      const result = validateAndFormatPayers({
        amount: 150.00,
        payers: [
          { name: 'Alice', amount: 100.00 },
          { name: 'Bob', amount: 50.00 },
        ],
        defaultPayer: 'Alice',
      });

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].name, 'Alice');
      assert.strictEqual(result[0].amount, 100.00);
      assert.strictEqual(result[1].name, 'Bob');
      assert.strictEqual(result[1].amount, 50.00);
    });

    test('throws error if multiple payers sum does not match total amount', () => {
      assert.throws(
        () =>
          validateAndFormatPayers({
            amount: 150.00,
            payers: [
              { name: 'Alice', amount: 80.00 },
              { name: 'Bob', amount: 50.00 }, // sum = 130 != 150
            ],
            defaultPayer: 'Alice',
          }),
        /Total payer contributions \(\$130\.00\) do not match/
      );
    });

    test('defaults to single payer if payers array is omitted', () => {
      const result = validateAndFormatPayers({
        amount: 80.00,
        payers: [],
        defaultPayer: 'Charlie',
      });

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'Charlie');
      assert.strictEqual(result[0].amount, 80.00);
    });
  });

  // --- 6. UNIFIED SPLIT DISPATCHER ---
  describe('6. Unified Split Calculation Dispatcher', () => {
    test('calculates complete payload with multiple payers and percentage split', () => {
      const outcome = calculateExpenseSplits({
        amount: 500.00,
        splitType: 'PERCENTAGE',
        paidBy: 'Alice',
        payers: [
          { name: 'Alice', amount: 300.00 },
          { name: 'Bob', amount: 200.00 },
        ],
        splits: [
          { name: 'Alice', percentage: 60 },
          { name: 'Bob', percentage: 40 },
        ],
      });

      assert.strictEqual(outcome.totalAmount, 500.00);
      assert.strictEqual(outcome.splitType, 'PERCENTAGE');
      assert.strictEqual(outcome.payers.length, 2);
      assert.strictEqual(outcome.splits[0].amountOwed, 300.00);
      assert.strictEqual(outcome.splits[1].amountOwed, 200.00);
    });
  });
});
