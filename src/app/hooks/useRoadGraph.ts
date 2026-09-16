import { useEffect } from 'react';
import { RoadGraph } from '../../engine/RoadGraph';
import { mergeCustomLayers } from '../../engine/loadNetwork';
import type { PatchDoc, ShortcutDoc, ShortcutsManifest } from '../../engine/loadNetwork';
import type { RawDataset } from '../../engine/types';
import type { RouteAction } from '../../features/route/routeReducer';

async function fetchShortcutDocs(): Promise<Array<ShortcutDoc | null>> {
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
 * Hook responsible for loading the 3 road network layers:
 * 1. Official Rockstar nodes (san_andreas_official_nodes.json)
 * 2. Official Network Patches (custom_network.json)
 * 3. Curated Player Shortcuts (shortcuts/manifest.json)
 *
 * Layers 2 and 3 are combined by mergeCustomLayers so the app, the benchmark and the
 * graph verifier all build the same graph.
 */
export function useRoadGraph(dispatch: React.Dispatch<RouteAction>): void {
  useEffect(() => {
    Promise.all([
      // Layer 1: Official Rockstar nodes
      fetch('data/official/san_andreas_official_nodes.json').then((res) => res.json()),
      // Layer 2: Official network patches
      fetch('data/custom/custom_network.json')
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      // Layer 3: Curated shortcuts
      fetchShortcutDocs()
    ])
      .then(([officialData, patchesData, shortcutDocs]: [RawDataset, PatchDoc | null, Array<ShortcutDoc | null>]) => {
        const combinedCustom = mergeCustomLayers({ patches: patchesData, shortcuts: shortcutDocs });
        const graph = new RoadGraph(officialData, combinedCustom);
        dispatch({ type: 'SET_GRAPH', graph });
      })
      .catch((err) => {
        console.error('Failed to load road graph:', err);
        dispatch({ type: 'SET_LOADING', isLoading: false });
      });
  }, [dispatch]);
}
