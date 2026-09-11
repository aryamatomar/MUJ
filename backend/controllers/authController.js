import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { isDbConnected } from '../config/db.js';
import { getJwtSecret } from '../middleware/authMiddleware.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Helper to sanitize user object for client response (never exposes passwordHash)
 */
const toSafeUser = (user) => {
  return {
    id: (user.id || user._id || '').toString(),
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role || 'USER',
    deviceId: user.deviceId || 'SAFEHER-001',
    emergencyContacts: user.emergencyContacts || [],
    createdAt: user.createdAt,
  };
};

/**
 * POST /api/auth/register
 * Registers a new user with role 'USER' strictly in MongoDB
 */
export const register = async (req, res, next) => {
  try {
    // 1. Verify database connectivity
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable.',
      });
    }

    const { name, username, email, password, role, adminSecret } = req.body;

    // 2. Validate required fields
    if (!name || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields (name, username, email, password) are required.',
      });
    }

    const trimmedName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters long.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // 3. Validate email format
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    // 4. Check for existing username or email in MongoDB
    const existingUser = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }],
    });

    if (existingUser) {
      if (existingUser.username.toLowerCase() === cleanUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists. Please choose another.',
        });
      }
      if (existingUser.email.toLowerCase() === cleanEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered. Please sign in or use another email.',
        });
      }
    }

    // 5. Determine assigned role & validate Admin Secret Key if Admin role requested
    let assignedRole = 'USER';
    if (role) {
      const requestedRole = role.toString().trim().toUpperCase();
      if (requestedRole === 'ADMIN') {
        const expectedSecret = process.env.ADMIN_INVITE_SECRET || 'SAFEHER_ADMIN_2026';
        if (!adminSecret || adminSecret.trim() !== expectedSecret) {
          return res.status(403).json({
            success: false,
            message: 'Invalid Admin Secret Key. Unauthorized to register an Administrator account.',
          });
        }
        assignedRole = 'ADMIN';
      }
    }

    // 6. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 7. Create user in MongoDB with determined role
    const newUser = await User.create({
      name: trimmedName,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      role: assignedRole,
      deviceId: 'SAFEHER-001',
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: toSafeUser(newUser),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Authenticates user credentials via MongoDB and returns JWT token
 */
export const login = async (req, res, next) => {
  try {
    // 1. Verify database connectivity
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable.',
      });
    }

    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.',
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    // 2. Lookup user in MongoDB
    const user = await User.findOne({ username: cleanUsername });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    // 3. Compare password hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    // 4. Role verification if selected by user
    if (role) {
      const requestedRole = role.trim().toUpperCase();
      if (requestedRole === 'ADMIN' && user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access denied: This account does not possess Administrator privileges.',
        });
      }
    }

    const safeUser = toSafeUser(user);

    // 4. Generate JWT token
    const token = jwt.sign(
      {
        id: safeUser.id,
        username: safeUser.username,
        email: safeUser.email,
        role: safeUser.role,
        deviceId: safeUser.deviceId,
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Returns currently authenticated user safe profile directly from MongoDB
 */
export const getMe = async (req, res, next) => {
  try {
    // 1. Verify database connectivity
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable.',
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload.',
      });
    }

    // 2. Fetch user from MongoDB
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user: toSafeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/emergency-contacts
 * Returns authenticated user's emergency contacts directly from MongoDB
 */
export const getEmergencyContacts = async (req, res, next) => {
  try {
    // 1. Verify database connectivity
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable.',
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or missing authentication token.',
      });
    }

    // 2. Fetch user from MongoDB
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    return res.status(200).json({
      success: true,
      contacts: user.emergencyContacts || [],
      user: toSafeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/emergency-contacts
 * Updates authenticated user's emergency contacts directly in MongoDB
 */
export const updateEmergencyContacts = async (req, res, next) => {
  try {
    // 1. Verify database connectivity
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable.',
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or missing authentication token.',
      });
    }

    const { contacts } = req.body;

    // 2. Validate contacts is an array
    if (!Array.isArray(contacts)) {
      return res.status(400).json({
        success: false,
        message: 'Contacts must be provided as an array.',
      });
    }

    // 3. Allow maximum 3 contacts
    if (contacts.length > 3) {
      return res.status(400).json({
        success: false,
        message: 'A maximum of 3 emergency contacts is allowed.',
      });
    }

    // 4. Validate each contact
    const sanitizedContacts = [];
    for (const contact of contacts) {
      if (
        !contact ||
        typeof contact !== 'object' ||
        typeof contact.name !== 'string' ||
        typeof contact.phone !== 'string' ||
        !contact.name.trim() ||
        !contact.phone.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: 'Each contact must contain a valid name and phone number.',
        });
      }

      sanitizedContacts.push({
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        relationship:
          typeof contact.relationship === 'string'
            ? contact.relationship.trim()
            : '',
      });
    }

    // 5. Update only that user's emergencyContacts in MongoDB
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    user.emergencyContacts = sanitizedContacts;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Emergency contacts updated successfully.',
      contacts: user.emergencyContacts,
      user: toSafeUser(user),
    });
  } catch (error) {
    next(error);
  }
};
