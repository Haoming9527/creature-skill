# Thoroughbred horse reference dossier

Target: **living adult Thoroughbred gelding**, bay coat, moderate body condition **5/9 equine scale**. Use an athletic adult silhouette without exaggerating thinness or muscle definition. This is an authored individual, not a model of every Thoroughbred.

## Sources and coverage

| Source ID | Reference | What it supports |
| --- | --- | --- |
| `thoroughbred-breed` | [Oklahoma State University: Thoroughbred Horses](https://breeds.okstate.edu/horses/thoroughbred-horses) | Breed identity and characteristic head, neck, withers, shoulder, and limb conformation. |
| `horse-condition` | [University of Minnesota: Caring for the overweight horse](https://extension.umn.edu/agriculture/animals-and-livestock/horse/caring-for-the-overweight-horse) | Nine-point Henneke scale and body-condition landmark areas. |
| `bay-color` | [The Jockey Club: American Stud Book, color guide](https://www.jockeyclub.com/pdfs/rule_book.pdf) | Historical 2013 color guide, PDF page 8: bay body color with black mane, tail, and lower legs except white markings. Use for coat terminology, not current registration rules. |
| `hoof-anatomy` | [Purdue: Hoof Anatomy, Care and Management in Livestock](https://extension.purdue.edu/extmedia/ID/ID-321-W.pdf) | The horse's single principal hoof and hoof construction. |
| `gait-glossary` | [University of Minnesota: Gait glossary](https://vanat.ahc.umn.edu/gaits/glossary.html) | Four-beat walking terminology; direct equine footage is needed for final movement review. |
| `equine-treadmill` | [Crook et al. (2010): The effect of treadmill speed and gradient on equine hindlimb muscle activity](https://beva.onlinelibrary.wiley.com/doi/abs/10.1111/j.2042-3306.2010.00222.x) | Six-horse treadmill study context; the abstract does not establish this model's stride length, stance fraction or hoof-pitch limits. |

Accessed 2026-10-18. Photos/diagrams remain with their publishers. Record additional reference footage and any measured values before claiming a reconstruction of a particular individual.

## Required visible features

- Horse head with an elongated muzzle, appropriate cheek/jaw profile, lateral eyes and nostrils, and independently attached ears.
- Defined withers, a long neck blended into the shoulder, thorax and pelvis with deliberate landmarks, and slender distal limbs.
- Correct limb chain: the backward-projecting hock is not the stifle. Avoid human-like elbows/knees inserted at the wrong visible landmark.
- One principal hoof per foot, with an intentional wall/sole shape and pastern transition. Do not reuse the cow's cloven hoof geometry.
- Bay coat with black mane, tail hair, and lower legs; optional white markings must be deliberate. The mane follows the crest rather than floating above the neck.

## Proportions and movement

The base was refitted on 2026-10-18 against a user-supplied lateral photograph of a standing Thoroughbred-type bay horse (study only, not bundled) using `scripts/silhouette.mjs`. Changes from that comparison, all authored interpretations rather than measurements: a short near-level back with croup and withers at similar height; girth as the lowest trunk point with the abdomen rising to the flank; a fuller throat; poll-to-muzzle shortened from about .78 m to about .63 m with the eye near one third of head length and a deeper jowl (`headWarp`); broader forearm/gaskin with caudal muscle mass; hooves converging medially; points reaching the knee and hock; a darker mahogany bay; a longer mane lying on the crest. Remaining visible gaps after that pass: a smooth, under-defined shoulder and neck–shoulder junction, a muzzle with round frontal nostrils rather than lateral comma-shaped nares, leaf-like ears, a sculpted-looking mane, and coat shading without the muscle relief seen in photographs.

Check height at the withers, body length/depth, head/neck ratio, limb segment lengths, hoof scale, shoulder slope, and pelvis. Current authoring multipliers are engineering constraints, not measured breed limits. Verify a changed individual against references before presenting it as anatomically approved.

A walking horse has four sequential contacts. Review reach, foot clearance, fore/hind coordination, and restrained head/neck motion over a full cycle. Tail movement should originate at its root; long hair must follow. Inspect fetlock/pastern bends, hock volume, and shoulder deformation at the extremes.

The baseline's 1.5 m full stride, 1.2 m/s speed, .65 front/hind stance fractions and about 8.9° peak absolute swing hoof pitch are authored settings. They are not measurements of a Thoroughbred gelding or values established by the cited treadmill abstract. The 5% longer-leg study rescales stride and cycle duration as an implementation rule; its real-world movement and anatomy remain unapproved. See [Movement and rig review](movement.md) for the source-to-setting distinction.

Jaw opening is a bounded demonstration control. Do not label a simple hinge as a simulation of complete equine chewing mechanics. Trot, canter, gallop, rearing, and jumping need their own clips, contact rules, and review.

## Approval checklist

The clay silhouette must read as a horse, with correct single hooves and leg landmarks, before mane and bay materials carry identification. Review standing and walking, all standard angles, close head/feet views, and specification edits. Record unresolved dimensions, motion evidence, or deformation issues explicitly.
