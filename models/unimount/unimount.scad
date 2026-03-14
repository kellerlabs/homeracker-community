include <BOSL2/std.scad>
include <BOSL2/walls.scad>

/* [General] */
// Tray (carries the device), Bracket (frontpanel + bracket) or a singular bracket without frontpanel?
variant = 2; // [1:Bracket, 2:Tray, 3:Bracket w/o frontpanel]
// Standard (10" or 19") frontpanel? (potentially overruled by device_width, variant and split combinations)
standard = 1;  // [1:10 inch, 2:19 inch, 3:Custom width]
// Custom total panel width in mm (only used when standard is set to "Custom width")
custom_panel_width = 300; // [50:0.1:600]
// Split Front panel for easier printability on smaller printers or 19" racks.
split_frontpanel = false; // [false,true]
// Export individual split parts for STL (only when split frontpanel is enabled)
split_export = 0; // [0:All parts,1:Center + Tray,2:Left ear,3:Right ear]

// Device width may enforce chosen standard to change to 19".
device_width = 270; // [15:0.1:390]
// Device depth in mm. (minimum 49mm for bracket variant). Influences tray wall strength.
device_depth = 260; // [30:0.1:400]
// Device height in mm. Influences height units.
device_height = 140.5; // [11:0.1:250]


/* [HomeRacker Parameters] */
// Flush fit to top of HomeRacker mount (adds 0.55mm per height unit to match HR units when frontpanel fills entire rackmount)
flush_to_top = false; // [false,true]
// Flush fit to to enclose the extra HomeRacker unit at the bottom of the rackmount. Enforced in "Bracket" variant.
flush_to_bottom = false; // [false,true]
// When chosen, influences how much the bracket will overlap on the sides of the device.
bracket_strength_sides = 7.5; // [0:0.1:50]
// When chosen, influences how much the bracket will overlap on the top of the device.
bracket_strength_top = 7.5; // [0:0.1:50]
// Override bracket's mount column count to a single column (usually determined by device depth and mounting variant).
force_single_mount_column = false; // [false,true]
// Rack mounting style on the front panel sides
rack_mount_style = "standard"; // [standard:Standard cage bolts,homeracker:HomeRacker lock pins]
// Notch the top and bottom lock pin holes open to allow connector pass-through (homeracker only)
connector_notch = false; // [false,true]
// Extra clearance (mm) to subtract from each of the four corners for HomeRacker corner mount clearance
corner_clearance = 0; // [0:0.1:10]


/* [Advanced Parameters] */
// Depth of the flange which fixates the device in the frontpanel (will be set to 15mm in "Tray" variant)
flange_depth = 15; // [12:0.1:30]

// Disable automatic tray wall strength scaling (defaults to 2mm instead of increasing with device depth)
lightweight_tray = false; // [false,true]

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

PANEL_PRIMARY_COLOR = HR_YELLOW;
PANEL_SECONDARY_COLOR = HR_CHARCOAL;
VARIANT_BRACKET = 1;
VARIANT_TRAY = 2;
VARIANT_BRACKET_ONLY = 3;
VIEW_ASSEMBLY = 0;
VIEW_PLATE_SINGLE = 1;
VIEW_PLATE_SPLIT_CENTER = 2;
VIEW_PLATE_SPLIT_SIDES = 3;
VIEW_PLATE_BRACKET = 4;
VIEW_PLATE_SPLIT_LEFT = 5;
VIEW_PLATE_SPLIT_RIGHT = 6;

LOCKPIN_WIDTH_OUTER = BASE_UNIT + BASE_STRENGTH*2 + TOLERANCE*2;
function get_panel_extension_height_bottom(flush_to_bottom) = flush_to_bottom ? (BASE_UNIT - TOLERANCE/2) : 0;
function get_panel_extension_height_top(height_units, flush_to_top) = flush_to_top ? (height_units * 0.55) : 0;
function get_flange_inset(variant, flush_to_bottom, height_units, flush_to_top) =
  flush_to_bottom
    ? (get_panel_extension_height_bottom(flush_to_bottom) - (variant == VARIANT_BRACKET ? BASE_STRENGTH : 0))
    : 0;

function get_wall_thickness_increase(variant, device_depth, lightweight_tray) =
  variant == VARIANT_TRAY && !lightweight_tray
    ? max(0, (device_depth - 100) * 0.02)
    : 0;

function get_bracket_addition(bracket_strength_sides) =
  bracket_strength_sides > 0 ? (BASE_UNIT+BASE_STRENGTH)*2 : 0;

function get_split_addition(split_frontpanel, bracket_strength_sides) =
  split_frontpanel
    ? (BASE_STRENGTH+TOLERANCE)*2 + (bracket_strength_sides > 0 ? 0 : BASE_UNIT*2)
    : 0;

function get_bracket_translation_z(device_height) =
  BASE_STRENGTH + get_panel_extension_height_bottom(true) + device_height + TOLERANCE/2;

function get_panel_width(standard, device_width, flange_addition, bracket_addition, split_addition, split_frontpanel, custom_panel_width=0) =
  standard == 3
    ? custom_panel_width
    : let(
        split_penalty = split_frontpanel ? (BASE_STRENGTH*2 + TOLERANCE) : 0,
        unusable_width_10in = STD_MOUNT_SURFACE_WIDTH*2 + flange_addition + bracket_addition + split_addition + split_penalty,
        usable_width_10in = STD_WIDTH_10INCH - unusable_width_10in,
        enforced_standard = device_width > usable_width_10in ? 2 : standard
      )
      enforced_standard == 1
        ? STD_WIDTH_10INCH
        : STD_WIDTH_19INCH;

RACKMOUNT_BORE_WIDTH = 10;
module rack_bore() {
  bore_width = RACKMOUNT_BORE_WIDTH;
  bore_depth = BASE_STRENGTH;
  bore_height = 6.5;
  bore_dimensions = [bore_width, bore_depth+EPSILON, bore_height];
  cuboid(bore_dimensions,rounding=bore_height/2,except=[FRONT,BACK]);
}

module bores_1_hu() {
  color(HR_RED)
  zcopies(spacing=STD_RACK_BORE_DISTANCE_Z, n=3)
  rack_bore();
}

module lockpin_holes_inner() {

  zcopies(spacing = BASE_UNIT, n = 2)
  rotate([0,90,0]) lock_pin_hole();
}

// Lock pin holes facing forward (Y direction) for front-insertion through panel + flange
module lockpin_holes_fwd() {
  _ext = BASE_STRENGTH + 0.5;
  _outer = LOCKPIN_HOLE_SIDE_LENGTH + LOCKPIN_HOLE_CHAMFER*2;

  zcopies(spacing = BASE_UNIT, n = 3)
  xrot(-90) {
    lock_pin_hole();
    // Extend front opening through the panel
    translate([0, 0, BASE_UNIT/2 + _ext/2])
    cube([_outer, _outer, _ext], center=true);
    // Extend back opening through end of flange
    translate([0, 0, -BASE_UNIT/2 - _ext/2])
    cube([_outer, _outer, _ext], center=true);
  }
}

module lockpin_holes_outer() {

  zcopies(spacing = BASE_UNIT, n = 2) yrot(-90)
  cuboid([LOCKPIN_HOLE_SIDE_LENGTH, LOCKPIN_HOLE_SIDE_LENGTH, LOCKPIN_WIDTH_OUTER], chamfer=-LOCKPIN_HOLE_CHAMFER-TOLERANCE);
}

module stiffener_frontpanel(stiffener_width=BASE_UNIT, orient=UP) {
  stiffener_side_length = BASE_UNIT - BASE_STRENGTH;
  stopper_wedge = [stiffener_width, stiffener_side_length, stiffener_side_length];
  wedge_chamfer = BASE_CHAMFER;
     
          
  tag_scope("stiffener") diff() wedge(stopper_wedge, orient=orient) {
      tag("remove") attach("bot_edge", LEFT+FWD, overlap=BASE_STRENGTH*sqrt(2))
      chamfer_edge_mask(l=stiffener_width, chamfer=BASE_STRENGTH);
      tag("remove") attach([BOTTOM+LEFT,BOTTOM+RIGHT,"hypot_left","hypot_right"], LEFT+FWD, overlap=wedge_chamfer*sqrt(2))
      chamfer_edge_mask(l=BASE_UNIT * sqrt(2), chamfer=wedge_chamfer);
  }
}

RACKMOUNT_FULL = 1;
RACKMOUNT_CENTER = 2;
RACKMOUNT_SIDE = 3;

module rackmount_1u(panel_width=STD_WIDTH_10INCH, panel_type=RACKMOUNT_FULL, anchor=CENTER, spin=0, orient=UP) {

  panel_height = STD_UNIT_HEIGHT;
  panel_depth = BASE_STRENGTH;
  panel_dimensions = [panel_width, panel_depth, panel_height];

  attachable(anchor, spin, orient, size=panel_dimensions) {

    if(panel_type == RACKMOUNT_FULL) {
      if(rack_mount_style == "homeracker") {
        flange_dims = [BASE_UNIT, BASE_STRENGTH, panel_height];
        difference() {
          color(HR_YELLOW)
          cuboid(panel_dimensions){
            align(BACK,[LEFT,RIGHT])
              cuboid(flange_dims, chamfer=BASE_CHAMFER, edges=[BACK+LEFT,BACK+RIGHT]);

            align(BACK,BOTTOM)
              stiffener_frontpanel(panel_width-(STD_MOUNT_SURFACE_WIDTH+TOLERANCE)*2);

            align(BACK,TOP)
              stiffener_frontpanel(panel_width-(STD_MOUNT_SURFACE_WIDTH+TOLERANCE)*2, orient=DOWN);
          }
          // Lock pin holes cut front-to-back through panel + flange
          translate([(-panel_width + BASE_UNIT)/2, BASE_STRENGTH/2, 0])
            lockpin_holes_fwd();
          translate([(panel_width - BASE_UNIT)/2, BASE_STRENGTH/2, 0])
            lockpin_holes_fwd();
        }
      } else {
        difference() {
          color(HR_YELLOW)
          tag_scope("rackmount_1u") diff()
          cuboid(panel_dimensions){
            tag("remove") align(CENTER,[LEFT,RIGHT], inside=true, inset=(STD_MOUNT_SURFACE_WIDTH-RACKMOUNT_BORE_WIDTH)/2)
              bores_1_hu();

            tag("keep") align(BACK,BOTTOM)
              stiffener_frontpanel(panel_width-(STD_MOUNT_SURFACE_WIDTH+TOLERANCE)*2);

            tag("keep") align(BACK,TOP)
              stiffener_frontpanel(panel_width-(STD_MOUNT_SURFACE_WIDTH+TOLERANCE)*2, orient=DOWN);
          }
        }
      }
    } else if(panel_type == RACKMOUNT_SIDE) {

        difference() {
          cuboid(panel_dimensions) {

            align(BACK,RIGHT+BOTTOM)
              stiffener_frontpanel(panel_width-STD_MOUNT_SURFACE_WIDTH-TOLERANCE);

            align(BACK,RIGHT+TOP)
              stiffener_frontpanel(panel_width-STD_MOUNT_SURFACE_WIDTH-TOLERANCE, orient=DOWN);

            align(BACK,RIGHT)
              cuboid([BASE_STRENGTH, BASE_STRENGTH + BASE_UNIT + TOLERANCE/2, panel_height], chamfer=BASE_CHAMFER, edges=LEFT+BACK)
                attach(BACK+RIGHT,LEFT+FRONT, overlap=sqrt(BASE_STRENGTH*2^2))
                  cuboid([BASE_UNIT + BASE_STRENGTH*2+TOLERANCE, BASE_STRENGTH, panel_height], chamfer=BASE_CHAMFER, edges=[LEFT+BACK,RIGHT+BACK])
                    attach(FWD+RIGHT, BACK+LEFT, overlap=sqrt(BASE_STRENGTH*2^2)) color(HR_GREEN)
                      cuboid([BASE_STRENGTH, BASE_STRENGTH + BASE_UNIT, panel_height], chamfer=BASE_CHAMFER, edges=[RIGHT+BACK,RIGHT+FRONT]);

            if(rack_mount_style == "homeracker") {
              flange_dims = [BASE_UNIT, BASE_STRENGTH, panel_height];
              align(BACK,LEFT)
                cuboid(flange_dims, chamfer=BASE_CHAMFER, edges=[BACK+LEFT,BACK+RIGHT]);
            }
          }
          if(rack_mount_style == "homeracker") {
            // Lock pin holes cut front-to-back through panel + left flange
            translate([(-panel_width + BASE_UNIT)/2, BASE_STRENGTH/2, 0])
              lockpin_holes_fwd();
          } else {
            translate([(-panel_width+STD_MOUNT_SURFACE_WIDTH)/2,0,0])
            bores_1_hu();
          }
          translate([(panel_width+LOCKPIN_WIDTH_OUTER-BASE_STRENGTH*2-TOLERANCE)/2,(BASE_UNIT-BASE_STRENGTH+LOCKPIN_HOLE_SIDE_LENGTH)/2,0])
          lockpin_holes_outer();
        }

    } else if(panel_type == RACKMOUNT_CENTER) {

      bar_dimensions = [BASE_UNIT, BASE_UNIT, panel_height];
      cuboid(panel_dimensions)
        align(BACK,[LEFT,RIGHT])
          mountbar(bar_dimensions);
    }
    children();
  }
}

module mountbar(bar_dimensions, anchor=CENTER, spin=0, orient=UP) {
  attachable(anchor, spin, orient, size=bar_dimensions) {
    tag_scope("mountbar") diff()
    cuboid(bar_dimensions, chamfer=BASE_CHAMFER, edges=[BACK+LEFT,BACK+RIGHT]){
      tag("remove") attach(CENTER) lockpin_holes_inner();
    }
    children();
  }
}

module rackmount(panel_width, panel_extension_height_bottom=0, panel_extension_height_top=0, height_units, rackmount_type,
  anchor=CENTER, spin=0, orient=UP, color=HR_YELLOW, debug_colors=false) {

  rackmount_stack_height = height_units*STD_UNIT_HEIGHT;
  total_height = rackmount_stack_height + panel_extension_height_bottom + panel_extension_height_top;

  side_base_connector_width = BASE_UNIT + BASE_STRENGTH + TOLERANCE;
  side_base_inset = STD_MOUNT_SURFACE_WIDTH + TOLERANCE;
  side_base_width = panel_width - side_base_inset + side_base_connector_width;
  side_base_depth = BASE_UNIT + BASE_STRENGTH + TOLERANCE/2;

  attachable(anchor, spin, orient, size=[panel_width, BASE_STRENGTH, total_height]) {
    difference() {
      union() {

        color_this(color)
        up((panel_extension_height_bottom - panel_extension_height_top)/2)
          zcopies(spacing=STD_UNIT_HEIGHT, n=height_units) rackmount_1u(panel_width, rackmount_type);

        if(panel_extension_height_bottom > 0) {
          color(debug_colors ? HR_GREEN : color)
          down((rackmount_stack_height + panel_extension_height_top)/2)
            cuboid([panel_width, BASE_STRENGTH, panel_extension_height_bottom]){
              if(rackmount_type == RACKMOUNT_SIDE)

                tag_scope("rackmount") diff() align(BACK, LEFT, inset=side_base_inset)
                  cuboid([side_base_width, side_base_depth, panel_extension_height_bottom], chamfer=BASE_CHAMFER, edges=[BOTTOM,LEFT,BACK+RIGHT,FRONT+RIGHT],except=[BOTTOM+FRONT]){
                    left((side_base_connector_width+BASE_CHAMFER+TOLERANCE/2)/2) edge_mask(BACK+TOP)
                      chamfer_edge_mask(l=side_base_width-side_base_connector_width-BASE_STRENGTH+BASE_CHAMFER, chamfer=BASE_CHAMFER);
                    align(FRONT, RIGHT, inset=BASE_STRENGTH,inside=true) cuboid([BASE_UNIT+TOLERANCE, BASE_UNIT+TOLERANCE/2, panel_extension_height_bottom+EPSILON]);
                    align(FRONT, RIGHT, inside=true) cuboid([BASE_STRENGTH, TOLERANCE/2, panel_extension_height_bottom+EPSILON]);
                  }
            }
        }

        if(panel_extension_height_top > 0) {
          recolor(debug_colors ? HR_GREEN : color)
          up((rackmount_stack_height + panel_extension_height_bottom - EPSILON)/2)
            cuboid([panel_width, BASE_STRENGTH, panel_extension_height_top + EPSILON]);
        }
      }

      // Connector notches at top and bottom of homeracker flanges (applied once to full stack)
      if(rack_mount_style == "homeracker" && connector_notch && rackmount_type != RACKMOUNT_CENTER) {
        _notch_depth = BASE_STRENGTH * 2 + 1;  // cut through panel + flange
        _flange_center_y = BASE_STRENGTH/2;  // centered on panel+flange
        _shift = (panel_extension_height_bottom - panel_extension_height_top)/2;
        _stack_top = _shift + rackmount_stack_height/2;
        _stack_bottom = _shift - rackmount_stack_height/2;

        // Left flange notches
        for(_z = [_stack_top - BASE_UNIT/2, _stack_bottom + BASE_UNIT/2])
          translate([(-panel_width + BASE_UNIT)/2, _flange_center_y, _z])
            cube([BASE_UNIT + 1, _notch_depth, BASE_UNIT + 0.5], center=true);

        // Right flange notches (only for full-width panels)
        if(rackmount_type == RACKMOUNT_FULL)
          for(_z = [_stack_top - BASE_UNIT/2, _stack_bottom + BASE_UNIT/2])
            translate([(panel_width - BASE_UNIT)/2, _flange_center_y, _z])
              cube([BASE_UNIT + 1, _notch_depth, BASE_UNIT + 0.5], center=true);
      }

      // Corner mount clearance notches adjacent to connector notch areas
      if (corner_clearance > 0 && rack_mount_style == "homeracker" && rackmount_type != RACKMOUNT_CENTER) {
        _corner_cut_depth = 100;
        _corner_cut_height = BASE_UNIT + 0.5;
        _corner_cut_width = BASE_UNIT + 0.5;
        _connector_notch_width = BASE_UNIT + 1;
        _flange_center_y = BASE_STRENGTH/2;
        _center_shift = (panel_extension_height_bottom - panel_extension_height_top)/2;
        _stack_top = _center_shift + rackmount_stack_height/2;
        _stack_bottom = _center_shift - rackmount_stack_height/2;

        // Left flange - extend toward center
        for(_z = [_stack_top - BASE_UNIT/2, _stack_bottom + BASE_UNIT/2])
          translate([(-panel_width + BASE_UNIT)/2 + _connector_notch_width/2 + corner_clearance/2 - EPSILON, _flange_center_y, _z])
            cube([corner_clearance, _corner_cut_depth, _corner_cut_height], center=true);

        // Right flange (only for full-width panels)
        if(rackmount_type == RACKMOUNT_FULL)
          for(_z = [_stack_top - BASE_UNIT/2, _stack_bottom + BASE_UNIT/2])
            translate([(panel_width - BASE_UNIT)/2 - _connector_notch_width/2 - corner_clearance/2, _flange_center_y, _z])
              cube([corner_clearance, _corner_cut_depth, _corner_cut_height], center=true);

        // Bottom/top corner clearance notches
        _bottom_notch_z = -total_height/2 + corner_clearance/2;
        _top_notch_z = total_height/2;

        // Left ear bottom and top
        for(_z = [_bottom_notch_z, _top_notch_z])
          translate([(-panel_width + BASE_UNIT)/2 + _connector_notch_width + corner_clearance - 0.3, _flange_center_y, _z])
            cube([_corner_cut_width, _corner_cut_depth, corner_clearance], center=true);

        // Right ear bottom and top (only for full-width panels)
        if(rackmount_type == RACKMOUNT_FULL)
          for(_z = [_bottom_notch_z, _top_notch_z])
            translate([(panel_width - BASE_UNIT)/2 - _connector_notch_width/2 - corner_clearance/2, _flange_center_y, _z])
              cube([_corner_cut_width, _corner_cut_depth, corner_clearance], center=true);
      }
    }
    children();
  }
}

module device_cutouts(variant, flush_to_bottom, device_width_effective, device_height_effective, bracket_strength_sides, flange_depth,
  chamfer_toggle=false,
  anchor=CENTER, spin=0, orient=BACK) {

  chamfer_edges = concat(
    [TOP+FRONT,TOP+LEFT,TOP+RIGHT],
    variant == VARIANT_TRAY && !flush_to_bottom ? [] : [TOP+BACK],
    variant != VARIANT_TRAY ? [BOTTOM+FRONT,BOTTOM+LEFT,BOTTOM+RIGHT,BOTTOM+BACK] : []
  );

  cutout_chamfer = chamfer_toggle ? -BASE_CHAMFER : 0;
  cutout_depth = flange_depth + EPSILON*2;
  bracket_strength_sides_max = device_height_effective - BASE_STRENGTH;
  bracket_strength_sides_effective = min(bracket_strength_sides, bracket_strength_sides_max) + TOLERANCE;

  bracket_width = device_width_effective + BASE_STRENGTH*2 + TOLERANCE;

  attachable_width = bracket_strength_sides_effective > 0 ? bracket_width : device_width_effective;
  attachable_height = device_height_effective + (bracket_strength_sides_effective > 0 ? BASE_STRENGTH : 0);

  bracket_height_addition = BASE_STRENGTH;
  attachable(CENTER, spin, orient, size=[attachable_width, attachable_height, cutout_depth]){
    back(bracket_strength_sides > 0 ? bracket_height_addition/2 : 0)
    cuboid([device_width_effective, device_height_effective, cutout_depth], chamfer=cutout_chamfer, edges=chamfer_edges) {
      if (bracket_strength_sides > 0) {
        color(HR_RED)
        attach(FRONT, FRONT, inside=true, overlap=bracket_height_addition)
        cuboid([bracket_width, bracket_strength_sides_effective + BASE_STRENGTH, cutout_depth], chamfer=bracket_strength_sides_effective > 0 ? cutout_chamfer : 0, edges=chamfer_edges);
      }
    }
    children();
  }
}

module tray(width, depth, height, tray_wall_strength) {
  tray_width = width;
  tray_depth = depth + TOLERANCE + tray_wall_strength;
  tray_height = BASE_UNIT;
  stabilizer_height = height - tray_height;
  stabilizer_side_length = min(stabilizer_height, tray_depth);
  hex_spacing = BASE_UNIT/2;
  hex_strut = BASE_STRENGTH;
  hex_frame = BASE_STRENGTH;

  bottom_hex_frame = (min(width,depth)<BASE_UNIT*3 ? BASE_STRENGTH : (BASE_UNIT));
  wall_thickness = tray_wall_strength;
  stabilizer_dimensions = [[0, 0], [0, stabilizer_side_length], [stabilizer_side_length, 0]];
  wedge_height = tray_height-wall_thickness;
  stopper_wedge = [wall_thickness, tray_height, wedge_height];
  wedge_chamfer = BASE_STRENGTH - PRINTING_LAYER_HEIGHT;

  hex_panel([tray_width, tray_depth, wall_thickness], hex_strut, hex_spacing, frame = bottom_hex_frame, bevel = [LEFT,RIGHT])
  {

    align(TOP, BACK+LEFT) tag_scope("tray") diff() wedge(stopper_wedge, spin=-90)
    attach("hypot_right", LEFT+FWD, overlap=wedge_chamfer*sqrt(2))
    chamfer_edge_mask(l=BASE_UNIT * sqrt(2), chamfer=wedge_chamfer);
    ;
    align(TOP, BACK+RIGHT) tag_scope("tray") diff() wedge(stopper_wedge, spin=90)
    attach("hypot_left", LEFT+FWD, overlap=wedge_chamfer*sqrt(2))
    chamfer_edge_mask(l=BASE_UNIT * sqrt(2), chamfer=wedge_chamfer);
    ;
    attach(RIGHT,LEFT) hex_panel([tray_height, tray_depth, wall_thickness], hex_strut, hex_spacing, frame = hex_frame, bevel = [LEFT]){
      if(height>BASE_UNIT*2) attach(RIGHT, LEFT, align=FWD) hex_panel(stabilizer_dimensions, strut=hex_strut, spacing=hex_spacing, h = wall_thickness, frame = hex_frame);
    }
    attach(LEFT,LEFT) hex_panel([tray_height, tray_depth, wall_thickness], hex_strut, hex_spacing, frame = hex_frame, bevel = [LEFT]){
      if(height>BASE_UNIT*2) mirror([0,1,0]) attach(RIGHT, LEFT, align=FWD) hex_panel(stabilizer_dimensions, strut=hex_strut, spacing=hex_spacing, h = wall_thickness, frame = hex_frame);
    }
  }
}

module frontpanel(variant, standard, split_frontpanel=false,
  device_width, device_depth, device_height,
  flush_to_top=false, flush_to_bottom=false, bracket_strength_sides=0,
  flange_depth=BASE_STRENGTH, lightweight_tray=false,
  chamfer_toggle=true, debug_colors=false,
  view_mode=VIEW_ASSEMBLY,
  anchor=CENTER) {

  assert(variant >= 1 && variant <= 3, "variant must be 1 (Bracket), 2 (Tray), 3 (Bracket only)");
  assert(standard >= 1 && standard <= 3, "standard must be 1 (10 inch), 2 (19 inch), or 3 (Custom)");
  assert(device_width >= 15 && device_width <= 390, "device_width must be between 15 and 390mm");
  assert(device_depth >= 30 && device_depth <= 400, "device_depth must be between 30 and 400mm");
  assert(device_height >= 11 && device_height <= 250, "device_height must be between 11 and 250mm");
  assert(bracket_strength_sides >= 0 && bracket_strength_sides <= 50, "bracket_strength_sides must be between 0 and 50mm");
  assert(flange_depth >= 12 && flange_depth <= 30, "flange_depth must be between 12 and 30mm");
  assert(view_mode >= 0 && view_mode <= 6, "view_mode must be between 0 and 6");

  flush_to_bottom = variant == VARIANT_BRACKET ? true : flush_to_bottom;
  bracket_strength_sides = variant == VARIANT_TRAY ? 0 : bracket_strength_sides;
  flange_depth = variant == VARIANT_TRAY ? BASE_UNIT : flange_depth;

  tray_wall_strength = BASE_STRENGTH + get_wall_thickness_increase(variant, device_depth, lightweight_tray);
  tray_height_addition = variant == VARIANT_TRAY ? BASE_STRENGTH : 0;

  bracket_height_addition = bracket_strength_sides > 0 ? BASE_STRENGTH + TOLERANCE/2 : 0;

  required_height = device_height + TOLERANCE + tray_wall_strength*2 - BASE_STRENGTH + bracket_height_addition + tray_height_addition;
  height_units = ceil(required_height / STD_UNIT_HEIGHT);

  device_width_effective = device_width + TOLERANCE;
  device_height_effective = device_height + TOLERANCE;

  flange_addition = (tray_wall_strength)*2 + TOLERANCE;
  bracket_addition = get_bracket_addition(bracket_strength_sides);
  split_addition = get_split_addition(split_frontpanel, bracket_strength_sides);

  panel_width = get_panel_width(standard, device_width, flange_addition, bracket_addition, split_addition, split_frontpanel, custom_panel_width);
  panel_width_center = device_width + flange_addition + split_addition + bracket_addition;
  panel_width_ear = (panel_width - panel_width_center)/2 - TOLERANCE/2;

  panel_extension_height_bottom = get_panel_extension_height_bottom(flush_to_bottom);
  panel_extension_height_top = get_panel_extension_height_top(height_units, flush_to_top);

  flange_width_gross = device_width_effective + tray_wall_strength*2 + (bracket_strength_sides > 0 ? BASE_STRENGTH*2 : 0);
  flange_height_gross = device_height_effective + tray_wall_strength*2 + (bracket_strength_sides > 0 ? BASE_STRENGTH : 0);

  if(split_frontpanel) {

    if(view_mode == VIEW_ASSEMBLY){
      tag_scope("frontpanel_assembly") diff()
      rackmount(panel_width_center, panel_extension_height_bottom, panel_extension_height_top, height_units, RACKMOUNT_CENTER, color=debug_colors ? HR_WHITE : PANEL_SECONDARY_COLOR, debug_colors=debug_colors, anchor=anchor) {

        align(BACK, BOTTOM, inset=get_flange_inset(variant, flush_to_bottom, height_units, flush_to_top)) {
          color_this(debug_colors ? HR_GREEN : PANEL_SECONDARY_COLOR)
          cuboid([flange_width_gross, flange_depth, flange_height_gross]) {
            if(variant == VARIANT_TRAY) align(BACK,BOTTOM) color(debug_colors ? HR_RED : PANEL_SECONDARY_COLOR) tray(flange_width_gross, device_depth-flange_depth-BASE_STRENGTH, flange_height_gross, tray_wall_strength);
            tag("remove")
            attach(FRONT, TOP, spin=180, inside=true, overlap=BASE_STRENGTH, shiftout=EPSILON)
              color_this(debug_colors ? HR_BLUE : PANEL_SECONDARY_COLOR)
              device_cutouts(variant, flush_to_bottom, device_width_effective, device_height_effective, bracket_strength_sides, flange_depth + BASE_STRENGTH, chamfer_toggle);
          }
        }

        if(chamfer_toggle) color(debug_colors ? HR_RED : PANEL_SECONDARY_COLOR) tag("remove") edge_mask(FRONT) chamfer_edge_mask(chamfer=BASE_CHAMFER);

        attach(LEFT, RIGHT, overlap=-TOLERANCE/2) rackmount(panel_width_ear, panel_extension_height_bottom, panel_extension_height_top, height_units, RACKMOUNT_SIDE, debug_colors=debug_colors){
          if(chamfer_toggle) color(debug_colors ? HR_RED : PANEL_PRIMARY_COLOR) tag("remove") edge_mask(FRONT) chamfer_edge_mask(chamfer=BASE_CHAMFER);
        }

        attach(RIGHT, RIGHT, overlap=-TOLERANCE/2) mirror([1,0,0]) rackmount(panel_width_ear, panel_extension_height_bottom, panel_extension_height_top, height_units, RACKMOUNT_SIDE, debug_colors=debug_colors){
          if(chamfer_toggle) color(debug_colors ? HR_RED : PANEL_PRIMARY_COLOR) tag("remove") edge_mask(FRONT) chamfer_edge_mask(chamfer=BASE_CHAMFER);
        }
      }
    } else if(view_mode == VIEW_PLATE_SPLIT_CENTER) {
      xrot(90)
      tag_scope("frontpanel_assembly") diff()
      rackmount(panel_width_center, panel_extension_height_bottom, panel_extension_height_top, height_units, RACKMOUNT_CENTER, color=debug_colors ? HR_WHITE : PANEL_SECONDARY_COLOR, debug_colors=debug_colors) {

        align(BACK, BOTTOM, inset=get_flange_inset(variant, flush_to_bottom, height_units, flush_to_top)) {
          color_this(debug_colors ? HR_GREEN : PANEL_SECONDARY_COLOR)
          cuboid([flange_width_gross, flange_depth, flange_height_gross]) {
            if(variant == VARIANT_TRAY) align(BACK,BOTTOM) color(debug_colors ? HR_RED : PANEL_SECONDARY_COLOR) tray(flange_width_gross, device_depth-flange_depth-BASE_STRENGTH, flange_height_gross, tray_wall_strength);
            tag("remove")
            attach(FRONT, TOP, spin=180, inside=true, overlap=BASE_STRENGTH, shiftout=EPSILON)
              color_this(debug_colors ? HR_BLUE : PANEL_SECONDARY_COLOR)
              device_cutouts(variant, flush_to_bottom, device_width_effective, device_height_effective, bracket_strength_sides, flange_depth + BASE_STRENGTH, chamfer_toggle);
          }
        }
      }
    } else if(view_mode == VIEW_PLATE_SPLIT_SIDES) {

      connector_offset = (BASE_UNIT + BASE_STRENGTH + TOLERANCE)*2+TOLERANCE;

      tag_scope("frontpanel_assembly") diff()
      rackmount(panel_width_ear, panel_extension_height_bottom, panel_extension_height_top, height_units, RACKMOUNT_SIDE, debug_colors=debug_colors, anchor=BOTTOM) {
        if(chamfer_toggle) color(debug_colors ? HR_RED : PANEL_PRIMARY_COLOR) tag("remove") edge_mask(FRONT) chamfer_edge_mask(chamfer=BASE_CHAMFER);
        mirror([1,0,0]) attach(LEFT,RIGHT, overlap=connector_offset*-1) rackmount(panel_width_ear, panel_extension_height_bottom, panel_extension_height_top, height_units, RACKMOUNT_SIDE, debug_colors=debug_colors){
          if(chamfer_toggle) color(debug_colors ? HR_RED : PANEL_PRIMARY_COLOR) tag("remove") edge_mask(FRONT) chamfer_edge_mask(chamfer=BASE_CHAMFER);
        }
      }

    } else if(view_mode == VIEW_PLATE_SPLIT_LEFT) {

      xrot(90)
      tag_scope("frontpanel_assembly") diff()
      rackmount(panel_width_ear, panel_extension_height_bottom, panel_extension_height_top, height_units, RACKMOUNT_SIDE, debug_colors=debug_colors) {
        if(chamfer_toggle) color(debug_colors ? HR_RED : PANEL_PRIMARY_COLOR) tag("remove") edge_mask(FRONT) chamfer_edge_mask(chamfer=BASE_CHAMFER);
      }

    } else if(view_mode == VIEW_PLATE_SPLIT_RIGHT) {

      xrot(90)
      mirror([1,0,0])
      tag_scope("frontpanel_assembly") diff()
      rackmount(panel_width_ear, panel_extension_height_bottom, panel_extension_height_top, height_units, RACKMOUNT_SIDE, debug_colors=debug_colors) {
        if(chamfer_toggle) color(debug_colors ? HR_RED : PANEL_PRIMARY_COLOR) tag("remove") edge_mask(FRONT) chamfer_edge_mask(chamfer=BASE_CHAMFER);
      }
    }

  } else if(view_mode != VIEW_PLATE_SPLIT_CENTER && view_mode != VIEW_PLATE_SPLIT_SIDES && view_mode != VIEW_PLATE_SPLIT_LEFT && view_mode != VIEW_PLATE_SPLIT_RIGHT) {

    xrot(view_mode == VIEW_PLATE_SINGLE ? 90 : 0)
    tag_scope("frontpanel_assembly") diff()
    rackmount(panel_width, panel_extension_height_bottom, panel_extension_height_top, height_units, RACKMOUNT_FULL, debug_colors=debug_colors, anchor=anchor) {

      align(BACK, BOTTOM, inset=get_flange_inset(variant, flush_to_bottom, height_units, flush_to_top)) {
        color_this(debug_colors ? HR_GREEN : PANEL_SECONDARY_COLOR)
        cuboid([flange_width_gross, flange_depth, flange_height_gross]) {
          if(variant == VARIANT_TRAY) align(BACK,BOTTOM) color(debug_colors ? HR_RED : PANEL_PRIMARY_COLOR) tray(flange_width_gross, device_depth-flange_depth-BASE_STRENGTH, flange_height_gross, tray_wall_strength);
          tag("remove")
          attach(FRONT, TOP, spin=180, inside=true, overlap=BASE_STRENGTH, shiftout=EPSILON)
            color_this(debug_colors ? HR_BLUE : PANEL_PRIMARY_COLOR)
            device_cutouts(variant, flush_to_bottom, device_width_effective, device_height_effective, bracket_strength_sides, flange_depth + BASE_STRENGTH, chamfer_toggle);
        }
      }

      if(chamfer_toggle) color(debug_colors ? HR_RED : PANEL_PRIMARY_COLOR) tag("remove") edge_mask(FRONT) chamfer_edge_mask(chamfer=BASE_CHAMFER);
    }
  }
}

MOUNT_VAR_REGULAR = 1;
MOUNT_VAR_RACKMOUNT = 2;
MOUNT_DEPTH = BASE_UNIT + BASE_STRENGTH*2 + TOLERANCE;
LOCKPIN_EDGE_OFFSET = 5.5;
module device(width, depth, height) {

    color(HR_WHITE)
    cube([width, depth, height], center=true);
}

module bracket(device_width, device_depth, device_height, strength_top, strength_sides, bracket_depth) {

    strength_sides = strength_sides > device_height ? device_height : strength_sides;
    strength_top_limiter = (device_depth<device_width ? device_depth : device_width)/2;
    strength_top = strength_top > strength_top_limiter ? strength_top_limiter : strength_top;

    bracket_width = device_width + BASE_STRENGTH*2;
    bracket_height = strength_sides + BASE_STRENGTH;
    bracket_translate_z = (device_height/2) - (bracket_height/2) + BASE_STRENGTH;

    cutout_width = device_width - strength_top*2;
    cutout_depth = device_depth - strength_top*2;

    difference() {

      color(HR_YELLOW)
      translate([0,0,bracket_translate_z])
      cuboid([bracket_width, bracket_depth, bracket_height], chamfer=BASE_CHAMFER);

      device(device_width, device_depth, device_height);

      cutout_chamfer = strength_top == strength_top_limiter ? 0 : -BASE_CHAMFER;
      color(HR_RED)
      translate([0,0,bracket_translate_z])
      cuboid([cutout_width, cutout_depth, bracket_height], chamfer=cutout_chamfer);
    }
}

module mount(device_width, device_height) {

  excess = (device_width % BASE_UNIT);
  offset = (BASE_UNIT - excess)/2;

  mount_width = BASE_UNIT + offset;

  mount_translate_z = (BASE_STRENGTH - TOLERANCE/2 - BASE_CHAMFER)/2;
  mount_height = device_height + BASE_STRENGTH + TOLERANCE/2 - BASE_CHAMFER;

  bridge_cutout_width = mount_width - BASE_STRENGTH;
  bridge_height = mount_height-BASE_CHAMFER;

  translate([-(device_width/2) - (mount_width/2), 0, mount_translate_z])
  union() {

    difference(){
      color(HR_RED)
      translate([0, 0, BASE_STRENGTH-BASE_CHAMFER/2])

      cuboid([bridge_cutout_width+BASE_STRENGTH, MOUNT_DEPTH,bridge_height],chamfer=BASE_CHAMFER,except=BOTTOM);

      color(HR_GREEN)
      translate([-BASE_STRENGTH/2, 0, BASE_CHAMFER/2])
      cuboid([bridge_cutout_width,BASE_UNIT,bridge_height-BASE_STRENGTH],chamfer=BASE_UNIT/2,edges=[FRONT+BOTTOM,BACK+BOTTOM]);
    }

    difference() {
      flap_height = BASE_UNIT;

      union() {

        flap_width = mount_width;
        flap_depth = BASE_STRENGTH;

        flap_dimensions = [flap_width, flap_depth, flap_height];

        color(HR_BLUE)
        translate([0,MOUNT_DEPTH/2 - flap_depth/2,-mount_height/2 - flap_height/2])
        cuboid(flap_dimensions, chamfer=BASE_CHAMFER,edges=BACK,except=TOP);
        color(HR_BLUE)
        translate([0,-MOUNT_DEPTH/2 + flap_depth/2,-mount_height/2 - flap_height/2])
        cuboid(flap_dimensions, chamfer=BASE_CHAMFER,edges=FRONT,except=TOP);

        top_width = mount_width;
        top_depth = MOUNT_DEPTH;
        top_height = BASE_STRENGTH;
        top_dimensions = [top_width, top_depth, top_height];
        color(HR_BLUE)
        translate([0,0,-mount_height/2+BASE_STRENGTH/2])
        cuboid(top_dimensions, chamfer=BASE_CHAMFER,edges=[FRONT,BACK],except=[TOP,BOTTOM]);
      }

      lockpin_hole_dimensions = [lockpin_hole_side_length, lockpin_hole_side_length, MOUNT_DEPTH];
      color(HR_WHITE)
      translate([-mount_width/2+lockpin_hole_side_length/2+LOCKPIN_EDGE_OFFSET,0,-mount_height/2 - flap_height/2])
      rotate([90,0,0])
      cuboid(lockpin_hole_dimensions, chamfer=-lockpin_hole_chamfer);
    }
  }
}

module mount_pair(device_width, device_height) {

  mount(device_width, device_height);

  mirror([1,0,0])
  mount(device_width, device_height);
}

module bracket_assembly(device_width, device_depth, device_height,
  bracket_strength_top, bracket_strength_sides,
  mounting_variant=MOUNT_VAR_REGULAR, force_single_mount_column=false,
  anchor=CENTER, spin=0, orient=UP,
  view_mode=VIEW_ASSEMBLY
  ) {

  effective_width = device_width + TOLERANCE;
  effective_depth = device_depth + TOLERANCE;
  bracket_depth = effective_depth + BASE_STRENGTH*2;

  bracket_strength_sides = min(bracket_strength_sides, device_height-BASE_STRENGTH);

  attachable_width= effective_width + BASE_STRENGTH*2;
  attachable_height = bracket_strength_sides + BASE_STRENGTH;

  translation_bracket_view = view_mode == VIEW_PLATE_BRACKET ? device_height+BASE_STRENGTH+BASE_UNIT : 0;
  if(view_mode == VIEW_ASSEMBLY || view_mode == VIEW_PLATE_BRACKET)
  down(translation_bracket_view)
  attachable(anchor=anchor, spin=spin, orient=view_mode == VIEW_PLATE_BRACKET ? DOWN : orient, size=[attachable_width, bracket_depth, attachable_height]) {
    down((device_height+BASE_STRENGTH-bracket_strength_sides)/2)
    union(){
      bracket(effective_width, effective_depth, device_height, bracket_strength_top, bracket_strength_sides, bracket_depth);

      offset_base_value = BASE_UNIT*2 + BASE_STRENGTH*2;
      min_depth_any_rckmnt = BASE_UNIT + offset_base_value;
      min_depth_rckmnt_dblcol = BASE_UNIT*3 + offset_base_value;

      effective_variant = device_depth < min_depth_any_rckmnt ? MOUNT_VAR_REGULAR : mounting_variant;
      mount_column_count = force_single_mount_column ? 1 : (device_depth < min_depth_any_rckmnt ? 1
                        : (effective_variant != VARIANT_BRACKET && device_depth < min_depth_rckmnt_dblcol) ? 1
                        : 2);

      rackmount_offset = effective_variant != MOUNT_VAR_REGULAR ? offset_base_value : 0;
      spacing_y = mount_column_count > 1 ? floor((bracket_depth - rackmount_offset - BASE_UNIT - BASE_STRENGTH*2 - TOLERANCE) / BASE_UNIT) * BASE_UNIT : 0;
      translation_y = effective_variant != MOUNT_VAR_REGULAR ? (-bracket_depth + spacing_y + MOUNT_DEPTH)/2 + rackmount_offset : 0;

      if(device_depth < min_depth_any_rckmnt) {
        echo("Device depth too small for Rackmount variants or double mount columns, defaulting to Regular mounting.");
      }
      if(effective_variant != MOUNT_VAR_REGULAR && device_depth < min_depth_rckmnt_dblcol) {
        echo("Device depth too small for double mount columns when using Rackmount variants, defaulting to single column.");
      }

      translate([0,translation_y,0])
      ycopies(spacing = spacing_y, n = mount_column_count)
      mount_pair(effective_width, device_height);
    }
    children();
  }
}
$fn=100;
EPSILON = 0.01; // small value to avoid scad weirdness

module mw_assembly_view() {
  if(variant != VARIANT_BRACKET_ONLY) {
    bracket_color = split_frontpanel ? HR_YELLOW : HR_CHARCOAL;
    effective_variant = device_depth < 49 ? VARIANT_TRAY : variant;

    _split_view = split_frontpanel && split_export == 1 ? VIEW_PLATE_SPLIT_CENTER
                : split_frontpanel && split_export == 2 ? VIEW_PLATE_SPLIT_LEFT
                : split_frontpanel && split_export == 3 ? VIEW_PLATE_SPLIT_RIGHT
                : VIEW_ASSEMBLY;

    frontpanel(effective_variant, standard, split_frontpanel,
      device_width, device_depth, device_height,
      flush_to_top, flush_to_bottom, bracket_strength_sides,
      flange_depth, lightweight_tray,
      chamfer_toggle=true, debug_colors=false,
      _split_view, anchor=_split_view == VIEW_ASSEMBLY ? FRONT+BOTTOM : CENTER){
      }
    if(effective_variant == VARIANT_BRACKET)
      color(bracket_color)
      up(get_bracket_translation_z(device_height)) bracket_assembly(device_width, device_depth, device_height,
        bracket_strength_top, bracket_strength_sides,
        MOUNT_VAR_RACKMOUNT, force_single_mount_column, anchor=FRONT+TOP,
        view_mode=VIEW_ASSEMBLY);

  } else {
    color(HR_YELLOW)
    bracket_assembly(device_width, device_depth, device_height,
      bracket_strength_top, bracket_strength_sides,
      MOUNT_VAR_REGULAR, force_single_mount_column,
      view_mode=VIEW_ASSEMBLY, anchor=BOTTOM);
  }
}


module mw_plate_1() {
  if(variant != VARIANT_BRACKET_ONLY){
    if(split_frontpanel)
      frontpanel(variant, standard, split_frontpanel,
      device_width, device_depth, device_height,
      flush_to_top, flush_to_bottom, bracket_strength_sides,
      flange_depth, lightweight_tray,
      chamfer_toggle=true, debug_colors=false, VIEW_PLATE_SPLIT_CENTER);
    else
      frontpanel(variant, standard, split_frontpanel,
      device_width, device_depth, device_height,
      flush_to_top, flush_to_bottom, bracket_strength_sides,
      flange_depth, lightweight_tray, chamfer_toggle=true, debug_colors=false, VIEW_PLATE_SINGLE);
  }
}


module mw_plate_2() {
  if(split_frontpanel)
    frontpanel(variant, standard, split_frontpanel,
    device_width, device_depth, device_height,
    flush_to_top, flush_to_bottom, bracket_strength_sides,
    flange_depth, lightweight_tray, chamfer_toggle=true, debug_colors=false, VIEW_PLATE_SPLIT_SIDES);
}


module mw_plate_3() {
  if(variant == VARIANT_BRACKET || variant == VARIANT_BRACKET_ONLY) {
    color(HR_YELLOW)
    bracket_assembly(device_width, device_depth, device_height,
    bracket_strength_top, bracket_strength_sides,
    variant == VARIANT_BRACKET_ONLY ? MOUNT_VAR_REGULAR : MOUNT_VAR_RACKMOUNT,
    force_single_mount_column,
    view_mode=VIEW_PLATE_BRACKET);
  }
}

mw_assembly_view();
