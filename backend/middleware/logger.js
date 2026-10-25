/**
 * Request Logger Middleware
 * 
 * WHY A CUSTOM LOGGER MIDDLEWARE?
 * - Middleware intercepts every request before it hits route handlers.
 * - Prints incoming method, path, and records how long it took to send a response.
 */

export function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '❌' : '✅';
    console.log(
      `${statusColor} [${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`
    );
  });

  next(); // Pass control to the next middleware in the pipeline
}
