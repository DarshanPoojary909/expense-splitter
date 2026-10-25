import mongoose from 'mongoose';

/**
 * ActivityLog Schema
 * 
 * WHY A SEPARATE REFERENCED COLLECTION?
 * - Audit logs are append-only and grow indefinitely over time.
 * - Embedding an unbounded array inside Group or User documents would eventually hit
 *   MongoDB's 16MB document size limit and cause performance bottlenecks (unbounded array anti-pattern).
 * - Even though Expense and SettlementPayment hold current state, ActivityLog provides an
 *   immutable chronological history of who performed what action, when, and what changed.
 */
const activityLogSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    userName: {
      type: String,
      trim: true,
      default: 'System',
    },
    action: {
      type: String,
      required: [true, 'Action type is required'],
      enum: [
        'EXPENSE_CREATED',
        'EXPENSE_UPDATED',
        'EXPENSE_DELETED',
        'SETTLEMENT_RECORDED',
        'MEMBER_ADDED',
        'MEMBER_REMOVED',
        'GROUP_CREATED',
        'GROUP_UPDATED',
      ],
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      enum: ['Expense', 'SettlementPayment', 'Group', 'User'],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    description: {
      type: String,
      required: [true, 'Activity description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Logs are append-only (native UTC Date)
  }
);

// Indexes
activityLogSchema.index({ group: 1, createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });

const ActivityLog =
  mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;
