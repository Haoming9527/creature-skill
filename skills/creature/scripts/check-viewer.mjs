#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import { startServer } from './lib/server.mjs';
import { openBrowser, openStudio } from './lib/browser.mjs';
import { parseArgs, writeJSON, isMain } from './lib/common.mjs';
export async function checkViewer(directory, output) {
  const server = await startServer(directory); let browser;
  const checks = []; const record = (name, passed, evidence) => checks.push({ name, passed: !!passed, evidence });
  try {
    browser = await openBrowser(); const { page, errors } = await openStudio(browser, `${server.url}/?capture=1`);
    const bone = (name) => page.evaluate(n => { const o = window.creatureStudio.model.root.getObjectByName(n); return o ? [...o.quaternion.toArray(), ...o.position.toArray()] : null; }, name);
    const spec = await page.evaluate(() => window.creatureStudio.spec);
    const beforeJaw = await bone('Jaw'); if (spec.behavior.jawLimit > 0) await page.locator('#jaw').fill('0.7'); const afterJaw = await bone('Jaw');
    record('Jaw control respects the specified joint range', spec.behavior.jawLimit > 0 ? beforeJaw && afterJaw && JSON.stringify(beforeJaw) !== JSON.stringify(afterJaw) : await page.locator('#jaw').isDisabled() && JSON.stringify(beforeJaw) === JSON.stringify(afterJaw), { limit:spec.behavior.jawLimit, beforeJaw, afterJaw });
    const beforeHead = await bone('Head'); if (spec.behavior.headYawLimit > 0) await page.locator('#lookX').fill('0.6'); const afterHead = await bone('Head');
    record('Head control respects the specified joint range', spec.behavior.headYawLimit > 0 ? beforeHead && afterHead && JSON.stringify(beforeHead) !== JSON.stringify(afterHead) : await page.locator('#lookX').isDisabled() && JSON.stringify(beforeHead) === JSON.stringify(afterHead), { limit:spec.behavior.headYawLimit, beforeHead, afterHead });
    await page.locator('#clay-view').click(); record('Clay control changes surface mode', await page.locator('#clay-view').getAttribute('aria-pressed') === 'true', await page.evaluate(() => window.creatureStudio.state.clay));
    await page.locator('#material-view').click();
    await page.locator('#pose').selectOption('walk'); await page.locator('#speed').fill('1.4');
    await page.evaluate(() => window.creatureStudio.step(.47));
    record('Walk and speed controls reach motion system', await page.evaluate(() => window.creatureStudio.state.pose === 'walk' && window.creatureStudio.state.speed === 1.4), await page.evaluate(() => window.creatureStudio.model.diagnostics));
    const attachment = spec.attachments.find(a => a.region === 'head') || spec.attachments[0];
    if (attachment) {
      await page.locator('#part').selectOption(attachment.id);
      const anchorA = await page.evaluate(id => window.creatureStudio.getAnchorPositions()[id], attachment.id);
      if (spec.behavior.headYawLimit > 0) await page.locator('#lookX').fill('-0.7'); await page.evaluate(() => window.creatureStudio.step(.9));
      const anchorB = await page.evaluate(id => window.creatureStudio.getAnchorPositions()[id], attachment.id);
      record('Body label selects a live declared attachment', await page.locator('#part-label').isVisible() && anchorA?.length === 3 && anchorB?.every(Number.isFinite), { attachment, anchorA, anchorB, text: await page.locator('#part-label').innerText() });
      const labelProjection = await page.evaluate(id => {
        const s=window.creatureStudio,element=document.querySelector('#part-label');
        const point=s.model.attachments[id].getWorldPosition(s.camera.position.clone()).project(s.camera);
        const stage=document.querySelector('#canvas');
        const expected=[(point.x*.5+.5)*stage.clientWidth,(-point.y*.5+.5)*stage.clientHeight];
        const actual=[parseFloat(element.style.left),parseFloat(element.style.top)];
        return {expected,actual,errorPixels:Math.hypot(actual[0]-expected[0],actual[1]-expected[1])};
      },attachment.id);
      record('Moving body label stays at its projected attachment',labelProjection.errorPixels<1,labelProjection);
    } else record('Label controls are disabled when no attachments are declared', await page.locator('#part').isDisabled() && await page.locator('#labels').isDisabled() && !(await page.locator('#part-label').isVisible()), { attachments:[] });
    const ground = await page.evaluate(() => {
      const s=window.creatureStudio, floorY=s.scene.getObjectByName('Ground').position.y;
      return { floorY, stanceContacts:Object.values(s.model.diagnostics.feet).filter(f=>f.stance).map(f=>f.contact[1]) };
    });
    record('Stance contacts match the visible floor height', ground.floorY === 0 && ground.stanceContacts.length > 0 && ground.stanceContacts.every(y => Math.abs(y-ground.floorY)<0.0001), ground);
    const cameraBefore = await page.evaluate(() => window.creatureStudio.camera.position.toArray()); await page.locator('[data-view=front]').click();
    const cameraAfter = await page.evaluate(() => window.creatureStudio.camera.position.toArray()); record('Fixed camera controls change view', JSON.stringify(cameraBefore) !== JSON.stringify(cameraAfter), { cameraBefore, cameraAfter });
    const canvas=await page.locator('#canvas canvas').boundingBox();
    const orbitBefore=await page.evaluate(()=>window.creatureStudio.camera.position.toArray());
    await page.mouse.move(canvas.x+canvas.width*.5,canvas.y+canvas.height*.5);
    await page.mouse.down();await page.mouse.move(canvas.x+canvas.width*.5+110,canvas.y+canvas.height*.5+32,{steps:8});await page.mouse.up();
    await page.evaluate(()=>window.creatureStudio.step(window.creatureStudio.state.time));
    const orbitAfter=await page.evaluate(()=>window.creatureStudio.camera.position.toArray());
    record('Pointer drag orbits the creature',orbitAfter.every(Number.isFinite)&&Math.hypot(...orbitAfter.map((v,i)=>v-orbitBefore[i]))>.05,{before:orbitBefore,after:orbitAfter});
    await page.mouse.wheel(0,-220);
    await page.evaluate(()=>window.creatureStudio.step(window.creatureStudio.state.time));
    const zoomAfter=await page.evaluate(()=>window.creatureStudio.camera.position.toArray());
    record('Pointer wheel zooms the creature',zoomAfter.every(Number.isFinite)&&Math.hypot(...zoomAfter.map((v,i)=>v-orbitAfter[i]))>.05,{before:orbitAfter,after:zoomAfter});
    const downloadPromise = page.waitForEvent('download'); await page.locator('#download-spec').click(); const download = await downloadPromise;
    record('Specification is downloadable', download.suggestedFilename().endsWith('.json'), download.suggestedFilename());
    const longWalk = await page.evaluate(() => {
      const s=window.creatureStudio;s.setControl('pose','walk');s.setControl('speed',1);s.step(60);s.setView('three-quarter');s.step(60);
      const head=s.model.anchors.head.getWorldPosition(s.camera.position.clone()).project(s.camera);
      const result={projectedHead:head.toArray(),submittedTriangles:s.renderer.info.render.triangles,root:s.model.diagnostics.rootDisplacement,skinCulling:s.model.root.getObjectByName('Continuous_Skin').frustumCulled};
      s.step(0);return result;
    });
    record('Long world walk retains visible skin and camera tracking',longWalk.projectedHead.every(Number.isFinite)&&Math.abs(longWalk.projectedHead[0])<1&&Math.abs(longWalk.projectedHead[1])<1&&longWalk.submittedTriangles>10000&&!longWalk.skinCulling,longWalk);
    const desktop = await page.evaluate(async () => {
      const s = window.creatureStudio, durations = [], intervals = []; s.setControl('labels', false); s.setControl('pose', 'walk');
      // Warm shaders and shadow maps before measuring sustained rendering.
      for (let i = 0; i < 30; i++) { s.step(i / 30); await new Promise(requestAnimationFrame); }
      let previous = await new Promise(requestAnimationFrame);
      const measurementStart = previous;
      while (previous - measurementStart < 15000 && intervals.length < 3600) { const start = performance.now(); s.step((previous - measurementStart) / 1000); s.renderer.getContext().finish(); durations.push(performance.now() - start); const now = await new Promise(requestAnimationFrame); intervals.push(now - previous); previous = now; }
      const frameIntervalsMilliseconds=[...intervals],oneSecondFPS=[];
      let windowTime=0,windowFrames=0;
      for(const interval of frameIntervalsMilliseconds){windowTime+=interval;windowFrames++;if(windowTime>=1000){oneSecondFPS.push(windowFrames*1000/windowTime);windowTime=0;windowFrames=0;}}
      const minimumOneSecondFPS=Math.min(...oneSecondFPS);
      durations.sort((a,b)=>a-b); const mean = durations.reduce((a,b)=>a+b,0) / durations.length;
      intervals.sort((a,b)=>a-b); const frameMean = intervals.reduce((a,b)=>a+b,0) / intervals.length;
      return { frames:durations.length, measurementSeconds:(previous-measurementStart)/1000, warmupFrames:30, meanSubmissionMilliseconds:mean, p95SubmissionMilliseconds:durations[Math.floor(durations.length*.95)], meanFrameMilliseconds:frameMean,p95FrameMilliseconds:intervals[Math.floor(intervals.length*.95)], observedFPS:1000/frameMean,minimumOneSecondFPS,oneSecondFPS,frameIntervalsMilliseconds,target30FPS:minimumOneSecondFPS>=30,userAgent:navigator.userAgent,scope:'15 seconds of walking in headless requestAnimationFrame intervals including completed rendering after 30 warmup frames. The 30 FPS target requires every complete one-second measurement window to pass. Actual renderer is recorded; software fallback is not physical GPU evidence. This is not a physical mobile usability certification.', ...s.metrics() };
    });
    desktop.device={kind:'desktop automation host',os:os.type(),release:os.release(),architecture:os.arch(),cpu:os.cpus()[0]?.model??'unavailable',logicalProcessors:os.cpus().length,memoryGiB:Math.round(os.totalmem()/1024**3)};
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.creatureStudio.step(0));
    const layout = await page.evaluate(() => ({ viewport:innerWidth, document:document.documentElement.scrollWidth, scene:document.querySelector('.stage').getBoundingClientRect().toJSON(), controls:document.querySelector('.field-guide').getBoundingClientRect().toJSON() }));
    record('Mobile layout has no horizontal overflow and controls follow scene', layout.document <= layout.viewport && layout.controls.top >= layout.scene.bottom - 1, layout);
    record('No browser or asset errors', errors.length === 0, errors);
    const report = { passed: checks.every(c => c.passed), checks, performance: desktop, browser: await browser.version(), physicalMobilePerformance:'not-tested', visualApproval:'pending', anatomicalApproval:'pending' };
    await writeJSON(path.resolve(output || path.join(directory, 'browser-checks.json')), report);
    return report;
  } finally { await browser?.close(); await server.close(); }
}
if (isMain(import.meta.url)) { const args=parseArgs(); if (!args._[0]) { console.error('Usage: node scripts/check-viewer.mjs <viewer folder> [--out report.json]'); process.exitCode=1; } else try { const r=await checkViewer(args._[0],args.out); console.log(JSON.stringify({passed:r.passed,checks:r.checks.map(c=>({name:c.name,passed:c.passed})),performance:r.performance},null,2));if(!r.passed)process.exitCode=1; }catch(e){console.error(e.stack);process.exitCode=1;} }
