import mongoose from 'mongoose';

/**
 * Expense Payer Embedded Sub-document Schema
 * 
 * WHY EMBED PAYERS?
 * - Multiple payers (who paid how much) are an integral part of that specific expense.
 * - Always read and updated together with the expense record.
 */
const payerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Payer name is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Paid amount is required'],
      min: [0.01, 'Paid amount must be greater than 0'],
    },
  },
  { _id: false }
);

/**
 * Expense Split Embedded Sub-document Schema
 * 
 * WHY EMBED SPLITS?
 * - Participant breakdown (who owes how much) is inextricably linked to the expense.
 * - Read and modified atomically whenever the expense is viewed or edited.
 */
const splitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Participant name is required'],
      trim: true,
    },
    amountOwed: {
      type: Number,
      required: [true, 'Amount owed is required'],
      min: [0, 'Amount owed cannot be negative'],
    },
    percentage: {
      type: Number,
      min: [0, 'Percentage cannot be negative'],
      max: [100, 'Percentage cannot exceed 100'],
      default: null,
    },
    shares: {
      type: Number,
      min: [0, 'Shares cannot be negative'],
      default: 1,
    },
  },
  { _id: false }
);

/**
 * Expense Schema
 */
const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Expense title/description is required'],
      trim: true,
      minlength: [1, 'Title must not be empty'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    amount: {
      type: Number,
      required: [true, 'Expense total amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'Food & Dining',
        'Groceries',
        'Transportation',
        'Accommodation',
        'Entertainment',
        'Utilities',
        'Shopping',
        'General',
      ],
      default: 'General',
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    paidBy: {
      type: String,
      required: [true, 'Primary payer name/identifier is required'],
      trim: true,
    },
    payers: {
      type: [payerSchema],
      default: [],
    },
    splitType: {
      type: String,
      enum: ['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'],
      default: 'EQUAL',
    },
    splits: {
      type: [splitSchema],
      default: [],
    },
    participants: {
      type: [String],
      default: [],
    },
    expenseDate: {
      type: Date,
      default: Date.now, // Native UTC Date
      required: [true, 'Expense date is required'],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true, // Native UTC Date objects for createdAt and updatedAt
  }
);

// Indexes
expenseSchema.index({ group: 1, expenseDate: -1 });
expenseSchema.index({ 'payers.user': 1 });
expenseSchema.index({ 'splits.user': 1 });

const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);
export default Expense;
