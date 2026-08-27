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

type NodeCategory = 'patch' | 'shortcut' | null;

function getNodeCategory(node: GraphNode, graph: RoadGraph): NodeCategory {
  if (node.customType === 'patch') return 'patch';
  if (node.customType === 'shortcut' || node.customType === 'offroad' || node.customType === 'jump') return 'shortcut';

  const adj = graph.adjacencyList.get(node.id);
  if (adj?.some((e) => e.type === 'patch')) return 'patch';
  if (adj?.some((e) => e.isCustom)) return 'shortcut';
  if (node.isCustom) return 'shortcut';
  return null;
}

function getNodeThemeStyle(node: GraphNode, category: NodeCategory) {
  if (category === 'patch') {
    return NODE_LAYER_THEME.patch;
  }
  if (category === 'shortcut') {
    return NODE_LAYER_THEME.shortcut;
  }
  return node.isGiantComponent ? NODE_LAYER_THEME.giant : NODE_LAYER_THEME.isolated;
}

function buildPopupHtml(node: GraphNode, category: NodeCategory): string {
  const isGiant = node.isGiantComponent;

  let statusColor: string = isGiant ? NODE_LAYER_THEME.giant.color : NODE_LAYER_THEME.isolated.color;
  let statusLabel = isGiant ? '✅ Conectado (Gigante)' : '⚠️ Aislado / Desconectado';

  if (category === 'patch') {
    statusColor = NODE_LAYER_THEME.patch.color;
    statusLabel = '🔧 Parche Vial Oficial';
  } else if (category === 'shortcut') {
    statusColor = NODE_LAYER_THEME.shortcut.color;
    statusLabel = '⚡ Atajo / Ruta Personalizada';
  }

  return `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4;">
    <strong style="color: ${statusColor}; font-size: 13px;">${node.name}</strong><br/>
    <strong>ID:</strong> ${node.id}<br/>
    <strong>Coords:</strong> (${node.x}, ${node.y})<br/>
    <strong>Altitud:</strong> ${node.z} m<br/>
    <strong>Estado:</strong> ${statusLabel}
  </div>`;
}

function createNodeMarker(node: GraphNode, renderer: L.Canvas, category: NodeCategory): L.CircleMarker {
  const latlng = gtaToLatLng(node.x, node.y);
  const style = getNodeThemeStyle(node, category);

  const circle = L.circleMarker(latlng, {
    renderer,
    radius: style.radius,
    weight: style.weight,
    color: style.color,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity
  });

  circle.bindPopup(buildPopupHtml(node, category));
  return circle;
}

function renderCustomEdges(group: L.LayerGroup, graph: RoadGraph): void {
  const seen = new Set<string>();
  for (const [fromId, edges] of graph.adjacencyList.entries()) {
    const fromNode = graph.nodes.get(fromId);
    if (!fromNode) continue;

    for (const edge of edges) {
      if (!edge.isCustom && !edge.type) continue;

      const toNode = graph.nodes.get(edge.to);
      if (!toNode) continue;

      const edgeKey = fromId < edge.to ? `${fromId}->${edge.to}` : `${edge.to}->${fromId}`;
      if (seen.has(edgeKey)) continue;
      seen.add(edgeKey);

      const isPatch = edge.type === 'patch';
      const color = isPatch ? NODE_LAYER_THEME.patch.fillColor : NODE_LAYER_THEME.shortcut.fillColor;

      const polyline = L.polyline([gtaToLatLng(fromNode.x, fromNode.y), gtaToLatLng(toNode.x, toNode.y)], {
        color,
        weight: 3.5,
        opacity: 0.95,
        dashArray: '6, 6',
        lineCap: 'round',
        lineJoin: 'round'
      });

      polyline.bindPopup(
        `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4;">
          <strong style="color: ${color}; font-size: 13px;">${isPatch ? '🔧 Parche Vial Oficial' : '⚡ Atajo Personalizado'}</strong><br/>
          <strong>Conexión:</strong> ${fromNode.name} ↔ ${toNode.name}<br/>
          <strong>Distancia:</strong> ${Math.round(edge.distance)} m
        </div>`
      );

      polyline.addTo(group);
    }
  }
}

function renderNodesToLayer(group: L.LayerGroup, graph: RoadGraph): void {
  const renderer = L.canvas({ padding: 0.5 });
  const customNodes: Array<{ node: GraphNode; category: NodeCategory }> = [];

  for (const node of graph.nodes.values()) {
    const category = getNodeCategory(node, graph);
    if (category) {
      customNodes.push({ node, category });
    } else {
      createNodeMarker(node, renderer, null).addTo(group);
    }
  }

  // Draw custom connectors and overlay custom nodes on top
  renderCustomEdges(group, graph);
  for (const item of customNodes) {
    createNodeMarker(item.node, renderer, item.category).addTo(group);
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
