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
      nextTicketSequence: saved.nextTicketSequence !== undefined ? Number(saved.nextTicketSequence) : 1001
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

  calculateNextTicketIdFromSheet(sheetTickets) {
    const year = new Date().getFullYear();
    let lastSheetSeq = 0;
    let maxSheetSeq = 0;
    let lastTicketId = null;

    if (Array.isArray(sheetTickets) && sheetTickets.length > 0) {
      // Find the last non-empty ticket in the sheet
      for (let i = sheetTickets.length - 1; i >= 0; i--) {
        const t = sheetTickets[i];
        if (t && t.ticketId && String(t.ticketId).trim() !== '') {
          lastTicketId = String(t.ticketId).trim();
          const match = lastTicketId.match(/(\d+)$/);
          if (match) {
            lastSheetSeq = parseInt(match[1], 10);
          }
          break;
        }
      }

      // Also find the maximum sequence across all tickets in the sheet
      sheetTickets.forEach(t => {
        if (t && t.ticketId) {
          const match = String(t.ticketId).trim().match(/(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxSheetSeq) {
              maxSheetSeq = num;
            }
          }
        }
      });
    }

    // Reference sequence is the maximum of the last ticket or highest ticket sequence in the sheet
    const referenceSeq = Math.max(lastSheetSeq, maxSheetSeq);

    let nextSeq;
    if (referenceSeq > 0) {
      nextSeq = referenceSeq + 1;
    } else {
      const settings = this.loadSettings(true);
      nextSeq = Number(settings.nextTicketSequence) || 1001;
    }

    // Persist this next sequence
    this.updateSettings({ nextTicketSequence: nextSeq });

    const seqStr = String(nextSeq).padStart(3, '0');
    const nextTicketId = `TK-${year}-${seqStr}`;

    return {
      nextTicketId,
      nextSequence: nextSeq,
      lastSheetTicketId: lastTicketId || 'None (Sheet is Empty)',
      lastSheetSequence: referenceSeq,
      syncedWithSheet: true
    };
  }

  getNextTicketId() {
    const settings = this.loadSettings(true);
    let seq = Number(settings.nextTicketSequence) || 1001;

    try {
      const storageService = require('./storageService');
      const existingTickets = storageService.getAllTickets() || [];
      let maxExistingSeq = 0;

      existingTickets.forEach(t => {
        if (t && t.ticketId) {
          const match = t.ticketId.match(/(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxExistingSeq) {
              maxExistingSeq = num;
            }
          }
        }
      });

      if (maxExistingSeq >= seq) {
        seq = maxExistingSeq + 1;
        this.updateSettings({ nextTicketSequence: seq });
      }
    } catch (err) {
      console.warn('Deduplication check warning in getNextTicketId:', err.message);
    }

    const year = new Date().getFullYear();
    const seqStr = String(seq).padStart(3, '0');
    return `TK-${year}-${seqStr}`;
  }

  async consumeNextTicketIdAsync() {
    try {
      if (config.googleAppsScriptUrl) {
        await this.getNextTicketIdAsync(true);
      }
    } catch (e) {
      console.warn('Sheet sync before ticket consume warning:', e.message);
    }
    return this.consumeNextTicketId();
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

  async getNextTicketIdAsync(forceRefresh = false) {
    try {
      if (config.googleAppsScriptUrl) {
        const sheetsService = require('./sheetsService');
        const sheetData = await sheetsService.fetchAllFromSheet();
        if (sheetData && sheetData.success && Array.isArray(sheetData.tickets)) {
          const storageService = require('./storageService');
          storageService.syncWithSheetData(sheetData.tickets);
          return this.calculateNextTicketIdFromSheet(sheetData.tickets);
        }
      }
    } catch (e) {
      console.warn('Sheets fetch warning in getNextTicketIdAsync:', e.message);
    }

    const fallbackId = this.getNextTicketId();
    return {
      nextTicketId: fallbackId,
      syncedWithSheet: false,
      lastSheetTicketId: null,
      lastSheetSequence: null
    };
  }

  resetTicketSequence(startValue = 1001) {
    const val = Number(startValue) > 0 ? Number(startValue) : 1001;
    this.updateSettings({ nextTicketSequence: val });
    const year = new Date().getFullYear();
    const seqStr = String(val).padStart(3, '0');
    return `TK-${year}-${seqStr}`;
  }
}

module.exports = new SettingsService();
