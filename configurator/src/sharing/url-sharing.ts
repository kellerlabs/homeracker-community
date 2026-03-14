import type { AssemblyFile } from "../types";
import { isCustomPart } from "../data/custom-parts";

/** Compress a Uint8Array using browser-native deflate */
async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  writer.write(data as any);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** Decompress a Uint8Array using browser-native inflate */
async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate");
  const writer = ds.writable.getWriter();
  writer.write(data as any);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** Encode bytes to base64url (URL-safe, no padding) */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode base64url string to bytes */
function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Check if an assembly contains custom STL parts */
export function hasCustomParts(data: AssemblyFile): boolean {
  return data.parts.some((p) => isCustomPart(p.type));
}

/** Encode an assembly to a URL hash string (#scene=...) */
export async function encodeAssemblyToHash(data: AssemblyFile): Promise<string> {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  const compressed = await deflate(bytes);
  return `#scene=${toBase64Url(compressed)}`;
}

/** Decode a URL hash string back to an assembly, or null if invalid */
export async function decodeAssemblyFromHash(hash: string): Promise<AssemblyFile | null> {
  try {
    const prefix = "#scene=";
    if (!hash.startsWith(prefix)) return null;
    const encoded = hash.slice(prefix.length);
    if (!encoded) return null;
    const compressed = fromBase64Url(encoded);
    const bytes = await inflate(compressed);
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json) as AssemblyFile;
    if (!data.version || !Array.isArray(data.parts)) return null;
    return data;
  } catch {
    return null;
  }
}
