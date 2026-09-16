/**
 * Filesystem loader for the three road network layers, shared by the CLI tools.
 *
 * The browser fetches these files over HTTP; Node reads them from public/. Both paths
 * converge on mergeCustomLayers so the benchmark and the verifier build exactly the graph
 * the app builds.
 *
 * Missing custom layers are tolerated — they are optional. A layer that exists but cannot
 * be parsed throws, because silently benchmarking or verifying the official-only graph and
 * labelling it "the shipped network" is worse than failing.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { mergeCustomLayers } from '../src/engine/loadNetwork';
import type { PatchDoc, ShortcutDoc, ShortcutsManifest } from '../src/engine/loadNetwork';
import type { CustomNetworkDataset, RawDataset } from '../src/engine/types';

export const DEFAULT_OFFICIAL_PATH = 'public/data/official/san_andreas_official_nodes.json';
export const DEFAULT_PATCHES_PATH = 'public/data/custom/custom_network.json';
export const DEFAULT_SHORTCUTS_DIR = 'public/data/custom/shortcuts';

export interface LoadNetworkOptions {
  readonly officialPath?: string;
  readonly patchesPath?: string;
  readonly shortcutsDir?: string;
}

/** A shortcut doc together with the file it came from, for per-file diagnostics. */
export interface LoadedShortcut {
  readonly path: string;
  readonly doc: ShortcutDoc;
}

export interface LoadedNetwork {
  readonly official: RawDataset;
  readonly officialPath: string;
  /** Undefined when neither custom layer is present on disk. */
  readonly custom?: CustomNetworkDataset;
  readonly patches?: PatchDoc;
  readonly patchesPath?: string;
  readonly shortcuts: LoadedShortcut[];
}

function readJson<T>(filePath: string, label: string): T {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch (err) {
    throw new Error(`${label} at ${filePath} could not be read: ${(err as Error).message}`);
  }
}

export function loadNetworkFromDisk(options: LoadNetworkOptions = {}): LoadedNetwork {
  const officialPath = options.officialPath ?? DEFAULT_OFFICIAL_PATH;
  const patchesPath = options.patchesPath ?? DEFAULT_PATCHES_PATH;
  const shortcutsDir = options.shortcutsDir ?? DEFAULT_SHORTCUTS_DIR;

  const official = readJson<RawDataset>(officialPath, 'Official dataset');

  let patches: PatchDoc | undefined;
  if (existsSync(patchesPath)) {
    patches = readJson<PatchDoc>(patchesPath, 'Patch layer');
  }

  const shortcuts: LoadedShortcut[] = [];
  const manifestPath = path.join(shortcutsDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = readJson<ShortcutsManifest>(manifestPath, 'Shortcuts manifest');
    for (const fileName of manifest.files ?? []) {
      const filePath = path.join(shortcutsDir, fileName);
      if (!existsSync(filePath)) {
        throw new Error(`Shortcuts manifest lists ${fileName}, but ${filePath} does not exist`);
      }
      shortcuts.push({ path: filePath, doc: readJson<ShortcutDoc>(filePath, 'Shortcut') });
    }
  }

  const hasCustomLayer = patches !== undefined || shortcuts.length > 0;
  const custom = hasCustomLayer
    ? mergeCustomLayers({ patches, shortcuts: shortcuts.map((s) => s.doc) })
    : undefined;

  return {
    official,
    officialPath,
    custom,
    patches,
    patchesPath: patches ? patchesPath : undefined,
    shortcuts
  };
}
