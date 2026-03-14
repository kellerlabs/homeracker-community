import type * as THREE from "three";

/** Singleton geometry cache for collision detection.
 *  GLB parts register their merged geometry here after loading.
 *  Custom parts use getCustomPartGeometry() directly. */
const store = new Map<string, THREE.BufferGeometry>();
let version = 0;
const listeners = new Set<() => void>();

export function registerPartGeometry(definitionId: string, geometry: THREE.BufferGeometry): void {
  if (store.has(definitionId)) return;
  store.set(definitionId, geometry);
  version++;
  listeners.forEach((cb) => cb());
}

export function getRegisteredGeometry(definitionId: string): THREE.BufferGeometry | undefined {
  return store.get(definitionId);
}

export function hasRegisteredGeometry(definitionId: string): boolean {
  return store.has(definitionId);
}

export function getRegistryVersion(): number {
  return version;
}

export function subscribeRegistry(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
