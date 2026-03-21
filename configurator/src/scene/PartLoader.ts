import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const cache = new Map<string, THREE.Group>();
const loading = new Map<string, Promise<THREE.Group>>();

/** Load a GLB model, returning a cloneable Group. Cached after first load. */
export async function loadModel(path: string): Promise<THREE.Group> {
  // Return cached
  const cached = cache.get(path);
  if (cached) return cached.clone();

  // Deduplicate in-flight requests
  let promise = loading.get(path);
  if (!promise) {
    promise = new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        path,
        (gltf) => {
          const group = gltf.scene;
          cache.set(path, group);
          loading.delete(path);
          resolve(group.clone());
        },
        undefined,
        (err) => {
          loading.delete(path);
          reject(err);
        }
      );
    });
    loading.set(path, promise);
  }

  const group = await promise;
  return group.clone();
}

/** Synchronously get a cached model (returns null if not loaded yet) */
export function getCachedModel(path: string): THREE.Group | null {
  const cached = cache.get(path);
  return cached ? cached.clone() : null;
}

/** Preload a list of model paths */
export async function preloadModels(paths: string[]): Promise<void> {
  await Promise.allSettled(paths.map((p) => loadModel(p)));
}
