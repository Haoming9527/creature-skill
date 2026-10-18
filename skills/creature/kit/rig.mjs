import * as THREE from 'three';
import { V } from './geometry.mjs';
import { createWalkProfile } from './gait.mjs';

const TAU=Math.PI*2;
const smooth=t=>t*t*(3-2*t);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

export function createMorph(base,spec){
  const p=spec.proportions,S=p.scale,T=p.torsoLength,W=p.torsoWidth,D=p.torsoDepth,L=p.legLength;
  const torso=a=>new THREE.Vector3(a[0]*T,base.legHeight*L+(a[1]-base.legHeight)*D,a[2]*W).multiplyScalar(S);
  const neckBase=torso(base.neckPivot),neck=a=>neckBase.clone().add(V(a).sub(V(base.neckPivot)).multiply(new THREE.Vector3(p.neckLength,p.neckLength,W)).multiplyScalar(S));
  const headBase=neck(base.headPivot),head=a=>headBase.clone().add(V(a).sub(V(base.headPivot)).multiplyScalar(p.headLength*S));
  // Scale the complete articulated chain about the fixed hoof plane. Torso
  // translation alone is insufficient: some proximal limb lies inside the body.
  const limb=(a,which)=>{const r=base.legs[which].root,mr=torso(r),rootY=.067+(r[1]-.067)*L+(r[1]-base.legHeight)*(D-1);return new THREE.Vector3(mr.x+(a[0]-r[0])*L*S,(.067+(a[1]-.067)/(r[1]-.067)*(rootY-.067))*S,mr.z+(a[2]-r[2])*L*S);};
  const tail=a=>{const root=torso(base.tailRoot);return root.add(V(a).sub(V(base.tailRoot)).multiplyScalar(p.tailLength*S));};
  return {torso,neck,head,limb,tail,scale:S,headScale:p.headLength*S};
}

export function createRig(base,spec,morph){
  const bones=[],byName={},rest=new Map();
  const add=(name,position,parent)=>{const b=new THREE.Bone();b.name=name;b.position.copy(position);if(parent){b.position.sub(rest.get(parent).world);parent.add(b);}bones.push(b);byName[name]=b;rest.set(b,{world:position.clone(),position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()});return b;};
  const root=add('Root',new THREE.Vector3());
  const body=add('Body',morph.torso([0,base.bodyY,0]),root);
  const ribs=add('Ribcage',morph.torso([0,base.bodyY,0]),body);
  const chest=add('Chest',morph.torso([.40,base.bodyY+.02,0]),body);
  const neck=add('Neck',morph.neck(base.neckPivot),chest);
  const head=add('Head',morph.head(base.headPivot),neck);
  const jaw=add('Jaw',morph.head(base.jawPivot),head);
  const ears=[1,-1].map(side=>{const p=morph.head(base.ear);p.z*=side;return add(`Ear_${side===1?'L':'R'}`,p,head);});
  const tails=base.tailPath.filter((_,i)=>[0,2,4,5].includes(i)).map((p,i)=>add(`Tail_${i}`,morph.tail(p),i?byName[`Tail_${i-1}`]:body));
  const limbs=[];
  for(const which of ['front','hind'])for(const side of [1,-1]){
    const id=`${which==='front'?'F':'H'}${side===1?'L':'R'}`,d=base.legs[which],points={};
    for(const key of ['root','joint','knee','ankle','foot']){points[key]=morph.limb(d[key],which);points[key].z*=side;}
    const upper=add(`${id}_Upper`,points.root,which==='front'?chest:body);
    const lower=add(`${id}_Lower`,points.joint,upper),cannon=add(`${id}_Cannon`,points.knee,lower),pastern=add(`${id}_Pastern`,points.ankle,cannon),hoof=add(`${id}_Hoof`,points.foot,pastern);
    const contact=add(`${id}_Contact`,new THREE.Vector3(points.foot.x+.01*morph.scale,0,points.foot.z),hoof);
    limbs.push({id,which,side,points,upper,lower,cannon,pastern,hoof,contact,phase:{HL:0,FL:.75,HR:.5,FR:.25}[id],upperLength:points.root.distanceTo(points.joint),lowerLength:points.joint.distanceTo(points.knee)});
  }
  root.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);skeleton.calculateInverses();
  const index=b=>bones.indexOf(typeof b==='string'?byName[b]:b);
  const reset=()=>{for(const b of bones){const r=rest.get(b);b.position.copy(r.position);b.quaternion.copy(r.quaternion);b.scale.copy(r.scale);}};
  return{bones,byName,rest,root,body,ribs,chest,neck,head,jaw,ears,tails,limbs,skeleton,index,reset};
}

/** Four anatomical segments share the stride rather than holding the cannon
 * vertical and asking a nearly straight elbow chain to stretch. FABRIK preserves
 * every bind length; the initial rest-plane bend chooses the anatomical branch. */
function solveLeg(leg,origin,target){
  const rest=[leg.points.root,leg.points.joint,leg.points.knee,leg.points.ankle,leg.points.foot];
  const lengths=rest.slice(1).map((p,i)=>p.distanceTo(rest[i])),total=lengths.reduce((a,b)=>a+b,0);
  const rootDelta=origin.clone().sub(rest[0]),footDelta=target.clone().sub(rest[4]);
  const points=rest.map((p,i)=>p.clone().addScaledVector(rootDelta,1-i/4).addScaledVector(footDelta,i/4));
  const distance=origin.distanceTo(target);
  if(distance>=total-1e-7){const direction=target.clone().sub(origin).normalize();points[0].copy(origin);for(let i=1;i<5;i++)points[i].copy(points[i-1]).addScaledVector(direction,lengths[i-1]);return{points,unreachable:Math.max(0,distance-total)};}
  for(let iteration=0;iteration<100;iteration++){
    points[4].copy(target);
    for(let i=3;i>=0;i--){const direction=points[i].clone().sub(points[i+1]).normalize();points[i].copy(points[i+1]).addScaledVector(direction,lengths[i]);}
    points[0].copy(origin);
    for(let i=1;i<5;i++){const direction=points[i].clone().sub(points[i-1]).normalize();points[i].copy(points[i-1]).addScaledVector(direction,lengths[i-1]);}
    if(points[4].distanceToSquared(target)<1e-14)break;
  }
  return{points,unreachable:points[4].distanceTo(target)};
}

function aim(bone,bindDirection,targetDirection){
  const world=new THREE.Quaternion().setFromUnitVectors(bindDirection.clone().normalize(),targetDirection.clone().normalize());
  const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());bone.quaternion.copy(parent.invert().multiply(world));bone.updateMatrixWorld(true);
}

export function createMotion(rig,base,spec,morph){
  const walk=createWalkProfile(spec);
  const diagnostics={time:0,pose:'idle',cyclePhase:0,virtualRootTravel:0,treadmill:true,locomotion:'in-place',rootDisplacement:[0,0,0],worldContacts:{},feet:{},maxContactError:0,maxIKResidual:0,unsupportedPose:null,motionModel:'Kinematic four-beat walk; optional world translation after local IK; no dynamics certification.'};
  function update(time=0,controls={}){
    rig.reset();const c={pose:'idle',speed:1,jaw:0,lookX:0,lookY:0,breathing:true,locomotion:'in-place',...controls};
    const t=Number.isFinite(time)?time:0,speed=clamp(Number(c.speed)||0,0,2),walking=c.pose==='walk';
    const velocity=walk.velocity*speed,frequency=velocity/walk.cycleDistance;
    const phase=((t*frequency)%1+1)%1,breath=c.breathing?Math.sin(TAU*t*spec.behavior.breathingRate):0;
    const motionPhase=walking?TAU*phase:TAU*t*spec.behavior.breathingRate;
    const breathingLift=.0028*morph.scale*breath;
    rig.body.position.y+=breathingLift+(walking?morph.scale*(-.015+.007*Math.cos(TAU*phase*2)):0);
    rig.ribs.scale.set(1,1+.0035*breath,1+.008*breath);
    const alert=c.pose==='alert'?1:0;
    rig.neck.rotation.z=.065*alert+(walking?.016:.006)*Math.sin(motionPhase);
    rig.head.rotation.y=clamp(c.lookX,-1,1)*spec.behavior.headYawLimit+(walking?.009:.012)*Math.sin(motionPhase);
    rig.head.rotation.z=clamp(c.lookY,-1,1)*spec.behavior.headPitchLimit+.035*alert;
    // Negative Z opens a +X-facing lower jaw downwards.
    rig.jaw.rotation.z=-clamp(c.jaw,0,1)*spec.behavior.jawLimit;
    rig.ears.forEach((b,i)=>{b.rotation.x=.045*Math.sin(motionPhase+i*2.2);b.rotation.z=.035*Math.sin(motionPhase+i*1.7);});
    rig.tails.forEach((b,i)=>{b.rotation.x=.04*Math.sin(motionPhase-i*.65);b.rotation.y=.035*Math.sin(motionPhase-i*.5);});
    rig.root.updateMatrixWorld(true);
    diagnostics.time=t;diagnostics.pose=c.pose;diagnostics.cyclePhase=phase;diagnostics.virtualRootTravel=walking?velocity*t:0;diagnostics.maxContactError=0;diagnostics.maxIKResidual=0;diagnostics.unsupportedPose=['idle','walk','alert'].includes(c.pose)?null:c.pose;
    for(const leg of rig.limbs){
      const localPhase=(phase+leg.phase)%1,duty=walk.duty[leg.which],stride=walk.stanceDistance(leg.which),stance=!walking||speed===0||localPhase<duty;
      let x=0,lift=0,hoofPitch=0;
      if(walking&&speed>0){
        if(stance)x=stride*(.5-localPhase/duty);
        else{
          const u=(localPhase-duty)/(1-duty),arc=Math.sin(Math.PI*u);
          x=stride*(-.5+smooth(u));lift=(base.walkClearance??.052)*morph.scale*spec.proportions.legLength*arc**1.4;
          // The hoof is level throughout stance. A smooth swing flexion lifts
          // the heel first and returns the toe for landing; both angle and
          // angular velocity vanish at the contact boundaries.
          hoofPitch=-walk.swingHoofPitch*Math.sin(TAU*u)*arc*arc;
        }
        // Center the walking envelope beneath the proximal joint. An angled
        // resting pastern must not bias the complete stride backwards and
        // consume the reach available for retraction.
        x+=leg.points.root.x-leg.points.foot.x;
      }
      const target=leg.points.foot.clone().add(new THREE.Vector3(x,lift,0));
      const origin=leg.upper.getWorldPosition(new THREE.Vector3());
      const solved=solveLeg(leg,origin,target),j=solved.points;
      aim(leg.upper,leg.points.joint.clone().sub(leg.points.root),j[1].clone().sub(j[0]));
      aim(leg.lower,leg.points.knee.clone().sub(leg.points.joint),j[2].clone().sub(j[1]));
      aim(leg.cannon,leg.points.ankle.clone().sub(leg.points.knee),j[3].clone().sub(j[2]));
      aim(leg.pastern,leg.points.foot.clone().sub(leg.points.ankle),j[4].clone().sub(j[3]));
      const parentQ=leg.hoof.parent.getWorldQuaternion(new THREE.Quaternion());
      leg.hoof.quaternion.copy(parentQ.invert().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),hoofPitch)));
      leg.hoof.updateMatrixWorld(true);
      const actual=leg.hoof.getWorldPosition(new THREE.Vector3()),contact=leg.contact.getWorldPosition(new THREE.Vector3());
      const error=actual.distanceTo(target),groundError=stance?Math.abs(contact.y):0;
      diagnostics.feet[leg.id]={phase:localPhase,stance,swing:!stance,hoofPitch,target:target.toArray(),actual:actual.toArray(),contact:contact.toArray(),ikResidual:error,groundError,virtualGroundX:contact.x+diagnostics.virtualRootTravel,stanceVelocity:walking&&speed>0?-stride*frequency/duty:0};
      diagnostics.maxContactError=Math.max(diagnostics.maxContactError,groundError);diagnostics.maxIKResidual=Math.max(diagnostics.maxIKResidual,error,solved.unreachable);
    }
    // Solve all joint targets in the creature's local treadmill coordinates,
    // then translate the actual Root. On a stationary floor this exactly cancels
    // each stance foot's rearward local velocity; it is not just a diagnostic
    // correction. Absolute time makes seeking and replay deterministic.
    const world=c.locomotion==='world',travel=world?diagnostics.virtualRootTravel:0;
    rig.root.position.x+=travel;rig.root.updateMatrixWorld(true);
    diagnostics.treadmill=!world;diagnostics.locomotion=world?'world':'in-place';diagnostics.rootDisplacement=rig.root.position.toArray();
    for(const leg of rig.limbs){
      const foot=diagnostics.feet[leg.id];foot.localTarget=[...foot.target];foot.localActual=[...foot.actual];foot.localContact=[...foot.contact];
      foot.target[0]+=travel;foot.actual=leg.hoof.getWorldPosition(new THREE.Vector3()).toArray();foot.contact=leg.contact.getWorldPosition(new THREE.Vector3()).toArray();
      foot.worldGroundX=foot.contact[0];foot.virtualGroundX=world?foot.contact[0]:foot.contact[0]+diagnostics.virtualRootTravel;
      foot.worldStanceVelocity=world?0:foot.stanceVelocity;diagnostics.worldContacts[leg.id]=[...foot.contact];
    }
    rig.skeleton.update();return diagnostics;
  }
  // A full breathing cycle, and one four-beat walking cycle sampled at 30 Hz.
  // Bone names are stable and these clips use exactly the same update function.
  function bakeClips(){
    const clips=[];
    for(const {pose,name,locomotion} of [{pose:'idle',name:'Idle',locomotion:'in-place'},{pose:'walk',name:'Walk',locomotion:'in-place'},{pose:'walk',name:'WalkRootMotion',locomotion:'world'}]){
      const duration=pose==='idle'?1/spec.behavior.breathingRate:walk.duration;
      const frames=Math.ceil(duration*30),times=[],samples=rig.bones.map(()=>({p:[],q:[],s:[]}));
      for(let i=0;i<=frames;i++){const t=i/frames*duration;times.push(t);update(t,{pose,speed:1,breathing:pose==='idle',locomotion});rig.bones.forEach((b,k)=>{samples[k].p.push(...b.position);samples[k].q.push(...b.quaternion);samples[k].s.push(...b.scale);});}
      // Close only floating-point endpoint differences; all included motions
      // share this clip period, so there is no forced last-frame pose jump.
      const tracks=[];rig.bones.forEach((b,k)=>{for(const [field,size,Class,path]of [['p',3,THREE.VectorKeyframeTrack,'position'],['q',4,THREE.QuaternionKeyframeTrack,'quaternion'],['s',3,THREE.VectorKeyframeTrack,'scale']]){const a=samples[k][field];if(!(locomotion==='world'&&b===rig.root&&field==='p'))a.splice(a.length-size,size,...a.slice(0,size));tracks.push(new Class(`${b.name}.${path}`,times,a));}});
      // WalkRootMotion advances for one cycle. A host should accumulate the
      // final Root displacement when repeating it; LoopRepeat alone resets it.
      clips.push(new THREE.AnimationClip(name,duration,tracks));
    }
    update(0,{pose:'idle'});return clips;
  }
  return{update,diagnostics,bakeClips,walk};
}
