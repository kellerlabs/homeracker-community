import * as THREE from "three";
import type { CollisionVoxelData } from "../assembly/mesh-collision";

const MAX_VOXEL_TEXTURES = 4; // max simultaneous collision partners

export interface PatchedUniforms {
  highlightIntensity: { value: number };
  voxelCount: { value: number };
}

/**
 * Patch a PBR material to highlight fragments that fall inside a 3D occupancy
 * texture (voxelized collision partner geometry). Preserves all PBR properties.
 *
 * Supports up to MAX_VOXEL_TEXTURES simultaneous collision partners.
 */
export function patchPBRWithVoxelIntersection(
  material: THREE.MeshStandardMaterial,
  voxels: CollisionVoxelData[],
  highlightColor: THREE.Color = new THREE.Color(0xff3333),
  highlightIntensity: number = 0.7,
): { uniforms: PatchedUniforms } {
  const count = Math.min(voxels.length, MAX_VOXEL_TEXTURES);

  // Build uniform objects
  const textures: { value: THREE.Data3DTexture }[] = [];
  const mins: { value: THREE.Vector3 }[] = [];
  const maxs: { value: THREE.Vector3 }[] = [];
  const empty3d = new THREE.Data3DTexture(new Uint8Array(8), 2, 2, 2);
  empty3d.format = THREE.RedFormat;
  empty3d.needsUpdate = true;

  for (let i = 0; i < MAX_VOXEL_TEXTURES; i++) {
    if (i < count) {
      textures.push({ value: voxels[i].texture });
      mins.push({ value: voxels[i].boundsMin.clone() });
      maxs.push({ value: voxels[i].boundsMax.clone() });
    } else {
      textures.push({ value: empty3d });
      mins.push({ value: new THREE.Vector3() });
      maxs.push({ value: new THREE.Vector3() });
    }
  }

  const uniforms: any = {
    uHighlightColor: { value: highlightColor.clone() },
    highlightIntensity: { value: highlightIntensity },
    voxelCount: { value: count },
  };
  for (let i = 0; i < MAX_VOXEL_TEXTURES; i++) {
    uniforms[`voxelTex${i}`] = textures[i];
    uniforms[`voxelMin${i}`] = mins[i];
    uniforms[`voxelMax${i}`] = maxs[i];
  }

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    // Vertex shader: add world position varying
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      'varying vec3 vIntersectWorldPos;\nvoid main() {'
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvIntersectWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
    );

    // Fragment shader: declare uniforms and 3D texture samplers
    let declarations = `
uniform vec3 uHighlightColor;
uniform float highlightIntensity;
uniform int voxelCount;
varying vec3 vIntersectWorldPos;
`;
    for (let i = 0; i < MAX_VOXEL_TEXTURES; i++) {
      declarations += `uniform sampler3D voxelTex${i};\n`;
      declarations += `uniform vec3 voxelMin${i};\n`;
      declarations += `uniform vec3 voxelMax${i};\n`;
    }
    shader.fragmentShader = declarations + shader.fragmentShader;

    // Build the sampling code — check each voxel texture
    let samplingCode = `
      float maxOcc = 0.0;
`;
    for (let i = 0; i < MAX_VOXEL_TEXTURES; i++) {
      samplingCode += `
      if (${i} < voxelCount) {
        vec3 extent${i} = voxelMax${i} - voxelMin${i};
        vec3 uvw${i} = (vIntersectWorldPos - voxelMin${i}) / extent${i};
        if (uvw${i}.x >= 0.0 && uvw${i}.x <= 1.0 &&
            uvw${i}.y >= 0.0 && uvw${i}.y <= 1.0 &&
            uvw${i}.z >= 0.0 && uvw${i}.z <= 1.0) {
          float occ${i} = texture(voxelTex${i}, uvw${i}).r;
          maxOcc = max(maxOcc, occ${i});
        }
      }
`;
    }
    samplingCode += `
      if (maxOcc > 0.01) {
        float blend = maxOcc * highlightIntensity;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uHighlightColor, blend);
      }
      #include <dithering_fragment>
`;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      samplingCode
    );
  };

  material.needsUpdate = true;
  material.customProgramCacheKey = () => `voxel-intersection-${count}`;

  return { uniforms };
}
