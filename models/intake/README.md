# Intake model

The first of the two water treatment models. It runs from the water source to the point where raw water is delivered to the treatment plant.

Stages (see `docs/wtp/COVERAGE.md` for every type):

1. `impounding-reservoir`: storage dams, weirs, spillways, outlet works, reservoir quality management
2. `intake-structure`: surface water, groundwater, seawater and rainwater intakes
3. `screening`: trash racks, bar screens, travelling and drum screens, microstrainers
4. `raw-water-conveyance`: raw water pumps, conveyance, surge protection

The treatment plant model (`models/treatment-plant/`) starts where this one ends.
