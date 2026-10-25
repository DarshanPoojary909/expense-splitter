/**
 * 404 Not Found Middleware
 * 
 * WHY NOT FOUND MIDDLEWARE?
 * - Placed after all registered routes.
 * - If an incoming HTTP request does not match any route, this middleware catches it
 *   and responds with a clean 404 JSON error instead of Express's default HTML error page.
 */

export function notFound(req, res, next) {
  const error = new Error(`Resource Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
}
