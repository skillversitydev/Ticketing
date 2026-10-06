const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const sheetsService = require('../services/sheetsService');
const storageService = require('../services/storageService');
const { requireAuth } = require('./authRoutes');

// Protect all user management endpoints with authentication
router.use(requireAuth);

// GET /api/users - Fetch list of registered admin/tech users
router.get('/', (req, res) => {
  try {
    const users = userService.getAllUsers();
    return res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user records.',
      details: error.message
    });
  }
});

// POST /api/users - Create a new user
router.post('/', (req, res) => {
  try {
    const { username, password, fullName, email, phone, role, department } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are mandatory for user creation.'
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 4 characters long.'
      });
    }

    const createdBy = req.currentUser ? req.currentUser.username : 'Admin';
    const user = userService.createUser({
      username,
      password,
      fullName,
      email,
      phone,
      role,
      department,
      createdBy
    });

    // Sync user to Google Sheet Users tab in background
    sheetsService.createUser(user).catch(err => console.warn('User sheet sync err:', err.message));

    return res.status(201).json({
      success: true,
      message: `User '${user.username}' created successfully!`,
      user
    });

  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/users/:id - Get single user
router.get('/:id', (req, res) => {
  try {
    const user = userService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/users/:id - Update user account
router.patch('/:id', (req, res) => {
  try {
    const userId = req.params.id;
    const updatedUser = userService.updateUser(userId, req.body);

    // Sync updated user to Google Sheet Users tab
    sheetsService.updateUser(updatedUser).catch(err => console.warn('User sheet update err:', err.message));

    return res.json({
      success: true,
      message: `User '${updatedUser.username}' updated successfully!`,
      user: updatedUser
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/users/:id - Delete a user
router.delete('/:id', (req, res) => {
  try {
    const userId = req.params.id;
    const targetUser = userService.getUserById(userId);
    userService.deleteUser(userId);

    if (targetUser) {
      sheetsService.deleteUser(targetUser.username, userId).catch(err => console.warn('User sheet delete err:', err.message));
    }

    return res.json({
      success: true,
      message: 'User removed successfully.'
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/users/sync-sheet - Sync users and tickets with Google Sheet
router.post('/sync-sheet', async (req, res) => {
  try {
    const sheetData = await sheetsService.fetchAllFromSheet();
    if (sheetData && sheetData.success) {
      if (Array.isArray(sheetData.tickets) && sheetData.tickets.length > 0) {
        storageService.mergeTicketsFromSheet(sheetData.tickets);
      }
      if (Array.isArray(sheetData.users) && sheetData.users.length > 0) {
        userService.mergeUsersFromSheet(sheetData.users);
      }
    }

    const allUsers = userService.getAllUsers();
    const result = await sheetsService.syncAllUsers(allUsers);
    return res.json({
      success: true,
      message: `Successfully loaded & synced ${allUsers.length} user account(s) with Google Sheet!`,
      result
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Sync failed: ' + error.message });
  }
});

const settingsService = require('../services/settingsService');

// GET /api/users/settings/config - Retrieve current Google Apps Script URL and Sheet ID
router.get('/settings/config', (req, res) => {
  const settings = settingsService.getSettings();
  return res.json({
    success: true,
    settings
  });
});

// POST /api/users/settings/config - Save updated Google Apps Script URL and Sheet ID
router.post('/settings/config', (req, res) => {
  try {
    const { googleAppsScriptUrl, googleSheetId, targetEmail } = req.body;
    const settings = settingsService.updateSettings({
      googleAppsScriptUrl,
      googleSheetId,
      targetEmail
    });

    return res.json({
      success: true,
      message: 'Google Integration Settings saved successfully & updated on backend!',
      settings
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update settings: ' + error.message });
  }
});

// POST /api/users/settings/reset-ticket-counter - Reset Ticket Sequence (Restricted strictly to pladmin)
router.post('/settings/reset-ticket-counter', (req, res) => {
  try {
    const currentUser = req.currentUser;
    const isPladmin = currentUser && (currentUser.username.toLowerCase() === 'pladmin' || currentUser.role === 'Super Admin');

    if (!isPladmin) {
      return res.status(403).json({
        success: false,
        error: 'Access Restricted: Only the "pladmin" Super Admin can reset ticket numbering sequence.'
      });
    }

    const startValue = req.body.startValue || 1;
    const nextTicketId = settingsService.resetTicketSequence(startValue);

    return res.json({
      success: true,
      message: `Ticket sequence counter successfully reset! Next generated ticket will be ${nextTicketId}.`,
      nextTicketId,
      startValue
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to reset ticket sequence: ' + error.message });
  }
});

module.exports = router;
