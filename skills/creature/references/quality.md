# Quality review and release evidence

Keep software results, visual judgment, biological/source fidelity, and measured device performance separate. A pass in one column never implies a pass in the others.

## Required review passes

| Pass | Examine | Evidence to retain |
| --- | --- | --- |
| Shape | Clay side/front/rear/elevated/three-quarter views; head, feet, joint and attachment details. | Images, specification/seed, camera settings, identified defects and corrections. |
| Movement | Full idle/walk cycles, control limits, contact frame, ground penetration, joint volume and intersections. | Sampled phases, drift/contact metrics, motion review notes. |
| Interaction | Orbit/zoom, clay/material, pose, speed, head, jaw, labels, responsive controls. | Interaction results, browser errors, narrow/desktop views. |
| Export | GLB structure, skin, materials, clips and independent reload. | Validator output, reload results and representative images. |
| Category | Living anatomical fidelity; extinct per-trait evidence; fictional brief/source fidelity. | Reference mapping, uncertainties, reviewer findings. |
| Performance | Frame times, startup, scene complexity, device and browser. | Raw measurements and tested environment. |

## Structural checks

Check finite vertex/normal/transform values, valid indices, nondegenerate triangles, normalized skin weights, valid joint references, and sensible bounds. Check connected body skin and appropriate attachment structure. Hoof geometry must match the profile: two principal hoof digits per cow foot; one per horse foot. Validate deterministic rebuilds and at least one meaningful proportion edit.

Do not equate metadata counts with geometry: naming eight objects "hoof" does not prove the cow has four correct paired feet. Inspect the exported geometry and images.

Run `node scripts/inspect-surface.mjs <spec.json> --cycle --out <output>/surface-checks.json`. This checks nonadjacent, noncoplanar triangle crossings within the continuous skin at neutral idle, peak breathing, independent jaw/head limits, and twelve walk phases. Review recorded positions and triangle pairs when it fails. Closed topology alone does not detect these folds. The delivery command requires this check to pass, but neither sampled poses nor this narrow intersection test certify every pose, coplanar overlaps, or separate eyes, hair, jaws and other attachments. Inspect those visually as well. Repeat the cycle check for material proportion edits.

## Visual thresholds

Release-blocking defects include visibly overlapping body primitives, cracked joints, folded/inverted skin, floating attachments, ungrounded locomotion, unstable foot contact, body penetrations, misleading controls, clipped labels, missing assets, and incorrect defining anatomy. Fix these before adding detail.

Use neutral clay views and the same cameras to compare revisions. Inspect a full cycle rather than a fortunate pose. A screenshot difference is a regression signal; unchanged images may preserve an existing defect, and changed images may represent an improvement.

Living anatomy approval needs a knowledgeable human review against the reference dossier. Extinct interpretation and fictional source fidelity also require contextual judgment. Retain `pending` or an equivalent explicit unresolved status until such review occurs. Do not fabricate a reviewer, date, or acceptance.

## Performance protocol

Target sustained 30 FPS on the configurations actually tested. Measure after warmup over a meaningful interval, including walking and camera interaction. Report frame-time percentiles, device/OS/browser, resolution and device-pixel ratio, rendering backend, triangles/draw calls, and loaded asset size when available. Software-rendered headless results must be identified as such.

The browser check records 15 seconds of walking after 30 warmup frames. It retains chronological frame intervals, average FPS, one-second measurement windows, the slowest complete window, and host/device metadata. Its `target30FPS` field requires every complete window to reach 30 FPS; a high overall average cannot hide a slower interval. Orbit and zoom are exercised separately as interaction checks.

Desktop viewport emulation can test mobile layout and touch-sized controls, but cannot establish mobile GPU performance. Keep the physical-device result unmeasured until tested on a real device. Avoid promising all-device performance from one successful run.

## Report language

Use concrete statements such as "GLB validator returned zero errors; independent reload played idle and walk" or "mobile layout checked at 390×844; physical-device performance pending." Say which checks were not run. A build that passes structural checks but fails clay review is a working draft, not an approved showcase.
