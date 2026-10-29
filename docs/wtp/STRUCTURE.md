# Water treatment library: structure

Goal: a complete, country-independent design library for a water supply scheme, from the water source to clear water delivered at the site boundary, so that anyone can design a plant or verify an existing design with it. It is built as **two models** and a shared **design library**.

| Model | Folder | Runs from | To |
|---|---|---|---|
| Intake | `models/intake/` | water source (impounding reservoir, river, well, sea) | raw water delivered to the plant |
| Treatment plant | `models/treatment-plant/` | raw water inlet | clear water pumped to the site boundary |

The design library is in `core/library/wtp/`; the engine is in `core/engine/wtp/`. Generated tables are in this folder: `COVERAGE.md`, `CALCULATIONS.md`, `ASSESSMENTS.md`, `REFERENCES.md` (regenerate with `node tools/check-wtp.mjs --write`).

## 1. Stages and types

22 stages, each split into groups, each group into technology **types**. Every type that exists anywhere in the supplied references, plus the common ones outside them, is listed, so a missing type shows up as a gap rather than disappearing. Intake model: impounding reservoir, intake structure, screening, raw water pumping and conveyance. Treatment plant model: pre-treatment, aeration, flow measurement and rapid mixing, flocculation, clarification, filtration, oxidation and disinfection, adsorption, membrane processes, softening/ion exchange/contaminant removal, chemicals and feeding, stabilization, clear water storage, high-lift delivery, residuals, hydraulics/layout/package plants, power and control, buildings and site works.

Each type has a **status**, in this order: `listed` (name only) > `data` (definition, how it works, where it suits, where to avoid it, sources) > `calc` (its calculations implemented and tested) > `model3d` (3D page with ON/OFF groups) > `drawings` (plan, elevations, sections, export) > `tested`. `COVERAGE.md` counts types at each level per stage.

## 2. Calculations: stage calculations and assessments

Two kinds, both listed with named inputs and outputs before any code exists:

- **Stage calculations** (`calcs/<stage>.json`): the design calculations of each stage (sizing, loading, head loss, dosing and so on).
- **Assessments** (`assessments/<id>.json`): 18 cross-cutting modules, each with its own calculations: raw water physical, chemical and biological; source and hydrology; demand and capacity; process selection; hydraulic; chemical process; physical process; water treatment plant engineering; structural; geotechnical and site; electrical and energy; reliability and redundancy; operability and maintainability; safety, security and environment; cost and life cycle; design verification.

A calculation is `planned` until implemented, and may not be marked implemented without a source (reference and location).

## 3. Expert layer ("why this one")

Every type can carry **rules** (`rules/<stage>.json`) that explain the choice the way an experienced engineer would: why use it, when not to, what to check, how to build and run it. A rule has a kind, a severity, optional conditions on the user's inputs, plain text, the reason, and a source. `explain()` in `core/engine/wtp/registry.js` returns the applicable rules for a type and a set of inputs, and lists rules it could not evaluate because an input is missing. Nothing is guessed.

Honesty rules: a rule is `sourced` (reference and location), `practice-unverified`, or `owner-experience`; every rule starts `reviewed: false` until a named engineer confirms it. The Parshall flume has the first worked set (15 rules taken from the Utah report and the Arkon guide); see `PARSHALL.md`.

## 4. Standard profiles (any country)

Criteria are never hard-coded. A profile (`profiles/*.json`) holds the criteria, water quality targets, display units, drawing conventions and currency of one code or reference, and every criterion carries its source. Profiles shipped: three reference-based ones (AWWA/ASCE, TU Delft, Schulz and Okun), currently **empty on purpose** and filled one unit at a time with page references; a template for any country; a WHO profile that waits for its reference. Internal values are SI; `units.js` converts US customary (ft, in, cfs, mgd, psi, lb) exactly.

## 5. References

Seven supplied references (`references.json`). Two have no usable text layer and need OCR before their tables are used. Add a reference to `references.json` before citing it anywhere. Stage `impounding-reservoir` has no reference covering dam engineering yet.

## 6. Rules for contributors

- No numeric criterion without a source (reference and location) and a unit.
- Do not copy book text: state the rule in your own words and cite the page.
- A type moves up one status level only when the requirement of the new level is met; the validator checks the `data` level automatically.
- Type ids are unique across all stages; calculation ids are unique within their stage or assessment.
- Dam, structural and public-health outputs are preliminary. Final design needs a licensed engineer.
- Run `node core/tests/wtp.mjs` and `node tools/check-wtp.mjs` before delivering.

## 7. Planned rounds

1. Foundation and the Parshall flume to model level (delivered, see `PARSHALL.md`; submerged-flow charts and a browser check of the drawings remain open).
2. Other rapid-mix and measurement types, flocculation.
3. Clarification, all types.
4. Filtration, all types.
5. Disinfection, chemical system, stabilization.
6. Intake model: impounding reservoir, intakes, screening, raw water pumping.
7. Pre-treatment, aeration, adsorption, membranes, contaminant-specific removal.
8. Clear water storage, delivery, residuals.
9. Plant hydraulics and layout, power and control, buildings and site.
10. Assessment engines, selection logic and the verification report.

The order can change; the coverage ledger shows what remains.
