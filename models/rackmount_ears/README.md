# Rackmount Ears (HomeRacker Lock Pin Variant)

![Preview](preview.png)

Rackmount ears that use HomeRacker square holes and lock pins instead of traditional oval cage-bolt holes. Based on the [rackmount ears from the core HomeRacker repo](https://github.com/kellerlabs/homeracker/tree/main/models/rackmount_ears), but adapted to mount with HomeRacker lock pins for a tool-free, modular connection.

## Design

- **L-bracket** — Standard rackmount ear shape with a front face and side face for device attachment.
- **Lock pin flange** — Front face includes square lock pin holes on a 15mm grid for mounting directly to HomeRacker supports.
- **Two flange styles:**
  - `support` — 15×15mm beam-shaped flange that slides into HomeRacker connectors.
  - `tab` — Thin flat tab that overlaps alongside a HomeRacker support; a lock pin secures both.
- **VESA mount presets** — Built-in hole patterns for VESA 75, 100, 200, and a 75+100 combo.
- **Device bores** — Countersunk screw holes on the side face for attaching devices.

## Parameters

### Base

| Parameter       | Default | Description                                                                  |
| --------------- | ------- | ---------------------------------------------------------------------------- |
| `rack_width`    | 0       | Total inner rack width in mm. Set to 0 to auto-detect from `rack_size`.      |
| `rack_size`     | 10      | Rack size in inches (10 or 19). Only used when `rack_width` is 0.            |
| `asymmetry`     | 0       | Shift the device off-center within the rack opening.                         |
| `part`          | both    | Which ear to render: `both`, `left`, or `right`.                             |
| `device_width`  | 201 mm  | Width of the device being mounted.                                           |
| `device_height` | 40 mm   | Height of the device. Ear height snaps to the next full rack unit (44.45mm). |
| `device_depth`  | 0 mm    | Depth of the device. Set to 0 to auto-size from bore parameters.             |
| `strength`      | 3 mm    | Thickness of the ear material.                                               |

### Flange

| Parameter          | Default | Description                                                |
| ------------------ | ------- | ---------------------------------------------------------- |
| `flange_style`     | tab     | `support` (15×15mm beam) or `tab` (thin flat tab).         |
| `flange_depth`     | 1       | Flange depth in base units (each unit = 15mm).             |
| `flange_direction` | outside | `inside` (into rack) or `outside` (toward device/support). |

### VESA Mount

| Parameter     | Default | Description                                                                      |
| ------------- | ------- | -------------------------------------------------------------------------------- |
| `vesa_preset` | none    | `none`, `75`, `100`, `200`, or `75_100` (combo). Overrides device bore settings. |

### Device Bores

| Parameter                        | Default | Description                                 |
| -------------------------------- | ------- | ------------------------------------------- |
| `device_bore_distance_front`     | 9.5 mm  | Front bore offset from device front edge.   |
| `device_bore_distance_bottom`    | 9.5 mm  | Bottom bore offset from device bottom edge. |
| `device_bore_margin_horizontal`  | 25 mm   | Horizontal spacing between bores.           |
| `device_bore_margin_vertical`    | 25 mm   | Vertical spacing between bores.             |
| `device_bore_hole_diameter`      | 3.3 mm  | Bore shaft diameter.                        |
| `device_bore_hole_head_diameter` | 6 mm    | Countersink head diameter.                  |
| `device_bore_hole_head_length`   | 1.2 mm  | Countersink head length.                    |
| `device_bore_columns`            | 2       | Number of bore columns.                     |
| `device_bore_rows`               | 2       | Number of bore rows.                        |
| `center_device_bore_alignment`   | false   | Center bores vertically on the ear.         |

## Dependencies

- [BOSL2](https://github.com/BelfrySCAD/BOSL2)
- [homeracker](https://github.com/kellerlabs/homeracker) core library (for `constants.scad`)

## Printing Tips

- Export `left` and `right` parts separately for best print orientation.
