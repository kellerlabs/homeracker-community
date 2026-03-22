include <BOSL2/std.scad>

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
TOLERANCE = 0.2;
PRINTING_LAYER_WIDTH = 0.4;
PRINTING_LAYER_HEIGHT = 0.2;
BASE_UNIT = 15;
BASE_STRENGTH = 2;
BASE_CHAMFER = 1;
LOCKPIN_HOLE_CHAMFER = 0.8;
LOCKPIN_HOLE_SIDE_LENGTH = 4;
LOCKPIN_HOLE_SIDE_LENGTH_DIMENSION = [LOCKPIN_HOLE_SIDE_LENGTH, LOCKPIN_HOLE_SIDE_LENGTH];
HR_YELLOW = "#f7b600";
HR_BLUE = "#0056b3";
HR_RED = "#c41e3a";
HR_GREEN = "#2d7a2e";
HR_CHARCOAL = "#333333";
HR_WHITE = "#f0f0f0";
STD_UNIT_HEIGHT = 44.45;
STD_UNIT_DEPTH = 482.6;
STD_WIDTH_10INCH = 254;
STD_WIDTH_19INCH = 482.6;
STD_MOUNT_SURFACE_WIDTH = 15.875;
STD_RACK_BORE_DISTANCE_Z = 15.875;
STD_RACK_BORE_DISTANCE_MARGIN_Z = 6.35;
tolerance = TOLERANCE;
printing_layer_width = PRINTING_LAYER_WIDTH;
printing_layer_height = PRINTING_LAYER_HEIGHT;
base_unit = BASE_UNIT;
base_strength = BASE_STRENGTH;
base_chamfer = BASE_CHAMFER;
lockpin_hole_chamfer = LOCKPIN_HOLE_CHAMFER;
lockpin_hole_side_length = LOCKPIN_HOLE_SIDE_LENGTH;
lockpin_hole_side_length_dimension = LOCKPIN_HOLE_SIDE_LENGTH_DIMENSION;

module support(units=3, x_holes=false) {
    support_dimensions = [BASE_UNIT, BASE_UNIT*units, BASE_UNIT];

    difference() {

        color("darkslategray")
        cuboid(support_dimensions, chamfer=BASE_CHAMFER);

        ycopies(spacing=BASE_UNIT, n=units) {

            color("red") lock_pin_hole();
        }
        if (x_holes) {
            ycopies(spacing=BASE_UNIT, n=units) {

                color("red") rotate([0,90,0]) lock_pin_hole();
            }
        }
    }
}

module lock_pin_hole() {
    lock_pin_center_side = LOCKPIN_HOLE_SIDE_LENGTH + PRINTING_LAYER_WIDTH*2;
    lock_pin_center_dimension = [lock_pin_center_side, lock_pin_center_side];

    lock_pin_outer_side = LOCKPIN_HOLE_SIDE_LENGTH + LOCKPIN_HOLE_CHAMFER*2;
    lock_pin_outer_dimension = [lock_pin_outer_side, lock_pin_outer_side];

    lock_pin_prismoid_inner_length = BASE_UNIT/2 - LOCKPIN_HOLE_CHAMFER;
    lock_pin_prismoid_outer_length = LOCKPIN_HOLE_CHAMFER;

    module hole_half() {
        union() {
            prismoid(size1=lock_pin_center_dimension, size2=LOCKPIN_HOLE_SIDE_LENGTH_DIMENSION, h=lock_pin_prismoid_inner_length);
            translate([0, 0, lock_pin_prismoid_inner_length]) {
                prismoid(size1=LOCKPIN_HOLE_SIDE_LENGTH_DIMENSION, size2=lock_pin_outer_dimension, h=lock_pin_prismoid_outer_length);
            }
        }
    }

    hole_half();

    mirror([0, 0, 1]) {
        hole_half();
    }
}
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

$fn = 100;
module blank_panel() {
  difference() {

    color(HR_RED)
    cuboid([_full_w, panel_thickness, _full_h], chamfer=_cham);



    _st = BASE_UNIT + edge_clearance_top;
    _sb = BASE_UNIT + edge_clearance_bottom;
    _sl = BASE_UNIT + edge_clearance_left;
    _sr = BASE_UNIT + edge_clearance_right;


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






    _nc = notch_clearance;


    if(notch_top_left_w > 0 && pins_top)
      translate([-_full_w/2 + notch_top_left_w * BASE_UNIT/2, 0, _full_h/2 - BASE_UNIT/2])
        cuboid([notch_top_left_w * BASE_UNIT + _nc, _cut_d, BASE_UNIT + _nc]);
    if(notch_top_left_h > 0 && pins_left)
      translate([-_full_w/2 + BASE_UNIT/2, 0, _full_h/2 - notch_top_left_h * BASE_UNIT/2])
        cuboid([BASE_UNIT + _nc, _cut_d, notch_top_left_h * BASE_UNIT + _nc]);


    if(notch_top_right_w > 0 && pins_top)
      translate([_full_w/2 - notch_top_right_w * BASE_UNIT/2, 0, _full_h/2 - BASE_UNIT/2])
        cuboid([notch_top_right_w * BASE_UNIT + _nc, _cut_d, BASE_UNIT + _nc]);
    if(notch_top_right_h > 0 && pins_right)
      translate([_full_w/2 - BASE_UNIT/2, 0, _full_h/2 - notch_top_right_h * BASE_UNIT/2])
        cuboid([BASE_UNIT + _nc, _cut_d, notch_top_right_h * BASE_UNIT + _nc]);


    if(notch_bottom_left_w > 0 && pins_bottom)
      translate([-_full_w/2 + notch_bottom_left_w * BASE_UNIT/2, 0, -_full_h/2 + BASE_UNIT/2])
        cuboid([notch_bottom_left_w * BASE_UNIT + _nc, _cut_d, BASE_UNIT + _nc]);
    if(notch_bottom_left_h > 0 && pins_left)
      translate([-_full_w/2 + BASE_UNIT/2, 0, -_full_h/2 + notch_bottom_left_h * BASE_UNIT/2])
        cuboid([BASE_UNIT + _nc, _cut_d, notch_bottom_left_h * BASE_UNIT + _nc]);


    if(notch_bottom_right_w > 0 && pins_bottom)
      translate([_full_w/2 - notch_bottom_right_w * BASE_UNIT/2, 0, -_full_h/2 + BASE_UNIT/2])
        cuboid([notch_bottom_right_w * BASE_UNIT + _nc, _cut_d, BASE_UNIT + _nc]);
    if(notch_bottom_right_h > 0 && pins_right)
      translate([_full_w/2 - BASE_UNIT/2, 0, -_full_h/2 + notch_bottom_right_h * BASE_UNIT/2])
        cuboid([BASE_UNIT + _nc, _cut_d, notch_bottom_right_h * BASE_UNIT + _nc]);
  }
}
blank_panel();
