import { sendAlertEmail } from '../utils/email.js';

/**
 * Group diff results by user, build HTML email bodies, and send
 * one consolidated alert email per user who has triggered issues.
 *
 * @param {Array} diffResults - Output from runDiffEngine()
 */
export async function processAlertQueue(diffResults) {
  // Group results by userId
  const userAlerts = new Map();

  for (const result of diffResults) {
    const userId = result.user._id.toString();

    if (!userAlerts.has(userId)) {
      userAlerts.set(userId, {
        user: result.user,
        alerts: [],
      });
    }

    const hasRegression =
      result.action === 'COMPARED' &&
      result.mismatchPercent !== null &&
      result.mismatchPercent > result.jsonConfig.tolerance_percent;

    const hasAdErrors = result.adErrors && result.adErrors.length > 0;

    if (hasRegression || hasAdErrors) {
      userAlerts.get(userId).alerts.push(result);
    }
  }

  // Send emails
  let emailsSent = 0;

  for (const [, { user, alerts }] of userAlerts) {
    if (alerts.length === 0) continue;

    const subject = `🔴 Gazebot Alert — ${alerts.length} issue(s) detected`;
    const htmlBody = buildEmailHtml(alerts);

    await sendAlertEmail(user.email, subject, htmlBody);
    emailsSent++;
  }

  if (emailsSent === 0) {
    console.log('✅ No alerts to send. All monitors are healthy.');
  } else {
    console.log(`📬 Sent ${emailsSent} alert email(s).`);
  }
}

/**
 * Build a clean HTML email summarising all regressions and ad failures.
 * @param {Array} alerts
 * @returns {string} HTML string
 */
function buildEmailHtml(alerts) {
  const rows = alerts.map((a) => {
    const sections = [];

    // Visual regression section
    if (
      a.action === 'COMPARED' &&
      a.mismatchPercent !== null &&
      a.mismatchPercent > a.jsonConfig.tolerance_percent
    ) {
      sections.push(`
        <div style="background:#fff3f3;border-left:4px solid #e74c3c;padding:12px;margin-bottom:12px;border-radius:4px;">
          <strong style="color:#e74c3c;">Visual Regression</strong>
          <p style="margin:8px 0 4px;">Mismatch: <strong>${a.mismatchPercent.toFixed(2)}%</strong> (tolerance: ${a.jsonConfig.tolerance_percent}%)</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:4px;text-align:center;">
                <a href="${a.oldUrl}" style="color:#3498db;">Baseline Image</a>
              </td>
              <td style="padding:4px;text-align:center;">
                <a href="${a.newUrl}" style="color:#e74c3c;">Current Screenshot</a>
              </td>
              <td style="padding:4px;text-align:center;">
                <a href="${a.diffUrl}" style="color:#e67e22;">Diff Image</a>
              </td>
            </tr>
          </table>
        </div>
      `);
    }

    // Ad failure section
    if (a.adErrors && a.adErrors.length > 0) {
      const adList = a.adErrors.map((e) => `<li style="margin:4px 0;">${e}</li>`).join('');
      sections.push(`
        <div style="background:#fff8e1;border-left:4px solid #f39c12;padding:12px;margin-bottom:12px;border-radius:4px;">
          <strong style="color:#f39c12;">Ad Verification Failures</strong>
          <ul style="margin:8px 0 0;padding-left:20px;">${adList}</ul>
        </div>
      `);
    }

    return `
      <div style="border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 8px;color:#2c3e50;">
          🔗 <a href="${a.jsonConfig.target_url}" style="color:#2c3e50;">${a.jsonConfig.target_url}</a>
        </h3>
        <p style="margin:0 0 12px;color:#7f8c8d;font-size:13px;">
          Viewport: <strong>${a.viewport.name}</strong> (${a.viewport.width}×${a.viewport.height})
        </p>
        ${sections.join('')}
      </div>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <h1 style="margin:0 0 4px;font-size:22px;color:#2c3e50;">🤖 Gazebot Daily Report</h1>
        <p style="margin:0 0 20px;color:#95a5a6;font-size:13px;">
          ${new Date().toUTCString()}
        </p>
        <p style="margin:0 0 20px;color:#7f8c8d;">
          The following issues were detected during today's automated scan:
        </p>
        ${rows.join('')}
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#bdc3c7;font-size:12px;text-align:center;margin:0;">
          Baselines are only updated via PR version bumps in gazebot.json.
        </p>
      </div>
    </body>
    </html>
  `;
}
