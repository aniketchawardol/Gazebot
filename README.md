# <img width="50" height="50" alt="logo" src="https://github.com/user-attachments/assets/f170f755-322a-4dda-a467-8575d47c8a3b" /> Gaze bot

**An open-source, PR-driven visual regression & functional testing tool.**

Gazebot monitors your web pages for UI regressions, broken layouts, and ad placement failures. It runs daily via GitHub Actions, captures full-page screenshots with Puppeteer, compares them against your approved baselines using `pixelmatch`, and sends you a consolidated email digest if anything breaks.

---

## ⚙️ How It Works

```text
gazebot.json → Sync DB → Puppeteer Screenshots → pixelmatch Diff → Email Alert
```

1. **Configure** — Define the URLs and viewports you want to monitor in `gazebot.json`.
2. **Automate** — A GitHub Actions workflow automatically runs every night at midnight UTC.
3. **Capture & Mask** — Puppeteer visits each URL, masks dynamic content (like ads or animations) to prevent false alarms, and captures a full-page screenshot.
4. **Compare** — New screenshots are compared against stored baselines on Cloudinary. If the visual difference exceeds your set tolerance, a red diff image is generated.
5. **Alert** — If regressions or missing elements are detected, a consolidated HTML email containing the diff images is sent directly to your inbox.

---

## 🚀 Quick Start (Self-Hosting)

Want to run your own instance of Gazebot? Follow these steps:

### 1. Clone & Install

```bash
git clone [https://github.com/your-username/gazebot.git](https://github.com/your-username/gazebot.git)
cd gazebot
npm install
```

### 2. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```
Fill in your credentials for MongoDB, Cloudinary, and your SMTP server (e.g., Gmail App Password, Resend, or SendGrid).

### 3. Run Locally

```bash
npm start
```

### 4. Deploy to GitHub Actions

1. Push the repository to your GitHub account.
2. Go to **Settings → Secrets and variables → Actions**.
3. Add all the variables from your `.env` file as repository secrets.
4. The workflow will now run automatically at midnight UTC, or you can trigger it manually from the **Actions** tab.

---

## 🌐 How to Add Your Website (PR Flow)

Getting your site monitored by an existing Gazebot instance takes less than 2 minutes:

1. **Fork the Repository:** Click the **Fork** button at the top right of the repository.
2. **Add Your Configuration:** Open `gazebot.json` in the root directory and append your configuration block. 
3. **Submit a Pull Request:** Commit your changes and open a PR to the `main` branch. Once merged, Gazebot will immediately capture your baseline screenshots on its next daily run!

*Example configuration:*
```json
{
  "github_user": "your-github-username",
  "email": "you@example.com",
  "monitors": [
    {
      "target_url": "[https://your-site.com](https://your-site.com)",
      "wait_time_ms": 3000,
      "tolerance_percent": 1.5,
      "baseline_version": 1,
      "ad_selectors": [".header-ad", "#hero-video"],
      "viewports": [
        { "name": "desktop", "width": 1920, "height": 1080 },
        { "name": "mobile", "width": 375, "height": 812 }
      ]
    }
  ]
}
```

---

## 💡 Pro-Tip: Handling Dynamic Content

Dynamic components—like CSS animations, rotating text, video players, or third-party ads—will almost always trigger a false positive during visual regression testing because they look different on every page load. 

You can use the `ad_selectors` array to tell Gazebot to completely **black out** specific elements before taking the screenshot. Simply pass in their CSS selectors (IDs or classes):

```json
"ad_selectors": ["#metaballs", "#rotating-text", ".video-player-container"]
```
*Note: Gazebot will paint these elements solid black and hide their children, ensuring pixel-perfect consistency across your baseline comparisons.*

---

## 🛠 Configuration Reference

| Field               | Type     | Description                                                    |
|----------------------|----------|----------------------------------------------------------------|
| `github_user`        | String   | Your GitHub username (used for Cloudinary folder paths).       |
| `email`              | String   | Where to send alert emails and baseline confirmations.         |
| `target_url`         | String   | The precise URL to monitor.                                    |
| `wait_time_ms`       | Number   | Milliseconds to wait after page load before screenshotting (useful for entry animations). |
| `tolerance_percent`  | Number   | Maximum allowed pixel mismatch percentage before an email alert is triggered. |
| `baseline_version`   | Number   | Bump this number in a PR to accept the current state as a brand new baseline. |
| `ad_selectors`       | String[] | CSS selectors for dynamic elements or ads to black out.        |
| `viewports`          | Object[] | Array of `{ name, width, height }` viewports to test against.  |

---

## 📸 Baseline Management

> **Baselines are never automatically updated on failure.** They are only established when the `baseline_version` in `gazebot.json` is bumped manually.

- **First run / Version bump:** The current layout is captured and uploaded to Cloudinary as the new "source of truth" (baseline).
- **Daily runs:** Subsequent screenshots are strictly compared against the stored baseline version. 

---

## 💻 Tech Stack

| Component          | Technology          |
|--------------------|---------------------|
| Runtime            | Node.js (ES Modules)|
| Browser Automation | Puppeteer (Headless)|
| Image Diffing      | pixelmatch + pngjs  |
| Database           | MongoDB (Mongoose)  |
| Image Storage      | Cloudinary          |
| Alerts             | Nodemailer          |
| CI/CD              | GitHub Actions      |
