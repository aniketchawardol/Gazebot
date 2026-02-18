import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import Monitor from '../models/Monitor.js';
import { uploadBuffer, fetchImageBuffer } from '../utils/cloudinary.js';

/**
 * For each evaluation result, decide whether to set a new baseline (Scenario A)
 * or run a pixelmatch diff against the existing baseline (Scenario B).
 *
 * @param {Array} evaluations - Output from evaluateMonitors()
 * @returns {Promise<Array>} diffResults -- enriched with mismatch data and Cloudinary URLs
 */
export async function runDiffEngine(evaluations) {
  const diffResults = [];
  /** @type {Map<string, { user: object, events: Array<{url: string, viewport: string, imageUrl: string}> }>} */
  const baselineMap = new Map();

  for (const evaluation of evaluations) {
    const {
      user,
      dbMonitor,
      jsonConfig,
      viewport,
      screenshotBuffer,
      adErrors,
    } = evaluation;

    // Skip if the screenshot capture failed
    if (!screenshotBuffer) {
      diffResults.push({
        user,
        dbMonitor,
        jsonConfig,
        viewport,
        adErrors,
        action: 'SKIPPED',
        mismatchPercent: null,
        oldUrl: null,
        newUrl: null,
        diffUrl: null,
      });
      continue;
    }

    const jsonVersion = jsonConfig.baseline_version;
    const dbVersion = dbMonitor.baseline_version;

    // Find the matching viewport in the DB document
    const dbViewport = dbMonitor.viewports.find(
      (v) => v.name === viewport.name && v.width === viewport.width && v.height === viewport.height,
    );

    const hasBaseline = dbViewport?.baseline_image_url;

    // ---------------------------------------------------------------
    // Scenario A: Version Bump or New Monitor (no baseline image yet)
    // ---------------------------------------------------------------
    if (jsonVersion > dbVersion || !hasBaseline) {
      console.log(`  Scenario A -- Setting new baseline for ${jsonConfig.target_url} [${viewport.name}]`);

      const folder = `gazebot/${user.github_user}/${encodeURIComponent(jsonConfig.target_url)}`;
      const imageUrl = await uploadBuffer(screenshotBuffer, folder);

      // Update the DB: set the new baseline version and image URL
      await Monitor.updateOne(
        { _id: dbMonitor._id, 'viewports.name': viewport.name },
        {
          $set: {
            baseline_version: jsonVersion,
            'viewports.$.baseline_image_url': imageUrl,
          },
        },
      );

      diffResults.push({
        user,
        dbMonitor,
        jsonConfig,
        viewport,
        adErrors,
        action: 'BASELINE_SET',
        mismatchPercent: null,
        oldUrl: null,
        newUrl: imageUrl,
        diffUrl: null,
      });

      // Track for baseline confirmation email
      const uid = user._id.toString();
      if (!baselineMap.has(uid)) {
        baselineMap.set(uid, { user, events: [] });
      }
      baselineMap.get(uid).events.push({
        url: jsonConfig.target_url,
        viewport: `${viewport.name} (${viewport.width}x${viewport.height})`,
        imageUrl,
      });

      continue;
    }

    // ---------------------------------------------------------------
    // Scenario B: Daily Run -- compare against baseline
    // ---------------------------------------------------------------
    if (jsonVersion === dbVersion) {
      console.log(`  Scenario B -- Comparing ${jsonConfig.target_url} [${viewport.name}] against baseline...`);

      const baselineBuffer = await fetchImageBuffer(dbViewport.baseline_image_url);

      // Decode both PNGs
      const baselineImg = PNG.sync.read(baselineBuffer);
      const currentImg = PNG.sync.read(screenshotBuffer);

      // Ensure dimensions match -- use the min of both to avoid crashes
      const width = Math.min(baselineImg.width, currentImg.width);
      const height = Math.min(baselineImg.height, currentImg.height);

      // Create a diff output image
      const diffImg = new PNG({ width, height });

      // Crop images to the common dimensions if needed
      const baseData = cropImageData(baselineImg, width, height);
      const currData = cropImageData(currentImg, width, height);

      const numDiffPixels = pixelmatch(
        baseData,
        currData,
        diffImg.data,
        width,
        height,
        { threshold: 0.1 },
      );

      const totalPixels = width * height;
      const mismatchPercent = (numDiffPixels / totalPixels) * 100;

      console.log(`    Mismatch: ${mismatchPercent.toFixed(2)}% (tolerance: ${jsonConfig.tolerance_percent}%)`);

      const result = {
        user,
        dbMonitor,
        jsonConfig,
        viewport,
        adErrors,
        action: 'COMPARED',
        mismatchPercent,
        oldUrl: dbViewport.baseline_image_url,
        newUrl: null,
        diffUrl: null,
      };

      // If mismatch exceeds tolerance, upload the new screenshot AND the diff image
      if (mismatchPercent > jsonConfig.tolerance_percent) {
        console.log(`    [ALERT] Regression detected! Uploading evidence...`);

        const folder = `gazebot/${user.github_user}/${encodeURIComponent(jsonConfig.target_url)}`;
        const newUrl = await uploadBuffer(screenshotBuffer, `${folder}/regressions`);
        const diffBuffer = PNG.sync.write(diffImg);
        const diffUrl = await uploadBuffer(diffBuffer, `${folder}/diffs`);

        result.newUrl = newUrl;
        result.diffUrl = diffUrl;
      }

      diffResults.push(result);
    }
  }

  return { diffResults, baselineMap };
}

/**
 * Crop image data to a given width and height.
 * Returns a new Uint8Array with the cropped RGBA pixel data.
 */
function cropImageData(img, targetWidth, targetHeight) {
  if (img.width === targetWidth && img.height === targetHeight) {
    return img.data;
  }
  const cropped = new Uint8Array(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y++) {
    const srcOffset = y * img.width * 4;
    const dstOffset = y * targetWidth * 4;
    cropped.set(img.data.subarray(srcOffset, srcOffset + targetWidth * 4), dstOffset);
  }
  return cropped;
}
