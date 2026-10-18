# Holstein cow reference dossier

Target: **living adult Holstein female**, dairy type, naturally polled, black-and-white coat, moderate body condition **3/5 dairy scale**, represented in mid-lactation. This describes the initial individual, not all Holsteins. Polled means naturally hornless; do not call every hornless cow polled without the selected profile's evidence.

## Sources and coverage

| Source ID | Reference | What it supports |
| --- | --- | --- |
| `holstein-breed` | [Holstein Association USA: Holstein 101](https://www.holsteinusa.com/holstein_breed/holstein101.html?tab=7) | Breed identity, characteristic markings, breed/type reference views, and distinction between polled and horned cattle. |
| `dairy-condition` | [Penn State: Body Condition Scoring as a Tool for Dairy Herd Management](https://extension.psu.edu/body-condition-scoring-as-a-tool-for-dairy-herd-management) | Five-point dairy scoring scale and loin/rump landmarks; score 3 is a moderate reference choice. |
| `hoof-anatomy` | [Purdue: Hoof Anatomy, Care and Management in Livestock](https://extension.purdue.edu/extmedia/ID/ID-321-W.pdf) | Cattle's paired principal digits and hoof structure. |
| `bovine-foot-cast` | [UW–Madison Veterinary Medicine: Bovine Foot Model](https://gundersonlab.vetmed.wisc.edu/bovine-foot-models/) | Specimen-cast front and profile views, including the rounded caudal dewclaws and hoof/pastern transition. Casts include a standing Jersey cow and a dissected bull calf; use for shared bovine foot structure, not Holstein-specific measurements. |
| `gait-glossary` | [University of Minnesota: Gait glossary](https://vanat.ahc.umn.edu/gaits/glossary.html) | Walk terminology and footfall framework; add direct cow footage for species-specific movement review. |
| `dairy-walk-kinematics` | [Tijssen et al. (2021): Kinematic gait characteristics of straight line walk in clinically sound dairy cows](https://pmc.ncbi.nlm.nih.gov/articles/PMC8294546/) | Front/hind stance-fraction distinction in 17 Swedish Red/Holstein cows walking on concrete at their selected pace; context for gait interpretation, not breed limits. |
| `cattle-treadmill` | [Nuss et al. (2015): Kinetics of heifers and cows walking on an instrumented treadmill](https://pubmed.ncbi.nlm.nih.gov/25626619/) | Cow-subgroup stride, speed and cadence context; treadmill measurements do not validate this model's settings. |
| `holstein-side-photo` | [Pineland Farms Dairy: Our Cows](https://pinelandfarmsdairy.com/maine-milk/our-cows/) — [Atwood Rally side photograph](https://pinelandfarmsdairy.com/content/uploads/Pineland-Cow-Atwood-Rally-768x548.jpg) | Supplemental visual comparison of dairy silhouette, head scale, hook/loin landmarks and udder attachment. The animal is posed with a halter; this does not establish neutral head angle, a calibrated body-condition score or polled genetics. |

Accessed 2026-10-18. These references are linked for study; their photographs and diagrams are not bundled assets. Breed photographs are visual references, not a calibrated multi-view scan.

The Pineland side photograph was visually inspected during development. Useful observed relationships include the nearly level topline, angular hook above the rear flank, slender neck, defined mandibular angle and high rear udder attachment between the thighs. Normalize photographic comparisons to a visible anatomical landmark such as withers height and record perspective limitations. Do not infer scientific variation ranges from a single photograph.

## Required visible features

- Dairy silhouette: deep barrel, defined shoulder/pelvis landmarks, comparatively angular upper body; avoid a uniformly round beef-cattle torso.
- Broad moist-looking muzzle, lateral eyes, appropriately oriented ears, and a hornless poll matching the selected individual.
- Paired main hoof digits with a visible cleft on every foot. The cleft must exist in geometry; a painted line is insufficient. Include appropriately placed small dewclaw forms if exposed by the chosen views.
- Female dairy anatomy: an udder with four teats, coherent attachment and scale for the selected stage. Do not attach floating spheres below the body.
- Tail with a terminal switch and irregular black/white coat pattern; pattern edges follow the surface rather than screen coordinates.

## Proportions and movement

Use profile values as authored starting dimensions, not verified measurements of a particular cow. Compare shoulder height, trunk length/depth, head scale, leg segments, udder placement, and tail root against appropriate reference views. Record units and actual landmarks for any measured value. A parameter's engineering range is not a supported breed range.

Review a four-beat walk with stable hoof contact. Keep head and jaw motion restrained and plausible for cattle. Tail and ears may move subtly without deforming the torso. Look closely for hip/shoulder collapse, splayed hoof halves, udder intersections, and unrealistically high knees.

The current baseline uses an authored 1.4 m full stride at 1.0 m/s, with front/hind stance fractions .68/.64 and about 6.7° peak absolute swing hoof pitch. The stance distinction is informed by the cited studies; the exact model settings, hoof curve, body sway and joint trajectories are original animation choices. See [Movement and rig review](movement.md) for study conditions and scaling rules. Retain `inferred` status for gait evidence and review actual moving geometry before claiming convincing locomotion.

## Approval checklist

The clay body must read as a dairy cow before adding black-and-white markings. Review front/rear foot spacing and paired hooves, side-view proportions, muzzle/eyes/ears, udder attachment, and entire motion cycles. State remaining gaps, especially missing calibrated reference dimensions or direct gait footage, before approving a showcase.
