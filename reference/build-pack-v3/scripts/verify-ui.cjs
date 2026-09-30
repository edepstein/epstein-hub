'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const ui = path.join(root, 'ui');
const qa = path.join(root, 'qa');
async function main() {
  fs.mkdirSync(qa, { recursive: true });
  const options = { headless: true, args: ['--no-sandbox'] };
  if (process.env.WORDCLUB_CHROMIUM) options.executablePath = process.env.WORDCLUB_CHROMIUM;
  const browser = await chromium.launch(options);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push({ type: 'uncaught', message: err.message }));
  page.on('console', msg => { if (msg.type() === 'error') errors.push({ type: 'console', message: msg.text() }); });
  const files = fs.readdirSync(ui).filter(f => f.endsWith('.html') && f !== 'hexabble.html').sort();
  assert.equal(files.length, 25, 'Expected 23 screens and two canonical aliases');
  const result = { checkedAt: new Date().toISOString(), scope: 'UI smoke verification only; no public-readiness or real-user-testing claim', screens: [], walkthroughs: [], errors, screenshotReview: { reviewer: 'design critic agent and primary agent', reviewedFiles: ['ui/letter-wheel-desktop.png', 'ui/home-mobile.png'], review: 'V2 screenshots reviewed for shared identity and distinct board silhouettes. Critic requested clearer Ladder destination, visible deduction symbols, mobile spacing and birthday hub layout; refinements implemented. Not testing with the intended recipient.' } };
  const goto = async slug => page.goto(pathToFileURL(path.join(ui, slug + '.html')).href);
  try {
    for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const file of files) {
        await goto(file.slice(0, -5));
        await page.locator('main h1').waitFor();
        assert.equal(await page.locator('main').count(), 1, file + ': one main landmark');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
        assert.equal(overflow, false, file + ': no horizontal page overflow at ' + viewport.name);
        result.screens.push({ file, viewport: viewport.name, heading: await page.locator('main h1').innerText(), rendered: true, horizontalOverflow: false });
      }
    }
    result.enlargedTextChecks = [];
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const file of files) {
        await goto(file.slice(0, -5));
        await page.locator('#text-size').click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, file + ': enlarged text at ' + width);
        result.enlargedTextChecks.push({ file, width, enlargedText: true, horizontalOverflow: false });
      }
    }
    await goto('word-deduction');
    assert.equal(await page.locator('.feedback-mark').count(), 5, 'Visible colour-independent feedback marks');
    await page.locator('#word-input').fill('CHARM');
    await page.locator('#word-form button[type=submit]').click();
    assert.equal(await page.locator('.feedback-mark').count(), 10, 'New guesses retain visible feedback marks');
    assert.equal(await page.locator('#status').innerText(), 'Solved: CHARM. Well found.');
    await goto('word-ladder');
    assert.equal(await page.locator('.ladder-target').count(), 1, 'Destination separate from legal steps');
    assert.equal((await page.locator('.ladder-gap').innerText()).includes('COLD'), true);
    const sequences = [
      ['word-ladder', ['CORD', 'CARD', 'WARD', 'WARM'], 'Reached WARM in 4 moves. Optimal: 4.'],
      ['clue-pairs', ['CRANE', 'BARK', 'BAT'], 'All three sample pairs solved.'],
      ['anagram-relay', ['ASTERN', 'PARENTS', 'PARTNERS'], 'Relay complete: STARE → ASTERN → PARENTS → PARTNERS.'],
      ['shrinking-staircase', ['MEAT', 'MAT', 'AT'], 'Complete: STEAM → MEAT → MAT → AT.']
    ];
    for (const [slug, words, expected] of sequences) {
      await goto(slug);
      for (const word of words) { await page.locator('#word-input').fill(word); await page.locator('#word-form button[type=submit]').click(); }
      const actual = await page.locator('#status').innerText();
      assert.equal(actual, expected, slug + ': expected completion');
      result.walkthroughs.push({ game: slug, inputs: words, status: actual, passed: true });
    }
    await goto('definition-detective');
    for (let i = 0; i < 3; i++) { await page.locator('input[name=definition][value="0"]').check(); await page.locator('input[name=evidence][value="0"]').check(); await page.locator('#check-detective').click(); }
    const detective = await page.locator('#status').innerText();
    assert.equal(detective, 'All three cases solved with supporting evidence.');
    result.walkthroughs.push({ game: 'definition-detective', inputs: 'Correct definition and evidence in each of three cases', status: detective, passed: true });
    await goto('word-weave');
    const cells = [[1,0,'C'],[1,1,'R'],[1,2,'A'],[1,3,'N'],[1,4,'E'],[0,2,'B'],[2,2,'R'],[3,2,'K'],[3,3,'I'],[3,4,'T'],[3,5,'E']];
    for (const [r, c, letter] of cells) await page.locator('#cell-' + r + '-' + c).fill(letter);
    await page.locator('#check-weave').click();
    const weave = await page.locator('#status').innerText();
    assert.equal(weave, 'Solved: all three lanes agree at both crossings.');
    result.walkthroughs.push({ game: 'word-weave', inputs: cells, status: weave, passed: true });
    await goto('letter-wheel');
    assert.equal(await page.locator('#difficulty option').first().innerText(), 'Gentle');
    await page.locator('#hint').click();
    assert.equal(await page.locator('[role=dialog]').count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[role=dialog]').count(), 0);
    assert.equal(await page.locator('#hint').evaluate(el => el === document.activeElement), true, 'Hint restores keyboard focus');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(ui, 'letter-wheel-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await goto('index');
    assert.equal(await page.locator('main > .cards > a.card').count(), 4, 'Four featured home games');
    await page.screenshot({ path: path.join(ui, 'home-mobile.png'), fullPage: true });
    assert.deepEqual(errors, [], 'No console or uncaught JavaScript errors');
    result.passed = true;
    result.summary = { renderChecks: result.screens.length, enlargedTextChecks: result.enlargedTextChecks.length, visibleDeductionFeedback: true, separatedLadderTarget: true, distinctPages: files.length, completedGameFlows: result.walkthroughs.length, errorCount: errors.length, hintEscapeAndFocusRecovery: true, gentleDifficultyLabel: true, featuredGames: 4 };
    fs.writeFileSync(path.join(qa, 'ui-verification.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result.summary));
  } finally { await browser.close(); }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
