import jwt from 'jsonwebtoken';

export const getJwtSecret = () => {
  return process.env.JWT_SECRET || 'safeher_jwt_secret_dev_key_fallback_2026';
};

/**
 * Middleware: authenticateToken
 * Verifies Bearer JWT from Authorization header and sets req.user
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required. Please log in.',
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired access token. Please log in again.',
    });
  }
};

/**
 * Middleware: requireAdmin
 * Checks that req.user has role 'ADMIN'
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Admin privileges required.',
    });
  }
  next();
};
