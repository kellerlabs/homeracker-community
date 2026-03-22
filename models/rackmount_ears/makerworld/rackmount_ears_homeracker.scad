include <BOSL2/std.scad>

/* [Base] */
// Total inner rack width in mm. Set to 0 to auto-detect from rack_size (10" or 19" standard). For custom homeracker racks, set this to your actual rack width.
rack_width=0; // [0:1:600]

// rack size in inches. Only used when rack_width is 0. Only 10 and 19 inch racks are supported.
rack_size=10; // [10:10 inch,19:19 inch]

// Asymetry Slider. CAUTION: there's no sanity check for this slider!
asymetry=0; // [-150:0.1:150]

// shows the distance between the rackmount ears considering the device width.
show_distance=false;
// Which part to render. Use "left" or "right" for individual 3MF/STL export.
part="both"; // [both:Both ears (preview),left:Left ear,right:Right ear]

// Width of the device in mm. Will determine the width of the rackmount ears depending on rack width.
device_width=201;
// Height of the device in mm. Will determine the height of the rackmount ear in standard HeightUnits (1HU=44.45 mm). The program will always choose the minimum number of units to fit the device height. Minimum is 1 unit.
device_height=40;
// Depth of the device in mm. The side face will be at least this deep, and bores (including VESA) will be centered on this depth. Set to 0 to auto-size from bore parameters only.
device_depth=0; // [0:1:500]

// Thickness of the rackmount ear.
strength=3;


/* [Flange] */
// Flange attachment style
flange_style="tab"; // [support:Support beam (15x15mm),tab:Flat tab]
// Flange depth in base units (each unit = 15mm)
flange_depth=1; // [1:1:10]
// Direction the flange extends from the front face
flange_direction="outside"; // [inside:Inside (into rack),outside:Outside (toward device)]


/* [VESA Mount] */
// VESA mounting preset. Overrides device bore settings below when not "none".
vesa_preset="none"; // [none:Manual bore config,75:VESA 75x75 (MIS-D 75),100:VESA 100x100 (MIS-D 100),200:VESA 200x200 (MIS-F),75_100:VESA MIS-D combo (75+100)]


/* [Device Bores] */
// Distance (in mm) of the device's front bores(s) to the front of the device
device_bore_distance_front=9.5;
// Distance (in mm) of the device's bottom bore(s) to the bottom of the device
device_bore_distance_bottom=9.5;
// distance between the bores in the horizontal direction
device_bore_margin_horizontal=25;
// distance between the bores in the vertical direction
device_bore_margin_vertical=25;
// diameter of the bore (should be at least the same as the diameter of the screw shaft)
device_bore_hole_diameter=3.3;
// diameter of the bore head (if not countersunk, just choose the same as device_bore_hole_diameter)
device_bore_hole_head_diameter=6;
// How long is the screw head in depth. This determines the angle of the countersink. The longer the screw head, the more the countersink is inclined.
device_bore_hole_head_length=1.2;
// number of bores in the horizontal direction (will be multiplied by device_bore_rows)
device_bore_columns=2;
// number of bores in the vertical direction (will be multiplied by device_bore_columns)
device_bore_rows=2;
// If true, the device will be aligned to the center of the rackmount ear. Otherwise it will be aligned to the bottom of the rackmount ear.
center_device_bore_alignment=false;

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
$fn=100;
RACK_HEIGHT_UNIT=STD_UNIT_HEIGHT;
CHAMFER=min(strength/3,0.5);

// When VESA is active, auto-size height to fit the hole pattern + margins
_vesa_min_height = _vesa_active
    ? _vesa_spacing + 2 * max(10, device_bore_distance_bottom)
    : 0;
eff_device_height = max(device_height, _vesa_min_height);

RACK_HEIGHT_UNIT_COUNT=max(1,ceil(eff_device_height/RACK_HEIGHT_UNIT));
RACK_HEIGHT=RACK_HEIGHT_UNIT_COUNT*RACK_HEIGHT_UNIT;
PIN_HEIGHT_UNITS=max(1,floor(RACK_HEIGHT/BASE_UNIT));
FLANGE_HEIGHT=PIN_HEIGHT_UNITS*BASE_UNIT;
FLANGE_Z_OFFSET=(RACK_HEIGHT-FLANGE_HEIGHT)/2;

RACK_WIDTH_10_INCH_OUTER=STD_WIDTH_10INCH;
RACK_WIDTH_19_INCH=STD_WIDTH_19INCH;

// VESA standard dimensions: M4 screws, always 2x2 grid, centered
// Shaft: 4.5mm clearance for M4, Head: 8.5mm (socket cap), Countersink: 1.5mm
// Compare against both string and numeric types to handle OpenSCAD
// customizer type coercion (dropdown values may arrive as strings or numbers).
_vesa_active = vesa_preset != "none" && vesa_preset != 0;
_vesa_spacing =
    (vesa_preset == 75 || vesa_preset == "75") ? 75 :
    (vesa_preset == 100 || vesa_preset == "100") ? 100 :
    (vesa_preset == 200 || vesa_preset == "200") ? 200 :
    (vesa_preset == "75_100") ? 100 : 0;  // combo uses 100 as primary
_vesa_has_combo = vesa_preset == "75_100";

// Effective bore parameters (VESA overrides manual settings)
eff_bore_columns = _vesa_active ? 2 : device_bore_columns;
eff_bore_rows = _vesa_active ? 2 : device_bore_rows;
eff_bore_margin_h = _vesa_active ? _vesa_spacing : device_bore_margin_horizontal;
eff_bore_margin_v = _vesa_active ? _vesa_spacing : device_bore_margin_vertical;
eff_bore_hole_diameter = _vesa_active ? 4.5 : device_bore_hole_diameter;
eff_bore_hole_head_diameter = _vesa_active ? 8.5 : device_bore_hole_head_diameter;
eff_bore_hole_head_length = _vesa_active ? 1.5 : device_bore_hole_head_length;
eff_bore_distance_front = _vesa_active ? max(10, device_bore_distance_front) : device_bore_distance_front;
eff_center_alignment = _vesa_active ? true : center_device_bore_alignment;

// Debug
echo("Height: ", RACK_HEIGHT);
echo("Pin holes vertical: ", PIN_HEIGHT_UNITS);
if (_vesa_active) echo("VESA preset: ", vesa_preset, " type: ", type(vesa_preset), " spacing: ", _vesa_spacing, " margin_v: ", eff_bore_margin_v, " margin_h: ", eff_bore_margin_h);

// Calculate the depth of the ear — at least enough for bores, but also at least device_depth
_bore_depth=eff_bore_distance_front*2+(eff_bore_columns - 1) * eff_bore_margin_h;
depth=max(_bore_depth, device_depth);

device_screw_alignment_vertical=
    eff_center_alignment ?
        RACK_HEIGHT / 2 :
        eff_bore_margin_v / 2 + device_bore_distance_bottom
;
// VESA: push pattern toward back of side face (10mm past last hole)
// Manual bores: center on depth as before
_bore_half_span = (eff_bore_columns - 1) * eff_bore_margin_h / 2;
device_screw_alignment_depth = _vesa_active
    ? depth - 10 - _bore_half_span
    : depth / 2;
device_screw_alignment = [strength, device_screw_alignment_depth, device_screw_alignment_vertical];


// lock_pin_hole() - Bidirectional chamfered square hole for lock pins.
// Copied from core/lib/support.scad for include-path compatibility.

$fn=100;
_vesa_min_height = _vesa_active
    ? _vesa_spacing + 2 * max(10, device_bore_distance_bottom)
    : 0;
_vesa_spacing =
    (vesa_preset == 75 || vesa_preset == "75") ? 75 :
    (vesa_preset == 100 || vesa_preset == "100") ? 100 :
    (vesa_preset == 200 || vesa_preset == "200") ? 200 :
    (vesa_preset == "75_100") ? 100 : 0;
echo("Height: ", RACK_HEIGHT);
echo("Pin holes vertical: ", PIN_HEIGHT_UNITS);
if (_vesa_active) echo("VESA preset: ", vesa_preset, " type: ", type(vesa_preset), " spacing: ", _vesa_spacing, " margin_v: ", eff_bore_margin_v, " margin_h: ", eff_bore_margin_h);
device_screw_alignment_vertical=
    eff_center_alignment ?
        RACK_HEIGHT / 2 :
        eff_bore_margin_v / 2 + device_bore_distance_bottom
;
device_screw_alignment_depth = _vesa_active
    ? depth - 10 - _bore_half_span
    : depth / 2;
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
module base_ear(width,strength,height) {
    union() {

        cuboid([width,strength,height],anchor=LEFT+BOTTOM+FRONT,chamfer=CHAMFER);

        cuboid([strength,depth,height],anchor=LEFT+BOTTOM+FRONT,chamfer=CHAMFER);
    }
}
module screws_countersunk(length, diameter_head, length_head, diameter_shaft,
                          margin_v=undef, margin_h=undef, rows=undef, cols=undef) {
    _mv = is_undef(margin_v) ? eff_bore_margin_v : margin_v;
    _mh = is_undef(margin_h) ? eff_bore_margin_h : margin_h;
    _rows = is_undef(rows) ? eff_bore_rows : rows;
    _cols = is_undef(cols) ? eff_bore_columns : cols;

    _eps = 0.5;
    translate(device_screw_alignment + [_eps, 0, 0])
    yrot(-90)
    grid_copies(spacing=[_mv,_mh],n=[_rows, _cols])
    union() {
        cylinder(h=length_head, r1=diameter_head/2, r2=diameter_shaft/2);
        translate([0,0,length_head]) cylinder(h=length-length_head+_eps, r=diameter_shaft/2);
    }
}
module flange_support_style(height_units, flange_units) {
    flange_h = height_units * BASE_UNIT;
    flange_d = flange_units * BASE_UNIT;

    difference() {
        cuboid([BASE_UNIT, flange_d, flange_h],
               chamfer=BASE_CHAMFER,
               anchor=RIGHT+BOTTOM+BACK);


        for (z_idx = [0 : height_units - 1]) {
            translate([-BASE_UNIT/2, -flange_d/2, z_idx * BASE_UNIT + BASE_UNIT/2])
            rotate([0, 90, 0])
            lock_pin_hole();
        }


        for (z_idx = [0 : height_units - 1]) {
            for (y_idx = [0 : flange_units - 1]) {
                translate([-BASE_UNIT/2, -(y_idx * BASE_UNIT + BASE_UNIT/2), z_idx * BASE_UNIT + BASE_UNIT/2])
                rotate([90, 0, 0])
                lock_pin_hole();
            }
        }
    }
}
module flange_tab_style(height_units, flange_units, ear_strength) {
    flange_h = height_units * BASE_UNIT;
    flange_d = flange_units * BASE_UNIT;

    difference() {
        cuboid([ear_strength, flange_d, flange_h],
               chamfer=CHAMFER,
               anchor=RIGHT+BOTTOM+BACK);



        for (z_idx = [0 : height_units - 1]) {
            for (y_idx = [0 : flange_units - 1]) {
                translate([-ear_strength/2, -(y_idx * BASE_UNIT + BASE_UNIT/2), z_idx * BASE_UNIT + BASE_UNIT/2])
                rotate([0, 90, 0])
                lock_pin_hole();
            }
        }
    }
}
module rackmount_ear_homeracker(asym=0){

    effective_rack_width = rack_width > 0 ? rack_width :
        (rack_size == 19 ? RACK_WIDTH_19_INCH : RACK_WIDTH_10_INCH_OUTER);


    rack_gap = (effective_rack_width - device_width) / 2 + asym;





    hole_overlap =  BASE_UNIT/2 + LOCKPIN_HOLE_SIDE_LENGTH/2 + LOCKPIN_HOLE_CHAMFER;
    min_ear_width = flange_style == "support" ? BASE_UNIT + strength :
        (flange_direction == "outside" ? hole_overlap + strength : strength * 2);
    rack_ear_width = flange_direction == "outside"
        ? max(min_ear_width, rack_gap + hole_overlap)
        : max(min_ear_width, rack_gap);


    flange_thick = flange_style == "support" ? BASE_UNIT : strength;




    flange_x_pos = flange_direction == "inside"
        ? rack_ear_width - flange_thick/2
        : rack_ear_width + flange_depth * BASE_UNIT;
    flange_y_pos = flange_direction == "inside"
        ? 0
        : -flange_thick/2;

    echo("=== Rackmount Ear Debug ===");
    echo("effective_rack_width: ", effective_rack_width);
    echo("rack_gap: ", rack_gap);
    echo("rack_ear_width: ", rack_ear_width);
    echo("hole_overlap: ", hole_overlap);
    echo("min_ear_width: ", min_ear_width);
    echo("hole X position: ", rack_gap + BASE_UNIT/2);
    echo("support inner edge X: ", rack_gap);
    echo("support center X: ", rack_gap + BASE_UNIT/2);
    echo("support outer edge X: ", rack_gap + BASE_UNIT);
    echo("ear outer edge X: ", rack_ear_width);
    echo("FLANGE_Z_OFFSET: ", FLANGE_Z_OFFSET);
    echo("PIN_HEIGHT_UNITS: ", PIN_HEIGHT_UNITS);

    difference() {
        union() {

            base_ear(rack_ear_width, strength, RACK_HEIGHT);


            if (!(flange_style == "tab" && flange_direction == "outside")) {
                translate([flange_x_pos, flange_y_pos, FLANGE_Z_OFFSET])
                rotate([0, 0, flange_direction == "outside" ? -90 : 0])
                if (flange_style == "support") {
                    flange_support_style(PIN_HEIGHT_UNITS, flange_depth);
                } else {
                    flange_tab_style(PIN_HEIGHT_UNITS, flange_depth, strength);
                }
            }
        }

        screws_countersunk(length=strength,
            diameter_head=eff_bore_hole_head_diameter,
            length_head=eff_bore_hole_head_length,
            diameter_shaft=eff_bore_hole_diameter);


        if (_vesa_has_combo) {
            screws_countersunk(length=strength,
                diameter_head=eff_bore_hole_head_diameter,
                length_head=eff_bore_hole_head_length,
                diameter_shaft=eff_bore_hole_diameter,
                margin_v=75, margin_h=75, rows=2, cols=2);
        }



        if (flange_style == "tab" && flange_direction == "outside") {
            for (z_idx = [0 : PIN_HEIGHT_UNITS]) {
                translate([-5 + rack_gap + BASE_UNIT/2, strength/2, -7.5 + FLANGE_Z_OFFSET + z_idx * BASE_UNIT + BASE_UNIT/2])
                rotate([90, 0, 0])
                cuboid([LOCKPIN_HOLE_SIDE_LENGTH, LOCKPIN_HOLE_SIDE_LENGTH, strength + 1],
                       chamfer=-LOCKPIN_HOLE_CHAMFER);
            }
        }
    }
}
if (part == "both" || part == "left") {
    color("yellow")
    rackmount_ear_homeracker(asymetry);
}
if (part == "both" || part == "right") {
    color("blue")
    translate([part == "both" ? ear_distance : 0, 0, 0])
    mirror(x_mirror_plane){
        rackmount_ear_homeracker(-asymetry);
    }
}
