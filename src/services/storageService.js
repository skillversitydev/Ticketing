const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class StorageService {
  constructor() {
    this.filePath = config.dataFilePath;
    this.memoryTickets = null;
    this.ensureFileExists();
  }

  ensureFileExists() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf8');
      }
    } catch (err) {
      console.warn('StorageService file initialization warning (read-only environment):', err.message);
    }
  }

  getAllTickets() {
    if (this.memoryTickets) return this.memoryTickets;
    try {
      this.ensureFileExists();
      const content = fs.readFileSync(this.filePath, 'utf8');
      this.memoryTickets = JSON.parse(content) || [];
      return this.memoryTickets;
    } catch (error) {
      this.memoryTickets = this.memoryTickets || [];
      return this.memoryTickets;
    }
  }

  getTicketById(ticketId) {
    const tickets = this.getAllTickets();
    return tickets.find(t => t.ticketId === ticketId) || null;
  }

  saveTicket(ticket) {
    const tickets = this.getAllTickets();
    tickets.unshift(ticket); // newest first
    this.memoryTickets = tickets;

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(tickets, null, 2), 'utf8');
    } catch (err) {
      console.warn('StorageService ticket write warning (read-only filesystem):', err.message);
    }

    return ticket;
  }

  updateTicket(ticketId, updateData) {
    const tickets = this.getAllTickets();
    const index = tickets.findIndex(t => t.ticketId === ticketId);
    
    if (index === -1) {
      return null;
    }

    const currentTicket = tickets[index];

    // Maintain audit trail of changes
    const auditEntry = {
      timestamp: new Date().toISOString(),
      updatedBy: updateData.updatedBy || 'IT Admin',
      changes: []
    };

    if (updateData.status && updateData.status !== currentTicket.status) {
      auditEntry.changes.push(`Status changed from '${currentTicket.status}' to '${updateData.status}'`);
      currentTicket.status = updateData.status;
    }

    if (updateData.priority && updateData.priority !== currentTicket.priority) {
      auditEntry.changes.push(`Priority updated to '${updateData.priority}'`);
      currentTicket.priority = updateData.priority;
    }

    if (updateData.assignedTo && updateData.assignedTo !== currentTicket.assignedTo) {
      auditEntry.changes.push(`Assigned to '${updateData.assignedTo}'`);
      currentTicket.assignedTo = updateData.assignedTo;
    }

    if (updateData.vendorTicketRef !== undefined) {
      if (updateData.vendorTicketRef !== currentTicket.vendorTicketRef) {
        auditEntry.changes.push(`Vendor Reference set to '${updateData.vendorTicketRef}'`);
        currentTicket.vendorTicketRef = updateData.vendorTicketRef;
      }
    }

    if (updateData.troubleshootingNotes) {
      const noteEntry = `[${new Date().toLocaleString()}] ${updateData.updatedBy || 'Tech'}: ${updateData.troubleshootingNotes}`;
      currentTicket.troubleshootingNotes = currentTicket.troubleshootingNotes 
        ? `${currentTicket.troubleshootingNotes}\n${noteEntry}`
        : noteEntry;
      auditEntry.changes.push(`Added troubleshooting log.`);
    }

    if (updateData.userConfirmed !== undefined) {
      currentTicket.userConfirmed = updateData.userConfirmed;
      currentTicket.confirmedAt = new Date().toISOString();
      auditEntry.changes.push(`User confirmed resolution.`);
    }

    currentTicket.lastUpdated = new Date().toLocaleString();
    if (!currentTicket.auditTrail) currentTicket.auditTrail = [];
    currentTicket.auditTrail.push(auditEntry);

    tickets[index] = currentTicket;
    this.memoryTickets = tickets;

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(tickets, null, 2), 'utf8');
    } catch (err) {
      console.warn('StorageService update write warning (read-only filesystem):', err.message);
    }

    return currentTicket;
  }

  deleteTicket(ticketId) {
    const tickets = this.getAllTickets();
    const index = tickets.findIndex(t => t.ticketId === ticketId);
    if (index === -1) {
      return false;
    }

    tickets.splice(index, 1);
    this.memoryTickets = tickets;

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(tickets, null, 2), 'utf8');
    } catch (err) {
      console.warn('StorageService delete write warning (read-only filesystem):', err.message);
    }

    // Remove uploaded media files folder for this ticket if present
    const folderPath = path.join(__dirname, `../../public/uploads/${ticketId}`);
    if (fs.existsSync(folderPath)) {
      try {
        fs.rmSync(folderPath, { recursive: true, force: true });
      } catch (err) {
        console.warn(`Could not delete upload folder for ${ticketId}:`, err.message);
      }
    }

    return true;
  }

  getStats() {
    const tickets = this.getAllTickets();
    const stats = {
      total: tickets.length,
      open: 0,
      inProgress: 0,
      pendingVendor: 0,
      pendingUser: 0,
      resolved: 0,
      closed: 0,
      byPriority: { Low: 0, Medium: 0, High: 0, Critical: 0 },
      byDepartment: {}
    };

    tickets.forEach(t => {
      const status = t.status || 'Open';
      if (status === 'Open') stats.open++;
      else if (status === 'In Progress') stats.inProgress++;
      else if (status === 'Pending Vendor') stats.pendingVendor++;
      else if (status === 'Pending User Confirmation') stats.pendingUser++;
      else if (status === 'Resolved') stats.resolved++;
      else if (status === 'Closed') stats.closed++;

      const prio = t.priority || 'Medium';
      if (stats.byPriority[prio] !== undefined) stats.byPriority[prio]++;

      const dept = t.department || 'Other';
      stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;
    });

    return stats;
  }

  mergeTicketsFromSheet(sheetTickets = []) {
    if (!Array.isArray(sheetTickets) || sheetTickets.length === 0) {
      return this.getAllTickets();
    }

    const currentTickets = this.getAllTickets();
    let updatedCount = 0;
    let addedCount = 0;

    sheetTickets.forEach(st => {
      if (!st.ticketId) return;
      const index = currentTickets.findIndex(t => t.ticketId.trim().toLowerCase() === st.ticketId.trim().toLowerCase());

      if (index !== -1) {
        const existing = currentTickets[index];
        let changed = false;

        if (st.status && st.status !== existing.status) {
          existing.status = st.status;
          changed = true;
        }
        if (st.priority && st.priority !== existing.priority) {
          existing.priority = st.priority;
          changed = true;
        }
        if (st.assignedTo && st.assignedTo !== existing.assignedTo) {
          existing.assignedTo = st.assignedTo;
          changed = true;
        }
        if (st.vendorTicketRef !== undefined && st.vendorTicketRef !== existing.vendorTicketRef) {
          existing.vendorTicketRef = st.vendorTicketRef;
          changed = true;
        }
        if (st.troubleshootingNotes && st.troubleshootingNotes !== existing.troubleshootingNotes) {
          existing.troubleshootingNotes = st.troubleshootingNotes;
          changed = true;
        }
        if (st.userName && !existing.userName) existing.userName = st.userName;
        if (st.userEmail && !existing.userEmail) existing.userEmail = st.userEmail;
        if (st.userPhone && !existing.userPhone) existing.userPhone = st.userPhone;
        if (st.contactNumber && !existing.contactNumber) existing.contactNumber = st.contactNumber;
        if (st.department && !existing.department) existing.department = st.department;
        if (st.category && !existing.category) existing.category = st.category;
        if (st.subCategory && !existing.subCategory) existing.subCategory = st.subCategory;
        if (st.subject && !existing.subject) existing.subject = st.subject;
        if (st.description && !existing.description) existing.description = st.description;

        if (changed) {
          existing.lastUpdated = new Date().toLocaleString();
          currentTickets[index] = existing;
          updatedCount++;
        }
      } else {
        const newTicket = {
          ticketId: st.ticketId,
          date: st.date || new Date().toLocaleString(),
          createdAt: st.date || new Date().toISOString(),
          userName: st.userName || 'Employee',
          userEmail: st.userEmail || '',
          userPhone: st.userPhone || st.contactNumber || '',
          contactNumber: st.userPhone || st.contactNumber || '',
          department: st.department || 'OTHER',
          category: st.category || 'General Service & Other',
          subCategory: st.subCategory || 'Other Service Request',
          subject: st.subject || 'Ticket from Google Sheet',
          description: st.description || '',
          impact: st.impact || 'Medium',
          urgency: st.urgency || 'Medium',
          priority: st.priority || 'Medium',
          status: st.status || 'Open',
          assignedTo: st.assignedTo || 'Unassigned',
          vendorTicketRef: st.vendorTicketRef || '',
          troubleshootingNotes: st.troubleshootingNotes || '',
          attachments: st.attachments || [],
          userConfirmed: st.status === 'Closed',
          auditTrail: [{
            timestamp: new Date().toISOString(),
            updatedBy: 'Google Sheet Sync',
            changes: ['Imported from Google Sheet']
          }]
        };
        currentTickets.unshift(newTicket);
        addedCount++;
      }
    });

    this.memoryTickets = currentTickets;

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(currentTickets, null, 2), 'utf8');
    } catch (err) {
      console.warn('StorageService merge write warning (read-only filesystem):', err.message);
    }

    console.log(`Merged tickets from Sheet: ${addedCount} added, ${updatedCount} updated.`);
    return currentTickets;
  }
}

module.exports = new StorageService();
