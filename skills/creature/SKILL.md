---
name: creature
description: Create and edit interactive, animated 3D creatures with an editable specification, browser viewer, GLB, and preview images. Use for requests to build, model, rig, animate, inspect, or change a living animal, extinct animal, or fictional creature in 3D, including follow-up changes to proportions or behavior. Apply category-specific evidence and visual review. The bundled runtime initially provides Holstein cow and Thoroughbred horse profiles; other body types require an explicit extension workflow. Do not use for animal-care advice, standalone illustrations, or prose-only character descriptions.
license: MIT
compatibility: Node.js 22+, npm, WebGL browser, and Playwright Chromium for preview/export checks. Internet access is needed for first-time dependency installation and factual research. Built viewers use local assets. Blender is optional for source asset authoring; no paid generation API is required.
metadata:
  version: "0.1.0"
---

# Creature

Turn the user's description into an editable creature that holds together in shape, movement, and explanation. Work from one specification so later edits update the body, rig, materials, attachments, and behavior together.

## Read only the guidance needed

1. Read [category routing](references/categories.md), then the selected [living](references/living.md), [extinct](references/extinct.md), or [fictional](references/fictional.md) guide.
2. For a bundled profile, read [Holstein](references/holstein.md) or [Thoroughbred](references/thoroughbred.md), plus [movement](references/movement.md) when adding or modifying animation.
3. Read [quality review](references/quality.md) before generating previews. Read [extensions](references/extensions.md) for an unsupported body or feature.
4. Read [specification editing](references/specification.md) for follow-up changes and [materials](references/materials.md) for appearance work.

## Establish the creature contract

Extract the brief, category, identity, body type, distinguishing features, requested controls, and output location. Carry forward prior choices. Ask only for consequential ambiguity: competing portrayals, an unspecified breed that materially changes shape, or a living-animal edit that conflicts with anatomy.

Use exactly three public categories:

- **Living:** evidence for the selected animal governs anatomy and behavior.
- **Extinct:** evidence and inference are recorded trait by trait.
- **Fictional:** the brief and selected portrayal govern fidelity and extraordinary features.

Do not confuse category with body type. A horse-derived fictional creature may use parts of an ungulate module; a real bird cannot. If the requested anatomy lacks a supported module, explain the extension work and preserve the requested design. Do not substitute a cow or horse and call it a validated different species.

Current base profiles are an adult polled Holstein female and an adult bay Thoroughbred gelding, with separate source shapes and species rules within an ungulate quadruped module. Initial supported motion is idle and a bounded walk, with head, jaw, breathing, ear, and tail controls. Other gaits, internal anatomy, wings, and new skeletons are extension work. Existing examples are candidates until their review records show otherwise.

## Build from the specification

Run commands from this installed skill's directory. Use the nearest bundled example as a starting specification, copied into the user's output workspace. Read `schemas/creature.schema.json` and `kit/spec.mjs` before changing fields. Keep the seed fixed unless the user asks for a different individual or pattern.

Record identity, proportions, features, materials, supported behaviors, attachment points, references, and interpretation notes in the specification. Source URLs alone are insufficient: identify which traits a source supports. Authoring bounds prevent broken geometry; they do not establish biological ranges.

Install dependencies when absent:

```sh
npm ci
npx playwright install chromium
```

Generate and validate, replacing the example paths with the working specification:

```sh
node scripts/build.mjs examples/horse.json --out out/horse
node scripts/validate.mjs examples/horse.json --model --out out/horse/validation.json
node scripts/inspect-surface.mjs examples/horse.json --cycle --out out/horse/surface-checks.json
node scripts/serve.mjs out/horse --port 4173
```

For a complete delivery in one command, use `node scripts/deliver.mjs examples/horse.json --out out/horse`. This builds, checks geometry and sampled skin crossings, captures previews, validates and reloads the GLB, exercises viewer controls, and records frame intervals. A rebuild invalidates the previous standard reports and GLB; regenerate them for the new body.

Use the provided original procedural geometry and skeleton builders. Preserve connected skin across the body and the joints that deform. Separate eyes, hoof shells, hair, and other anatomical layers where appropriate; visible primitive intersections are not an acceptable substitute for continuous anatomy. Keep mouth openings and the moving jaw intentional.

Regenerate derived geometry, joint placement, skinning, attachments, and walking reach after proportion edits. Do not rescale only the rendered mesh. Use local portable PBR materials and deterministic texture/detail generation. The built viewer should not fetch fonts, runtime code, textures, or models from a CDN.

## Review shape before polish

Capture previews:

```sh
node scripts/render.mjs out/horse --out out/horse/previews
```

Open and inspect the actual saved images. Review side, front, rear, elevated, and three-quarter clay views. Inspect the head, feet, neck, shoulder, hip, jaw, and limb bends. Correct silhouette and anatomical construction before adding dramatic lighting or skin detail.

For living creatures, compare the profile's landmarks with credible reference views. When the user supplies or you have a side-view photograph on a light background, measure the gross shape before detailing:

```sh
node scripts/silhouette.mjs examples/horse.json --reference side.png --out out/horse/silhouette
node scripts/look.mjs out/horse --shots side,head-side,three-quarter
```

The overlay shows reference-only (red) and model-only (blue) areas and the report lists dorsal/ventral extents by column. Use it to correct back line, belly, throat, head length and limb mass in the base landmarks, then confirm in clay renders. Stance differences inflate the leg error, and agreement does not approve anatomy. Keep user photos out of the delivered package unless their license allows redistribution. Head proportions that are only reachable by moving many detail fits together belong in the base `headWarp`, a smooth landmark warp applied to all head geometry after pigment is attached. Cattle need geometrically separated paired principal hoof digits; horses need a single principal hoof on each foot. Check the selected sex, body condition, and distinguishing traits rather than a generic animal outline.

Log findings, make a reusable correction, rebuild, and inspect again. Review at least shape, motion, and presentation as distinct passes. Repeat failed passes until corrected; if the available pipeline cannot meet the bar, record the unresolved defect instead of declaring completion. Human review remains necessary for showcase approval.

## Review the living behavior

Inspect an entire walking cycle and several idle cycles. Confirm planted-foot stability, stance and swing timing, clearance, joint volume, skin deformation, and absence of body intersections. Walk speed must change time and travel consistently. Test minimum and maximum allowed control values and a materially edited specification.

Run `inspect-surface.mjs --cycle` on the working specification after shape or rig changes. It tests the continuous skin at twelve walk phases, neutral idle, peak breathing, and independent jaw/head limits. A closed manifold can still fold through itself. Fix detected crossings; this sampled check does not cover every intermediate pose, coplanar overlap, or accessory intersections, which still need visual inspection.

Keep breathing subtle, head tracking bounded, and jaw movement appropriate to the species. Verify labels follow their intended anatomical attachment while the creature moves. Animation bones are controls, not a delivered internal anatomical skeleton.

Exercise orbit, zoom, clay/material, idle/walk, speed, head, jaw, and label controls. Every displayed control should visibly affect the intended part. Inspect the responsive layout and keyboard focus. Measure performance with the device/browser/viewport recorded; mobile emulation checks layout only.

## Export and deliver

```sh
node scripts/export.mjs out/horse --out out/horse/creature.glb
```

Reload the exported GLB independently and inspect its materials, skin, and baked clips. The export script writes a validator/reload report and `creature.glb.preview.png`, rendered from the parsed file in a separate scene. Open that image as well as the authoring previews. A successful export call alone is not validation. Keep runtime-specific interactive controls in the viewer; do not imply that GLB carries the viewer UI.

Deliver the static viewer folder, edited specification, source, animated GLB, previews, and validation report. Preserve applicable licenses and source provenance; see [asset licenses](assets/LICENSES.md). Distinguish automated passes, visual findings, human review, and measurements that were not performed. Report file paths, how to open the viewer, controls, changes, and material limitations.

Do not label an output anatomically approved, physically validated, or mobile-tested without the relevant evidence. Sustained 30 FPS is a target for tested hardware, not a promise inferred from triangle count.

## Handle follow-up edits

Keep the input specification intact and write a new revision:

```sh
node scripts/edit.mjs examples/horse.json out/horse-longer-legs.json --set proportions.legLength=1.05
node scripts/build.mjs out/horse-longer-legs.json --out out/horse-longer-legs
```

Review the requested difference in matched views, then repeat affected rig, movement, attachment, and export checks. Preserve unrequested identity, seed, and appearance where possible. If an edit conflicts with a living profile, ask whether to keep a realistic version or create a fictional derivative; never silently recategorize it.

## Improve the skill

Use [evaluation guidance](references/evaluation.md) and the fixed prompts in `evals/evals.json`. Compare with-skill and without-skill runs in fresh contexts, keep objective checks separate from visual judgments, and generate the skill-creator review viewer for human feedback. Expand supported profiles only after their own evidence and deformation checks pass.
