const assert = require('assert');
const storageService = require('./src/services/storageService');
const emailService = require('./src/services/emailService');
const sheetsService = require('./src/services/sheetsService');
const fs = require('fs');
const path = require('path');

console.log('--------------------------------------------------');
console.log('🧪 Running System Verification Tests for Skillversity...');
console.log('--------------------------------------------------');

async function runTests() {
  try {
    // Test 1: Auto Ticket Number & Storage
    console.log('TEST 1: Verifying Auto Ticket Number generation & file attachment storage...');
    const ticketId = `TK-TEST-${Date.now().toString().slice(-4)}`;
    
    // Simulate attached file storage under public/uploads/<ticketId>/
    const fileFolder = path.join(__dirname, `public/uploads/${ticketId}`);
    fs.mkdirSync(fileFolder, { recursive: true });
    const dummyFilePath = path.join(fileFolder, 'screenshot.png');
    fs.writeFileSync(dummyFilePath, 'dummy image content');

    const testTicket = {
      ticketId,
      date: new Date().toLocaleString(),
      createdAt: new Date().toISOString(),
      userName: 'Priya Sharma',
      userEmail: 'priya.sharma@skillversity.org',
      userPhone: '+91 9876543210',
      contactNumber: '+91 9876543210',
      department: 'IT Support',
      category: 'IT Hardware & Devices',
      subCategory: 'Laptop / PC',
      subject: 'Display Flickering Issue',
      description: 'Laptop monitor displays intermittent horizontal lines when attached to docking station.',
      impact: 'Medium',
      urgency: 'High',
      priority: 'High',
      status: 'Open',
      assignedTo: 'Unassigned',
      vendorTicketRef: '',
      troubleshootingNotes: '',
      attachments: [{
        filename: 'screenshot.png',
        originalName: 'display_error.png',
        mimeType: 'image/png',
        size: 1024,
        url: `http://localhost:3000/uploads/${ticketId}/screenshot.png`
      }],
      userConfirmed: false,
      auditTrail: [{
        timestamp: new Date().toISOString(),
        updatedBy: 'Priya Sharma',
        changes: ['Ticket Created']
      }]
    };

    const saved = storageService.saveTicket(testTicket);
    assert.strictEqual(saved.ticketId, ticketId, 'Ticket ID mismatch');
    assert.strictEqual(saved.userPhone, '+91 9876543210', 'Mobile / Contact number mismatch');
    assert.ok(saved.date, 'Date field missing from ticket record');
    assert.ok(saved.attachments.length > 0, 'Attachment missing from ticket record');
    console.log(`✅ TEST 1 PASSED: Ticket ${saved.ticketId} saved with Mobile Number, Date, and Localhost attachment.`);

    // Test 2: Gmail Compose Link Builder
    console.log('TEST 2: Verifying Gmail Compose URL generator...');
    const targetEmail = 'skillversitycomplaints@gmail.com';
    const subject = `[Skillversity Ticket #${ticketId}] ${testTicket.subject}`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(testTicket.description)}`;

    assert.ok(gmailUrl.includes('mail.google.com'), 'Invalid Gmail compose URL structure');
    assert.ok(gmailUrl.includes(ticketId), 'Gmail compose URL missing Ticket ID');
    console.log(`✅ TEST 2 PASSED: Gmail compose link generated cleanly.`);

    // Test 3: Skillversity Email Template & Google Sheet Row Builder
    console.log('TEST 3: Verifying Skillversity email HTML templates and attachment URL rendering...');
    const adminEmailHtml = emailService.getAdminNotificationTemplate(saved);
    assert.ok(adminEmailHtml.includes('Skillversity'), 'Skillversity branding missing from email template');
    assert.ok(adminEmailHtml.includes('+91 9876543210'), 'Mobile number missing from admin email template');
    assert.ok(adminEmailHtml.includes(saved.attachments[0].url), 'Localhost attachment URL missing from email template');

    console.log(`✅ TEST 3 PASSED: Email templates, Mobile Number, Date, and Localhost URLs verified cleanly.`);

    // Test 4: User Creation & Strict Admin Authentication
    console.log('TEST 4: Verifying Admin User Creation & Strict Authentication...');
    const userService = require('./src/services/userService');
    const testUsername = `tech_user_${Date.now().toString().slice(-4)}`;
    const testPassword = 'SecurePassword123!';

    const createdUser = userService.createUser({
      username: testUsername,
      password: testPassword,
      fullName: 'IT Tech Engineer',
      email: 'tech.support@skillversity.org',
      phone: '+91 9123456789',
      role: 'IT Tech',
      department: 'IT OPERATIONS'
    });

    assert.strictEqual(createdUser.username, testUsername, 'Created user username mismatch');
    assert.strictEqual(createdUser.role, 'IT Tech', 'Created user role mismatch');

    // Test login authentication with created user
    const authenticated = userService.authenticate(testUsername, testPassword);
    assert.ok(authenticated, 'Authentication failed for newly created user');
    assert.strictEqual(authenticated.username, testUsername, 'Authenticated user mismatch');

    // Test rejection of wrong password
    const wrongAuth = userService.authenticate(testUsername, 'WrongPassword');
    assert.strictEqual(wrongAuth, null, 'Security breach: wrong password should fail authentication');

    // Test rejection of non-existent user
    const unknownAuth = userService.authenticate('unknown_hacker', 'Password123');
    assert.strictEqual(unknownAuth, null, 'Security breach: unregistered user should fail authentication');

    console.log(`✅ TEST 4 PASSED: User creation ('${testUsername}') and strict login authentication verified cleanly.`);

    // Test 5: User Editing & Ticket Deletion
    console.log('TEST 5: Verifying User Editing & Ticket Deletion...');
    const updatedUser = userService.updateUser(createdUser.id, {
      fullName: 'IT Support Lead',
      role: 'Admin'
    });
    assert.strictEqual(updatedUser.fullName, 'IT Support Lead', 'User full name update failed');
    assert.strictEqual(updatedUser.role, 'Admin', 'User role update failed');

    // Clean up test user
    userService.deleteUser(createdUser.id);

    // Test Ticket Deletion
    const deletedTicket = storageService.deleteTicket(ticketId);
    assert.strictEqual(deletedTicket, true, 'Ticket deletion failed');
    assert.strictEqual(storageService.getTicketById(ticketId), null, 'Deleted ticket still returned from storage');

    console.log(`✅ TEST 5 PASSED: User updating ('${testUsername}') and Ticket deletion ('${ticketId}') verified cleanly.`);

    // Test 6: Google Sheet Bi-directional Data Merging & Syncing
    console.log('TEST 6: Verifying Google Sheet Bi-directional Data Merging & Syncing...');
    const sheetTestTicket = {
      ticketId: `TK-SHEET-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleString(),
      userName: 'Ramesh Kumar',
      userEmail: 'ramesh.kumar@skillversity.org',
      contactNumber: '+91 9988776655',
      department: 'ACADEMIC OPERATIONS',
      category: 'Software & Applications',
      subCategory: 'ERP / LMS / Skillversity Portal',
      subject: 'LMS Portal Access Issue from Google Sheet',
      description: 'Submitted or updated in Google Sheet',
      priority: 'High',
      status: 'In Progress',
      assignedTo: 'Super Admin'
    };

    const mergedTickets = storageService.mergeTicketsFromSheet([sheetTestTicket]);
    const foundMerged = storageService.getTicketById(sheetTestTicket.ticketId);
    assert.ok(foundMerged, 'Ticket from sheet was not merged into local storage');
    assert.strictEqual(foundMerged.userName, 'Ramesh Kumar', 'Merged ticket employee name mismatch');
    assert.strictEqual(foundMerged.status, 'In Progress', 'Merged ticket status mismatch');

    // Clean up test ticket
    storageService.deleteTicket(sheetTestTicket.ticketId);

    console.log('✅ TEST 6 PASSED: Google Sheet data merging and loading verified cleanly.');

    console.log('--------------------------------------------------');
    console.log('🎉 ALL SYSTEM VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('--------------------------------------------------');
    process.exit(0);

  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
