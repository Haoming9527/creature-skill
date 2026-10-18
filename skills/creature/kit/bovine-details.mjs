import * as THREE from 'three';
import { Cage, V, addLoft, tubeGeometry } from './geometry.mjs';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bovineLipBoundary } from './bovine-body.mjs';

const TAU=Math.PI*2;
const white=()=>new THREE.Color('white');
function attach(parent,geometry,material,name){
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function at(rig,bone,position,name){const g=new THREE.Group();g.name=name;g.position.copy(position).sub(rig.rest.get(bone).world);bone.add(g);return g;}
function geometry(positions,indices){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;}
function frame(normal,side=1){const n=normal.clone().normalize(),u=new THREE.Vector3(side,0,0);u.addScaledVector(n,-u.dot(n)).normalize();const v=n.clone().cross(u).normalize();return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u,v,n));}
function paint(g,origin,rotation,colorAt){const p=g.getAttribute('position'),colors=[];for(let i=0;i<p.count;i++){const c=colorAt(new THREE.Vector3().fromBufferAttribute(p,i).applyQuaternion(rotation).add(origin));colors.push(c.r,c.g,c.b);}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;}
const surfaceSamplers=new WeakMap();
function surfaceHeight(geo){
  if(surfaceSamplers.has(geo))return surfaceSamplers.get(geo);
  const p=geo.attributes.position,ix=geo.index.array,grid=new Map(),cell=.035;
  for(let i=0;i<ix.length;i+=3){
    const a=new THREE.Vector3().fromBufferAttribute(p,ix[i]),b=new THREE.Vector3().fromBufferAttribute(p,ix[i+1]),c=new THREE.Vector3().fromBufferAttribute(p,ix[i+2]),d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(d)<1e-12)continue;
    const t={a,b,c,d,minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minY:Math.min(a.y,b.y,c.y),maxY:Math.max(a.y,b.y,c.y)};
    for(let x=Math.floor(t.minX/cell);x<=Math.floor(t.maxX/cell);x++)for(let y=Math.floor(t.minY/cell);y<=Math.floor(t.maxY/cell);y++){const key=`${x},${y}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(t);}
  }
  const sample=(x,y)=>{let z=0;for(const t of grid.get(`${Math.floor(x/cell)},${Math.floor(y/cell)}`)??[]){if(x<t.minX||x>t.maxX||y<t.minY||y>t.maxY)continue;const u=((t.b.y-t.c.y)*(x-t.c.x)+(t.c.x-t.b.x)*(y-t.c.y))/t.d,v=((t.c.y-t.a.y)*(x-t.c.x)+(t.a.x-t.c.x)*(y-t.c.y))/t.d,w=1-u-v;if(u>=-1e-6&&v>=-1e-6&&w>=-1e-6)z=Math.max(z,Math.abs(u*t.a.z+v*t.b.z+w*t.c.z));}return z;};
  surfaceSamplers.set(geo,sample);return sample;
}
function fit(geo,origin,rotation,side,sample,weight){const p=geo.attributes.position,q=rotation.clone().invert();for(let i=0;i<p.count;i++){const world=new THREE.Vector3().fromBufferAttribute(p,i).applyQuaternion(rotation).add(origin),z=sample(world.x,world.y);if(z>0){world.z=THREE.MathUtils.lerp(world.z,side*(z-.0007),weight(i));world.sub(origin).applyQuaternion(q);p.setXYZ(i,world.x,world.y,world.z);}}geo.computeVertexNormals();return geo;}
function skinNormal(sample,p,side,step){return new THREE.Vector3(-(sample(p.x+step,p.y)-sample(p.x-step,p.y))/(2*step),-(sample(p.x,p.y+step)-sample(p.x,p.y-step))/(2*step),side).normalize();}
function palateHeight(geo,minX){
  const p=geo.attributes.position,ix=geo.index.array,grid=new Map(),cell=.025;
  for(let i=0;i<ix.length;i+=3){
    const a=new THREE.Vector3().fromBufferAttribute(p,ix[i]),b=new THREE.Vector3().fromBufferAttribute(p,ix[i+1]),c=new THREE.Vector3().fromBufferAttribute(p,ix[i+2]);if(Math.max(a.x,b.x,c.x)<minX)continue;
    const d=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(d)<1e-13)continue;
    const t={a,b,c,d};for(let x=Math.floor(Math.min(a.x,b.x,c.x)/cell);x<=Math.floor(Math.max(a.x,b.x,c.x)/cell);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/cell);z<=Math.floor(Math.max(a.z,b.z,c.z)/cell);z++){const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(t);}
  }
  return(x,z)=>{let y=Infinity;for(const{a,b,c,d}of grid.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)??[]){const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/d,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/d,w=1-u-v;if(u>=-1e-6&&v>=-1e-6&&w>=-1e-6)y=Math.min(y,u*a.y+v*b.y+w*c.y);}return y;};
}

function eye(base,spec,morph,rig,materials,colorAt,side){
  const S=morph.headScale,p=morph.head(base.eye),skull=surfaceHeight(rig.root.parent.geometry);
  p.z=side*(skull(p.x,p.y)+.0015*S);
  const g=at(rig,rig.head,p,`Eye_${side===1?'Left':'Right'}`);g.quaternion.copy(frame(skinNormal(skull,p,side,.025*S),side));
  const N=48,B=7,positions=[],indices=[];
  for(let k=0;k<=B;k++)for(let j=0;j<N;j++){
    const t=k/B,a=j/N*TAU,c=Math.cos(a),s=Math.sin(a);
    const w=THREE.MathUtils.lerp(.028,.042,t)*S,h=THREE.MathUtils.lerp(.013,.023,t)*S;
    const depth=0;
    positions.push(c*w,s*h*(.73+.27*Math.abs(s))+.002*c*S,depth);
    if(k<B){const a0=k*N+j,b=k*N+(j+1)%N;indices.push(a0,a0+N,b,b,a0+N,b+N);}
  }
  const socket=fit(geometry(positions,indices),p,g.quaternion,side,skull,()=>1),sp=socket.attributes.position;
  for(let i=0;i<sp.count;i++){const t=Math.floor(i/N)/B;sp.setZ(i,sp.getZ(i)+(.0012*(1-t)-.0004*t)*S);}socket.computeVertexNormals();paint(socket,p,g.quaternion,colorAt);attach(g,socket,materials.coat,'Orbital_Skin');
  const globe=attach(g,new THREE.SphereGeometry(1,32,16),materials.eye,'Corneal_Surface');globe.scale.set(.028*S,.0135*S,.008*S);globe.position.z=.001*S;
  const iris=attach(g,new THREE.SphereGeometry(1,24,12),materials.iris,'Brown_Iris');iris.scale.set(.010*S,.0086*S,.0011*S);iris.position.z=.009*S;
  const pupil=attach(g,new THREE.SphereGeometry(1,24,12),materials.pupil,'Horizontal_Pupil');pupil.scale.set(.0095*S,.0032*S,.001*S);pupil.position.z=.0102*S;
  const lid=Array.from({length:49},(_,i)=>{const a=i/48*TAU,v=new THREE.Vector3(Math.cos(a)*.028*S,Math.sin(a)*.013*S*(.73+.27*Math.abs(Math.sin(a)))+.002*Math.cos(a)*S,0),w=v.clone().applyQuaternion(g.quaternion).add(p);w.z=side*(skull(w.x,w.y)+.001*S);return w.sub(p).applyQuaternion(g.quaternion.clone().invert());});
  attach(g,tubeGeometry(lid,lid.map(()=>.0012*S),7),materials.eyelid,'Lid_Margin');
  // Fine upper eyelashes break the smooth model edge without making a fur coat.
  const lashes=[];for(let i=0;i<11;i++){
    const a=(.12+i/10*.76)*Math.PI,root=new THREE.Vector3(Math.cos(a)*.032*S,Math.sin(a)*.015*S,.006*S);
    const end=root.clone().add(new THREE.Vector3(Math.cos(a)*.004*S,.005*S,.006*S));
    lashes.push(tubeGeometry([root,root.clone().lerp(end,.55),end],[.00065,.00045,.00012].map(n=>n*S),4));
  }
  attach(g,mergeGeometries(lashes),materials.hair,'Upper_Lashes');
}

function pinna(base,spec,morph,rig,materials,colorAt,side){
  const S=morph.headScale,origin=morph.head(base.ear);origin.z*=side;
  const g=at(rig,rig.ears[side===1?0:1],origin,`Ear_${side===1?'Left':'Right'}`);
  const direction=V(base.earVector).multiplyScalar(S);direction.z*=side;
  const normal=new THREE.Vector3(1,0,.40*side).normalize(),positions=[],indices=[],groups=[],rows=28,N=48;
  for(let k=0;k<=rows;k++)for(let j=0;j<N;j++){
    const t=k/rows,a=j/N*TAU,s=Math.sin(a),c=Math.cos(a),width=(.007*(1-t)+.0006*t+.078*Math.sin(Math.PI*t)**.80*(1-.35*t))*S;
    const p=direction.clone().multiplyScalar(t).add(new THREE.Vector3(0,s*width,0));
    p.addScaledVector(normal,((.018*s*s-.008)*Math.sin(Math.PI*t)**.7+c*(.004*Math.sin(Math.PI*t)**.4+.0012*(1-t)+.0003*t))*S);
    positions.push(...p);
    if(k<rows){const a0=k*N+j,b=k*N+(j+1)%N,start=indices.length;indices.push(a0,b,b+N,a0,b+N,a0+N);groups.push([start,6,c>.40&&k>3&&k<rows-3?1:0]);}
  }
  for(let j=1;j<N-1;j++){const start=indices.length;indices.push(0,j+1,j);const e=rows*N;indices.push(e,e+j,e+j+1);groups.push([start,6,0]);}
  if(side<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const ear=geometry(positions,indices),colors=[],outerColor=materials.hair.color,innerColor=materials.ear.color;
  for(let k=0;k<=rows;k++)for(let j=0;j<N;j++){const t=k/rows,a=j/N*TAU,blend=THREE.MathUtils.smoothstep(Math.cos(a),.05,.72)*THREE.MathUtils.smoothstep(t,.08,.25)*(1-THREE.MathUtils.smoothstep(t,.82,.98)),c=outerColor.clone().lerp(innerColor,blend);colors.push(c.r,c.g,c.b);}
  ear.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const earMaterial=materials.skin.clone();earMaterial.color.set('white');earMaterial.roughness=.92;earMaterial.vertexColors=true;
  attach(g,ear,earMaterial,'Continuous_Pinna_Cup');
}

function nostril(base,spec,morph,rig,materials,side,sample){
  const S=morph.headScale,p=morph.head(base.nostril);p.z*=side;
  const g=at(rig,rig.head,p,`Nostril_${side===1?'Left':'Right'}`);g.quaternion.copy(frame(skinNormal(sample,p,side,.018*S),side));
  const shape=(a,scale,z)=>{const c=Math.cos(a),s=Math.sin(a);return new THREE.Vector3(c*.029*S*scale,s*.013*S*scale*(.66+.34*c)+.005*c*S*scale,z*S);};
  const N=48,positions=[],indices=[];
  for(let k=0;k<4;k++)for(let j=0;j<N;j++){
    const p=shape(j/N*TAU,[1.27,1.10,1,.75][k],[0,.002,.001,-.014][k]);positions.push(...p);
    if(k<3){const a=k*N+j,b=k*N+(j+1)%N;indices.push(a,b,b+N,a,b+N,a+N);}
  }
  const wing=fit(geometry(positions,indices),p,g.quaternion,side,sample,()=>1),wp=wing.attributes.position;
  for(let i=0;i<wp.count;i++){const a=(i%N)/N*TAU;wp.setZ(i,wp.getZ(i)+[0,.0015+.001*Math.max(0,Math.sin(a)),.0005,-.001][Math.floor(i/N)]*S);}
  const colors=[];for(let i=0;i<wp.count;i++){const k=Math.floor(i/N),c=materials.skin.color.clone().lerp(new THREE.Color('#171311'),[0,0,.25,.88][k]);colors.push(c.r,c.g,c.b);}wing.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const alarMaterial=materials.skin.clone();alarMaterial.color.set('white');alarMaterial.vertexColors=true;
  wing.computeVertexNormals();attach(g,wing,alarMaterial,'Nasal_Wing');
  const dark=materials.pupil.clone();dark.roughness=.88;
  const cavity=attach(g,new THREE.SphereGeometry(1,32,16),dark,'Nostril_Cavity');cavity.scale.set(.026*S,.010*S,.003*S);
  cavity.position.copy(new THREE.Vector3(p.x,p.y,side*(sample(p.x,p.y)+.008*S)).sub(p).applyQuaternion(g.quaternion.clone().invert()));
}

/** Bovine features use a broad muzzle and horizontal pinna, not horse details. */
export function buildBovineFace(base,spec,morph,rig,materials,colorAt){
  for(const side of [1,-1]){eye(base,spec,morph,rig,materials,colorAt,side);pinna(base,spec,morph,rig,materials,colorAt,side);}
  const S=morph.headScale;
  const noseSample=surfaceHeight(rig.root.parent.geometry);for(const side of [-1,1])nostril(base,spec,morph,rig,materials,side,noseSample);
  const jawCage=new Cage(),jawOrigin=rig.rest.get(rig.jaw).world;
  const jawSections=base.jaw.map((s,i)=>({center:morph.head([s[0],s[1]+[.095,.095,.095,.075,.042,.038][i],0]).sub(jawOrigin),ry:s[2]*S*[.50,.50,.50,.55,.87,.87][i],rz:s[3]*S*[.65,.65,.65,.72,.98,.98][i]}));
  for(const[x,y,ry,rz]of [[1.415,1.043,.028,.113],[1.442,1.043,.021,.099],[1.458,1.049,.010,.070],[1.464,1.051,.003,.034]])jawSections.push({center:morph.head([x,y,0]).sub(jawOrigin),ry:ry*S,rz:rz*S});
  addLoft(jawCage,jawSections,{segments:40});jawCage.subdivide().subdivide();
  const start=morph.head([1.285,0,0]).x,oral=new THREE.Color('#2c1712');
  const palate=palateHeight(rig.root.parent.geometry,start-.04*S);
  for(const v of jawCage.vertices){
    const p=v.p.clone().add(jawOrigin);p.y+=.006*S;const lip=bovineLipBoundary(base,morph,p.x,p.z)-.001*S,d=p.y-lip,fade=THREE.MathUtils.smoothstep(p.x,start,start+.065*S);
    if(d>-.025*S)p.y=THREE.MathUtils.lerp(p.y,lip+.5*(d-Math.sqrt(d*d+(.002*S)**2)),fade);
    const contact=palate(p.x,p.z),nearLip=THREE.MathUtils.smoothstep((p.y-lip)/S,-.020,-.004)*fade;
    if(Number.isFinite(contact)&&nearLip>0)p.y=THREE.MathUtils.lerp(p.y,contact-.001*S,nearLip);
    v.p.copy(p.sub(jawOrigin));
  }
  const jawGeometry=jawCage.toGeometry(p=>{
    const world=p.clone().add(jawOrigin),c=colorAt(world),depth=(bovineLipBoundary(base,morph,world.x,world.z)-.0025*S-world.y)/S,blend=THREE.MathUtils.smoothstep(world.x,start+.03*S,start+.065*S)*(1-THREE.MathUtils.smoothstep(Math.abs(world.z)/S,.065,.100))*(1-THREE.MathUtils.smoothstep(depth,.002,.010));return c.lerp(oral,blend);
  });jawGeometry.userData.preserveAuthoredPigment=true;
  const jaw=attach(rig.jaw,jawGeometry,materials.coat,'Lower_Jaw');jaw.userData.part='jaw';
  // A recessed cheek lining links the fixed palate to the mandible. Its open
  // anterior edge leaves real negative space between the matched lip surfaces.
  const lining=new Cage(),sides=[],columns=18,rows=8;
  for(const side of [-1,1]){
    const grid=[];
    for(let i=0;i<=columns;i++){
      const t=i/columns,p=morph.head([THREE.MathUtils.lerp(1.315,1.452,t),0,side*(.083+.015*Math.sin(Math.PI*t))]),sample=palate(p.x,p.z),upper=(Number.isFinite(sample)?sample:bovineLipBoundary(base,morph,p.x,p.z))-.0004*S,row=[];
      for(let j=0;j<=rows;j++){const v=j/rows;row.push(lining.add(new THREE.Vector3(p.x-.005*S*Math.sin(v*Math.PI),upper-.0025*S*v,p.z*(1-.18*Math.sin(v*Math.PI))),{[rig.index('Head')]:1-v,[rig.index('Jaw')]:v}));}grid.push(row);
    }
    for(let i=0;i<columns;i++)for(let j=0;j<rows;j++)lining.face(grid[i][j],grid[i+1][j],grid[i+1][j+1],grid[i][j+1]);sides.push(grid);
  }
  for(let j=0;j<rows;j++)lining.face(sides[0][0][j],sides[0][0][j+1],sides[1][0][j+1],sides[1][0][j]);
  const liningMaterial=new THREE.MeshStandardMaterial({name:'Bovine oral lining',color:'#28130f',roughness:.95,side:THREE.DoubleSide});
  const inside=new THREE.SkinnedMesh(lining.toGeometry(white),liningMaterial);inside.name='Oral_Cavity_Lining';inside.castShadow=true;inside.receiveShadow=true;inside.frustumCulled=false;rig.root.parent.parent.add(inside);inside.bind(rig.skeleton);inside.normalizeSkinWeights();
}

/** Four quarters are described by one continuous, supported udder surface. */
export function buildBovineUdder(spec,morph,rig,materials,colorAt){
  if(!spec.features.udder)return;
  // Authored estimates, not measured breed limits: supported rear attachment
  // about 1.09m; quarter floor about .62m, clearly above the .475m hock.
  const S=morph.scale,origin=morph.torso([-.61,.73,0]),g=at(rig,rig.body,origin,'Udder'),cage=new Cage(),rings=[],N=40;
  // Explicit rear and fore boundaries keep the rear attachment nearly
  // vertical. Moving the ring centres diagonally had produced a triangular
  // slab behind the thigh instead of a supported rounded mammary bag.
  for(const [y,rear,fore,rz]of [[.36,-.22,-.08,.085],[.27,-.29,.015,.130],[.18,-.32,.21,.171],[.09,-.32,.31,.193],[.015,-.305,.32,.198],[-.040,-.280,.29,.187],[-.085,-.235,.22,.157],[-.115,-.150,.12,.102]]){
    rings.push(Array.from({length:N},(_,j)=>{
      const a=j/N*TAU,lower=THREE.MathUtils.clamp((.22-y)/.30,0,1),quarter=1-.045*lower*Math.cos(a*4);
      const shift=(rear+fore)/2,rx=(fore-rear)/2;
      let x=shift+Math.cos(a)*rx*quarter,z=Math.sin(a)*rz*quarter;
      const rearWeight=Math.max(0,-Math.cos(a)),support=Math.exp(-((z/.034)**2)),foreRear=Math.exp(-((x/.055)**2));
      x+=.024*support*rearWeight*(.4+.6*lower);
      z-=Math.sign(z)*.010*foreRear*lower;
      const cleft=(.024*support+.011*foreRear)*Math.max(0,-y/.12);
      return cage.add(new THREE.Vector3(x*S*spec.proportions.torsoLength,(y+cleft+.014*Math.cos(a))*S*spec.proportions.torsoDepth,z*S*spec.proportions.torsoWidth),{0:1});
    }));
  }
  for(let i=1;i<rings.length;i++)cage.bridge(rings[i-1],rings[i]);cage.cap(rings[0]);cage.cap(rings.at(-1),true);cage.faces=cage.faces.map(f=>f.reverse());cage.subdivide().subdivide();
  const udderMaterial=materials.udder.clone();udderMaterial.color.set('white');udderMaterial.vertexColors=true;
  const udderColor=p=>{const c=materials.udder.color.clone();if(colorAt)c.lerp(colorAt(p.clone().add(origin)),THREE.MathUtils.smoothstep(p.y/(S*spec.proportions.torsoDepth),.12,.32));return c;};
  attach(g,cage.toGeometry(udderColor),udderMaterial,'Udder_Surface');
  for(const x of [-.13,.13])for(const z of [-.098,.098]){
    const points=[[x,-.070,z],[x,-.096,z],[x+.001,-.125,z],[x+.003,-.165,z],[x+.004,-.172,z]].map(p=>new THREE.Vector3(p[0]*spec.proportions.torsoLength,(-.089*spec.proportions.torsoDepth)+(p[1]+.089),p[2]*spec.proportions.torsoWidth).multiplyScalar(S));
    attach(g,tubeGeometry(points,[.026,.020,.017,.014,.008].map(r=>r*S),14),materials.udder,`Teat_${x<0?'Rear':'Fore'}_${z>0?'Left':'Right'}`);
  }
}
