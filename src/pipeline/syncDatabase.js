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

  console.log(`📄 Loaded gazebot.json — ${config.length} user(s) found.`);

  const results = [];

  for (const entry of config) {
    // Upsert the user by email
    const user = await User.findOneAndUpdate(
      { email: entry.email },
      { email: entry.email, github_user: entry.github_user },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    console.log(`👤 Synced user: ${user.email} (${user._id})`);

    const monitors = [];

    for (const mon of entry.monitors) {
      // Build the viewports array, preserving any existing baseline_image_url from DB
      const existingMonitor = await Monitor.findOne({
        userId: user._id,
        target_url: mon.target_url,
      });

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
          viewports,
          // NOTE: baseline_version is NOT overwritten here.
          // It is only updated in diffEngine when a version bump is detected.
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      monitors.push({
        dbMonitor: monitor,
        jsonConfig: mon, // keep the full JSON entry for tolerance, wait_time, ad_selectors, etc.
      });

      console.log(`  🔗 Synced monitor: ${mon.target_url} (${monitor._id})`);
    }

    results.push({ user, monitors });
  }

  return results;
}
