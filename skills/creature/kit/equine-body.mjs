import * as THREE from 'three';
import { Cage } from './geometry.mjs';
import { equineHeadSectionPoint, sculptEquineHead } from './equine-head.mjs';

const TAU=Math.PI*2;
const clamp=THREE.MathUtils.clamp;
const gauss=(x,c,w)=>Math.exp(-(((x-c)/w)**2));

/** Original equine surface with independent sagittal boundaries, sewn
 * circumferential girdle patches, and landmark-constrained lateral anatomy.
 * Scapula, upper arm and thigh remain continuous with the thorax and pelvis. */
export function buildEquineSkin(base,spec,morph,rig,colorAt,material){
  const cage=new Cage(),rings=[],segments=40,P=spec.proportions,S=morph.scale,H=morph.headScale;
  const bodyCoordinates=p=>({x:p.x/(S*P.torsoLength),y:base.legHeight+(p.y/S-base.legHeight*P.legLength)/P.torsoDepth,z:Math.abs(p.z)/(S*P.torsoWidth)});
  const weights=(bone,other,t=0)=>other?{[rig.index(bone)]:1-t,[rig.index(other)]:t}:{[rig.index(bone)]:1};
  const torsoWeights=x=>x>.20?weights('Body','Chest',clamp((x-.20)/.42,0,.88)):x>-.42?weights('Body','Ribcage',.70):weights('Body');
  const sections=base.torso.map((s,i)=>({x:s[0],center:morph.torso([s[0],s[1],0]),ry:s[2]*P.torsoDepth*S,rz:s[3]*P.torsoWidth*S,dorsal:morph.torso([s[0],base.dorsalHeights[i],0]).y,ventral:morph.torso([s[0],base.ventralHeights[i],0]).y,angle:s[4]??0,weights:torsoWeights(s[0]),part:'torso'}));
  const headStart=base.headSectionStart??7;
  base.neckHead.forEach((s,i)=>{
    const isHead=i>=headStart,map=isHead?morph.head:morph.neck;
    sections.push({x:s[0],center:map([s[0],s[1],0]),ry:s[2]*(isHead?P.headLength:Math.sqrt(P.neckLength*P.torsoDepth))*S,rz:s[3]*(isHead?P.headLength:P.torsoWidth)*S,angle:s[4],weights:isHead?weights('Head'):weights(i<2?'Chest':'Neck',i<2?'Neck':'Head',i<2?.45:clamp((i-4)/4,0,.45)),part:isHead?'head':'neck'});
  });
  function torsoPoint(s,a){
    const c=Math.cos(a),sn=Math.sin(a),p=s.center.clone();
    // Broad rib sides become a narrower sternum, with a distinctly rising flank.
    // Separate dorsal and ventral section boundaries. The shoulder's lower
    // contour turns into the sternum, rather than continuing the crest tilt
    // forward as a broad triangular chest.
    const ventral=c<0,sternalTurn=ventral?1-.85*THREE.MathUtils.smoothstep(s.x,.34,.50)+.45*THREE.MathUtils.smoothstep(s.x,.52,.66):1;
    p.x-=Math.sin(s.angle)*c*s.ry*sternalTurn;
    p.y=c>=0?s.center.y+Math.pow(c,1.15)*(s.dorsal-s.center.y):s.center.y+(-c)*(s.ventral-s.center.y);
    p.z+=sn*s.rz*(1-.18*Math.max(0,-c)**2);
    return p;
  }
  function pointAt(s,a){
    if(s.part==='torso')return torsoPoint(s,a);
    if(s.part==='head')return equineHeadSectionPoint(base,spec,morph,s,a);
    const c=Math.cos(a),sn=Math.sin(a),normal=new THREE.Vector3(-Math.sin(s.angle),Math.cos(s.angle),0);
    const throatTaper=s.part==='neck'&&c<0?.97+.10*gauss(s.x,base.neckHead[0][0],.10)+.24*gauss(s.x,.95,.14)-.14*gauss(s.x,1.12,.06):1;
    const p=s.center.clone().addScaledVector(normal,c*s.ry*throatTaper);
    if(s.part==='neck'&&c<0){
      // Independent throat boundary: the concave lower neck turns back over
      // the projecting shoulder instead of extending the crest's ring tilt
      // as a straight diagonal all the way into the foreleg.
      const throatX=.35+.65*gauss(s.x,base.neckHead[headStart-1][0],.13);
      p.x=s.center.x+normal.x*c*s.ry*throatTaper*throatX;
    }
    p.z=sn*s.rz*(1-.20*Math.max(0,c)**3-.09*Math.max(0,-c)**2);
    return p;
  }
  for(const s of sections)rings.push(Array.from({length:segments},(_,j)=>cage.add(pointAt(s,j/segments*TAU),s.weights)));
  const mod=j=>(j+segments)%segments;
  const indexNear=x=>base.torso.reduce((best,s,i)=>Math.abs(s[0]-x)<Math.abs(base.torso[best][0]-x)?i:best,0);
  const ports=[
    {id:'HL',u0:indexNear(-.93),u1:indexNear(-.42),v0:10,v1:18},
    {id:'HR',u0:indexNear(-.93),u1:indexNear(-.42),v0:22,v1:30},
    {id:'FL',u0:indexNear(.32),u1:indexNear(.66),v0:10,v1:18},
    {id:'FR',u0:indexNear(.32),u1:indexNear(.66),v0:22,v1:30},
    {id:'tail',u0:0,u1:2,v0:-3,v1:3}
  ];
  const isHole=(u,v)=>ports.some(p=>u>=p.u0&&u<p.u1&&Array.from({length:p.v1-p.v0},(_,k)=>mod(p.v0+k)).includes(v));
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++)if(!isHole(i,j))cage.face(rings[i][j],rings[i][mod(j+1)],rings[i+1][mod(j+1)],rings[i+1][j]);
  // Keep the rear cap's high-valence pole tiny and recessed. A broad n-gon
  // directly behind the dock produces a visible radial fan in grazing light.
  let rear=rings[0];const rearCenter=sections[0].center.clone();
  for(const factor of [.68,.32,.055]){
    const inner=rings[0].map(i=>cage.add(cage.vertices[i].p.clone().sub(rearCenter).multiplyScalar(factor).add(rearCenter).add(new THREE.Vector3(-.012*(1-factor)*S,0,0)),weights('Body')));
    for(let j=0;j<segments;j++)cage.face(rear[j],inner[j],inner[mod(j+1)],rear[mod(j+1)]);
    rear=inner;
  }
  cage.cap(rear,true);cage.cap(rings.at(-1));
  function boundary(port){const out=[];for(let u=port.u0;u<port.u1;u++)out.push(rings[u][mod(port.v0)]);for(let v=port.v0;v<port.v1;v++)out.push(rings[port.u1][mod(v)]);for(let u=port.u1;u>port.u0;u--)out.push(rings[u][mod(port.v1)]);for(let v=port.v1;v>port.v0;v--)out.push(rings[port.u0][mod(v)]);return out;}
  function girdlePatch(port,leg,first){
    const outer=boundary(port),uv=[],du=port.u1-port.u0,dv=port.v1-port.v0;
    for(let u=port.u0;u<port.u1;u++)uv.push([u,port.v0]);for(let v=port.v0;v<port.v1;v++)uv.push([port.u1,v]);for(let u=port.u1;u>port.u0;u--)uv.push([u,port.v1]);for(let v=port.v1;v>port.v0;v--)uv.push([port.u0,v]);
    const angles=[];
    const authored=uv.map(([u,v])=>{
      const t=(u-port.u0)/du,q=(v-port.v0)/dv,a=Math.atan2(q-.5,t-.5);angles.push(a);
      const boundaryPoint=cage.vertices[rings[u][mod(v)]].p.clone();
      const armPoint=first.center.clone().add(new THREE.Vector3(Math.cos(a)*(Math.cos(a)<0?first.rxBack??first.rx:first.rx),0,-Math.sin(a)*first.rz));
      const distance=armPoint.distanceTo(boundaryPoint),tangent=armPoint.clone().sub(boundaryPoint).multiplyScalar(.85);
      const endTangent=new THREE.Vector3(0,-distance*.6,0);
      return{boundaryPoint,tangent,armPoint,endTangent,q,angle:a};
    });
    let previous=outer;
    // The lateral scapular sheet turns continuously around the complete upper
    // arm circumference. Longitudinal strips turn into the descending distal
    // limb instead of folding a flat lateral panel around the joint.
    for(const t of [.18,.40,.68,1]){
      const ring=authored.map(a=>{const t2=t*t,t3=t2*t,p=a.boundaryPoint.clone().multiplyScalar(2*t3-3*t2+1).addScaledVector(a.tangent,t3-2*t2+t).addScaledVector(a.armPoint,-2*t3+3*t2).addScaledVector(a.endTangent,t3-t2),body=(1-t)**2,distal=THREE.MathUtils.smoothstep(t,.55,1),w=weights(leg.upper,leg.which==='hind'?rig.body:rig.chest,body);if(leg.which==='front')p.x-=.030*S*P.torsoLength*Math.sin(Math.PI*t)**2*Math.max(0,-Math.cos(a.angle))**4;for(const key of Object.keys(w))w[key]*=1-distal;for(const [key,value]of Object.entries(first.weights))w[key]=(w[key]??0)+value*distal;return cage.add(p,w);});
      cage.bridge(previous,ring);previous=ring;
    }
    return{ring:previous,angles};
  }
  function branch(port,parts,leg){
    const shoulder=leg?girdlePatch(port,leg,parts[0]):null;
    let old=shoulder?.ring??boundary(port);
    if(shoulder)parts=parts.slice(1);
    const center=new THREE.Vector3();old.forEach(i=>center.add(cage.vertices[i].p));center.divideScalar(old.length);
    const outward=leg?new THREE.Vector3(0,-.70,leg.side*.71).normalize():new THREE.Vector3(-1,.30,0).normalize();
    const ref=leg?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1),basis=ref.clone().cross(outward).normalize();
    let angles=old.map(i=>{const p=cage.vertices[i].p.clone().sub(center);return Math.atan2(p.dot(basis),p.dot(ref));});
    // Preserve the boundary orientation while regularising its angular spacing.
    const unwrapped=[angles[0]];for(let i=1;i<angles.length;i++){let d=angles[i]-angles[i-1];while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;unwrapped.push(unwrapped.at(-1)+d);}
    const direction=Math.sign(unwrapped.at(-1)-unwrapped[0])||1;
    const start=angles[0];angles=shoulder?.angles??angles.map((a,i)=>THREE.MathUtils.lerp(unwrapped[i],start+direction*TAU*i/angles.length,.75));
    for(let i=0;i<parts.length;i++){
      const s=parts[i],prev=i?parts[i-1].center:center,next=parts[Math.min(i+1,parts.length-1)].center;
      const axis=s.axis?.clone()??(i===parts.length-1?s.center.clone().sub(prev):next.clone().sub(prev)).normalize();
      const u=ref.clone().addScaledVector(axis,-ref.dot(axis)).normalize(),v=u.clone().cross(axis).normalize();
      const ring=angles.map(a=>{
        const c=Math.cos(a),sn=Math.sin(a),point=s.center.clone();
        let front=c*(c<0&&s.rxBack?s.rxBack:s.rx),side=sn*s.rz;
        if(leg){
          const p=leg.points,distToKnee=s.center.distanceTo(p.knee)/S;
          const cannonU=(p.knee.y-s.center.y)/(p.knee.y-p.ankle.y);
          if(cannonU>.12&&cannonU<.88){
            // A compressed metacarpal/metatarsal shaft has broad front/side
            // planes and a separate narrow posterior tendon edge.
            front=Math.sign(c)*Math.abs(c)**.82*s.rx;
            side=Math.sign(sn)*Math.abs(sn)**.88*s.rz;
            front-=.006*S*Math.max(0,-c)**8*Math.sin(Math.PI*cannonU);
          }
          if(leg.which==='hind')front-=.027*S*gauss(distToKnee,0,.040)*Math.max(0,-c)**6;
          else front+=.007*S*gauss(distToKnee,0,.040)*Math.max(0,c)**4;
        }
        if(s.coronet){side*=c<0?.77+.23*(1+c):1;point.y-=.18*base.hoof.height*S*Math.max(0,-c);}
        point.addScaledVector(u,front).addScaledVector(v,side);
        return cage.add(point,s.weights);
      });
      cage.bridge(old,ring);old=ring;
    }
    cage.cap(old,true);
  }
  for(const leg of rig.limbs){
    const p=leg.points,hind=leg.which==='hind',W=Math.sqrt(P.torsoWidth)*S,parts=[];
    const add=(a,b,t,rx,rz,bone,other,mix=0,rxBack=rx)=>parts.push({center:a.clone().lerp(b,t),rx:rx*W,rz:rz*W,rxBack:rxBack*W,weights:weights(bone,other,mix)});
    // Large proximal volumes merge into the shoulder/haunch; the forearm,
    // gaskin, flat cannon, fetlock and pastern each have their own paired loops.
    // Radii follow lateral/cranial reference proportions: a broad muscular
    // forearm and gaskin, wide flat knee and hock, and a fetlock knob clearly
    // larger than the cannon above it.
    add(p.joint,p.knee,.10,hind?.100:.086,hind?.078:.064,leg.upper,leg.lower,.85,hind?.125:.086);
    // Caudal radii carry the hamstring/gaskin and the olecranon/flexor mass,
    // which lie behind the bones rather than symmetrically around them.
    add(p.joint,p.knee,.29,hind?.085:.078,hind?.074:.060,leg.lower,undefined,0,hind?.150:.084);
    add(p.joint,p.knee,.57,hind?.066:.064,hind?.062:.050,leg.lower,undefined,0,hind?.122:.070);
    add(p.joint,p.knee,.80,hind?.052:.052,hind?.050:.044,leg.lower,undefined,0,hind?.086:.054);
    add(p.joint,p.knee,.94,hind?.052:.054,hind?.050:.052,leg.lower,leg.cannon,.25,hind?.072:.054);
    add(p.joint,p.knee,1,hind?.056:.055,hind?.050:.054,leg.lower,leg.cannon,.50,hind?.070:.055);
    add(p.knee,p.ankle,.08,hind?.048:.048,hind?.042:.046,leg.lower,leg.cannon,.85);
    add(p.knee,p.ankle,.22,.038,.030,leg.cannon);
    add(p.knee,p.ankle,.54,.036,.028,leg.cannon);
    add(p.knee,p.ankle,.79,.039,.031,leg.cannon);
    add(p.knee,p.ankle,.94,.050,.044,leg.cannon,leg.pastern,.25);
    add(p.knee,p.ankle,1,.052,.045,leg.cannon,leg.pastern,.50);
    add(p.ankle,p.foot,.22,.045,.038,leg.pastern,leg.hoof,.15);
    add(p.ankle,p.foot,.55,.043,.041,leg.pastern,leg.hoof,.85);
    const hoofLength=base.hoof.length*S*(hind?.96:1),hoofWidth=base.hoof.width*S*(hind?.94:1);
    // Two support loops meet the sloping hoof crown; the closing cap is buried
    // inside the keratin shell, so subdivision cannot leave a floating cuff.
    for(const extra of [.004,0])parts.push({center:new THREE.Vector3(p.foot.x-.17*hoofLength,base.hoof.height*S+extra*S,p.foot.z),rx:.39*hoofLength,rz:.39*hoofWidth,axis:new THREE.Vector3(0,-1,0),coronet:true,weights:weights(leg.hoof)});
    parts.push({center:p.foot.clone().add(new THREE.Vector3(-.022*S,-.012*S,0)),rx:.041*S,rz:.032*S,axis:new THREE.Vector3(0,-1,0),weights:weights(leg.hoof)});
    branch(ports.find(a=>a.id===leg.id),parts,leg);
  }
  // The tail's fleshy dock ends above the hock. Long distal length is hair,
  // which follows the complete tail skeleton in the equine-details module.
  const dock=[morph.tail([-1.055,1.485,0]),morph.tail(base.tailPath[1]),morph.tail(base.tailPath[1]).lerp(morph.tail(base.tailPath[2]),.70),morph.tail(base.tailPath[2])];
  branch(ports.find(p=>p.id==='tail'),dock.map((center,i)=>({center,rx:[.044,.038,.025,.006][i]*S,rz:[.044,.038,.025,.006][i]*S,weights:weights('Tail_0','Tail_1',[.05,.15,.65,1][i])})));
  const used=new Set(cage.faces.flat()),remap=new Map(),compact=[];cage.vertices.forEach((v,i)=>{if(used.has(i)){remap.set(i,compact.length);compact.push(v);}});cage.vertices=compact;cage.faces=cage.faces.map(f=>f.map(i=>remap.get(i)));
  for(const v of cage.vertices){
    const p=v.p,eye=morph.head(base.eye),side=Math.sign(p.z),neckOrigin=morph.neck(base.neckPivot);
    const x=base.neckPivot[0]+(p.x-neckOrigin.x)/(S*P.neckLength),y=base.neckPivot[1]+(p.y-neckOrigin.y)/(S*P.neckLength);
    if(x<.60||p.x>eye.x-.07*H||y<1.20||Math.abs(p.z)<.03*S*P.torsoWidth)continue;
    const lateral=clamp((Math.abs(p.z)/(S*P.torsoWidth)-.03)/.06,0,1);
    const lineX=.75+(y-1.30)*.75;
    const lowerNeck=.025*gauss(x,lineX,.052)*gauss(y,1.53,.27);
    const jugular=-.011*gauss(x,lineX+.075,.035)*gauss(y,1.54,.25);
    const upperPlane=.014*gauss(x,.89,.20)*gauss(y,1.78,.17);
    p.z+=side*S*P.torsoWidth*lateral*(lowerNeck+jugular+upperPlane);
  }
  // The fold in front of the stifle belongs partly to the moving thigh. A
  // torso-only rim stayed fixed while the forward-swinging thigh crossed it.
  // Paint that transition into the upper limb, preserving the full volume.
  for(const vertex of cage.vertices)for(const leg of rig.limbs.filter(l=>l.which==='hind')){
    if(vertex.p.z*leg.side<0)continue;
    const center=leg.points.joint.clone().add(new THREE.Vector3(.11*S,.11*S,0)),p=vertex.p;
    const blend=.45*gauss(p.x,center.x,.15*S)*gauss(p.y,center.y,.17*S)*gauss(p.z,center.z,.13*S);
    if(blend<.001)continue;let transfer=0;
    for(const bone of [rig.body,rig.ribs]){const id=rig.index(bone),amount=(vertex.w[id]??0)*blend;vertex.w[id]=(vertex.w[id]??0)-amount;transfer+=amount;}
    const upper=rig.index(leg.upper);vertex.w[upper]=(vertex.w[upper]??0)+transfer;
  }
  const controlTopology=cage.topology();cage.subdivide();
  // One authored lateral surface per girdle. The control landmarks describe
  // the scapular plane, shoulder turn and triceps, and the broad gluteal sweep
  // into the stifle. They replace the previous sum of independent bulges.
  const lateralPatch=(outline,interior)=>{
    const points=[...outline,...interior],n=points.length,phi=r2=>r2<1e-14?0:r2*Math.log(r2),matrix=Array.from({length:n+3},()=>Array(n+4).fill(0));
    // A single minimum-bending surface through the width landmarks gives
    // continuous first derivatives across the entire anatomical patch.
    for(let i=0;i<n;i++){for(let j=0;j<n;j++)matrix[i][j]=phi((points[i][0]-points[j][0])**2+(points[i][1]-points[j][1])**2);matrix[i][n]=matrix[n][i]=1;matrix[i][n+1]=matrix[n+1][i]=points[i][0];matrix[i][n+2]=matrix[n+2][i]=points[i][1];matrix[i][n+3]=points[i][2];}
    for(let i=0;i<n+3;i++){let pivot=i;for(let j=i+1;j<n+3;j++)if(Math.abs(matrix[j][i])>Math.abs(matrix[pivot][i]))pivot=j;[matrix[i],matrix[pivot]]=[matrix[pivot],matrix[i]];const denominator=matrix[i][i];for(let k=i;k<n+4;k++)matrix[i][k]/=denominator;for(let j=0;j<n+3;j++)if(j!==i){const factor=matrix[j][i];for(let k=i;k<n+4;k++)matrix[j][k]-=factor*matrix[i][k];}}
    const coefficients=matrix.map(row=>row[n+3]);
    for(const vertex of cage.vertices){
      const p=bodyCoordinates(vertex.p);if(p.z<.09)continue;
      let inside=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j];if((a[1]>p.y)!==(b[1]>p.y)&&p.x<(b[0]-a[0])*(p.y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}if(!inside)continue;
      let edgeDistance=Infinity;
      for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy),0,1);edgeDistance=Math.min(edgeDistance,Math.hypot(p.x-a[0]-t*dx,p.y-a[1]-t*dy));}
      const target=coefficients[n]+coefficients[n+1]*p.x+coefficients[n+2]*p.y+points.reduce((sum,q,i)=>sum+coefficients[i]*phi((p.x-q[0])**2+(p.y-q[1])**2),0),blend=.65*THREE.MathUtils.smoothstep(edgeDistance,0,.14)*THREE.MathUtils.smoothstep(p.z,.09,.17);
      vertex.p.z=Math.sign(vertex.p.z)*THREE.MathUtils.lerp(p.z,target,blend)*S*P.torsoWidth;
    }
  };
  lateralPatch([
    [.04,1.12,.235],[.04,1.50,.20],[.23,1.66,.10],[.48,1.70,.12],[.73,1.55,.14],[.82,1.31,.11],[.70,1.13,.16],[.49,.96,.235],[.29,.98,.19]
  ],[[.34,1.48,.260],[.44,1.52,.205],[.19,1.43,.235],[.60,1.26,.282],[.37,1.14,.286],[.25,1.17,.255],[.26,1.31,.252],[.49,1.37,.278],[.55,1.10,.250]]);
  lateralPatch([
    [-1.00,1.25,.17],[-.95,1.55,.16],[-.75,1.68,.10],[-.43,1.61,.13],[-.30,1.34,.24],[-.36,1.07,.20],[-.52,.96,.24],[-.77,1.03,.23]
  ],[[-.76,1.48,.283],[-.57,1.36,.292],[-.57,1.15,.312],[-.78,1.21,.286]]);
  // The upper arm is embedded in the chest. Paint the triceps and its sewn
  // boundary with one spatial field, so neighbouring faces do not acquire
  // conflicting motion merely because they came from different cage rings.
  for(const vertex of cage.vertices){
    const p=bodyCoordinates(vertex.p),hind=p.x<0;if(p.x<(hind?-1.04:.16)||p.x>(hind?-.23:.87)||p.y<.94||p.y>1.49)continue;
    const side=Math.sign(vertex.p.z),leg=rig.limbs.find(l=>l.which===(hind?'hind':'front')&&l.side===side);if(!leg)continue;
    const upper=rig.index(leg.upper),lower=rig.index(leg.lower),chest=rig.index(rig.chest),body=rig.index(rig.body),rib=rig.index(rig.ribs),distalLeak=(vertex.w[lower]??0)*THREE.MathUtils.smoothstep(p.y,.99,1.09);
    vertex.w[lower]=(vertex.w[lower]??0)-distalLeak;vertex.w[upper]=(vertex.w[upper]??0)+distalLeak;
    const mass=(vertex.w[upper]??0)+(vertex.w[chest]??0)+(vertex.w[body]??0)+(vertex.w[rib]??0);
    const blend=THREE.MathUtils.smoothstep(p.x,hind?-1.04:.16,hind?-.91:.29)*(1-THREE.MathUtils.smoothstep(p.x,hind?-.37:.73,hind?-.23:.87))*THREE.MathUtils.smoothstep(p.z,.02,.10),target=1-THREE.MathUtils.smoothstep(p.y,.95,1.45),old=vertex.w[upper]??0,next=THREE.MathUtils.lerp(old,mass*target,blend),remaining=mass-next,oldBody=mass-old;
    vertex.w[upper]=next;for(const bone of [chest,body,rib])vertex.w[bone]=oldBody>1e-8?(vertex.w[bone]??0)*remaining/oldBody:bone===chest?remaining:0;
  }
  // Local refinement supplies smooth silhouette constraints, orbital relief
  // and nasal cartilage without subdividing the thin distal limbs. Shared
  // Catmull-Clark edge points and transition fans retain a manifold surface.
  for(const region of ['body-shape','head','nostril','nostril-detail']){
    const oldFaces=cage.faces,headPivot=morph.head(base.headPivot),nareCenter=morph.head(base.nostril),marked=oldFaces.map(f=>{
      const center=new THREE.Vector3();for(const i of f)center.add(cage.vertices[i].p);center.divideScalar(f.length);
      if(region==='body-shape'){const {x,y}=bodyCoordinates(center);return x<1.08&&y>.93&&y<1.84;}
      const radius=region==='nostril'?.075:.045;
      return region==='head'?center.x>headPivot.x-.09*S&&center.y>headPivot.y-.65*S:((center.x-nareCenter.x)/(radius*H))**2+((center.y-nareCenter.y)/(radius*H))**2<1;
    }),edges=new Map(),edgeFaces=new Map(),vertexFaces=Array.from({length:cage.vertices.length},()=>[]),vertexNeighbours=Array.from({length:cage.vertices.length},()=>new Set()),faceCenters=new Map();
    const average=ids=>{const p=new THREE.Vector3(),w={};for(const i of ids){const v=cage.vertices[i];p.add(v.p);for(const [bone,value]of Object.entries(v.w))w[bone]=(w[bone]??0)+value/ids.length;}p.divideScalar(ids.length);return cage.add(p,w);};
    const key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
    const faceCenter=i=>{if(!faceCenters.has(i))faceCenters.set(i,average(oldFaces[i]));return faceCenters.get(i);};
    oldFaces.forEach((f,i)=>f.forEach((a,j)=>{const b=f[(j+1)%f.length],k=key(a,b);if(!edgeFaces.has(k))edgeFaces.set(k,[]);edgeFaces.get(k).push(i);vertexFaces[a].push(i);vertexNeighbours[a].add(b);vertexNeighbours[b].add(a);}));
    oldFaces.forEach((f,i)=>{if(marked[i])for(let j=0;j<f.length;j++){const a=f[j],b=f[(j+1)%f.length],k=key(a,b);if(!edges.has(k))edges.set(k,average([a,b,...edgeFaces.get(k).map(faceCenter)]));}});
    const smoothPositions=vertexFaces.map((fs,i)=>{
      if(!fs.length||!fs.every(fi=>marked[fi]))return null;
      const n=vertexNeighbours[i].size,faceMean=new THREE.Vector3(),edgeMean=new THREE.Vector3(),point=cage.vertices[i].p;
      for(const fi of fs)faceMean.add(cage.vertices[faceCenter(fi)].p);faceMean.divideScalar(fs.length);
      for(const v of vertexNeighbours[i])edgeMean.add(point).add(cage.vertices[v].p);edgeMean.divideScalar(2*n);
      return point.clone().multiplyScalar((n-3)/n).addScaledVector(faceMean,1/n).addScaledVector(edgeMean,2/n);
    });
    const faces=[];
    oldFaces.forEach((f,i)=>{
      if(marked[i]){const center=faceCenter(i);for(let j=0;j<f.length;j++){const a=f[j],b=f[(j+1)%f.length],c=f[(j+f.length-1)%f.length];faces.push([a,edges.get(key(a,b)),center,edges.get(key(c,a))]);}}
      else{const expanded=[];let touched=false;for(let j=0;j<f.length;j++){const a=f[j],b=f[(j+1)%f.length];expanded.push(a);const edge=edges.get(key(a,b));if(edge!==undefined){expanded.push(edge);touched=true;}}if(touched){const center=faceCenter(i);for(let j=0;j<expanded.length;j++)faces.push([center,expanded[j],expanded[(j+1)%expanded.length]]);}else faces.push(f);}
    });smoothPositions.forEach((p,i)=>{if(p)cage.vertices[i].p.copy(p);});cage.faces=faces;
  }
  // Author the actual sagittal silhouette after smoothing. These are deliberate
  // artistic landmark constraints; they are not asserted breed measurements.
  const band=(v,a,b,c,d)=>THREE.MathUtils.smoothstep(v,a,b)*(1-THREE.MathUtils.smoothstep(v,c,d));
  const neckOrigin=morph.neck(base.neckPivot);
  for(const vertex of cage.vertices){
    const p=vertex.p;
    const nx=base.neckPivot[0]+(p.x-neckOrigin.x)/(S*P.neckLength),ny=base.neckPivot[1]+(p.y-neckOrigin.y)/(S*P.neckLength);
    p.y+=.012*S*P.neckLength*band(nx,.69,.77,.95,1.04)*(1-THREE.MathUtils.smoothstep(ny,1.40,1.62));
  }
  sculptEquineHead(cage,base,spec,morph);
  const topology=cage.topology(),geometry=cage.toGeometry(colorAt);computeEquineNormals(geometry);const mesh=new THREE.SkinnedMesh(geometry,material);
  mesh.name='Continuous_Skin';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
  mesh.userData={part:'skin',originalControlCage:base.label,controlTopology,topology,anatomicalReview:'unreviewed',construction:'Original equine anatomy cage; independent dorsal and ventral contours; sewn circumferential shoulder and pelvic patches; minimum-bending landmark surfaces; authored equine head; Catmull-Clark surface.'};
  mesh.add(rig.root);mesh.bind(rig.skeleton);mesh.normalizeSkinWeights();return{mesh,topology,controlTopology};
}

/** Corner-angle weighting makes smooth normals independent of skinny fan
 * triangles at lips and local refinement boundaries. Area weighting gives
 * alternating dark spokes on those otherwise smooth, symmetric surfaces. */
export function computeEquineNormals(geometry){
  const positions=geometry.getAttribute('position'),indices=geometry.index.array,normals=new Float32Array(positions.count*3);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3(),u=new THREE.Vector3(),v=new THREE.Vector3();
  for(let i=0;i<indices.length;i+=3){
    const ids=[indices[i],indices[i+1],indices[i+2]];a.fromBufferAttribute(positions,ids[0]);b.fromBufferAttribute(positions,ids[1]);c.fromBufferAttribute(positions,ids[2]);const points=[a,b,c];
    normal.crossVectors(u.copy(b).sub(a),v.copy(c).sub(a)).normalize();
    for(let k=0;k<3;k++){u.copy(points[(k+1)%3]).sub(points[k]).normalize();v.copy(points[(k+2)%3]).sub(points[k]).normalize();const angle=Math.acos(clamp(u.dot(v),-1,1)),j=ids[k]*3;normals[j]+=normal.x*angle;normals[j+1]+=normal.y*angle;normals[j+2]+=normal.z*angle;}
  }
  for(let i=0;i<positions.count;i++){normal.fromArray(normals,i*3).normalize().toArray(normals,i*3);}
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));return geometry;
}
