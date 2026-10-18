import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BASES } from '../kit/bases/ungulates.mjs';
import { createHeadWarp } from '../kit/warp.mjs';

const spec = BASES.thoroughbred.headWarp, origin = new THREE.Vector3(...spec.origin), warp = createHeadWarp(spec, origin, 1);

test('head landmark warp leaves the body in place and stays near the head joints', () => {
  for (const p of [[0, 1.3, .2], [.7, 1.5, .1], [-1, 1.4, 0]]) { const v = new THREE.Vector3(...p); assert.equal(warp(v).distanceTo(v), 0, `moved ${p}`); }
  // Bones are not warped; tissue at their pivots may shift only a few millimetres.
  for (const p of [BASES.thoroughbred.headPivot, BASES.thoroughbred.ear, BASES.thoroughbred.neckPivot]) { const v = new THREE.Vector3(...p); assert.ok(warp(v).distanceTo(v) < 5e-3, `moved ${p}`); }
  // The deepened jowl moves cheek tissue about 1.5 cm from the jaw pivot; at
  // the .1 rad jaw limit that is a ~1.5 mm arc difference, so keep it bounded.
  const jaw = new THREE.Vector3(...BASES.thoroughbred.jawPivot); assert.ok(warp(jaw).distanceTo(jaw) < .02, 'jaw pivot tissue moved too far');
});

test('head landmark warp shortens the face and keeps a positive Jacobian (no folds)', () => {
  const U = new THREE.Vector3(Math.cos(spec.angle), -Math.sin(spec.angle), 0), Vn = new THREE.Vector3(Math.sin(spec.angle), Math.cos(spec.angle), 0);
  const tip = origin.clone().addScaledVector(U, .78).addScaledVector(Vn, .02);
  assert.ok(warp(tip).sub(origin).dot(U) < .66, 'face length should be reduced toward a .63 m reference head');
  const e = 1e-4, J = new THREE.Matrix3();
  for (let u = -.1; u <= .85; u += .025) for (let v = -.75; v <= .15; v += .025) for (const z of [0, .05, .1]) {
    const p = origin.clone().addScaledVector(U, u).addScaledVector(Vn, v).setZ(z), c = [0, 1, 2].map(k => { const a = p.clone(), b = p.clone(); a.setComponent(k, a.getComponent(k) + e); b.setComponent(k, b.getComponent(k) - e); return warp(a).sub(warp(b)).divideScalar(2 * e); });
    J.set(c[0].x, c[1].x, c[2].x, c[0].y, c[1].y, c[2].y, c[0].z, c[1].z, c[2].z);
    assert.ok(J.determinant() > .2, `fold at u=${u.toFixed(3)} v=${v.toFixed(3)}`);
  }
});
