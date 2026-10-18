import * as THREE from 'three';
import { Cage } from './geometry.mjs';

const TAU=Math.PI*2;
const clamp=THREE.MathUtils.clamp;
const gauss=(x,c,w)=>Math.exp(-(((x-c)/w)**2));
const lerp=THREE.MathUtils.lerp;
const band=(v,a,b,c,d)=>THREE.MathUtils.smoothstep(v,a,b)*(1-THREE.MathUtils.smoothstep(v,c,d));
// Piecewise control curves are intentionally not analytic ellipses: their
// joined planes are rounded by subdivision, retaining anatomical landmarks.
function curveAt(points,t){const u=clamp(t,0,1)*(points.length-1),i=Math.min(points.length-2,Math.floor(u));return points[i].map((a,k)=>lerp(a,points[i+1][k],u-i));}

/** Shared upper and lower lip contact surface in bind space. The shallow
 * transverse bow keeps the front nasal pad broad rather than a knife edge. */
export function bovineLipBoundary(base,morph,x,z=0){
  const origin=morph.head([1.435,1.060,0]),H=morph.headScale;
  return origin.y-.25*(x-origin.x);
}

/** One closed sewn dairy-cow skin. The cage follows anatomical masses rather
 * than relying on pigment to imply the back, flank, chest and skeletal joints.
 * Small cylindrical distal limb loops are joined to broad, oblique upper loops.
 */
export function buildBovineSkin(base,spec,morph,rig,colorAt,material){
  const cage=new Cage(),rings=[],N=40,S=morph.scale,shoulderVertices=new Map();
  const weights=(a,b,t=0)=>b?{[rig.index(a)]:1-t,[rig.index(b)]:t}:{[rig.index(a)]:1};
  const torsoWeights=x=>x>.20?weights('Body','Chest',clamp((x-.20)/.45,0,1)):x>-.45?weights('Body','Ribcage',.65):weights('Body');
  const sections=base.torso.map((s,i)=>({x:s[0],center:morph.torso([s[0],s[1],0]),ry:s[2]*spec.proportions.torsoDepth*S,ventral:base.ventralRadii[i]*spec.proportions.torsoDepth*S,rz:s[3]*spec.proportions.torsoWidth*S,angle:0,weights:torsoWeights(s[0]),part:'torso'}));
  base.neckHead.forEach((s,i)=>{
    const head=i>=3,map=head?morph.head:morph.neck;
    sections.push({x:s[0],center:map([s[0],s[1],0]),ry:s[2]*(head?spec.proportions.headLength:Math.sqrt(spec.proportions.neckLength*spec.proportions.torsoDepth))*S,rz:s[3]*(head?spec.proportions.headLength:spec.proportions.torsoWidth)*S,angle:s[4],weights:head?weights('Head'):weights('Chest','Neck',.55+i*.2),part:head?'head':'neck'});
  });
  function pointAt(s,a){
    const normal=new THREE.Vector3(-Math.sin(s.angle),Math.cos(s.angle),0);
      const c=Math.cos(a),z=Math.sin(a),p=s.center.clone();
      let ry=s.ry,rz=s.rz;
      if(s.part==='torso'){
        // The upper rib cage is a roof over a capacious lower barrel. A cow is
        // not a uniformly rounded tube; the loin and dorsal chine stay defined.
        const top=Math.max(c,0),bottom=Math.max(-c,0);
        rz*=1-.22*top**2;
        if(c<0)ry=s.ventral;
        p.y+=(.042*gauss(s.x,.33,.23)+.016*gauss(s.x,-.2,.65))*top**10*S;
        // Broad scapular relief, fading into the spring of the fore rib.
        rz+=.015*gauss(s.x,.38-.12*c,.13)*gauss(c,.2,.65)*S;
        // Brisket blends into the root of the forelimbs, with a narrow sternum.
        p.y-=.032*gauss(s.x,.57,.18)*bottom**5*S;
      }else if(s.part==='neck'){
        // A shallow midline dewlap is part of the continuous neck skin.
        // Keep neck musculature lean; the dewlap is a narrow ventral fold.
        rz*=.875*(1-.10*Math.max(c,0));
        if(c<0)ry*=1+.11*Math.exp(-((z/.24)**2));
      }else{
        const angle=Math.acos(clamp(c,-1,1))/Math.PI;
        const forehead=[[1,0],[.98,.38],[.86,.73],[.59,.94],[.24,1.02],[0,1],[-.31,.98],[-.62,.89],[-.85,.66],[-.98,.35],[-1,0]];
        const cheek=[[1,0],[.97,.32],[.83,.65],[.56,.90],[.23,1],[0,1.01],[-.34,1.01],[-.68,.98],[-.93,.77],[-1.07,.40],[-1.10,0]];
        const nasal=[[1,0],[.97,.27],[.80,.53],[.54,.77],[.22,.92],[0,1],[-.30,.94],[-.59,.80],[-.81,.60],[-.96,.33],[-1,0]];
        const muzzle=[[1,0],[.98,.36],[.85,.67],[.60,.88],[.28,.99],[0,1],[-.31,.98],[-.62,.88],[-.84,.67],[-.98,.36],[-1,0]];
        let profile=curveAt(forehead,angle);
        const cheekBlend=band(s.x,1.10,1.17,1.21,1.265),nasalBlend=band(s.x,1.21,1.28,1.33,1.38),muzzleBlend=THREE.MathUtils.smoothstep(s.x,1.335,1.39);
        for(const [shape,blend]of [[cheek,cheekBlend],[nasal,nasalBlend],[muzzle,muzzleBlend]]){const q=curveAt(shape,angle);profile=profile.map((v,i)=>lerp(v,q[i],blend));}
        p.addScaledVector(normal,profile[0]*ry);p.z+=Math.sign(z)*profile[1]*rz;
        return p;
      }
      const dorsal=s.part==='torso'&&c>0?THREE.MathUtils.lerp(c,1-Math.abs(z)**1.15,.32):c;
      p.addScaledVector(normal,dorsal*ry);p.z+=z*rz;
      if(s.part==='torso'){
        // The lateral thorax turns into the axilla above the sternum. Keep
        // the ventral midline low, but do not sew the arm onto the belly.
        p.y+=Math.max(0,1.035*S-p.y)*band(s.x,.15,.28,.58,.76)*band(Math.abs(p.z)/S,.09,.145,.34,.42);
      }
      if(s.part==='torso'&&c>0){
        // One sacrum-hook-pin patch replaces three accumulated inflations.
        // Every lateral corner lies below its sacral roof, avoiding tall fins.
        const influence=band(s.x,-1.055,-.96,-.49,-.28);
        const hook=gauss(s.x,-.66,.21),pin=gauss(s.x,-.98,.12);
        const roof=(s.center.y+(s.ry))- .012*S;
        const cornerY=roof-(.075-.025*hook+.015*pin)*S;
        const width=(.268+.044*hook-.043*pin)*S*spec.proportions.torsoWidth;
        const angle=Math.acos(clamp(c,-1,1))/(Math.PI/2);
        const cross=curveAt([[roof,0],[lerp(roof,cornerY,.08),width*.28],[lerp(roof,cornerY,.42),width*.62],[cornerY,width*.92],[lerp(cornerY,s.center.y,.42),width],[s.center.y,width*.97]],angle);
        p.y=lerp(p.y,cross[0],influence);p.z=lerp(p.z,Math.sign(z)*cross[1],influence);
      }
      return p;
  }
  for(const s of sections)rings.push(Array.from({length:N},(_,j)=>cage.add(pointAt(s,j/N*TAU),s.weights)));
  const mod=j=>(j+N)%N;
  const ports=[
    {id:'HL',u0:2,u1:7,v0:8,v1:18}, {id:'HR',u0:2,u1:7,v0:22,v1:32},
    {id:'FL',u0:12,u1:16,v0:6,v1:18}, {id:'FR',u0:12,u1:16,v0:22,v1:34},
    {id:'tail',u0:0,u1:2,v0:-3,v1:3}
  ];
  const isHole=(u,v)=>ports.some(p=>u>=p.u0&&u<p.u1&&Array.from({length:p.v1-p.v0},(_,k)=>mod(p.v0+k)).includes(v));
  for(let u=0;u<rings.length-1;u++)for(let v=0;v<N;v++)if(!isHole(u,v))cage.face(rings[u][v],rings[u][mod(v+1)],rings[u+1][mod(v+1)],rings[u+1][v]);
  // A single non-planar forty-sided cap creates a radial star after refinement.
  // Two concentric quad rows distribute the rear skin into a small central pole.
  let rear=rings[0];
  const rearCenter=sections[0].center.clone();
  for(const factor of [.66,.30]){
    const inner=rings[0].map(i=>cage.add(cage.vertices[i].p.clone().sub(rearCenter).multiplyScalar(factor).add(rearCenter).add(new THREE.Vector3(-.016*(1-factor)*S,0,0)),weights('Body')));
    for(let j=0;j<N;j++)cage.face(rear[j],inner[j],inner[mod(j+1)],rear[mod(j+1)]);
    rear=inner;
  }
  cage.cap(rear,true);cage.cap(rings.at(-1));
  const boundary=p=>{
    const b=[];for(let u=p.u0;u<p.u1;u++)b.push(rings[u][mod(p.v0)]);
    for(let v=p.v0;v<p.v1;v++)b.push(rings[p.u1][mod(v)]);
    for(let u=p.u1;u>p.u0;u--)b.push(rings[u][mod(p.v1)]);
    for(let v=p.v1;v>p.v0;v--)b.push(rings[p.u0][mod(v)]);return b;
  };
  const interpolateSection=u=>{const lo=Math.floor(u),hi=Math.min(base.torso.length-1,lo+1),t=u-lo,a=sections[lo],b=sections[hi];return{...a,x:THREE.MathUtils.lerp(a.x,b.x,t),center:a.center.clone().lerp(b.center,t),ry:THREE.MathUtils.lerp(a.ry,b.ry,t),ventral:THREE.MathUtils.lerp(a.ventral,b.ventral,t),rz:THREE.MathUtils.lerp(a.rz,b.rz,t)};};
  function roundPort(port){
    const ids=boundary(port),du=port.u1-port.u0,dv=port.v1-port.v0,uc=(port.u0+port.u1)/2,vc=(port.v0+port.v1)/2,grid=[];
    for(let u=port.u0;u<port.u1;u++)grid.push([u,port.v0]);for(let v=port.v0;v<port.v1;v++)grid.push([port.u1,v]);for(let u=port.u1;u>port.u0;u--)grid.push([u,port.v1]);for(let v=port.v1;v>port.v0;v--)grid.push([port.u0,v]);
    grid.forEach(([u,v],i)=>{const a=Math.atan2((v-vc)/(dv/2),(u-uc)/(du/2)),nu=uc+Math.cos(a)*du/2,nv=vc+Math.sin(a)*dv/2;cage.vertices[ids[i]].p.copy(pointAt(interpolateSection(nu),nv/N*TAU));});return ids;
  }
  function branch(port,lofts,leg){
    const shoulder=leg?.which==='front';
    let old=leg?(shoulder?boundary(port):roundPort(port)):boundary(port);const center=new THREE.Vector3();old.forEach(i=>center.add(cage.vertices[i].p));center.divideScalar(old.length);
    if(shoulder)for(const id of old){
      const v=cage.vertices[id],caudal=1-THREE.MathUtils.smoothstep(v.p.x/S,.34,.52),low=1-THREE.MathUtils.smoothstep(v.p.y/S,1.12,1.31),lateral=THREE.MathUtils.smoothstep(Math.abs(v.p.z)/S,.09,.17);
      v.w=weights('Chest',leg.upper,.20*caudal*low*lateral);
    }
    const outward=leg?new THREE.Vector3(0,-.70,leg.side*.71).normalize():new THREE.Vector3(-1,.30,0).normalize();
    const ref=leg?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1),basis=ref.clone().cross(outward).normalize();
    let angles=old.map(i=>{const p=cage.vertices[i].p.clone().sub(center);return Math.atan2(p.dot(basis),p.dot(ref));});
    const unwrapped=[angles[0]];for(let i=1;i<angles.length;i++){let d=angles[i]-angles[i-1];while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;unwrapped.push(unwrapped.at(-1)+d);}
    const direction=Math.sign(unwrapped.at(-1)-unwrapped[0])||1,start=angles[0];angles=angles.map((a,i)=>THREE.MathUtils.lerp(unwrapped[i],start+direction*TAU*i/angles.length,.75));
    for(let k=0;k<lofts.length;k++){
      const s=lofts[k],before=k?lofts[k-1].center:center,after=lofts[Math.min(k+1,lofts.length-1)].center;
      const tangent=s.axis??(k===lofts.length-1?s.center.clone().sub(before):after.clone().sub(before)).normalize();
      const e1=ref.clone().addScaledVector(tangent,-ref.dot(tangent)).normalize();
      const e2=e1.clone().cross(tangent).normalize();
      const target=angles.map(a=>{
        const p=s.center.clone().addScaledVector(e1,Math.cos(a)*s.rx).addScaledVector(e2,Math.sin(a)*s.rz);
        if(shoulder&&k<2){
          // The anterior/medial sector continues over the humerus. The deep
          // axillary turn belongs behind the elbow, not in front of the arm.
          const turn=Math.max(0,Math.cos(a))*Math.max(0,Math.sin(a));
          p.y+=[.10,.045][k]*S*turn;p.z+=leg.side*.07*S*turn;
          const anterior=Math.max(0,Math.cos(a))**3;
          p.x+=[.040,.022][k]*S*anterior;p.y-=[.055,.020][k]*S*anterior;
        }
        return p;
      });
      const ring=target.map((p,i)=>{
        let w=s.weights;
        if(shoulder&&k<2){
          const lateral=THREE.MathUtils.smoothstep(Math.abs(p.z)/S,.11,.29);
          const caudal=1-THREE.MathUtils.smoothstep(p.x/S,.38,.53);
          w=weights('Chest',leg.upper,Math.max((k===0?.12:.68)+(k===0?.28:.20)*lateral,caudal*.94));
        }
        const id=cage.add(p,w);if(shoulder&&k<7)shoulderVertices.set(id,leg);return id;
      });
      cage.bridge(old,ring);old=ring;
    }
    cage.cap(old,true);
  }
  for(const leg of rig.limbs){
    const p=leg.points,hind=leg.which==='hind',W=Math.sqrt(spec.proportions.torsoWidth),lofts=[];
    const add=(a,b,t,rx,rz,one,two,blend=0)=>lofts.push({center:a.clone().lerp(b,t),rx:rx*S*W,rz:rz*S*W,weights:weights(one,two,blend)});
    if(!hind){
      // Two deliberately oblique shoulder/triceps loops turn the surface
      // outward from the scapula and down into the elbow. Their broad upper
      // surfaces and narrower lower surfaces belong to the same sewn skin.
      for(const [x,y,z,rx,rz,down,lateral,mix]of [[.50,1.100,.230,.175,.150,-.50,.866,.68],[.47,1.005,.235,.125,.095,-.866,.50,.38]])
        lofts.push({center:morph.torso([x,y,z*leg.side]),rx:rx*S*W,rz:rz*S*W,axis:new THREE.Vector3(0,down,lateral*leg.side),weights:weights(leg.upper,'Chest',mix)});
    }
    // Roots are enveloped in the trunk. Generous oblique transition sections
    // replace the old sudden small-circle socket responsible for frog thighs.
    add(p.root,p.joint,.88,hind?.142:.106,hind?.102:.086,leg.upper,hind?'Body':'Chest',.20);
    add(p.root,p.joint,.95,hind?.115:.081,hind?.086:.070,leg.upper,leg.lower,.30);
    add(p.root,p.joint,1,hind?.094:.068,hind?.070:.061,leg.upper,leg.lower,.5);
    add(p.joint,p.knee,.10,hind?.095:.069,hind?.069:.061,leg.upper,leg.lower,.84);
    add(p.joint,p.knee,.34,hind?.091:.060,hind?.065:.052,leg.lower);
    add(p.joint,p.knee,.66,hind?.063:.049,hind?.047:.044,leg.lower);
    add(p.joint,p.knee,.91,hind?.054:.048,hind?.044:.043,leg.lower,leg.cannon,.26);
    add(p.joint,p.knee,1,hind?.059:.051,hind?.046:.046,leg.lower,leg.cannon,.5);
    add(p.knee,p.ankle,.10,hind?.047:.042,hind?.037:.037,leg.lower,leg.cannon,.88);
    add(p.knee,p.ankle,.28,.034,.029,leg.cannon);
    add(p.knee,p.ankle,.67,.032,.027,leg.cannon);
    add(p.knee,p.ankle,.90,.041,.038,leg.cannon,leg.pastern,.25);
    add(p.knee,p.ankle,1,.045,.041,leg.cannon,leg.pastern,.5);
    add(p.ankle,p.foot,.28,.043,.041,leg.pastern);
    add(p.ankle,p.foot,.62,.047,.047,leg.pastern,leg.hoof,.6);
    add(p.ankle,p.foot,.98,.051,.048,leg.hoof);
    if(!hind){
      // The elbow loops follow the forearm axis, even though their centres
      // approach along the caudally sloping humerus. Estimating this frame
      // from adjacent centres rotated nearly ninety degrees at the joint.
      const forearm=p.knee.clone().sub(p.joint).normalize();
      for(let i=2;i<=6;i++)lofts[i].axis=forearm;
    }
    branch(ports.find(p=>p.id===leg.id),lofts,leg);
  }
  branch(ports.find(p=>p.id==='tail'),base.tailPath.slice(1).map((p,i)=>({center:morph.tail(p),rx:[.031,.025,.020,.016,.011][i]*S,rz:[.029,.023,.019,.015,.010][i]*S,weights:weights(`Tail_${Math.min(2,Math.floor(i/2))}`,`Tail_${Math.min(3,Math.floor(i/2)+1)}`,i%2?.85:.35)})));
  // Fair the whole collar neighborhood with its surrounding body surface.
  const adjacency=cage.vertices.map(()=>new Set());for(const f of cage.faces)for(let j=0;j<f.length;j++){const a=f[j],b=f[(j+1)%f.length];adjacency[a].add(b);adjacency[b].add(a);}
  const fair=cage.vertices.map(v=>{let amount=0;for(const leg of rig.limbs.filter(l=>l.which==='hind')){const p=leg.points.root,dx=(v.p.x-p.x)/(.35*S),dy=(v.p.y-(p.y-.16*S))/(.30*S),dz=(Math.abs(v.p.z)-Math.abs(p.z))/(.22*S);amount=Math.max(amount,Math.exp(-(dx*dx+dy*dy+dz*dz)*1.3));}const upperPelvis=(1-THREE.MathUtils.smoothstep(v.p.x/S,-.43,-.24))*THREE.MathUtils.smoothstep(v.p.y/S,1.11,1.28);return amount*(1-upperPelvis);});
  for(let pass=0;pass<16;pass++){const next=cage.vertices.map((v,i)=>{const strength=fair[i]*.48;if(strength<.003||!adjacency[i].size)return v.p.clone();const average=new THREE.Vector3();for(const n of adjacency[i])average.add(cage.vertices[n].p);average.divideScalar(adjacency[i].size);return v.p.clone().lerp(average,strength);});cage.vertices.forEach((v,i)=>v.p.copy(next[i]));}
  // Fair only the interior of the new scapular patch. Its upper and outside
  // thoracic boundaries stay fixed; four local passes round the axilla while
  // retaining the separately authored triceps and sternum contours.
  const shoulderFair=cage.vertices.map(v=>{const P=spec.proportions,x=v.p.x/(S*P.torsoLength),y=base.legHeight+(v.p.y/S-base.legHeight*P.legLength)/P.torsoDepth;return .44*band(x,.21,.33,.65,.79)*band(y,.76,.87,1.19,1.37);});
  for(let pass=0;pass<4;pass++){const next=cage.vertices.map((v,i)=>{if(shoulderFair[i]<.003||!adjacency[i].size)return v.p.clone();const average=new THREE.Vector3();for(const n of adjacency[i])average.add(cage.vertices[n].p);average.divideScalar(adjacency[i].size);return v.p.clone().lerp(average,shoulderFair[i]);});cage.vertices.forEach((v,i)=>v.p.copy(next[i]));}
  // Restore broad skeletal planes after junction fairing: a defined loin and
  // hooks, shallow flank hollow, and scapular ridge without exposed sharp ribs.
  for(const v of cage.vertices){
    const p=v.p,P=spec.proportions,x=p.x/(S*P.torsoLength),y=base.legHeight+(p.y/S-base.legHeight*P.legLength)/P.torsoDepth,z=Math.abs(p.z/(S*P.torsoWidth)),side=Math.sign(p.z);
    if(x>-.99&&x<.65&&y>1.02){
      const hollow=gauss(x,-.48,.18)*gauss(y,1.19,.15)*gauss(z,.30,.12);
      p.z-=side*S*P.torsoWidth*.020*hollow;
      p.y+=S*P.torsoDepth*.020*gauss(x,-.1,.70)*gauss(z,0,.07)*gauss(y,1.47,.10);
    }
    if(x>.15&&x<.73&&y>.72&&y<1.25){
      p.y-=S*P.torsoDepth*.024*gauss(x,.53,.17)*gauss(y,.87,.13)*gauss(z,0,.13);
      p.z+=side*S*P.torsoWidth*.016*gauss(x,.46,.16)*gauss(y,1.00,.16)*gauss(z,.19,.10);
    }
    // The brisket is an anterior, narrow sternum with a separate rising
    // throat contour. Preserve that contour after limb-junction fairing.
    const brisket=gauss(x,.64,.13)*gauss(y,.99,.14)*gauss(z,0,.115);
    p.x+=S*P.torsoLength*.052*brisket;
    p.y-=S*P.torsoDepth*.062*brisket;
    // This broad scapular change of plane distinguishes the shoulder from
    // the lean neck without drawing an isolated ridge on the skin.
    const neckShoulder=gauss(x,.62-.30*(y-1.18),.075)*gauss(y,1.26,.19)*gauss(z,.19,.105);
    p.z-=side*S*P.torsoWidth*.025*neckShoulder;
    const span=(value,a,b,c,d)=>THREE.MathUtils.smoothstep(value,a,b)*(1-THREE.MathUtils.smoothstep(value,c,d));
    // Project the shoulder onto a pitched dorsal roof, instead of preserving
    // the broad rounded upper ellipse after collar smoothing.
    const shoulder=span(x,.17,.30,.55,.72)*THREE.MathUtils.smoothstep(y,1.15,1.30);
    const shoulderRoof=1.505-.76*z;
    if(y>shoulderRoof)p.y-=S*P.torsoDepth*(y-shoulderRoof)*shoulder*.82;
    const flank=span(x,-.67,-.57,-.34,-.21)*span(y,1.04,1.11,1.25,1.36)*span(z,.16,.25,.37,.43);
    p.z-=side*S*P.torsoWidth*.024*flank;
  }
  // Resolve the orbit in the control surface before subdivision. Applying a
  // narrow annular displacement to final triangles produced radial normals.
  const eye=morph.head(base.eye);
  for(const v of cage.vertices){const p=v.p;if(p.x<morph.head([1.08,0,0]).x)continue;const d=((p.x-eye.x)/(.060*morph.headScale))**2+((p.y-eye.y)/(.040*morph.headScale))**2;p.z-=Math.sign(p.z)*.009*morph.headScale*Math.exp(-d*1.35);}
  // Motion is assigned on the authored shoulder loops above. A spatial
  // override here used to capture sternum vertices and pull the chest into
  // the swinging arm. The original thoracic boundary stays on the chest.
  for(const [id,leg]of shoulderVertices){
    const v=cage.vertices[id],p=v.p,low=1-THREE.MathUtils.smoothstep(p.y/S,1.015,1.13),inside=THREE.MathUtils.smoothstep(Math.abs(p.z)/S,.105,.16),caudal=1-THREE.MathUtils.smoothstep(p.x/S,.53,.64),blend=low*inside*caudal;
    if(blend<.001)continue;
    const lower=1-THREE.MathUtils.smoothstep(p.y,leg.points.joint.y-.12*S,leg.points.joint.y+.015*S),target=weights(leg.upper,leg.lower,lower);
    for(const key of new Set([...Object.keys(v.w),...Object.keys(target)]))v.w[key]=lerp(v.w[key]??0,target[key]??0,blend);
  }
  // Shape the oral boundary before refinement so the lip-to-cheek turn has
  // organized neighboring quads rather than compressed final triangles.
  const used=new Set(cage.faces.flat()),remap=new Map(),vertices=[];
  cage.vertices.forEach((v,i)=>{if(used.has(i)){remap.set(i,vertices.length);vertices.push(v);}});cage.vertices=vertices;cage.faces=cage.faces.map(f=>f.map(i=>remap.get(i)));
  const controlTopology=cage.topology();cage.subdivide().subdivide();
  const topology=cage.topology(),geometry=cage.toGeometry(colorAt);
  // The external nostril recess belongs to the skin as well as its nasal pad;
  // a black insert alone would be occluded by an uncut surface beneath it.
  const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(pos,i);
    if(p.x<morph.head([1.08,0,0]).x)continue;
    const oralStart=morph.head([1.20,0,0]).x,lip=bovineLipBoundary(base,morph,p.x,p.z),d=p.y-lip,fade=THREE.MathUtils.smoothstep(p.x,oralStart,oralStart+.065*morph.headScale);
    if(d<.020*morph.headScale)p.y=lerp(p.y,lip+.5*(d+Math.sqrt(d*d+(.008*morph.headScale)**2)),fade);
    for(const side of [-1,1]){
      const n=morph.head(base.nostril);n.z*=side;
      if(p.z*side<0)continue;
      const d=((p.x-n.x)/(.041*morph.headScale))**2+((p.y-n.y)/(.026*morph.headScale))**2;
      p.z-=side*.028*morph.headScale*Math.exp(-d*1.55);
    }
    pos.setXYZ(i,p.x,p.y,p.z);
  }
  const pigmentOverride=[],oral=new THREE.Color('#27130f'),liningStart=morph.head([1.30,0,0]).x,oralEnd=morph.head([1.455,0,0]).x;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),depth=(y-bovineLipBoundary(base,morph,x,z))/morph.headScale;
    const alpha=band(x,liningStart,liningStart+.025*morph.headScale,oralEnd-.020*morph.headScale,oralEnd)*(1-THREE.MathUtils.smoothstep(Math.abs(z)/morph.headScale,.065,.097))*(1-THREE.MathUtils.smoothstep(depth,.002,.009));
    pigmentOverride.push(oral.r,oral.g,oral.b,alpha);
  }
  geometry.setAttribute('pigmentOverride',new THREE.Float32BufferAttribute(pigmentOverride,4));
  // The lower cheek deforms with its mandible. The fixed palate ends at the
  // lip, while the caudal masseter transitions gradually back to the head.
  const si=geometry.attributes.skinIndex,sw=geometry.attributes.skinWeight,headIndex=rig.index('Head'),jawIndex=rig.index('Jaw'),headOrigin=morph.head([0,0,0]);
  for(let i=0;i<pos.count;i++){
    const x=(pos.getX(i)-headOrigin.x)/morph.headScale,y=pos.getY(i),plane=bovineLipBoundary(base,morph,pos.getX(i),pos.getZ(i))+.09*morph.headScale;
    const blend=.84*band(x,1.09,1.15,1.27,1.33)*(1-THREE.MathUtils.smoothstep(y,plane+.02*morph.headScale,plane+.11*morph.headScale));
    if(blend<.001)continue;
    let headSlot=-1,emptySlot=-1;for(let k=0;k<4;k++){if(si.array[i*4+k]===headIndex&&sw.array[i*4+k]>.6)headSlot=k;if(sw.array[i*4+k]<1e-8)emptySlot=k;}
    if(headSlot<0||emptySlot<0)continue;const transfer=sw.array[i*4+headSlot]*blend;sw.array[i*4+headSlot]-=transfer;si.array[i*4+emptySlot]=jawIndex;sw.array[i*4+emptySlot]=transfer;
  }
  geometry.computeVertexNormals();const mesh=new THREE.SkinnedMesh(geometry,material);
  mesh.name='Continuous_Skin';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
  mesh.userData={part:'skin',originalControlCage:base.label,controlTopology,topology,anatomicalReview:'unreviewed',construction:'Original asymmetric bovine landmark cage; sewn broad shoulder and thigh junctions; two Catmull-Clark refinements.'};
  mesh.add(rig.root);mesh.bind(rig.skeleton);mesh.normalizeSkinWeights();return{mesh,topology,controlTopology};
}
