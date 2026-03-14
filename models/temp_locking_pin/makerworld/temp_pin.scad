include <BOSL2/std.scad>

/* [Handle] */
// Circular handle diameter in mm
handle_diameter = 20; // [10:1:40]
// Handle hole diameter in mm
handle_hole_diameter = 12; // [4:1:30]


/* [Shaft] */
// Shaft length past the handle edge in mm
shaft_length = 16; // [5:1:30]


/* [Prongs] */
// Total prong length in mm
prong_length = 12; // [6:1:20]
// Gap between prongs for flex in mm
prong_gap = 1.4; // [0.5:0.1:3]
// Outward barb extension per side in mm
barb_overhang = 0.3; // [0.1:0.1:1.5]
// Gradual insertion ramp length in mm
barb_ramp_length = 3; // [1:0.5:8]
// Lead-in taper at prong tips in mm
taper_length = 1.8; // [0.5:0.1:4]

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
$fn = 64;
pin_side = LOCKPIN_HOLE_SIDE_LENGTH - TOLERANCE;
chamfer = PRINTING_LAYER_WIDTH;
temp_pin();

$fn = 64;
temp_pin();
module temp_pin() {
    shaft_end_x = shaft_length;


    color(HR_YELLOW)
    translate([-handle_diameter / 2 + 1, 0, 0])
    difference() {
        cyl(d = handle_diameter, h = pin_side, chamfer = chamfer);
        cyl(d = handle_hole_diameter, h = pin_side + 1);
    }


    color(HR_BLUE)
    translate([shaft_end_x / 2, 0, 0])
    cuboid([shaft_end_x, pin_side, pin_side], chamfer = chamfer, except = RIGHT);


    color(HR_GREEN)
    translate([shaft_end_x, 0, 0])
    split_prongs();
}
module split_prongs() {
    prong_width = (pin_side - prong_gap) / 2;
    transition_length = 2;
    straight_length = prong_length - barb_ramp_length - taper_length - transition_length;

    for (side = [-1, 1]) {
        y_off = side * (prong_gap / 2 + prong_width / 2);


        hull() {
            cuboid([0.01, pin_side, pin_side], chamfer = chamfer, except = [LEFT, RIGHT]);
            translate([transition_length, y_off, 0])
            cuboid([0.01, prong_width, pin_side]);
        }

        translate([transition_length, y_off, 0]) {

            translate([straight_length / 2, 0, 0])
            cuboid([straight_length, prong_width, pin_side]);


            translate([straight_length, 0, 0])
            hull() {
                cuboid([0.01, prong_width, pin_side]);
                translate([barb_ramp_length, side * barb_overhang / 2, 0])
                cuboid([0.01, prong_width + barb_overhang, pin_side]);
            }


            translate([straight_length + barb_ramp_length, side * barb_overhang / 2, 0])
            hull() {
                cuboid([0.01, prong_width + barb_overhang, pin_side]);
                translate([taper_length, -side * barb_overhang / 2, 0])
                cuboid([0.01, prong_width * 0.5, pin_side * 0.5]);
            }
        }
    }
}
