import * as THREE from "three";

const MAX_AABBS = 32;

/**
 * Patch a PBR material (MeshStandardMaterial) to add intersection AABB highlighting.
 * Preserves all PBR properties (normal maps, roughness, AO, etc.) by injecting
 * custom GLSL into the existing shader via onBeforeCompile.
 *
 * Returns a reference object whose `.value` properties can be updated each frame
 * to animate the highlight or change AABBs.
 */
export function patchPBRWithIntersection(
  material: THREE.MeshStandardMaterial,
  aabbs: THREE.Box3[],
  highlightColor: THREE.Color = new THREE.Color(0xff3333),
  highlightIntensity: number = 0.7,
): { uniforms: { aabbCount: { value: number }; aabbMin: { value: THREE.Vector3[] }; aabbMax: { value: THREE.Vector3[] }; highlightIntensity: { value: number } } } {
  const count = Math.min(aabbs.length, MAX_AABBS);
  const mins = Array.from({ length: MAX_AABBS }, (_, i) =>
    i < count ? aabbs[i].min.clone() : new THREE.Vector3()
  );
  const maxs = Array.from({ length: MAX_AABBS }, (_, i) =>
    i < count ? aabbs[i].max.clone() : new THREE.Vector3()
  );

  const uniforms = {
    aabbCount: { value: count },
    aabbMin: { value: mins },
    aabbMax: { value: maxs },
    uHighlightColor: { value: highlightColor.clone() },
    highlightIntensity: { value: highlightIntensity },
  };

  material.onBeforeCompile = (shader) => {
    // Merge our uniforms into the shader's uniform set
    Object.assign(shader.uniforms, uniforms);

    // Vertex shader: add a varying for world position
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      'varying vec3 vIntersectWorldPos;\nvoid main() {'
    );
    // Inject world position computation after Three.js computes `transformed`
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvIntersectWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
    );

    // Fragment shader: declare uniforms and varying
    shader.fragmentShader =
      `uniform int aabbCount;
uniform vec3 aabbMin[${MAX_AABBS}];
uniform vec3 aabbMax[${MAX_AABBS}];
uniform vec3 uHighlightColor;
uniform float highlightIntensity;
varying vec3 vIntersectWorldPos;
` + shader.fragmentShader;

    // Inject AABB test just before the final dithering step
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      bool insideAny = false;
      for (int i = 0; i < ${MAX_AABBS}; i++) {
        if (i >= aabbCount) break;
        if (vIntersectWorldPos.x >= aabbMin[i].x && vIntersectWorldPos.x <= aabbMax[i].x &&
            vIntersectWorldPos.y >= aabbMin[i].y && vIntersectWorldPos.y <= aabbMax[i].y &&
            vIntersectWorldPos.z >= aabbMin[i].z && vIntersectWorldPos.z <= aabbMax[i].z) {
          insideAny = true;
          break;
        }
      }
      if (insideAny) {
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uHighlightColor, highlightIntensity);
      }
      #include <dithering_fragment>
      `
    );
  };

  // Force shader recompilation
  material.needsUpdate = true;
  // Unique cache key so patched materials don't share programs with unpatched ones
  material.customProgramCacheKey = () => `intersection-${count}`;

  return { uniforms };
}

/**
 * Update AABB data on a patched material's uniforms.
 */
export function updatePatchedAABBs(
  uniforms: { aabbCount: { value: number }; aabbMin: { value: THREE.Vector3[] }; aabbMax: { value: THREE.Vector3[] } },
  aabbs: THREE.Box3[],
): void {
  const count = Math.min(aabbs.length, MAX_AABBS);
  uniforms.aabbCount.value = count;
  for (let i = 0; i < MAX_AABBS; i++) {
    if (i < count) {
      uniforms.aabbMin.value[i].copy(aabbs[i].min);
      uniforms.aabbMax.value[i].copy(aabbs[i].max);
    } else {
      uniforms.aabbMin.value[i].set(0, 0, 0);
      uniforms.aabbMax.value[i].set(0, 0, 0);
    }
  }
}
