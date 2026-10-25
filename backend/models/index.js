/**
 * Mongoose Models Barrel Export
 * 
 * Centralizes all application schemas & models:
 * - User: Independent user accounts
 * - Group: Groups with embedded members array
 * - Expense: Expenses with embedded payers and splits arrays
 * - SettlementPayment: Standalone settlement transactions (referencing Group, sender, receiver)
 * - ActivityLog: Append-only audit trail (referencing Group and user)
 */

export { default as User } from './User.js';
export { default as Group } from './Group.js';
export { default as Expense } from './Expense.js';
export { default as SettlementPayment } from './SettlementPayment.js';
export { default as ActivityLog } from './ActivityLog.js';
