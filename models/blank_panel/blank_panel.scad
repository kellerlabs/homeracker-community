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

/* [Cutouts] */
// Enable lock pin holes on all edges
cutouts = true;
// Notch corners to fit around HomeRacker connectors
connector_notch = true;

/* [Hidden] */
$fn = 100;
EPSILON = 0.01;

// Panel dimensions
panel_width = width_units * BASE_UNIT;
panel_height = height_units * BASE_UNIT;

// Number of pin holes per edge
_n_top = width_units;
_n_side = height_units;

module blank_panel() {
  difference() {
    // Panel slab
    color(HR_RED)
    cuboid([panel_width, panel_thickness, panel_height],
           chamfer=min(BASE_CHAMFER, panel_thickness/2 - EPSILON));

    if(cutouts) {
      // Top edge lock pin holes
      translate([0, 0, panel_height / 2 - BASE_UNIT / 2])
        xcopies(spacing=BASE_UNIT, n=_n_top)
          xrot(90) lock_pin_hole();

      // Bottom edge lock pin holes
      translate([0, 0, -panel_height / 2 + BASE_UNIT / 2])
        xcopies(spacing=BASE_UNIT, n=_n_top)
          xrot(90) lock_pin_hole();

      // Left edge lock pin holes
      translate([-panel_width / 2 + BASE_UNIT / 2, 0, 0])
        zcopies(spacing=BASE_UNIT, n=_n_side)
          xrot(90) lock_pin_hole();

      // Right edge lock pin holes
      translate([panel_width / 2 - BASE_UNIT / 2, 0, 0])
        zcopies(spacing=BASE_UNIT, n=_n_side)
          xrot(90) lock_pin_hole();
    }

    // Corner notches for HomeRacker connectors
    if(connector_notch) {
      _notch_size = [BASE_UNIT + 3, panel_thickness + EPSILON*2, BASE_UNIT + 3];
      // Top-left
      translate([-panel_width/2 + BASE_UNIT/2, 0, panel_height/2 - BASE_UNIT/2])
        cuboid(_notch_size);
      // Top-right
      translate([panel_width/2 - BASE_UNIT/2, 0, panel_height/2 - BASE_UNIT/2])
        cuboid(_notch_size);
      // Bottom-left
      translate([-panel_width/2 + BASE_UNIT/2, 0, -panel_height/2 + BASE_UNIT/2])
        cuboid(_notch_size);
      // Bottom-right
      translate([panel_width/2 - BASE_UNIT/2, 0, -panel_height/2 + BASE_UNIT/2])
        cuboid(_notch_size);
    }
  }
}

blank_panel();
