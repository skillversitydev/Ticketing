const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const storageService = require('../services/storageService');
const sheetsService = require('../services/sheetsService');
const emailService = require('../services/emailService');
const upload = require('../middleware/uploadMiddleware');
const { requireAuth } = require('./authRoutes');
const config = require('../config/config');

// Calculate Priority based on Impact and Urgency matrix
function calculatePriority(impact, urgency) {
  if (impact === 'Critical' || urgency === 'Critical') return 'Critical';
  if (impact === 'High' && urgency === 'High') return 'Critical';
  if (impact === 'High' || urgency === 'High') return 'High';
  if (impact === 'Medium' || urgency === 'Medium') return 'Medium';
  return 'Low';
}

const settingsService = require('../services/settingsService');

// Build Clean Gmail Compose URL without attached files text link
function buildGmailComposeUrl(ticket, targetEmail) {
  const to = targetEmail || config.targetEmail;
  const subject = `[Skillversity Ticket #${ticket.ticketId}] ${ticket.subject}`;
  
  const body = `Skillversity IT Support & Complaint Submission:

Ticket ID: ${ticket.ticketId}
Date: ${ticket.date}
Employee Name: ${ticket.userName}
Work Email: ${ticket.userEmail}
Contact / Mobile Number: ${ticket.userPhone || ticket.contactNumber || 'N/A'}
Department: ${ticket.department}
Category: ${ticket.category}
Subcategory: ${ticket.subCategory || 'N/A'}
Priority: ${ticket.priority} (Impact: ${ticket.impact}, Urgency: ${ticket.urgency})

Subject: ${ticket.subject}

Detailed Description:
${ticket.description}

------------------------------------------------
Skillversity IT Support & Complaint Management System
`;

  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// GET /api/complaints/next-id - Get next auto-generated ticket number preview
router.get('/next-id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const nextId = await settingsService.getNextTicketIdAsync();
  res.json({ success: true, nextTicketId: nextId });
});

// 1. POST /api/complaints - Register a new complaint with subcategory and file uploads
router.post('/', upload.array('files', 10), async (req, res) => {
  try {
    const {
      userName,
      userEmail,
      userPhone,
      contactNumber,
      department,
      category,
      subCategory,
      subject,
      description,
      impact = 'Medium',
      urgency = 'Medium'
    } = req.body;

    if (!userName || !department || !category || !subject || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userName, department, category, subject, description are mandatory.'
      });
    }

    const priority = calculatePriority(impact, urgency);
    const ticketId = settingsService.consumeNextTicketId();
    const date = req.body.ticketDate || new Date().toLocaleString();
    const phone = userPhone ? userPhone.trim() : (contactNumber ? contactNumber.trim() : '');

    // Move uploaded files from temp to public/uploads/<ticketId>/
    const attachments = [];
    if (req.files && req.files.length > 0) {
      const targetFolder = path.join(__dirname, `../../public/uploads/${ticketId}`);
      if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder, { recursive: true });
      }

      req.files.forEach(file => {
        const targetPath = path.join(targetFolder, file.filename);
        fs.renameSync(file.path, targetPath);

        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${ticketId}/${file.filename}`;
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: fileUrl,
          uploadedAt: new Date().toISOString()
        });
      });
    }

    const ticket = {
      ticketId,
      date,
      createdAt: new Date().toISOString(),
      userName: userName.trim(),
      userEmail: userEmail ? userEmail.trim() : '',
      userPhone: phone,
      contactNumber: phone,
      department,
      category,
      subCategory: subCategory || 'General Issue',
      subject: subject.trim(),
      description: description.trim(),
      impact,
      urgency,
      priority,
      status: 'Open',
      assignedTo: 'Unassigned',
      vendorTicketRef: '',
      troubleshootingNotes: '',
      attachments,
      userConfirmed: false,
      auditTrail: [{
        timestamp: new Date().toISOString(),
        updatedBy: userName.trim(),
        changes: ['Ticket Created']
      }]
    };

    // Step A: Save to local persistent store
    storageService.saveTicket(ticket);

    // Step B: Build Clean Gmail Compose Navigation Link
    const gmailComposeUrl = buildGmailComposeUrl(ticket, config.targetEmail);

    // Step C: Parallel sync to Google Sheet and Email Notification
    const [sheetResult, emailResult] = await Promise.allSettled([
      sheetsService.appendTicket(ticket),
      emailService.sendNewTicketEmail(ticket)
    ]);

    const sheetStatus = sheetResult.status === 'fulfilled' ? sheetResult.value : { success: false, message: sheetResult.reason };
    const emailStatus = emailResult.status === 'fulfilled' ? emailResult.value : { success: false, message: emailResult.reason };

    return res.status(201).json({
      success: true,
      message: 'Skillversity Ticket successfully registered',
      ticket,
      gmailComposeUrl,
      integrations: {
        googleSheet: sheetStatus,
        email: emailStatus
      }
    });

  } catch (error) {
    console.error('Error creating complaint:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while logging ticket.',
      details: error.message
    });
  }
});

// 2. GET /api/complaints - Fetch tickets
router.get('/', (req, res) => {
  try {
    let tickets = storageService.getAllTickets();
    const { status, department, priority, category, subCategory, search, email } = req.query;

    if (status) tickets = tickets.filter(t => t.status === status);
    if (department) tickets = tickets.filter(t => t.department === department);
    if (priority) tickets = tickets.filter(t => t.priority === priority);
    if (category) tickets = tickets.filter(t => t.category === category);
    if (subCategory) tickets = tickets.filter(t => t.subCategory === subCategory);
    if (email) tickets = tickets.filter(t => t.userEmail && t.userEmail.toLowerCase() === email.toLowerCase());

    if (search) {
      const q = search.toLowerCase();
      tickets = tickets.filter(t => 
        t.ticketId.toLowerCase().includes(q) ||
        t.userName.toLowerCase().includes(q) ||
        (t.userPhone && t.userPhone.toLowerCase().includes(q)) ||
        (t.contactNumber && t.contactNumber.toLowerCase().includes(q)) ||
        (t.date && t.date.toLowerCase().includes(q)) ||
        t.subject.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.subCategory && t.subCategory.toLowerCase().includes(q)) ||
        (t.assignedTo && t.assignedTo.toLowerCase().includes(q)) ||
        (t.vendorTicketRef && t.vendorTicketRef.toLowerCase().includes(q))
      );
    }

    return res.json({ success: true, count: tickets.length, tickets });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. GET /api/complaints/stats - Metrics (requires auth)
router.get('/stats', requireAuth, (req, res) => {
  try {
    const stats = storageService.getStats();
    return res.json({ success: true, stats });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. GET /api/complaints/:id - Single Ticket Details
router.get('/:id', (req, res) => {
  try {
    const ticket = storageService.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });
    return res.json({ success: true, ticket });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. PATCH /api/complaints/:id - Update ticket
router.patch('/:id', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const updateData = req.body;

    const updatedTicket = storageService.updateTicket(ticketId, updateData);

    if (!updatedTicket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    // Await Google Sheet update & email notification for Vercel serverless execution
    const [sheetResult, emailResult] = await Promise.allSettled([
      sheetsService.updateTicket(ticketId, updateData),
      (updateData.status || updateData.troubleshootingNotes) ? emailService.sendStatusUpdateEmail(updatedTicket) : Promise.resolve({ success: true })
    ]);

    const sheetStatus = sheetResult.status === 'fulfilled' ? sheetResult.value : { success: false, message: sheetResult.reason };

    return res.json({
      success: true,
      message: 'Ticket updated successfully and synced with Google Sheet',
      ticket: updatedTicket,
      sheetResult: sheetStatus
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 6. DELETE /api/complaints/:id - Delete a ticket (requires auth)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const deleted = storageService.deleteTicket(ticketId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    // Await Google Sheet row deletion for Vercel serverless execution
    await sheetsService.deleteTicket(ticketId).catch(err => console.warn('Sheet delete err:', err));

    return res.json({
      success: true,
      message: `Ticket #${ticketId} deleted successfully.`
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 7. GET /api/system/status - Diagnostics
router.get('/system/status', (req, res) => {
  const stats = storageService.getStats();
  const serverUrl = `${req.protocol}://${req.get('host')}`;
  return res.json({
    success: true,
    environment: {
      port: config.port,
      serverUrl,
      targetEmail: config.targetEmail,
      googleAppsScriptConfigured: Boolean(config.googleAppsScriptUrl),
      googleSheetsApiConfigured: Boolean(config.googleSheetId && config.googleClientEmail),
      smtpConfigured: Boolean(config.smtp.host && config.smtp.user)
    },
    totalTicketsLogged: stats.total
  });
});

const userService = require('../services/userService');

// 8. POST /api/complaints/sync-sheet - Bi-directional Sync: Load data from Google Sheet & push updates
router.post('/sync-sheet', async (req, res) => {
  try {
    // Step 1: Fetch and load data from Google Sheet
    const sheetData = await sheetsService.fetchAllFromSheet();

    if (sheetData && sheetData.success) {
      if (Array.isArray(sheetData.tickets) && sheetData.tickets.length > 0) {
        storageService.mergeTicketsFromSheet(sheetData.tickets);
      }
      if (Array.isArray(sheetData.users) && sheetData.users.length > 0) {
        userService.mergeUsersFromSheet(sheetData.users);
      }
    }

    // Step 2: Push complete synchronized state to Google Sheet
    const allTickets = storageService.getAllTickets();
    const allUsers = userService.getAllUsers();
    
    const ticketResult = await sheetsService.syncAllTickets(allTickets);
    const userResult = await sheetsService.syncAllUsers(allUsers);

    return res.json({
      success: true,
      message: `Google Sheet synchronized! Loaded & synced ${allTickets.length} ticket(s) & ${allUsers.length} user(s).`,
      ticketCount: allTickets.length,
      userCount: allUsers.length,
      tickets: allTickets,
      users: allUsers,
      ticketResult,
      userResult
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Sync failed: ' + error.message });
  }
});

module.exports = router;

