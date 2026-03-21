# Temporary Locking Pin

![Preview](preview.png)

A snap-fit locking pin designed for the HomeRacker system. It inserts into a standard lockpin hole and holds in place with flexible barbed prongs, but can be removed by squeezing the prongs together.

## Design

The pin has three sections:

- **Handle** — A circular disc with a center hole for easy grip and removal.
- **Shaft** — A solid rectangular body sized to fit the standard lockpin hole (with tolerance).
- **Split prongs** — Two flexible prongs separated by a gap. Each prong has a ramped barb that snaps past the far edge of the hole, providing retention. Tapered tips ease insertion.

## Parameters

All parameters are customizable in the OpenSCAD customizer:

| Parameter | Default | Description |
|---|---|---|
| `handle_diameter` | 20 mm | Outer diameter of the circular handle |
| `handle_hole_diameter` | 12 mm | Diameter of the hole in the handle |
| `shaft_length` | 16 mm | Length of the shaft past the handle edge |
| `prong_length` | 12 mm | Total length of each prong |
| `prong_gap` | 1.4 mm | Gap between prongs (controls flex) |
| `barb_overhang` | 0.3 mm | Outward barb extension per side |
| `barb_ramp_length` | 3 mm | Length of the gradual insertion ramp |
| `taper_length` | 1.8 mm | Lead-in taper at prong tips |

## Dependencies

- [BOSL2](https://github.com/BelfrySCAD/BOSL2)
- [homeracker](https://github.com/kellerlabs/homeracker) core library (for `constants.scad`)

## Printing Tips

- Print with the handle flat on the bed.
- Use a material with some flex (e.g. PETG) for better prong snap action.
- Adjust `prong_gap` and `barb_overhang` to tune retention strength for your printer's tolerances.
