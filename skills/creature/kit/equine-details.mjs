import * as THREE from 'three';
import { Cage, V, addLoft, tubeGeometry } from './geometry.mjs';
import { computeEquineNormals } from './equine-body.mjs';
import { equineLipBoundary } from './equine-head.mjs';

const TAU = Math.PI * 2;
const mix = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const white = new THREE.Color('white');
const noise = (i, seed = 0) => {
  const n = Math.sin(i * 127.1 + seed * 17.31) * 43758.5453;
  return n - Math.floor(n);
};
const surfaceSamplers=new WeakMap();

function skullSampler(rig){
  let sample=surfaceSamplers.get(rig);
  if(!sample){
    const skin=rig.root.parent.geometry,p=skin.attributes.position,normals=skin.attributes.normal,ix=skin.index.array,triangles=[];
    const boneIndex=skin.attributes.skinIndex,boneWeight=skin.attributes.skinWeight,headIndex=rig.index(rig.head);
    const onHead=Array.from({length:p.count},(_,i)=>[0,1,2,3].some(j=>boneIndex.array[i*4+j]===headIndex&&boneWeight.array[i*4+j]>.25));
    for(let i=0;i<ix.length;i+=3){
      if(!onHead[ix[i]]&&!onHead[ix[i+1]]&&!onHead[ix[i+2]])continue;
      const a=new THREE.Vector3().fromBufferAttribute(p,ix[i]),b=new THREE.Vector3().fromBufferAttribute(p,ix[i+1]),c=new THREE.Vector3().fromBufferAttribute(p,ix[i+2]);
      const maxX=Math.max(a.x,b.x,c.x),maxY=Math.max(a.y,b.y,c.y);
      const minX=Math.min(a.x,b.x,c.x),minY=Math.min(a.y,b.y,c.y),d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
      if(Math.abs(d)>1e-12)triangles.push({a,b,c,minX,maxX,minY,maxY,d,n:Array.from(ix.slice(i,i+3),j=>new THREE.Vector3().fromBufferAttribute(normals,j))});
    }
    // A small XY grid keeps exact triangle fitting cheap after local nasal
    // refinement. Scanning every head triangle for every hair/fitting vertex
    // made high-detail heads needlessly expensive to generate.
    const bounds=triangles.reduce((b,t)=>[Math.min(b[0],t.minX),Math.min(b[1],t.minY),Math.max(b[2],t.maxX),Math.max(b[3],t.maxY)],[Infinity,Infinity,-Infinity,-Infinity]);
    const [minX,minY,maxX,maxY]=bounds;
    const cell=Math.max(maxX-minX,maxY-minY)/80,grid=new Map(),key=(x,y)=>`${Math.floor((x-minX)/cell)}:${Math.floor((y-minY)/cell)}`;
    for(const t of triangles)for(let x=Math.floor((t.minX-minX)/cell);x<=Math.floor((t.maxX-minX)/cell);x++)for(let y=Math.floor((t.minY-minY)/cell);y<=Math.floor((t.maxY-minY)/cell);y++){
      const k=`${x}:${y}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(t);
    }
    sample=(x,y)=>{
      let height=0;
      for(const t of grid.get(key(x,y))??[]){
        if(x<t.minX||x>t.maxX||y<t.minY||y>t.maxY)continue;
        const u=((t.b.y-t.c.y)*(x-t.c.x)+(t.c.x-t.b.x)*(y-t.c.y))/t.d,v=((t.c.y-t.a.y)*(x-t.c.x)+(t.a.x-t.c.x)*(y-t.c.y))/t.d,w=1-u-v;
        if(u>=-1e-7&&v>=-1e-7&&w>=-1e-7)height=Math.max(height,Math.abs(u*t.a.z+v*t.b.z+w*t.c.z));
      }
      return height;
    };
    sample.normal=(x,y,side=1)=>{
      let height=-1,result=new THREE.Vector3(0,0,side);
      for(const t of grid.get(key(x,y))??[]){
        if(x<t.minX||x>t.maxX||y<t.minY||y>t.maxY)continue;
        const u=((t.b.y-t.c.y)*(x-t.c.x)+(t.c.x-t.b.x)*(y-t.c.y))/t.d,v=((t.c.y-t.a.y)*(x-t.c.x)+(t.a.x-t.c.x)*(y-t.c.y))/t.d,w=1-u-v,z=u*t.a.z+v*t.b.z+w*t.c.z;
        if(u>=-1e-7&&v>=-1e-7&&w>=-1e-7&&z*side>height){height=z*side;result=t.n[0].clone().multiplyScalar(u).addScaledVector(t.n[1],v).addScaledVector(t.n[2],w).normalize();}
      }
      return result;
    };
    surfaceSamplers.set(rig,sample);
  }
  return sample;
}

function fitSkull(geometry,origin,rotation,rig,blendAt,side){
  const sample=skullSampler(rig);
  const p=geometry.attributes.position,inverse=rotation.clone().invert();let unmatchedBoundaryVertices=0;
  for(let i=0;i<p.count;i++){
    const world=new THREE.Vector3().fromBufferAttribute(p,i).applyQuaternion(rotation).add(origin),blend=blendAt(i),z=sample(world.x,world.y);
    if(z>0){world.z=mix(world.z,side*(z-.001),blend);world.sub(origin).applyQuaternion(inverse);p.setXYZ(i,world.x,world.y,world.z);}else if(blend>.8)unmatchedBoundaryVertices++;
  }
  geometry.userData.skullProjection={unmatchedBoundaryVertices};
  computeEquineNormals(geometry);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

function attach(parent, geometry, material, name) {
  geometry.deleteAttribute('skinIndex');
  geometry.deleteAttribute('skinWeight');
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function groupAt(rig, bone, world, name) {
  const group = new THREE.Group();
  group.name = name;
  group.position.copy(world).sub(rig.rest.get(bone).world);
  bone.add(group);
  return group;
}

function surface(positions, indices, colors) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function frame(normal, direction = new THREE.Vector3(1, 0, 0)) {
  const n = normal.clone().normalize();
  const u = direction.clone().addScaledVector(n, -direction.dot(n)).normalize();
  const v = n.clone().cross(u).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
}

function painted(geometry, origin, rotation, colorAt) {
  const p = geometry.getAttribute('position'), colors = [];
  for (let i = 0; i < p.count; i++) {
    const world = new THREE.Vector3().fromBufferAttribute(p, i).applyQuaternion(rotation).add(origin);
    const c = colorAt(world);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

// The opening is a pointed almond rather than a circular ball glued to the skull.
function almond(angle, width, height) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new THREE.Vector2(c * width, s * height * (.63 + .37 * Math.abs(s)) + c * height * .10);
}

function buildEye(base, spec, morph, rig, materials, colorAt, side) {
  const hs = morph.headScale, center = morph.head(base.eye);
  const sample=skullSampler(rig),h=.030*hs;
  const surfaceZ=sample(center.x,center.y);
  const slopeX=(sample(center.x+h,center.y)-sample(center.x-h,center.y))/(2*h);
  const slopeY=(sample(center.x,center.y+h)-sample(center.x,center.y-h))/(2*h);
  center.z = (surfaceZ-.001*hs)*side;
  const eye = groupAt(rig, rig.head, center, `Eye_${side === 1 ? 'Left' : 'Right'}`);
  // Both upper lids face dorsally. Reversing the outward normal alone would
  // invert the right eye's vertical frame and put its lashes below the eye.
  eye.quaternion.copy(frame(new THREE.Vector3(-slopeX, -slopeY, side),new THREE.Vector3(side,0,0)));
  const width = base.eyeRadius * hs * 1.10, height = width * .51;
  const segments = 64, bands = 8, positions = [], indices = [];
  // Broad orbital skin rolls into the eyelid. The outer border sinks into the
  // main head; the body cage supplies the recessed socket behind this patch.
  for (let k = 0; k <= bands; k++) {
    const t = k / bands;
    for (let j = 0; j < segments; j++) {
      const a = j / segments * TAU;
      const inner = almond(a, width, height);
      const outer = new THREE.Vector2(Math.cos(a) * width * 1.38, Math.sin(a) * height * (Math.sin(a)>0?1.85:1.45));
      const p = inner.lerp(outer, t);
      const brow = Math.max(0, Math.sin(a)) ** 2;
      const z = hs * (mix(.0035, -.006, t) + Math.sin(t * Math.PI) * (.001 + .002 * brow));
      positions.push(p.x, p.y, z);
    }
  }
  for (let k = 0; k < bands; k++) for (let j = 0; j < segments; j++) {
    const a = k * segments + j, b = k * segments + (j + 1) % segments;
    const c = b + segments, d = a + segments;
    indices.push(a, d, b, b, d, c);
  }
  const orbit = painted(fitSkull(surface(positions, indices),center,eye.quaternion,rig,i=>(Math.floor(i/segments)/bands)**1.3,side), center, eye.quaternion, colorAt);
  attach(eye, orbit, materials.coat, 'Orbital_Skin_And_Brow');

  // The corneal surface follows the same almond boundary. Only a shallow dome
  // is exposed; the rest of the globe belongs inside the recessed skull.
  const corneaPositions = [0, 0, .0075 * hs], corneaIndices = [];
  const rings = 18;
  for (let k = 1; k <= rings; k++) for (let j = 0; j < segments; j++) {
    const r = k / rings, a = j / segments * TAU, p = almond(a, width * .985, height * .985);
    corneaPositions.push(p.x * r, p.y * r, hs * (.0032 + .0043 * Math.sqrt(1 - r * r)));
  }
  for (let j = 0; j < segments; j++) corneaIndices.push(0, 1 + j, 1 + (j + 1) % segments);
  for (let k = 0; k < rings - 1; k++) for (let j = 0; j < segments; j++) {
    const a = 1 + k * segments + j, b = 1 + k * segments + (j + 1) % segments;
    corneaIndices.push(a, a + segments, b, b, a + segments, b + segments);
  }
  const cornea = surface(corneaPositions, corneaIndices),eyeColors=[];
  const irisColor=new THREE.Color(spec.materials.eyeColor).lerp(new THREE.Color('#795335'),.10),edgeColor=new THREE.Color('#17110d'),pupilColor=new THREE.Color('#050605');
  for(let i=0;i<corneaPositions.length;i+=3){
    const x=(corneaPositions[i]-.001*hs)/width,y=corneaPositions[i+1]/height;
    const radius=Math.hypot(x/.78,y/1.15),angle=Math.atan2(y,x);
    const pigment=irisColor.clone().multiplyScalar(.88+.12*Math.sin(angle*31+radius*12)+.06*Math.sin(angle*57));
    pigment.lerp(edgeColor,THREE.MathUtils.smoothstep(radius,.77,1.12));
    const pupil=Math.pow(Math.abs(x/.48),2.6)+Math.pow(Math.abs(y/.29),2.6);
    pigment.lerp(pupilColor,1-THREE.MathUtils.smoothstep(pupil,.75,1.15));
    eyeColors.push(pigment.r,pigment.g,pigment.b);
  }
  cornea.setAttribute('color',new THREE.Float32BufferAttribute(eyeColors,3));
  const cornealMaterial=materials.eye.clone();cornealMaterial.color.set('white');cornealMaterial.vertexColors=true;cornealMaterial.roughness=.24;cornealMaterial.clearcoat=.35;cornealMaterial.clearcoatRoughness=.16;cornealMaterial.specularIntensity=.45;cornealMaterial.ior=1.38;cornealMaterial.envMapIntensity=.45;
  attach(eye,cornea,cornealMaterial,'Recessed_Cornea_Brown_Iris_Horizontal_Pupil');

  const lidCage = new Cage();
  for (const upper of [true, false]) {
    const points = Array.from({ length: 33 }, (_, i) => {
      const a = (upper ? 0 : Math.PI) + i / 32 * Math.PI;
      const p = almond(a, width * 1.015, height * 1.015);
      return new THREE.Vector3(p.x, p.y, .0041 * hs);
    });
    addLoft(lidCage, points.map((center, i) => ({center, radius: hs * (.00025 + (upper ? .0008 : .0004) * Math.sin(i / 32 * Math.PI))})), { segments: 6 });
  }
  attach(eye, lidCage.toGeometry(() => white), materials.eyelid, 'Tapered_Upper_And_Lower_Lids');
  // Sparse eyelashes are round tapered fibres, visible only in close views.
  const lashes = new Cage();
  for (let i = 0; i < 17; i++) {
    const a = .20 + i / 16 * (Math.PI - .40), p = almond(a, width * 1.025, height * 1.025);
    const root = new THREE.Vector3(p.x, p.y, .0047 * hs);
    const length = (.004 + .003 * Math.sin(a)) * hs;
    const end = root.clone().add(new THREE.Vector3(-.2 * length, .45 * length, .8 * length));
    addLoft(lashes, [{center:root,radius:.00033*hs},{center:root.clone().lerp(end,.5),radius:.00025*hs},{center:end,radius:.00006*hs}], {segments:4});
  }
  attach(eye, lashes.toGeometry(() => white), materials.hair, 'Upper_Eyelashes');
}

function buildPinna(base, spec, morph, rig, materials, colorAt, side) {
  const hs = morph.headScale, center = morph.head(base.ear);
  center.z *= side;
  const bone = rig.ears[side === 1 ? 0 : 1];
  const ear = groupAt(rig, bone, center, `Pinna_${side === 1 ? 'Left' : 'Right'}`);
  const axis = V(base.earVector).multiplyScalar(hs); axis.z *= side;
  const length = axis.length(); axis.normalize();
  const forward = new THREE.Vector3(.75, .04, .66 * side);
  forward.addScaledVector(axis, -forward.dot(axis)).normalize();
  const across = forward.clone().cross(axis).normalize();
  const ringCount = 18, columns = 14, positions = [], indices = [], colors = [];
  const innerColor = new THREE.Color('#765743'), innerTip = new THREE.Color('#9c8067');
  // Broad rolled base, widest below mid-length, then a short pointed tip:
  // equine pinnae are cupped cones, not narrow leaves on a stalk.
  const widthAt = t => base.earWidth * hs * Math.max(.001, Math.sin(Math.PI * Math.pow(t, .74)) ** .62+.62*(1-t)**3) * (.92 - .20 * t);
  for (let back = 0; back < 2; back++) for (let k = 0; k <= ringCount; k++) {
    const t = k / ringCount, width = widthAt(t);
    for (let j = 0; j <= columns; j++) {
      const u = j / columns * 2 - 1, bowl = (1 - u * u) * Math.sin(Math.PI * t);
      const fade=k===ringCount?0:Math.sin(Math.PI*t)**.4+.3*(1-t)**8;
      const concha=.006*Math.exp(-(((u-.28)/.22)**2+((t-.23)/.20)**2));
      const depth = hs * ((back ? -.0025 - .033 * bowl : .004 - .035 * bowl)*fade+concha);
      const p = axis.clone().multiplyScalar(length * t).addScaledVector(across, u * width).addScaledVector(forward, depth);
      // The terminal leaf leans slightly forward, rather than forming a cone.
      p.addScaledVector(forward, .012 * hs * t * t);
      positions.push(...p);
      const coat = colorAt(p.clone().add(center));
      const interior = innerColor.clone().lerp(innerTip, .35 * t);
      coat.lerp(interior, back ? 0 : Math.min(.92, (1 - Math.abs(u) ** 5) * Math.sin(Math.PI * t) * 1.3));
      coat.lerp(new THREE.Color(spec.materials.secondaryColor),Math.max(Math.abs(u)**8*.68,THREE.MathUtils.smoothstep(t,.82,1)*.82));
      colors.push(coat.r, coat.g, coat.b);
    }
  }
  const stride = columns + 1, faceSize = (ringCount + 1) * stride;
  for (let back = 0; back < 2; back++) for (let k = 0; k < ringCount; k++) for (let j = 0; j < columns; j++) {
    const a = back * faceSize + k * stride + j, b = a + stride, c = b + 1, d = a + 1;
    if (back) indices.push(a, d, b, d, c, b); else indices.push(a, b, d, d, b, c);
  }
  const boundary = [];
  for (let k = 0; k < ringCount; k++) boundary.push(k * stride);
  for (let j = 0; j < columns; j++) boundary.push(ringCount * stride + j);
  for (let k = ringCount; k > 0; k--) boundary.push(k * stride + columns);
  for (let j = columns; j > 0; j--) boundary.push(j);
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length];
    indices.push(a, b, a + faceSize, b, b + faceSize, a + faceSize);
  }
  // Both faces meet at the terminal edge. Weld that edge explicitly instead
  // of retaining an almost-zero-thickness rim from sin(PI) roundoff.
  const cleanPositions=[],cleanColors=[],cleanIndices=[],used=new Map();
  const tip=ringCount*stride;
  const welded=i=>i>=faceSize+tip?i-faceSize:i;
  const compact=i=>{
    if(!used.has(i)){used.set(i,cleanPositions.length/3);cleanPositions.push(...positions.slice(i*3,i*3+3));cleanColors.push(...colors.slice(i*3,i*3+3));}
    return used.get(i);
  };
  for(let i=0;i<indices.length;i+=3){
    const a=welded(indices[i]),b=welded(indices[i+1]),c=welded(indices[i+2]);
    if(a===b||b===c||c===a)continue;
    cleanIndices.push(compact(a),compact(b),compact(c));
  }
  const pinna=surface(cleanPositions,cleanIndices,cleanColors);pinna.userData.preserveAuthoredPigment=true;
  attach(ear,pinna,materials.coat,'Sculpted_Concave_Ear');
  const rimPoints=[];
  for(const sign of [-1,1])for(let i=0;i<25;i++){
    const t=sign<0?.03+i/24*.94:.97-i/24*.94;
    rimPoints.push(axis.clone().multiplyScalar(length*t).addScaledVector(across,sign*widthAt(t)).addScaledVector(forward,(.004*Math.sin(Math.PI*t)**.4+.012*t*t)*hs));
  }
  rimPoints.push(rimPoints[0].clone());
  const rim=tubeGeometry(rimPoints,rimPoints.map((p,i)=>.0018*hs*Math.max(.16,Math.sin(Math.PI*(i%25)/24))),7);
  const rp=rim.attributes.position,rc=[];
  for(let i=0;i<rp.count;i++){const c=colorAt(new THREE.Vector3().fromBufferAttribute(rp,i).add(center)).lerp(new THREE.Color(spec.materials.secondaryColor),.55);rc.push(c.r,c.g,c.b);}
  rim.setAttribute('color',new THREE.Float32BufferAttribute(rc,3));
  rim.userData.preserveAuthoredPigment=true;
  attach(ear,rim,materials.coat,'Rolled_Pinna_Margin');
  const fibres=new Cage();
  for(let i=0;i<90;i++){
    const t=.08+.78*noise(i+51,spec.seed),u=(i%2?1:-1)*(.62+.30*noise(i+801,spec.seed)),width=widthAt(t),bowl=(1-u*u)*Math.sin(Math.PI*t),fade=Math.sin(Math.PI*t)**.4+.3*(1-t)**8;
    const concha=.006*Math.exp(-(((u-.28)/.22)**2+((t-.23)/.20)**2));
    const p=axis.clone().multiplyScalar(length*t).addScaledVector(across,u*width).addScaledVector(forward,hs*((.004-.035*bowl)*fade+concha+.012*t*t+.0003));
    const hairLength=(.004+.006*noise(i+319,spec.seed))*hs;
    const tip=p.clone().addScaledVector(axis,hairLength).addScaledVector(across,-Math.sign(u)*hairLength*.35).addScaledVector(forward,hairLength*.18);
    addLoft(fibres,[{center:p,radius:.00022*hs},{center:p.clone().lerp(tip,.6),radius:.00015*hs},{center:tip,radius:.000025*hs}],{segments:4});
  }
  const innerHair=materials.hair.clone();innerHair.color.set('#807160');innerHair.roughness=.95;
  attach(ear,fibres.toGeometry(()=>white),innerHair,'Fine_Pinna_Margin_Hairs');
}

function buildNostril(base, spec, morph, rig, materials, colorAt, side) {
  const hs = morph.headScale, center = morph.head(base.nostril); center.z = (center.z-.008*hs)*side;
  const nose = groupAt(rig, rig.head, center, `Nostril_${side === 1 ? 'Left' : 'Right'}`);
  nose.quaternion.copy(frame(new THREE.Vector3(.35, .07, side), new THREE.Vector3(side*.75, side*.66, 0)));
  const segments = 64, layers = 9, positions = [], indices = [];
  const w = .018 * hs, h = .034 * hs;
  const outline = a => new THREE.Vector2(Math.cos(a) * w * (.84 - .32 * Math.sin(a)), Math.sin(a) * h);
  // This flared alar wall is a funnel. Its black end is inside the muzzle;
  // the body mesh's corresponding indentation prevents a painted-on effect.
  for (let k = 0; k <= layers; k++) {
    const t = k / layers;
    for (let j = 0; j < segments; j++) {
      const a = j / segments * TAU, p = outline(a), factor = mix(.42, 1.35, t);
      // Depth comes from the real nasal pit below. Pre-offsetting depth in this
      // oblique local frame also shifts XY and makes successive rings cross.
      positions.push(p.x * factor, p.y * factor, 0);
    }
  }
  for (let k = 0; k < layers; k++) for (let j = 0; j < segments; j++) {
    const a = k * segments + j, b = k * segments + (j + 1) % segments;
    indices.push(a, a + segments, b, b, a + segments, b + segments);
  }
  const geometry=surface(positions,indices),vertices=geometry.attributes.position,inverse=nose.quaternion.clone().invert(),sample=skullSampler(rig);
  let unmatchedBoundaryVertices=0;
  // Follow the carved surface at every radial layer. Blending only the last
  // ring let the unprojected alar wall cross the muzzle and produce torn folds.
  for(let i=0;i<vertices.count;i++){
    const t=Math.floor(i/segments)/layers,a=(i%segments)/segments*TAU;
    const world=new THREE.Vector3().fromBufferAttribute(vertices,i).applyQuaternion(nose.quaternion).add(center),z=sample(world.x,world.y);
    if(z>0){
      const roll=.0016*Math.exp(-(((t-.62)/.19)**2))*(.75+.25*Math.cos(a));
      const offset=(.0008+roll-.0012*THREE.MathUtils.smoothstep(t,.83,1))*hs;
      world.z=side*(z+offset);world.sub(center).applyQuaternion(inverse);vertices.setXYZ(i,world.x,world.y,world.z);
    }else if(t>.8)unmatchedBoundaryVertices++;
  }
  geometry.userData.skullProjection={unmatchedBoundaryVertices};computeEquineNormals(geometry);painted(geometry,center,nose.quaternion,colorAt);
  const normals=geometry.attributes.normal;
  for(let i=0;i<vertices.count;i++){
    const t=Math.floor(i/segments)/layers;if(t>.22&&t<.67)continue;
    const world=new THREE.Vector3().fromBufferAttribute(vertices,i).applyQuaternion(nose.quaternion).add(center);
    const n=new THREE.Vector3().fromBufferAttribute(normals,i),target=sample.normal(world.x,world.y,side).applyQuaternion(inverse);
    const blend=t<.22?1-THREE.MathUtils.smoothstep(t,0,.22):THREE.MathUtils.smoothstep(t,.67,1);
    n.lerp(target,blend).normalize();normals.setXYZ(i,n.x,n.y,n.z);
  }
  const color = geometry.getAttribute('color'), dark = new THREE.Color('#110f0e'), skin = new THREE.Color(spec.materials.muzzleColor);
  for (let k = 0; k <= layers; k++) for (let j = 0; j < segments; j++) {
    const i = k * segments + j, t = k / layers, c = new THREE.Color().fromBufferAttribute(color, i);
    c.lerp(skin, .45*(1-THREE.MathUtils.smoothstep(t,.60,1))).lerp(dark, 1 - THREE.MathUtils.smoothstep(t, .10, .57));
    color.setXYZ(i, c.r, c.g, c.b);
  }
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.preserveAuthoredPigment=true;
  attach(nose, geometry, materials.coat, 'Sculpted_Alar_Fold_And_Nasal_Vestibule');
  // The closed main skin already supplies the recessed floor. A second small
  // dark patch over that curved floor shows up as a detached black fin at
  // oblique angles; its lining pigment is applied to the actual skin instead.
}

function shadeNasalVestibules(base,morph,rig){
  const geometry=rig.root.parent.geometry,p=geometry.attributes.position,nare=morph.head(base.nostril),mouth=morph.head(base.mouth),H=morph.headScale,dark=new THREE.Color('#17100d'),oral=new THREE.Color('#25110f'),override=new Float32Array(p.count*4);
  for(let i=0;i<p.count;i++){
    const r2=((p.getX(i)-nare.x)/(.031*H))**2+((p.getY(i)-nare.y)/(.028*H))**2;
    if(r2<.85&&Math.abs(p.getZ(i))>.025*H){const amount=.97*(1-THREE.MathUtils.smoothstep(r2,.07,.85));override.set([dark.r,dark.g,dark.b,amount],i*4);}
    const dx=(p.getX(i)-mouth.x)/H,z=Math.abs(p.getZ(i))/H,lip=equineLipBoundary(base,morph,p.getX(i),p.getZ(i)),depth=(p.getY(i)-lip)/H;
    if(dx>-.080&&dx<.060&&depth<.006&&z<.061){
      const amount=THREE.MathUtils.smoothstep(dx,-.080,-.058)*(1-THREE.MathUtils.smoothstep(dx,.040,.060))*(1-THREE.MathUtils.smoothstep(z,.042,.061))*(1-THREE.MathUtils.smoothstep(depth,.001,.006));
      override.set([oral.r,oral.g,oral.b,amount],i*4);
    }
  }
  geometry.setAttribute('pigmentOverride',new THREE.Float32BufferAttribute(override,4));
}

function buildJaw(base, spec, morph, rig, materials, colorAt) {
  const hs = morph.headScale, origin = rig.rest.get(rig.jaw).world, cage = new Cage();
  // The skin over the caudal mandible follows the jaw too. Leaving all cheek
  // skin on Head exposes a separate long jaw strip as soon as the mouth opens.
  const mainSkin=rig.root.parent,mainGeometry=mainSkin.geometry,mp=mainGeometry.attributes.position,mi=mainGeometry.attributes.skinIndex,mw=mainGeometry.attributes.skinWeight,headId=rig.index(rig.head),jawId=rig.index(rig.jaw),eye=morph.head(base.eye),oralCenter=morph.head(base.mouth);
  const mandibularBlend=(x,y)=>{const plane=eye.y-.180*hs-.82*(x-(eye.x-.040*hs));return .92*THREE.MathUtils.smoothstep(x,eye.x-.160*hs,eye.x-.100*hs)*(1-THREE.MathUtils.smoothstep(x,oralCenter.x-.110*hs,oralCenter.x-.065*hs))*(1-THREE.MathUtils.smoothstep(y,plane+.015*hs,plane+.110*hs));};
  for(let i=0;i<mp.count;i++){
    const x=mp.getX(i),y=mp.getY(i),blend=mandibularBlend(x,y);
    if(blend<.001)continue;
    let headSlot=-1,emptySlot=-1;for(let j=0;j<4;j++){if(mi.array[i*4+j]===headId&&mw.array[i*4+j]>.6)headSlot=j;if(mw.array[i*4+j]<1e-8)emptySlot=j;}
    if(headSlot<0||emptySlot<0)continue;
    const transfer=mw.array[i*4+headSlot]*blend;mw.array[i*4+headSlot]-=transfer;mi.array[i*4+emptySlot]=jawId;mw.array[i*4+emptySlot]=transfer;
  }
  mi.needsUpdate=true;mw.needsUpdate=true;mainSkin.normalizeSkinWeights();
  // The caudal ramus remains under the cheek's skin. Only the distal lips and
  // chin form a separate exterior; otherwise a second tube runs down the face.
  const jawLift=[.085,.090,.090,.045,.012];
  const jawHeight=[.75,.65,.55,.85,1],jawWidth=[.72,.72,.60,.70,.91];
  const jawSections=base.jaw.map((s,i) => ({center:morph.head([s[0],s[1]+(jawLift[i]??0),0]).sub(origin),ry:s[2]*hs*(jawHeight[i]??1),rz:s[3]*hs*(jawWidth[i]??.91)}));
  const chin=base.jaw.at(-1);
  for(const[x,y,ry,rz]of [[.024,.010,.022,.063],[.044,.012,.013,.043],[.055,.015,.003,.012],[.057,.016,.001,.002]])jawSections.push({center:morph.head([chin[0]+x,chin[1]+y,0]).sub(origin),ry:ry*hs,rz:rz*hs});
  addLoft(cage,jawSections,{segments:32});
  cage.subdivide();
  const mouth=morph.head(base.mouth);
  for(const v of cage.vertices){
    const p=v.p.clone().add(origin),dx=(p.x-mouth.x)/hs,lip=equineLipBoundary(base,morph,p.x,p.z)-.0025*hs,d=p.y-lip;
    if(dx<-.10||dx>.095||d<-.025*hs)continue;
    const fade=THREE.MathUtils.smoothstep(dx,-.10,-.075)*(1-THREE.MathUtils.smoothstep(dx,.074,.095));
    const target=lip+.5*(d-Math.sqrt(d*d+(.002*hs)**2));p.y=mix(p.y,target,fade);v.p.copy(p.sub(origin));
  }
  const oral=new THREE.Color('#28120f');
  const geometry = cage.toGeometry(p => {
    const world=p.clone().add(origin),c=colorAt(world),dx=(world.x-mouth.x)/hs,z=Math.abs(world.z)/hs,depth=(equineLipBoundary(base,morph,world.x,world.z)-.0025*hs-world.y)/hs;
    if(dx>-.075&&dx<.060&&z<.061&&depth<.006){const amount=THREE.MathUtils.smoothstep(dx,-.075,-.055)*(1-THREE.MathUtils.smoothstep(dx,.040,.060))*(1-THREE.MathUtils.smoothstep(z,.042,.061))*(1-THREE.MathUtils.smoothstep(depth,.001,.006));c.lerp(oral,amount);}
    return c;
  });
  geometry.userData.preserveAuthoredPigment=true;
  const jaw = attach(rig.jaw, geometry, materials.coat, 'Lower_Jaw');
  jaw.userData.part = 'jaw';
  // Recessed cheeks and the back of the oral cavity connect fixed palate to
  // moving jaw. The front remains an actual aperture, with no black oval laid
  // on a closed snout. This small interior skin shares the existing jaw bones.
  const lining=new Cage(),rows=8,columns=14,sides=[];
  for(const side of [1,-1]){
    const grid=[];
    for(let i=0;i<=columns;i++){
      const t=i/columns,x=mouth.x+mix(-.105,.020,t)*hs,z=side*(.034+.020*Math.sin(Math.PI*t))*hs;
      // The rear oral lining turns upward into the cheek. Continuing the
      // distal lip plane backwards leaves its corner outside the jaw contour.
      const upper=equineLipBoundary(base,morph,x,z)+.002*hs+.035*hs*(1-THREE.MathUtils.smoothstep(t,0,.32)),row=[];
      for(let j=0;j<=rows;j++){const v=j/rows,jawWeight=mix(mandibularBlend(x,upper),1,v);row.push(lining.add(new THREE.Vector3(x-.006*hs*Math.sin(v*Math.PI),upper-.0025*hs*v,z*(1-.25*Math.sin(v*Math.PI))),{[headId]:1-jawWeight,[jawId]:jawWeight}));}
      grid.push(row);
    }
    for(let i=0;i<columns;i++)for(let j=0;j<rows;j++){const f=[grid[i][j],grid[i+1][j],grid[i+1][j+1],grid[i][j+1]];lining.face(...(side>0?f.reverse():f));}
    sides.push(grid);
  }
  const back=[];
  for(let k=0;k<=8;k++){
    const u=k/8,row=[];
    for(let j=0;j<=rows;j++){
      const v=j/rows;
      if(k===0){row.push(sides[0][0][j]);continue;}if(k===8){row.push(sides[1][0][j]);continue;}
      const a=lining.vertices[sides[0][0][j]].p,b=lining.vertices[sides[1][0][j]].p,p=a.clone().lerp(b,u),recess=.020*hs*Math.sin(u*Math.PI)*(.35+.65*Math.sin(v*Math.PI));p.x-=recess;p.y+=recess;
      const jawWeight=mix(mandibularBlend(p.x,p.y),1,v);row.push(lining.add(p,{[headId]:1-jawWeight,[jawId]:jawWeight}));
    }
    back.push(row);
  }
  for(let k=0;k<8;k++)for(let j=0;j<rows;j++)lining.face(back[k][j],back[k][j+1],back[k+1][j+1],back[k+1][j]);
  const mouthMaterial=new THREE.MeshStandardMaterial({name:'Recessed oral lining',color:'#120907',roughness:.98,envMapIntensity:.04,side:THREE.DoubleSide});
  const inside=new THREE.SkinnedMesh(lining.toGeometry(()=>white),mouthMaterial);inside.name='Oral_Cavity_Lining';inside.castShadow=true;inside.receiveShadow=true;inside.frustumCulled=false;
  const root=rig.root.parent.parent;root.add(inside);root.updateMatrixWorld(true);inside.bind(rig.skeleton);inside.normalizeSkinWeights();
}

/** Face fittings are built around the matching recessed equine skull cage.
 * All dimensions are mapped through the same head morph and anatomical bones. */
export function buildEquineFace(base, spec, morph, rig, materials, colorAt) {
  // The head helper owns the continuous skin. Fittings only sample it; keeping
  // a second sculpt pass here made the orbit and cheek depend on build order.
  surfaceSamplers.delete(rig);
  shadeNasalVestibules(base,morph,rig);
  for (const side of [1, -1]) {
    buildEye(base,spec,morph,rig,materials,colorAt,side);
    buildPinna(base,spec,morph,rig,materials,colorAt,side);
    buildNostril(base,spec,morph,rig,materials,colorAt,side);
  }
  buildJaw(base,spec,morph,rig,materials,colorAt);
}

function addFibre(cage, points, width, weightAt, segments = 5) {
  const curve = new THREE.CatmullRomCurve3(points), count = 10;
  addLoft(cage, Array.from({length:count},(_,i)=>{
    const t=i/(count-1);
    return {center:curve.getPoint(t),radius:width*(.80+.20*Math.sin(t*Math.PI))*Math.max(.035,1-Math.pow(t,2.7))};
  }),{segments,weights:i=>weightAt(i/(count-1))});
}

function addLock(cage,points,width,depth,weightAt,forelock=false){
  const curve=new THREE.CatmullRomCurve3(points),count=13;
  addLoft(cage,Array.from({length:count},(_,i)=>{
    const t=i/(count-1),taper=Math.max(.025,1-t**3.4),breadth=width*(.66+.34*Math.sin(Math.PI*t))*taper,thickness=depth*(.85+.15*Math.sin(Math.PI*t))*taper;
    return{center:curve.getPoint(t),rz:forelock?breadth:thickness,ry:forelock?thickness:breadth};
  }),{segments:8,weights:i=>weightAt(i/(count-1))});
}

function hairMaps(seed){
  const width=512,height=128,color=new Uint8Array(width*height*4),normal=new Uint8Array(width*height*4),rough=new Uint8Array(width*height*4);
  const field=(u,v)=>{
    const q=(u+.0007*Math.sin(v*TAU))*128,j=Math.floor(q),f=q-j;
    return Math.sin(f*Math.PI)**2*(.55+.45*noise(j,seed));
  };
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width,v=y/height,i=(y*width+x)*4,j=Math.floor((u+.0007*Math.sin(v*TAU))*128),tone=.62+.30*noise(j,seed)+.05*Math.sin(v*TAU+j);
    color[i]=Math.round(tone*255);color[i+1]=Math.round(tone*251);color[i+2]=Math.round(tone*245);color[i+3]=255;
    const dx=(field(u+1/width,v)-field(u-1/width,v))*.65,dy=(field(u,v+1/height)-field(u,v-1/height))*.65,n=new THREE.Vector3(-dx,-dy,1).normalize();
    normal[i]=Math.round((n.x*.5+.5)*255);normal[i+1]=Math.round((n.y*.5+.5)*255);normal[i+2]=Math.round((n.z*.5+.5)*255);normal[i+3]=255;
    rough[i]=255;rough[i+1]=Math.round(194+38*noise(j+701,seed));rough[i+2]=0;rough[i+3]=255;
  }
  const texture=(data,name)=>{const t=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);t.name=name;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
  const map=texture(color,'Original fine equine hair pigment');map.colorSpace=THREE.SRGBColorSpace;
  return{map,normal:texture(normal,'Original fine equine hair normal'),roughness:texture(rough,'Original packed equine hair roughness')};
}

function skinHair(cage, rig, material, name, seed,scale=1) {
  const color = new THREE.Color('#d1c8bc');
  const geometry = cage.toGeometry(p=>color.clone().multiplyScalar(.92+.08*noise(p.x*21+p.y*9+p.z*13,seed)));
  const hairMaterial = material.clone();hairMaterial.color.lerp(new THREE.Color('#3a332b'),.22);hairMaterial.vertexColors=true;hairMaterial.roughness=.77;
  const maps=hairMaps(seed);hairMaterial.map=maps.map;hairMaterial.normalMap=maps.normal;hairMaterial.normalScale=new THREE.Vector2(.18,.18);hairMaterial.roughnessMap=maps.roughness;hairMaterial.metalnessMap=maps.roughness;
  const p=geometry.attributes.position,uv=[],isTail=name.includes('Tail');
  for(let i=0;i<p.count;i++)uv.push((p.getX(i)*(isTail?.7:1)+p.getZ(i)*(isTail?.9:.12)+p.getY(i)*(isTail?0:.16))/(.08*scale),p.getY(i)/(.35*scale));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeTangents();
  const tangents=geometry.attributes.tangent,normals=geometry.attributes.normal;
  for(let i=0;i<tangents.count;i++){
    const t=new THREE.Vector3().fromBufferAttribute(tangents,i);
    if(!t.toArray().every(Number.isFinite)||t.lengthSq()<.5){const n=new THREE.Vector3().fromBufferAttribute(normals,i);t.set(Math.abs(n.x)<.8?1:0,Math.abs(n.x)<.8?0:1,0).addScaledVector(n,-t.dot(n)).normalize();tangents.setXYZW(i,t.x,t.y,t.z,1);}
  }
  const mesh = new THREE.SkinnedMesh(geometry,hairMaterial);
  mesh.name=name; mesh.castShadow=true; mesh.receiveShadow=true; mesh.frustumCulled=false;
  // Keep every skinned mesh at the creature root for portable glTF. The skin
  // and hair share the same skeleton and rest-space coordinates.
  const root=rig.root.parent.parent;root.add(mesh);root.updateMatrixWorld(true);
  mesh.bind(rig.skeleton);mesh.normalizeSkinWeights();
  return mesh;
}

function projectionSampler(geometry,[u,v,depth]){
  const p=geometry.attributes.position.array,ix=geometry.index.array,triangles=[];
  let minU=Infinity,minV=Infinity,maxU=-Infinity,maxV=-Infinity;
  for(let i=0;i<ix.length;i+=3){
    const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;
    const d=(p[b+v]-p[c+v])*(p[a+u]-p[c+u])+(p[c+u]-p[b+u])*(p[a+v]-p[c+v]);
    if(Math.abs(d)<1e-12)continue;
    const loU=Math.min(p[a+u],p[b+u],p[c+u]),hiU=Math.max(p[a+u],p[b+u],p[c+u]),loV=Math.min(p[a+v],p[b+v],p[c+v]),hiV=Math.max(p[a+v],p[b+v],p[c+v]);
    minU=Math.min(minU,loU);maxU=Math.max(maxU,hiU);minV=Math.min(minV,loV);maxV=Math.max(maxV,hiV);triangles.push({a,b,c,d,loU,hiU,loV,hiV});
  }
  const cell=Math.max(maxU-minU,maxV-minV)/100,grid=new Map();
  const key=(x,y)=>`${Math.floor((x-minU)/cell)}:${Math.floor((y-minV)/cell)}`;
  for(const t of triangles)for(let x=Math.floor((t.loU-minU)/cell);x<=Math.floor((t.hiU-minU)/cell);x++)for(let y=Math.floor((t.loV-minV)/cell);y<=Math.floor((t.hiV-minV)/cell);y++){
    const k=`${x}:${y}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(t);
  }
  return(x,y)=>{
    let result=-Infinity;
    for(const t of grid.get(key(x,y))??[]){
      if(x<t.loU||x>t.hiU||y<t.loV||y>t.hiV)continue;
      const a=((p[t.b+v]-p[t.c+v])*(x-p[t.c+u])+(p[t.c+u]-p[t.b+u])*(y-p[t.c+v]))/t.d;
      const b=((p[t.c+v]-p[t.a+v])*(x-p[t.c+u])+(p[t.a+u]-p[t.c+u])*(y-p[t.c+v]))/t.d,c=1-a-b;
      if(a>=-1e-7&&b>=-1e-7&&c>=-1e-7)result=Math.max(result,a*p[t.a+depth]+b*p[t.b+depth]+c*p[t.c+depth]);
    }
    return result;
  };
}

/** Rounded, tapered strands form real silhouettes in clay and portable GLB.
 * No opacity cards, camera-facing ribbons, external textures or runtime shader. */
export function buildEquineHair(base, spec, morph, rig, materials) {
  const S=morph.scale,seed=spec.seed??1;
  // Sample the bind-space skin itself. Loft-envelope estimates drift when
  // the anatomy author changes the crest, leaving floating comb-like roots.
  const topAt=projectionSampler(rig.root.parent.geometry,[0,2,1]),sideAt=projectionSampler(rig.root.parent.geometry,[0,1,2]);
  const rootOnCrest=p=>{
    const height=topAt(p.x,p.z);if(Number.isFinite(height))p.y=height-.001*S;return p;
  };
  if(spec.features.mane&&base.manePath.length){
    const crest=base.manePath.map((p,i)=>i<2?morph.torso(p):i>=base.manePath.length-2?morph.head(p):morph.neck(p));
    const curve=new THREE.CatmullRomCurve3(crest),cage=new Cage();
    // A guide follows the surface's lateral envelope. Straight downward locks
    // would disappear inside the broad shoulder and base of the neck.
    const profiles=[...base.torso.map(s=>({p:morph.torso([s[0],s[1],0]),ry:s[2]*spec.proportions.torsoDepth*S,rz:s[3]*spec.proportions.torsoWidth*S})),...base.neckHead.map((s,i)=>({p:(i>=(base.headSectionStart??7)?morph.head:morph.neck)([s[0],s[1],0]),ry:s[2]*(i>=(base.headSectionStart??7)?morph.headScale:Math.sqrt(spec.proportions.neckLength*spec.proportions.torsoDepth)*S),rz:s[3]*(i>=(base.headSectionStart??7)?morph.headScale:spec.proportions.torsoWidth*S)}))];
    const outside=p=>{
      const surface=sideAt(p.x,p.y);
      if(Number.isFinite(surface)){p.z=Math.max(p.z,surface+.0015*S);return p;}
      let best=Infinity,z=0;
      for(let j=0;j<profiles.length-1;j++){
        const a=profiles[j],b=profiles[j+1],d=b.p.clone().sub(a.p),q=p.clone().sub(a.p);d.z=0;q.z=0;
        const f=clamp(q.dot(d)/(d.lengthSq()||1),0,1),center=a.p.clone().lerp(b.p,f),distance=Math.hypot(p.x-center.x,p.y-center.y);
        if(distance<best){best=distance;const ry=mix(a.ry,b.ry,f),rz=mix(a.rz,b.rz,f);z=rz*Math.sqrt(Math.max(0,1-(distance/ry)**2));}
      }
      p.z=Math.max(p.z,z+.004*S);return p;
    };
    const maneWeights=t=>{
      const headBlend=THREE.MathUtils.smoothstep(t,.83,1)*.6,chestBlend=1-THREE.MathUtils.smoothstep(t,.01,.25);
      return{[rig.index(rig.chest)]:chestBlend,[rig.index(rig.neck)]:1-headBlend-chestBlend,[rig.index(rig.head)]:headBlend};
    };
    // A pulled Thoroughbred mane lies on one side of the crest, roughly a
    // hand long, and covers the upper neck rather than standing as a ridge.
    const coreLength=t=>(.118+.032*Math.sin(Math.PI*t)+.010*Math.sin(t*TAU*5.3)+.007*Math.sin(t*TAU*11.7))*(1-.35*THREE.MathUtils.smoothstep(t,.86,1))*S;
    const rootAt=t=>rootOnCrest(curve.getPoint(t));
    const manePoint=(t,v)=>{
      const p=rootAt(t),length=coreLength(t),sweep=(-.018-.014*Math.sin(Math.PI*t)+.005*Math.sin(t*TAU*4))*S;
      p.x+=sweep*v;p.y-=length*v*.76;
      p.z+=.065*S*Math.sin(v*Math.PI*.53);
      return v>0?outside(p):p;
    };
    // The closely packed short coat beneath the loose locks is a closed,
    // softly grooved volume. Isolated needles alone leave a striped scalp.
    const columns=112,rows=12,front=[],back=[];
    for(let i=0;i<=columns;i++){
      const t=i/columns,f=[];const b=[];
      const endFade=THREE.MathUtils.smoothstep(t,0,.025)*(1-THREE.MathUtils.smoothstep(t,.975,1));
      for(let j=0;j<=rows;j++){
        const v=j/rows,p=manePoint(t,v),groove=.72+.18*Math.sin(t*TAU*69+v*.4)+.10*Math.sin(t*TAU*121-v*.7);
        const thickness=(.002+.006*Math.sin(v*Math.PI)**.65)*endFade*Math.max(.05,1-v**7)*groove*S;
        f.push(cage.add(p.clone().add(new THREE.Vector3(0,.0015*S*(1-v),thickness)),maneWeights(t)));
        b.push(cage.add(p.clone().add(new THREE.Vector3(0,-.0015*S,-.001*S)),maneWeights(t)));
      }
      front.push(f);back.push(b);
    }
    for(let i=0;i<columns;i++)for(let j=0;j<rows;j++){
      cage.face(front[i][j],front[i+1][j],front[i+1][j+1],front[i][j+1]);
      cage.face(back[i][j+1],back[i+1][j+1],back[i+1][j],back[i][j]);
    }
    for(let i=0;i<columns;i++)for(const j of [0,rows]){
      if(j===0)cage.face(front[i][j],back[i][j],back[i+1][j],front[i+1][j]);
      else cage.face(front[i+1][j],back[i+1][j],back[i][j],front[i][j]);
    }
    for(const i of [0,columns])for(let j=0;j<rows;j++){
      if(i===0)cage.face(front[i][j+1],back[i][j+1],back[i][j],front[i][j]);
      else cage.face(front[i][j],back[i][j],back[i][j+1],front[i][j+1]);
    }
    cage.faces.forEach(face=>face.reverse());
    for(let i=0;i<122;i++){
      const n=noise(i+1,seed),n2=noise(i+101,seed),t=clamp((i+.05+.9*n)/122,0,1),p=curve.getPoint(t);
      p.z+=(n-.5)*.014*S;
      rootOnCrest(p);
      const length=coreLength(t)*(.86+.24*n2);
      const lateral=(.055+.020*Math.sin(Math.PI*t)+.010*n)*S;
      const sweep=(-.038+.024*noise(i+307,seed))*S;
      const points=[p,...[p.clone().add(new THREE.Vector3(sweep*.15,-length*.16,lateral*.40)),p.clone().add(new THREE.Vector3(sweep*.58,-length*.58,lateral*.85)),p.clone().add(new THREE.Vector3(sweep,-length,lateral*(.85+.18*n)))].map(outside)];
      const weights=()=>maneWeights(t);
      const width=(.0028+.0022*n2)*S;
      addLock(cage,points.map((p,k)=>p.clone().add(new THREE.Vector3(0,0,.002*S*Math.sin(k/3*Math.PI)))),width,(.0014+.0007*n)*S,weights);
      // Loose fibres follow each irregular lock; they do not form uniformly
      // spaced wire rows over the whole mane.
      for(let j=0;j<2;j++){
        const edge=(j-.5)*width*.9,drift=(noise(i*5+j+800,seed)-.5)*.009*S;
        const fibres=points.map((v,k)=>v.clone().add(new THREE.Vector3(edge+drift*k/3,-.006*S*noise(i*7+j,seed)*k/3,.0013*S)));
        addFibre(cage,fibres,(.00019+.00013*noise(i*11+j,seed))*S,weights,4);
      }
    }
    skinHair(cage,rig,materials.hair,'Dense_Mane_With_Overlapping_Short_Locks',seed,S);
    // Forelock follows the poll down the forehead, staying distinct from ears.
    const forelock=new Cage();
    const forehead=base.neckHead.slice((base.headSectionStart??7)+1,(base.headSectionStart??7)+5).map(s=>morph.head([s[0]-Math.sin(s[4])*(s[2]-.004),s[1]+Math.cos(s[4])*(s[2]-.004),0]));
    const foreheadCurve=new THREE.CatmullRomCurve3(forehead);
    for(let i=0;i<38;i++){
      const r=noise(i+701,seed),side=(i+.1+.8*noise(i+881,seed))/38-.5,sweep=(noise(i+609,seed)-.5)*.037*S;
      const points=Array.from({length:7},(_,j)=>{const t=j/6,p=foreheadCurve.getPoint(mix(.18*noise(i+401,seed),.43+.57*r,t));return p.add(new THREE.Vector3(Math.sin(t*4+i)*.002*S,-.004*side*side*S,side*(.085-.037*t)*S+sweep*t*t));});
      const weights=()=>({[rig.index(rig.head)]:1}),width=(.002+.002*r)*S;
      addLock(forelock,points,width,.0008*S,weights,true);
      for(let j=0;j<2;j++){
        const fibres=points.map((p,k)=>p.clone().add(new THREE.Vector3(.001*S,.001*S,(j?1:-1)*width*.85+Math.sin(k+i)*.001*S)));
        addFibre(forelock,fibres,.0003*S,weights,4);
      }
    }
    skinHair(forelock,rig,materials.hair,'Forelock_Overlapping_Locks_And_Fibres',seed+3,S);
  }
  const tail=new Cage(),guide=new THREE.CatmullRomCurve3(base.tailPath.map(p=>morph.tail(p)));
  const tailWeight=t=>{
    const joint=clamp(t*3,0,2.999),a=Math.floor(joint),f=joint-a;
    return{[rig.index(rig.tails[a])]:1-f,[rig.index(rig.tails[a+1])]:f};
  };
  const tailCenter=t=>{
    const p=guide.getPoint(t);p.x+=(-.020*Math.sin(t*Math.PI)+.012*Math.sin(t*TAU))*S;p.z+=.010*Math.sin(t*Math.PI)*S;return p;
  };
  const tailRadius=t=>(.038+.035*Math.sin(t*Math.PI)**.7)*(1-.82*THREE.MathUtils.smoothstep(t,.66,1))*S;
  const tailFrame=t=>{
    const tangent=guide.getTangent(t).normalize(),u=new THREE.Vector3(0,0,1);u.addScaledVector(tangent,-u.dot(tangent)).normalize();return{u,v:u.clone().cross(tangent).normalize()};
  };
  const rings=[],ringCount=30,segments=72;
  for(let k=0;k<=ringCount;k++){
    const q=k/ringCount,ring=[];
    for(let j=0;j<segments;j++){
      const a=j/segments*TAU,t=.025+q*(.93+.025*Math.sin(a*7+.3)+.012*Math.sin(a*13)-.025),center=tailCenter(t),frame=tailFrame(t);
      const groove=1+.035*Math.sin(a*17+t*.8)+.020*Math.sin(a*31-t*1.3),radius=tailRadius(t)*groove;
      const p=center.addScaledVector(frame.u,Math.cos(a)*radius*.86).addScaledVector(frame.v,Math.sin(a)*radius);
      ring.push(tail.add(p,tailWeight(t)));
    }
    if(rings.length)tail.bridge(rings.at(-1),ring);rings.push(ring);
  }
  tail.cap(rings[0]);tail.cap(rings.at(-1),true);
  // Overlapping outer locks begin at different heights and travel around a
  // rounded tail mass. Their staggered tips avoid a flat brush or a solid hose.
  for(let i=0;i<92;i++){
    const n=noise(i+211,seed),angle=i/92*TAU+.10*(n-.5),rootT=.018+.26*noise(i+919,seed),endT=.84+.16*noise(i+181,seed),points=[];
    for(let j=0;j<9;j++){
      const u=j/8,t=mix(rootT,endT,u),p=tailCenter(t),frame=tailFrame(t),a=angle+.12*Math.sin(t*4+i*.71);
      const rooted=tailRadius(t)*mix(.72,.99,THREE.MathUtils.smoothstep(u,0,.22));
      const radius=mix(rooted,(.020+.025*n)*S,THREE.MathUtils.smoothstep(u,.55,1));
      p.addScaledVector(frame.u,Math.cos(a)*radius*.86).addScaledVector(frame.v,Math.sin(a)*radius);
      p.x+=.008*S*Math.sin(t*7+i)*u*u;if(j===8)p.y-=(.008+.035*noise(i+311,seed))*S;points.push(p);
    }
    const weights=u=>tailWeight(mix(rootT,endT,u)),width=(.0020+.0021*n)*S;
    addFibre(tail,points,width,weights,6);
    for(let j=0;j<2;j++){
      const a=angle+(j-.5)*.065,offset=new THREE.Vector3(Math.sin(a),0,Math.cos(a)).multiplyScalar(width*.80);
      const fibres=points.map((p,k)=>p.clone().addScaledVector(offset,.4+.6*k/8).add(new THREE.Vector3(Math.sin(k+i+j)*.0015*S,0,Math.cos(k+i+j)*.0015*S)));
      fibres.at(-1).y-=(.012+.025*noise(i*4+j,seed))*S;
      addFibre(tail,fibres,(.00025+.00018*noise(i*3+j,seed))*S,weights,4);
    }
  }
  skinHair(tail,rig,materials.hair,'Full_Tail_With_Layered_Flowing_Locks',seed+7,S);
}
