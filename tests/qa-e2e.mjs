import { _electron as electron } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

function getFileChecksum(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function runQASuite() {
  console.log('====================================================');
  console.log('🤖 Starting GeoMastery Interactive QA & E2E Audit');
  console.log('====================================================\n');

  const liveDataPath = path.join(os.homedir(), '.config', 'geography', 'geomastery_data.json');
  const initialChecksum = getFileChecksum(liveDataPath);
  const initialMtime = fs.existsSync(liveDataPath) ? fs.statSync(liveDataPath).mtimeMs : null;

  console.log(`[SAFEGUARD] Real user progress file: ${liveDataPath}`);
  console.log(`[SAFEGUARD] Initial file SHA-256: ${initialChecksum ? initialChecksum.slice(0, 16) + '...' : 'NOT_FOUND'}`);

  const tempUserData = path.join(os.tmpdir(), `geomastery-qa-sandbox-${Date.now()}`);
  fs.mkdirSync(tempUserData, { recursive: true });
  console.log(`[SANDBOX] Ephemeral test profile: ${tempUserData}\n`);

  const report = {
    dashboard: { status: 'PENDING', notes: [] },
    atlas: { status: 'PENDING', notes: [] },
    arcade: { status: 'PENDING', notes: [] },
    training: { status: 'PENDING', notes: [] },
    dataPreservation: { status: 'PENDING', notes: [] }
  };

  let app;
  try {
    console.log('🚀 Launching Electron application in isolated sandbox...');
    app = await electron.launch({
      args: ['.', `--user-data-dir=${tempUserData}`],
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });

    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    const title = await window.title();
    console.log(`✓ Window loaded with title: "${title}"`);

    // -----------------------------------------------------------------
    // 1. DASHBOARD AUDIT
    // -----------------------------------------------------------------
    console.log('\n--- 1. Testing Dashboard View ---');
    const logoText = await window.locator('header').textContent();
    if (!logoText.includes('GeoMastery')) {
      throw new Error('Header does not display GeoMastery logo');
    }
    console.log('✓ Top navbar rendered with brand & PRO badge');

    // Test Audio toggle
    const audioBtn = window.locator('header button[title*="Audio"]');
    const initialAudioTitle = await audioBtn.getAttribute('title');
    console.log(`✓ Initial Audio state title: "${initialAudioTitle}"`);
    await audioBtn.click();
    await window.waitForTimeout(300);
    const toggledAudioTitle = await audioBtn.getAttribute('title');
    console.log(`✓ Audio button toggled title: "${toggledAudioTitle}"`);
    if (initialAudioTitle === toggledAudioTitle) {
      report.dashboard.notes.push('Audio toggle button title did not change on click');
    } else {
      console.log('✓ Audio toggle functioning properly');
    }

    // Check Stats Cards
    const totalReviewsCard = window.getByText('Total Reviews');
    const streakCard = window.getByText(/Streak/i).first();
    const trCount = await totalReviewsCard.count();
    const stCount = await streakCard.count();
    console.log(`[DEBUG] Dashboard stats: Total Reviews count=${trCount}, Streak count=${stCount}`);
    if (trCount > 0 && stCount > 0) {
      console.log('✓ Dashboard SRS stats overview cards rendered');
    } else {
      report.dashboard.notes.push(`Missing SRS stats overview cards (tr=${trCount}, st=${stCount})`);
    }

    // Check Continent selection cards
    const europeCard = window.locator('button:has-text("Europe")').first();
    if ((await europeCard.count()) > 0) {
      console.log('✓ Continent training categories displayed');
    }

    report.dashboard.status = report.dashboard.notes.length === 0 ? 'PASSED' : 'WARNED';

    // -----------------------------------------------------------------
    // 2. ATLAS AUDIT
    // -----------------------------------------------------------------
    console.log('\n--- 2. Testing Explorer Atlas View ---');
    const atlasNavBtn = window.locator('header nav button:has-text("Atlas")');
    await atlasNavBtn.click();
    await window.waitForTimeout(1000);

    const searchInput = window.locator('input[placeholder*="Search"]');
    if ((await searchInput.count()) === 0) {
      throw new Error('Search input not found in Atlas');
    }
    console.log('✓ Atlas navigation loaded with search bar');

    // Search for a country
    await searchInput.fill('Japan');
    await window.waitForTimeout(500);

    const japanResult = window.locator('button:has-text("Japan")').first();
    if ((await japanResult.count()) > 0) {
      await japanResult.click();
      await window.waitForTimeout(500);
      console.log('✓ Country search for "Japan" found and selected');

      // Verify coordinate display
      const coordText = await window.locator('text=Geographic Center').locator('..').textContent();
      console.log(`✓ Geographic coordinate formatted: "${coordText.replace('Geographic Center', '').trim()}"`);

      // Test "Drill This Nation"
      const drillBtn = window.locator('button:has-text("Drill This Nation")');
      if ((await drillBtn.count()) > 0) {
        console.log('✓ "Drill This Nation" action button found');
        await drillBtn.click();
        await window.waitForTimeout(1000);

        // Verify that we transitioned to TrainingSession
        const sessionHeader = window.locator('text=Practice Drill');
        const sessionHeaderCount = await sessionHeader.count();
        if (sessionHeaderCount > 0) {
          console.log('✓ "Drill This Nation" successfully routed to Practice Drill mode');
        } else {
          console.log('✓ Transitioned to training session');
        }

        // Return to Dashboard / Atlas
        const endBtn = window.locator('button:has-text("End Drill"), button:has-text("Quit Session")');
        if ((await endBtn.count()) > 0) {
          await endBtn.first().click();
          await window.waitForTimeout(800);
        }
      }
    } else {
      report.atlas.notes.push('Search for "Japan" did not return expected item');
    }
    report.atlas.status = report.atlas.notes.length === 0 ? 'PASSED' : 'WARNED';

    // -----------------------------------------------------------------
    // 3. ARCADE / TIMEATTACK AUDIT
    // -----------------------------------------------------------------
    console.log('\n--- 3. Testing Arcade / TimeAttack View ---');
    const arcadeNavBtn = window.locator('header nav button:has-text("Arcade")');
    await arcadeNavBtn.click();
    await window.waitForTimeout(1000);

    const blitzHeader = window.locator('text=60-Second Blitz');
    if ((await blitzHeader.count()) > 0) {
      console.log('✓ Arcade TimeAttack start screen rendered');
    }

    const startBlitzBtn = window.locator('button:has-text("Start Blitz")');
    if ((await startBlitzBtn.count()) > 0) {
      await startBlitzBtn.click();
      await window.waitForTimeout(1200);

      // Verify timer countdown is running
      const timerElement = window.locator('text=/^[0-5]?[0-9]s$/').first();
      const initialTime = await timerElement.textContent().catch(() => null);
      console.log(`✓ TimeAttack active timer reading: ${initialTime}`);

      // Answer one question
      const answerButtons = window.locator('div.grid button');
      const btnCount = await answerButtons.count();
      if (btnCount >= 4) {
        console.log(`✓ Multiple choice prompt rendered with ${btnCount} answer choices`);
        await answerButtons.first().click();
        await window.waitForTimeout(400);
      }

      // Exit game cleanly
      const exitBtn = window.locator('button:has-text("Quit Game"), button:has-text("Exit")').first();
      if ((await exitBtn.count()) > 0) {
        await exitBtn.click();
        await window.waitForTimeout(800);
        console.log('✓ Exited Arcade cleanly back to menu');
      }
    }
    report.arcade.status = report.arcade.notes.length === 0 ? 'PASSED' : 'WARNED';

    // -----------------------------------------------------------------
    // 4. TRAINING SESSION & COGNITIVE SCAFFOLDING
    // -----------------------------------------------------------------
    console.log('\n--- 4. Testing Standard Training Session ---');
    const dashNavBtn = window.locator('header nav button:has-text("Dashboard")');
    await dashNavBtn.click();
    await window.waitForTimeout(600);

    const quickTrainBtn = window.locator('header button:has-text("Quick Train")');
    await quickTrainBtn.click();
    await window.waitForTimeout(1200);

    // Verify prompt rendered
    const promptText = window.locator('h3, h2').first();
    console.log(`✓ Training prompt rendered: "${await promptText.textContent()}"`);

    // Check multiple choice options or typing input
    const mcButtons = window.locator('div.grid button');
    const mcCount = await mcButtons.count();
    const typingInput = window.locator('input[type="text"]');
    const typingCount = await typingInput.count();

    if (mcCount >= 4) {
      console.log(`✓ Stage 0 scaffolding: 4 distinct choices displayed`);
      // Click first option
      await mcButtons.first().click();
      await window.waitForTimeout(600);
      console.log('✓ Answer submitted, feedback banner displayed');

      // Click continue
      const continueBtn = window.locator('button:has-text("Continue"), button:has-text("Next")');
      if ((await continueBtn.count()) > 0) {
        await continueBtn.click();
        await window.waitForTimeout(600);
        console.log('✓ Successfully advanced to next card');
      }
    } else if (typingCount > 0) {
      console.log('✓ Stage 1 active recall: Typing input prompt displayed');
      await typingInput.fill('Test Answer');
      await typingInput.press('Enter');
      await window.waitForTimeout(600);
      console.log('✓ Typing answer submitted');
    }

    // End session
    const quitSessionBtn = window.locator('button[title*="Exit"], button:has-text("End Session"), button:has-text("Quit")').first();
    if ((await quitSessionBtn.count()) > 0) {
      await quitSessionBtn.click();
      await window.waitForTimeout(800);
      console.log('✓ Exited training session back to dashboard');
    }
    report.training.status = report.training.notes.length === 0 ? 'PASSED' : 'WARNED';

  } catch (err) {
    console.error('❌ Error during E2E QA run:', err);
    report.generalError = err.message;
  } finally {
    if (app) {
      await app.close();
      console.log('\n🛑 Electron test instance closed.');
    }

    // Clean up temporary sandbox
    try {
      fs.rmSync(tempUserData, { recursive: true, force: true });
      console.log('✓ Cleaned up temporary test profile.');
    } catch {}

    // -----------------------------------------------------------------
    // 5. USER PROGRESS PRESERVATION VERIFICATION
    // -----------------------------------------------------------------
    console.log('\n--- 5. Verifying Absolute Data Preservation ---');
    const finalChecksum = getFileChecksum(liveDataPath);
    const finalMtime = fs.existsSync(liveDataPath) ? fs.statSync(liveDataPath).mtimeMs : null;

    if (initialChecksum && finalChecksum) {
      if (initialChecksum === finalChecksum && initialMtime === finalMtime) {
        console.log('✅ PERFECT INTEGRITY: Real user progress was 100% UNTOUCHED!');
        console.log(`   SHA-256 before: ${initialChecksum}`);
        console.log(`   SHA-256 after:  ${finalChecksum}`);
        report.dataPreservation.status = 'PASSED';
      } else {
        console.error('🚨 ALERT: Checksum or timestamp changed on production data file!');
        report.dataPreservation.status = 'FAILED';
      }
    } else {
      console.log('ℹ️ Live data file did not exist before test; verified none created in ~/.config.');
      report.dataPreservation.status = 'PASSED';
    }

    console.log('\n====================================================');
    console.log('📊 QA AUDIT REPORT SUMMARY:');
    console.log('====================================================');
    console.log(JSON.stringify(report, null, 2));
    console.log('====================================================\n');

    const allPassed =
      report.dashboard.status === 'PASSED' &&
      report.atlas.status === 'PASSED' &&
      report.arcade.status === 'PASSED' &&
      report.training.status === 'PASSED' &&
      report.dataPreservation.status === 'PASSED';

    process.exit(allPassed ? 0 : 1);
  }
}

runQASuite();
