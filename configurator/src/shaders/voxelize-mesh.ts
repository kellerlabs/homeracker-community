import * as THREE from "three";

const VOXEL_RESOLUTION = 48; // max voxels per axis (lower = faster)

/**
 * Voxelize a mesh geometry into a 3D occupancy texture within a given
 * world-space bounding box. Occupied voxels are 255, empty are 0.
 * The GPU's linear texture filtering creates a natural gradient at boundaries.
 */
export function voxelizeMesh(
  geometry: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4,
  bounds: THREE.Box3,
  resolution: number = VOXEL_RESOLUTION,
): { texture: THREE.Data3DTexture; boundsMin: THREE.Vector3; boundsMax: THREE.Vector3; size: [number, number, number] } {
  // Pad bounds by ~2 voxels so the linear filter gradient is visible beyond the surface
  const extent0 = bounds.max.clone().sub(bounds.min);
  const maxExtent0 = Math.max(extent0.x, extent0.y, extent0.z);
  const voxelApprox = maxExtent0 / resolution;
  const pad = voxelApprox * 2 + 0.5;

  const boundsMin = bounds.min.clone().addScalar(-pad);
  const boundsMax = bounds.max.clone().addScalar(pad);
  const extent = boundsMax.clone().sub(boundsMin);
  const maxExtent = Math.max(extent.x, extent.y, extent.z);

  const nx = Math.max(2, Math.ceil((extent.x / maxExtent) * resolution));
  const ny = Math.max(2, Math.ceil((extent.y / maxExtent) * resolution));
  const nz = Math.max(2, Math.ceil((extent.z / maxExtent) * resolution));
  const voxelSize = new THREE.Vector3(extent.x / nx, extent.y / ny, extent.z / nz);

  const data = new Uint8Array(nx * ny * nz);

  const pos = geometry.attributes.position;
  const idx = geometry.index;
  const triCount = idx ? idx.count / 3 : pos.count / 3;

  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const triMin = new THREE.Vector3();
  const triMax = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;

    va.fromBufferAttribute(pos, i0).applyMatrix4(worldMatrix);
    vb.fromBufferAttribute(pos, i1).applyMatrix4(worldMatrix);
    vc.fromBufferAttribute(pos, i2).applyMatrix4(worldMatrix);

    triMin.copy(va).min(vb).min(vc);
    triMax.copy(va).max(vb).max(vc);

    const x0 = Math.max(0, Math.floor((triMin.x - boundsMin.x) / voxelSize.x));
    const y0 = Math.max(0, Math.floor((triMin.y - boundsMin.y) / voxelSize.y));
    const z0 = Math.max(0, Math.floor((triMin.z - boundsMin.z) / voxelSize.z));
    const x1 = Math.min(nx - 1, Math.floor((triMax.x - boundsMin.x) / voxelSize.x));
    const y1 = Math.min(ny - 1, Math.floor((triMax.y - boundsMin.y) / voxelSize.y));
    const z1 = Math.min(nz - 1, Math.floor((triMax.z - boundsMin.z) / voxelSize.z));

    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          data[x + y * nx + z * nx * ny] = 255;
        }
      }
    }
  }

  const texture = new THREE.Data3DTexture(data, nx, ny, nz);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  // LinearFilter gives free GPU-interpolated gradient at voxel boundaries
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return { texture, boundsMin, boundsMax, size: [nx, ny, nz] };
}
