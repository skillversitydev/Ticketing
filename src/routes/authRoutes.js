const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const userService = require('../services/userService');

// Simple in-memory token store for sessions: Map token -> user object
const activeSessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/auth/login - Strictly authenticates stored users
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
    const token = generateToken();
    activeSessions.set(token, authenticatedUser);
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
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token) {
    activeSessions.delete(token);
  }
  return res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/session
router.get('/session', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token && activeSessions.has(token)) {
    return res.json({ authenticated: true, user: activeSessions.get(token) });
  }
  return res.json({ authenticated: false });
});

// Middleware for protecting routes
function requireAuth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
  if (token && activeSessions.has(token)) {
    req.currentUser = activeSessions.get(token);
    return next();
  }
  return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
}

module.exports = { router, requireAuth, activeSessions };
