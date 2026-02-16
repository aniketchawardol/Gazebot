# 🤖 Gazebot

**PR-driven visual regression & functional testing tool.**

Gazebot monitors your web pages for UI regressions and broken ad placements. It runs daily via GitHub Actions, captures screenshots with Puppeteer, compares them against baselines using `pixelmatch`, and sends you a consolidated email digest if anything breaks.

---

## How It Works

```
gazebot.json  →  Sync DB  →  Puppeteer Screenshots  →  pixelmatch Diff  →  Email Alert
```

1. **Configuration via PR** — Define your monitors in `gazebot.json`. Bump `baseline_version` to accept a new baseline.
2. **Daily Cron** — A GitHub Actions workflow runs every night at midnight UTC.
3. **Screenshot & Mask** — Puppeteer visits each URL, verifies ad selectors, masks them, and captures a full-page screenshot.
4. **Diff Engine** — New screenshots are compared against the stored Cloudinary baseline using `pixelmatch`. If the mismatch exceeds your tolerance, a red diff image is generated.
5. **Alert Email** — A single, consolidated HTML email is sent per user summarizing all regressions and ad failures.

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/your-username/gazebot.git
cd gazebot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in your MongoDB, Cloudinary, and SMTP credentials
```

### 3. Configure Monitors

Edit `gazebot.json` to define your monitored URLs:

```json
[
  {
    "github_user": "your-github-username",
    "email": "you@example.com",
    "monitors": [
      {
        "target_url": "https://your-site.com",
        "wait_time_ms": 3000,
        "tolerance_percent": 1.5,
        "baseline_version": 1,
        "ad_selectors": [".header-ad"],
        "viewports": [
          { "name": "desktop", "width": 1920, "height": 1080 },
          { "name": "mobile", "width": 375, "height": 812 }
        ]
      }
    ]
  }
]
```

### 4. Run Locally

```bash
npm start
```

### 5. Deploy to GitHub Actions

1. Push this repo to GitHub.
2. Go to **Settings → Secrets and variables → Actions**.
3. Add all variables from `.env.example` as repository secrets.
4. The workflow runs automatically at midnight UTC, or trigger it manually from the **Actions** tab.

---

## Configuration Reference

| Field               | Type     | Description                                                    |
|----------------------|----------|----------------------------------------------------------------|
| `github_user`        | String   | Your GitHub username (used for Cloudinary folder paths).       |
| `email`              | String   | Where to send alert emails.                                    |
| `target_url`         | String   | The URL to monitor.                                            |
| `wait_time_ms`       | Number   | Milliseconds to wait after page load before screenshotting.    |
| `tolerance_percent`  | Number   | Maximum allowed pixel mismatch percentage before alerting.     |
| `baseline_version`   | Number   | Bump this number in a PR to accept the current state as the new baseline. |
| `ad_selectors`       | String[] | CSS selectors for ad elements to verify and mask.              |
| `viewports`          | Object[] | Array of `{ name, width, height }` viewport configurations.   |

---

## Baseline Management

> **Baselines are never auto-updated on failure.** They are only set when `baseline_version` in `gazebot.json` is bumped via a Pull Request.

- **First run / version bump** → Screenshot is uploaded to Cloudinary as the new baseline.
- **Daily run (same version)** → Screenshot is compared against the stored baseline.

---

## Tech Stack

| Component          | Technology          |
|--------------------|---------------------|
| Runtime            | Node.js (ES Modules)|
| Browser Automation | Puppeteer (Headless)|
| Image Diffing      | pixelmatch + pngjs  |
| Database           | MongoDB (Mongoose)  |
| Image Storage      | Cloudinary          |
| Email              | Nodemailer          |
| CI/CD              | GitHub Actions      |
