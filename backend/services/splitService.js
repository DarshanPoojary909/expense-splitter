/**
 * Expense Splitting Service (Day 9: Business Logic Layer)
 * 
 * WHY A FRAMEWORK-INDEPENDENT SERVICE?
 * - Decouples mathematical splitting logic from Express routes, controllers, and React UI.
 * - Does not import Express, req, or res objects.
 * - Easily testable with Jest / Node.js test runner in isolation.
 * - Enforces monetary precision (avoids floating-point drift) using formatMoney.
 */

/**
 * Standardize monetary amounts to 2 decimal places.
 * Avoids floating-point precision drift (e.g. 0.1 + 0.2 = 0.30000000000000004).
 * 
 * @param {number|string} amount 
 * @returns {number} Clean rounded 2-decimal number
 */
export function formatMoney(amount) {
  const num = Number(amount);
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * 1. EQUAL SPLIT METHOD
 * 
 * Formula: Each share = Total Amount / Number of Participants
 * 
 * Rounding Drift Resolution:
 * When dividing amounts that do not divide cleanly (e.g. $100 among 3 people = $33.33 each, sum = $99.99),
 * the leftover 1 cent remainder is added to the first participant(s) so that the sum of splits
 * exactly equals the total expense amount.
 * 
 * @param {Object} params - { amount, participants: Array<{ name, userId? } | string> }
 * @returns {Array<Object>} List of split objects [{ name, user, amountOwed, splitType: 'EQUAL' }]
 */
export function calculateEqualSplit({ amount, participants }) {
  const totalAmount = formatMoney(amount);
  if (totalAmount <= 0) {
    const error = new Error('Expense amount must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(participants) || participants.length === 0) {
    const error = new Error('At least one participant is required for equal splitting');
    error.statusCode = 400;
    throw error;
  }

  const count = participants.length;
  // Base share rounded down to 2 decimals
  const baseShare = Math.floor((totalAmount / count) * 100) / 100;
  // Calculate remaining cents
  const totalBaseAllocated = formatMoney(baseShare * count);
  let remainderCents = Math.round((totalAmount - totalBaseAllocated) * 100);

  return participants.map((p, idx) => {
    const name = typeof p === 'string' ? p.trim() : (p.name || '').trim();
    const user = typeof p === 'object' && p.userId ? p.userId : (typeof p === 'object' && p.user ? p.user : null);

    if (!name) {
      const error = new Error(`Participant at index ${idx} must have a valid name`);
      error.statusCode = 400;
      throw error;
    }

    // Allocate 1 extra cent to the first N participants until remainder is 0
    let owed = baseShare;
    if (remainderCents > 0) {
      owed = formatMoney(owed + 0.01);
      remainderCents--;
    }

    return {
      name,
      user: user || null,
      amountOwed: owed,
      percentage: formatMoney((owed / totalAmount) * 100),
      shares: 1,
    };
  });
}

/**
 * 2. EXACT AMOUNT SPLIT METHOD
 * 
 * Validates that explicit participant amounts sum up to the total expense amount.
 * 
 * @param {Object} params - { amount, splits: Array<{ name, user?, amountOwed }> }
 * @returns {Array<Object>} Validated splits array
 */
export function calculateExactSplit({ amount, splits }) {
  const totalAmount = formatMoney(amount);
  if (totalAmount <= 0) {
    const error = new Error('Expense amount must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(splits) || splits.length === 0) {
    const error = new Error('At least one participant split is required');
    error.statusCode = 400;
    throw error;
  }

  let totalAllocated = 0;
  const processedSplits = splits.map((s, idx) => {
    const name = (s.name || '').trim();
    const user = s.user || s.userId || null;
    const amountOwed = formatMoney(s.amountOwed);

    if (!name) {
      const error = new Error(`Participant at index ${idx} must have a valid name`);
      error.statusCode = 400;
      throw error;
    }

    if (amountOwed < 0) {
      const error = new Error(`Amount owed for "${name}" cannot be negative`);
      error.statusCode = 400;
      throw error;
    }

    totalAllocated = formatMoney(totalAllocated + amountOwed);

    return {
      name,
      user: user || null,
      amountOwed,
      percentage: totalAmount > 0 ? formatMoney((amountOwed / totalAmount) * 100) : 0,
      shares: 1,
    };
  });

  // Validate exact sum matches total amount
  if (Math.abs(totalAllocated - totalAmount) > 0.01) {
    const diff = formatMoney(Math.abs(totalAllocated - totalAmount));
    const error = new Error(
      `Exact split amounts total $${totalAllocated.toFixed(2)}, which does not match the expense amount of $${totalAmount.toFixed(2)} (difference: $${diff.toFixed(2)})`
    );
    error.statusCode = 400;
    throw error;
  }

  return processedSplits;
}

/**
 * 3. PERCENTAGE SPLIT METHOD
 * 
 * Validates that participant percentages sum up to exactly 100%,
 * calculates monetary share for each, and handles any rounding cents.
 * 
 * @param {Object} params - { amount, splits: Array<{ name, user?, percentage }> }
 * @returns {Array<Object>} Calculated splits array
 */
export function calculatePercentageSplit({ amount, splits }) {
  const totalAmount = formatMoney(amount);
  if (totalAmount <= 0) {
    const error = new Error('Expense amount must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(splits) || splits.length === 0) {
    const error = new Error('At least one participant split is required');
    error.statusCode = 400;
    throw error;
  }

  let totalPercentage = 0;
  for (const [idx, s] of splits.entries()) {
    const pct = Number(s.percentage);
    if (isNaN(pct) || pct < 0) {
      const error = new Error(`Invalid percentage for participant "${s.name || idx}". Must be 0 or positive.`);
      error.statusCode = 400;
      throw error;
    }
    totalPercentage = formatMoney(totalPercentage + pct);
  }

  // Validate percentage equals 100% (within 0.01 tolerance)
  if (Math.abs(totalPercentage - 100) > 0.01) {
    const error = new Error(
      `Percentages must total exactly 100%. Currently totals ${totalPercentage.toFixed(1)}%`
    );
    error.statusCode = 400;
    throw error;
  }

  let allocatedAmount = 0;
  const processedSplits = splits.map((s, idx) => {
    const name = (s.name || '').trim();
    const user = s.user || s.userId || null;
    const percentage = Number(s.percentage);

    if (!name) {
      const error = new Error(`Participant at index ${idx} must have a valid name`);
      error.statusCode = 400;
      throw error;
    }

    const amountOwed = formatMoney((percentage / 100) * totalAmount);
    allocatedAmount = formatMoney(allocatedAmount + amountOwed);

    return {
      name,
      user: user || null,
      amountOwed,
      percentage: formatMoney(percentage),
      shares: 1,
    };
  });

  // Adjust rounding difference on the first non-zero split to ensure sum === totalAmount
  const diff = formatMoney(totalAmount - allocatedAmount);
  if (diff !== 0 && processedSplits.length > 0) {
    const targetIdx = processedSplits.findIndex((s) => s.amountOwed > 0) || 0;
    processedSplits[targetIdx].amountOwed = formatMoney(processedSplits[targetIdx].amountOwed + diff);
  }

  return processedSplits;
}

/**
 * 4. SHARES SPLIT METHOD
 * 
 * Allocates shares proportionally based on weight (e.g. 1 share, 2 shares, 3 shares).
 * Formula: Share amount = (Person's Shares / Total Shares) * Total Amount
 * 
 * @param {Object} params - { amount, splits: Array<{ name, user?, shares }> }
 * @returns {Array<Object>} Calculated splits array
 */
export function calculateSharesSplit({ amount, splits }) {
  const totalAmount = formatMoney(amount);
  if (totalAmount <= 0) {
    const error = new Error('Expense amount must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(splits) || splits.length === 0) {
    const error = new Error('At least one participant split is required');
    error.statusCode = 400;
    throw error;
  }

  let totalShares = 0;
  for (const [idx, s] of splits.entries()) {
    const sharesNum = Number(s.shares);
    if (isNaN(sharesNum) || sharesNum < 0) {
      const error = new Error(`Invalid shares value for participant "${s.name || idx}". Must be 0 or positive.`);
      error.statusCode = 400;
      throw error;
    }
    totalShares += sharesNum;
  }

  if (totalShares <= 0) {
    const error = new Error('Total shares must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  let allocatedAmount = 0;
  const processedSplits = splits.map((s, idx) => {
    const name = (s.name || '').trim();
    const user = s.user || s.userId || null;
    const shares = Number(s.shares) || 0;

    if (!name) {
      const error = new Error(`Participant at index ${idx} must have a valid name`);
      error.statusCode = 400;
      throw error;
    }

    const amountOwed = formatMoney((shares / totalShares) * totalAmount);
    allocatedAmount = formatMoney(allocatedAmount + amountOwed);

    return {
      name,
      user: user || null,
      amountOwed,
      percentage: formatMoney((amountOwed / totalAmount) * 100),
      shares,
    };
  });

  // Adjust rounding difference on the first participant with shares > 0
  const diff = formatMoney(totalAmount - allocatedAmount);
  if (diff !== 0 && processedSplits.length > 0) {
    const targetIdx = processedSplits.findIndex((s) => s.shares > 0) || 0;
    processedSplits[targetIdx].amountOwed = formatMoney(processedSplits[targetIdx].amountOwed + diff);
  }

  return processedSplits;
}

/**
 * 5. MULTIPLE PAYERS VALIDATION & FORMATTING
 * 
 * Validates that multiple payer contributions sum up exactly to the total expense amount.
 * 
 * @param {Object} params - { amount, payers: Array<{ name, user?, amount }>, defaultPayer: string }
 * @returns {Array<Object>} Validated payers array
 */
export function validateAndFormatPayers({ amount, payers, defaultPayer }) {
  const totalAmount = formatMoney(amount);
  if (totalAmount <= 0) {
    const error = new Error('Expense amount must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  // If no payers array provided, default to single payer
  if (!Array.isArray(payers) || payers.length === 0) {
    const fallbackName = (defaultPayer || 'Primary User').trim();
    return [{
      name: fallbackName,
      amount: totalAmount,
      user: null,
    }];
  }

  let totalPaid = 0;
  const processedPayers = payers.map((p, idx) => {
    const name = (p.name || '').trim();
    const user = p.user || p.userId || null;
    const pAmount = formatMoney(p.amount);

    if (!name) {
      const error = new Error(`Payer at index ${idx} must have a valid name`);
      error.statusCode = 400;
      throw error;
    }

    if (pAmount <= 0) {
      const error = new Error(`Payer "${name}" must have a contribution amount greater than 0`);
      error.statusCode = 400;
      throw error;
    }

    totalPaid = formatMoney(totalPaid + pAmount);

    return {
      name,
      amount: pAmount,
      user: user || null,
    };
  });

  // Verify payer sum equals expense total
  if (Math.abs(totalPaid - totalAmount) > 0.01) {
    const diff = formatMoney(Math.abs(totalPaid - totalAmount));
    const error = new Error(
      `Total payer contributions ($${totalPaid.toFixed(2)}) do not match expense total ($${totalAmount.toFixed(2)}) (difference: $${diff.toFixed(2)})`
    );
    error.statusCode = 400;
    throw error;
  }

  return processedPayers;
}

/**
 * UNIFIED SPLITTING DISPATCHER
 * 
 * Calculates and validates both splits and payers according to the requested splitType.
 * 
 * @param {Object} params
 * @returns {{ splits: Array<Object>, payers: Array<Object>, totalAmount: number, splitType: string }}
 */
export function calculateExpenseSplits({
  amount,
  splitType = 'EQUAL',
  participants = [],
  splits = [],
  payers = [],
  paidBy = '',
}) {
  const cleanAmount = formatMoney(amount);
  const normalizedSplitType = String(splitType).toUpperCase().trim();

  // 1. Process Payers
  const validatedPayers = validateAndFormatPayers({
    amount: cleanAmount,
    payers,
    defaultPayer: paidBy,
  });

  // 2. Process Splits by Method
  let calculatedSplits;
  switch (normalizedSplitType) {
    case 'EXACT':
      calculatedSplits = calculateExactSplit({
        amount: cleanAmount,
        splits: splits.length > 0 ? splits : participants.map((p) => ({ name: typeof p === 'string' ? p : p.name, amountOwed: cleanAmount / (participants.length || 1) })),
      });
      break;

    case 'PERCENTAGE':
      calculatedSplits = calculatePercentageSplit({
        amount: cleanAmount,
        splits: splits.length > 0 ? splits : participants.map((p) => ({ name: typeof p === 'string' ? p : p.name, percentage: 100 / (participants.length || 1) })),
      });
      break;

    case 'SHARES':
      calculatedSplits = calculateSharesSplit({
        amount: cleanAmount,
        splits: splits.length > 0 ? splits : participants.map((p) => ({ name: typeof p === 'string' ? p : p.name, shares: 1 })),
      });
      break;

    case 'EQUAL':
    default: {
      const targetParticipants = splits.length > 0
        ? splits.map((s) => ({ name: s.name, userId: s.user || s.userId }))
        : participants;
      calculatedSplits = calculateEqualSplit({
        amount: cleanAmount,
        participants: targetParticipants.length > 0 ? targetParticipants : [paidBy || 'User'],
      });
      break;
    }
  }

  return {
    totalAmount: cleanAmount,
    splitType: normalizedSplitType,
    payers: validatedPayers,
    splits: calculatedSplits,
  };
}
