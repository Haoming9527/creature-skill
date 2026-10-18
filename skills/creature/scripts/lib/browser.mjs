import { chromium } from 'playwright';
export async function openBrowser(options = {}) {
  // Modern headless Chromium can use the device GPU. Report the actual renderer
  // in every capture so software fallback is never mistaken for device evidence.
  const settings = { headless: true, args: ['--enable-gpu', '--enable-webgl'], ...options };
  try { return await chromium.launch(settings); }
  catch (error) {
    if (!/Executable doesn't exist|browser.*not found/i.test(error.message)) throw error;
    try { return await chromium.launch({ ...settings, channel: 'chrome' }); }
    catch { throw new Error('Chromium is unavailable. Run npx playwright install chromium from the skill directory, then retry.'); }
  }
}
export async function openStudio(browser, url, viewport = { width: 1440, height: 1000 }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.creatureStudio?.ready || window.creatureStudioError, { timeout: 60000 });
  const error = await page.evaluate(() => window.creatureStudioError);
  if (error) { await page.close(); throw new Error(error); }
  await page.evaluate(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); window.creatureStudio.step(0); if (window.creatureStudio.metrics().drawCalls < 1) throw new Error('Viewer rendered no geometry.'); });
  return { page, errors };
}
