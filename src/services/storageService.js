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

  syncWithSheetData(sheetTickets = []) {
    if (!Array.isArray(sheetTickets)) return this.getAllTickets();

    const updatedTickets = sheetTickets.filter(st => st && st.ticketId).map(st => ({
      ticketId: st.ticketId.trim(),
      date: st.date || new Date().toLocaleString(),
      createdAt: st.date || new Date().toISOString(),
      userName: st.userName || 'Employee',
      userEmail: st.userEmail || '',
      userPhone: st.userPhone || st.contactNumber || '',
      contactNumber: st.userPhone || st.contactNumber || '',
      department: st.department || 'OTHER',
      category: st.category || 'General Service & Other',
      subCategory: st.subCategory || 'Other Service Request',
      subject: st.subject || '',
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
      auditTrail: st.auditTrail || [{
        timestamp: new Date().toISOString(),
        updatedBy: 'Google Sheet Sync',
        changes: ['Synced from Google Sheet']
      }]
    }));

    this.memoryTickets = updatedTickets;

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(updatedTickets, null, 2), 'utf8');
    } catch (err) {
      console.warn('StorageService sync write warning:', err.message);
    }

    return updatedTickets;
  }

  mergeTicketsFromSheet(sheetTickets = []) {
    return this.syncWithSheetData(sheetTickets);
  }
}

module.exports = new StorageService();
