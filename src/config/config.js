const path = require('path');
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  targetEmail: process.env.TARGET_NOTIFICATION_EMAIL || 'it-support@company.com',
  
  // Google Apps Script Webhook
  googleAppsScriptUrl: process.env.GOOGLE_APPS_SCRIPT_URL || '',
  
  // Google Sheets API v4
  googleSheetId: process.env.GOOGLE_SHEET_ID || '',
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL || '',
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',

  // Nodemailer SMTP Configuration
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'IT Support <no-reply@company.com>'
  },

  // Path for local tickets JSON file fallback
  dataFilePath: path.join(__dirname, '../../data/tickets.json')
};
