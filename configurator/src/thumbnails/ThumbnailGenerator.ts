import * as THREE from "three";
import { loadModel } from "../scene/PartLoader";

const SIZE = 80;
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;

function ensureRenderer() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(SIZE, SIZE);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  const ambient = new THREE.AmbientLight(0xffffff, 2.0);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 1.5);
  dir.position.set(1, 1.5, 1);
  scene.add(dir);

  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
}

function fitCameraToObject(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 1.8;
  camera!.position.set(
    center.x + dist * 0.7,
    center.y + dist * 0.5,
    center.z + dist * 0.7
  );
  camera!.lookAt(center);
  camera!.updateProjectionMatrix();
}

/** Generate a thumbnail for a GLB model, returning a cached data URL. */
export async function generateThumbnail(modelPath: string): Promise<string> {
  if (cache.has(modelPath)) return cache.get(modelPath)!;
  if (pending.has(modelPath)) return pending.get(modelPath)!;

  const promise = (async () => {
    ensureRenderer();
    const model = await loadModel(modelPath);
    scene!.add(model);
    fitCameraToObject(model);
    renderer!.render(scene!, camera!);
    const dataURL = renderer!.domElement.toDataURL("image/png");
    scene!.remove(model);
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
    cache.set(modelPath, dataURL);
    pending.delete(modelPath);
    return dataURL;
  })();

  pending.set(modelPath, promise);
  return promise;
}

/** Generate a thumbnail from a BufferGeometry (for custom STL parts). */
export function generateThumbnailFromGeometry(
  defId: string,
  geometry: THREE.BufferGeometry,
  color: string
): string {
  if (cache.has(defId)) return cache.get(defId)!;
  ensureRenderer();
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  scene!.add(mesh);
  fitCameraToObject(mesh);
  renderer!.render(scene!, camera!);
  const dataURL = renderer!.domElement.toDataURL("image/png");
  scene!.remove(mesh);
  material.dispose();
  cache.set(defId, dataURL);
  return dataURL;
}

/** Get a cached thumbnail synchronously, or null if not yet generated. */
export function getCachedThumbnail(key: string): string | null {
  return cache.get(key) ?? null;
}
