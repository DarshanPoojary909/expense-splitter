/**
 * Authentication Middleware (Protected Route Guard)
 * 
 * WHY AN AUTH MIDDLEWARE?
 * - Intercepts incoming HTTP requests to protected endpoints.
 * - Extracts and validates JSON Web Tokens (JWT) sent in the `Authorization: Bearer <token>` header.
 * - Decodes the user payload and verifies user existence via `authService`.
 * - Attaches `req.user` to the request pipeline so downstream controllers know WHO the user is.
 * - Returns a standard 401 Unauthorized response if the token is missing, invalid, or expired.
 */

import jwt from 'jsonwebtoken';
import * as authService from '../services/authService.js';

export async function protect(req, res, next) {
  let token;

  // 1. Check if Authorization header is present and starts with 'Bearer '
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // 2. If no token was provided in the header
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route, no token provided',
    });
  }

  try {
    // 3. Verify token signature and expiration
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({
        success: false,
        error: 'JWT_SECRET environment variable is missing on server',
      });
    }

    const decoded = jwt.verify(token, secret);

    // 4. Retrieve user profile (without password)
    const currentUser = await authService.getUserProfile(decoded.id);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: 'The user belonging to this token no longer exists',
      });
    }

    // 5. Attach authenticated user object to Express request pipeline
    req.user = currentUser;

    // 6. Grant access to the next middleware or controller
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, token is invalid or has expired',
      details: error.message,
    });
  }
}

/**
 * Optional Authentication Middleware
 * 
 * Attaches req.user if a valid Bearer token is present,
 * but does NOT reject or block the request if no token is provided.
 */
export async function optionalAuth(req, res, next) {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (secret) {
      const decoded = jwt.verify(token, secret);
      const currentUser = await authService.getUserProfile(decoded.id);
      if (currentUser) {
        req.user = currentUser;
      }
    }
  } catch (err) {
    // Silently ignore invalid token in optionalAuth, allowing request to proceed unauthenticated
  }

  next();
}

