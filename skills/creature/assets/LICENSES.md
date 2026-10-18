# Asset provenance and licenses

## Original project assets

The editable geometry definitions, procedural cow/horse shapes, materials, markings, example specifications, viewer, and animation code authored in this repository are distributed under the skill's MIT [LICENSE](../LICENSE). No third-party animal mesh, photograph, scan, HDR environment, or anatomical illustration is bundled as an original asset.

These are original authoring bases, not scans of named animals or certified anatomical reconstructions. Their visual/anatomical approval remains pending until the review record establishes it. Generated outputs inherit the applicable original-source notice; user-added assets may have additional terms.

## Runtime dependency

Three.js **0.180.0** is used under the MIT license. Its installed notice is at `node_modules/three/LICENSE`; preserve that notice when distributing a bundled viewer. The complete notice for this pinned version follows:

```text
The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

Development dependencies retain their own notices in the installed packages: esbuild, Playwright (including its browser distribution), and glTF Validator. Do not redistribute their binaries by copying a dependency cache into the skill or source archive. The lockfile records exact dependency versions for reproducibility.

## Reference material

The anatomy, breed, reconstruction, and movement links in `references/` are research citations. Copyrights remain with the respective publishers and creators. Linking a page does not grant redistribution rights to its images, charts, videos, scans, or models. No reference images are packaged as textures.

When adding an asset, record its file path, creator, source URL, license/version, permitted redistribution, and changes. Preserve license text and attribution requirements in the output. If permission is unknown, link the reference for study and create original geometry rather than copying the asset into a release.
