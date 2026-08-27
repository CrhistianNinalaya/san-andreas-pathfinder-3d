import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { gtaToLatLng } from '../geo/coordinates';
import type { RoadGraph } from '../engine/RoadGraph';
import type { GraphNode } from '../engine/types';
import { NODE_LAYER_THEME } from './theme';

export interface UseNodesLayerOptions {
  map: L.Map | null;
  graph: RoadGraph | null;
  showNodes: boolean;
}

function buildPopupHtml(node: GraphNode): string {
  const isGiant = node.isGiantComponent;
  const statusColor = isGiant ? NODE_LAYER_THEME.giant.color : NODE_LAYER_THEME.isolated.color;
  const statusLabel = isGiant ? '✅ Conectado (Gigante)' : '⚠️ Aislado / Desconectado';

  return `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4;">
    <strong style="color: ${statusColor}; font-size: 13px;">${node.name}</strong><br/>
    <strong>ID:</strong> ${node.id}<br/>
    <strong>Coords:</strong> (${node.x}, ${node.y})<br/>
    <strong>Altitud:</strong> ${node.z} m<br/>
    <strong>Estado:</strong> ${statusLabel}
  </div>`;
}

function createNodeMarker(node: GraphNode, renderer: L.Canvas): L.CircleMarker {
  const latlng = gtaToLatLng(node.x, node.y);
  const style = node.isGiantComponent ? NODE_LAYER_THEME.giant : NODE_LAYER_THEME.isolated;

  const circle = L.circleMarker(latlng, {
    renderer,
    radius: style.radius,
    weight: style.weight,
    color: style.color,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity
  });

  circle.bindPopup(buildPopupHtml(node));
  return circle;
}

function renderNodesToLayer(group: L.LayerGroup, graph: RoadGraph): void {
  const renderer = L.canvas({ padding: 0.5 });
  for (const node of graph.nodes.values()) {
    createNodeMarker(node, renderer).addTo(group);
  }
}

export function useNodesLayer(options: Readonly<UseNodesLayerOptions>) {
  const { map, graph, showNodes } = options;
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    layerGroupRef.current ??= L.layerGroup().addTo(map);
    const group = layerGroupRef.current;
    group.clearLayers();

    if (showNodes && graph) {
      renderNodesToLayer(group, graph);
    }
  }, [map, graph, showNodes]);
}
