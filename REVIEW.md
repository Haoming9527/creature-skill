# Implementation and release review

The category-aware skill and local generation pipeline are implemented. The initial horse was rejected for inadequate resemblance and realism. A second anatomy and surface authoring pass is in progress against the Machine skill's visual standard. The cow and horse are not approved showcase assets. Publication remains pending.

## Implemented

- `skills/creature/SKILL.md` with living, extinct and fictional criteria, trait-level evidence, realism-conflict handling and unsupported-body extension guidance.
- Separate original bovine/equine topology profiles; one connected closed skin, species-specific hoof geometry, 37-joint rigs, seeded materials and coupled proportion editing.
- Static Three.js viewer, local assets, clay/material inspection, camera controls, head/jaw/speed/pause controls, attached labels and world-space walking with camera tracking.
- Animated GLB, independent reload, source archive, 34 standard preview images, structural/browser reports and a complete `scripts/deliver.mjs` command. Delivery now also checks the continuous skin for crossings at 19 sampled poses.
- Fixed generation/edit/routing evaluations and matched fresh-context runs. Results live under `eval-workspace/`, which is intentionally excluded from version control.

## Earlier baseline evidence

The following results describe the initial implementation and its retained evaluation snapshots. They do not approve the ongoing anatomy rebuild; exports and installation checks must be regenerated for the final source revision.

- 27 automated tests passed, including normalized skinning, mesh connectivity, foot structure, deterministic geometry, exact proportion changes, attachment aliases, unsupported feature/movement rejection, four-beat ordering and actual stationary-ground contact across two cycles at three speeds.
- Cow GLB: zero validator errors/warnings; independently loaded Idle, Walk and WalkRootMotion clips. Two exports in fresh browser contexts produced SHA-256 `271f3e0349979525e83ff87ba589385aa0422e9cda60507255934a07b2785777`.
- Baseline cow, horse and +5% leg/tail horse GLBs contain 37-joint skinning plus Idle, Walk and WalkRootMotion clips; independent reload and all 11 viewer checks passed for each. Each baseline delivery contains 28 preview images.
- Skill-creator format validation passed. The skills CLI discovered `creature` and installed a clean 48-file copy in an isolated project; dependency installation, resource/link checks and a build from that copy passed.

The remote GitHub installation command is prepared in README. It has not been tested against unpublished local files, and nothing has been pushed or published.

## Release-blocking findings

1. The anatomy still reads as simplified procedural models. Skull/muzzle forms, shoulder/hip transitions, muscle and body-condition landmarks, hoof detail, udder detail and hair need refinement against references. Some joint transitions pinch in motion. Software success does not resolve those defects.
2. Reference dossiers provide traceable guidance, but the authored dimensions and allowed multipliers are engineering limits. They are not measured breed variation ranges. Calibrated landmark comparison and species-specific gait footage review remain outstanding.
3. Earlier Chromium/SwiftShader measurements did not meet the sustained 30 FPS target. Enabling the actual device GPU corrected that test setup: the horse-v5 snapshot measured 41.7 mean FPS across 15 seconds, p95 frame interval 33.4 ms, at 1090×1000 on AMD Radeon/D3D11. This was an intermediate desktop run under development load. Final source measurements and physical mobile testing remain outstanding; responsive-layout emulation is not physical-device evidence.
4. Human visual and anatomical approval has not been granted. The skill-creator feedback/revision loop is awaiting review.

## Anatomy rebuild evidence

The first crossing inspection found 95 nonadjacent triangle crossings around the horse's tail root and 1,897 around the cow's limb/tail attachments in idle. Rebuilding the apertures, branch frames and collars reduced both idle counts to zero. Sampling a full walk then revealed further folds around flexing joints. Those are being repaired. Counts apply only to the continuous skin at the sampled poses; accessory intersections and coplanar overlap remain outside this check.

Neutral clay review still identifies simplified facial and body planes. New lighting, materials and finer topology cannot substitute for resolving those forms. The current work remains an unapproved development candidate.

The later `horse-v10` and `cow-v11` snapshots each pass all 19 sampled main-skin poses and export with zero GLB validator errors or warnings. Their sustained desktop measurements were 49.0 and 50.4 FPS respectively over 15 seconds after warmup on the recorded AMD Radeon/D3D11 renderer. Both contain 34 previews and an independent GLB render. Subsequent surface revisions require fresh reports. Browser checks now also exercise pointer orbit, wheel zoom and projected label attachment, for 14 checks in total.

A fresh clay critique identified three upstream surface problems: teardrop shoulder columns around otherwise improved joints, accumulated pelvic corrections producing a croup island or lateral fins, and heads with insufficiently organized cheek/orbit/nasal planes. These are being replaced by deliberate connected anatomical patches. Intermediate material trials with visible stripes or broad ripples were rejected. A separate pigment-coordinate correction now maps markings through anatomical reference space so proportion edits preserve the individual at corresponding landmarks.

## Longer stride integration

The next integration run passed all 31 automated tests. Walking now uses authored full-cycle distances of 1.4 m for the cow and 1.5 m for the horse, with separate bovine front/hind stance fractions. Both models and the longer-leg horse preserve actual world-space foot contacts. A 241-pose check also measured all hoof-shell vertices above approximately -0.0000001 m while the hoof flexes during swing. These engineering results do not establish biological gait accuracy.

The longer stride exposed a cow chest surface that stretched forward with its upper arm even though the sampled triangle-crossing check passed. The shoulder weights and boundary loops are being corrected. Both mouths also required matching upper/lower lip boundaries and recessed oral lining; moving a shell beneath a closed muzzle did not pass visual review. The horse body and longer-leg variant passed 19 poses after the new stride and hoof flexion; integrated mouth/export checks remain separate.

Browser performance reports now retain chronological frame intervals and host metadata. The 30 FPS target requires every complete one-second window in the 15-second sample to pass, rather than relying only on the overall mean. The revised final artifacts still need this measurement and physical-mobile testing.

## Export behavior

`Idle` and `Walk` loop in place. `WalkRootMotion` includes one cycle of forward translation; repeated playback must accumulate the recorded cycle displacement. Viewer controls remain in the browser app. The rig is an animation rig, not internal anatomical bones or a force simulation.

## Evaluation interpretation

The first cow comparison was formative and found a real stationary-floor sliding issue masked by virtual treadmill checks. The runtime was then corrected and independent world-space contact tests were added. Preserve those earlier failed outputs as evidence of the improvement. Objective assertion scores do not rate visual quality, and the current results are not a fixed-snapshot statistical benchmark. Timing/token totals unavailable from the execution interface are not fabricated.

Three matched generation/edit cases and four with-skill routing cases are available in `eval-workspace/review/iteration-1/review.html`, generated by skill-creator's review script. The comparison excludes the one-sided routing cases. The first cow with-skill snapshot fails contact; the horse baseline lacks reference records, live labels, multiple clay angles and an explicit hardware-review gap. Both edit configurations pass their engineering assertions, although the baseline reconstructs a simplified articulated body from the specification alone. This illustrates why an objective score cannot replace visual review.

Final audit corrections also align the visible floor with the rig's Y=0 contact plane, support renamed/empty label lists, disable zero-range controls, and reject unsupported cow manes and incomplete movement declarations. Earlier evaluation snapshots remain unchanged; current deliveries are regenerated after these corrections.

Two additional browser fixtures verify alias-only attachments and empty attachments with all head/jaw limits zero. Both passed 11 checks and confirmed the appropriate disabled controls. Their timing results were collected under concurrent load and are not controlled performance benchmarks.
