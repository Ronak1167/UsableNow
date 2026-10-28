const { chromium } = require('./frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function run() {
  const outputDir = path.resolve(__dirname, 'artifacts', 'demo_video');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clear previous raw files
  const rawDir = path.resolve(outputDir, 'raw');
  if (fs.existsSync(rawDir)) {
    fs.rmSync(rawDir, { recursive: true, force: true });
  }
  fs.mkdirSync(rawDir, { recursive: true });

  console.log('Launching Chrome to record narrated walkthrough video...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: rawDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // --- SCENE 1: CINEMATIC TEAM INTRO CARD (35s) ---
  console.log('Scene 1: Team 404 Brain Not Found Intro (35s)...');
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
          padding: 2.5rem;
          overflow: hidden;
        }
        .badge {
          display: inline-block;
          background: rgba(13, 148, 136, 0.25);
          border: 1px solid #0d9488;
          color: #2dd4bf;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 6px 18px;
          border-radius: 9999px;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 64px;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
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
          font-size: 17px;
          color: #cbd5e1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 16px 32px;
          border-radius: 14px;
          max-width: 820px;
          line-height: 1.6;
          margin-bottom: 32px;
        }
        .team-box {
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(56, 189, 248, 0.35);
          border-radius: 18px;
          padding: 20px 44px;
          display: flex;
          gap: 40px;
          align-items: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }
        .team-title {
          font-size: 12px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-bottom: 4px;
        }
        .team-name {
          font-size: 24px;
          color: #fbbf24;
          font-weight: 800;
        }
        .members-list {
          display: flex;
          gap: 16px;
        }
        .member {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 10px 18px;
          border-radius: 10px;
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
        <strong>The Core Campus Problem:</strong> Traditional maps tell students where a facility exists and whether the building is scheduled to be open. They fail to answer what matters: <em>"Is the drinking water cold? Is the printer jammed? Are the hostel washers busy right now?"</em>
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
  await sleep(35000);

  // --- SCENE 2: LIVE HOME PAGE & EPISTEMIC PRINCIPLE (28s) ---
  console.log('Scene 2: Landing Page & Epistemic Safeguards (28s)...');
  await page.goto('http://localhost:5173/#/');
  await sleep(4000);

  // Smooth scroll down to Core Epistemic Safeguard
  await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
  await sleep(8000);

  // Smooth scroll to Live Preview Card
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await sleep(8000);

  // Smooth scroll to architecture highlights
  await page.evaluate(() => window.scrollBy({ top: 420, behavior: 'smooth' }));
  await sleep(8000);

  // --- SCENE 3: DISCOVERY DASHBOARD & INTENT SEARCH (22s) ---
  console.log('Scene 3: Discovery Dashboard & Natural Search (22s)...');
  await page.click('a[href="#/discover"]');
  await sleep(3000);

  // Click Drinking Water quick filter
  await page.click('button:has-text("Drinking Water")');
  await sleep(4000);

  // Click Laundry Machines quick filter
  await page.click('button:has-text("Laundry Machines")');
  await sleep(4000);

  // Search input typing
  const searchInput = page.locator('input[type="text"]');
  await searchInput.fill('working printer');
  await page.click('button:has-text("Search")');
  await sleep(6000);

  // Reset to Laundry for next scene
  await page.click('button:has-text("Laundry Machines")');
  await sleep(5000);

  // --- SCENE 4: FACILITY INSPECTION & LIVE GOOGLE ROUTE (21s) ---
  console.log('Scene 4: Facility Inspection & Walking Directions (21s)...');
  const evidenceBtn = page.locator('button:has-text("Evidence & Timeline")').first();
  await evidenceBtn.click();
  await sleep(3000);

  // Scroll modal to show location and route button
  await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]');
    if (dialog) dialog.scrollBy({ top: 300, behavior: 'smooth' });
  });
  await sleep(2000);

  // Click Calculate Walking Time
  const calcRouteBtn = page.locator('button:has-text("Calculate Walking Time")');
  if (await calcRouteBtn.isVisible()) {
    await calcRouteBtn.click();
    await sleep(5000);
  }

  // Scroll down to timeline of reports
  await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]');
    if (dialog) dialog.scrollBy({ top: 400, behavior: 'smooth' });
  });
  await sleep(8000);

  // Close modal
  await page.click('button[aria-label="Close modal"]');
  await sleep(3000);

  // --- SCENE 5: REPORT SUBMISSION FLOW & DEFENSES (17s) ---
  console.log('Scene 5: Student Report Flow (17s)...');
  await page.click('button:has-text("Report")');
  await sleep(3000);

  await page.selectOption('select#facility-select', { index: 1 });
  await sleep(3000);

  const noteBox = page.locator('textarea[placeholder*="Be specific"]');
  if (await noteBox.isVisible()) {
    await noteBox.fill('All washers operational. Cycle running smoothly.');
    await sleep(6000);
  }

  await page.click('button:has-text("Cancel")');
  await sleep(5000);

  // --- SCENE 6: ADMIN MODERATION PANEL (16s) ---
  console.log('Scene 6: Admin Moderation Panel (16s)...');
  await page.goto('http://localhost:5173/#/admin');
  await sleep(4000);

  await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
  await sleep(6000);

  await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
  await sleep(6000);

  // --- SCENE 7: OUTRO & SUBMISSION CREDITS (14s) ---
  console.log('Scene 7: Outro & Submission Credits (14s)...');
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
          background: rgba(34, 197, 94, 0.25);
          border: 1px solid #22c55e;
          color: #4ade80;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 6px 20px;
          border-radius: 9999px;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 52px;
          font-weight: 800;
          margin-bottom: 12px;
          color: #ffffff;
        }
        p {
          font-size: 18px;
          color: #94a3b8;
          max-width: 720px;
          line-height: 1.6;
          margin-bottom: 32px;
        }
        .links-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          max-width: 840px;
          width: 100%;
          margin-bottom: 36px;
        }
        .link-card {
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          padding: 20px;
          text-align: left;
        }
        .link-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #38bdf8;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .link-url {
          font-size: 14px;
          font-family: monospace;
          color: #f1f5f9;
        }
        .footer-team {
          font-size: 16px;
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
  await sleep(14000);

  console.log('Closing page to finalize video recording...');
  await page.close();
  await context.close();
  await browser.close();

  // Find raw video file
  const rawFiles = fs.readdirSync(rawDir).filter(f => f.endsWith('.webm'));
  if (rawFiles.length === 0) {
    throw new Error('No raw video file found');
  }
  const rawVideoPath = path.join(rawDir, rawFiles[0]);
  const audioPath = path.resolve(__dirname, 'artifacts', 'audio', 'full_narration.wav');
  const ffmpegExe = path.resolve(__dirname, 'frontend', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');

  console.log('Muxing video with voice narration audio using ffmpeg...');
  const finalMp4 = path.join(outputDir, 'UsableNow_Demo_Walkthrough.mp4');
  const finalWebm = path.join(outputDir, 'UsableNow_Demo_Walkthrough.webm');

  // Generate standard MP4 with AAC audio
  const cmdMp4 = `"${ffmpegExe}" -y -i "${rawVideoPath}" -i "${audioPath}" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${finalMp4}"`;
  console.log('Running:', cmdMp4);
  execSync(cmdMp4, { stdio: 'inherit' });

  // Generate WebM with Opus audio
  const cmdWebm = `"${ffmpegExe}" -y -i "${rawVideoPath}" -i "${audioPath}" -c:v libvpx-vp9 -c:a libopus -b:a 128k -shortest "${finalWebm}"`;
  console.log('Running:', cmdWebm);
  execSync(cmdWebm, { stdio: 'inherit' });

  // Copy to user's Downloads folder
  const downloadsDir = 'C:\\Users\\Ronak Jain\\Downloads';
  fs.copyFileSync(finalMp4, path.join(downloadsDir, 'UsableNow_Demo_Walkthrough.mp4'));
  fs.copyFileSync(finalWebm, path.join(downloadsDir, 'UsableNow_Demo_Walkthrough.webm'));

  console.log('SUCCESS! Both narrated MP4 and WebM videos generated and saved to:');
  console.log('1.', finalMp4, `(${(fs.statSync(finalMp4).size / 1024 / 1024).toFixed(2)} MB)`);
  console.log('2.', finalWebm, `(${(fs.statSync(finalWebm).size / 1024 / 1024).toFixed(2)} MB)`);
  console.log('Copied to Downloads folder successfully!');
}

run().catch(err => {
  console.error('Error during video recording:', err);
  process.exit(1);
});

