include <BOSL2/std.scad>
include <homeracker/models/core/lib/constants.scad>
include <homeracker/models/core/lib/support.scad>

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

module patch_panel() {
  _n_top = floor(total_width / BASE_UNIT);
  _n_side = floor(total_height / BASE_UNIT);
  _kx = center_keystones ? frame_offset_x : 0;
  _kz = center_keystones ? frame_offset_z : 0;

  difference() {
    union() {
      // Front faceplate slab
      color(HR_RED)
      translate([frame_offset_x, 0, frame_offset_z])
      cuboid([total_width, faceplate_thickness, total_height],
             chamfer=min(BASE_CHAMFER, faceplate_thickness/2 - EPSILON));

      // Keystone pocket walls — open-backed channel extending behind faceplate
      color(HR_CHARCOAL)
      translate([_kx, -faceplate_thickness/2 - _pocket_depth/2, _kz])
      xcopies(spacing=col_pitch, n=columns)
        zcopies(spacing=row_pitch, n=rows)
          cuboid([_pocket_outer_w, _pocket_depth, _pocket_outer_h]);

    }

    // Faceplate opening, bottom-aligned
    translate([_kx, 0, _kz])
    xcopies(spacing=col_pitch, n=columns)
      zcopies(spacing=row_pitch, n=rows)
        translate([0, 0, _faceplate_z_offset])
          cuboid([keystone_faceplate_width, faceplate_thickness + EPSILON, keystone_faceplate_height]);

    // Interior channel: hollow out the pocket interior, leaving pocket_wall on top and bottom
    translate([_kx, -faceplate_thickness/2 - clip_plate_offset/2, _kz])
    xcopies(spacing=col_pitch, n=columns)
      zcopies(spacing=row_pitch, n=rows)
        cuboid([keystone_faceplate_width, clip_plate_offset + EPSILON, _max_height + pocket_wall * 2]);

    // Rear opening: smaller of the two openings, bottom-aligned
    // The bar covers the difference at the top
    // Rear opening stops below the clip bar
    _rear_height = _max_height;
    _rear_z_offset = (_rear_height - _max_height) / 2;
    translate([_kx, _clip_plate_y, _kz])
    xcopies(spacing=col_pitch, n=columns)
      zcopies(spacing=row_pitch, n=rows)
        translate([0, 0, _rear_z_offset])
          cuboid([keystone_clipplate_width, clip_plate_thickness + EPSILON, _rear_height]);


    // Corner notches for HomeRacker connectors
    if(connector_notch) {
      _notch_size = [BASE_UNIT + 5, ear_strength + EPSILON*2, BASE_UNIT + 1];
      translate([frame_offset_x, 0, frame_offset_z]) {
        // Top-left
        translate([-total_width/2 + BASE_UNIT/2, 0, total_height/2 - BASE_UNIT/2])
          cuboid(_notch_size);
        // Top-right
        translate([total_width/2 - BASE_UNIT/2, 0, total_height/2 - BASE_UNIT/2])
          cuboid(_notch_size);
        // Bottom-left
        translate([-total_width/2 + BASE_UNIT/2, 0, -total_height/2 + BASE_UNIT/2])
          cuboid(_notch_size);
        // Bottom-right
        translate([total_width/2 - BASE_UNIT/2, 0, -total_height/2 + BASE_UNIT/2])
          cuboid(_notch_size);
       // Notch the top bar
       translate([2, 0, total_height/2 - 1])
          cuboid([total_width, 3, 3]);
      // Notch the top bar
       translate([2, 0, -total_height/2 + 1])
          cuboid([total_width, 3, 3]);

      }

    }

    // Lock pin holes — one row on each outer edge
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
