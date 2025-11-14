/**
 * Cache Headers Middleware
 *
 * Optimizes browser caching for static assets and API responses
 * to improve performance and reduce server load.
 */

import type { Request, Response, NextFunction } from "express";

/**
 * Cache durations in seconds
 */
const CACHE_DURATIONS = {
  YEAR: 31536000,      // 1 year for immutable assets
  MONTH: 2592000,      // 30 days for static assets
  WEEK: 604800,        // 7 days for semi-static content
  DAY: 86400,          // 1 day for frequently updated content
  HOUR: 3600,          // 1 hour for dynamic content
  MINUTE: 60,          // 1 minute for real-time data
  NO_CACHE: 0,         // No caching
};

/**
 * Set cache headers for static assets
 */
export function staticAssetCache(req: Request, res: Response, next: NextFunction) {
  const { path } = req;

  // Immutable versioned assets (with hash in filename)
  if (/\.(js|css|woff2?|ttf|eot|otf).*[a-f0-9]{8,}/.test(path)) {
    res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATIONS.YEAR}, immutable`);
    res.setHeader('Vary', 'Accept-Encoding');
    return next();
  }

  // Images with hash
  if (/\.(jpg|jpeg|png|gif|svg|webp|avif|ico).*[a-f0-9]{8,}/.test(path)) {
    res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATIONS.YEAR}, immutable`);
    res.setHeader('Vary', 'Accept-Encoding');
    return next();
  }

  // Regular static assets without hash
  if (/\.(js|css)$/.test(path)) {
    res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATIONS.DAY}, must-revalidate`);
    res.setHeader('Vary', 'Accept-Encoding');
    return next();
  }

  // Images without hash
  if (/\.(jpg|jpeg|png|gif|svg|webp|avif|ico)$/.test(path)) {
    res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATIONS.WEEK}, must-revalidate`);
    res.setHeader('Vary', 'Accept-Encoding');
    return next();
  }

  // Fonts
  if (/\.(woff2?|ttf|eot|otf)$/.test(path)) {
    res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATIONS.YEAR}, immutable`);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow cross-origin font loading
    return next();
  }

  // Manifest and service worker
  if (/\/(manifest\.json|service-worker\.js)$/.test(path)) {
    res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATIONS.HOUR}, must-revalidate`);
    return next();
  }

  // Robots.txt and sitemap
  if (/\/(robots\.txt|sitemap\.xml)$/.test(path)) {
    res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATIONS.DAY}, must-revalidate`);
    return next();
  }

  // HTML files - short cache with revalidation
  if (path.endsWith('.html') || path === '/') {
    res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATIONS.MINUTE}, must-revalidate`);
    res.setHeader('Vary', 'Accept-Encoding');
    return next();
  }

  next();
}

/**
 * Set cache headers for API responses
 */
export function apiCache(req: Request, res: Response, next: NextFunction) {
  const { path, method } = req;

  // Never cache mutations (POST, PUT, PATCH, DELETE)
  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return next();
  }

  // Static data endpoints - cache for longer
  if (path.includes('/api/voices') || path.includes('/api/agents')) {
    res.setHeader('Cache-Control', `private, max-age=${CACHE_DURATIONS.MINUTE}`);
    res.setHeader('Vary', 'Authorization');
    return next();
  }

  // User data - short cache
  if (path.includes('/api/user') || path.includes('/api/auth')) {
    res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    return next();
  }

  // Real-time data - no cache
  if (path.includes('/api/realtime') || path.includes('/api/conversations')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return next();
  }

  // Default API response - short private cache
  res.setHeader('Cache-Control', `private, max-age=${CACHE_DURATIONS.MINUTE}`);
  res.setHeader('Vary', 'Authorization');

  next();
}

/**
 * Security headers for all responses
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (limit browser features)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === 'production' && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
}

/**
 * ETags for conditional requests
 */
export function enableETags(req: Request, res: Response, next: NextFunction) {
  // Express will automatically generate ETags for responses
  res.setHeader('Vary', 'Accept-Encoding');
  next();
}

/**
 * Preload hints for critical resources
 */
export function preloadHints(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/' || req.path.endsWith('.html')) {
    // Preload critical fonts
    res.setHeader('Link', [
      '</assets/fonts/inter.woff2>; rel=preload; as=font; crossorigin',
      '<https://fonts.googleapis.com>; rel=preconnect',
      '<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
    ].join(', '));
  }
  next();
}

export default {
  staticAssetCache,
  apiCache,
  securityHeaders,
  enableETags,
  preloadHints,
};
