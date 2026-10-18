

Continue the existing implementation in `E:\01-Projects\creature-skill`. The generation and delivery pipeline works, but the cow and horse still look too simplified. The user rejected the earlier horse and wants the visual craftsmanship of the [Machine turbofan example](https://www.airsup.ai/lab/skill/turbofan), applied to naturalistic creatures. **Do not call this finished because tests pass. Do not restart from a blank scaffold.**

The immediate task is to finish the anatomy/visual refinement, verify the current integrated sources, and complete the evaluation and installation checks. No example has anatomical or visual approval. All release reports deliberately retain `releaseReady: false`. Nothing has been committed, pushed, or published during implementation.

Read these first:

1. `C:\Users\pc\.agents\skills\skill-creator\SKILL.md` — the skill explicitly requested by the user. Use its fresh-context evaluations and generated review viewer.
2. `README.md`, `DEVELOPMENT.md`, `REVIEW.md` in this repository. REVIEW contains historical findings; this handoff distinguishes newer changes from older evidence.
3. `skills/creature/SKILL.md`, `references/quality.md`, `references/movement.md`, and the two species dossiers.
4. The actual current screenshots listed below. Inspect pixels, not just report JSON.

The Machine project at `E:\01-Projects\machine-skill` and installed skill at `C:\Users\pc\.agents\skills\machine\SKILL.md` were examined as workflow references. Its useful pattern is research → reusable construction helpers → meaningful controls → screenshots → visual correction. Creature has its own implementation; organic anatomy needs more than the rigid assemblies used by Machine.

## User requirements and decisions

- Exactly three public categories: **living, extinct, fictional**. Do not introduce additional public categories for particular kinds of fictional creatures.
- Categories govern correctness/evidence; body modules govern topology and skeleton; species/design profiles govern identifying traits and variation. Keep these responsibilities separate.
- Living animals must match selected species, breed/type, age, sex and body condition against credible references. For incompatible edits, clarify whether to preserve realism or create a fictional derivative; preserve the original specification.
- Extinct animals need trait-level distinction between preserved evidence, comparative inference, disputed interpretation and artistic choices. A blanket uncertainty label is insufficient.
- Fictional creatures follow the brief and selected portrayal. Story/report references support portrayal, not biological existence.
- Current release targets: adult naturally polled female Holstein dairy cow, moderate BCS 3/5 and mid-lactation; adult bay Thoroughbred gelding, moderate BCS 5/9.
- The earlier reptile-first scope was superseded. Do not revert to Komodo/dragon examples as the first release.
- Separate original, continuous bovine/equine anatomy bases; deliberate deforming joint topology. Visible stacks of primitives do not meet the bar.
- One editable specification drives geometry, rigging, materials, attachments and movement. Same specification and seed must reproduce the asset. Proportion changes must rebuild all dependent systems.
- Installed use must work without Blender or paid 3D APIs. Blender is optional for authoring/refining original bases.
- Browser scene: orbit/zoom, attractive studio presentation, clay/material views, idle/walk, speed, bounded head/jaw movement, subtle breathing, ears/tail, attached body labels.
- Delivery: static local-asset viewer, editable source/specification, animated GLB, previews, validation report and licenses. GLB carries baked clips; browser controls remain in the application.
- Other body types, wings, detailed fur/feathers, other gaits, cinematic recording and internal anatomy are later work. Unsupported profiles enter an explicit unvalidated extension workflow.
- Target measured sustained 30 FPS on tested desktop and actual mobile hardware. Emulation establishes layout only.
- Standard self-contained package: `skills/creature/`; eventual public command `npx skills add Haoming9527/creature-skill --skill creature`.

User's Git rule: never attribute work to an AI agent/model/tool in commits, PRs, issues, comments, tags or trailers. No AI co-author or generated-by footers. Preserve the user's Git identity and human attribution. Do not publish before reviewed capability claims are accurate.

## Repository and runtime

- Root: `E:\01-Projects\creature-skill`; shell PowerShell 7.6 on Windows.
- Remote: `https://github.com/Haoming9527/creature-skill`; latest commit is `18899a6 Initial commit`.
- `git status --short` at handoff: modified README; untracked `.gitignore`, `CONTRIBUTING.md`, `DEVELOPMENT.md`, `LICENSE`, `REVIEW.md`, root `package.json`, and `skills/`. This handoff adds another untracked file. Preserve this work.
- Generated `out/`, `.cache/`, `node_modules/`, logs and `eval-workspace/` are ignored. Many important local evidence files will not travel with a plain Git clone.
- Actual package/runtime is `skills/creature/`; root npm scripts delegate there. Older root `scripts/` and `tests/` directories are not the active pipeline.
- Node 25.2.1, npm 11.6.2 and Python 3.14.2 were available; package requires Node 22+.
- Pinned dependencies: Three.js 0.180.0, esbuild 0.25.10, Playwright 1.58.2, gltf-validator 2.0.0-dev.3.10.
- Browser commands in the prior execution environment required permission to run outside its network sandbox; otherwise localhost gave `ERR_NETWORK_ACCESS_DENIED`. This was an execution restriction, not a viewer defect. Use the new environment's normal permission mechanism if needed.
- The browser helper enables the device GPU. Earlier SwiftShader-only results are historical; record the actual renderer for every performance claim.
- Old localhost preview servers may still exist on ports 4192/4194. Their tabs can show stale builds. Prefer a fresh server with a known directory and free port.

## Source map

All paths in this section are relative to `skills/creature/`.

| File or folder | Responsibility |
| --- | --- |
| `SKILL.md`, `references/` | Creation/review workflow, category rules, species dossiers, materials, movement, extensions, evaluation |
| `schemas/creature.schema.json`, `kit/spec.mjs` | Specification validation, supported capabilities, non-destructive editing, evidence rules |
| `examples/cow.json`, `horse.json`, `horse-longer-legs.json` | Canonical specifications; edited horse has 5% longer legs and tail |
| `kit/bases/ungulates.mjs` | Thoroughbred anatomical landmarks and control sections; imports bovine base |
| `kit/bases/bovine.mjs` | Holstein landmarks and control sections |
| `kit/equine-body.mjs`, `equine-head.mjs`, `equine-details.mjs` | Connected horse body/head, facial fittings, jaw, ears, hair |
| `kit/bovine-body.mjs`, `bovine-details.mjs` | Connected cow surface, face, ears, jaw, udder and fittings |
| `kit/geometry.mjs` | Cages, lofts, refinement, mesh helpers |
| `kit/creature.mjs` | Shared assembly, morph application, skin binding, material coordinates, metrics |
| `kit/rig.mjs`, `gait.mjs` | Skeleton, IK, controls, walk profiles, baked clips |
| `kit/materials.mjs`, `studio.mjs` | Portable procedural pigment/detail textures; local studio lighting/postprocessing |
| `kit/viewer.mjs`, `viewer.html`, `viewer.css` | Interactive browser application |
| `scripts/build.mjs`, `deliver.mjs` | Static/source bundles, snapshot hashes, full delivery orchestration |
| `scripts/validate.mjs`, `inspect-surface.mjs` | Structure/skin/feet/motion checks; sampled main-skin crossings |
| `scripts/render.mjs`, `export.mjs`, `check-viewer.mjs` | Previews, GLB validation/independent reload, controls and performance |
| `scripts/lib/` | Browser/server, archive and CLI helpers |
| `tests/`, `evals/evals.json` | Engineering regression tests and seven fixed skill evaluation prompts |

Original code/procedural geometry use MIT. Third-party reference photos are linked for study, not bundled as textures or redistributed assets. See `assets/LICENSES.md`.

## Latest engineering changes

These changes are in source, but **there has not been a complete fresh delivery of their final combined state**.

### Walking and body deformation

- `gait.mjs` now defines full-cycle travel: cow 1.4 m, horse 1.5 m, scaled by specification scale, leg length and stride multiplier. Earlier motion used only 0.45 m stance travel and looked like shuffling.
- Example speeds are cow 1.0 m/s and horse 1.2 m/s. Baseline durations are 1.4 s and 1.25 s.
- Cow stance fractions: front .68, hind .64; horse .65 for both. These and the stride/swing angles are authored choices informed by references, not measured breed limits.
- Foot reach is centered beneath the proximal joint rather than biased around the resting hoof offset. All limbs use one cycle frequency; front/hind duties can differ.
- Hooves pitch during swing, with zero angle and velocity at stance boundaries. Peak absolute pitch is about 6.7° cow, 8.9° horse.
- Four-beat sequence remains HL → FL → HR → FR. Actual world translation follows local IK. Stance feet remain fixed against the visible floor.
- Horse shoulder/pelvic patches were rebuilt around coherent boundaries. Horse and exact longer-leg variant passed all 19 sampled crossing poses on the revised gait, including hoof flexion.
- Cow originally developed a huge chest flap with the longer stride despite zero crossings. Its shoulder loops/weights were revised to keep central chest/sternum on torso influences. This final visual repair needs inspection; see current proof paths below.

### Head, mouth and surface detail

- Horse now has continuous orbital topology, separate forehead/cheek/nasal/mandibular shaping, recessed nostrils, a matched fixed upper palate and moving lower lip, and weighted recessed oral lining. The earlier jaw peeled beneath an intact closed muzzle.
- Horse oral lining is a fifth skinned mesh. All skins are direct children of the creature root, avoiding GLB warnings about skinned nodes under animated/skinned ancestors.
- Horse ears had almost-collapsed terminal triangles. Their tip edges were welded and 30 faces per ear removed without broad reshaping. Latest structural validation passed: 26 meshes, 5 skins, 112,071 vertices, 219,464 triangles, 37 bones, 4 principal hoof digits, 3 clips, 0 degenerate triangles. See `out/horse-integrity.json`.
- Horse hair uses an underlying volume, layered locks/fibres and portable maps. It is improved but still looks sculpted/combed in close-ups.
- Cow has revised matched lip boundaries and weighted oral lining, attached directly to the creature group. Cow surface fitting now uses a cached spatial grid rather than repeated all-triangle scans; eyelashes were batched to reduce objects.
- **Outstanding cow topology defect:** manual audit found 140 exactly zero-area faces in each `Continuous_Pinna_Cup`. The ear-tip fix was requested but interrupted. Current `bovine-details.mjs` still needs inspection/fix and fresh validation. Do not assume the cow passes the new validator.

### Materials, viewer and delivery integrity

- Pigment coordinates now map through inverse anatomical transforms, so proportion changes retain the individual’s markings at corresponding landmarks. Blended joints are approximate; a cow +5% legs probe had UV RMS difference ~0.000599, not exact per-vertex equality.
- Authored pigments are preserved through `geometry.userData.preserveAuthoredPigment` or a temporary `pigmentOverride` RGBA attribute (linear RGB plus blend amount). The override is removed after application, before export. This prevents shared remapping from repainting ear/nose interiors.
- Head close-ups fit posed head/jaw/ear bounds instead of cutting the chin behind the bottom controls.
- Clay view now preserves double-sided interior visibility using a separate clay material. This last fix has built successfully but still needs visual inspection on the cow mouth.
- Viewer records model-generation time and readiness after navigation.
- Performance checks retain raw chronological frame intervals, per-second FPS, device/OS/CPU metadata, renderer, resolution and complexity. The 30 FPS target now requires every complete one-second window in the 15-second sample to pass. This stricter protocol has **not yet been run on the latest integrated outputs**.
- Source ZIP includes exactly the current source manifest and edited example, excluding stale files retained in reused output directories. An esbuild guard now rejects imports of stale files absent from the current snapshot. A fixture confirmed stale-import rejection and a clean rebuild; see `.cache/build-snapshot-integrity/` within the skill.
- Structural validation now counts degenerate triangles and rejects faces with cross-product length squared ≤ 1e-24 in bind space, plus incomplete triangle triplets. Horse passed this new check. Full test suite has not been rerun since this addition.

## Verification: what actually passed

The latest full `npm test` run passed **31/31**, about 91 seconds. It included deterministic geometry/weights/rest bones, topology/hoof structure, exact coupled leg edits, controls/attachments, category/spec errors, four-beat timing, speed/travel, world-space planted contacts and actual hoof-shell clearance. That run predates the final mouth corner/ear-tip edits and the new degenerate-face gate. Do not describe it as a test of every final source edit.

Additional evidence:

- A 241-pose actual hoof-vertex check on cow, horse and edited horse found minimum Y above approximately -1e-7 m and IK residual below 1e-7 m.
- Horse and edited horse main skin passed 19 poses on the longer stride and swing pitch. Cow's latest shoulder authoring pass reported 19 clean poses, but final mouth/ear integration remains unchecked.
- Horse head subset: 40,646 triangles, zero crossings at jaw 0/50/100%. This is a subset check, not a complete scene intersection guarantee.
- Latest `out/horse-integrity.json` passes current structural validation with 0 degenerate triangles; ground/IK errors ~1e-7 m.
- `npm run check` last passed at a 62-file package and 113-line SKILL.md, before the newest minor changes.
- Source archive CRC and stale-file exclusion were checked; stale-import guard regression also passed.

Crossing checks cover nonadjacent, noncoplanar triangles within the continuous main skin at sampled poses. They do not establish absence of accessory intersections, coplanar overlaps, unsampled folds or bad-looking deformation. The cow chest flap is a concrete example of a severe visual defect passing collision checks.

## Outputs to inspect and their limitations

All paths below are relative to repository root.

| Path | What it contains / status |
| --- | --- |
| `skills/creature/out/horse-v10/` | Last full verified horse delivery before latest gait/head changes: 34 previews, 19 crossing poses, 0 GLB errors/warnings, independent reload; mean 49.0 FPS over 15 s on recorded AMD Radeon/D3D11. Historical snapshot only. |
| `skills/creature/out/cow-v11/` | Last full verified cow delivery before latest shoulder/mouth changes: 34 previews, 19 crossing poses, 0 GLB errors/warnings; mean 50.4 FPS, 152,840 triangles, 273 render-pass draw calls. Historical snapshot only. |
| `skills/creature/out/head-layout-proof/previews/` | Newer horse head side/front at jaw 0/.5/1, material/clay. Filenames `{material,clay}-jaw-{0,0.5,1}-{side,front}.png`. |
| `skills/creature/out/head-layout-proof/head-review.md` | Detailed mouth review and remaining defects. Its aa300f69… source hash and 219,524 triangle count predate the final 60-face ear cleanup. |
| `skills/creature/out/body-proof/` | Horse body clay side/front/rear/three-quarter and crossing reports, including longer-leg variant. Body-only proofs omit accessory eyes/ears/hooves/hair by design. |
| `skills/creature/.cache/cow-study/output/previews/` | Most recent cow shoulder/mouth proofs from interrupted work. Look at `shoulder-walk-0.35.png`, other quarter-cycle frames, `shoulder-idle-side.png`, and `{material,clay}-mouth-{side,front}-{0,0.5,1}.png`. Final inspection was interrupted. |
| `skills/creature/out/cow-gait-proof/previews/walk-0.35.png` | **Known failed** older shoulder weights: large chest pouch follows reaching forelimb. Preserve as diagnostic history; do not deliver it as the fixed cow. |
| `skills/creature/out/horse-integrity.json` | Latest horse structural result after ear fix and degenerate-triangle validator. No new GLB/performance result implied. |
| `eval-workspace/review/iteration-1/review.html` | Official skill-creator review viewer for earlier formative evaluations, not final new models. |

The old head-layout GLB (12,153,408 bytes, 4 skins, .85227 s walk) is also stale. Current horse should have 5 skins and a 1.25 s base walk. A successful earlier export does not validate the new mouth/pigment/gait state.

Suggested unused next output names were `out/horse-v11` and `out/cow-v12`. Check directories before using them. Use fresh output snapshots to preserve evidence.

## Honest visual assessment at handoff

The target has not been met. Last viewed horse close-ups still showed:

- Small button-like eyes with conspicuous rims and inadequate natural orbital integration.
- Long, leaf-like pinnae rather than convincingly shaped horse ears.
- Too-smooth facial/nasal planes and simplified muzzle character.
- An improved working mouth cavity, but no dentition/tongue and an angular lip rim at full opening.
- Combed forelock and layered, sculpted-looking mane.
- Overall smooth procedural appearance that lighting and microtexture cannot resolve.

An independent horse-head critique against primary photographs was started but interrupted before its final recommendations. Do that comparison next rather than piling on small arbitrary displacements. The prior critique advised anatomical landmarks and connected surface patches instead of decorative grooves or attached bulges.

Cow priorities are the latest shoulder deformation, matched lip opening, and remaining ear degenerates. Pelvic fins had been corrected; avoid reopening pelvis/udder proportions without new visual evidence. The chest repair should keep sternum and medial ribs on Chest/Body while upper-limb influence remains on the lateral humeral/axillary patch. Zero intersections alone does not prove this.

## Reference context already investigated

- [Darley Speaker's Corner](https://www.darleyamerica.com/stallions/our-stallions/speakers-corner): supplementary Thoroughbred conformation photos. This subject is a stallion, not evidence that the target gelding has identical proportions.
- [Pineland cows](https://pinelandfarmsdairy.com/maine-milk/our-cows/): posed Holstein photos, including Atwood Rally. They do not establish neutral head pose, polled genetics or calibrated BCS.
- [Purdue hoof anatomy](https://extension.purdue.edu/extmedia/ID/ID-321-W.pdf): paired cattle principal digits versus single horse hoof.
- [UW–Madison bovine foot casts](https://gundersonlab.vetmed.wisc.edu/bovine-foot-models/): useful external structure/dewclaw evidence; specimens include Jersey cow and calf, not exact Holstein dimensions.
- [UMN gait glossary](https://vanat.ahc.umn.edu/gaits/glossary.html): footfall/contact terminology.
- [Tijssen et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8294546/): 17 cows, mixed Swedish Red/Holstein, own pace on a concrete corridor; front/hind stance context. Not universal breed bounds.
- [Nuss et al. 2015](https://pubmed.ncbi.nlm.nih.gov/25626619/): treadmill cow/heifer context; cow means include 1.2 m/s and 1.68 m stride. Do not substitute sample means for validated profile limits.
- [Crook et al. 2010](https://beva.onlinelibrary.wiley.com/doi/abs/10.1111/j.2042-3306.2010.00222.x): six horses, treadmill walk 1.4–1.6 m/s and gradients. Accessible abstract does not establish our exact stride, duty fraction or hoof pitch.

Example source/evidence records and species/movement dossiers were updated with these distinctions. Authoring dimensions and allowed multipliers are still engineering envelopes. Calibrated landmark comparisons and reference-supported variation ranges remain unfinished.

## Evaluation and publication work remaining

- Seven fixed prompts exist: cow, horse, +5% leg/tail edit; extinct Psittacosaurus evidence; fictional guardian source fidelity; incompatible six-leg/horn living edit; unsupported barn owl.
- Earlier generation/edit evaluations used matched fresh contexts with/without skill. Four routing cases were with-skill only and excluded from the matched aggregate.
- Their objective scores were formative, not statistical superiority or visual certification. Preserve failed earlier evidence, including the initial planted-foot drift.
- `eval-workspace/prepare-review.py` stages the iteration-1 official viewer using `C:\Users\pc\.agents\skills\skill-creator\eval-viewer\generate_review.py`. Use that supplied generator for the next viewer, with previous-workspace comparison where applicable.
- After sources stabilize, rerun affected cases in fresh contexts and matched pairs, record actual available timing/token data only, grade engineering assertions separately from visual judgment, and get user feedback. Do not fabricate unavailable execution statistics.
- Old clean skills CLI installation/build checks passed on a 48-file version. The current package needs a fresh isolated install/build check. `eval-workspace/install-final-source/skills/creature` is an old snapshot.
- Public GitHub command has not been verified against current local changes because they are unpublished. No remote install success or publication should be claimed.
- Physical mobile measurement and knowledgeable human anatomy/visual review remain absent. Do not invent them.

## Recommended next sequence

1. Inspect the current horse head and cow shoulder/mouth proof images. Compare to actual references. Record a short prioritized set of concrete shape defects.
2. Fix cow ear collapsed faces, preserving normals, pigments and a valid closed ear surface. Re-run current structural validation. Inspect/fix the interrupted cow mouth and shoulder result.
3. Improve horse eye/orbit, ear form and muzzle planes enough to visibly close the realism gap. Judge matched clay/material angles. Avoid using lighting to hide shape defects.
4. Run affected integrity, deformation and edited-proportion checks. Then generate fresh complete cow, horse and edited-horse deliveries from a stable source revision. Check that new oral skins/pigment overrides export correctly.
5. Inspect the independently reloaded GLB images as well as authoring previews, full walk cycles, control limits and labels. Check clip durations against current gait settings.
6. Measure desktop performance without parallel heavy work using the stricter per-second protocol. Record actual physical mobile measurements when available; otherwise retain the explicit unresolved status.
7. Verify deterministic final GLB bytes in two fresh contexts, clean source archive/rebuild, current CLI installation, and revised skill evaluations/review viewer.
8. Update documentation to the final measured revision. Present reviewable examples to the user; publish only demonstrated and reviewed capabilities.

Do not spend another long cycle merely re-running passing tests while obvious shape defects remain. Software checks should support the visual authoring work, not replace it.

## Commands

From PowerShell:

```powershell
Set-Location 'E:\01-Projects\creature-skill\skills\creature'
npm test
npm run check

node scripts/validate.mjs examples/cow.json --model --out out/cow-integrity.json
node scripts/inspect-surface.mjs examples/cow.json --cycle --out out/cow-surface.json
node scripts/inspect-surface.mjs examples/horse-longer-legs.json --cycle --out out/edited-horse-surface.json

node scripts/deliver.mjs examples/horse.json --out out/horse-v11
node scripts/deliver.mjs examples/cow.json --out out/cow-v12
node scripts/deliver.mjs examples/horse-longer-legs.json --out out/horse-edited-final

node scripts/serve.mjs out/horse-v11 --port 4173
```

Run delivery sequentially when recording performance. It builds the static viewer and Node model from a copied source snapshot, validates structure and 19 main-skin poses, captures 34 views, exports/validates/reloads GLB, exercises 14 browser checks, and writes `delivery-report.json`. It will stop on real structural/crossing failures. A successful report still leaves visual/anatomy approval pending.

For a faster visual iteration, build and capture only the needed views before running full delivery:

```powershell
node scripts/build.mjs examples/horse.json --out out/horse-visual-next
node scripts/render.mjs out/horse-visual-next
```

The viewer exposes `window.creatureStudio` for browser automation: `setControl`, `setView`, `focusPart`, `step`, `metrics`, and the model. Read `kit/viewer.mjs` for the actual interface before scripting new captures.

## Handoff boundary

Implementation was interrupted at the user's request to transfer work. Head topology cleanup is saved. Cow ear cleanup and independent horse critique were unfinished. Source/archive/clay/validator changes described above are saved. There is no pending permission decision or approved publication. Existing background preview processes may still be running; do not assume their outputs represent the latest sources.
