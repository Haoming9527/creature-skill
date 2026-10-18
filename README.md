# Creature

Describe a creature. Get a living 3D model you can explore, interact with, and make your own.

Creature is an [Agent Skill](https://agentskills.io/specification) for building editable, animated browser creatures. Its specification connects anatomy, geometry, rigging, materials, and behavior, so a proportion change updates more than the silhouette.

**First-release candidates:** an adult polled Holstein dairy cow and an adult bay Thoroughbred gelding. The pipeline and examples are under review; anatomical realism, visual quality, and physical-device mobile performance require recorded review before a stable release. This repository does not claim that any creature description can already be generated faithfully.

## Install

After the skill is available in the public repository:

```sh
npx skills add Haoming9527/creature-skill --skill creature
```

For a local checkout:

```sh
npx skills add . --skill creature
```

Skills are distributed from GitHub repositories. Installation through the CLI supplies the usage signal for the [skills.sh directory](https://www.skills.sh/docs/faq); preparing the package alone does not publish or rank it.

## Try the pipeline

Use Node.js 22 or later. From this repository:

```sh
cd skills/creature
npm ci
npx playwright install chromium
node scripts/build.mjs examples/horse.json --out out/horse
node scripts/serve.mjs out/horse --port 4173
```

To build all deliverables and run browser/export checks together, use `node scripts/deliver.mjs examples/horse.json --out out/horse`. Its report keeps visual/anatomical approval pending even when every software check passes.

Open the local address printed by the server. The static build carries its runtime and assets locally; after dependency installation, it does not require a paid model service or a CDN. Serve it over HTTP rather than double-clicking its HTML file.

```sh
node scripts/render.mjs out/horse --out out/horse/previews
node scripts/export.mjs out/horse --out out/horse/creature.glb
node scripts/validate.mjs examples/horse.json --model --out out/horse/validation.json
node scripts/edit.mjs examples/horse.json out/horse-longer-legs.json --set proportions.legLength=1.05
```

Rebuild the edited specification to update geometry, joint positions, skinning, attachments, and walking reach. The edit command preserves its input. Accepted parameter limits are authoring limits, not a substitute for evidence that an individual animal's proportions are realistic.

## What you get

- A studio viewer with orbit/zoom, material and clay views, idle/walk controls, speed, head direction, jaw motion, and attached body labels.
- A reproducible creature specification and editable source, with category-specific reference and interpretation notes.
- A GLB containing portable materials, skinning, and baked motion clips; interactive controls remain in the viewer.
- Preview images and validation results, with visual review recorded separately from automated checks.

The generation workflow lives in [SKILL.md](skills/creature/SKILL.md). Runtime setup and development checks are described in [DEVELOPMENT.md](DEVELOPMENT.md). See [implementation and release review](REVIEW.md) for measured results and the remaining release blockers.

## Three categories, different standards

| Category | Standard |
| --- | --- |
| **Living** | Match the selected species, breed/type, age, sex, body condition, feet, proportions, and supported gait against credible references. |
| **Extinct** | Separate preserved evidence, comparative inference, disputed interpretation, and artistic choices for each relevant trait. |
| **Fictional** | Match the brief and chosen portrayal, with coherent construction and movement. References to a story establish portrayal, not biological existence. |

These categories describe how to judge a creature. Body modules describe how to build it. A category does not imply that every body type is implemented: the initial runtime has cow and horse profiles within an ungulate quadruped module. New skeletons, wings, detailed fur/feathers, other gaits, video recording, and internal anatomy need separate development and review.

## Quality and contributions

Review plain clay views before materials. Inspect entire motion cycles, grounded feet, joint bends, label attachment, exports, and missing assets. A running demo is not automatically a reviewed showcase. See [review criteria](skills/creature/references/quality.md), [evaluation workflow](skills/creature/references/evaluation.md), and [CONTRIBUTING.md](CONTRIBUTING.md).

The original code, documentation, and procedural source assets use the [MIT license](LICENSE). Third-party dependency licenses and reference-image restrictions are documented in [asset licenses](skills/creature/assets/LICENSES.md). Reference photos and anatomical illustrations are linked for study, not redistributed as textures or model assets.
