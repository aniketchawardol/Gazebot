import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import User from '../models/User.js';
import Monitor from '../models/Monitor.js';

/**
 * Parse gazebot.json and upsert Users and Monitors in MongoDB.
 * Returns a structured array of { user, monitors (with JSON config merged) }.
 */
export async function syncDatabase() {
  const configPath = resolve(process.cwd(), 'gazebot.json');
  const raw = await readFile(configPath, 'utf-8');
  const config = JSON.parse(raw);

  console.log(`Loaded gazebot.json -- ${config.length} user(s) found.`);

  // -- Validate URL uniqueness across ALL users ----------------------
  const allUrls = config.flatMap((entry) =>
    (entry.monitors || []).map((mon) => mon.target_url),
  );
  const seen = new Map();
  for (const url of allUrls) {
    seen.set(url, (seen.get(url) || 0) + 1);
  }
  const duplicates = [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([url]) => url);

  if (duplicates.length > 0) {
    const list = duplicates.map((u) => `  - ${u}`).join('\n');
    throw new Error(
      `Duplicate target URLs detected in gazebot.json. Each URL must be unique:\n${list}`,
    );
  }
  console.log('URL uniqueness validated -- no duplicates.');

  // -- Sync users & monitors -----------------------------------------
  const results = [];
  /** @type {Map<string, { user: object, urls: string[] }>} userId -> new URLs */
  const newUrlMap = new Map();

  for (const entry of config) {
    // Upsert the user by email
    const user = await User.findOneAndUpdate(
      { email: entry.email },
      { email: entry.email, github_user: entry.github_user },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    console.log(`Synced user: ${user.email} (${user._id})`);

    const monitors = [];

    for (const mon of entry.monitors) {
      // Build the viewports array, preserving any existing baseline_image_url from DB
      const existingMonitor = await Monitor.findOne({
        userId: user._id,
        target_url: mon.target_url,
      });

      const isNewUrl = !existingMonitor;

      const viewports = mon.viewports.map((vp) => {
        // If the monitor already exists, try to preserve the stored baseline_image_url
        const existingVp = existingMonitor?.viewports?.find(
          (ev) => ev.name === vp.name && ev.width === vp.width && ev.height === vp.height,
        );
        return {
          name: vp.name,
          width: vp.width,
          height: vp.height,
          baseline_image_url: existingVp?.baseline_image_url || null,
        };
      });

      const monitor = await Monitor.findOneAndUpdate(
        { userId: user._id, target_url: mon.target_url },
        {
          userId: user._id,
          target_url: mon.target_url,
          wait_time_ms: mon.wait_time_ms || 0,
          tolerance_percent: mon.tolerance_percent || 0,
          ad_selectors: mon.ad_selectors || [],
          viewports,
          // NOTE: baseline_version is NOT overwritten here.
          // It is only updated in diffEngine when a version bump is detected.
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      // Track newly added URLs for confirmation emails
      if (isNewUrl) {
        const uid = user._id.toString();
        if (!newUrlMap.has(uid)) {
          newUrlMap.set(uid, { user, urls: [] });
        }
        newUrlMap.get(uid).urls.push(mon.target_url);
        console.log(`  [NEW] URL added: ${mon.target_url}`);
      }

      monitors.push({
        dbMonitor: monitor,
        jsonConfig: mon, // keep the full JSON entry for tolerance, wait_time, ad_selectors, etc.
      });

      console.log(`  Synced monitor: ${mon.target_url} (${monitor._id})`);
    }

    results.push({ user, monitors });
  }

  return { syncedData: results, newUrlMap };
}
