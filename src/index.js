import 'dotenv/config';
import { connectDB, disconnectDB } from './utils/db.js';
import { syncDatabase } from './pipeline/syncDatabase.js';
import { evaluateMonitors } from './pipeline/evaluateMonitors.js';
import { runDiffEngine } from './pipeline/diffEngine.js';
import { processAlertQueue } from './pipeline/alertQueue.js';

/**
 * Gazebot — Main Orchestrator
 *
 * Execution order:
 *   1. Connect to MongoDB
 *   2. Sync gazebot.json → DB (upsert Users & Monitors)
 *   3. Launch Puppeteer, evaluate all monitors (ad masking + screenshots)
 *   4. Run diff engine (baseline set or pixelmatch comparison)
 *   5. Process alert queue (send consolidated emails)
 *   6. Teardown (close browser + DB connection)
 */
async function main() {
  let browser = null;

  try {
    console.log('═══════════════════════════════════════');
    console.log('  🤖 GAZEBOT — Visual Regression Runner');
    console.log('═══════════════════════════════════════\n');

    // Step 1: Connect to MongoDB
    await connectDB();

    // Step 2: Database Sync
    console.log('\n── Step 1: Database Sync ──');
    const syncedData = await syncDatabase();

    // Step 3: Puppeteer Evaluation Loop
    console.log('\n── Step 2: Puppeteer Evaluation ──');
    const { browser: puppeteerBrowser, evaluations } = await evaluateMonitors(syncedData);
    browser = puppeteerBrowser;

    // Step 4: Versioning & Diffing
    console.log('\n── Step 3: Diff Engine ──');
    const diffResults = await runDiffEngine(evaluations);

    // Step 5: Alert Queuing & Notifications
    console.log('\n── Step 4: Alert Queue ──');
    await processAlertQueue(diffResults);

    console.log('\n✅ Gazebot run complete.');
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exitCode = 1;
  } finally {
    // Teardown
    if (browser) {
      await browser.close();
      console.log('🧹 Puppeteer browser closed.');
    }
    await disconnectDB();
  }
}

main();
