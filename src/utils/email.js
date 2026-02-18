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
  console.log(`Email sent to ${to} -- Message ID: ${info.messageId}`);
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
          <td style="padding:10px 14px;border-bottom:1px solid #222222;">
            <a href="${url}" style="color:#ff2d95;text-decoration:none;word-break:break-all;">${url}</a>
          </td>
        </tr>`,
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:Consolas,'Courier New',monospace;background:#000000;padding:20px;">
      <div style="max-width:640px;margin:0 auto;background:#111111;padding:24px;box-shadow:0 2px 12px rgba(255,45,149,0.08);">
        <img src="https://res.cloudinary.com/dkr3lu4l2/image/upload/w_96/v1771431519/Gemini_Generated_Image_pgz8copgz8copgz8_omrxj4.png" alt="Gazebot" width="48" height="48" style="display:block;margin:0 0 16px;border:0;" />
        <h1 style="margin:0 0 4px;font-size:22px;color:#ff2d95;">Gazebot -- New URL Added</h1>
        <p style="margin:0 0 20px;color:#666666;font-size:13px;">${new Date().toUTCString()}</p>
        <p style="margin:0 0 16px;color:#cccccc;">
          The following URL(s) have been added to your Gazebot tracker:
        </p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #222222;">
          <thead>
            <tr><th style="padding:10px 14px;text-align:left;background:#1a1a1a;color:#ff2d95;border-bottom:2px solid #ff2d95;">Target URL</th></tr>
          </thead>
          <tbody>${urlRows}</tbody>
        </table>
        <p style="margin:16px 0 0;color:#666666;font-size:13px;">
          A baseline image will be captured on the next Gazebot run for each new URL.
        </p>
        <hr style="border:none;border-top:1px solid #222222;margin:20px 0;">
        <p style="color:#666666;font-size:12px;text-align:center;margin:0;">
          You received this because your email is configured in gazebot.json.
        </p>
      </div>
    </body>
    </html>`;

  const subject = `Gazebot -- ${urls.length} new URL(s) added to tracker`;
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
          <td style="padding:10px 14px;border-bottom:1px solid #222222;">
            <a href="${e.url}" style="color:#ff2d95;text-decoration:none;word-break:break-all;">${e.url}</a>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #222222;text-align:center;color:#cccccc;">${e.viewport}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #222222;text-align:center;">
            <a href="${e.imageUrl}" style="color:#ff2d95;">View Image</a>
          </td>
        </tr>`,
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:Consolas,'Courier New',monospace;background:#000000;padding:20px;">
      <div style="max-width:640px;margin:0 auto;background:#111111;padding:24px;box-shadow:0 2px 12px rgba(255,45,149,0.08);">
        <img src="https://res.cloudinary.com/dkr3lu4l2/image/upload/w_96/v1771431519/Gemini_Generated_Image_pgz8copgz8copgz8_omrxj4.png" alt="Gazebot" width="48" height="48" style="display:block;margin:0 0 16px;border:0;" />
        <h1 style="margin:0 0 4px;font-size:22px;color:#ff2d95;">Gazebot -- New Baseline Set</h1>
        <p style="margin:0 0 20px;color:#666666;font-size:13px;">${new Date().toUTCString()}</p>
        <p style="margin:0 0 16px;color:#cccccc;">
          New baseline images have been captured for the following monitors:
        </p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #222222;">
          <thead>
            <tr style="background:#1a1a1a;">
              <th style="padding:10px 14px;text-align:left;color:#ff2d95;border-bottom:2px solid #ff2d95;">URL</th>
              <th style="padding:10px 14px;text-align:center;color:#ff2d95;border-bottom:2px solid #ff2d95;">Viewport</th>
              <th style="padding:10px 14px;text-align:center;color:#ff2d95;border-bottom:2px solid #ff2d95;">Baseline</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:16px 0 0;color:#666666;font-size:13px;">
          Future runs will compare screenshots against these baselines.
        </p>
        <hr style="border:none;border-top:1px solid #222222;margin:20px 0;">
        <p style="color:#666666;font-size:12px;text-align:center;margin:0;">
          You received this because your email is configured in gazebot.json.
        </p>
      </div>
    </body>
    </html>`;

  const subject = `Gazebot -- ${events.length} new baseline(s) captured`;
  await sendAlertEmail(to, subject, html);
}
