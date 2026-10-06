const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class StorageService {
  constructor() {
    this.filePath = config.dataFilePath;
    this.ensureFileExists();
  }

  ensureFileExists() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf8');
    }
  }

  getAllTickets() {
    try {
      this.ensureFileExists();
      const content = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(content) || [];
    } catch (error) {
      console.error('Error reading tickets file:', error.message);
      return [];
    }
  }

  getTicketById(ticketId) {
    const tickets = this.getAllTickets();
    return tickets.find(t => t.ticketId === ticketId) || null;
  }

  saveTicket(ticket) {
    const tickets = this.getAllTickets();
    tickets.unshift(ticket); // newest first
    fs.writeFileSync(this.filePath, JSON.stringify(tickets, null, 2), 'utf8');
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
    fs.writeFileSync(this.filePath, JSON.stringify(tickets, null, 2), 'utf8');

    return currentTicket;
  }

  deleteTicket(ticketId) {
    const tickets = this.getAllTickets();
    const index = tickets.findIndex(t => t.ticketId === ticketId);
    if (index === -1) {
      return false;
    }

    tickets.splice(index, 1);
    fs.writeFileSync(this.filePath, JSON.stringify(tickets, null, 2), 'utf8');

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
}

module.exports = new StorageService();
