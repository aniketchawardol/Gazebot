import puppeteer from 'puppeteer';

/**
 * Launch Puppeteer, iterate over every monitor × viewport, perform ad
 * verification & masking, and capture screenshots.
 *
 * @param {Array} syncedData - Output from syncDatabase(): [{ user, monitors }]
 * @returns {Promise<{ browser: Browser, evaluations: Array }>}
 *   evaluations: [{ user, dbMonitor, jsonConfig, viewport, screenshotBuffer, adErrors }]
 */
export async function evaluateMonitors(syncedData) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  console.log('🚀 Puppeteer browser launched.');

  const evaluations = [];

  for (const { user, monitors } of syncedData) {
    for (const { dbMonitor, jsonConfig } of monitors) {
      const {
        target_url,
        wait_time_ms = 3000,
        ad_selectors = [],
      } = jsonConfig;

      for (const viewport of jsonConfig.viewports) {
        const page = await browser.newPage();
        await page.setViewport({ width: viewport.width, height: viewport.height });

        console.log(`  🌐 Navigating to ${target_url} [${viewport.name}: ${viewport.width}×${viewport.height}]`);

        try {
          await page.goto(target_url, { waitUntil: 'networkidle2', timeout: 60000 });
        } catch (err) {
          console.error(`  ❌ Navigation failed for ${target_url}: ${err.message}`);
          evaluations.push({
            user,
            dbMonitor,
            jsonConfig,
            viewport,
            screenshotBuffer: null,
            adErrors: [`Navigation failed: ${err.message}`],
          });
          await page.close();
          continue;
        }

        // Wait for the configured time
        await new Promise((r) => setTimeout(r, wait_time_ms));

        // --- Ad Verification & Masking (CRITICAL) ---
        const adErrors = await page.evaluate((selectors) => {
          const errors = [];
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (!el || el.clientHeight <= 10 || el.children.length === 0) {
              errors.push(`Revenue Alert: ${selector} failed to load.`);
            }
            // Mask the ad element so pixelmatch ignores it
            if (el) {
              el.style.backgroundColor = '#000000';
              el.style.color = '#000000';
              Array.from(el.children).forEach((child) => {
                child.style.visibility = 'hidden';
              });
            }
          }
          return errors;
        }, ad_selectors);

        if (adErrors.length > 0) {
          adErrors.forEach((e) => console.log(`  ⚠️  ${e}`));
        }

        // Capture screenshot as a PNG buffer
        const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: true });

        evaluations.push({
          user,
          dbMonitor,
          jsonConfig,
          viewport,
          screenshotBuffer,
          adErrors,
        });

        await page.close();
      }
    }
  }

  return { browser, evaluations };
}
