# Materials and presentation

Approve the clay silhouette before material work. A textured screenshot can conceal a broken joint or incorrect head profile.

## Portable surface construction

Use portable PBR base color, roughness, metalness, and normal/detail data. Ordinary skin, hair, horn, and hoof should not become metallic to obtain attractive highlights. Separate eye and muzzle materials where their surface response differs. Check dark and light regions under neutral lighting so black markings do not erase form and white markings do not clip.

Keep markings anchored to the surface and generated from the saved seed. Changes to legs or torso should not randomly repaint the individual. For more detailed textures, record whether UVs or another stable surface mapping define the pattern. Bake custom shader effects into exportable data, or explicitly report an export limitation.

The bundled runtime maps pigment through the inverse anatomical region transforms before generating color and UVs. Skin weights blend these coordinates at sewn joints; rigid coated attachments use their parent bone's region. This keeps corresponding landmarks in the same seeded marking field when proportions or overall scale change. The resulting UVs and colors are ordinary exportable attributes. Fine coat detail uses a seamless seeded texture at restrained strength; broad ripples or coherent stripes are defects, not anatomical detail.

Body-module authors can preserve an accessory's intentionally painted vertex colors with `geometry.userData.preserveAuthoredPigment = true`. For a local lining or feature within the continuous skin, provide a temporary `pigmentOverride` attribute containing linear RGB and a blend weight. The assembly pass combines those local colors with the reference-space coat field and removes the temporary attribute before export. This prevents coat remapping from repainting an ear or nasal interior.

glTF supports meshes, materials, textures, skins, and animations in its asset format. Use features supported by the chosen exporter and reload target, rather than assuming arbitrary viewer code is portable. [Khronos glTF overview](https://www.khronos.org/gltf/) and [Three.js GLTFExporter](https://threejs.org/docs/pages/GLTFExporter.html) (accessed 2026-10-18).

## Species details

For the Holstein, use irregular black/white markings without replacing the required dairy silhouette. For the bay Thoroughbred, distinguish body color from black mane, tail, and lower legs. Keep hair geometry modest and acknowledge that dense strand fur is outside the initial implementation.

Claws, horns, feathers, scales, and plates need geometry/material rules matched to their attachment and scale; they are not interchangeable surface noise. A profile that does not implement one must enter the extension workflow.

## Viewer

Present a neutral studio floor, controlled shadows, readable silhouette, and orbit/zoom framing that fits the whole body. Preserve consistent cameras and lighting for regression previews. Use a separate close view for head/feet instead of cropping them unintentionally in the main view.

Use local runtime code, fonts/system fonts, and textures in the static build. Test an offline/no-external-request load. Keep controls readable on narrow screens, keyboard accessible, and honest about the actions they support. Honor reduced motion and provide a paused inspection state.
