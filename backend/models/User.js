import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User Schema
 * 
 * WHY A SEPARATE COLLECTION?
 * - Users are core independent entities referenced across multiple Groups, Expenses,
 *   SettlementPayments, and ActivityLogs.
 * - Each user maintains unique credentials (email, hashed password) and profile settings.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    defaultCurrency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
    },
  },
  {
    timestamps: true, // Stored as native UTC Date objects
    toJSON: {
      transform(doc, ret) {
        // Strip sensitive password hash and internal __v from serialized JSON outputs
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
userSchema.index({ email: 1 });

/**
 * Mongoose Pre-Save Hook: Bcrypt Password Hashing
 * 
 * Automatically intercepts document saving. If the password field was modified
 * (during registration or password updates), it generates a salt with 10 rounds
 * and hashes the plain-text password before persisting it to MongoDB.
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Helper Instance Method: Match entered plain password against stored bcrypt hash
 * 
 * @param {string} enteredPassword - The plain-text password supplied at login
 * @returns {Promise<boolean>} - True if match, false otherwise
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;

