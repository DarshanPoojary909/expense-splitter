/**
 * Global Error Handling Middleware
 * 
 * WHY ERROR HANDLING MIDDLEWARE?
 * - In Express, a middleware with 4 arguments (err, req, res, next) is treated as an error handler.
 * - Catches any synchronous or asynchronous error passed via `next(err)`.
 * - Prevents the server from crashing and guarantees a structured JSON response to the client.
 */

export function errorHandler(err, req, res, next) {
  // Determine appropriate HTTP status code
  const statusCode = err.statusCode || res.statusCode === 200 ? 500 : res.statusCode;

  console.error(`[Error] ${req.method} ${req.originalUrl} - ${err.message}`);
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
