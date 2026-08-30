import { useEffect } from 'react';
import { RoadGraph } from '../../engine/RoadGraph';
import type { RawDataset, CustomNetworkDataset, CustomNode, CustomEdge } from '../../engine/types';
import type { RouteAction } from '../../features/route/routeReducer';

interface ShortcutsManifest {
  readonly version?: string;
  readonly files?: string[];
}

interface ShortcutDoc {
  readonly id?: number | string;
  readonly name?: string;
  readonly description?: string;
  readonly color?: string;
  readonly oneWay?: boolean;
  readonly nodes?: CustomNode[];
  readonly edges?: CustomEdge[];
}

async function loadShortcuts(): Promise<{ nodes: CustomNode[]; edges: CustomEdge[] }> {
  try {
    const manifestRes = await fetch('data/custom/shortcuts/manifest.json');
    if (!manifestRes.ok) return { nodes: [], edges: [] };
    const manifest = (await manifestRes.json()) as ShortcutsManifest;
    const fileNames = manifest.files ?? [];

    const docs = await Promise.all(
      fileNames.map(async (fileName) => {
        try {
          const res = await fetch(`data/custom/shortcuts/${fileName}`);
          if (!res.ok) return null;
          return (await res.json()) as ShortcutDoc;
        } catch {
          return null;
        }
      })
    );

    const nodes: CustomNode[] = [];
    const edges: CustomEdge[] = [];

    for (const doc of docs) {
      if (!doc) continue;
      const parentColor = doc.color;
      const parentDescription = doc.description;

      if (doc.nodes) {
        for (const n of doc.nodes) {
          nodes.push({
            id: n.id,
            name: n.name,
            x: n.x,
            y: n.y,
            z: n.z,
            isCustom: n.isCustom ?? true,
            customType: n.customType ?? 'shortcut',
            color: n.color ?? parentColor
          });
        }
      }

      if (doc.edges) {
        for (const e of doc.edges) {
          edges.push({
            from: e.from,
            to: e.to,
            speed: e.speed ?? 70,
            type: e.type ?? 'shortcut',
            color: e.color ?? parentColor,
            description: e.description ?? parentDescription,
            oneWay: e.oneWay ?? doc.oneWay
          });
        }
      }
    }

    return { nodes, edges };
  } catch (err) {
    console.warn('Could not load shortcuts manifest:', err);
    return { nodes: [], edges: [] };
  }
}

/**
 * Hook responsible for loading the 3 road network layers:
 * 1. Official Rockstar nodes (san_andreas_official_nodes.json)
 * 2. Official Network Patches (custom_network.json)
 * 3. Curated Player Shortcuts (shortcuts/manifest.json)
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
      loadShortcuts()
    ])
      .then(([officialData, patchesData, shortcutsData]: [RawDataset, CustomNetworkDataset | null, { nodes: CustomNode[]; edges: CustomEdge[] }]) => {
        const combinedCustom: CustomNetworkDataset = {
          version: '1.0.0',
          description: 'Combined official patches and curated player shortcuts',
          nodes: [
            ...(patchesData?.nodes ?? []),
            ...shortcutsData.nodes
          ],
          edges: [
            ...(patchesData?.edges ?? []),
            ...shortcutsData.edges
          ]
        };

        const graph = new RoadGraph(officialData, combinedCustom);
        dispatch({ type: 'SET_GRAPH', graph });
      })
      .catch((err) => {
        console.error('Failed to load road graph:', err);
        dispatch({ type: 'SET_LOADING', isLoading: false });
      });
  }, [dispatch]);
}
