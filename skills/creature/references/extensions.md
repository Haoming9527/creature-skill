# Adding a body type or profile

The first runtime implements ungulate quadrupeds with distinct Holstein and Thoroughbred profiles. Categories do not expand that implementation automatically.

## Decide the level of change

- Reuse a profile only when the request stays within its identity, implemented features, and reviewed parameter space.
- Add a profile when the same body/rig conventions remain suitable but species-specific shape, feet, materials, or behavior require different rules.
- Add a body module when topology, limb arrangement, articulation, attachment structure, or locomotion differ materially. A bird, cephalopod, or six-limbed creature needs its own design.

Do not silently substitute an existing animal for an unsupported one. Explain the missing capability and produce a specification/research draft or undertake the extension within the user's authorized scope. Keep it unvalidated until its checks pass.

## Extension workflow

1. Establish category, sources or brief, dimensions/landmarks, motions, and acceptance views.
2. Author original editable geometry with connected deforming surfaces and deliberate topology at joints. Use Blender sculpting/remeshing/baking when helpful; preserve source files and document the repeatable export step.
3. Build the rig, bind weights, attachment conventions, and corrective behavior for that topology. Do not imply rig bones are an anatomical skeleton.
4. Add materials and features only after clay shape review. Record provenance and licenses for every imported item.
5. Implement supported movements and control ranges. Add contact/reach/deformation checks and portable baked clips.
6. Add specification validation, meaningful edited variants, multi-angle previews, independent GLB reload, and hardware measurements.
7. Update capability documentation only after review, identifying experimental profiles separately from approved showcases.

Keep the installed baseline independent of Blender and paid generation services. If an optional adapter is later added, disclose dependencies and input transfer, record returned asset licenses, and run the same topology/rig/export checks. Do not treat a generated mesh as automatically editable or anatomically correct.

## Internal exploration is separate

Transparent skin does not create organs. Internal bones, muscles, and organs need aligned geometry, attachment/deformation rules, source provenance, and uncertainty labels. Start with hide/isolate/highlight. Moving cutaways require additional geometry and visibility review and are not part of v1.
