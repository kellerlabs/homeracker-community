# Patch Panel

![Preview](preview.png)

A parametric keystone patch panel for the HomeRacker system. Holds standard keystone jacks in a configurable grid with optional lock pin ears on each edge for mounting to HomeRacker frames.

## Design

- **Faceplate** — Front slab with cutouts sized for standard keystone jack faceplates.
- **Keystone pockets** — Walled channels behind each opening with a clip retention plate to hold keystones in place.
- **Ears** — Optional extensions on each edge with lock pin holes on a 15mm grid for HomeRacker mounting.
- **Corner notches** — Optional cutouts at corners to fit around HomeRacker connectors.

Panel dimensions automatically snap to the 15mm BASE_UNIT grid for clean alignment with the HomeRacker system.

## Parameters

### Grid

| Parameter             | Default | Description                                             |
| --------------------- | ------- | ------------------------------------------------------- |
| `columns`             | 6       | Number of keystone columns                              |
| `rows`                | 2       | Number of keystone rows                                 |
| `col_pitch`           | 25 mm   | Horizontal spacing between keystones (center-to-center) |
| `row_pitch`           | 30 mm   | Vertical spacing between keystones (center-to-center)   |
| `faceplate_thickness` | 2 mm    | Faceplate thickness                                     |

### Ears

| Parameter                      | Default | Description                                       |
| ------------------------------ | ------- | ------------------------------------------------- |
| `margin_left/right/top/bottom` | 0 mm    | Extra margin on each side                         |
| `connector_notch`              | true    | Notch corners to fit around HomeRacker connectors |
| `center_keystones`             | false   | Center keystone grid within the full panel        |
| `pins_top/bottom/left/right`   | true    | Enable lock pin holes on each edge                |

### Hidden (advanced)

Keystone opening dimensions, clip plate geometry, and pocket wall thickness are configurable in the Hidden section for non-standard keystone jacks.

## Dependencies

- [BOSL2](https://github.com/BelfrySCAD/BOSL2)
- [homeracker](https://github.com/kellerlabs/homeracker) core library (for `constants.scad` and `support.scad`)

## Printing Tips

- Print face-down for a smooth front surface.
- Test fit with a single keystone jack before printing a full panel, adjusting `keystone_faceplate_width` if needed.
