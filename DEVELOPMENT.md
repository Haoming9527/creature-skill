# Creature Skill development

## First release

Natural-history realism. Prove an adult Holstein dairy cow and an adult bay Thoroughbred horse. Living, extinct and fictional are evidence categories, independent of body modules and species profiles. The JSON specification drives proportions, skeleton, surface details and motion. Additional body types, cinematic video and internal anatomy remain separate future capabilities.

## Implementation and acceptance

- [x] Separate connected cow/horse source shapes and multi-angle clay captures.
- [x] Skeleton, jaw, head tracking, breathing, world-space foot planting and tail movement.
- [x] Coupled proportion edits, including exact 5% articulated leg/tail length changes.
- [x] Static viewer, editable source package, animated GLB and 34 preview images per delivery, including frontal head and open-jaw checks.
- [x] Structural, interaction, export/reload and responsive-layout checks; 31 automated tests in the latest integration run.
- [x] Category guidance, reference dossiers, licenses and seven fixed evaluation prompts.
- [x] Fresh-context matched cow, horse and edit evaluations, plus four category-routing cases.
- [ ] Human feedback on the generated skill-creator review viewer and affected-case reruns.
- [ ] Refine anatomy, deformation and materials to the naturalistic showcase bar.
- [ ] Calibrate authoring dimensions and variation against measured reference landmarks.
- [ ] Demonstrate sustained 30 FPS on tested desktop and physical mobile hardware.
- [ ] Final visual/anatomy approval and public installation verification before release.

These checkboxes distinguish working infrastructure from accepted output. See [REVIEW.md](REVIEW.md) for unresolved findings. Earlier headless runs used SwiftShader. The browser helper now enables the device GPU and records its actual renderer; a short AMD Radeon run reached 60 FPS. Sustained checks use 15 seconds after warmup. Mobile layout checks do not establish physical-device performance.

## Architecture

The Machine skill provided the workflow reference: a reusable Three.js kit, research before construction, named controls, repeatable capture and visual revision. Creature uses its own source implementation and an editable specification that derives geometry, skeleton, materials, attachments and motion together. Organic deformation and species evidence require different validation from rigid machine assemblies. No machine physics, cutaways or film capability is implied.

Builds record separate specification and source hashes. Both the browser bundle and the Node model bundle are compiled from the copied source snapshot; delivery checks use that same Node bundle. Export verification also renders the parsed GLB into `creature.glb.preview.png` for independent material/skin inspection.

Category guidance controls evidence and review. `kit/spec.mjs` validates the contract; `kit/bases/ungulates.mjs` and `kit/bases/bovine.mjs` supply species landmarks. Dedicated equine and bovine body/detail modules build the continuous skin and anatomical fittings through `kit/creature.mjs`. Rig, material and studio helpers remain reusable. The viewer and export scripts consume that same model. `scripts/deliver.mjs` orchestrates the reproducible delivery, while approval fields remain pending.

`Idle` and `Walk` are looping in-place GLB clips. `WalkRootMotion` adds one cycle of forward translation; an external animation host must accumulate cycle displacement when repeating it. The browser's procedural walk already maintains continuous world travel and camera tracking.

## Checks and review

From `skills/creature`, run `npm test`, `npm run check`, and `node scripts/deliver.mjs examples/horse.json --out out/horse`. Replace the specification/output for the cow or edited horse. Rebuilding invalidates standard output reports; run delivery again before relying on them.

Use `node scripts/inspect-surface.mjs examples/horse.json --cycle --out out/horse-surface.json` to detect non-adjacent triangle crossings within the continuous skin across twelve walk phases, neutral idle, peak breathing and independent head/jaw control limits. A focused pose can be checked with `--pose walk --time 0.2`. Delivery requires the cycle check to pass. This catches folded surfaces that can still be closed manifolds. It excludes unsampled poses, coplanar overlap and intersections between separate accessories; those still need review.

For shape work, `node scripts/look.mjs out/horse --shots side,head-side,three-quarter` captures a few canvas-only views quickly, and `node scripts/silhouette.mjs examples/horse.json --reference side.png --out out/silhouette` fits the idle lateral silhouette to a light-background side photograph (uniform scale, ground anchored) and writes a red/blue overlay plus per-column dorsal/ventral extents. Keep reference photos outside the package unless their license permits redistribution. `kit/warp.mjs` applies a smooth landmark warp (`headWarp` in the base) to all rest geometry after pigment/UVs are attached; `tests/warp.test.mjs` checks it leaves the body in place and never folds.

Formative evaluation artifacts live in the ignored `eval-workspace/` directory at repository root. The generated review viewer is `eval-workspace/review/iteration-1/review.html`. Its benchmark contains only the three matched generation/edit cases; routing cases are reviewed separately. Earlier failures are retained, and objective scores do not certify naturalistic quality.

## Viewer direction

The creature is the focal point, presented as a living natural-history specimen. A large mineral-grey studio occupies the left; a quiet white field guide and controls sit on the right. A thin olive accent marks the selected state. No decorative dashboards or simulated chat generation.

Palette: mineral #e2e5e0, chalk #f9faf7, ink #25322c, moss #52684f, muted #737e75, line #d0d7ce. Typography: Georgia for specimen names, system sans-serif for readable controls. On narrow screens the controls move below the scene. Controls use native inputs, visible focus and reduced-motion defaults.

## Evidence policy

Record measured results rather than inferred passes. Geometry/animation checks are software checks, not biological certification. Visual approval remains a human judgment. Store screenshots before marking the release ready.
