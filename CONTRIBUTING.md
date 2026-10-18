# Contributing

Keep evidence categories, body modules, and species/design profiles separate. Changes should improve a reusable capability rather than hide an example-specific defect.

## Start with evidence and a clay view

For living profiles, identify species, breed/type, life stage, sex, body condition, and reference landmarks before changing proportions. For extinct profiles, record support for each reconstructed trait. For fictional profiles, preserve the user's defining features and selected portrayal. Use only `living`, `extinct`, and `fictional` as public category values.

Read [the extension guide](skills/creature/references/extensions.md) before adding a profile or body module. Add original editable source geometry and its provenance. Do not flatten a new skeleton into the existing quadruped rig merely to make it load.

## Validate the behavior you change

Run the repository checks, rebuild affected examples, and inspect clay plus material previews from several directions. Motion changes need a complete-cycle contact/deformation review. Export changes need a fresh GLB validation and reload. Specification changes need valid, invalid, reproducibility, and follow-up-edit cases.

Record the commands, seed, versions, measured results, and remaining review items. Screenshot similarity helps catch regressions but does not prove correct anatomy. A viewport set to mobile dimensions does not measure mobile hardware performance.

Keep fixtures small and original. Avoid committing dependency folders, temporary browsers, evaluation transcripts, or large unreviewed exports. Use the skill evaluation viewer to collect review feedback when instructions or generation behavior change.

## Licenses and attribution

For every imported asset, record creator, source URL, license, changes, and redistribution permission. A paper, museum page, or photograph may be useful reference without granting permission to distribute its images or meshes. Preserve third-party notices in distributed builds.

Use the contributor's own Git identity. Preserve human co-authors and sign-offs. Do not add agent/model/tool authorship, co-author trailers, or generated-by footers to commits, pull requests, issues, or comments.

## Stable-release gate

Do not mark a showcase as approved until its category-specific evidence, clay silhouette, movement, interactions, portable export, and measured performance have all been reviewed. Describe pending checks directly. Publication notes must list demonstrated capabilities and limitations rather than the eventual roadmap as current support.
