/** Authored level-ground walking profiles, informed by the cited gait studies.
 * Distances are a modeling choice for these original bases, not breed norms.
 * Keep a full stride (one footfall to the next of the same foot) distinct from
 * the distance traveled during stance. See references/movement.md. */
const PROFILES = {
  holstein: { cycleDistance: 1.4, duty: { front: .68, hind: .64 }, swingHoofPitch: .18 },
  thoroughbred: { cycleDistance: 1.5, duty: { front: .65, hind: .65 }, swingHoofPitch: .24 }
};

export function createWalkProfile(spec) {
  const profile=PROFILES[spec.profile];
  if(!profile)throw new Error(`No walking implementation for ${spec.profile}.`);
  const scale=spec.proportions.scale;
  const cycleDistance=profile.cycleDistance*scale*spec.proportions.legLength*spec.behavior.strideScale;
  const velocity=spec.behavior.walkSpeed*scale;
  return {
    cycleDistance, velocity, duration:cycleDistance/velocity,
    duty:{...profile.duty}, swingHoofPitch:profile.swingHoofPitch,
    stanceDistance:which=>cycleDistance*profile.duty[which]
  };
}
