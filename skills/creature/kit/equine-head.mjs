import * as THREE from 'three';

const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp,smooth=THREE.MathUtils.smoothstep;
const bell=(x,c,w)=>Math.exp(-(((x-c)/w)**2));

// Original surface-layout controls, relative to the eye landmark. These are
// authored shape constraints, not asserted breed measurements. Separate dorsal,
// mandibular and lateral boundaries keep the cheek from becoming one capsule.
const SHAPE=[
  [-.143,1.06,1.00,1.00,.96,1.00],
  [-.103,1.10,.99,1.02,.84,.96],
  [-.063,1.15,.98,1.04,.68,.86],
  [-.023,1.19,.98,1.05,.58,.82],
  [ .027,1.19,.98,1.05,.60,.86],
  [ .067,1.12,.99,.98,.70,.94],
  [ .107,1.06,1.00,.94,.86,1.00],
  [ .147,1.03,1.00,.95,.90,1.00],
  [ .187,1.00,1.00,1.00,.92,1.00],
  [ .227,1.00,1.00,1.02,.94,1.00],
  [ .312,1.00,1.00,1.00,1.00,1.00],
  [ .400,1.00,1.00,1.00,1.00,1.00],
];

/** Shared upper/lower oral boundary in bind space. A fixed palate closes the
 * main head; the matching lower lip can move without peeling off a whole snout. */
export function equineLipBoundary(base,morph,x,z=0){
  const H=morph.headScale,mouth=morph.head(base.mouth),dx=(x-mouth.x)/H;
  return mouth.y+H*(.018-.40*dx+.006*(z/(.085*H))**2);
}

function profile(x){
  if(x<=SHAPE[0][0])return SHAPE[0].slice(1);
  for(let i=1;i<SHAPE.length;i++)if(x<=SHAPE[i][0]){
    const a=SHAPE[i-1],b=SHAPE[i],t=smooth(x,a[0],b[0]);
    return a.slice(1).map((v,j)=>lerp(v,b[j+1],t));
  }
  return SHAPE.at(-1).slice(1);
}

/** Continuous control-cage boundary: forehead, planar cheek, nasal shaft and
 * soft muzzle have distinct cross sections but share every intervening ring. */
export function equineHeadSectionPoint(base,spec,morph,section,angle){
  const c=Math.cos(angle),sn=Math.sin(angle),[ventral,dorsal,width,power,returnX]=profile(section.x-base.eye[0]);
  const normal=new THREE.Vector3(-Math.sin(section.angle),Math.cos(section.angle),0),p=section.center.clone();
  const radius=section.ry*(c<0?ventral:dorsal);
  p.x+=normal.x*c*radius*(c<0?returnX:1);
  p.y+=normal.y*c*radius;
  // The lateral masseter is broad and almost planar. Its rounded mandibular
  // boundary is controlled independently from the narrower dorsal nasal bone.
  const upperTaper=1-.17*Math.max(0,c)**2;
  p.z=Math.sign(sn)*Math.abs(sn)**power*section.rz*width*upperTaper;
  return p;
}

function neighboursOf(cage){
  const n=cage.vertices.map(()=>new Set());
  for(const f of cage.faces)for(let j=0;j<f.length;j++){const a=f[j],b=f[(j+1)%f.length];n[a].add(b);n[b].add(a);}
  return n;
}

function fair(cage,neighbours,amount,passes,depthOnly=false){
  for(let k=0;k<passes;k++){
    const next=cage.vertices.map((v,i)=>{
      const strength=amount(v.p);if(strength<.003||!neighbours[i].size)return v.p;
      const mean=new THREE.Vector3();for(const j of neighbours[i])mean.add(cage.vertices[j].p);mean.divideScalar(neighbours[i].size);
      if(depthOnly){const p=v.p.clone();p.z=lerp(p.z,mean.z,strength);return p;}
      return v.p.clone().lerp(mean,strength);
    });
    cage.vertices.forEach((v,i)=>{v.p=next[i];});
  }
}

// Surface sampling is confined to the small orbital patch. It preserves the
// broad cheek/forehead slope while replacing rectangular face flow with actual
// concentric orbital loops sewn into the same closed main skin.
function patchSampler(cage,faces,side){
  const triangles=[];
  for(const f of faces)for(let j=1;j<f.length-1;j++){
    const ids=[f[0],f[j],f[j+1]],p=ids.map(i=>cage.vertices[i].p),[a,b,c]=p;
    const d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(d)>1e-14)triangles.push({ids,p,d});
  }
  return(x,y)=>{
    let chosen=null,height=-Infinity;
    for(const t of triangles){
      const[a,b,c]=t.p,u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/t.d,v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/t.d,w=1-u-v;
      const z=(u*a.z+v*b.z+w*c.z)*side;
      if(u>=-1e-5&&v>=-1e-5&&w>=-1e-5&&z>height){
        const weights={};for(const [k,bary]of [u,v,w].entries())for(const [bone,weight]of Object.entries(cage.vertices[t.ids[k]].w))weights[bone]=(weights[bone]??0)+bary*weight;
        height=z;chosen={z:z*side,w:weights};
      }
    }
    return chosen;
  };
}

function fairTriangulation(faces,cage){
  const area=f=>{const[a,b,c]=f.map(i=>cage.vertices[i].p);return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);};
  const quality=f=>{let lengths=0;for(let j=0;j<3;j++){const a=cage.vertices[f[j]].p,b=cage.vertices[f[(j+1)%3]].p;lengths+=(a.x-b.x)**2+(a.y-b.y)**2;}return Math.abs(area(f))/lengths;};
  // Ear clipping can leave sliver ears made of three nearly collinear outer
  // boundary vertices. They are not collinear in depth on a curved skull and
  // become sharp vertical fins. Flip only interior diagonals to improve the
  // actual projected triangle shape while preserving both sewn boundaries.
  for(let pass=0;pass<20;pass++){
    const edges=new Map();faces.forEach((f,fi)=>f.forEach((a,j)=>{const b=f[(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;if(!edges.has(key))edges.set(key,{a,b,faces:[]});edges.get(key).faces.push(fi);}));
    const changed=new Set();let count=0;
    for(const{a,b,faces:adj}of edges.values()){
      if(adj.length!==2||adj.some(i=>changed.has(i)))continue;
      const f=faces[adj[0]],g=faces[adj[1]],before=Math.min(quality(f),quality(g));if(before>.10)continue;
      const c=f.find(i=>i!==a&&i!==b),d=g.find(i=>i!==a&&i!==b);if(c===d)continue;
      const na=[c,d,a],nb=[d,c,b],orientation=Math.sign(area(f));
      if(area(na)*area(nb)<=0)continue;
      if(Math.min(quality(na),quality(nb))<=before+1e-5)continue;
      if(Math.sign(area(na))!==orientation){na.reverse();nb.reverse();}
      faces[adj[0]]=na;faces[adj[1]]=nb;changed.add(adj[0]);changed.add(adj[1]);count++;
    }
    if(!count)break;
  }
  return faces;
}

function orbitLoops(cage,eye,H,side){
  const rx=.074*H,ry=.052*H,center=eye.clone();
  const r2=p=>((p.x-center.x)/rx)**2+((p.y-center.y)/ry)**2;
  const selected=[],keep=[];
  for(const f of cage.faces){
    const p=new THREE.Vector3();f.forEach(i=>p.add(cage.vertices[i].p));p.divideScalar(f.length);
    if(p.z*side>.050*H&&r2(p)<1)selected.push(f);else keep.push(f);
  }
  if(selected.length<8)return;
  const edges=new Map(),key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
  for(const f of selected)for(let j=0;j<f.length;j++){
    const a=f[j],b=f[(j+1)%f.length],k=key(a,b);
    if(edges.has(k))edges.delete(k);else edges.set(k,[a,b]);
  }
  const next=new Map([...edges.values()].map(([a,b])=>[a,b]));
  const start=edges.values().next().value?.[0],boundary=[];
  let current=start;
  while(current!==undefined&&!boundary.includes(current)){boundary.push(current);current=next.get(current);}
  // Leave a valid original surface if a future profile creates multiple loops.
  if(current!==start||boundary.length!==edges.size)return;
  const sample=patchSampler(cage,selected,side),atCenter=sample(center.x,center.y);
  if(!atCenter)return;
  const signedArea=boundary.reduce((sum,id,j)=>{const a=cage.vertices[id].p,b=cage.vertices[boundary[(j+1)%boundary.length]].p;return sum+a.x*b.y-b.x*a.y;},0);
  const direction=Math.sign(signedArea)||side,angles=Array.from({length:64},(_,j)=>direction*j/64*Math.PI*2);
  const minRadius=Math.min(...boundary.map(i=>Math.sqrt(r2(cage.vertices[i].p))));
  const loops=[],newFaces=[];
  for(const radius of [.90,.78,.65,.54,.44,.33,.22,.10,.025]){
    const r=radius*Math.min(1,minRadius),ring=[];
    for(const a of angles){
      const x=center.x+Math.cos(a)*rx*r,y=center.y+Math.sin(a)*ry*r,hit=sample(x,y)??atCenter;
      ring.push(cage.add(new THREE.Vector3(x,y,hit.z),hit.w));
    }
    if(loops.length){
      const previous=loops.at(-1);
      for(let j=0;j<ring.length;j++){const k=(j+1)%ring.length;newFaces.push([previous[j],previous[k],ring[k],ring[j]]);}
    }else{
      // The grid-cut outer boundary is mildly concave. A one-to-one radial
      // bridge folds at its stair steps; triangulate the actual annulus instead.
      const to2=i=>{const p=cage.vertices[i].p;return new THREE.Vector2(p.x,p.y);};
      const ids=[...boundary,...ring],triangles=THREE.ShapeUtils.triangulateShape(boundary.map(to2),[ring.map(to2)]);
      const annulus=triangles.map(tri=>{const f=tri.map(i=>ids[i]),[a,b,c]=f.map(i=>cage.vertices[i].p);if(((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))*direction<0)f.reverse();return f;});
      newFaces.push(...fairTriangulation(annulus,cage));
    }
    loops.push(ring);
  }
  const last=loops.at(-1),middle=cage.add(new THREE.Vector3(center.x,center.y,atCenter.z),atCenter.w);
  for(let j=0;j<last.length;j++)newFaces.push([last[j],last[(j+1)%last.length],middle]);
  cage.faces=[...keep,...newFaces];
}

/** Final anatomical surface layout after shared refinement. Owns all equine
 * cheek/orbit/nasal shaping, so details fit one authoritative closed surface. */
export function sculptEquineHead(cage,base,spec,morph,{neighbours}={}){
  const H=morph.headScale,eye=morph.head(base.eye),nare=morph.head(base.nostril);
  neighbours??=neighboursOf(cage);
  fair(cage,neighbours,p=>.28*bell(p.x,nare.x+.020*H,.11*H)*bell(p.y,nare.y-.020*H,.13*H),5);
  // A large masseter plane narrows toward the nasal shaft. Its inferior border
  // is rounded in the cage, not drawn as a dark seam or a separate jaw tube.
  for(const vertex of cage.vertices){
    const p=vertex.p,z=Math.abs(p.z),side=Math.sign(p.z),dx=(p.x-eye.x)/H,dy=(p.y-eye.y)/H;
    if(z<.025*H||dx<-.18||dx>.34||dy<-.45||dy>.14)continue;
    const cheekR2=((dx+.010)/.100)**2+((dy+.107)/.105)**2;
    if(cheekR2<1){
      const plane=(.120+.045*(dy+.107)-.075*(dx+.010))*H;
      const blend=.82*(1-smooth(cheekR2,.16,1))*smooth(z,.055*H,.100*H);
      p.z=side*lerp(z,plane,blend);
    }
    // Facial crest connects the lower orbit to the maxilla. The modest relief
    // separates cheek and nasal planes without inventing a decorative groove.
    const along=(dx-dy)/Math.SQRT2,across=(dx+dy+.032)/Math.SQRT2;
    const crest=.0055*H*bell(across,0,.023)*smooth(along,.025,.085)*(1-smooth(along,.19,.29));
    p.z+=side*crest*smooth(Math.abs(p.z),.045*H,.085*H);
  }
  // Soften only the rounded mandibular margin; keep the central cheek planar.
  fair(cage,neighbours,p=>.24*bell(p.x,eye.x-.035*H,.100*H)*bell(p.y,eye.y-.172*H,.045*H),4);
  for(const side of [1,-1])orbitLoops(cage,eye,H,side);
  // Apply the broad orbital plane on both sides of the new loop boundary.
  // Restricting relief to the inset rings creates a scalloped patch border.
  for(const v of cage.vertices){
    const p=v.p,dx=(p.x-eye.x)/(.074*H),dy=(p.y-eye.y)/(.052*H),r=Math.hypot(dx,dy);
    if(r>1.4||Math.abs(p.z)<.050*H)continue;
    const angle=Math.atan2(dy,dx),fade=1-smooth(r,.93,1.4);
    const brow=.0075*H*Math.max(0,Math.sin(angle))**.75*bell(r,.65,.29);
    const temple=.0025*H*Math.max(0,-Math.cos(angle))*bell(r,.72,.30);
    const socket=-.0075*H*(1-smooth(r,.22,.59));
    p.z+=Math.sign(p.z)*(brow+temple+socket)*fade;
  }
  // The paired nasal vestibules are recesses in the closed main skin. The alar
  // folds and dark floor fit this exact surface rather than cover intact coat.
  for(const v of cage.vertices){
    const p=v.p,r2=((p.x-nare.x)/(.031*H))**2+((p.y-nare.y)/(.028*H))**2;
    if(r2<1&&Math.abs(p.z)>.025*H)p.z=Math.sign(p.z)*lerp(Math.abs(p.z),.041*H,1-smooth(r2,.18,1));
  }
  neighbours=neighboursOf(cage);
  fair(cage,neighbours,p=>.35*bell(p.x,nare.x,.044*H)*bell(p.y,nare.y,.042*H),5,true);
  const mouth=morph.head(base.mouth);
  for(const v of cage.vertices){
    const p=v.p,dx=(p.x-mouth.x)/H,lip=equineLipBoundary(base,morph,p.x,p.z),d=p.y-lip;
    if(dx<-.11||dx>.105||d>.025*H)continue;
    const fade=smooth(dx,-.11,-.080)*(1-smooth(dx,.082,.105));
    // A rounded maximum leaves an actual continuous, closed upper palate,
    // with a softened lip edge instead of a sharp Boolean cut or open hole.
    const target=lip+.5*(d+Math.sqrt(d*d+(.003*H)**2));
    p.y=lerp(p.y,target,fade);
  }
  const used=new Set(cage.faces.flat()),remap=new Map(),vertices=[];
  cage.vertices.forEach((v,i)=>{if(used.has(i)){remap.set(i,vertices.length);vertices.push(v);}});
  cage.vertices=vertices;cage.faces=cage.faces.map(f=>f.map(i=>remap.get(i)));
}
