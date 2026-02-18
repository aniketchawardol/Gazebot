import 'dotenv/config';
import { connectDB, disconnectDB } from './utils/db.js';
import { syncDatabase } from './pipeline/syncDatabase.js';
import { evaluateMonitors } from './pipeline/evaluateMonitors.js';
import { runDiffEngine } from './pipeline/diffEngine.js';
import { processAlertQueue } from './pipeline/alertQueue.js';
import { sendNewUrlEmail, sendBaselineSetEmail } from './utils/email.js';

/**
 * Gazebot -- Main Orchestrator
 *
 * Execution order:
 *   1. Connect to MongoDB
 *   2. Sync gazebot.json -> DB (upsert Users & Monitors, validate unique URLs)
 *   3. Send confirmation emails for any newly added URLs
 *   4. Launch Puppeteer, evaluate all monitors (ad masking + screenshots)
 *   5. Run diff engine (baseline set or pixelmatch comparison)
 *   6. Send confirmation emails for any new baselines
 *   7. Process alert queue (send consolidated regression/ad emails)
 *   8. Teardown (close browser + DB connection)
 */
async function main() {
  let browser = null;

  try {
    console.log('=======================================');
    console.log('  GAZEBOT -- Visual Regression Runner');
    console.log('=======================================\n');

    // Step 1: Connect to MongoDB
    await connectDB();

    // Step 2: Database Sync (also validates URL uniqueness)
    console.log('\n-- Step 1: Database Sync --');
    const { syncedData, newUrlMap } = await syncDatabase();

    // Step 2b: Send confirmation emails for newly added URLs
    for (const [, { user, urls }] of newUrlMap) {
      await sendNewUrlEmail(user.email, urls);
      console.log(`New-URL confirmation sent to ${user.email} (${urls.length} URL(s))`);
    }

    // Step 3: Puppeteer Evaluation Loop
    console.log('\n-- Step 2: Puppeteer Evaluation --');
    const { browser: puppeteerBrowser, evaluations } = await evaluateMonitors(syncedData);
    browser = puppeteerBrowser;

    // Step 4: Versioning & Diffing
    console.log('\n-- Step 3: Diff Engine --');
    const { diffResults, baselineMap } = await runDiffEngine(evaluations);

    // Step 4b: Send confirmation emails for newly set baselines
    for (const [, { user, events }] of baselineMap) {
      await sendBaselineSetEmail(user.email, events);
      console.log(`Baseline confirmation sent to ${user.email} (${events.length} baseline(s))`);
    }

    // Step 5: Alert Queuing & Notifications
    console.log('\n-- Step 4: Alert Queue --');
    await processAlertQueue(diffResults);

    console.log('\nGazebot run complete.');
  } catch (error) {
    console.error('\n[FATAL] Error:', error);
    process.exitCode = 1;
  } finally {
    // Teardown
    if (browser) {
      await browser.close();
      console.log('Puppeteer browser closed.');
    }
    await disconnectDB();
  }
}

main();
