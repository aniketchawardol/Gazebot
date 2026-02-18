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

    const subject = `Gazebot Alert -- ${alerts.length} issue(s) detected`;
    const htmlBody = buildEmailHtml(alerts);

    await sendAlertEmail(user.email, subject, htmlBody);
    emailsSent++;
  }

  if (emailsSent === 0) {
    console.log('No alerts to send. All monitors are healthy.');
  } else {
    console.log(`Sent ${emailsSent} alert email(s).`);
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
        <div style="background:#1a0a10;border-left:4px solid #ff2d95;padding:12px;margin-bottom:12px;">
          <strong style="color:#ff2d95;">Visual Regression</strong>
          <p style="margin:8px 0 4px;color:#cccccc;">Mismatch: <strong>${a.mismatchPercent.toFixed(2)}%</strong> (tolerance: ${a.jsonConfig.tolerance_percent}%)</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:4px;text-align:center;">
                <a href="${a.oldUrl}" style="color:#ff2d95;">Baseline Image</a>
              </td>
              <td style="padding:4px;text-align:center;">
                <a href="${a.newUrl}" style="color:#ff2d95;">Current Screenshot</a>
              </td>
              <td style="padding:4px;text-align:center;">
                <a href="${a.diffUrl}" style="color:#ff2d95;">Diff Image</a>
              </td>
            </tr>
          </table>
        </div>
      `);
    }

    // Ad failure section
    if (a.adErrors && a.adErrors.length > 0) {
      const adList = a.adErrors.map((e) => `<li style="margin:4px 0;color:#cccccc;">${e}</li>`).join('');
      sections.push(`
        <div style="background:#1a0a10;border-left:4px solid #ff2d95;padding:12px;margin-bottom:12px;">
          <strong style="color:#ff2d95;">Ad Verification Failures</strong>
          <ul style="margin:8px 0 0;padding-left:20px;">${adList}</ul>
        </div>
      `);
    }

    return `
      <div style="border:1px solid #222222;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 8px;color:#ff2d95;">
          <a href="${a.jsonConfig.target_url}" style="color:#ff2d95;">${a.jsonConfig.target_url}</a>
        </h3>
        <p style="margin:0 0 12px;color:#666666;font-size:13px;">
          Viewport: <strong style="color:#cccccc;">${a.viewport.name}</strong> (${a.viewport.width}x${a.viewport.height})
        </p>
        ${sections.join('')}
      </div>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:Consolas,'Courier New',monospace;background:#000000;padding:20px;">
      <div style="max-width:640px;margin:0 auto;background:#111111;padding:24px;box-shadow:0 2px 12px rgba(255,45,149,0.08);">
        <img src="https://res.cloudinary.com/dkr3lu4l2/image/upload/w_96/v1771431519/Gemini_Generated_Image_pgz8copgz8copgz8_omrxj4.png" alt="Gazebot" width="48" height="48" style="display:block;margin:0 0 16px;border:0;" />
        <h1 style="margin:0 0 4px;font-size:22px;color:#ff2d95;">Gazebot Daily Report</h1>
        <p style="margin:0 0 20px;color:#666666;font-size:13px;">
          ${new Date().toUTCString()}
        </p>
        <p style="margin:0 0 20px;color:#cccccc;">
          The following issues were detected during today's automated scan:
        </p>
        ${rows.join('')}
        <hr style="border:none;border-top:1px solid #222222;margin:20px 0;">
        <p style="color:#666666;font-size:12px;text-align:center;margin:0;">
          Baselines are only updated via PR version bumps in gazebot.json.
        </p>
      </div>
    </body>
    </html>
  `;
}

