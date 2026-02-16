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
