# Evaluating the skill

Evaluate two things separately: whether a workflow works, and whether its output is good. Automated structure and export checks cannot establish realistic anatomy or a faithful reconstruction by themselves.

## Fixed cases

`evals/evals.json` contains three initial artifact cases: cow generation, horse generation, and a proportion-edit follow-up. Additional cases cover extinct trait evidence, fictional source fidelity, a conflicting living-animal edit, and an unsupported body. The latter are routing/capability tests; a correct result may explain an extension requirement without delivering an unsupported model.

For each artifact case, compare the same prompt and input files in a fresh with-skill context and a fresh without-skill context. For edits, give both the identical input specification. Do not give the baseline access to these instructions or helper implementations. Record the runtime/model and tools actually available; do not invent missing token or timing statistics.

## Iteration layout

Keep review data outside the distributable skill, in the sibling `creature-workspace/iteration-N/` directory. Use a descriptive case directory with `eval_metadata.json`, then `with_skill/` and `without_skill/`, each with `outputs/`, `grading.json`, and timing data when measured.

First record realistic prompts and expected outputs. During runs, add objective assertions that distinguish useful behavior: portable assets exist and reload, input specifications stay unchanged, proportion edits affect rig/geometry, and unsupported categories do not produce false support claims. Keep silhouette, deformation quality, and anatomical judgment as human review dimensions rather than brittle numeric scores.

## Grade and review

Use the skill-creator package's grader guidance and schema. Each `grading.json` expectation uses `text`, `passed`, and `evidence`. Retain failures; do not weaken an assertion merely to make a score pass. Aggregate with the provided benchmark script and inspect individual cases, since a mean may hide a severe failure.

Generate the review interface with the skill-creator package's `eval-viewer/generate_review.py`, using `--static` when a local server is unavailable. Supply the benchmark and, after iteration one, the previous workspace. Show the outputs to the user before declaring the skill satisfactory. Keep human feedback in the iteration record.

Revise the reusable instructions or helpers from the feedback, rerun affected cases and baselines, and retain old results for comparison. Description-trigger optimization is a later step after behavior and visual quality have been reviewed; do not substitute trigger scores for artifact quality.

## Acceptance boundaries

- Automated checks: specification validity, determinism, mesh/skin sanity, control effects, attached labels, export/reload, local-asset loading.
- Human checks: category/source fidelity, clay silhouette, species anatomy, material plausibility, motion quality, and presentation.
- Measured environments: desktop rendering plus real-device mobile measurements. Layout emulation is recorded separately.

A pending human or hardware review remains pending. Publication claims should match demonstrated cases, not the aspirational full range of creatures.
