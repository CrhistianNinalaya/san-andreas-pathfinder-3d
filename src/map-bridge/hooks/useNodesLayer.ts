import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { RoadGraph } from '../../engine/RoadGraph';
import { useTranslation } from '../../i18n/useTranslation';
import type { LayerFilters } from '../../features/route/routeReducer';
import { renderNodesToLayer } from '../utils/node-layer/nodeLayerRenderer';

/**
 * Options for the road network node rendering hook.
 */
export interface UseNodesLayerOptions {
  map: L.Map | null;
  graph: RoadGraph | null;
  showNodes: boolean;
  filters?: LayerFilters;
}

/**
 * Synchronizes the road network node and edge layers with the Leaflet map instance.
 */
export function useNodesLayer(options: Readonly<UseNodesLayerOptions>) {
  const { map, graph, showNodes, filters } = options;
  const { t } = useTranslation();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    layerGroupRef.current ??= L.layerGroup().addTo(map);
    const group = layerGroupRef.current;
    group.clearLayers();

    if ((showNodes || filters?.coincidentNodes) && graph) {
      renderNodesToLayer({ group, graph, filters, t });
    }
  }, [map, graph, showNodes, filters, t]);
}
