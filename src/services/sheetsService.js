const axios = require('axios');
const { google } = require('googleapis');
const config = require('../config/config');

class SheetsService {
  getAxiosConfig() {
    return {
      headers: { 'Content-Type': 'application/json' },
      timeout: 25000,
      maxRedirects: 5
    };
  }

  async appendTicket(ticket) {
    const results = {
      method: null,
      success: false,
      message: ''
    };

    const attachmentUrls = ticket.attachments && ticket.attachments.length > 0
      ? ticket.attachments.map(a => a.url).join(', ')
      : 'None';

    // Method 1: Google Apps Script Webhook
    if (config.googleAppsScriptUrl) {
      try {
        console.log('Syncing ticket to Google Sheet via Apps Script Webhook...');
        const response = await axios.post(config.googleAppsScriptUrl, {
          action: 'CREATE',
          ...ticket,
          contactNumber: ticket.userPhone || ticket.contactNumber || 'N/A',
          attachmentUrls,
          targetEmail: config.targetEmail
        }, this.getAxiosConfig());

        if (response.data && (response.data.success || response.status === 200)) {
          results.method = 'AppsScriptWebhook';
          results.success = true;
          results.message = 'Synced to Google Sheet via Apps Script Webhook';
          return results;
        }
      } catch (err) {
        console.warn('Apps Script Webhook sync warning:', err.message);
      }
    }

    // Method 2: Direct Google Sheets API v4
    if (config.googleSheetId && config.googleClientEmail && config.googlePrivateKey) {
      try {
        console.log('Syncing ticket to Google Sheet via googleapis Service Account...');
        const auth = new google.auth.JWT(
          config.googleClientEmail,
          null,
          config.googlePrivateKey,
          ['https://www.googleapis.com/auth/spreadsheets']
        );

        const sheets = google.sheets({ version: 'v4', auth });
        
        const values = [[
          ticket.ticketId,
          ticket.date,
          ticket.userName,
          ticket.userEmail,
          ticket.userPhone || ticket.contactNumber || 'N/A',
          ticket.department,
          ticket.category,
          ticket.subCategory || 'N/A',
          ticket.subject,
          ticket.description,
          ticket.impact,
          ticket.urgency,
          ticket.priority,
          ticket.status,
          ticket.assignedTo || 'Unassigned',
          ticket.vendorTicketRef || 'N/A',
          ticket.troubleshootingNotes || '',
          new Date().toLocaleString(),
          attachmentUrls
        ]];

        await sheets.spreadsheets.values.append({
          spreadsheetId: config.googleSheetId,
          range: 'Sheet1!A:S',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values }
        });

        results.method = 'GoogleSheetsAPI';
        results.success = true;
        results.message = 'Synced to Google Sheet via Direct API v4';
        return results;
      } catch (err) {
        console.warn('Google Sheets API v4 sync warning:', err.message);
      }
    }

    results.method = 'LocalFallback';
    results.success = false;
    results.message = config.googleAppsScriptUrl
      ? 'Google Sheet webhook connection failed.'
      : 'GOOGLE_APPS_SCRIPT_URL not configured in Vercel Environment Variables.';
    return results;
  }

  async updateTicket(ticketId, updateData) {
    if (config.googleAppsScriptUrl) {
      try {
        await axios.post(config.googleAppsScriptUrl, {
          action: 'UPDATE',
          ticketId,
          ...updateData
        }, this.getAxiosConfig());
        return { success: true, message: 'Google Sheet update sent via Apps Script' };
      } catch (err) {
        console.warn('Apps Script update error:', err.message);
      }
    }
    return { success: false, message: 'GOOGLE_APPS_SCRIPT_URL not configured in Vercel Environment Variables.' };
  }

  async deleteTicket(ticketId) {
    if (config.googleAppsScriptUrl) {
      try {
        await axios.post(config.googleAppsScriptUrl, {
          action: 'DELETE',
          ticketId
        }, this.getAxiosConfig());
        return { success: true, message: 'Google Sheet deletion sent via Apps Script' };
      } catch (err) {
        console.warn('Apps Script delete error:', err.message);
      }
    }
    return { success: false, message: 'GOOGLE_APPS_SCRIPT_URL not configured in Vercel Environment Variables.' };
  }

  async syncHeaders() {
    if (config.googleAppsScriptUrl) {
      try {
        const response = await axios.post(config.googleAppsScriptUrl, {
          action: 'SETUP_HEADERS'
        }, this.getAxiosConfig());
        return { success: true, message: response.data ? response.data.message : 'Headers synced with Google Sheet' };
      } catch (err) {
        return { success: false, message: 'Failed to sync headers: ' + err.message };
      }
    }
    return { success: false, message: 'GOOGLE_APPS_SCRIPT_URL not configured in Vercel Environment Variables.' };
  }

  async syncAllTickets(tickets) {
    if (!config.googleAppsScriptUrl) {
      return { success: false, message: 'GOOGLE_APPS_SCRIPT_URL not configured in Vercel Environment Variables.' };
    }
    try {
      const response = await axios.post(config.googleAppsScriptUrl, {
        action: 'SYNC_TICKETS',
        tickets
      }, this.getAxiosConfig());

      return {
        success: true,
        message: response.data ? response.data.message : `Synced ${tickets.length} tickets to Google Sheet`,
        syncedCount: tickets.length
      };
    } catch (err) {
      return { success: false, message: 'Sync failed: ' + err.message };
    }
  }

  // ==========================================
  // USER MANAGEMENT SYNC METHODS (Users Sheet)
  // ==========================================

  async createUser(user) {
    if (config.googleAppsScriptUrl) {
      try {
        await axios.post(config.googleAppsScriptUrl, {
          action: 'CREATE_USER',
          ...user
        }, this.getAxiosConfig());
        return { success: true, message: 'User synced to Google Sheet (Users tab)' };
      } catch (err) {
        console.warn('Apps Script user sync error:', err.message);
      }
    }
    return { success: false, message: 'GOOGLE_APPS_SCRIPT_URL not configured in Vercel Environment Variables.' };
  }

  async updateUser(user) {
    if (config.googleAppsScriptUrl) {
      try {
        await axios.post(config.googleAppsScriptUrl, {
          action: 'UPDATE_USER',
          ...user
        }, this.getAxiosConfig());
        return { success: true, message: 'User update synced to Google Sheet (Users tab)' };
      } catch (err) {
        console.warn('Apps Script user update error:', err.message);
      }
    }
    return { success: false, message: 'GOOGLE_APPS_SCRIPT_URL not configured in Vercel Environment Variables.' };
  }

  async deleteUser(username, userId) {
    if (config.googleAppsScriptUrl) {
      try {
        await axios.post(config.googleAppsScriptUrl, {
          action: 'DELETE_USER',
          username,
          id: userId
        }, this.getAxiosConfig());
        return { success: true, message: 'User deletion synced to Google Sheet' };
      } catch (err) {
        console.warn('Apps Script user delete error:', err.message);
      }
    }
    return { success: false, message: 'GOOGLE_APPS_SCRIPT_URL not configured in Vercel Environment Variables.' };
  }

  async syncAllUsers(users) {
    if (!config.googleAppsScriptUrl) {
      return { success: false, message: 'GOOGLE_APPS_SCRIPT_URL not configured in Vercel Environment Variables.' };
    }
    try {
      const response = await axios.post(config.googleAppsScriptUrl, {
        action: 'SYNC_USERS',
        users
      }, this.getAxiosConfig());
      return {
        success: true,
        message: response.data ? response.data.message : `Synced ${users.length} users to Google Sheet`,
        count: users.length
      };
    } catch (err) {
      return { success: false, message: 'User sync failed: ' + err.message };
    }
  }
}

module.exports = new SheetsService();
