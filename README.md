# EVLab 3D Hub

Online 3D publish page inside the EVLab website. View in browser, download (free), buy (premium).
Models are parametric + data driven: every model has DN/PN, ports, clearance and compatibility data,
so the group builder (and later software-like tools) can connect them without remodeling.

Now: build and publish 3D models (models/water-supply).
Later (folders ready, empty): models/building, models/treatment-plant, software-roadmap/*.

Rules: same DN/PN/standard in one group; PRV only in PRV chamber; engineering clearance always enforced.
Dimensions: library/standards (single source). Min sizes: library/clearance-rules.

## Publish on GitHub
1. Create a public repo, upload all files (keep `.github` folder).
2. Settings > Pages > Source: **GitHub Actions**. Push to `main`.
3. Open `https://<user>.github.io/<repo>/`.
Free models only. Do not commit premium models to a public repo.

## 3D Studio (new)
See `core/README.md`: component library + auto rebar + conflict checker (tests pass). Interface skeleton in `app/`.

## 3D Studio (build by attaching ready models)
On Windows double-click `start-studio.bat` (needs Python). Or open the site home and click **Open 3D Studio**. Or run `python -m http.server` and open `http://localhost:8000/app/index.html`. Take ready models from the library, attach them to each other, make a bigger model.
Not a drafting tool, no CAD software copied, all software text English. Drawing sheet (plan / elevations / sections, DXF + SVG) and **BOM** (bill of materials: quantities by model and size, CSV + XLSX) are in the top bar. Full guide: `docs/STUDIO.md`.
