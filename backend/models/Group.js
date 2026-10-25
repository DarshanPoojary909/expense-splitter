import mongoose from 'mongoose';

/**
 * Group Member Embedded Sub-document Schema
 * 
 * WHY EMBED MEMBERS IN GROUP?
 * - Group members are always fetched and displayed together with the Group.
 * - Groups have a bounded number of members (typically 2-50, well within the 16MB document limit).
 * - Avoids an unnecessary join/lookup table collection (`GroupMembers`).
 */
const memberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member userId is required'],
    },
    name: {
      type: String,
      required: [true, 'Member name is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now, // Native UTC Date
    },
  },
  { _id: true }
);

/**
 * Group Schema
 */
const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      minlength: [2, 'Group name must be at least 2 characters long'],
      maxlength: [80, 'Group name cannot exceed 80 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [250, 'Description cannot exceed 250 characters'],
    },
    groupType: {
      type: String,
      enum: ['Trip', 'Home', 'Couple', 'Project', 'Other'],
      default: 'Other',
    },
    baseCurrency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
    },
    simplifyDebts: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator User ID is required'],
    },
    members: {
      type: [memberSchema],
      validate: {
        validator: function (members) {
          return Array.isArray(members) && members.length > 0;
        },
        message: 'A group must contain at least one member',
      },
    },
  },
  {
    timestamps: true, // Native UTC Date objects for createdAt and updatedAt
  }
);

// Indexes
groupSchema.index({ 'members.userId': 1 });
groupSchema.index({ createdBy: 1 });

const Group = mongoose.models.Group || mongoose.model('Group', groupSchema);
export default Group;
