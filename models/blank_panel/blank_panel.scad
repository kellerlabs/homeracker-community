include <BOSL2/std.scad>
include <homeracker/models/core/lib/constants.scad>
include <homeracker/models/core/lib/support.scad>

/* [Panel] */
// Panel width in HomeRacker peg units (1 unit = 15mm)
width_units = 6; // [1:24]
// Panel height in HomeRacker peg units (1 unit = 15mm)
height_units = 4; // [1:24]
// Panel thickness in mm
panel_thickness = 2; // [1:0.5:5]
// Chamfer panel edges
chamfer = true;
// Extra clearance around corner notches in mm
notch_clearance = 2; // [0:0.10:10]
// Extra clearance on top edge when tab is disabled in mm
edge_clearance_top = 2; // [0:0.10:10]
// Extra clearance on bottom edge when tab is disabled in mm
edge_clearance_bottom = 2; // [0:0.10:10]
// Extra clearance on left edge when tab is disabled in mm
edge_clearance_left = 2; // [0:0.10:10]
// Extra clearance on right edge when tab is disabled in mm
edge_clearance_right = 2; // [0:0.10:10]

/* [Mounting] */
// Enable lock pin mounting tab on top edge
pins_top = true;
// Enable lock pin mounting tab on bottom edge
pins_bottom = true;
// Enable lock pin mounting tab on left edge
pins_left = true;
// Enable lock pin mounting tab on right edge
pins_right = true;

/* [Corner Notches] */
// Top-left notch width in units (0 = no notch)
notch_top_left_w = 1; // [0:1:12]
// Top-left notch height in units (0 = no notch)
notch_top_left_h = 1; // [0:1:12]
// Top-right notch width in units (0 = no notch)
notch_top_right_w = 1; // [0:1:12]
// Top-right notch height in units (0 = no notch)
notch_top_right_h = 1; // [0:1:12]
// Bottom-left notch width in units (0 = no notch)
notch_bottom_left_w = 1; // [0:1:12]
// Bottom-left notch height in units (0 = no notch)
notch_bottom_left_h = 1; // [0:1:12]
// Bottom-right notch width in units (0 = no notch)
notch_bottom_right_w = 1; // [0:1:12]
// Bottom-right notch height in units (0 = no notch)
notch_bottom_right_h = 1; // [0:1:12]

/* [Hidden] */
$fn = 100;
EPSILON = 0.01;

// Core panel dimensions
_core_w = width_units * BASE_UNIT;
_core_h = height_units * BASE_UNIT;
_cham = chamfer ? min(BASE_CHAMFER, panel_thickness/2 - EPSILON) : 0;

// Full extent (core + all possible tabs)
_full_w = _core_w + 2 * BASE_UNIT;
_full_h = _core_h + 2 * BASE_UNIT;

// Oversized cutter depth
_cut_d = panel_thickness + EPSILON * 2;

module blank_panel() {
  difference() {
    // Single slab covering full extent
    color(HR_RED)
    cuboid([_full_w, panel_thickness, _full_h], chamfer=_cham);

    // Remove corners and edge strips where tabs are disabled.
    // Each strip is BASE_UNIT + per-side clearance, anchored at the panel edge.
    _st = BASE_UNIT + edge_clearance_top;
    _sb = BASE_UNIT + edge_clearance_bottom;
    _sl = BASE_UNIT + edge_clearance_left;
    _sr = BASE_UNIT + edge_clearance_right;

    // Corner removal (where either adjacent tab is disabled)
    if(!pins_top || !pins_left)
      translate([-_full_w/2 + _sl/2, 0, _full_h/2 - _st/2])
        cuboid([_sl, _cut_d, _st]);

    if(!pins_top || !pins_right)
      translate([_full_w/2 - _sr/2, 0, _full_h/2 - _st/2])
        cuboid([_sr, _cut_d, _st]);

    if(!pins_bottom || !pins_left)
      translate([-_full_w/2 + _sl/2, 0, -_full_h/2 + _sb/2])
        cuboid([_sl, _cut_d, _sb]);

    if(!pins_bottom || !pins_right)
      translate([_full_w/2 - _sr/2, 0, -_full_h/2 + _sb/2])
        cuboid([_sr, _cut_d, _sb]);

    // Edge strip removal
    if(!pins_top)
      translate([0, 0, _full_h/2 - _st/2])
        cuboid([_core_w + EPSILON, _cut_d, _st]);

    if(!pins_bottom)
      translate([0, 0, -_full_h/2 + _sb/2])
        cuboid([_core_w + EPSILON, _cut_d, _sb]);

    if(!pins_left)
      translate([-_full_w/2 + _sl/2, 0, 0])
        cuboid([_sl, _cut_d, _core_h + EPSILON]);

    if(!pins_right)
      translate([_full_w/2 - _sr/2, 0, 0])
        cuboid([_sr, _cut_d, _core_h + EPSILON]);

    // Lock pin holes on each enabled edge
    // Top/bottom span full width; left/right span full height
    if(pins_top)
      translate([0, 0, _full_h/2 - BASE_UNIT/2])
        xcopies(spacing=BASE_UNIT, n=floor(_full_w / BASE_UNIT))
          xrot(90) lock_pin_hole();

    if(pins_bottom)
      translate([0, 0, -_full_h/2 + BASE_UNIT/2])
        xcopies(spacing=BASE_UNIT, n=floor(_full_w / BASE_UNIT))
          xrot(90) lock_pin_hole();

    if(pins_left)
      translate([-_full_w/2 + BASE_UNIT/2, 0, 0])
        zcopies(spacing=BASE_UNIT, n=floor(_full_h / BASE_UNIT))
          xrot(90) lock_pin_hole();

    if(pins_right)
      translate([_full_w/2 - BASE_UNIT/2, 0, 0])
        zcopies(spacing=BASE_UNIT, n=floor(_full_h / BASE_UNIT))
          xrot(90) lock_pin_hole();

    // Corner notches for HomeRacker connectors
    // Each notch removes pin holes from the adjacent tabs (L-shaped cut along
    // the tab strips), without cutting into the core panel area.
    // W = how many holes to remove from the horizontal tab
    // H = how many holes to remove from the vertical tab
    _nc = notch_clearance;

    // Top-left notch: W cuts from top tab (needs pins_top), H cuts from left tab (needs pins_left)
    if(notch_top_left_w > 0 && pins_top)
      translate([-_full_w/2 + notch_top_left_w * BASE_UNIT/2, 0, _full_h/2 - BASE_UNIT/2])
        cuboid([notch_top_left_w * BASE_UNIT + _nc, _cut_d, BASE_UNIT + _nc]);
    if(notch_top_left_h > 0 && pins_left)
      translate([-_full_w/2 + BASE_UNIT/2, 0, _full_h/2 - notch_top_left_h * BASE_UNIT/2])
        cuboid([BASE_UNIT + _nc, _cut_d, notch_top_left_h * BASE_UNIT + _nc]);

    // Top-right notch: W cuts from top tab (needs pins_top), H cuts from right tab (needs pins_right)
    if(notch_top_right_w > 0 && pins_top)
      translate([_full_w/2 - notch_top_right_w * BASE_UNIT/2, 0, _full_h/2 - BASE_UNIT/2])
        cuboid([notch_top_right_w * BASE_UNIT + _nc, _cut_d, BASE_UNIT + _nc]);
    if(notch_top_right_h > 0 && pins_right)
      translate([_full_w/2 - BASE_UNIT/2, 0, _full_h/2 - notch_top_right_h * BASE_UNIT/2])
        cuboid([BASE_UNIT + _nc, _cut_d, notch_top_right_h * BASE_UNIT + _nc]);

    // Bottom-left notch: W cuts from bottom tab (needs pins_bottom), H cuts from left tab (needs pins_left)
    if(notch_bottom_left_w > 0 && pins_bottom)
      translate([-_full_w/2 + notch_bottom_left_w * BASE_UNIT/2, 0, -_full_h/2 + BASE_UNIT/2])
        cuboid([notch_bottom_left_w * BASE_UNIT + _nc, _cut_d, BASE_UNIT + _nc]);
    if(notch_bottom_left_h > 0 && pins_left)
      translate([-_full_w/2 + BASE_UNIT/2, 0, -_full_h/2 + notch_bottom_left_h * BASE_UNIT/2])
        cuboid([BASE_UNIT + _nc, _cut_d, notch_bottom_left_h * BASE_UNIT + _nc]);

    // Bottom-right notch: W cuts from bottom tab (needs pins_bottom), H cuts from right tab (needs pins_right)
    if(notch_bottom_right_w > 0 && pins_bottom)
      translate([_full_w/2 - notch_bottom_right_w * BASE_UNIT/2, 0, -_full_h/2 + BASE_UNIT/2])
        cuboid([notch_bottom_right_w * BASE_UNIT + _nc, _cut_d, BASE_UNIT + _nc]);
    if(notch_bottom_right_h > 0 && pins_right)
      translate([_full_w/2 - BASE_UNIT/2, 0, -_full_h/2 + notch_bottom_right_h * BASE_UNIT/2])
        cuboid([BASE_UNIT + _nc, _cut_d, notch_bottom_right_h * BASE_UNIT + _nc]);
  }
}

blank_panel();
