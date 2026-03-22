# Homeracker Blank Panel

![Preview](preview.png)

A parametric vanity panel for the HomeRacker system. Covers unused spaces in the rack with a clean flat panel. Sized by HomeRacker peg units with optional lock pin mounting tabs on each edge independently.

## Design

- **Panel slab** — Flat plate sized to the HomeRacker 15mm grid. The `width_units` and `height_units` define the core panel area.
- **Mounting tabs** — Each edge can independently have a lock pin mounting tab (one BASE_UNIT / 15mm wide) with square lock pin holes for secure mounting.
- **Corner notches** — Per-corner cutouts to fit around HomeRacker connectors, with chamfered inner edges.
- **Chamfer** — Optional edge chamfer on the panel and notch inner corners.

## Parameters

### Panel

| Parameter         | Default | Description                                          |
| ----------------- | ------- | ---------------------------------------------------- |
| `width_units`     | 6       | Panel width in HomeRacker peg units (1 unit = 15mm)  |
| `height_units`    | 4       | Panel height in HomeRacker peg units (1 unit = 15mm) |
| `panel_thickness` | 2 mm    | Panel thickness                                      |
| `chamfer`         | true    | Chamfer panel edges                                  |

### Mounting

| Parameter      | Default | Description                              |
| -------------- | ------- | ---------------------------------------- |
| `pins_top`     | true    | Enable lock pin mounting tab on top edge    |
| `pins_bottom`  | true    | Enable lock pin mounting tab on bottom edge |
| `pins_left`    | true    | Enable lock pin mounting tab on left edge   |
| `pins_right`   | true    | Enable lock pin mounting tab on right edge  |

Disabling pins on an edge removes the entire mounting tab (15mm strip) on that side, reducing the overall panel dimensions.

### Corner Notches

| Parameter            | Default | Description                                       |
| -------------------- | ------- | ------------------------------------------------- |
| `notch_top_left`     | true    | Notch top-left corner for HomeRacker connectors   |
| `notch_top_right`    | true    | Notch top-right corner                            |
| `notch_bottom_left`  | true    | Notch bottom-left corner                          |
| `notch_bottom_right` | true    | Notch bottom-right corner                         |

Corner notches are only applied where both adjacent mounting tabs are enabled.

## Dependencies

- [BOSL2](https://github.com/BelfrySCAD/BOSL2)
- [homeracker](https://github.com/kellerlabs/homeracker) core library (for `constants.scad` and `support.scad`)

## Printing Tips

- Print face-down for a smooth front surface.
- At 2mm thickness this is a quick print — increase `panel_thickness` if more rigidity is needed.
