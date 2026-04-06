import * as THREE from "three";

const MAX_AABBS = 32;

const vertexShader = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  // Use the inverse-transpose of the model matrix for correct normal transforms
  vWorldNormal = normalize(mat3(transpose(inverse(modelMatrix))) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 baseColor;
uniform vec3 highlightColor;
uniform float highlightIntensity;
uniform int aabbCount;
uniform vec3 aabbMin[${MAX_AABBS}];
uniform vec3 aabbMax[${MAX_AABBS}];

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  bool insideAny = false;
  for (int i = 0; i < ${MAX_AABBS}; i++) {
    if (i >= aabbCount) break;
    if (vWorldPosition.x >= aabbMin[i].x && vWorldPosition.x <= aabbMax[i].x &&
        vWorldPosition.y >= aabbMin[i].y && vWorldPosition.y <= aabbMax[i].y &&
        vWorldPosition.z >= aabbMin[i].z && vWorldPosition.z <= aabbMax[i].z) {
      insideAny = true;
      break;
    }
  }

  // Match the scene's lighting: ambient 3.5, directionals at 1.8, 1.0, 0.8
  vec3 n = normalize(vWorldNormal);
  vec3 light1 = normalize(vec3(100.0, 200.0, 100.0));
  vec3 light2 = normalize(vec3(-50.0, 100.0, -50.0));
  vec3 light3 = normalize(vec3(0.0, -100.0, 50.0));
  float diff = max(dot(n, light1), 0.0) * 1.8
             + max(dot(n, light2), 0.0) * 1.0
             + max(dot(n, light3), 0.0) * 0.8;
  float ambient = 3.5;
  // Three.js PBR divides by PI for energy conservation
  float lighting = (ambient + diff) / 3.14159;

  vec3 color = baseColor;
  if (insideAny) {
    color = mix(baseColor, highlightColor, highlightIntensity);
  }

  gl_FragColor = vec4(color * lighting, 1.0);
}
`;

/**
 * Create a ShaderMaterial that highlights fragments inside collision AABBs.
 * The material is reusable — update uniforms to change AABBs or colors.
 */
export function createIntersectionHighlightMaterial(
  baseColor: string = "#7799aa",
): THREE.ShaderMaterial {
  const emptyVec3Array = new Array(MAX_AABBS).fill(null).map(() => new THREE.Vector3());

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      baseColor: { value: new THREE.Color(baseColor) },
      highlightColor: { value: new THREE.Color(0xff3333) },
      highlightIntensity: { value: 0.7 },
      aabbCount: { value: 0 },
      aabbMin: { value: emptyVec3Array.map((v) => v.clone()) },
      aabbMax: { value: emptyVec3Array.map((v) => v.clone()) },
    },
  });
}

/**
 * Update the AABB uniforms on an intersection highlight material.
 */
export function updateIntersectionAABBs(
  material: THREE.ShaderMaterial,
  aabbs: THREE.Box3[],
): void {
  const count = Math.min(aabbs.length, MAX_AABBS);
  material.uniforms.aabbCount.value = count;
  for (let i = 0; i < MAX_AABBS; i++) {
    if (i < count) {
      material.uniforms.aabbMin.value[i].copy(aabbs[i].min);
      material.uniforms.aabbMax.value[i].copy(aabbs[i].max);
    } else {
      material.uniforms.aabbMin.value[i].set(0, 0, 0);
      material.uniforms.aabbMax.value[i].set(0, 0, 0);
    }
  }
}

export { MAX_AABBS };
