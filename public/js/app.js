// Skillversity IT Support & Complaint Management Application Script

let globalGmailComposeUrl = '';

const subCategoryMap = {
  'IT Hardware & Devices': [
    'Laptop / PC',
    'Monitor / TV / Display',
    'Keyboard / Mouse / Peripherals',
    'Printer / Scanner',
    'Mobile / Headphone / Audio'
  ],
  'Software & Applications': [
    'Operating System Error',
    'MS Office / Email / Outlook',
    'ERP / LMS / Skillversity Portal',
    'Software License & Install Request',
    'App Crash / Error Message'
  ],
  'Network & Connectivity': [
    'Wi-Fi Connection Issue',
    'Ethernet / LAN Cable Issue',
    'VPN / Remote Access Failure',
    'Slow Internet Speed',
    'IP Blocked / Firewall Issue'
  ],
  'Access & Passwords': [
    'Password Reset Request',
    'Account Locked / Unblock',
    'Folder / Shared Drive Permissions',
    'Multi-Factor Authentication (MFA)',
    'Role & System Access Privilege'
  ],
  'Facilities & Maintenance': [
    'Air Conditioning / HVAC',
    'Electrical Power / UPS Socket',
    'Desk / Chair Furniture Maintenance',
    'Lab / Meeting Room Booking',
    'Cleanliness & Workplace Safety'
  ],
  'General Service & Other': [
    'General Inquiry',
    'System Improvement Suggestion',
    'Vendor / Procurement Request',
    'Other Service Request'
  ]
};

function updateSubcategories() {
  const categoryEl = document.getElementById('category');
  const subCategoryEl = document.getElementById('subCategory');

  if (!categoryEl || !subCategoryEl) return;

  const selectedCat = categoryEl.value;
  subCategoryEl.innerHTML = '';

  if (!selectedCat || !subCategoryMap[selectedCat]) {
    subCategoryEl.innerHTML = '<option value="">Select Category First...</option>';
    return;
  }

  const options = subCategoryMap[selectedCat];
  subCategoryEl.innerHTML = '<option value="">Select Subcategory...</option>' +
    options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
}

// Priority Matrix calculation
function calculatePriority(impact, urgency) {
  if (impact === 'Critical' || urgency === 'Critical') return 'Critical';
  if (impact === 'High' && urgency === 'High') return 'Critical';
  if (impact === 'High' || urgency === 'High') return 'High';
  if (impact === 'Medium' || urgency === 'Medium') return 'Medium';
  return 'Low';
}

function updatePriorityPreview() {
  const impactEl = document.getElementById('impact');
  const urgencyEl = document.getElementById('urgency');
  const badgeEl = document.getElementById('priority-preview-badge');

  if (!impactEl || !urgencyEl || !badgeEl) return;

  const prio = calculatePriority(impactEl.value, urgencyEl.value);
  badgeEl.textContent = prio.toUpperCase();
  badgeEl.className = `badge badge-priority-${prio.toLowerCase()}`;
}

// Fetch Next Ticket ID & Date Preview
async function fetchNextTicketId() {
  const previewEl = document.getElementById('ticket-id-preview');
  const datePreviewEl = document.getElementById('ticket-date-preview');
  const ticketDateEl = document.getElementById('ticketDate');

  const currentDateStr = new Date().toLocaleString();
  if (datePreviewEl) datePreviewEl.textContent = `Date: ${currentDateStr}`;
  if (ticketDateEl) ticketDateEl.value = currentDateStr;

  if (!previewEl) return;

  try {
    const res = await fetch('/api/complaints/next-id');
    const data = await res.json();
    if (data.success && data.nextTicketId) {
      previewEl.textContent = data.nextTicketId;
    }
  } catch (e) {
    console.warn('Could not fetch next ticket ID');
  }
}

// Preview Attached Files
function previewFiles(input) {
  const listEl = document.getElementById('file-preview-list');
  if (!listEl) return;

  listEl.innerHTML = '';
  const files = Array.from(input.files || []);

  if (files.length === 0) return;

  files.forEach(file => {
    const chip = document.createElement('div');
    chip.className = 'file-preview-chip';

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    const icon = isImage ? '🖼️' : isVideo ? '🎥' : '📁';
    const sizeKb = (file.size / 1024).toFixed(1);

    chip.innerHTML = `<span>${icon}</span> <strong>${file.name}</strong> <span style="color:#64748b;">(${sizeKb} KB)</span>`;
    listEl.appendChild(chip);
  });
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> ${message}`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Modal Helpers
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

// Submit Ticket Handling
const complaintForm = document.getElementById('complaintForm');
if (complaintForm) {
  complaintForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await processFormSubmission(true);
  });
}

async function processFormSubmission(openGmail = true) {
  const form = document.getElementById('complaintForm');
  const submitBtn = document.getElementById('submitBtn');

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Submitting Ticket...';

  const formData = new FormData(form);

  try {
    const res = await fetch('/api/complaints', {
      method: 'POST',
      body: formData
    });

    const result = await res.json();

    if (res.ok && result.success) {
      showToast(`Ticket #${result.ticket.ticketId} logged successfully!`, 'success');
      globalGmailComposeUrl = result.gmailComposeUrl;

      form.reset();
      updatePriorityPreview();
      fetchNextTicketId();

      // Show Success Modal
      const bodyEl = document.getElementById('successModalBody');
      if (bodyEl) {
        bodyEl.innerHTML = `
          <div style="background: #eff6ff; padding: 16px; border-radius: 8px; border-left: 4px solid #2563eb; margin-bottom: 16px;">
            <div style="font-size: 0.85rem; color: #64748b; font-weight: 700;">YOUR SKILLVERSITY TICKET NUMBER</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #0f172a; font-family: monospace;">#${result.ticket.ticketId}</div>
          </div>
          
          <table style="width: 100%; font-size: 0.9rem; margin-bottom: 16px;">
            <tr><td><strong>Registration Date:</strong></td><td>${result.ticket.date}</td></tr>
            <tr><td><strong>Employee:</strong></td><td>${result.ticket.userName} (${result.ticket.userEmail})</td></tr>
            <tr><td><strong>Mobile Number:</strong></td><td>📞 ${result.ticket.userPhone || result.ticket.contactNumber || 'N/A'}</td></tr>
            <tr><td><strong>Department:</strong></td><td>${result.ticket.department}</td></tr>
            <tr><td><strong>Category:</strong></td><td>${result.ticket.category} (${result.ticket.subCategory || 'General'})</td></tr>
            <tr><td><strong>Priority:</strong></td><td><span class="badge badge-priority-${result.ticket.priority.toLowerCase()}">${result.ticket.priority}</span></td></tr>
          </table>
        `;
        openModal('successModal');
      }

      if (openGmail && result.gmailComposeUrl) {
        window.open(result.gmailComposeUrl, '_blank');
      }

    } else {
      showToast(result.error || 'Failed to submit complaint', 'error');
    }
  } catch (err) {
    showToast('Network error while submitting ticket', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Submit Ticket';
  }
}

function openGmailTab() {
  if (globalGmailComposeUrl) {
    window.open(globalGmailComposeUrl, '_blank');
  } else {
    showToast('Gmail compose link not available', 'error');
  }
}

// Track / Lookup Ticket
async function lookupTicket() {
  const input = document.getElementById('lookup-input');
  const resultEl = document.getElementById('lookup-result');

  if (!input || !input.value.trim()) {
    showToast('Please enter a Ticket ID or Email', 'error');
    return;
  }

  const query = input.value.trim();
  resultEl.style.display = 'block';
  resultEl.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Searching...</div>';

  try {
    const res = await fetch(`/api/complaints?search=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.tickets && data.tickets.length > 0) {
      const html = data.tickets.map(t => {
        const mediaHtml = t.attachments && t.attachments.length > 0
          ? t.attachments.map(a => `
              <a href="${a.url}" target="_blank" style="display:inline-block; margin-right:6px; font-size:0.75rem; color:#2563eb;">
                ${a.mimeType.startsWith('image/') ? '🖼️' : '🎥'} ${a.originalName}
              </a>
            `).join('')
          : '';

        return `
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 700; font-family: monospace; color:#2563eb;">#${t.ticketId}</span>
              <span class="badge badge-${t.status.toLowerCase().replace(/ /g, '-')}">${t.status}</span>
            </div>
            <div style="font-size: 0.85rem; font-weight: 600; color: #1e293b;">${t.subject}</div>
            <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">
              Date: ${t.date || 'N/A'} | Contact: 📞 ${t.userPhone || t.contactNumber || 'N/A'}
            </div>
            <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
              Dept: ${t.department} | Category: ${t.category} (${t.subCategory || 'General'}) | Priority: ${t.priority}
            </div>
            ${mediaHtml ? `<div style="margin-top:6px;"><strong>Files:</strong> ${mediaHtml}</div>` : ''}
            ${t.assignedTo ? `<div style="font-size: 0.75rem; color: #2563eb; margin-top: 4px;">Assigned To: ${t.assignedTo}</div>` : ''}
            ${t.troubleshootingNotes ? `
              <div style="background: #f1f5f9; padding: 8px; border-radius: 4px; font-size: 0.8rem; margin-top: 8px;">
                <strong>Skillversity IT Action Notes:</strong> ${t.troubleshootingNotes}
              </div>
            ` : ''}
            ${t.status === 'Resolved' && !t.userConfirmed ? `
              <button class="btn btn-primary btn-sm" style="margin-top: 8px; width: 100%;" onclick="confirmResolution('${t.ticketId}')">
                ✅ Confirm Issue Fixed & Close Ticket
              </button>
            ` : ''}
          </div>
        `;
      }).join('');
      resultEl.innerHTML = html;
    } else {
      resultEl.innerHTML = '<div style="color: var(--danger); font-size: 0.85rem;">No ticket found matching your query.</div>';
    }
  } catch (err) {
    resultEl.innerHTML = '<div style="color: var(--danger); font-size: 0.85rem;">Error loading ticket status.</div>';
  }
}

// User Resolution Confirmation
async function confirmResolution(ticketId) {
  try {
    const res = await fetch(`/api/complaints/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Closed',
        userConfirmed: true,
        updatedBy: 'User Confirmation'
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Resolution confirmed for #${ticketId}. Ticket is now Closed.`, 'success');
      lookupTicket();
    }
  } catch (err) {
    showToast('Failed to confirm resolution', 'error');
  }
}

// Admin Logout
function logoutAdmin() {
  const token = localStorage.getItem('skillversity_token');
  if (token) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }
  localStorage.removeItem('skillversity_token');
  showToast('Logged out', 'info');
  window.location.href = 'login.html';
}

// Diagnostics Modal
async function openSystemModal() {
  openModal('systemModal');
  const statusEl = document.getElementById('systemStatusCheck');
  if (!statusEl) return;

  statusEl.innerHTML = 'Checking server and integration status...';
  try {
    const res = await fetch('/api/system/status');
    const data = await res.json();
    if (data.success) {
      statusEl.innerHTML = `
        <strong>Skillversity Diagnostic Summary:</strong><br>
        • Localhost Server URL: http://localhost:${data.environment.port}<br>
        • Port: ${data.environment.port}<br>
        • Target Email: skillversitycomplaints@gmail.com<br>
        • Google Apps Script Sync: ${data.environment.googleAppsScriptConfigured ? '🟢 Active' : '🟡 Pending (.env URL)'}<br>
        • Direct Google Sheets API: ${data.environment.googleSheetsApiConfigured ? '🟢 Active' : '⚪ Not Set'}<br>
        • SMTP Mail Server: ${data.environment.smtpConfigured ? '🟢 Active' : '⚪ Not Set'}<br>
        • Total Tickets Recorded: ${data.totalTicketsLogged}
      `;
    }
  } catch (err) {
    statusEl.innerHTML = 'Unable to fetch diagnostic status.';
  }
}

// Check Session Validity & Update User Profile Badge
async function checkAdminSession() {
  const token = localStorage.getItem('skillversity_token');
  if (!token) return false;

  try {
    const res = await fetch('/api/auth/session', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.authenticated && data.user) {
      const userBadge = document.getElementById('current-user-badge');
      if (userBadge) {
        userBadge.textContent = `👤 ${data.user.fullName || data.user.username}`;
      }
      return true;
    } else {
      localStorage.removeItem('skillversity_token');
      window.location.href = 'login.html';
      return false;
    }
  } catch (err) {
    return false;
  }
}

// Dashboard Functions & Interactive Tile Filtering
let allDashboardTickets = [];

async function loadDashboard() {
  const tbody = document.getElementById('tickets-table-body');
  if (!tbody) return;

  await checkAdminSession();
  const token = localStorage.getItem('skillversity_token');

  tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 30px;">Loading ticket records...</td></tr>';

  try {
    const [ticketsRes, statsRes] = await Promise.all([
      fetch('/api/complaints', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('/api/complaints/stats', { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    if (ticketsRes.status === 401 || statsRes.status === 401) {
      localStorage.removeItem('skillversity_token');
      window.location.href = 'login.html';
      return;
    }

    const ticketsData = await ticketsRes.json();
    const statsData = await statsRes.json();

    if (ticketsData.success) {
      allDashboardTickets = ticketsData.tickets;
      renderTable(allDashboardTickets);
    }

    if (statsData.success && statsData.stats) {
      const s = statsData.stats;
      document.getElementById('stat-total').textContent = s.total || 0;
      document.getElementById('stat-open').textContent = s.open || 0;
      document.getElementById('stat-in-progress').textContent = s.inProgress || 0;
      document.getElementById('stat-vendor').textContent = s.pendingVendor || 0;
      document.getElementById('stat-resolved').textContent = (s.resolved || 0) + (s.closed || 0);
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--danger);">Failed to load dashboard data.</td></tr>';
  }
}

// Click on KPI Tile to filter dashboard table
function filterByStatCard(status) {
  const statusSelect = document.getElementById('dash-status');
  if (statusSelect) {
    statusSelect.value = status;
  }

  document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active-tile'));
  
  if (!status) {
    document.getElementById('tile-all')?.classList.add('active-tile');
  } else if (status === 'Open') {
    document.getElementById('tile-open')?.classList.add('active-tile');
  } else if (status === 'In Progress') {
    document.getElementById('tile-in-progress')?.classList.add('active-tile');
  } else if (status === 'Pending Vendor') {
    document.getElementById('tile-pending-vendor')?.classList.add('active-tile');
  } else if (status === 'Resolved') {
    document.getElementById('tile-resolved')?.classList.add('active-tile');
  }

  filterDashboard();
}

function renderTable(tickets) {
  const tbody = document.getElementById('tickets-table-body');
  const countBadge = document.getElementById('ticket-count-badge');
  if (!tbody) return;

  if (countBadge) countBadge.textContent = `${tickets.length} Tickets`;

  if (tickets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">No complaint records found matching current filter.</td></tr>';
    return;
  }

  tbody.innerHTML = tickets.map(t => {
    const statusClass = t.status.toLowerCase().replace(/ /g, '-');
    const priorityClass = t.priority.toLowerCase();

    return `
      <tr>
        <td style="white-space: nowrap;"><strong style="font-family: monospace; color: #2563eb; font-size: 0.9rem;">${t.ticketId}</strong></td>
        <td style="font-size: 0.8rem; color: #64748b; white-space: nowrap;">${t.date}</td>
        <td>
          <div style="font-weight: 600;">${t.userName}</div>
          <div style="font-size: 0.75rem; color: #64748b;">${t.userEmail}</div>
          <div style="font-size: 0.75rem; color: #2563eb; font-weight: 500;">📞 ${t.userPhone || t.contactNumber || 'N/A'}</div>
        </td>
        <td style="white-space: nowrap; font-size: 0.85rem;">${t.department}</td>
        <td>
          <div style="font-weight:600; font-size: 0.8rem;">${t.category}</div>
          <div style="font-size: 0.75rem; color:#64748b;">${t.subCategory || 'General'}</div>
        </td>
        <td><span class="badge badge-priority-${priorityClass}">${t.priority}</span></td>
        <td><span class="badge badge-${statusClass}">${t.status}</span></td>
        <td style="font-weight: 600; font-size: 0.85rem;">${t.assignedTo || '<span style="color:#94a3b8">Unassigned</span>'}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-outline btn-sm" onclick="openEditModal('${t.ticketId}')">Edit / Resolve ✏️</button>
            <button class="btn btn-outline btn-sm" style="color: #ef4444; border-color: #fca5a5;" onclick="deleteTicketRecord('${t.ticketId}')">Delete 🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterDashboard() {
  const q = (document.getElementById('dash-search')?.value || '').toLowerCase();
  const status = document.getElementById('dash-status')?.value || '';
  const priority = document.getElementById('dash-priority')?.value || '';
  const dept = document.getElementById('dash-department')?.value || '';

  let filtered = allDashboardTickets;

  if (status) {
    if (status === 'Resolved') {
      filtered = filtered.filter(t => t.status === 'Resolved' || t.status === 'Closed');
    } else {
      filtered = filtered.filter(t => t.status === status);
    }
  }

  if (priority) filtered = filtered.filter(t => t.priority === priority);
  if (dept) filtered = filtered.filter(t => t.department === dept);
  if (q) {
    filtered = filtered.filter(t => 
      t.ticketId.toLowerCase().includes(q) ||
      t.userName.toLowerCase().includes(q) ||
      (t.userPhone && t.userPhone.toLowerCase().includes(q)) ||
      (t.contactNumber && t.contactNumber.toLowerCase().includes(q)) ||
      (t.date && t.date.toLowerCase().includes(q)) ||
      t.subject.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.category && t.category.toLowerCase().includes(q)) ||
      (t.subCategory && t.subCategory.toLowerCase().includes(q)) ||
      (t.assignedTo && t.assignedTo.toLowerCase().includes(q)) ||
      (t.vendorTicketRef && t.vendorTicketRef.toLowerCase().includes(q))
    );
  }

  renderTable(filtered);
}

// Preview Ticket Media Attachments
function previewTicketMedia(ticketId) {
  const ticket = allDashboardTickets.find(t => t.ticketId === ticketId);
  if (!ticket || !ticket.attachments || ticket.attachments.length === 0) return;

  const titleEl = document.getElementById('mediaModalTitle');
  const bodyEl = document.getElementById('mediaModalBody');

  titleEl.textContent = `Attached Media - #${ticket.ticketId}`;
  
  bodyEl.innerHTML = ticket.attachments.map(a => {
    if (a.mimeType.startsWith('image/')) {
      return `
        <div style="margin-bottom: 20px;">
          <div style="font-weight: 600; margin-bottom: 6px;">${a.originalName}</div>
          <img src="${a.url}" alt="${a.originalName}" style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #cbd5e1;">
          <div><a href="${a.url}" target="_blank" class="btn btn-outline btn-sm" style="margin-top:6px;">Open Full Image ↗</a></div>
        </div>
      `;
    } else if (a.mimeType.startsWith('video/')) {
      return `
        <div style="margin-bottom: 20px;">
          <div style="font-weight: 600; margin-bottom: 6px;">${a.originalName}</div>
          <video controls style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #cbd5e1;">
            <source src="${a.url}" type="${a.mimeType}">
            Your browser does not support the video tag.
          </video>
          <div><a href="${a.url}" target="_blank" class="btn btn-outline btn-sm" style="margin-top:6px;">Open Video ↗</a></div>
        </div>
      `;
    } else {
      return `
        <div style="margin-bottom: 12px; padding: 10px; background: #f1f5f9; border-radius: 6px;">
          <a href="${a.url}" target="_blank" style="font-weight: 600; color: #2563eb;">${a.originalName}</a>
        </div>
      `;
    }
  }).join('');

  openModal('mediaModal');
}

// Open Ticket Edit Modal
async function openEditModal(ticketId) {
  const ticket = allDashboardTickets.find(t => t.ticketId === ticketId);
  if (!ticket) return;

  document.getElementById('edit-ticket-id').value = ticket.ticketId;
  document.getElementById('editModalTitle').textContent = `Manage Ticket #${ticket.ticketId}`;
  document.getElementById('edit-subject').textContent = ticket.subject;
  document.getElementById('edit-description').textContent = ticket.description;
  document.getElementById('edit-user-info').textContent = `${ticket.userName} (${ticket.userEmail} | 📞 ${ticket.userPhone || ticket.contactNumber || 'N/A'}) - ${ticket.department} | Date: ${ticket.date} | Category: ${ticket.category} (${ticket.subCategory || 'General'})`;

  document.getElementById('edit-status').value = ticket.status;
  document.getElementById('edit-priority').value = ticket.priority;
  document.getElementById('edit-vendorRef').value = ticket.vendorTicketRef || '';
  document.getElementById('edit-troubleshooting').value = ticket.troubleshootingNotes || '';

  // Populate Assigned Personnel Dropdown dynamically from system users
  const assignedSelect = document.getElementById('edit-assignedTo');
  if (assignedSelect) {
    assignedSelect.innerHTML = '<option value="Unassigned">Unassigned</option>';
    try {
      const token = localStorage.getItem('skillversity_token');
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.users) {
        data.users.forEach(u => {
          const userVal = u.fullName || u.username;
          const opt = document.createElement('option');
          opt.value = userVal;
          opt.textContent = userVal;
          assignedSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.warn('Could not load user list for assigned dropdown');
    }

    const currentAssigned = ticket.assignedTo || 'Unassigned';
    const exists = Array.from(assignedSelect.options).some(o => o.value === currentAssigned);
    if (!exists && currentAssigned) {
      const opt = document.createElement('option');
      opt.value = currentAssigned;
      opt.textContent = currentAssigned;
      assignedSelect.appendChild(opt);
    }
    assignedSelect.value = currentAssigned;
  }

  // Render attachments in edit modal
  const attachContainer = document.getElementById('edit-attachments-container');
  if (attachContainer) {
    if (ticket.attachments && ticket.attachments.length > 0) {
      attachContainer.innerHTML = `
        <strong>Attached Media Files (${ticket.attachments.length}):</strong>
        <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px;">
          ${ticket.attachments.map(a => `
            <a href="${a.url}" target="_blank" style="padding: 4px 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem; text-decoration: none; color: #2563eb; display: inline-flex; align-items: center; gap: 4px;">
              ${a.originalName}
            </a>
          `).join('')}
        </div>
      `;
    } else {
      attachContainer.innerHTML = '<span style="color: #94a3b8; font-size: 0.85rem;">No media files attached.</span>';
    }
  }

  // Render audit trail if exists
  const auditEl = document.getElementById('edit-audit-log');
  if (auditEl && ticket.auditTrail) {
    auditEl.innerHTML = `<strong>Audit Trail:</strong><br>` + 
      ticket.auditTrail.map(a => `• ${new Date(a.timestamp).toLocaleString()} [${a.updatedBy}]: ${a.changes.join(', ')}`).join('<br>');
  } else if (auditEl) {
    auditEl.innerHTML = '';
  }

  openModal('editTicketModal');
}

// Save Ticket Update
async function saveTicketUpdate(e) {
  e.preventDefault();
  const ticketId = document.getElementById('edit-ticket-id').value;
  const token = localStorage.getItem('skillversity_token');
  
  const updateData = {
    status: document.getElementById('edit-status').value,
    priority: document.getElementById('edit-priority').value,
    assignedTo: document.getElementById('edit-assignedTo').value,
    vendorTicketRef: document.getElementById('edit-vendorRef').value,
    troubleshootingNotes: document.getElementById('edit-troubleshooting').value,
    updatedBy: 'Skillversity IT Admin'
  };

  try {
    const res = await fetch(`/api/complaints/${ticketId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(`Ticket #${ticketId} updated successfully!`, 'success');
      closeModal('editTicketModal');
      loadDashboard();
    } else {
      showToast(result.error || 'Failed to update ticket', 'error');
    }
  } catch (err) {
    showToast('Error sending ticket update', 'error');
  }
}

// Export to CSV
function exportToCSV() {
  if (allDashboardTickets.length === 0) {
    showToast('No ticket records to export', 'error');
    return;
  }

  const headers = ['Ticket ID', 'Date', 'Employee Name', 'Email', 'Mobile Number', 'Department', 'Category', 'Subcategory', 'Impact', 'Urgency', 'Priority', 'Status', 'Assigned To', 'Vendor Ref', 'Subject', 'Description', 'Troubleshooting Notes', 'Attached Files'];
  
  const csvRows = [headers.join(',')];

  allDashboardTickets.forEach(t => {
    const attachUrls = t.attachments ? t.attachments.map(a => a.url).join('; ') : '';
    const row = [
      `"${t.ticketId}"`,
      `"${t.date}"`,
      `"${t.userName}"`,
      `"${t.userEmail || ''}"`,
      `"${t.userPhone || t.contactNumber || ''}"`,
      `"${t.department}"`,
      `"${t.category}"`,
      `"${t.subCategory || 'General'}"`,
      `"${t.impact}"`,
      `"${t.urgency}"`,
      `"${t.priority}"`,
      `"${t.status}"`,
      `"${t.assignedTo || ''}"`,
      `"${t.vendorTicketRef || ''}"`,
      `"${(t.subject || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${(t.troubleshootingNotes || '').replace(/"/g, '""')}"`,
      `"${attachUrls}"`
    ];
    csvRows.push(row.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', `Skillversity_Tickets_Report_${new Date().toISOString().slice(0,10)}.csv`);
  a.click();
  showToast('CSV export downloaded!', 'success');
}

// User Management Functions
async function openUserManagementModal() {
  openModal('userManagementModal');
  await loadUsers();
}

async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  const countBadge = document.getElementById('user-count-badge');
  if (!tbody) return;

  const token = localStorage.getItem('skillversity_token');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Loading registered user accounts...</td></tr>';

  try {
    const res = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && data.users) {
      if (countBadge) countBadge.textContent = `${data.users.length} Users`;

      if (data.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--text-muted);">No users found.</td></tr>';
        return;
      }

      tbody.innerHTML = data.users.map(u => `
        <tr>
          <td style="white-space: nowrap;"><strong style="font-family: monospace; color: #2563eb;">${u.username}</strong></td>
          <td style="font-weight: 500; min-width: 140px;">${u.fullName || u.username}</td>
          <td style="font-size: 0.85rem; color: #475569;">${u.email || '-'}</td>
          <td style="font-size: 0.85rem; color: #2563eb; white-space: nowrap;">📞 ${u.phone || '-'}</td>
          <td style="white-space: nowrap;"><span class="badge badge-open" style="background:#ede9fe; color:#6d28d9; font-weight: 600;">${u.role}</span></td>
          <td style="white-space: nowrap;"><span style="font-size: 0.85rem; color: #475569; font-weight: 500;">${u.department || 'IT'}</span></td>
          <td style="font-size: 0.8rem; color: #64748b; white-space: nowrap;">${new Date(u.createdAt).toLocaleDateString()}</td>
          <td style="white-space: nowrap; text-align: center;">
            <div style="display: flex; gap: 6px; justify-content: center;">
              <button class="btn btn-outline btn-sm" onclick="openEditUserModal('${u.id}')">Edit ✏️</button>
              <button class="btn btn-outline btn-sm" style="color: #ef4444; border-color: #fca5a5;" onclick="deleteUser('${u.id}', '${u.username}')">Delete 🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--danger);">Failed to load user list.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--danger);">Network error loading users.</td></tr>';
  }
}

async function syncUsersToSheet() {
  const syncBtn = document.getElementById('btn-sync-users-modal');
  const originalText = syncBtn ? syncBtn.innerHTML : '📊 Sync with Sheet';

  const token = localStorage.getItem('skillversity_token');
  if (!token) {
    showToast('Authentication required. Please log in as Admin first.', 'error');
    return;
  }

  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.innerHTML = 'Syncing... ⏳';
  }

  try {
    const res = await fetch('/api/users/sync-sheet', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(res.status === 401 ? 'Session expired. Please log in again.' : 'Server returned non-JSON response.');
    }

    const data = await res.json();
    if (res.ok && data.success) {
      const detail = data.result && data.result.message ? ` (${data.result.message})` : '';
      showToast((data.message || 'Users synced to Google Sheet successfully!') + detail, 'success');
    } else {
      showToast('User sync failed: ' + (data.message || data.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    showToast('Error syncing users to sheet: ' + err.message, 'error');
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerHTML = originalText;
    }
  }
}

function openCreateUserModal() {
  const form = document.getElementById('createUserForm');
  if (form) form.reset();
  openModal('createUserModal');
}

async function openEditUserModal(userId) {
  const token = localStorage.getItem('skillversity_token');
  try {
    const res = await fetch(`/api/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.user) {
      const u = data.user;
      document.getElementById('edit-user-id').value = u.id;
      document.getElementById('edit-user-username').value = u.username;
      document.getElementById('edit-user-password').value = '';
      document.getElementById('edit-user-fullname').value = u.fullName || u.username;
      document.getElementById('edit-user-email').value = u.email || '';
      document.getElementById('edit-user-phone').value = u.phone || '';
      document.getElementById('edit-user-role').value = u.role || 'IT Tech';
      document.getElementById('edit-user-dept').value = u.department || 'IT OPERATIONS';

      openModal('editUserModal');
    } else {
      showToast(data.error || 'Failed to fetch user details', 'error');
    }
  } catch (err) {
    showToast('Error opening user edit modal', 'error');
  }
}

async function saveUserUpdate(e) {
  e.preventDefault();
  const userId = document.getElementById('edit-user-id').value;
  const token = localStorage.getItem('skillversity_token');

  const updateData = {
    fullName: document.getElementById('edit-user-fullname').value.trim(),
    email: document.getElementById('edit-user-email').value.trim(),
    phone: document.getElementById('edit-user-phone').value.trim(),
    role: document.getElementById('edit-user-role').value,
    department: document.getElementById('edit-user-dept').value
  };

  const pass = document.getElementById('edit-user-password').value;
  if (pass && pass.trim().length > 0) {
    updateData.password = pass.trim();
  }

  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(`User '${result.user.username}' updated successfully!`, 'success');
      closeModal('editUserModal');
      await loadUsers();
    } else {
      showToast(result.error || 'Failed to update user', 'error');
    }
  } catch (err) {
    showToast('Network error while updating user', 'error');
  }
}

async function saveNewUser(e) {
  e.preventDefault();
  const token = localStorage.getItem('skillversity_token');

  const userData = {
    username: document.getElementById('new-username').value.trim(),
    password: document.getElementById('new-password').value,
    fullName: document.getElementById('new-fullname').value.trim(),
    email: document.getElementById('new-email').value.trim(),
    phone: document.getElementById('new-phone').value.trim(),
    role: document.getElementById('new-role').value,
    department: document.getElementById('new-dept').value
  };

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(`User '${result.user.username}' created successfully!`, 'success');
      closeModal('createUserModal');
      await loadUsers();
    } else {
      showToast(result.error || 'Failed to create user', 'error');
    }
  } catch (err) {
    showToast('Network error while creating user', 'error');
  }
}

async function deleteUser(userId, username) {
  if (!confirm(`Are you sure you want to delete user account '${username}'?`)) {
    return;
  }

  const token = localStorage.getItem('skillversity_token');

  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(`User '${username}' removed.`, 'success');
      await loadUsers();
    } else {
      showToast(result.error || 'Failed to delete user', 'error');
    }
  } catch (err) {
    showToast('Error deleting user account', 'error');
  }
}

// Ticket Deletion Functions
async function deleteTicketRecord(ticketId) {
  if (!confirm(`Are you sure you want to permanently delete Ticket #${ticketId}? This action cannot be undone.`)) {
    return;
  }

  const token = localStorage.getItem('skillversity_token');

  try {
    const res = await fetch(`/api/complaints/${ticketId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(`Ticket #${ticketId} deleted successfully!`, 'success');
      loadDashboard();
    } else {
      showToast(result.error || 'Failed to delete ticket', 'error');
    }
  } catch (err) {
    showToast('Error deleting ticket record', 'error');
  }
}

function deleteTicketFromModal() {
  const ticketId = document.getElementById('edit-ticket-id').value;
  if (!ticketId) return;
  closeModal('editTicketModal');
  deleteTicketRecord(ticketId);
}

// Sync Column Headers & All Tickets with Google Sheet
async function syncWithGoogleSheet() {
  const btn = document.getElementById('btn-sync-sheet');
  const originalText = btn ? btn.innerHTML : 'Sync with Sheet 📊';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Syncing... ⏳';
  }

  showToast('Synchronizing column headers & tickets with Google Sheet...', 'info');

  try {
    const res = await fetch('/api/complaints/sync-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(result.message || 'Google Sheet synchronized successfully!', 'success');
    } else {
      showToast(result.message || result.error || 'Failed to sync with Google Sheet', 'error');
    }
  } catch (err) {
    showToast('Network error while syncing with Google Sheet', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

