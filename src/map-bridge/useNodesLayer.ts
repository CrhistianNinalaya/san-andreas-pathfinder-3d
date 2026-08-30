import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { gtaToLatLng } from '../geo/coordinates';
import type { RoadGraph } from '../engine/RoadGraph';
import type { GraphNode } from '../engine/types';
import { NODE_LAYER_THEME } from './theme';
import { useTranslation } from '../i18n/useTranslation';
import type { TranslationKey } from '../i18n/translations';

export interface UseNodesLayerOptions {
  map: L.Map | null;
  graph: RoadGraph | null;
  showNodes: boolean;
}

type NodeCategory = 'patch' | 'shortcut' | null;
type Translator = (key: TranslationKey, params?: Record<string, string | number>) => string;

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
    if (node.color) {
      return {
        radius: NODE_LAYER_THEME.shortcut.radius,
        weight: NODE_LAYER_THEME.shortcut.weight,
        color: node.color,
        fillColor: node.color,
        fillOpacity: 1.0
      };
    }
    return NODE_LAYER_THEME.shortcut;
  }
  return node.isGiantComponent ? NODE_LAYER_THEME.giant : NODE_LAYER_THEME.isolated;
}

function buildPopupHtml(node: GraphNode, category: NodeCategory, t: Translator): string {
  const isGiant = node.isGiantComponent;

  let statusColor: string = isGiant ? NODE_LAYER_THEME.giant.color : NODE_LAYER_THEME.isolated.color;
  let statusLabel = isGiant ? t('nodeStatusGiant') : t('nodeStatusIsolated');

  if (category === 'patch') {
    statusColor = NODE_LAYER_THEME.patch.color;
    statusLabel = t('nodeStatusPatch');
  } else if (category === 'shortcut') {
    statusColor = node.color ?? NODE_LAYER_THEME.shortcut.color;
    statusLabel = t('nodeStatusShortcut');
  }

  return `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4;">
    <strong style="color: ${statusColor}; font-size: 13px;">${node.name}</strong><br/>
    <strong>${t('nodeId')}</strong> ${node.id}<br/>
    <strong>${t('nodeCoords')}</strong> (${node.x}, ${node.y})<br/>
    <strong>${t('nodeAltitude')}</strong> ${node.z} m<br/>
    <strong>${t('nodeStatus')}</strong> ${statusLabel}
  </div>`;
}

function createNodeMarker(
  node: GraphNode,
  renderer: L.Canvas,
  category: NodeCategory,
  t: Translator
): L.CircleMarker {
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

  circle.bindPopup(buildPopupHtml(node, category, t));
  return circle;
}

function renderCustomEdges(group: L.LayerGroup, graph: RoadGraph, t: Translator): void {
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
      const color = edge.color ?? (isPatch ? NODE_LAYER_THEME.patch.fillColor : NODE_LAYER_THEME.shortcut.fillColor);
      const title = edge.description ?? (isPatch ? t('edgePatch') : t('edgeShortcut'));

      const polyline = L.polyline([gtaToLatLng(fromNode.x, fromNode.y), gtaToLatLng(toNode.x, toNode.y)], {
        color,
        weight: 3.5,
        opacity: 0.95,
        dashArray: '6, 6',
        lineCap: 'round',
        lineJoin: 'round'
      });

      const oneWayBadge = edge.oneWay ? `<br/><span style="color: #f59e0b; font-weight: 600;">${t('edgeOneWay')}</span>` : '';

      polyline.bindPopup(
        `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4;">
          <strong style="color: ${color}; font-size: 13px;">${title}</strong><br/>
          <strong>${t('edgeConnection', { from: fromNode.name, to: toNode.name })}</strong><br/>
          <strong>${t('edgeDistance', { dist: Math.round(edge.distance) })}</strong>${oneWayBadge}
        </div>`
      );

      polyline.addTo(group);
    }
  }
}

function renderNodesToLayer(group: L.LayerGroup, graph: RoadGraph, t: Translator): void {
  const renderer = L.canvas({ padding: 0.5 });
  const customNodes: Array<{ node: GraphNode; category: NodeCategory }> = [];

  for (const node of graph.nodes.values()) {
    const category = getNodeCategory(node, graph);
    if (category) {
      customNodes.push({ node, category });
    } else {
      createNodeMarker(node, renderer, null, t).addTo(group);
    }
  }

  // Draw custom connectors and overlay custom nodes on top
  renderCustomEdges(group, graph, t);
  for (const item of customNodes) {
    createNodeMarker(item.node, renderer, item.category, t).addTo(group);
  }
}

export function useNodesLayer(options: Readonly<UseNodesLayerOptions>) {
  const { map, graph, showNodes } = options;
  const { t } = useTranslation();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    layerGroupRef.current ??= L.layerGroup().addTo(map);
    const group = layerGroupRef.current;
    group.clearLayers();

    if (showNodes && graph) {
      renderNodesToLayer(group, graph, t);
    }
  }, [map, graph, showNodes, t]);
}
