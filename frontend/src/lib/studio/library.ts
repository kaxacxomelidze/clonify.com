/**
 * Library (reusable sections/components) and uploaded assets, kept in this browser's
 * localStorage. Library items carry their studio model fragment (designs, motion,
 * per-device styles) so inserted copies look exactly like the saved original.
 */
import type { StudioModel } from "./engine";

export type LibraryItem = {
  id: string;
  name: string;
  kind: string;
  html: string;
  model: StudioModel | null;
  createdAt: number;
};

export type AssetItem = { src: string; name: string; addedAt: number };

const LIB_KEY = "clonyfy.studio.library.v1";
const assetKey = (outDir: string) => `clonyfy.studio.assets.v1.${outDir}`;

function read<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch {
    return false; // quota exceeded / storage blocked
  }
}

export const listLibrary = () =>
  read<LibraryItem>(LIB_KEY).sort((a, b) => b.createdAt - a.createdAt);

export function addLibraryItem(item: Omit<LibraryItem, "id" | "createdAt">): boolean {
  const items = read<LibraryItem>(LIB_KEY);
  items.push({ ...item, id: Math.random().toString(36).slice(2, 10), createdAt: Date.now() });
  return write(LIB_KEY, items.slice(-60));
}

export function removeLibraryItem(id: string) {
  write(
    LIB_KEY,
    read<LibraryItem>(LIB_KEY).filter((i) => i.id !== id),
  );
}

export function renameLibraryItem(id: string, name: string) {
  write(
    LIB_KEY,
    read<LibraryItem>(LIB_KEY).map((i) => (i.id === id ? { ...i, name } : i)),
  );
}

export const listAssets = (outDir: string) =>
  read<AssetItem>(assetKey(outDir)).sort((a, b) => b.addedAt - a.addedAt);

export function addAsset(outDir: string, asset: Omit<AssetItem, "addedAt">) {
  const items = read<AssetItem>(assetKey(outDir)).filter((a) => a.src !== asset.src);
  items.push({ ...asset, addedAt: Date.now() });
  write(assetKey(outDir), items.slice(-120));
}

export function removeAsset(outDir: string, src: string) {
  write(
    assetKey(outDir),
    read<AssetItem>(assetKey(outDir)).filter((a) => a.src !== src),
  );
}
