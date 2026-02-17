import nodemailer from 'nodemailer';

/**
 * Create a reusable SMTP transporter from environment variables.
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: (Number(process.env.SMTP_PORT) || 465) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an alert email.
 * @param {string} to - Recipient email address.
 * @param {string} subject - Email subject line.
 * @param {string} htmlBody - The HTML content of the email.
 */
export async function sendAlertEmail(to, subject, htmlBody) {
  const info = await transporter.sendMail({
    from: `"Gazebot" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: htmlBody,
  });
  console.log(`📧 Email sent to ${to} — Message ID: ${info.messageId}`);
}

/**
 * Send a confirmation email when new URLs are added to the tracker.
 * @param {string} to - Recipient email address.
 * @param {Array<string>} urls - The newly added target URLs.
 */
export async function sendNewUrlEmail(to, urls) {
  const urlRows = urls
    .map(
      (url) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;">
            <a href="${url}" style="color:#3498db;text-decoration:none;word-break:break-all;">${url}</a>
          </td>
        </tr>`,
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <h1 style="margin:0 0 4px;font-size:22px;color:#2c3e50;">🤖 Gazebot — New URL Added</h1>
        <p style="margin:0 0 20px;color:#95a5a6;font-size:13px;">${new Date().toUTCString()}</p>
        <p style="margin:0 0 16px;color:#7f8c8d;">
          The following URL(s) have been added to your Gazebot tracker:
        </p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e0e0e0;border-radius:8px;">
          <thead>
            <tr><th style="padding:10px 14px;text-align:left;background:#f8f9fa;color:#2c3e50;border-bottom:2px solid #e0e0e0;">Target URL</th></tr>
          </thead>
          <tbody>${urlRows}</tbody>
        </table>
        <p style="margin:16px 0 0;color:#7f8c8d;font-size:13px;">
          A baseline image will be captured on the next Gazebot run for each new URL.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#bdc3c7;font-size:12px;text-align:center;margin:0;">
          You received this because your email is configured in gazebot.json.
        </p>
      </div>
    </body>
    </html>`;

  const subject = `✅ Gazebot — ${urls.length} new URL(s) added to tracker`;
  await sendAlertEmail(to, subject, html);
}

/**
 * Send a confirmation email when new baseline images are set.
 * @param {string} to - Recipient email address.
 * @param {Array<{url: string, viewport: string, imageUrl: string}>} events - Baseline events.
 */
export async function sendBaselineSetEmail(to, events) {
  const rows = events
    .map(
      (e) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;">
            <a href="${e.url}" style="color:#3498db;text-decoration:none;word-break:break-all;">${e.url}</a>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:center;">${e.viewport}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:center;">
            <a href="${e.imageUrl}" style="color:#27ae60;">View Image</a>
          </td>
        </tr>`,
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <h1 style="margin:0 0 4px;font-size:22px;color:#2c3e50;">🤖 Gazebot — New Baseline Set</h1>
        <p style="margin:0 0 20px;color:#95a5a6;font-size:13px;">${new Date().toUTCString()}</p>
        <p style="margin:0 0 16px;color:#7f8c8d;">
          New baseline images have been captured for the following monitors:
        </p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e0e0e0;border-radius:8px;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="padding:10px 14px;text-align:left;color:#2c3e50;border-bottom:2px solid #e0e0e0;">URL</th>
              <th style="padding:10px 14px;text-align:center;color:#2c3e50;border-bottom:2px solid #e0e0e0;">Viewport</th>
              <th style="padding:10px 14px;text-align:center;color:#2c3e50;border-bottom:2px solid #e0e0e0;">Baseline</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:16px 0 0;color:#7f8c8d;font-size:13px;">
          Future runs will compare screenshots against these baselines.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#bdc3c7;font-size:12px;text-align:center;margin:0;">
          You received this because your email is configured in gazebot.json.
        </p>
      </div>
    </body>
    </html>`;

  const subject = `📸 Gazebot — ${events.length} new baseline(s) captured`;
  await sendAlertEmail(to, subject, html);
}
