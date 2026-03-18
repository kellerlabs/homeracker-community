include <BOSL2/std.scad>

/* [Grid] */
// Number of keystone columns
columns = 6; // [1:24]
// Number of keystone rows
rows = 2; // [1:12]
// Horizontal spacing between keystones (center-to-center) in mm
col_pitch = 25; // [15:0.5:30]
// Vertical spacing between keystones (center-to-center) in mm
row_pitch = 30; // [20:0.5:45]


// Faceplate thickness in mm
faceplate_thickness = 2; // [1:0.5:5]


/* [Ears] */
// Extra margin on left side in mm
margin_left = 0; // [0:1:300]
// Extra margin on right side in mm
margin_right = 0; // [0:1:300]
// Extra margin on top in mm
margin_top = 0; // [0:1:300]
// Extra margin on bottom in mm
margin_bottom = 0; // [0:1:300]
// Ear thickness (depth behind panel face) — matches faceplate
ear_strength = faceplate_thickness;
// Notch corners to fit around HomeRacker connectors
connector_notch = true;
// Center keystone grid within the full panel (including margins)
center_keystones = false;
// Enable lock pin holes on top edge
pins_top = true;
// Enable lock pin holes on bottom edge
pins_bottom = true;
// Enable lock pin holes on left edge
pins_left = true;
// Enable lock pin holes on right edge
pins_right = true;

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

// Faceplate opening width (X) in mm
keystone_faceplate_width = 14.7; // [13:0.1:16]
// Faceplate opening height (Z) in mm
keystone_faceplate_height = 16; // [14:0.1:25]
// Clip plate opening width (X) in mm
keystone_clipplate_width = 14.7; // [13:0.1:16]
// Clip plate opening height (Z) in mm
keystone_clipplate_height = 20.1; // [12:0.1:25]

// Distance from back of faceplate to clip retention plate in mm
clip_plate_offset = 8; // [4:0.5:12]
// Thickness of clip retention plate in mm
clip_plate_thickness = 1; // [1:0.5:3]
// Wall thickness around keystone pocket in mm
pocket_wall = 1.5; // [1:0.5:3]


// Derived keystone pocket dimensions
_pocket_depth = clip_plate_offset + clip_plate_thickness;
_max_height = max(keystone_faceplate_height, keystone_clipplate_height);
_pocket_outer_w = keystone_faceplate_width + 2 * pocket_wall;
_pocket_outer_h = _max_height + 3 * pocket_wall;
_clip_plate_y = -faceplate_thickness/2 - clip_plate_offset - clip_plate_thickness/2;

// Panel dimensions — snap to BASE_UNIT grid for clean ear alignment
panel_width = ceil(((columns - 1) * col_pitch + _pocket_outer_w + BASE_UNIT) / BASE_UNIT) * BASE_UNIT;
panel_height = ceil(((rows - 1) * row_pitch + _pocket_outer_h + BASE_UNIT) / BASE_UNIT) * BASE_UNIT;

// Ear strip width per side = 1 BASE_UNIT (lock pin row) + margin, or 0 if pins disabled
_ear_left = (pins_left ? BASE_UNIT : 0) + margin_left;
_ear_right = (pins_right ? BASE_UNIT : 0) + margin_right;
_ear_top = (pins_top ? BASE_UNIT : 0) + margin_top;
_ear_bottom = (pins_bottom ? BASE_UNIT : 0) + margin_bottom;

// Total outer dimensions
total_width = _ear_left + panel_width + _ear_right;
total_height = _ear_bottom + panel_height + _ear_top;

// Offset of panel center relative to frame center
frame_offset_x = (_ear_left - _ear_right) / 2;
frame_offset_z = (_ear_bottom - _ear_top) / 2;
// Bottom-alignment offsets: shift each opening down so bottom edges align
_faceplate_z_offset = (keystone_faceplate_height - _max_height) / 2;  // negative when faceplate is shorter
_clipplate_z_offset = (keystone_clipplate_height - _max_height) / 2;  // negative when clipplate is shorter
// Clip bar
_clip_bar_height = 1.5;

$fn = 100;
module patch_panel() {
  _n_top = floor(total_width / BASE_UNIT);
  _n_side = floor(total_height / BASE_UNIT);
  _kx = center_keystones ? frame_offset_x : 0;
  _kz = center_keystones ? frame_offset_z : 0;

  difference() {
    union() {

      color(HR_RED)
      translate([frame_offset_x, 0, frame_offset_z])
      cuboid([total_width, faceplate_thickness, total_height],
             chamfer=min(BASE_CHAMFER, faceplate_thickness/2 - EPSILON));


      color(HR_CHARCOAL)
      translate([_kx, -faceplate_thickness/2 - _pocket_depth/2, _kz])
      xcopies(spacing=col_pitch, n=columns)
        zcopies(spacing=row_pitch, n=rows)
          cuboid([_pocket_outer_w, _pocket_depth, _pocket_outer_h]);

    }


    translate([_kx, 0, _kz])
    xcopies(spacing=col_pitch, n=columns)
      zcopies(spacing=row_pitch, n=rows)
        translate([0, 0, _faceplate_z_offset])
          cuboid([keystone_faceplate_width, faceplate_thickness + EPSILON, keystone_faceplate_height]);


    translate([_kx, -faceplate_thickness/2 - clip_plate_offset/2, _kz])
    xcopies(spacing=col_pitch, n=columns)
      zcopies(spacing=row_pitch, n=rows)
        cuboid([keystone_faceplate_width, clip_plate_offset + EPSILON, _max_height + pocket_wall * 2]);




    _rear_height = _max_height;
    _rear_z_offset = (_rear_height - _max_height) / 2;
    translate([_kx, _clip_plate_y, _kz])
    xcopies(spacing=col_pitch, n=columns)
      zcopies(spacing=row_pitch, n=rows)
        translate([0, 0, _rear_z_offset])
          cuboid([keystone_clipplate_width, clip_plate_thickness + EPSILON, _rear_height]);



    if(connector_notch) {
      _notch_size = [BASE_UNIT + 5, ear_strength + EPSILON*2, BASE_UNIT + 1];
      translate([frame_offset_x, 0, frame_offset_z]) {

        translate([-total_width/2 + BASE_UNIT/2, 0, total_height/2 - BASE_UNIT/2])
          cuboid(_notch_size);

        translate([total_width/2 - BASE_UNIT/2, 0, total_height/2 - BASE_UNIT/2])
          cuboid(_notch_size);

        translate([-total_width/2 + BASE_UNIT/2, 0, -total_height/2 + BASE_UNIT/2])
          cuboid(_notch_size);

        translate([total_width/2 - BASE_UNIT/2, 0, -total_height/2 + BASE_UNIT/2])
          cuboid(_notch_size);

       translate([2, 0, total_height/2 - 1])
          cuboid([total_width, 3, 3]);

       translate([2, 0, -total_height/2 + 1])
          cuboid([total_width, 3, 3]);

      }

    }


    translate([frame_offset_x, 0, frame_offset_z]) {
      if(pins_top)
        translate([0, 0, total_height / 2 - BASE_UNIT / 2])
          xcopies(spacing=BASE_UNIT, n=_n_top)
            xrot(90) lock_pin_hole();
      if(pins_bottom)
        translate([0, 0, -total_height / 2 + BASE_UNIT / 2])
          xcopies(spacing=BASE_UNIT, n=_n_top)
            xrot(90) lock_pin_hole();
      if(pins_left)
        translate([-total_width / 2 + BASE_UNIT / 2, 0, 0])
          zcopies(spacing=BASE_UNIT, n=_n_side)
            xrot(90) lock_pin_hole();
      if(pins_right)
        translate([total_width / 2 - BASE_UNIT / 2, 0, 0])
          zcopies(spacing=BASE_UNIT, n=_n_side)
            xrot(90) lock_pin_hole();
    }
  }
}
patch_panel();
