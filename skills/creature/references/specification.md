# Specification and follow-up edits

The saved specification is the source of truth. The shipped JSON schema and `kit/spec.mjs` define accepted fields and semantic checks; copy a bundled example rather than inventing a parallel format.

## Responsibilities

| Layer | Owns |
| --- | --- |
| Category | Evidence standard, uncertainty, portrayal fidelity, and review requirements. |
| Body module | Connected geometry, compatible joint structure, attachment conventions, and movement implementation. |
| Profile | Species/design identity, starting dimensions, distinctive features, materials, permitted authoring parameters, and defaults. |
| Specification | The user's selected instance, seed, requested proportions/features, evidence, and interpretation notes. |

Keep original measurements and authored multipliers distinguishable. Record units for physical dimensions. The normalized multiplier `1` means the profile's authored starting value; it is not a scientifically measured average. Do not map an arbitrary requested animal name to the nearest profile silently.

In v1, `supportedMovements` declares the implemented capability set and must contain both `idle` and `walk`; it does not select which animation clips to export. Zero head or jaw limits disable those viewer controls. Attachment IDs may be renamed while retaining a supported `region`; an empty list disables body labels. Mane geometry is available only on the horse base, including for fictional derivatives.

## Editing procedure

1. Read the input, requested change, category rules, and profile. Preserve the input file, seed, and unrequested identity/material choices.
2. Check whether the requested change is supported and compatible with the category. Unknown fields and out-of-range values need correction rather than silent clipping.
3. Write a separate output specification. Use `scripts/edit.mjs input.json output.json --set proportions.legLength=1.05` for supported scalar edits.
4. Rebuild the asset from that specification. This must recompute surface shape, skeletal landmarks, bind state, attachment positions, and limb reach.
5. Compare before/after matched clay views. Test affected control extremes and the entire walk. Re-export and reload the GLB.
6. Report the exact requested change, observed effect, checks run, and unresolved review items.

Changing the rendered mesh's scale while retaining the old rig or step length does not satisfy a proportion edit. A material-only edit should not unexpectedly alter identity or random markings; use the saved seed consistently.

## Realism conflicts

A request for unsupported giant limbs on a living horse is not resolved by silently switching `category`. Preserve the file and ask for a realistic variant or a fictional derivative. If the user explicitly selects the derivative, save a separate revision with the origin and intended departures recorded. A fictional derivative still needs module support and deformation checks.

When an edit changes life stage, sex, body type, or anatomy beyond a profile's capabilities, it requires a different reviewed profile or new authoring work. Do not treat these as arbitrary cosmetic strings.

## Reproducibility

Record the seed, specification, package versions, source asset revision, and build command. Repeated builds using those same inputs should reproduce geometry, rig, markings, and motion. Compare deterministic asset content; wall-clock metadata in a report need not have identical bytes. Do not label output deterministic merely because two still images look similar.
