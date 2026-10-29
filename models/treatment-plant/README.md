# Treatment plant model

The second of the two water treatment models. It runs from the raw water inlet to the clear water pump delivery at the site boundary.

The design library behind it (technology types, calculations, expert rules, assessments, standard profiles) is in `core/library/wtp/`, and the master description is `docs/wtp/STRUCTURE.md`.

Stage folders (existing folders keep their names):

- `pre-treatment`: Pre-treatment
- `aeration`: Aeration and gas transfer
- `rapid-mix`: Flow measurement and rapid mixing
- `flocculation`: Flocculation
- `clarifier`: Clarification (sedimentation and flotation)
- `filter`: Filtration
- `disinfection`: Oxidation and disinfection
- `adsorption`: Adsorption and organics control
- `membrane`: Membrane processes
- `special-removal`: Softening, ion exchange and contaminant-specific removal
- `chemical-house`: Chemicals and chemical feeding
- `stabilization`: Stabilization, corrosion control and fluoridation
- `clear-water-tank`: Clear water storage
- `delivery`: High-lift pumping and delivery main
- `residuals`: Residuals and washwater management
- `site-layout`: Plant hydraulics, layout and package plants
- `power-control`: Power, instrumentation and control
- `site-works`: Buildings and site works

Existing folders map to stages: `inlet-works` (flow distribution and inlet, stage `plant-hydraulics-layout`), `grit-chamber` (grit types of stage `pre-treatment`), `clarifier` (`clarification`), `filter` (`filtration`), `chemical-house` (`chemical-system`), `clear-water-tank` (`clear-water-storage`).
