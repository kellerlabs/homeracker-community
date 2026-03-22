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
// Notch top-left corner to fit around HomeRacker connectors
notch_top_left = true;
// Notch top-right corner
notch_top_right = true;
// Notch bottom-left corner
notch_bottom_left = true;
// Notch bottom-right corner
notch_bottom_right = true;

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

    // Remove corners where either adjacent tab is disabled
    // Top-left corner
    if(!pins_top || !pins_left)
      translate([-_full_w/2 + BASE_UNIT/2, 0, _full_h/2 - BASE_UNIT/2])
        cuboid([BASE_UNIT + EPSILON, _cut_d, BASE_UNIT + EPSILON]);

    // Top-right corner
    if(!pins_top || !pins_right)
      translate([_full_w/2 - BASE_UNIT/2, 0, _full_h/2 - BASE_UNIT/2])
        cuboid([BASE_UNIT + EPSILON, _cut_d, BASE_UNIT + EPSILON]);

    // Bottom-left corner
    if(!pins_bottom || !pins_left)
      translate([-_full_w/2 + BASE_UNIT/2, 0, -_full_h/2 + BASE_UNIT/2])
        cuboid([BASE_UNIT + EPSILON, _cut_d, BASE_UNIT + EPSILON]);

    // Bottom-right corner
    if(!pins_bottom || !pins_right)
      translate([_full_w/2 - BASE_UNIT/2, 0, -_full_h/2 + BASE_UNIT/2])
        cuboid([BASE_UNIT + EPSILON, _cut_d, BASE_UNIT + EPSILON]);

    // Remove full edge strips where tabs are disabled
    if(!pins_top)
      translate([0, 0, _full_h/2 - BASE_UNIT/2])
        cuboid([_core_w + EPSILON, _cut_d, BASE_UNIT + EPSILON]);

    if(!pins_bottom)
      translate([0, 0, -_full_h/2 + BASE_UNIT/2])
        cuboid([_core_w + EPSILON, _cut_d, BASE_UNIT + EPSILON]);

    if(!pins_left)
      translate([-_full_w/2 + BASE_UNIT/2, 0, 0])
        cuboid([BASE_UNIT + EPSILON, _cut_d, _core_h + EPSILON]);

    if(!pins_right)
      translate([_full_w/2 - BASE_UNIT/2, 0, 0])
        cuboid([BASE_UNIT + EPSILON, _cut_d, _core_h + EPSILON]);

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
    // Only applied where both adjacent tabs exist
    _notch_size = [BASE_UNIT + 3, _cut_d, BASE_UNIT + 3];

    if(notch_top_left && pins_top && pins_left)
      translate([-_full_w/2 + BASE_UNIT/2, 0, _full_h/2 - BASE_UNIT/2])
        cuboid(_notch_size, chamfer=_cham);

    if(notch_top_right && pins_top && pins_right)
      translate([_full_w/2 - BASE_UNIT/2, 0, _full_h/2 - BASE_UNIT/2])
        cuboid(_notch_size, chamfer=_cham);

    if(notch_bottom_left && pins_bottom && pins_left)
      translate([-_full_w/2 + BASE_UNIT/2, 0, -_full_h/2 + BASE_UNIT/2])
        cuboid(_notch_size, chamfer=_cham);

    if(notch_bottom_right && pins_bottom && pins_right)
      translate([_full_w/2 - BASE_UNIT/2, 0, -_full_h/2 + BASE_UNIT/2])
        cuboid(_notch_size, chamfer=_cham);
  }
}

blank_panel();
