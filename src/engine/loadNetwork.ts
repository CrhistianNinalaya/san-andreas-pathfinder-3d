/**
 * Single source of truth for merging the three road network layers.
 *
 * 1. Official Rockstar nodes (san_andreas_official_nodes.json) — passed to RoadGraph as-is.
 * 2. Official network patches (custom/custom_network.json).
 * 3. Curated player shortcuts (custom/shortcuts/manifest.json + one file per shortcut).
 *
 * Layers 2 and 3 are combined here into the single CustomNetworkDataset that RoadGraph
 * expects. The per-field defaulting below used to be copy-pasted into every consumer
 * (the app hook, the benchmark, and anything verifying the data), which meant the graph
 * each one built could quietly differ. Everything that needs the merged network must call
 * this module so they all see the same graph.
 *
 * I/O stays with the callers: the app fetches over HTTP, the CLI tools read from disk.
 * Only the merge itself lives here.
 */

import type { CustomEdge, CustomNetworkDataset, CustomNode } from './types';

/** Nominal speed applied to a shortcut edge that does not declare one. */
export const DEFAULT_SHORTCUT_SPEED = 70;

/** A single curated shortcut file under public/data/custom/shortcuts/. */
export interface ShortcutDoc {
  readonly id?: number | string;
  readonly name?: string;
  readonly description?: string;
  readonly color?: string;
  readonly oneWay?: boolean;
  readonly nodes?: CustomNode[];
  readonly edges?: CustomEdge[];
}

/** public/data/custom/custom_network.json — patches to the official network. */
export interface PatchDoc {
  readonly version?: string;
  readonly description?: string;
  readonly nodes?: CustomNode[];
  readonly edges?: CustomEdge[];
}

/** public/data/custom/shortcuts/manifest.json */
export interface ShortcutsManifest {
  readonly version?: string;
  readonly files?: string[];
}

export interface MergeCustomLayersOptions {
  readonly patches?: PatchDoc | null;
  /** Shortcut docs in manifest order; nulls (failed loads) are skipped. */
  readonly shortcuts?: ReadonlyArray<ShortcutDoc | null | undefined>;
}

/**
 * Flattens the patch layer and every shortcut doc into one CustomNetworkDataset,
 * resolving each shortcut's per-document defaults (colour, description, oneWay) onto
 * the nodes and edges it contains.
 */
export function mergeCustomLayers(options: MergeCustomLayersOptions): CustomNetworkDataset {
  const nodes: CustomNode[] = [...(options.patches?.nodes ?? [])];
  const edges: CustomEdge[] = [...(options.patches?.edges ?? [])];

  for (const doc of options.shortcuts ?? []) {
    if (!doc) continue;

    const parentColor = doc.color;
    const parentDescription = doc.description;

    for (const n of doc.nodes ?? []) {
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

    for (const e of doc.edges ?? []) {
      edges.push({
        from: e.from,
        to: e.to,
        speed: e.speed ?? DEFAULT_SHORTCUT_SPEED,
        type: e.type ?? 'shortcut',
        color: e.color ?? parentColor,
        description: e.description ?? parentDescription,
        oneWay: e.oneWay ?? doc.oneWay
      });
    }
  }

  return {
    version: '1.0.0',
    description: 'Combined official patches and curated player shortcuts',
    nodes,
    edges
  };
}
