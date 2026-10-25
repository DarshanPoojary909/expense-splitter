/**
 * Authentication Service (Business Logic Layer)
 * 
 * WHY A SERVICE LAYER?
 * - Pure framework-agnostic business logic.
 * - Handles JWT token creation, registration validation, credential matching, and user lookups.
 * - Decoupled from Express req/res objects for testability and portability.
 * - Integrates Mongoose User model with in-memory fallback for offline test isolation.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';

/**
 * Check if active MongoDB connection is ready
 */
function isDbConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

// In-memory user store for fallback or offline testing
let inMemoryUsers = [];

/**
 * Reset in-memory users state (used in test setup)
 */
export async function resetUsers() {
  if (isDbConnected()) {
    await User.deleteMany({});
  }
  inMemoryUsers = [];
}

/**
 * Generate a signed JSON Web Token (JWT)
 * 
 * @param {string|mongoose.Types.ObjectId} userId - The user ID to encode in token payload
 * @returns {string} Signed JWT token
 */
export function generateToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is missing in server configuration');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    { id: String(userId) },
    secret,
    { expiresIn }
  );
}

/**
 * Register a new user account
 * 
 * @param {Object} userData - { name, email, password, defaultCurrency, avatarUrl }
 * @returns {Promise<{ user: Object, token: string }>}
 */
export async function registerUser({ name, email, password, defaultCurrency, avatarUrl }) {
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    const error = new Error('Name is required and must be at least 2 characters long');
    error.statusCode = 400;
    throw error;
  }

  if (!email || typeof email !== 'string' || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email.trim())) {
    const error = new Error('Please provide a valid email address');
    error.statusCode = 400;
    throw error;
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    const error = new Error('Password is required and must be at least 6 characters long');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // If MongoDB is connected
  if (isDbConnected()) {
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      const error = new Error('An account with this email address already exists');
      error.statusCode = 400;
      throw error;
    }

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      defaultCurrency: defaultCurrency ? defaultCurrency.toUpperCase().trim() : 'USD',
      avatarUrl: avatarUrl || '',
    });

    const token = generateToken(newUser._id);

    return {
      user: newUser.toJSON(),
      token,
    };
  }

  // Fallback in-memory mode
  const existingUser = inMemoryUsers.find((u) => u.email === normalizedEmail);
  if (existingUser) {
    const error = new Error('An account with this email address already exists');
    error.statusCode = 400;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const newId = new mongoose.Types.ObjectId().toString();
  const now = new Date();

  const userDoc = {
    _id: newId,
    id: newId,
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    defaultCurrency: defaultCurrency ? defaultCurrency.toUpperCase().trim() : 'USD',
    avatarUrl: avatarUrl || '',
    createdAt: now,
    updatedAt: now,
  };

  inMemoryUsers.push(userDoc);

  const token = generateToken(newId);

  return {
    user: {
      _id: userDoc._id,
      id: userDoc.id,
      name: userDoc.name,
      email: userDoc.email,
      defaultCurrency: userDoc.defaultCurrency,
      avatarUrl: userDoc.avatarUrl,
      createdAt: userDoc.createdAt,
      updatedAt: userDoc.updatedAt,
    },
    token,
  };
}

/**
 * Authenticate user login credentials
 * 
 * @param {Object} credentials - { email, password }
 * @returns {Promise<{ user: Object, token: string }>}
 */
export async function loginUser({ email, password }) {
  if (!email || !password) {
    const error = new Error('Please provide both email and password');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // If MongoDB is connected
  if (isDbConnected()) {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401; // 401 Unauthorized
      throw error;
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const token = generateToken(user._id);

    return {
      user: user.toJSON(),
      token,
    };
  }

  // Fallback in-memory mode
  const user = inMemoryUsers.find((u) => u.email === normalizedEmail);
  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const token = generateToken(user.id);

  return {
    user: {
      _id: user._id,
      id: user.id,
      name: user.name,
      email: user.email,
      defaultCurrency: user.defaultCurrency,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    token,
  };
}

/**
 * Get user profile by ID (without password)
 * 
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Object|null>}
 */
export async function getUserProfile(userId) {
  const targetId = String(userId);

  if (isDbConnected()) {
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return null;
    }
    const user = await User.findById(targetId).select('-password');
    return user ? user.toJSON() : null;
  }

  // Fallback in-memory mode
  const user = inMemoryUsers.find((u) => String(u.id) === targetId || String(u._id) === targetId);
  if (!user) return null;

  return {
    _id: user._id,
    id: user.id,
    name: user.name,
    email: user.email,
    defaultCurrency: user.defaultCurrency,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Get raw user by email (internal lookup with hashed password)
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
export async function getUserByEmail(email) {
  const normEmail = (email || '').trim().toLowerCase();
  if (isDbConnected()) {
    return await User.findOne({ email: normEmail });
  }
  return inMemoryUsers.find((u) => u.email.toLowerCase() === normEmail) || null;
}
