# Movement and rig review

The rig supplies controllable joints; the profile supplies species-specific rest pose, limits, proportions, and gait. The shared runtime may calculate limb reach and contacts, but it is not a full muscle or rigid-body physics simulation.

## Walking

A walk has four sequential footfalls. The University of Minnesota glossary distinguishes this from paired contacts in trot and pace; use that distinction as a basic structural check, then compare actual animal footage for timing and posture. [University of Minnesota gait glossary](https://vanat.ahc.umn.edu/gaits/glossary.html) (accessed 2026-10-18).

Test a complete cycle at low, default, and high supported speed. During stance, evaluate a hoof in the frame where it should be planted. For a moving creature that is world space; for an in-place treadmill preview, account for the implied ground velocity. A foot sliding backward over a visually stationary ground plane must not be reported as world-space planting.

Tie cycle phase and travel to the same time step and stride definition. Slowing playback should not leave the original travel speed running. Proportion changes must update limb reach and appropriate step length. Keep desired foot positions reachable; avoid solving a failed reach by snapping or stretching a limb unnoticed.

Each body profile sets the foot clearance for its supported slow, level-ground walk. Clearance scales with overall size and leg length. These animation settings are authored operating limits, not published biological measurements. Recheck skin crossings, foot contact and the actual gait after changing them; reducing clearance is not a substitute for repairing a folded joint.

### Reference context for stride and timing

Four correctly ordered contacts alone do not establish a convincing walk. Compare the complete stride distance, cadence, stance fraction, limb articulation, and body movement. A full stride runs between two successive contacts of the same foot; stance travel is only its grounded fraction.

- `dairy-walk-kinematics`: Tijssen et al. (2021) studied 17 clinically sound dairy cows (nine Swedish Red and eight Swedish Holstein) at their chosen pace on a concrete corridor. Table 2 reports median stance fractions of .68 and .69 for the front limbs and .64 for both hind limbs. Distal-limb angles and vertical body motion were also measured. These are study-sample results, not Holstein breed limits. [Primary study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8294546/).
- `cattle-treadmill`: Nuss et al. (2015) studied nine heifers and ten cows on an instrumented treadmill. The cow subgroup's reported means were 1.2 m/s, 1.68 m per stride, and 43 strides/minute. Do not merge the heifer results into those cow values or treat either group as a breed range. [Primary study abstract](https://pubmed.ncbi.nlm.nih.gov/25626619/).
- `equine-treadmill`: Crook et al. (2010) measured muscle activity and kinematics in six horses at walk speeds of 1.4–1.6 m/s on level, uphill and downhill treadmill settings. The accessible abstract supports that study context; it does not establish this model's stride length, stance fraction or hoof-pitch envelope. [Primary study abstract](https://beva.onlinelibrary.wiley.com/doi/abs/10.1111/j.2042-3306.2010.00222.x).

The authored gait profiles in `kit/gait.mjs` use 1.4 m bovine and 1.5 m equine full-stride distances at default proportions. Bovine front/hind stance fractions are .68/.64, informed by the cow studies; equine .65/.65 is an authored choice. These settings are not fitted motion captures or validated breed norms. They require anatomical and visual review with the actual surface and rig. Full-stride and stance distances scale with overall size, leg length, and the requested stride factor; forward speed scales with overall size. Front/hind stance travel may differ while all four limbs share the same cycle and forward speed. Retain numerical contact checks after any timing change.

The example specifications use 1.0 m/s for the cow and 1.2 m/s for the horse. Swing includes authored hoof-pitch excursions with approximately 6.7° bovine and 8.9° equine peak absolute angle, returning smoothly to a level hoof before contact. These values describe the current animation curve, not observed hoof rotations or joint-angle measurements from the studies. Check actual hoof-shell vertices against the floor as well as the contact marker: a marker above the ground does not prove a tilted hoof clears it. A longer-leg edit rescales the stride and cycle duration; it does not establish how a real animal with those proportions would walk.

Record contact drift and penetration in model/world units with the expected contact frame and sampling method. Small numerical error and an obvious sliding hoof are different failures; retain raw measurements and review the images.

## Skinning and secondary motion

Keep skin weights normalized, joints finite, and bind transforms coherent. Sample flexion at shoulder, elbow, carpus, hip, stifle, hock, fetlock, neck, and jaw. Check loss of volume, inverted triangles, surface pinching, and interpenetration. Eyes and hoof shells may be rigid attachments; body skin should deform continuously.

Breathing should affect the thorax subtly without moving planted feet or scaling the entire animal. Head tracking has anatomical bounds and should distribute movement deliberately across the neck/head chain. Jaw opening needs an intentional pivot and mouth separation. Simple hinge motion is not a complete chewing model.

Ear and tail motion should originate from attachments that remain stable during body movement. Follow-up proportions must move those attachment points. Keep labels attached in the appropriate bone/local frame, or recompute them from deforming surface positions when needed.

## Portable clips

Bake idle and walk over fixed intervals using the same behavior rules as the viewer. Include the relevant bone/morph tracks; do not assume the procedural JavaScript will travel inside a GLB. Confirm loop continuity and motion after independent reload. Three.js supports an animation mixer, clips, actions, and tracks for these workflows. [Three.js animation system](https://threejs.org/manual/pages/animation-system.html).

The viewer uses `locomotion: 'world'`: the actual Root moves forward and the camera follows. `Walk` is an explicitly in-place portable clip. `WalkRootMotion` adds one cycle of translation; a host repeating that clip must accumulate `metrics.locomotion.walkCycleDisplacement` each cycle instead of resetting the Root to its starting position. `Idle` loops without translation. Absolute-time updates are deterministic; changing speed at a fixed timestamp changes the sampled phase and displacement.

Do not advertise trot, gallop, flight, swimming, or internal muscle motion until those behaviors have their own implementation and contact/deformation review.
