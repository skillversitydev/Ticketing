const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const sheetsService = require('../services/sheetsService');
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

// POST /api/users/sync-sheet - Sync all users to Google Sheet Users tab
router.post('/sync-sheet', async (req, res) => {
  try {
    const allUsers = userService.getAllUsers();
    const result = await sheetsService.syncAllUsers(allUsers);
    return res.json({
      success: true,
      message: `Successfully synced ${allUsers.length} user account(s) to Google Sheet!`,
      result
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Sync failed: ' + error.message });
  }
});

const config = require('../config/config');
const fs = require('fs');
const path = require('path');

// GET /api/users/settings/config - Retrieve current Google Apps Script URL and Sheet ID
router.get('/settings/config', (req, res) => {
  return res.json({
    success: true,
    settings: {
      googleAppsScriptUrl: config.googleAppsScriptUrl,
      googleSheetId: config.googleSheetId,
      targetEmail: config.targetEmail
    }
  });
});

// POST /api/users/settings/config - Save updated Google Apps Script URL and Sheet ID
router.post('/settings/config', (req, res) => {
  try {
    const { googleAppsScriptUrl, googleSheetId, targetEmail } = req.body;

    if (googleAppsScriptUrl !== undefined) config.googleAppsScriptUrl = googleAppsScriptUrl.trim();
    if (googleSheetId !== undefined) config.googleSheetId = googleSheetId.trim();
    if (targetEmail !== undefined) config.targetEmail = targetEmail.trim();

    try {
      const envPath = path.join(__dirname, '../../.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (googleAppsScriptUrl !== undefined) {
          envContent = envContent.replace(/GOOGLE_APPS_SCRIPT_URL=.*/, `GOOGLE_APPS_SCRIPT_URL=${googleAppsScriptUrl.trim()}`);
        }
        if (googleSheetId !== undefined) {
          envContent = envContent.replace(/GOOGLE_SHEET_ID=.*/, `GOOGLE_SHEET_ID=${googleSheetId.trim()}`);
        }
        if (targetEmail !== undefined) {
          envContent = envContent.replace(/TARGET_NOTIFICATION_EMAIL=.*/, `TARGET_NOTIFICATION_EMAIL=${targetEmail.trim()}`);
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      }
    } catch (envErr) {
      console.warn('Could not persist setting changes to .env file:', envErr.message);
    }

    return res.json({
      success: true,
      message: 'Google Integration Settings saved successfully!',
      settings: {
        googleAppsScriptUrl: config.googleAppsScriptUrl,
        googleSheetId: config.googleSheetId,
        targetEmail: config.targetEmail
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update settings: ' + error.message });
  }
});

module.exports = router;
