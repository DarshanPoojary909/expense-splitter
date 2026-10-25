/**
 * Authentication Controller (HTTP Request Handler Layer)
 * 
 * WHY AN AUTH CONTROLLER?
 * - Handles HTTP requests for user authentication endpoints: /api/auth/register, login, logout, me.
 * - Extracts request parameters, headers, and request body.
 * - Invokes the appropriate methods in `authService`.
 * - Sets standard HTTP response status codes (201 Created, 200 OK, 400 Bad Request, 401 Unauthorized).
 * - Passes unexpected errors to central Express error handler via `next(err)`.
 */

import * as authService from '../services/authService.js';

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export async function register(req, res, next) {
  try {
    const { name, email, password, defaultCurrency, avatarUrl } = req.body;

    const result = await authService.registerUser({
      name,
      email,
      password,
      defaultCurrency,
      avatarUrl,
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', '),
      });
    }

    // Handle duplicate key error (MongoDB 11000)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email address already exists',
      });
    }

    next(error);
  }
}

/**
 * @desc    Authenticate existing user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await authService.loginUser({
      email,
      password,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }

    next(error);
  }
}

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private (Protected by authMiddleware)
 */
export async function getMe(req, res, next) {
  try {
    // req.user was populated by the protect middleware
    res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Log out current user (Client-side token invalidation confirmation)
 * @route   POST /api/auth/logout
 * @access  Public
 */
export async function logout(req, res) {
  // In stateless JWT auth, the server stores no session records.
  // The client simply deletes the JWT from localStorage/memory.
  res.status(200).json({
    success: true,
    message: 'User logged out successfully. Client should discard the stored JWT token.',
  });
}
