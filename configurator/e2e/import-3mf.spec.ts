import { test, expect, waitForBOM } from "./fixtures";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Build a minimal valid 3MF file (a ZIP archive) containing a 10x10x10mm cube.
 * Returns an ArrayBuffer suitable for passing to the browser via page.evaluate().
 */
function createMinimal3MF(): Uint8Array {
  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="10" y="0" z="0"/>
          <vertex x="10" y="10" z="0"/>
          <vertex x="0" y="10" z="0"/>
          <vertex x="0" y="0" z="10"/>
          <vertex x="10" y="0" z="10"/>
          <vertex x="10" y="10" z="10"/>
          <vertex x="0" y="10" z="10"/>
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2"/>
          <triangle v1="0" v2="2" v3="3"/>
          <triangle v1="4" v2="6" v3="5"/>
          <triangle v1="4" v2="7" v3="6"/>
          <triangle v1="0" v2="4" v3="5"/>
          <triangle v1="0" v2="5" v3="1"/>
          <triangle v1="1" v2="5" v3="6"/>
          <triangle v1="1" v2="6" v3="2"/>
          <triangle v1="2" v2="6" v3="7"/>
          <triangle v1="2" v2="7" v3="3"/>
          <triangle v1="3" v2="7" v3="4"/>
          <triangle v1="3" v2="4" v3="0"/>
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1"/>
  </build>
</model>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

  // Build a ZIP archive with STORE (no compression) method
  const files: { name: string; data: Uint8Array }[] = [
    { name: "_rels/.rels", data: new TextEncoder().encode(relsXml) },
    { name: "3D/3dmodel.model", data: new TextEncoder().encode(modelXml) },
    { name: "[Content_Types].xml", data: new TextEncoder().encode(contentTypesXml) },
  ];

  return buildZipStore(files);
}

/**
 * Build a multi-model 3MF (BambuStudio production extension style).
 * The root model has composite objects referencing meshes in separate .model files
 * via p:path attributes. This pattern crashes Three.js's ThreeMFLoader.
 */
function createMultiModel3MF(): Uint8Array {
  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

  // Root model: composite objects referencing external .model files
  const rootModelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
       xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">
  <resources>
    <object id="2" type="model">
      <components>
        <component p:path="/3D/Objects/part_a.model" objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
      </components>
    </object>
    <object id="4" type="model">
      <components>
        <component p:path="/3D/Objects/part_b.model" objectid="3" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
      </components>
    </object>
  </resources>
  <build>
    <item objectid="2"/>
    <item objectid="4"/>
  </build>
</model>`;

  // External model A: a small cube at origin
  const partAXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/><vertex x="10" y="0" z="0"/>
          <vertex x="10" y="10" z="0"/><vertex x="0" y="10" z="0"/>
          <vertex x="0" y="0" z="10"/><vertex x="10" y="0" z="10"/>
          <vertex x="10" y="10" z="10"/><vertex x="0" y="10" z="10"/>
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2"/><triangle v1="0" v2="2" v3="3"/>
          <triangle v1="4" v2="6" v3="5"/><triangle v1="4" v2="7" v3="6"/>
          <triangle v1="0" v2="4" v3="5"/><triangle v1="0" v2="5" v3="1"/>
          <triangle v1="1" v2="5" v3="6"/><triangle v1="1" v2="6" v3="2"/>
          <triangle v1="2" v2="6" v3="7"/><triangle v1="2" v2="7" v3="3"/>
          <triangle v1="3" v2="7" v3="4"/><triangle v1="3" v2="4" v3="0"/>
        </triangles>
      </mesh>
    </object>
  </resources>
  <build/>
</model>`;

  // External model B: a wider box
  const partBXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="3" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/><vertex x="20" y="0" z="0"/>
          <vertex x="20" y="5" z="0"/><vertex x="0" y="5" z="0"/>
          <vertex x="0" y="0" z="10"/><vertex x="20" y="0" z="10"/>
          <vertex x="20" y="5" z="10"/><vertex x="0" y="5" z="10"/>
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2"/><triangle v1="0" v2="2" v3="3"/>
          <triangle v1="4" v2="6" v3="5"/><triangle v1="4" v2="7" v3="6"/>
          <triangle v1="0" v2="4" v3="5"/><triangle v1="0" v2="5" v3="1"/>
          <triangle v1="1" v2="5" v3="6"/><triangle v1="1" v2="6" v3="2"/>
          <triangle v1="2" v2="6" v3="7"/><triangle v1="2" v2="7" v3="3"/>
          <triangle v1="3" v2="7" v3="4"/><triangle v1="3" v2="4" v3="0"/>
        </triangles>
      </mesh>
    </object>
  </resources>
  <build/>
</model>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

  return buildZipStore([
    { name: "_rels/.rels", data: new TextEncoder().encode(relsXml) },
    { name: "3D/3dmodel.model", data: new TextEncoder().encode(rootModelXml) },
    { name: "3D/Objects/part_a.model", data: new TextEncoder().encode(partAXml) },
    { name: "3D/Objects/part_b.model", data: new TextEncoder().encode(partBXml) },
    { name: "[Content_Types].xml", data: new TextEncoder().encode(contentTypesXml) },
  ]);
}

/** Build a ZIP archive with STORE (no compression) for simplicity. */
function buildZipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const centralEntries: Uint8Array[] = [];
  const localEntries: Uint8Array[] = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBytes = new TextEncoder().encode(name);

    // Local file header (30 bytes + name + data)
    const local = new ArrayBuffer(30 + nameBytes.length + data.length);
    const lv = new DataView(local);
    lv.setUint32(0, 0x04034b50, true);   // signature
    lv.setUint16(4, 20, true);            // version needed
    lv.setUint16(6, 0, true);             // flags
    lv.setUint16(8, 0, true);             // compression: STORE
    lv.setUint16(10, 0, true);            // mod time
    lv.setUint16(12, 0, true);            // mod date
    lv.setUint32(14, crc32(data), true);  // CRC-32
    lv.setUint32(18, data.length, true);  // compressed size
    lv.setUint32(22, data.length, true);  // uncompressed size
    lv.setUint16(26, nameBytes.length, true); // name length
    lv.setUint16(28, 0, true);            // extra length
    new Uint8Array(local).set(nameBytes, 30);
    new Uint8Array(local).set(data, 30 + nameBytes.length);
    localEntries.push(new Uint8Array(local));

    // Central directory header (46 bytes + name)
    const central = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(central);
    cv.setUint32(0, 0x02014b50, true);   // signature
    cv.setUint16(4, 20, true);            // version made by
    cv.setUint16(6, 20, true);            // version needed
    cv.setUint16(8, 0, true);             // flags
    cv.setUint16(10, 0, true);            // compression: STORE
    cv.setUint16(12, 0, true);            // mod time
    cv.setUint16(14, 0, true);            // mod date
    cv.setUint32(16, crc32(data), true);  // CRC-32
    cv.setUint32(20, data.length, true);  // compressed size
    cv.setUint32(24, data.length, true);  // uncompressed size
    cv.setUint16(28, nameBytes.length, true); // name length
    cv.setUint16(30, 0, true);            // extra length
    cv.setUint16(32, 0, true);            // comment length
    cv.setUint16(34, 0, true);            // disk number start
    cv.setUint16(36, 0, true);            // internal file attributes
    cv.setUint32(38, 0, true);            // external file attributes
    cv.setUint32(42, offset, true);       // relative offset of local header
    new Uint8Array(central).set(nameBytes, 46);
    centralEntries.push(new Uint8Array(central));

    offset += 30 + nameBytes.length + data.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const c of centralEntries) centralDirSize += c.length;

  // End of central directory (22 bytes)
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);   // signature
  ev.setUint16(4, 0, true);             // disk number
  ev.setUint16(6, 0, true);             // disk with central dir
  ev.setUint16(8, files.length, true);  // entries on this disk
  ev.setUint16(10, files.length, true); // total entries
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, centralDirOffset, true);
  ev.setUint16(20, 0, true);            // comment length

  const totalSize = offset + centralDirSize + 22;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const l of localEntries) { result.set(l, pos); pos += l.length; }
  for (const c of centralEntries) { result.set(c, pos); pos += c.length; }
  result.set(new Uint8Array(eocd), pos);

  return result;
}

/** Simple CRC-32 for ZIP entries. */
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

test.describe("3MF import", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await page.evaluate(() => (window as any).__assembly.clear());
  });

  test("import a single-object 3MF and place it", async ({ appPage: page }) => {
    const zipBytes = createMinimal3MF();

    const result = await page.evaluate(async (bytes: number[]) => {
      const buffer = new Uint8Array(bytes).buffer;
      const file = new File([buffer], "test-cube.3mf");
      const defs = await (window as any).__importModel(file);
      return defs.map((d: any) => d.id as string);
    }, Array.from(zipBytes));

    expect(result).toHaveLength(1);
    expect(result[0]).toContain("custom-3mf-");

    // Place the imported 3MF part
    const placed = await page.evaluate(
      (id: string) => (window as any).__assembly.addPart(id, [0, 0, 0]),
      result[0],
    );
    expect(placed).not.toBeNull();

    // Verify it appears in the BOM
    await waitForBOM(page, 1);
    const bom = await page.evaluate(() => {
      const rows = document.querySelectorAll(".bom-table tbody tr");
      return Array.from(rows).map((row) => ({
        name: row.querySelector("td:first-child")?.textContent?.trim() ?? "",
      }));
    });
    expect(bom.some((r) => r.name.includes("test-cube"))).toBe(true);
  });

  test("import a multi-model 3MF (production extension) as separate parts", async ({
    appPage: page,
  }) => {
    // Simulates BambuStudio-style 3MF with meshes in separate .model files
    // referenced via p:path (3MF production extension).
    const zipBytes = createMultiModel3MF();

    const result = await page.evaluate(async (bytes: number[]) => {
      const buffer = new Uint8Array(bytes).buffer;
      const file = new File([buffer], "multi-part.3mf");
      const defs = await (window as any).__importModel(file);
      return defs.map((d: any) => ({ id: d.id, name: d.name }));
    }, Array.from(zipBytes));

    expect(result.length).toBe(2);
    expect(result[0].id).toContain("custom-3mf-");
    expect(result[1].id).toContain("custom-3mf-");

    // Both parts should be placeable
    for (const { id } of result) {
      const placed = await page.evaluate(
        (partId: string) => (window as any).__assembly.addPart(partId, [0, 0, 0]),
        id,
      );
      expect(placed).not.toBeNull();
    }
  });

  test("real BambuStudio 3MF imports correct number of parts", async ({
    appPage: page,
  }) => {
    const filePath = path.resolve(__dirname, "../raw-models/HomeRacker+-+Pi5+Case.3mf");
    if (!fs.existsSync(filePath)) {
      test.skip();
      return;
    }
    const buf = fs.readFileSync(filePath);
    const bytes = Array.from(new Uint8Array(buf));

    const result = await page.evaluate(async (bytes: number[]) => {
      const buffer = new Uint8Array(bytes).buffer;
      const file = new File([buffer], "Pi5-Case.3mf");
      const defs = await (window as any).__importModel(file);
      return defs.map((d: any) => d.name as string);
    }, bytes);

    console.log("Imported parts:", result.length, result);
    // The 3MF has 11 build items referencing 9 unique meshes across model files.
    // Should import <= 11 parts (one per build item), not hundreds.
    expect(result.length).toBeLessThanOrEqual(11);
    expect(result.length).toBeGreaterThan(0);
  });
});
