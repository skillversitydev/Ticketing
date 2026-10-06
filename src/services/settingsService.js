const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class SettingsService {
  constructor() {
    this.filePath = path.join(__dirname, '../../data/settings.json');
    this.memorySettings = null;
    this.loadSettings();
  }

  loadSettings(forceReload = false) {
    if (this.memorySettings && !forceReload) return this.memorySettings;

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
      targetEmail: saved.targetEmail || config.targetEmail || process.env.TARGET_NOTIFICATION_EMAIL || 'skillversitydev@gmail.com',
      nextTicketSequence: saved.nextTicketSequence !== undefined ? Number(saved.nextTicketSequence) : 1
    };

    this.memorySettings = merged;

    // Apply merged settings back to config object
    config.googleAppsScriptUrl = merged.googleAppsScriptUrl;
    config.googleSheetId = merged.googleSheetId;
    config.targetEmail = merged.targetEmail;

    return merged;
  }

  getSettings() {
    return this.loadSettings(true);
  }

  updateSettings({ googleAppsScriptUrl, googleSheetId, targetEmail, nextTicketSequence }) {
    const current = this.loadSettings(true);

    if (googleAppsScriptUrl !== undefined) current.googleAppsScriptUrl = googleAppsScriptUrl.trim();
    if (googleSheetId !== undefined) current.googleSheetId = googleSheetId.trim();
    if (targetEmail !== undefined) current.targetEmail = targetEmail.trim();
    if (nextTicketSequence !== undefined) current.nextTicketSequence = Number(nextTicketSequence) || 1;

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

    return current;
  }

  getNextTicketId() {
    const settings = this.loadSettings(true);
    const seq = Number(settings.nextTicketSequence) || 1;
    const year = new Date().getFullYear();
    const seqStr = String(seq).padStart(3, '0');
    return `TK-${year}-${seqStr}`;
  }

  consumeNextTicketId() {
    const ticketId = this.getNextTicketId();
    const match = ticketId.match(/(\d+)$/);
    if (match) {
      const currentNum = parseInt(match[1], 10);
      this.updateSettings({ nextTicketSequence: currentNum + 1 });
    }
    return ticketId;
  }

  resetTicketSequence(startValue = 1) {
    const val = Number(startValue) > 0 ? Number(startValue) : 1;
    this.updateSettings({ nextTicketSequence: val });
    const year = new Date().getFullYear();
    const seqStr = String(val).padStart(3, '0');
    return `TK-${year}-${seqStr}`;
  }
}

module.exports = new SettingsService();
