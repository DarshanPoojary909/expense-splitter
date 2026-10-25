import mongoose from 'mongoose';

/**
 * SettlementPayment Schema
 * 
 * WHY A SEPARATE REFERENCED COLLECTION?
 * - Represents a real-world transaction between two users inside a group.
 * - Referenced by ObjectId (`group`, `sender`, `receiver`) rather than embedded,
 *   because payments are historical financial records reused across user profiles,
 *   group reports, and audit logs.
 */
const settlementPaymentSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: [true, 'Group reference is required for settlement payment'],
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender (payer/debtor) User ID is required'],
    },
    senderName: {
      type: String,
      trim: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver (payee/creditor) User ID is required'],
    },
    receiverName: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Settlement payment amount is required'],
      min: [0.01, 'Settlement amount must be greater than 0'],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now, // Native UTC Date
      required: [true, 'Payment date is required'],
    },
    status: {
      type: String,
      enum: ['completed', 'pending', 'cancelled', 'partial'],
      default: 'completed',
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'UPI', 'Bank Transfer', 'Venmo', 'PayPal', 'Other'],
      default: 'Cash',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [300, 'Notes cannot exceed 300 characters'],
    },
    originalAmount: {
      type: Number,
      default: null,
      min: [0, 'Original amount cannot be negative'],
    },
    paidAmount: {
      type: Number,
      default: null,
      min: [0, 'Paid amount cannot be negative'],
    },
    remainingAmount: {
      type: Number,
      default: 0,
      min: [0, 'Remaining amount cannot be negative'],
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true, // Native UTC Date objects
  }
);

// Indexes
settlementPaymentSchema.index({ group: 1, paymentDate: -1 });
settlementPaymentSchema.index({ sender: 1 });
settlementPaymentSchema.index({ receiver: 1 });

const SettlementPayment =
  mongoose.models.SettlementPayment ||
  mongoose.model('SettlementPayment', settlementPaymentSchema);
export default SettlementPayment;
