const { chromium } = require('./frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

async function run() {
  const outputDir = path.resolve(__dirname, 'artifacts', 'demo_video');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Launching browser to record demo video...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();

  // Helper for delays
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // --- SCENE 1: CINEMATIC TITLE & TEAM INTRO CARD ---
  console.log('Recording Scene 1: Team & Project Intro...');
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: radial-gradient(circle at 50% 30%, #0f172a 0%, #020617 100%);
          color: #f8fafc;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem;
          overflow: hidden;
        }
        .badge {
          display: inline-block;
          background: rgba(13, 148, 136, 0.2);
          border: 1px solid #0d9488;
          color: #2dd4bf;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 6px 16px;
          border-radius: 9999px;
          margin-bottom: 24px;
        }
        h1 {
          font-size: 64px;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .tagline {
          font-size: 26px;
          color: #38bdf8;
          font-weight: 600;
          margin-bottom: 24px;
        }
        .epistemic {
          font-size: 18px;
          color: #cbd5e1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 12px 28px;
          border-radius: 12px;
          max-width: 780px;
          line-height: 1.5;
          margin-bottom: 36px;
        }
        .team-box {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 16px;
          padding: 20px 40px;
          display: flex;
          gap: 40px;
          align-items: center;
        }
        .team-title {
          font-size: 13px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 4px;
        }
        .team-name {
          font-size: 22px;
          color: #fbbf24;
          font-weight: 800;
        }
        .members-list {
          display: flex;
          gap: 20px;
        }
        .member {
          background: rgba(255, 255, 255, 0.08);
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          color: #f1f5f9;
        }
      </style>
    </head>
    <body>
      <div class="badge">Lumina '26 — Hack the Unseen</div>
      <h1>UsableNow</h1>
      <div class="tagline">"Open Doesn't Mean Usable — Know Before You Go."</div>
      <div class="epistemic">
        <strong>The Core Campus Problem:</strong> Traditional maps tell students where a facility exists and whether the building is scheduled to be open. They fail to answer what matters: <em>"Is it actually working and usable right now?"</em>
      </div>
      <div class="team-box">
        <div>
          <div class="team-title">Engineered by Team</div>
          <div class="team-name">404 Brain Not Found</div>
        </div>
        <div class="members-list">
          <div class="member">🌟 Pragya Ahlawat (Team Lead)</div>
          <div class="member">💻 Paras</div>
          <div class="member">⚙️ Ronak Jain</div>
        </div>
      </div>
    </body>
    </html>
  `);
  await sleep(4000);

  // --- SCENE 2: LIVE HOME PAGE & CORE SAFEGUARD ---
  console.log('Recording Scene 2: Home Page & Epistemic Safeguard...');
  await page.goto('http://localhost:5173/#/');
  await sleep(2000);

  // Scroll down smoothly to show Core Epistemic Safeguard
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await sleep(2500);

  // Scroll to Live Preview Card
  await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
  await sleep(2500);

  // --- SCENE 3: DISCOVERY DASHBOARD & INTENT SEARCH ---
  console.log('Recording Scene 3: Discovery Dashboard...');
  await page.click('a[href="#/discover"]');
  await sleep(2000);

  // Demonstrate Quick Need Filter (Drinking Water)
  console.log('Clicking Drinking Water quick need...');
  await page.click('button:has-text("Drinking Water")');
  await sleep(2000);

  // Demonstrate Laundry Filter
  console.log('Clicking Laundry Machines quick need...');
  await page.click('button:has-text("Laundry Machines")');
  await sleep(2000);

  // Search input demonstration
  console.log('Demonstrating natural language search...');
  const searchInput = page.locator('input[type="text"]');
  await searchInput.fill('working printer');
  await page.click('button:has-text("Search")');
  await sleep(2500);

  // Reset to Laundry
  await page.click('button:has-text("Laundry Machines")');
  await sleep(1500);

  // --- SCENE 4: FACILITY DETAIL MODAL & WALKING ROUTE ---
  console.log('Recording Scene 4: Facility Inspection & Live Routing...');
  // Click Evidence & Timeline on Shastri Hostel Laundry Room
  const evidenceBtn = page.locator('button:has-text("Evidence & Timeline")').first();
  await evidenceBtn.click();
  await sleep(2000);

  // Scroll modal down to inspect campus location and walking directions
  await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]');
    if (dialog) dialog.scrollBy({ top: 300, behavior: 'smooth' });
  });
  await sleep(1500);

  // Click Calculate Walking Time
  console.log('Calculating walking route via Google Maps...');
  const calcRouteBtn = page.locator('button:has-text("Calculate Walking Time")');
  if (await calcRouteBtn.isVisible()) {
    await calcRouteBtn.click();
    await sleep(2500);
  }

  // Inspect Timeline and Alternative Facilities
  await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]');
    if (dialog) dialog.scrollBy({ top: 400, behavior: 'smooth' });
  });
  await sleep(2500);

  // Close modal
  await page.click('button[aria-label="Close modal"]');
  await sleep(1000);

  // --- SCENE 5: REPORT SUBMISSION & MODERATION SAFETY ---
  console.log('Recording Scene 5: Student Report Submission Flow...');
  await page.click('button:has-text("Report")');
  await sleep(1500);

  // Select Shastri Hostel
  await page.selectOption('select#facility-select', { index: 1 });
  await sleep(1000);

  // Enter observation notes
  const noteBox = page.locator('textarea[placeholder*="Be specific"]');
  if (await noteBox.isVisible()) {
    await noteBox.fill('All 3 washers operational. Normal queue today.');
    await sleep(1500);
  }

  // Close report modal
  await page.click('button:has-text("Cancel")');
  await sleep(1000);

  // --- SCENE 6: ADMIN MODERATION PANEL ---
  console.log('Recording Scene 6: Admin Moderation Panel...');
  await page.goto('http://localhost:5173/#/admin');
  await sleep(2000);

  // Scroll down through moderation queue
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await sleep(2500);

  // --- SCENE 7: OUTRO SUMMARY CARD ---
  console.log('Recording Scene 7: Outro & Submission Summary...');
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%);
          color: #f8fafc;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2.5rem;
        }
        .badge {
          background: rgba(34, 197, 94, 0.2);
          border: 1px solid #22c55e;
          color: #4ade80;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 6px 18px;
          border-radius: 9999px;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 48px;
          font-weight: 800;
          margin-bottom: 12px;
          color: #ffffff;
        }
        p {
          font-size: 18px;
          color: #94a3b8;
          max-width: 680px;
          line-height: 1.5;
          margin-bottom: 30px;
        }
        .links-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          max-width: 820px;
          width: 100%;
          margin-bottom: 32px;
        }
        .link-card {
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          padding: 20px;
          text-align: left;
        }
        .link-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #38bdf8;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .link-url {
          font-size: 14px;
          font-family: monospace;
          color: #f1f5f9;
          word-break: break-all;
        }
        .footer-team {
          font-size: 15px;
          color: #cbd5e1;
        }
        .team-highlight {
          color: #fbbf24;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="badge">Verified Submission Ready</div>
      <h1>UsableNow</h1>
      <p>Empowering students to know facility usability before they make the walk across campus. Built with mathematical decay, multi-source corroboration, and privacy-first moderation.</p>
      
      <div class="links-grid">
        <div class="link-card">
          <div class="link-title">GitHub Repository</div>
          <div class="link-url">https://github.com/Ronak1167/UsableNow</div>
        </div>
        <div class="link-card">
          <div class="link-title">Live Deployed Platform</div>
          <div class="link-url">https://ronak1167.github.io/UsableNow/</div>
        </div>
      </div>

      <div class="footer-team">
        Team <span class="team-highlight">404 Brain Not Found</span> • Pragya Ahlawat • Paras • Ronak Jain
      </div>
    </body>
    </html>
  `);
  await sleep(4000);

  console.log('Finishing video recording and saving file...');
  await page.close();
  await context.close();
  await browser.close();

  // Find the generated video file in outputDir
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (files.length > 0) {
    const originalVideo = path.join(outputDir, files[0]);
    const finalVideo = path.join(outputDir, 'UsableNow_Demo_Walkthrough.webm');
    fs.renameSync(originalVideo, finalVideo);
    console.log('Video recording successfully saved to:', finalVideo);
    console.log('Size:', (fs.statSync(finalVideo).size / 1024 / 1024).toFixed(2), 'MB');
  } else {
    console.log('Warning: No video file found in output directory.');
  }
}

run().catch(err => {
  console.error('Error during video recording:', err);
  process.exit(1);
});
