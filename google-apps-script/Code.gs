/**
 * Google Apps Script for Skillversity IT Support & Employee Complaint Ticketing System
 * Features automatic deduplication by Ticket ID and Username
 */

const TARGET_EMAIL = "skillversitydev@gmail.com";

const TICKET_HEADERS = [
  "Ticket ID",
  "Date & Time",
  "Employee Name",
  "Employee Email",
  "Contact Number",
  "Department",
  "Category",
  "Subcategory",
  "Subject",
  "Description",
  "Impact",
  "Urgency",
  "Priority",
  "Status",
  "Assigned To",
  "Vendor Ticket Ref",
  "Troubleshooting Notes",
  "Last Updated",
  "Uploaded Files / Attachments"
];

const USER_HEADERS = [
  "User ID",
  "Username",
  "Full Name",
  "Email",
  "Phone",
  "Role",
  "Department",
  "Created Date",
  "Created By"
];

function getTargetSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    if (sheetName === "Tickets") {
      sheet = ss.getActiveSheet();
      if (sheet.getName() !== "Tickets") {
        sheet.setName("Tickets");
      }
    } else {
      sheet = ss.insertSheet(sheetName);
    }
  }
  return sheet;
}

function setupSheetHeaders() {
  const sheet = getTargetSheet("Tickets");
  sheet.getRange(1, 1, 1, TICKET_HEADERS.length).setValues([TICKET_HEADERS]);
  sheet.getRange(1, 1, 1, TICKET_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#2563eb")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  return "Ticket column headers updated successfully!";
}

function setupUserSheetHeaders() {
  const sheet = getTargetSheet("Users");
  sheet.getRange(1, 1, 1, USER_HEADERS.length).setValues([USER_HEADERS]);
  sheet.getRange(1, 1, 1, USER_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#8b5cf6")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  return "User column headers updated successfully!";
}

function ensureTicketHeaders(sheet) {
  setupSheetHeaders();
}

function ensureUserHeaders(sheet) {
  setupUserSheetHeaders();
}

function fetchAllDataFromSheets() {
  const ticketSheet = getTargetSheet("Tickets");
  const userSheet = getTargetSheet("Users");

  const ticketValues = ticketSheet.getDataRange().getValues();
  const userValues = userSheet.getDataRange().getValues();

  const tickets = [];
  const users = [];

  for (let i = 1; i < ticketValues.length; i++) {
    const row = ticketValues[i];
    const ticketId = row[0] ? String(row[0]).trim() : "";
    if (!ticketId) continue;

    const attachStr = row[18] ? String(row[18]).trim() : "";
    let attachments = [];
    if (attachStr && attachStr !== "None") {
      attachments = attachStr.split(',').map(u => {
        const url = u.trim();
        const filename = url.split('/').pop() || 'attachment';
        return {
          filename,
          originalName: filename,
          mimeType: filename.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image/jpeg' : (filename.match(/\.(mp4|webm|mov)$/i) ? 'video/mp4' : 'application/octet-stream'),
          url
        };
      });
    }

    tickets.push({
      ticketId: ticketId,
      date: row[1] ? String(row[1]).trim() : "",
      userName: row[2] ? String(row[2]).trim() : "",
      userEmail: row[3] ? String(row[3]).trim() : "",
      userPhone: row[4] ? String(row[4]).trim() : "",
      contactNumber: row[4] ? String(row[4]).trim() : "",
      department: row[5] ? String(row[5]).trim() : "",
      category: row[6] ? String(row[6]).trim() : "",
      subCategory: row[7] ? String(row[7]).trim() : "",
      subject: row[8] ? String(row[8]).trim() : "",
      description: row[9] ? String(row[9]).trim() : "",
      impact: row[10] ? String(row[10]).trim() : "Medium",
      urgency: row[11] ? String(row[11]).trim() : "Medium",
      priority: row[12] ? String(row[12]).trim() : "Medium",
      status: row[13] ? String(row[13]).trim() : "Open",
      assignedTo: row[14] ? String(row[14]).trim() : "Unassigned",
      vendorTicketRef: row[15] ? String(row[15]).trim() : "",
      troubleshootingNotes: row[16] ? String(row[16]).trim() : "",
      lastUpdated: row[17] ? String(row[17]).trim() : "",
      attachments: attachments
    });
  }

  for (let j = 1; j < userValues.length; j++) {
    const uRow = userValues[j];
    const username = uRow[1] ? String(uRow[1]).trim() : "";
    if (!username) continue;

    users.push({
      id: uRow[0] ? String(uRow[0]).trim() : `usr_${Date.now()}_${j}`,
      username: username,
      fullName: uRow[2] ? String(uRow[2]).trim() : username,
      email: uRow[3] ? String(uRow[3]).trim() : "",
      phone: uRow[4] ? String(uRow[4]).trim() : "",
      role: uRow[5] ? String(uRow[5]).trim() : "IT Tech",
      department: uRow[6] ? String(uRow[6]).trim() : "IT OPERATIONS",
      createdAt: uRow[7] ? String(uRow[7]).trim() : new Date().toISOString(),
      createdBy: uRow[8] ? String(uRow[8]).trim() : "System"
    });
  }

  return {
    success: true,
    message: `Fetched ${tickets.length} tickets and ${users.length} users from Google Sheet`,
    tickets: tickets,
    users: users
  };
}

function doGet(e) {
  if (e && e.parameter && (e.parameter.action === "FETCH_ALL" || e.parameter.action === "LOAD_FROM_SHEET")) {
    return ContentService.createTextOutput(JSON.stringify(fetchAllDataFromSheets()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Skillversity IT Ticketing & User Management Apps Script Endpoint Active",
    ticketHeadersCount: TICKET_HEADERS.length,
    userHeadersCount: USER_HEADERS.length
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "CREATE";

    if (action === "FETCH_ALL" || action === "LOAD_FROM_SHEET" || action === "READ_ALL") {
      return ContentService.createTextOutput(JSON.stringify(fetchAllDataFromSheets()))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // USER MANAGEMENT ACTIONS
    if (action.includes("USER")) {
      const userSheet = getTargetSheet("Users");
      ensureUserHeaders(userSheet);

      if (action === "SETUP_USER_HEADERS") {
        setupUserSheetHeaders();
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "User sheet column headers configured in Google Sheet"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      if (action === "CREATE_USER") {
        const username = data.username ? String(data.username).trim().toLowerCase() : "";
        const userId = data.id ? String(data.id).trim() : "";
        const values = userSheet.getDataRange().getValues();
        let rowIndex = -1;

        for (let i = 1; i < values.length; i++) {
          const rowId = values[i][0] ? String(values[i][0]).trim() : "";
          const rowUsername = values[i][1] ? String(values[i][1]).trim().toLowerCase() : "";
          if ((userId && rowId === userId) || (username && rowUsername === username)) {
            rowIndex = i + 1;
            break;
          }
        }

        const userRow = [
          data.id || `usr_${Date.now()}`,
          data.username || "",
          data.fullName || data.username || "",
          data.email || "",
          data.phone || "",
          data.role || "IT Tech",
          data.department || "IT OPERATIONS",
          data.createdAt || new Date().toLocaleString(),
          data.createdBy || "Admin"
        ];

        if (rowIndex !== -1) {
          userSheet.getRange(rowIndex, 1, 1, userRow.length).setValues([userRow]);
        } else {
          userSheet.appendRow(userRow);
        }

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: `User '${data.username}' synced to Google Sheet (Users tab)`
        })).setMimeType(ContentService.MimeType.JSON);
      }

      if (action === "UPDATE_USER") {
        const username = data.username ? String(data.username).trim().toLowerCase() : "";
        const userId = data.id ? String(data.id).trim() : "";
        const values = userSheet.getDataRange().getValues();
        let rowIndex = -1;

        for (let i = 1; i < values.length; i++) {
          const rowId = values[i][0] ? String(values[i][0]).trim() : "";
          const rowUsername = values[i][1] ? String(values[i][1]).trim().toLowerCase() : "";
          if ((userId && rowId === userId) || (username && rowUsername === username)) {
            rowIndex = i + 1;
            break;
          }
        }

        if (rowIndex !== -1) {
          if (data.fullName !== undefined) userSheet.getRange(rowIndex, 3).setValue(data.fullName);
          if (data.email !== undefined) userSheet.getRange(rowIndex, 4).setValue(data.email);
          if (data.phone !== undefined) userSheet.getRange(rowIndex, 5).setValue(data.phone);
          if (data.role !== undefined) userSheet.getRange(rowIndex, 6).setValue(data.role);
          if (data.department !== undefined) userSheet.getRange(rowIndex, 7).setValue(data.department);

          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: `User '${username}' updated in Google Sheet (Users tab)`
          })).setMimeType(ContentService.MimeType.JSON);
        } else {
          const userRow = [
            data.id || `usr_${Date.now()}`,
            data.username || "",
            data.fullName || data.username || "",
            data.email || "",
            data.phone || "",
            data.role || "IT Tech",
            data.department || "IT OPERATIONS",
            data.createdAt || new Date().toLocaleString(),
            data.createdBy || "Admin"
          ];
          userSheet.appendRow(userRow);
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: `User '${username}' created in Google Sheet (Users tab)`
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      if (action === "DELETE_USER") {
        const username = data.username ? String(data.username).trim().toLowerCase() : "";
        const userId = data.id ? String(data.id).trim() : "";
        const values = userSheet.getDataRange().getValues();
        let rowIndex = -1;

        for (let i = 1; i < values.length; i++) {
          const rowId = values[i][0] ? String(values[i][0]).trim() : "";
          const rowUsername = values[i][1] ? String(values[i][1]).trim().toLowerCase() : "";
          if ((userId && rowId === userId) || (username && rowUsername === username)) {
            rowIndex = i + 1;
            break;
          }
        }

        if (rowIndex !== -1) {
          userSheet.deleteRow(rowIndex);
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: `User '${username}' deleted from Google Sheet (Users tab)`
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      if (action === "SYNC_USERS") {
        const usersList = data.users || [];
        if (usersList.length === 0) {
          ensureUserHeaders(userSheet);
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: "User headers verified in Google Sheet (Existing users preserved)"
          })).setMimeType(ContentService.MimeType.JSON);
        }

        userSheet.clearContents();
        setupUserSheetHeaders();

        const seenUsernames = new Set();

        usersList.forEach(u => {
          const uKey = u.username ? String(u.username).trim().toLowerCase() : "";
          if (uKey && seenUsernames.has(uKey)) return;
          if (uKey) seenUsernames.add(uKey);

          userSheet.appendRow([
            u.id || "",
            u.username || "",
            u.fullName || u.username || "",
            u.email || "",
            u.phone || "",
            u.role || "IT Tech",
            u.department || "IT OPERATIONS",
            u.createdAt || new Date().toLocaleString(),
            u.createdBy || "System"
          ]);
        });

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: `Synced ${seenUsernames.size} unique users to Google Sheet`
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // TICKET ACTIONS
    const ticketSheet = getTargetSheet("Tickets");
    ensureTicketHeaders(ticketSheet);

    if (action === "SYNC_TICKETS" || action === "SYNC_ALL") {
      const ticketsList = data.tickets || [];
      if (ticketsList.length === 0) {
        ensureTicketHeaders(ticketSheet);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Ticket headers verified in Google Sheet (Existing tickets preserved)"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      ticketSheet.clearContents();
      setupSheetHeaders();

      const seenTicketIds = new Set();

      ticketsList.forEach(t => {
        const idKey = t.ticketId ? String(t.ticketId).trim().toLowerCase() : "";
        if (idKey && seenTicketIds.has(idKey)) return;
        if (idKey) seenTicketIds.add(idKey);

        ticketSheet.appendRow([
          t.ticketId || "",
          t.date || new Date().toLocaleString(),
          t.userName || "",
          t.userEmail || "",
          t.contactNumber || t.userPhone || "N/A",
          t.department || "",
          t.category || "",
          t.subCategory || "",
          t.subject || "",
          t.description || "",
          t.impact || "Medium",
          t.urgency || "Medium",
          t.priority || "Medium",
          t.status || "Open",
          t.assignedTo || "Unassigned",
          t.vendorTicketRef || "N/A",
          t.troubleshootingNotes || "",
          new Date().toLocaleString(),
          t.attachmentUrls || "None"
        ]);
      });

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: `Synced ${seenTicketIds.size} unique tickets to Google Sheet`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "CREATE") {
      const ticketId = data.ticketId ? String(data.ticketId).trim().toLowerCase() : "";
      const values = ticketSheet.getDataRange().getValues();
      let rowIndex = -1;

      if (ticketId) {
        for (let i = 1; i < values.length; i++) {
          const cellId = values[i][0] ? String(values[i][0]).trim().toLowerCase() : "";
          if (cellId === ticketId) {
            rowIndex = i + 1;
            break;
          }
        }
      }

      const row = [
        data.ticketId || "",
        data.date || new Date().toLocaleString(),
        data.userName || "",
        data.userEmail || "",
        data.contactNumber || data.userPhone || "N/A",
        data.department || "",
        data.category || "",
        data.subCategory || "",
        data.subject || "",
        data.description || "",
        data.impact || "Medium",
        data.urgency || "Medium",
        data.priority || "Medium",
        data.status || "Open",
        data.assignedTo || "Unassigned",
        data.vendorTicketRef || "N/A",
        data.troubleshootingNotes || "",
        new Date().toLocaleString(),
        data.attachmentUrls || "None"
      ];

      if (rowIndex !== -1) {
        ticketSheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
      } else {
        ticketSheet.appendRow(row);
      }

      sendNotificationEmail(data);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Ticket created and synced to Google Sheet + Email sent successfully",
        ticketId: data.ticketId
      })).setMimeType(ContentService.MimeType.JSON);
    } 
    
    else if (action === "UPDATE") {
      const ticketId = data.ticketId ? String(data.ticketId).trim().toLowerCase() : "";
      const values = ticketSheet.getDataRange().getValues();
      let rowIndex = -1;

      for (let i = 1; i < values.length; i++) {
        const cellId = values[i][0] ? String(values[i][0]).trim().toLowerCase() : "";
        if (cellId === ticketId) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex !== -1) {
        if (data.date !== undefined) ticketSheet.getRange(rowIndex, 2).setValue(data.date);
        if (data.userName !== undefined) ticketSheet.getRange(rowIndex, 3).setValue(data.userName);
        if (data.userEmail !== undefined) ticketSheet.getRange(rowIndex, 4).setValue(data.userEmail);
        if (data.contactNumber !== undefined || data.userPhone !== undefined) {
          ticketSheet.getRange(rowIndex, 5).setValue(data.contactNumber || data.userPhone);
        }
        if (data.department !== undefined) ticketSheet.getRange(rowIndex, 6).setValue(data.department);
        if (data.category !== undefined) ticketSheet.getRange(rowIndex, 7).setValue(data.category);
        if (data.subCategory !== undefined) ticketSheet.getRange(rowIndex, 8).setValue(data.subCategory);
        if (data.subject !== undefined) ticketSheet.getRange(rowIndex, 9).setValue(data.subject);
        if (data.description !== undefined) ticketSheet.getRange(rowIndex, 10).setValue(data.description);
        if (data.impact !== undefined) ticketSheet.getRange(rowIndex, 11).setValue(data.impact);
        if (data.urgency !== undefined) ticketSheet.getRange(rowIndex, 12).setValue(data.urgency);
        if (data.priority !== undefined) ticketSheet.getRange(rowIndex, 13).setValue(data.priority);
        if (data.status !== undefined) ticketSheet.getRange(rowIndex, 14).setValue(data.status);
        if (data.assignedTo !== undefined) ticketSheet.getRange(rowIndex, 15).setValue(data.assignedTo);
        if (data.vendorTicketRef !== undefined) ticketSheet.getRange(rowIndex, 16).setValue(data.vendorTicketRef);
        if (data.troubleshootingNotes !== undefined) ticketSheet.getRange(rowIndex, 17).setValue(data.troubleshootingNotes);
        if (data.attachmentUrls !== undefined) ticketSheet.getRange(rowIndex, 19).setValue(data.attachmentUrls);

        ticketSheet.getRange(rowIndex, 18).setValue(new Date().toLocaleString());

        if (data.status === "Resolved" && data.userEmail) {
          sendResolutionEmail(data);
        }

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: `Ticket #${data.ticketId} columns updated in Google Sheet`,
          ticketId: data.ticketId
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    else if (action === "DELETE") {
      const ticketId = data.ticketId ? String(data.ticketId).trim().toLowerCase() : "";
      const values = ticketSheet.getDataRange().getValues();
      let rowIndex = -1;

      for (let i = 1; i < values.length; i++) {
        const cellId = values[i][0] ? String(values[i][0]).trim().toLowerCase() : "";
        if (cellId === ticketId) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex !== -1) {
        ticketSheet.deleteRow(rowIndex);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Ticket row deleted from Google Sheet",
          ticketId: data.ticketId
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function sendNotificationEmail(data) {
  const recipient = data.targetEmail || TARGET_EMAIL;
  const subject = `[Skillversity Ticket #${data.ticketId}] Priority: ${data.priority} - ${data.subject}`;
  const body = `
New Skillversity Support Ticket / Employee Complaint Registered:

Ticket ID: ${data.ticketId}
Date: ${data.date}
Employee Name: ${data.userName}
Employee Email: ${data.userEmail}
Contact Number: ${data.contactNumber || data.userPhone || "N/A"}
Department: ${data.department}
Category: ${data.category} (Subcategory: ${data.subCategory || "N/A"})
Priority: ${data.priority} (Impact: ${data.impact}, Urgency: ${data.urgency})

Subject: ${data.subject}

Description:
${data.description}

Attached Files:
${data.attachmentUrls || "None"}

------------------------------------------------
Skillversity IT Support & Complaint Management System
`;

  try {
    MailApp.sendEmail(recipient, subject, body);
    
    if (data.userEmail) {
      const userSubject = `Skillversity Ticket Received [#${data.ticketId}] - ${data.subject}`;
      const userBody = `Dear ${data.userName},\n\nYour support ticket #${data.ticketId} has been successfully logged with Skillversity IT Support.\n\nSubject: ${data.subject}\nCategory: ${data.category} (${data.subCategory || "General"})\nPriority: ${data.priority}\nStatus: Open\nAttachments: ${data.attachmentUrls || "None"}\n\nOur team will review your request shortly.\n\nThank you,\nSkillversity IT Support Team`;
      MailApp.sendEmail(data.userEmail, userSubject, userBody);
    }
  } catch (e) {
    Logger.log("Email Error: " + e.toString());
  }
}

function sendResolutionEmail(data) {
  const subject = `[Skillversity Ticket Resolved #${data.ticketId}] ${data.subject}`;
  const body = `Dear ${data.userName || "User"},\n\nYour support ticket #${data.ticketId} has been marked as RESOLVED by Skillversity IT Support.\n\nResolution Details & Actions Taken:\n${data.troubleshootingNotes || "Issue resolved by IT Support."}\n\nPlease confirm resolution on the portal if your issue is fixed.\n\nThank you,\nSkillversity IT Support Team`;
  try {
    MailApp.sendEmail(data.userEmail, subject, body);
  } catch (e) {
    Logger.log("Resolution Email Error: " + e.toString());
  }
}
