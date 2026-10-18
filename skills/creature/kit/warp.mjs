import * as THREE from 'three';

const smooth = THREE.MathUtils.smoothstep;
const table = (rows, x) => {
  if (x <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) if (x <= rows[i][0]) { const [a, va] = rows[i - 1], [b, vb] = rows[i], t = (x - a) / (b - a); return va + (vb - va) * t; }
  return rows.at(-1)[1];
};
// C1 ramp: 0 below -w, identity above +w.
const ramp = (t, w) => t <= -w ? 0 : t >= w ? t : (t + w) ** 2 / (4 * w);

/** Smooth sagittal landmark warp in a head-aligned frame. Distances are in
 * head-scale units, so proportion edits keep the same anatomical result.
 *   u: along the facial axis from the poll, v: dorsal normal.
 *  - Beyond `faceStart`, the face is shortened/lengthened by `faceLength`.
 *  - Below `depthLine`, tissue depth is scaled by the `depth` table (old u).
 *  - `width` scales lateral depth along the axis.
 * Regions behind the poll and beneath the head mask are untouched. */
export function createHeadWarp(spec, origin, scale) {
  const angle = spec.angle, U = new THREE.Vector3(Math.cos(angle), -Math.sin(angle), 0), Vn = new THREE.Vector3(Math.sin(angle), Math.cos(angle), 0);
  const { faceStart, faceBlend, faceLength, depthLine, depth, width = [[0, 1]], dorsal, maskBelow, maskBand = .25, depthCap = .28 } = spec;
  const local = new THREE.Vector3();
  return p => {
    local.copy(p).sub(origin);
    const u = local.dot(U) / scale, v = local.dot(Vn) / scale, mask = smooth(v, maskBelow, maskBelow + maskBand);
    if (mask <= 0 || u < -.05) return p.clone();
    const line = table(dorsal, u), du = -(1 - faceLength) * ramp(u - faceStart, faceBlend);
    // Depth gain saturates beneath the jaw, so the throat moves by a bounded
    // amount and the wide mask band keeps the warp's Jacobian positive.
    const below = Math.min(0, v - depthLine), dv = (table(depth, u) - 1) * -depthCap * Math.tanh(-below / depthCap);
    const z = p.z * (1 + (table(width, u) - 1) * mask * (1 - smooth(v, line, line + .04)));
    return origin.clone().addScaledVector(U, (u + du * mask) * scale).addScaledVector(Vn, (v + dv * mask) * scale).setZ(z);
  };
}

/** Apply a spatial warp to every mesh's rest geometry and normals. Bones are
 * unchanged, so warps must be near identity at joint pivots they surround. */
export function warpRestGeometry(root, warp) {
  root.updateMatrixWorld(true);
  const e = 1e-4, p = new THREE.Vector3(), n = new THREE.Vector3(), J = new THREE.Matrix3(), normalMatrix = new THREE.Matrix3(), inverse = new THREE.Matrix4(), cols = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], model3 = new THREE.Matrix3();
  root.traverse(o => {
    if (!o.isMesh) return;
    const position = o.geometry.getAttribute('position'), normal = o.geometry.getAttribute('normal'), tangent = o.geometry.getAttribute('tangent');
    const world = o.isSkinnedMesh ? o.bindMatrix : o.matrixWorld; inverse.copy(world).invert(); normalMatrix.getNormalMatrix(world);
    const toLocal3 = new THREE.Matrix3().setFromMatrix4(world).transpose();
    let changed = false;
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(world);
      const q = warp(p); if (q.distanceToSquared(p) < 1e-18) continue;
      changed = true;
      if (normal || tangent) {
        for (let k = 0; k < 3; k++) { const a = p.clone(), b = p.clone(); a.setComponent(k, a.getComponent(k) + e); b.setComponent(k, b.getComponent(k) - e); cols[k].copy(warp(a)).sub(warp(b)).divideScalar(2 * e); }
        J.set(cols[0].x, cols[1].x, cols[2].x, cols[0].y, cols[1].y, cols[2].y, cols[0].z, cols[1].z, cols[2].z);
        if (tangent) { n.set(tangent.getX(i), tangent.getY(i), tangent.getZ(i)).applyMatrix3(model3.setFromMatrix4(world)).applyMatrix3(J).applyMatrix3(model3.invert()).normalize(); tangent.setXYZ(i, n.x, n.y, n.z); }
        if (normal) { n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize().applyMatrix3(J.invert().transpose()).applyMatrix3(toLocal3).normalize(); normal.setXYZ(i, n.x, n.y, n.z); }
      }
      q.applyMatrix4(inverse); position.setXYZ(i, q.x, q.y, q.z);
    }
    if (changed) { position.needsUpdate = true; if (normal) normal.needsUpdate = true; if (tangent) tangent.needsUpdate = true; o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere(); }
  });
}
