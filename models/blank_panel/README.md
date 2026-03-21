# Homeracker Blank Panel

![Preview](preview.png)

A parametric vanity panel for the HomeRacker system. Covers unused spaces in the rack with a clean flat panel. Sized by HomeRacker peg units with optional lock pin cutouts on all edges for mounting.

## Design

- **Panel slab** — Flat chamfered plate sized to the HomeRacker 15mm grid.
- **Lock pin cutouts** — Optional holes on all four edges spaced at BASE_UNIT intervals for secure mounting with lock pins.
- **Corner notches** — Optional cutouts at corners to fit around HomeRacker connectors.

## Parameters

### Panel

| Parameter         | Default | Description                                          |
| ----------------- | ------- | ---------------------------------------------------- |
| `width_units`     | 6       | Panel width in HomeRacker peg units (1 unit = 15mm)  |
| `height_units`    | 4       | Panel height in HomeRacker peg units (1 unit = 15mm) |
| `panel_thickness` | 2 mm    | Panel thickness                                      |

### Cutouts

| Parameter         | Default | Description                                       |
| ----------------- | ------- | ------------------------------------------------- |
| `cutouts`         | true    | Enable lock pin holes on all edges                |
| `connector_notch` | true    | Notch corners to fit around HomeRacker connectors |

## Dependencies

- [BOSL2](https://github.com/BelfrySCAD/BOSL2)
- [homeracker](https://github.com/kellerlabs/homeracker) core library (for `constants.scad` and `support.scad`)

## Printing Tips

- Print face-down for a smooth front surface.
- At 2mm thickness this is a quick print — increase `panel_thickness` if more rigidity is needed.
