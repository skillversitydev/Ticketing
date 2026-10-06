const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class SettingsService {
  constructor() {
    this.filePath = path.join(__dirname, '../../data/settings.json');
    this.memorySettings = null;
    this.loadSettings();
  }

  loadSettings() {
    if (this.memorySettings) return this.memorySettings;

    let saved = {};
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf8');
        saved = JSON.parse(content) || {};
      }
    } catch (err) {
      console.warn('SettingsService read warning:', err.message);
    }

    const merged = {
      googleAppsScriptUrl: saved.googleAppsScriptUrl || config.googleAppsScriptUrl || process.env.GOOGLE_APPS_SCRIPT_URL || '',
      googleSheetId: saved.googleSheetId || config.googleSheetId || process.env.GOOGLE_SHEET_ID || '',
      targetEmail: saved.targetEmail || config.targetEmail || process.env.TARGET_NOTIFICATION_EMAIL || 'skillversitydev@gmail.com'
    };

    this.memorySettings = merged;

    // Apply merged settings back to config object
    config.googleAppsScriptUrl = merged.googleAppsScriptUrl;
    config.googleSheetId = merged.googleSheetId;
    config.targetEmail = merged.targetEmail;

    return merged;
  }

  getSettings() {
    return this.loadSettings();
  }

  updateSettings({ googleAppsScriptUrl, googleSheetId, targetEmail }) {
    const current = this.loadSettings();

    if (googleAppsScriptUrl !== undefined) current.googleAppsScriptUrl = googleAppsScriptUrl.trim();
    if (googleSheetId !== undefined) current.googleSheetId = googleSheetId.trim();
    if (targetEmail !== undefined) current.targetEmail = targetEmail.trim();

    this.memorySettings = current;

    // Update config object in memory
    config.googleAppsScriptUrl = current.googleAppsScriptUrl;
    config.googleSheetId = current.googleSheetId;
    config.targetEmail = current.targetEmail;

    // Persist to data/settings.json
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(current, null, 2), 'utf8');
    } catch (err) {
      console.warn('SettingsService write warning (read-only environment):', err.message);
    }

    // Also attempt updating .env file if writable
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
      // Ignored on read-only environments
    }

    return current;
  }
}

module.exports = new SettingsService();
