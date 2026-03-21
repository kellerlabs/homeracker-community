include <BOSL2/std.scad>

/* [Panel] */
// Panel width in HomeRacker peg units (1 unit = 15mm)
width_units = 6; // [1:24]
// Panel height in HomeRacker peg units (1 unit = 15mm)
height_units = 4; // [1:24]
// Panel thickness in mm
panel_thickness = 2; // [1:0.5:5]


/* [Cutouts] */
// Enable lock pin holes on all edges
cutouts = true;
// Notch corners to fit around HomeRacker connectors
connector_notch = true;

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

// Panel dimensions
panel_width = width_units * BASE_UNIT;
panel_height = height_units * BASE_UNIT;

// Number of pin holes per edge
_n_top = width_units;
_n_side = height_units;

$fn = 100;
module blank_panel() {
  difference() {

    color(HR_RED)
    cuboid([panel_width, panel_thickness, panel_height],
           chamfer=min(BASE_CHAMFER, panel_thickness/2 - EPSILON));

    if(cutouts) {

      translate([0, 0, panel_height / 2 - BASE_UNIT / 2])
        xcopies(spacing=BASE_UNIT, n=_n_top)
          xrot(90) lock_pin_hole();


      translate([0, 0, -panel_height / 2 + BASE_UNIT / 2])
        xcopies(spacing=BASE_UNIT, n=_n_top)
          xrot(90) lock_pin_hole();


      translate([-panel_width / 2 + BASE_UNIT / 2, 0, 0])
        zcopies(spacing=BASE_UNIT, n=_n_side)
          xrot(90) lock_pin_hole();


      translate([panel_width / 2 - BASE_UNIT / 2, 0, 0])
        zcopies(spacing=BASE_UNIT, n=_n_side)
          xrot(90) lock_pin_hole();
    }


    if(connector_notch) {
      _notch_size = [BASE_UNIT + 3, panel_thickness + EPSILON*2, BASE_UNIT + 3];

      translate([-panel_width/2 + BASE_UNIT/2, 0, panel_height/2 - BASE_UNIT/2])
        cuboid(_notch_size);

      translate([panel_width/2 - BASE_UNIT/2, 0, panel_height/2 - BASE_UNIT/2])
        cuboid(_notch_size);

      translate([-panel_width/2 + BASE_UNIT/2, 0, -panel_height/2 + BASE_UNIT/2])
        cuboid(_notch_size);

      translate([panel_width/2 - BASE_UNIT/2, 0, -panel_height/2 + BASE_UNIT/2])
        cuboid(_notch_size);
    }
  }
}
blank_panel();
