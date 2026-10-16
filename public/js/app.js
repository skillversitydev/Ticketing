// Skillversity IT Support & Complaint Management Application Script

let globalGmailComposeUrl = '';

// HTML escaping helper for safe rendering
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Live Running Clock (Updates second-by-second)
function updateLiveDateTime() {
  const now = new Date();
  const formattedTime = now.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const datePreviewEl = document.getElementById('ticket-date-preview');
  const ticketDateEl = document.getElementById('ticketDate');

  if (datePreviewEl) {
    datePreviewEl.textContent = `Date: ${formattedTime}`;
  }
  if (ticketDateEl) {
    ticketDateEl.value = formattedTime;
  }
}

// Start live running clock immediately
updateLiveDateTime();
if (!window.liveClockInterval) {
  window.liveClockInterval = setInterval(updateLiveDateTime, 1000);
}

const subCategoryMap = {
  'IT Hardware & Devices': [
    'Laptop / Desktop PC',
    'Monitor / TV / Display',
    'Keyboard / Mouse / Peripherals',
    'Printer / Scanner',
    'Headset / Webcam / Audio-Visual',
    'UPS / Power Supply & Adapters'
  ],
  'Software & Applications': [
    'Operating System (Windows / macOS / Linux)',
    'MS Office 365 / Email / Outlook',
    'ERP / LMS / Skillversity Portal',
    'Software License & Installation Request',
    'Antivirus & System Security',
    'Application Error & Crash'
  ],
  'Network & Connectivity': [
    'Office Wi-Fi Connection Issue',
    'Ethernet / LAN Cable & Data Port',
    'VPN & Remote Work Access',
    'Internet Speed & Disconnection',
    'IP Blocked / Firewall Whitelisting'
  ],
  'Access & Passwords': [
    'Password Reset Request',
    'Account Locked / Unblock Request',
    'Shared Drive / Folder Permissions',
    'Multi-Factor Authentication (MFA / 2FA)',
    'Role & System Access Privileges'
  ],
  'IT Operations Support': [
    'Classroom / Meeting Room IT Setup',
    'Data Backup & File Recovery',
    'System Slowness & Diagnostics',
    'IT Asset Reallocation / Relocation',
    'Server & Cloud Services Access',
    'Hardware Repair & Vendor RMA Support'
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

// Fetch Next Ticket ID & Date Preview referencing Google Sheet
async function fetchNextTicketId(isManualOrForce = false) {
  const previewEl = document.getElementById('ticket-id-preview');
  const datePreviewEl = document.getElementById('ticket-date-preview');
  const sheetRefEl = document.getElementById('ticket-sheet-ref');
  const ticketDateEl = document.getElementById('ticketDate');
  const refreshBtn = document.getElementById('btn-refresh-ticket');

  updateLiveDateTime();

  if (!previewEl) return null;

  if (isManualOrForce && refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="refresh-icon spinning">🔄</span> <span class="refresh-text">Syncing...</span>';
  }

  try {
    const res = await fetch(`/api/complaints/next-id?refresh=true&_t=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.success && data.nextTicketId) {
      previewEl.textContent = data.nextTicketId;
      if (sheetRefEl) {
        if (data.lastSheetTicketId && data.lastSheetTicketId !== 'None (Sheet is Empty)') {
          const cleanLastId = String(data.lastSheetTicketId).replace(/^#/, '');
          sheetRefEl.innerHTML = `Ref: Last Ticket Number#<strong>${cleanLastId}</strong>`;
          sheetRefEl.title = `Last ticket recorded is #${cleanLastId}. Next is #${data.nextTicketId}.`;
          sheetRefEl.style.color = '#059669';
        } else {
          sheetRefEl.innerHTML = `Ref: Sequence Active`;
          sheetRefEl.style.color = '#2563eb';
        }
      }
      return data;
    }
  } catch (e) {
    console.warn('Could not fetch next ticket ID:', e);
    if (sheetRefEl) {
      sheetRefEl.innerHTML = `<span style="color:#b45309;">⚠️ Connecting...</span>`;
    }
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<span class="refresh-icon">🔄</span> <span class="refresh-text">Refresh</span>';
    }
  }
  return null;
}

// Auto-Refresh on Loading Web
let autoRefreshTimer = null;
async function autoRefreshOnLoad(isUserTriggered = false) {
  if (isUserTriggered) {
    showToast('Refreshing ticket sequence...', 'info');
  }

  const data = await fetchNextTicketId(isUserTriggered);

  if (isUserTriggered && data && data.nextTicketId) {
    const cleanLastId = data.lastSheetTicketId ? String(data.lastSheetTicketId).replace(/^#/, '') : '';
    const refText = cleanLastId ? ` (Last: #${cleanLastId})` : '';
    showToast(`Refreshed! Next Ticket: #${data.nextTicketId}${refText}`, 'success');
  }

  // Ensure periodic auto-refresh is active
  if (!autoRefreshTimer) {
    autoRefreshTimer = setInterval(() => {
      fetchNextTicketId(false);
    }, 15000); // Periodic auto-refresh every 15s

    // Auto-refresh when tab becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        fetchNextTicketId(false);
      }
    });

    window.addEventListener('focus', () => {
      fetchNextTicketId(false);
    });
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

  updateLiveDateTime();
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
        • Live Server URL: ${data.environment.serverUrl || window.location.origin}<br>
        • Target Email: ${data.environment.targetEmail || 'skillversitydev@gmail.com'}<br>
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
      window.currentAdminUser = data.user;
      const userBadge = document.getElementById('current-user-badge');
      if (userBadge) {
        userBadge.textContent = `👤 ${data.user.fullName || data.user.username}`;
      }

      // Strictly restrict User Management & Settings to pladmin Super Admin
      const isPladmin = data.user && (
        (data.user.username && data.user.username.toLowerCase() === 'pladmin') ||
        data.user.role === 'Super Admin'
      );

      const userMgmtBtn = document.getElementById('btn-user-mgmt');
      if (userMgmtBtn) {
        userMgmtBtn.style.display = isPladmin ? 'inline-flex' : 'none';
      }

      const settingsBtn = document.getElementById('btn-system-settings');
      if (settingsBtn) {
        settingsBtn.style.display = isPladmin ? 'inline-flex' : 'none';
      }

      // Sync with live access only to Superadmin and Admin
      const isSuperOrAdmin = data.user && (
        (data.user.username && data.user.username.toLowerCase() === 'pladmin') ||
        data.user.role === 'Superadmin' ||
        data.user.role === 'Super Admin' ||
        data.user.role === 'Admin'
      );

      const syncLiveBtn = document.getElementById('btn-sync-live');
      if (syncLiveBtn) {
        syncLiveBtn.style.display = isSuperOrAdmin ? 'inline-flex' : 'none';
      }

      // Title & label adjustment for IT Support role
      const isItSupport = data.user && data.user.role === 'IT Support';
      const tableTitle = document.getElementById('dashboard-table-title');
      if (tableTitle) {
        tableTitle.textContent = isItSupport ? 'My Assigned Support Tickets' : 'Support Tickets';
      }
      const totalLabel = document.querySelector('#tile-all .stat-label');
      if (totalLabel) {
        totalLabel.textContent = isItSupport ? 'My Assigned Tickets' : 'Total Support Tickets';
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

function updateStatsCards(tickets = []) {
  const stats = {
    total: tickets.length,
    open: 0,
    inProgress: 0,
    pendingVendor: 0,
    resolved: 0
  };

  tickets.forEach(t => {
    const s = (t.status || 'Open').trim().toLowerCase();
    if (s === 'open') stats.open++;
    else if (s === 'in progress' || s === 'in-progress') stats.inProgress++;
    else if (s === 'pending vendor' || s === 'pending-vendor') stats.pendingVendor++;
    else if (s === 'resolved' || s === 'closed') stats.resolved++;
    else stats.open++;
  });

  const totalEl = document.getElementById('stat-total');
  const openEl = document.getElementById('stat-open');
  const inProgEl = document.getElementById('stat-in-progress');
  const vendorEl = document.getElementById('stat-vendor');
  const resolvedEl = document.getElementById('stat-resolved');

  if (totalEl) totalEl.textContent = stats.total;
  if (openEl) openEl.textContent = stats.open;
  if (inProgEl) inProgEl.textContent = stats.inProgress;
  if (vendorEl) vendorEl.textContent = stats.pendingVendor;
  if (resolvedEl) resolvedEl.textContent = stats.resolved;
}

async function loadDashboard() {
  const tbody = document.getElementById('tickets-table-body');
  if (!tbody) return;

  await checkAdminSession();
  const token = localStorage.getItem('skillversity_token');

  tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 30px;">Loading ticket records...</td></tr>';

  try {
    const ticketsRes = await fetch('/api/complaints', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (ticketsRes.status === 401) {
      localStorage.removeItem('skillversity_token');
      window.location.href = 'login.html';
      return;
    }

    const ticketsData = await ticketsRes.json();

    if (ticketsData.success && Array.isArray(ticketsData.tickets)) {
      allDashboardTickets = ticketsData.tickets;

      // Ensure IT Support role only sees assigned tickets on client side as well
      if (window.currentAdminUser && window.currentAdminUser.role === 'IT Support') {
        const u = (window.currentAdminUser.username || '').trim().toLowerCase();
        const f = (window.currentAdminUser.fullName || '').trim().toLowerCase();
        allDashboardTickets = allDashboardTickets.filter(t => {
          if (!t.assignedTo) return false;
          const a = t.assignedTo.trim().toLowerCase();
          return (u && (a === u || a.includes(u))) || (f && (a === f || a.includes(f)));
        });
      }

      updateStatsCards(allDashboardTickets);
      filterDashboard();
    } else {
      updateStatsCards([]);
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--danger);">Failed to load dashboard data.</td></tr>';
  }
}

// Manual Refresh Handler (reloads latest assigned tickets and alerts "Refreshed")
async function handleRefreshClick() {
  const btn = document.getElementById('btn-refresh');
  const originalHtml = btn ? btn.innerHTML : '🔄 Refresh';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="refresh-icon spinning" style="font-size:0.9rem; margin-right:4px;">🔄</span> Refreshing...';
  }

  try {
    await loadDashboard();
    showToast('Refreshed', 'success');
  } catch (err) {
    showToast('Failed to refresh tickets', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// Auto-refresh Dashboard on Loading Web
let dashboardAutoRefreshTimer = null;
async function autoRefreshDashboardOnLoad() {
  // 1. Initial quick load from local store
  await loadDashboard();

  // 2. Fetch fresh synchronized data from Google Sheet on web load (Superadmin and Admin only)
  try {
    const isSuperOrAdmin = window.currentAdminUser && (
      (window.currentAdminUser.username && window.currentAdminUser.username.toLowerCase() === 'pladmin') ||
      window.currentAdminUser.role === 'Superadmin' ||
      window.currentAdminUser.role === 'Super Admin' ||
      window.currentAdminUser.role === 'Admin'
    );

    if (isSuperOrAdmin) {
      const token = localStorage.getItem('skillversity_token');
      const res = await fetch('/api/complaints/sync-sheet', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const result = await res.json();
      if (result.success) {
        await loadDashboard();
      }
    }
  } catch (e) {
    console.warn('Dashboard sheet sync on load notice:', e.message);
  }

  // 3. Periodic background auto-refresh every 30 seconds
  if (!dashboardAutoRefreshTimer) {
    dashboardAutoRefreshTimer = setInterval(async () => {
      if (!document.hidden) {
        await loadDashboard();
      }
    }, 30000);

    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        await loadDashboard();
      }
    });

    window.addEventListener('focus', async () => {
      await loadDashboard();
    });
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

function formatTicketDate(dateStr) {
  if (!dateStr) return '<span style="color:#94a3b8">N/A</span>';
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeStr = `${hours}:${minutes} ${ampm}`;
    return `<div style="font-weight:600; color:#1e293b; white-space:nowrap;">${day} ${month} ${year}</div><div style="font-size:0.75rem; color:#64748b; white-space:nowrap;">${timeStr}</div>`;
  }
  return `<span style="white-space:nowrap;">${escapeHtml(dateStr)}</span>`;
}

function renderTable(tickets) {
  const tbody = document.getElementById('tickets-table-body');
  const countBadge = document.getElementById('ticket-count-badge');
  if (!tbody) return;

  if (countBadge) {
    countBadge.textContent = `${tickets.length} ${tickets.length === 1 ? 'Ticket' : 'Tickets'}`;
  }

  if (tickets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">No complaint records found matching current filter.</td></tr>';
    return;
  }

  const isSuperadmin = window.currentAdminUser && (
    (window.currentAdminUser.username && window.currentAdminUser.username.toLowerCase() === 'pladmin') ||
    (window.currentAdminUser.role && (
      window.currentAdminUser.role.toLowerCase() === 'superadmin' ||
      window.currentAdminUser.role.toLowerCase() === 'super admin'
    ))
  );

  tbody.innerHTML = tickets.map(t => {
    const statusClass = t.status.toLowerCase().replace(/ /g, '-');
    const priorityClass = t.priority.toLowerCase();

    const deleteBtnHtml = isSuperadmin ? `
      <button class="action-btn action-btn-delete" onclick="deleteTicketRecord('${t.ticketId}')" title="Delete ticket (Superadmin only)">
        🗑️ Delete
      </button>
    ` : '';

    return `
      <tr>
        <td style="white-space: nowrap;"><strong style="font-family: monospace; color: #2563eb; font-size: 0.9rem;">${t.ticketId}</strong></td>
        <td style="white-space: nowrap;">${formatTicketDate(t.date)}</td>
        <td style="min-width: 150px;">
          <div style="font-weight: 600; color: #0f172a;">${escapeHtml(t.userName)}</div>
          <div style="font-size: 0.78rem; color: #64748b; word-break: break-all;">${escapeHtml(t.userEmail)}</div>
          <div style="font-size: 0.78rem; color: #2563eb; font-weight: 500; white-space: nowrap;">📞 ${escapeHtml(t.userPhone || t.contactNumber || 'N/A')}</div>
        </td>
        <td style="white-space: nowrap; font-size: 0.82rem; font-weight: 600; color: #475569;">${escapeHtml(t.department)}</td>
        <td style="min-width: 140px;">
          <div style="font-weight: 600; font-size: 0.82rem; color: #1e293b;">${escapeHtml(t.category)}</div>
          <div style="font-size: 0.78rem; color: #64748b;">${escapeHtml(t.subCategory || 'General')}</div>
        </td>
        <td style="white-space: nowrap; text-align: center;"><span class="badge badge-priority-${priorityClass}">${escapeHtml(t.priority)}</span></td>
        <td style="white-space: nowrap; text-align: center;"><span class="badge badge-${statusClass}">${escapeHtml(t.status)}</span></td>
        <td style="white-space: nowrap; font-weight: 600; font-size: 0.85rem;">${escapeHtml(t.assignedTo || '') || '<span style="color:#94a3b8">Unassigned</span>'}</td>
        <td style="white-space: nowrap; text-align: center;">
          <div class="action-btn-group">
            <button class="action-btn action-btn-edit" onclick="openEditModal('${t.ticketId}')" title="Edit / Update ticket">
              ✏️ Edit
            </button>
            ${deleteBtnHtml}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterDashboard() {
  const q = (document.getElementById('dash-search')?.value || '').trim().toLowerCase();
  const status = (document.getElementById('dash-status')?.value || '').trim().toLowerCase();
  const priority = (document.getElementById('dash-priority')?.value || '').trim().toLowerCase();
  const dept = (document.getElementById('dash-department')?.value || '').trim().toLowerCase();

  let filtered = allDashboardTickets;

  if (status) {
    if (status === 'resolved') {
      filtered = filtered.filter(t => t.status && (t.status.trim().toLowerCase() === 'resolved' || t.status.trim().toLowerCase() === 'closed'));
    } else {
      filtered = filtered.filter(t => t.status && t.status.trim().toLowerCase() === status);
    }
  }

  if (priority) {
    filtered = filtered.filter(t => t.priority && t.priority.trim().toLowerCase() === priority);
  }

  if (dept) {
    filtered = filtered.filter(t => t.department && t.department.trim().toLowerCase() === dept);
  }

  if (q) {
    filtered = filtered.filter(t => 
      (t.ticketId && t.ticketId.toLowerCase().includes(q)) ||
      (t.userName && t.userName.toLowerCase().includes(q)) ||
      (t.userPhone && t.userPhone.toLowerCase().includes(q)) ||
      (t.contactNumber && t.contactNumber.toLowerCase().includes(q)) ||
      (t.date && t.date.toLowerCase().includes(q)) ||
      (t.subject && t.subject.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
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

  // Delete button in modal: ONLY available for Superadmin
  const isSuperadmin = window.currentAdminUser && (
    (window.currentAdminUser.username && window.currentAdminUser.username.toLowerCase() === 'pladmin') ||
    (window.currentAdminUser.role && (
      window.currentAdminUser.role.toLowerCase() === 'superadmin' ||
      window.currentAdminUser.role.toLowerCase() === 'super admin'
    ))
  );

  const deleteBtnModal = document.getElementById('btn-delete-ticket-modal');
  if (deleteBtnModal) {
    deleteBtnModal.style.display = isSuperadmin ? 'inline-flex' : 'none';
  }

  // Ticket Edit is fully accessible for Superadmin, Admin, and User / IT Support
  const viewOnlyBanner = document.getElementById('ticket-viewonly-banner');
  if (viewOnlyBanner) {
    viewOnlyBanner.style.display = 'none';
  }

  ['edit-status', 'edit-priority', 'edit-assignedTo', 'edit-vendorRef', 'edit-troubleshooting'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });

  const saveBtn = document.getElementById('btn-save-ticket-update');
  if (saveBtn) {
    saveBtn.style.display = 'inline-flex';
    saveBtn.disabled = false;
  }

  openModal('editTicketModal');
}

// Save Ticket Update (Accessible to Superadmin, Admin, and User / IT Support)
async function saveTicketUpdate(e) {
  e.preventDefault();
  const ticketId = document.getElementById('edit-ticket-id').value;
  const token = localStorage.getItem('skillversity_token');
  
  const updaterName = window.currentAdminUser
    ? `${window.currentAdminUser.fullName || window.currentAdminUser.username} (${window.currentAdminUser.role || 'Staff'})`
    : 'Skillversity Staff';

  const updateData = {
    status: document.getElementById('edit-status').value,
    priority: document.getElementById('edit-priority').value,
    assignedTo: document.getElementById('edit-assignedTo').value,
    vendorTicketRef: document.getElementById('edit-vendorRef').value,
    troubleshootingNotes: document.getElementById('edit-troubleshooting').value,
    updatedBy: updaterName
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

// User Management Functions (Strictly restricted to pladmin)
async function openUserManagementModal() {
  const token = localStorage.getItem('skillversity_token');
  if (!token) {
    showToast('Authentication required. Please log in as pladmin.', 'error');
    return;
  }

  if (window.currentAdminUser) {
    const isPladmin = (window.currentAdminUser.username && window.currentAdminUser.username.toLowerCase() === 'pladmin') ||
      window.currentAdminUser.role === 'Super Admin';
    if (!isPladmin) {
      showToast('Access Restricted: Only "pladmin" Super Admin can access User Management.', 'error');
      return;
    }
  }

  openModal('userManagementModal');
  await loadUsers();
}

async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  const countBadge = document.getElementById('user-count-badge');
  if (!tbody) return;

  const token = localStorage.getItem('skillversity_token');
  if (!token) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--danger); font-weight: 600;">Authentication required. Please <a href="login.html" style="color: #2563eb; text-decoration: underline;">log in as pladmin</a>.</td></tr>';
    showToast('Please log in as pladmin.', 'error');
    return;
  }

  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">Loading registered user accounts...</td></tr>';

  try {
    const res = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--danger); font-weight: 600;">Session expired. Please <a href="login.html" style="color: #2563eb; text-decoration: underline;">log in again as pladmin</a>.</td></tr>';
      showToast('Session expired. Please log in again.', 'error');
      return;
    }

    if (res.status === 403) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--danger); font-weight: 600;">Access Denied: Only "pladmin" has access to User Management.</td></tr>';
      showToast('Access Restricted: Only "pladmin" can access User Management.', 'error');
      return;
    }

    const data = await res.json();

    if (data.success && data.users) {
      if (countBadge) countBadge.textContent = `${data.users.length} Users`;

      if (data.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--text-muted);">No users found.</td></tr>';
        return;
      }

      tbody.innerHTML = data.users.map(u => {
        const pwd = u.password || 'pladmin123';
        const isPladminUser = (u.username && u.username.toLowerCase() === 'pladmin');
        let formattedDate = '-';
        if (u.createdAt) {
          try {
            const d = new Date(u.createdAt);
            if (!isNaN(d.getTime())) formattedDate = d.toLocaleDateString();
          } catch (e) {}
        }

        return `
        <tr>
          <td style="white-space: nowrap;"><strong style="font-family: monospace; color: #2563eb; font-size: 0.95rem;">${escapeHtml(u.username)}</strong></td>
          <td style="font-weight: 500; min-width: 130px;">${escapeHtml(u.fullName || u.username)}</td>
          <td style="white-space: nowrap; background: #f8fafc;">
            <div style="display: inline-flex; align-items: center; gap: 6px;">
              <span id="pwd-val-${u.id}" class="password-text" data-password="${escapeHtml(pwd)}" data-masked="false" style="font-family: monospace; font-weight: 700; background: #ede9fe; color: #5b21b6; padding: 3px 8px; border-radius: 4px; font-size: 0.9rem; letter-spacing: 0.5px;">${escapeHtml(pwd)}</span>
              <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 0.75rem;" onclick="togglePasswordRow('${u.id}')" title="Toggle Show/Hide">👁️</button>
              <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 0.75rem;" onclick="copyPasswordToClipboard('${escapeHtml(pwd)}')" title="Copy password">📋</button>
            </div>
          </td>
          <td style="font-size: 0.85rem; color: #475569;">${escapeHtml(u.email || '-')}</td>
          <td style="font-size: 0.85rem; color: #2563eb; white-space: nowrap;">📞 ${escapeHtml(u.phone || '-')}</td>
          <td style="white-space: nowrap;"><span class="badge badge-open" style="background:#ede9fe; color:#6d28d9; font-weight: 600;">${escapeHtml(u.role)}</span></td>
          <td style="white-space: nowrap;"><span style="font-size: 0.85rem; color: #475569; font-weight: 500;">${escapeHtml(u.department || 'IT')}</span></td>
          <td style="font-size: 0.8rem; color: #64748b; white-space: nowrap;">${escapeHtml(formattedDate)}</td>
          <td style="white-space: nowrap; text-align: center;">
            <div style="display: flex; gap: 6px; justify-content: center;">
              <button class="btn btn-outline btn-sm" onclick="openEditUserModal('${u.id}')">Edit ✏️</button>
              ${isPladminUser ? '' : `<button class="btn btn-outline btn-sm" style="color: #ef4444; border-color: #fca5a5;" onclick="deleteUser('${u.id}', '${escapeHtml(u.username)}')">Delete 🗑️</button>`}
            </div>
          </td>
        </tr>
      `;
      }).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--danger);">' + escapeHtml(data.error || 'Failed to load user list.') + '</td></tr>';
    }
  } catch (err) {
    console.error('loadUsers error:', err);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--danger);">Error loading users: ${escapeHtml(err.message || 'Unknown network error')}</td></tr>`;
  }
}

async function syncUsersToSheet() {
  const syncBtn = document.getElementById('btn-sync-users-modal');
  const originalText = syncBtn ? syncBtn.innerHTML : '📊 Sync with Sheet';

  const token = localStorage.getItem('skillversity_token');
  if (!token) {
    showToast('Authentication required. Please log in as pladmin first.', 'error');
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
      await loadUsers();
      if (typeof loadDashboard === 'function') await loadDashboard();
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
  const passInput = document.getElementById('new-password');
  if (passInput) passInput.type = 'text';
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
      // Show user's current password directly in the input
      const passInput = document.getElementById('edit-user-password');
      if (passInput) {
        passInput.value = u.password || 'pladmin123';
        passInput.type = 'text';
      }
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
    if (pass.trim().length < 4) {
      showToast('Password must be at least 4 characters long.', 'error');
      return;
    }
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
      showToast(`User '${result.user.username}' password and account updated successfully!`, 'success');
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
    password: document.getElementById('new-password').value.trim(),
    fullName: document.getElementById('new-fullname').value.trim(),
    email: document.getElementById('new-email').value.trim(),
    phone: document.getElementById('new-phone').value.trim(),
    role: document.getElementById('new-role').value,
    department: document.getElementById('new-dept').value
  };

  if (userData.password.length < 4) {
    showToast('Password must be at least 4 characters long.', 'error');
    return;
  }

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
  if (username && username.toLowerCase() === 'pladmin') {
    showToast('Cannot delete the primary "pladmin" account.', 'error');
    return;
  }

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

// Password Visibility & Clipboard Helpers
function togglePasswordRow(userId) {
  const el = document.getElementById(`pwd-val-${userId}`);
  if (!el) return;
  const actual = el.getAttribute('data-password') || '';
  const isMasked = el.getAttribute('data-masked') === 'true';

  if (isMasked) {
    el.textContent = actual;
    el.setAttribute('data-masked', 'false');
  } else {
    el.textContent = '••••••••';
    el.setAttribute('data-masked', 'true');
  }
}

function copyPasswordToClipboard(pwd) {
  if (!pwd) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(pwd).then(() => {
      showToast('Password copied to clipboard! 📋', 'success');
    }).catch(() => fallbackCopy(pwd));
  } else {
    fallbackCopy(pwd);
  }
}

function fallbackCopy(text) {
  const input = document.createElement('input');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
  showToast('Password copied to clipboard! 📋', 'success');
}

function togglePasswordInput(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.textContent = '🙈';
  } else {
    input.type = 'password';
    if (btn) btn.textContent = '👁️';
  }
}

function copyPasswordFromInput(inputId) {
  const input = document.getElementById(inputId);
  if (!input || !input.value) {
    showToast('No password to copy', 'error');
    return;
  }
  copyPasswordToClipboard(input.value);
}

// Ticket Deletion Functions (Restricted strictly to Superadmin)
async function deleteTicketRecord(ticketId) {
  const isSuperadmin = window.currentAdminUser && (
    (window.currentAdminUser.username && window.currentAdminUser.username.toLowerCase() === 'pladmin') ||
    (window.currentAdminUser.role && (
      window.currentAdminUser.role.toLowerCase() === 'superadmin' ||
      window.currentAdminUser.role.toLowerCase() === 'super admin'
    ))
  );

  if (!isSuperadmin) {
    showToast('Access Denied: Only Superadmin can delete tickets.', 'error');
    return;
  }

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

// Sync Column Headers & All Tickets/Users with Google Sheet and reload data
async function syncWithGoogleSheet() {
  const btn = document.getElementById('btn-sync-live') || document.getElementById('btn-sync-sheet');
  const originalText = btn ? btn.innerHTML : '📊 Sync with Live';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="refresh-icon spinning" style="font-size:0.9rem; margin-right:4px;">🔄</span> Syncing...';
  }

  showToast('Synchronizing with Google Sheet live data...', 'info');

  const token = localStorage.getItem('skillversity_token');

  try {
    const res = await fetch('/api/complaints/sync-sheet', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(result.message || 'Live data synchronized successfully!', 'success');
      await loadDashboard();
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

// Employee / User Portal Sync & Search Helper
async function syncAndLookupTicket() {
  showToast('Refreshing...', 'info');
  try {
    await fetch('/api/complaints/sync-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    showToast('Refreshed!', 'success');
  } catch (e) {
    console.warn('Sheet sync warning:', e);
  }
  lookupTicket();
}

// Log New Ticket from Dashboard Modal
async function openCreateTicketModal() {
  const form = document.getElementById('dashCreateTicketForm');
  if (form) form.reset();

  const idBadge = document.getElementById('dash-create-ticket-id');
  if (idBadge) idBadge.textContent = 'Fetching Ticket ID...';

  openModal('createTicketModal');

  try {
    const res = await fetch(`/api/complaints/next-id?_t=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.success && data.nextTicketId) {
      if (idBadge) idBadge.textContent = data.nextTicketId;
    }
  } catch (e) {
    if (idBadge) idBadge.textContent = 'TK-2026-001';
  }
}

function updateDashSubcategories() {
  const categoryEl = document.getElementById('dash-category');
  const subCategoryEl = document.getElementById('dash-subcategory');
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

async function saveNewTicketFromDashboard(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('dash-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Generating Ticket...';
  }

  const formData = new FormData();
  formData.append('userName', document.getElementById('dash-user-name').value.trim());
  formData.append('userEmail', document.getElementById('dash-user-email').value.trim());
  formData.append('userPhone', document.getElementById('dash-user-phone').value.trim());
  formData.append('department', document.getElementById('dash-dept').value);
  formData.append('category', document.getElementById('dash-category').value);
  formData.append('subCategory', document.getElementById('dash-subcategory').value);
  formData.append('impact', document.getElementById('dash-impact').value);
  formData.append('urgency', document.getElementById('dash-urgency').value);
  formData.append('subject', document.getElementById('dash-subject').value.trim());
  formData.append('description', document.getElementById('dash-description').value.trim());

  try {
    const res = await fetch('/api/complaints', {
      method: 'POST',
      body: formData
    });

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(`New Ticket #${result.ticket.ticketId} logged successfully!`, 'success');
      closeModal('createTicketModal');
      await loadDashboard();
    } else {
      showToast(result.error || 'Failed to generate ticket', 'error');
    }
  } catch (err) {
    showToast('Network error while generating ticket', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Generate & Log Ticket';
    }
  }
}

// Open System Settings Modal
async function openSettingsModal() {
  const token = localStorage.getItem('skillversity_token');
  openModal('settingsModal');

  try {
    const [configRes, nextIdRes] = await Promise.all([
      fetch('/api/users/settings/config', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('/api/complaints/next-id')
    ]);

    const data = await configRes.json();
    const nextData = await nextIdRes.json();

    if (data.success && data.settings) {
      document.getElementById('setting-script-url').value = data.settings.googleAppsScriptUrl || '';
      document.getElementById('setting-sheet-id').value = data.settings.googleSheetId || '';
      document.getElementById('setting-target-email').value = data.settings.targetEmail || '';
    }

    if (nextData.success && nextData.nextTicketId) {
      const previewEl = document.getElementById('setting-next-ticket-preview');
      if (previewEl) previewEl.textContent = nextData.nextTicketId;
    }
  } catch (err) {
    showToast('Failed to load current settings.', 'error');
  }
}

// Reset Ticket Counter Sequence (Strictly pladmin super admin control)
async function resetTicketCounterToValue(startVal = 1001) {
  const year = new Date().getFullYear();
  const formattedVal = String(startVal).padStart(3, '0');
  if (!confirm(`Are you sure you want to restart ticket sequence counter from ${startVal}? Next generated ticket preview will be TK-${year}-${formattedVal}.`)) {
    return;
  }

  const token = localStorage.getItem('skillversity_token');
  try {
    const res = await fetch('/api/users/settings/reset-ticket-counter', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ startValue: startVal })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || `Ticket sequence counter restarted from ${startVal}!`, 'success');
      const previewEl = document.getElementById('setting-next-ticket-preview');
      if (previewEl) previewEl.textContent = data.nextTicketId;
      if (typeof fetchNextTicketId === 'function') fetchNextTicketId();
    } else {
      showToast(data.error || 'Failed to reset ticket sequence counter', 'error');
    }
  } catch (err) {
    showToast('Network error while resetting ticket counter sequence', 'error');
  }
}

async function resetTicketCounterTo001() {
  await resetTicketCounterToValue(1);
}

function applyCustomSequence() {
  const inputEl = document.getElementById('custom-sequence-input');
  if (!inputEl || !inputEl.value) {
    showToast('Please enter a sequence number', 'error');
    return;
  }
  const val = parseInt(inputEl.value, 10);
  if (isNaN(val) || val <= 0) {
    showToast('Please enter a valid sequence number', 'error');
    return;
  }
  resetTicketCounterToValue(val);
}

// Save System Settings Form
async function saveSystemSettings(e) {
  e.preventDefault();
  const token = localStorage.getItem('skillversity_token');
  const googleAppsScriptUrl = document.getElementById('setting-script-url').value;
  const googleSheetId = document.getElementById('setting-sheet-id').value;
  const targetEmail = document.getElementById('setting-target-email').value;

  try {
    const res = await fetch('/api/users/settings/config', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        googleAppsScriptUrl,
        googleSheetId,
        targetEmail
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Settings saved successfully!', 'success');
      closeModal('settingsModal');
    } else {
      showToast('Failed to save settings: ' + (data.message || data.error), 'error');
    }
  } catch (err) {
    showToast('Network error saving settings: ' + err.message, 'error');
  }
}

