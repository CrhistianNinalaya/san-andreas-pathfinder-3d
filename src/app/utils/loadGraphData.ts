import { RoadGraph } from '../../engine/RoadGraph';
import { mergeCustomLayers } from '../../engine/loadNetwork';
import type { PatchDoc, ShortcutDoc, ShortcutsManifest } from '../../engine/loadNetwork';
import type { RawDataset } from '../../engine/types';

/**
 * Fetches and resolves individual shortcut files declared in the manifest.
 */
export async function fetchShortcutDocs(): Promise<Array<ShortcutDoc | null>> {
  try {
    const manifestRes = await fetch('data/custom/shortcuts/manifest.json');
    if (!manifestRes.ok) return [];
    const manifest = (await manifestRes.json()) as ShortcutsManifest;

    return await Promise.all(
      (manifest.files ?? []).map(async (fileName) => {
        try {
          const res = await fetch(`data/custom/shortcuts/${fileName}`);
          if (!res.ok) return null;
          return (await res.json()) as ShortcutDoc;
        } catch {
          return null;
        }
      })
    );
  } catch (err) {
    console.warn('Could not load shortcuts manifest:', err);
    return [];
  }
}

/**
 * Loads all 3 road network layers and constructs the consolidated RoadGraph.
 */
export async function loadFullRoadGraph(): Promise<RoadGraph> {
  const [officialData, patchesData, shortcutDocs] = await Promise.all([
    fetch('data/official/san_andreas_official_nodes.json').then((res) => res.json()),
    fetch('data/custom/custom_network.json')
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null),
    fetchShortcutDocs()
  ]) as [RawDataset, PatchDoc | null, Array<ShortcutDoc | null>];

  const combinedCustom = mergeCustomLayers({ patches: patchesData, shortcuts: shortcutDocs });
  return new RoadGraph(officialData, combinedCustom);
}
