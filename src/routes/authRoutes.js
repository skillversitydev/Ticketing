const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const userService = require('../services/userService');

const SECRET_KEY = process.env.JWT_SECRET || 'skillversity_secret_key_2026';

function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    department: user.department,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

function verifyToken(tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string') return null;
  const parts = tokenStr.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(payloadStr).digest('base64url');
  if (signature !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

// POST /api/auth/login - Authenticates user & returns stateless session token
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required.'
    });
  }

  const authenticatedUser = userService.authenticate(username, password);

  if (authenticatedUser) {
    const token = generateToken(authenticatedUser);
    return res.json({
      success: true,
      message: 'Authentication successful',
      token,
      user: authenticatedUser
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Invalid username or password. Only registered admin users can access this portal.'
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  return res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/session
router.get('/session', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
  const user = verifyToken(token);
  if (user) {
    return res.json({ authenticated: true, user });
  }
  return res.json({ authenticated: false });
});

// Middleware for protecting routes
function requireAuth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
  const user = verifyToken(token);
  if (user) {
    req.currentUser = user;
    return next();
  }
  return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
}

module.exports = { router, requireAuth };
