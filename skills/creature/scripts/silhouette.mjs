#!/usr/bin/env node
// Lateral silhouette comparison against a side-view reference photograph.
// Measures shape agreement only; it is review evidence, not anatomical approval.
import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { createCreature } from '../kit/creature.mjs';
import { decodePNG, encodePNG } from './lib/png.mjs';
import { parseArgs, writeJSON, isMain } from './lib/common.mjs';

const RES = 400; // model mask pixels per metre

/** Rasterise every triangle of the idle creature onto the sagittal (XY) plane. */
export function modelMask(spec, { pose = 'idle', time = 0 } = {}) {
  const creature = createCreature(spec);
  try {
    creature.update(time, { pose, breathing: false }); creature.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(creature.root), x0 = box.min.x - .05, y0 = 0;
    const width = Math.ceil((box.max.x + .05 - x0) * RES), height = Math.ceil((box.max.y + .05) * RES), mask = new Uint8Array(width * height);
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    creature.root.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      const pos = o.geometry.getAttribute('position'), index = o.geometry.index, count = index ? index.count : pos.count;
      const world = new Float32Array(pos.count * 2), p = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { o.getVertexPosition(i, p); p.applyMatrix4(o.matrixWorld); world[i * 2] = (p.x - x0) * RES; world[i * 2 + 1] = (p.y - y0) * RES; }
      for (let t = 0; t < count; t += 3) {
        const ids = [0, 1, 2].map(k => index ? index.getX(t + k) : t + k);
        ids.forEach((id, k) => v[k].set(world[id * 2], world[id * 2 + 1], 0));
        const [a, b, c] = v, area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); if (Math.abs(area) < 1e-9) continue;
        const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
        const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), maxY = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
          const px = x + .5, py = y + .5;
          const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) / area, w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) / area;
          if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) mask[y * width + x] = 1;
        }
      }
    });
    return { mask, width, height, x0, y0, metrics: creature.metrics };
  } finally { creature.dispose(); }
}

/** Foreground of a light-background photograph; facing +X (animal's head to the right). */
export function referenceMask(png, threshold = 215) {
  const { width, height, pixels } = png, mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) { const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2], a = pixels[i * 4 + 3]; mask[i] = a > 128 && Math.min(r, g, b) < threshold ? 1 : 0; }
  let ground = 0; for (let y = height - 1; y >= 0 && !ground; y--) for (let x = 0; x < width; x++) if (mask[y * width + x]) { ground = y + 1; break; }
  return { mask, width, height, ground };
}

/** Uniform-scale, ground-anchored fit maximising intersection over union. */
export function compare(model, ref) {
  const sample = (s, ox, x, y) => { const mx = Math.floor(((x + .5) / s + ox - model.x0) * RES), my = Math.floor(((ref.ground - y - .5) / s) * RES); return mx >= 0 && my >= 0 && mx < model.width && my < model.height ? model.mask[my * model.width + mx] : 0; };
  let refRows = 0; for (let y = 0; y < ref.height; y++) for (let x = 0; x < ref.width; x++) if (ref.mask[y * ref.width + x]) { refRows = ref.ground - y; y = ref.height; break; }
  const modelHeight = model.height / RES - .05, nominal = refRows / modelHeight;
  let best = { iou: -1 };
  const evaluate = (s, ox) => { let inter = 0, union = 0; for (let y = 0; y < ref.height; y += 1) for (let x = 0; x < ref.width; x++) { const r = ref.mask[y * ref.width + x], m = sample(s, ox, x, y); inter += r & m; union += r | m; } return inter / union; };
  for (let s = nominal * .8; s <= nominal * 1.25; s += nominal * .01) for (let ox = model.x0 - .5; ox <= model.x0 + .8; ox += .02) { const iou = evaluate(s, ox); if (iou > best.iou) best = { iou, s, ox }; }
  for (let s = best.s - nominal * .01; s <= best.s + nominal * .01; s += nominal * .002) for (let ox = best.ox - .02; ox <= best.ox + .02; ox += .004) { const iou = evaluate(s, ox); if (iou > best.iou) best = { iou, s, ox }; }
  return { ...best, sample: (x, y) => sample(best.s, best.ox, x, y) };
}

export async function silhouetteMain(args = parseArgs()) {
  const [specPath] = args._;
  if (!specPath || !args.reference) throw new Error('Usage: node scripts/silhouette.mjs spec.json --reference side.png [--out dir] [--threshold 215]');
  const spec = JSON.parse(await fs.readFile(specPath, 'utf8')), out = path.resolve(args.out ?? 'out/silhouette');
  const ref = referenceMask(decodePNG(await fs.readFile(args.reference)), Number(args.threshold ?? 215)), model = modelMask(spec), fit = compare(model, ref);
  const zoom = 3, width = ref.width * zoom, height = ref.height * zoom, pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const rx = Math.floor(x / zoom), ry = Math.floor(y / zoom), r = ref.mask[ry * ref.width + rx], m = fit.sample((x + .5) / zoom - .5, (y + .5) / zoom - .5), o = (y * width + x) * 4;
    const color = r && m ? [120, 120, 120] : r ? [220, 40, 40] : m ? [30, 140, 230] : [250, 250, 250];
    pixels.set([...color, 255], o);
  }
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, 'silhouette-overlay.png'), encodePNG({ width, height, pixels }));
  // Column profiles in metres: reference vs model dorsal/ventral extents.
  const columns = [];
  for (let x = 0; x < ref.width; x += 5) {
    const extent = get => { let top = null, bottom = null; for (let y = 0; y < ref.height; y++) if (get(x, y)) { top ??= y; bottom = y; } return top === null ? null : [(ref.ground - top) / fit.s, (ref.ground - bottom) / fit.s]; };
    columns.push({ x: +((x + .5) / fit.s + fit.ox).toFixed(3), reference: extent((a, b) => ref.mask[b * ref.width + a])?.map(v => +v.toFixed(3)) ?? null, model: extent(fit.sample)?.map(v => +v.toFixed(3)) ?? null });
  }
  const report = { spec: specPath, reference: path.basename(args.reference), iou: +fit.iou.toFixed(4), pixelsPerMetre: +fit.s.toFixed(2), note: 'Red: reference only. Blue: model only. Grey: agreement. Uniform scale, ground-anchored fit; idle pose. Silhouette agreement is not anatomical approval.', columns };
  await writeJSON(path.join(out, 'silhouette.json'), report);
  console.log(JSON.stringify({ iou: report.iou, pixelsPerMetre: report.pixelsPerMetre, out }, null, 2));
  return report;
}
if (isMain(import.meta.url)) silhouetteMain().catch(error => { console.error(error.message); process.exitCode = 1; });
