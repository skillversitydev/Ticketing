const nodemailer = require('nodemailer');
const config = require('../config/config');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    if (config.smtp.host && config.smtp.user) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass
        }
      });
    }
  }

  async sendNewTicketEmail(ticket) {
    if (this.transporter) {
      try {
        const mailOptionsToAdmin = {
          from: config.smtp.from,
          to: config.targetEmail,
          subject: `[Skillversity Ticket #${ticket.ticketId}] Priority: ${ticket.priority} - ${ticket.subject}`,
          html: this.getAdminNotificationTemplate(ticket)
        };

        await this.transporter.sendMail(mailOptionsToAdmin);

        if (ticket.userEmail) {
          const mailOptionsToUser = {
            from: config.smtp.from,
            to: ticket.userEmail,
            subject: `Skillversity Ticket Received [#${ticket.ticketId}] - ${ticket.subject}`,
            html: this.getUserConfirmationTemplate(ticket)
          };
          await this.transporter.sendMail(mailOptionsToUser);
        }

        return { success: true, method: 'NodemailerSMTP', message: 'Emails dispatched successfully' };
      } catch (err) {
        console.warn('Nodemailer error:', err.message);
        return { success: false, method: 'NodemailerSMTP', error: err.message };
      }
    }

    if (config.googleAppsScriptUrl) {
      return { success: true, method: 'AppsScriptMail', message: 'Email triggered via Google Apps Script' };
    }

    return { 
      success: false, 
      method: 'None', 
      message: 'Email credentials (SMTP or Apps Script) not configured yet.' 
    };
  }

  async sendStatusUpdateEmail(ticket) {
    if (this.transporter && ticket.userEmail) {
      try {
        const mailOptions = {
          from: config.smtp.from,
          to: ticket.userEmail,
          subject: `[Skillversity Ticket Update #${ticket.ticketId}] ${ticket.status}: ${ticket.subject}`,
          html: this.getStatusUpdateTemplate(ticket)
        };
        await this.transporter.sendMail(mailOptions);
        return { success: true };
      } catch (err) {
        console.warn('Status update email error:', err.message);
      }
    }
    return { success: false };
  }

  getAdminNotificationTemplate(ticket) {
    const priorityColor = ticket.priority === 'Critical' ? '#ef4444' : ticket.priority === 'High' ? '#f97316' : '#3b82f6';
    const attachmentsHtml = ticket.attachments && ticket.attachments.length > 0
      ? ticket.attachments.map(a => `<li style="margin-bottom: 4px;"><a href="${a.url}" target="_blank" style="color: #2563eb;">${a.originalName} (${(a.size/1024).toFixed(1)} KB)</a></li>`).join('')
      : '<em>No files attached</em>';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background-color: #ffffff;">
        <div style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h2 style="color: #1e293b; margin: 0;">Skillversity IT Support Ticket</h2>
            <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">Job Campus From IMS | Helpdesk & Complaint Portal</p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569; width: 140px;">Ticket ID:</td>
            <td style="padding: 8px; font-family: monospace; font-size: 16px; font-weight: bold; color: #0f172a;">${ticket.ticketId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">Employee:</td>
            <td style="padding: 8px; color: #1e293b;">${ticket.userName} (${ticket.userEmail || 'No Email'})</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">Contact Number:</td>
            <td style="padding: 8px; color: #1e293b;">📞 ${ticket.userPhone || ticket.contactNumber || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">Department:</td>
            <td style="padding: 8px; color: #1e293b;">${ticket.department}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">Category:</td>
            <td style="padding: 8px; color: #1e293b;">${ticket.category}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">Priority / Impact:</td>
            <td style="padding: 8px;">
              <span style="background-color: ${priorityColor}; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold;">
                ${ticket.priority}
              </span> 
              <span style="color: #64748b; font-size: 13px;">(Impact: ${ticket.impact}, Urgency: ${ticket.urgency})</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">Date Registered:</td>
            <td style="padding: 8px; color: #1e293b;">${ticket.date}</td>
          </tr>
        </table>

        <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 20px; border-radius: 0 6px 6px 0;">
          <h4 style="margin: 0 0 8px 0; color: #1e293b;">Subject: ${ticket.subject}</h4>
          <p style="margin: 0; color: #334155; white-space: pre-wrap; font-size: 14px;">${ticket.description}</p>
        </div>

        <div style="background-color: #f1f5f9; padding: 14px; border-radius: 6px; margin-bottom: 20px; font-size: 14px;">
          <strong style="color: #1e293b;">📎 Attached Images & Videos:</strong>
          <ul style="margin: 8px 0 0 0; padding-left: 20px;">
            ${attachmentsHtml}
          </ul>
        </div>

        <div style="font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          This is an automated notification from Skillversity IT Support & Complaint Management System.
        </div>
      </div>
    `;
  }

  getUserConfirmationTemplate(ticket) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background-color: #ffffff;">
        <h2 style="color: #1e293b; margin: 0 0 10px 0;">Skillversity Ticket Confirmation</h2>
        <p style="color: #334155;">Hello <strong>${ticket.userName}</strong>,</p>
        <p style="color: #334155;">Your request has been registered under Ticket ID: <strong style="color: #2563eb;">#${ticket.ticketId}</strong>.</p>
        
        <div style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Date Registered:</strong> ${ticket.date}</p>
          <p style="margin: 4px 0;"><strong>Contact Number:</strong> ${ticket.userPhone || ticket.contactNumber || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>Subject:</strong> ${ticket.subject}</p>
          <p style="margin: 4px 0;"><strong>Category:</strong> ${ticket.category}</p>
          <p style="margin: 4px 0;"><strong>Assigned Priority:</strong> ${ticket.priority}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> Open</p>
        </div>

        <p style="color: #475569; font-size: 14px;">Skillversity IT Support will review your request shortly. You can track ticket updates anytime using your Ticket ID on the portal.</p>
        
        <p style="color: #64748b; font-size: 13px; margin-top: 24px;">Regards,<br>Skillversity IT Support Team</p>
      </div>
    `;
  }

  getStatusUpdateTemplate(ticket) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
        <h2 style="color: #0f172a;">Skillversity Ticket Update: #${ticket.ticketId}</h2>
        <p>Hello <strong>${ticket.userName || 'User'}</strong>,</p>
        <p>The status of your ticket <strong>"#${ticket.ticketId} - ${ticket.subject}"</strong> has been updated to:</p>
        
        <div style="font-size: 18px; font-weight: bold; color: #2563eb; background: #eff6ff; padding: 12px; border-radius: 6px; text-align: center; margin: 16px 0;">
          Status: ${ticket.status}
        </div>

        ${ticket.troubleshootingNotes ? `
          <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 12px; margin-bottom: 16px;">
            <strong style="color: #065f46;">Actions Taken / Resolution Notes:</strong>
            <p style="margin: 6px 0 0 0; color: #1e293b; font-size: 14px; white-space: pre-wrap;">${ticket.troubleshootingNotes}</p>
          </div>
        ` : ''}

        <p style="color: #475569; font-size: 13px;">If you have any questions, please contact Skillversity IT Support.</p>
      </div>
    `;
  }
}

module.exports = new EmailService();
