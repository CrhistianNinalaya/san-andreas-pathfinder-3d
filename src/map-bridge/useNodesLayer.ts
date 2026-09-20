import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { gtaToLatLng } from '../geo/coordinates';
import type { RoadGraph } from '../engine/RoadGraph';
import type { GraphNode, AdjacencyEdge } from '../engine/types';
import { NODE_LAYER_THEME, MAP_TOKENS } from './theme';
import { useTranslation } from '../i18n/useTranslation';
import type { TranslationKey } from '../i18n/translations';
import type { LayerFilters } from '../features/route/routeReducer';

/**
 * Options for the road network node rendering hook.
 */
export interface UseNodesLayerOptions {
  map: L.Map | null;
  graph: RoadGraph | null;
  showNodes: boolean;
  filters?: LayerFilters;
}

type NodeCategory = 'patch' | 'shortcut' | null;
type Translator = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface NodeTitleOptions {
  category: NodeCategory;
  t: Translator;
}

interface NodePopupOptions {
  node: GraphNode;
  category: NodeCategory;
  t: Translator;
}

interface CreateNodeMarkerOptions {
  node: GraphNode;
  renderer: L.Canvas;
  category: NodeCategory;
  t: Translator;
}

interface EdgePopupOptions {
  edge: AdjacencyEdge;
  fromNode: GraphNode;
  toNode: GraphNode;
  color: string;
  title: string;
  t: Translator;
}

interface EdgePolylineOptions {
  edge: AdjacencyEdge;
  fromNode: GraphNode;
  toNode: GraphNode;
  t: Translator;
}

interface RenderNodeEdgesOptions {
  fromNode: GraphNode;
  edges: AdjacencyEdge[];
  graph: RoadGraph;
  filters?: LayerFilters;
  seen: Set<string>;
  group: L.LayerGroup;
  t: Translator;
}

interface RenderCustomEdgesOptions {
  group: L.LayerGroup;
  graph: RoadGraph;
  filters?: LayerFilters;
  t: Translator;
}

interface RenderNodesLayerOptions {
  group: L.LayerGroup;
  graph: RoadGraph;
  filters?: LayerFilters;
  renderer: L.Canvas;
  t: Translator;
}

interface RenderCoincidentClusterOptions {
  nodes: GraphNode[];
  group: L.LayerGroup;
  graph: RoadGraph;
  t: Translator;
}

interface RenderCoincidentNodesOptions {
  group: L.LayerGroup;
  graph: RoadGraph;
  t: Translator;
}

interface RenderNodesToLayerOptions {
  group: L.LayerGroup;
  graph: RoadGraph;
  filters?: LayerFilters;
  t: Translator;
}

/**
 * Determines whether a node is an official patch, curated shortcut, or regular node.
 */
function getNodeCategory(node: GraphNode, graph: RoadGraph): NodeCategory {
  if (node.customType === 'patch') return 'patch';
  if (node.customType === 'shortcut' || node.customType === 'offroad' || node.customType === 'jump') return 'shortcut';

  const adj = graph.adjacencyList.get(node.id);
  if (adj?.some((e) => e.type === 'patch')) return 'patch';
  if (adj?.some((e) => e.isCustom)) return 'shortcut';
  if (node.isCustom) return 'shortcut';
  return null;
}

/**
 * Formats a localized node title from structured fields or node name fallback.
 */
function getNodeTitle(node: GraphNode, options: Readonly<NodeTitleOptions>): string {
  const { category, t } = options;

  if (category === 'shortcut' && node.shortcutId !== undefined && node.pointIndex !== undefined) {
    const total = node.totalPoints ?? 0;
    if (node.colorToken) {
      const colorKey = `shortcutColor_${node.colorToken}` as TranslationKey;
      const translatedColor = t(colorKey);
      return t('shortcutPointLabel', {
        id: node.shortcutId,
        color: translatedColor,
        point: node.pointIndex,
        total
      });
    }
    return t('shortcutPointLabelNoColor', {
      id: node.shortcutId,
      point: node.pointIndex,
      total
    });
  }
  return node.name;
}

/**
 * Retrieves the rendering style configuration for a road network node.
 */
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

/**
 * Builds localized HTML content for a node popup.
 */
function buildPopupHtml(options: Readonly<NodePopupOptions>): string {
  const { node, category, t } = options;
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

  const title = getNodeTitle(node, { category, t });

  return `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4;">
    <strong style="color: ${statusColor}; font-size: 13px;">${title}</strong><br/>
    <strong>${t('nodeId')}</strong> ${node.id}<br/>
    <strong>${t('nodeCoords')}</strong> (${node.x}, ${node.y})<br/>
    <strong>${t('nodeAltitude')}</strong> ${node.z} m<br/>
    <strong>${t('nodeStatus')}</strong> ${statusLabel}
  </div>`;
}

/**
 * Creates a Leaflet circle marker for a graph node with appropriate styling and popup.
 */
function createNodeMarker(options: Readonly<CreateNodeMarkerOptions>): L.CircleMarker {
  const { node, renderer, category, t } = options;
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

  circle.bindPopup(buildPopupHtml({ node, category, t }));
  return circle;
}

/**
 * Determines whether a custom edge meets active layer filter conditions.
 */
function shouldRenderCustomEdge(edge: AdjacencyEdge, filters?: LayerFilters): boolean {
  if (!edge.isCustom && !edge.type) {
    return false;
  }
  if (edge.type === 'patch') {
    return filters?.patches !== false;
  }
  return filters?.shortcuts !== false;
}

/**
 * Returns an undirected unique lookup key for an edge pair.
 */
function getUndirectedEdgeKey(fromId: string, toId: string): string {
  if (fromId < toId) {
    return `${fromId}->${toId}`;
  }
  return `${toId}->${fromId}`;
}

/**
 * Retrieves display color for a custom edge.
 */
function getCustomEdgeColor(edge: AdjacencyEdge): string {
  if (edge.color) {
    return edge.color;
  }
  if (edge.type === 'patch') {
    return NODE_LAYER_THEME.patch.fillColor;
  }
  return NODE_LAYER_THEME.shortcut.fillColor;
}

/**
 * Retrieves display title for a custom edge.
 */
function getCustomEdgeTitle(edge: AdjacencyEdge, t: Translator): string {
  if (edge.description) {
    return edge.description;
  }
  if (edge.type === 'patch') {
    return t('edgePatch');
  }
  return t('edgeShortcut');
}

/**
 * Returns HTML badge for one-way custom edges.
 */
function getOneWayBadge(isOneWay: boolean | undefined, t: Translator): string {
  if (!isOneWay) {
    return '';
  }
  return `<br/><span style="color: ${MAP_TOKENS.warning}; font-weight: 600;">${t('edgeOneWay')}</span>`;
}

/**
 * Builds localized HTML content for a custom edge popup.
 */
function buildEdgePopupHtml(options: Readonly<EdgePopupOptions>): string {
  const { edge, fromNode, toNode, color, title, t } = options;
  const oneWayBadge = getOneWayBadge(edge.oneWay, t);

  return `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4;">
    <strong style="color: ${color}; font-size: 13px;">${title}</strong><br/>
    <strong>${t('edgeConnection', { from: fromNode.name, to: toNode.name })}</strong><br/>
    <strong>${t('edgeDistance', { dist: Math.round(edge.distance) })}</strong>${oneWayBadge}
  </div>`;
}

/**
 * Creates a Leaflet polyline for a custom edge with dashed styling and popup.
 */
function createCustomPolyline(options: Readonly<EdgePolylineOptions>): L.Polyline {
  const { edge, fromNode, toNode, t } = options;
  const color = getCustomEdgeColor(edge);
  const title = getCustomEdgeTitle(edge, t);

  const polyline = L.polyline(
    [gtaToLatLng(fromNode.x, fromNode.y), gtaToLatLng(toNode.x, toNode.y)],
    {
      color,
      weight: 3.5,
      opacity: 0.95,
      dashArray: '6, 6',
      lineCap: 'round',
      lineJoin: 'round'
    }
  );

  polyline.bindPopup(buildEdgePopupHtml({ edge, fromNode, toNode, color, title, t }));
  return polyline;
}

/**
 * Renders all outbound custom edges for a single origin node.
 */
function renderFromNodeEdges(options: Readonly<RenderNodeEdgesOptions>): void {
  const { fromNode, edges, graph, filters, seen, group, t } = options;

  for (const edge of edges) {
    if (!shouldRenderCustomEdge(edge, filters)) {
      continue;
    }

    const toNode = graph.nodes.get(edge.to);
    if (!toNode) {
      continue;
    }

    const edgeKey = getUndirectedEdgeKey(fromNode.id, edge.to);
    if (seen.has(edgeKey)) {
      continue;
    }
    seen.add(edgeKey);

    const polyline = createCustomPolyline({ edge, fromNode, toNode, t });
    polyline.addTo(group);
  }
}

/**
 * Renders custom network edges such as official patches and community shortcuts.
 */
function renderCustomEdges(options: Readonly<RenderCustomEdgesOptions>): void {
  const { group, graph, filters, t } = options;
  const seen = new Set<string>();

  for (const [fromId, edges] of graph.adjacencyList.entries()) {
    const fromNode = graph.nodes.get(fromId);
    if (!fromNode) {
      continue;
    }

    renderFromNodeEdges({ fromNode, edges, graph, filters, seen, group, t });
  }
}

/**
 * Groups graph nodes sharing identical 2D world coordinates.
 */
function groupNodesByCoordinates(nodes: Iterable<GraphNode>): Map<string, GraphNode[]> {
  const coordMap = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const key = `${node.x.toFixed(1)},${node.y.toFixed(1)}`;
    const list = coordMap.get(key);
    if (list) {
      list.push(node);
    } else {
      coordMap.set(key, [node]);
    }
  }
  return coordMap;
}

/**
 * Renders a diagnostic marker ring and popup for a coincident node cluster.
 */
function renderCoincidentCluster(options: Readonly<RenderCoincidentClusterOptions>): void {
  const { nodes, group, graph, t } = options;
  const firstNode = nodes.at(0);
  if (!firstNode) {
    return;
  }

  const latlng = gtaToLatLng(firstNode.x, firstNode.y);
  const theme = NODE_LAYER_THEME.coincident;
  const ring = L.circleMarker(latlng, {
    radius: theme.radius,
    weight: theme.weight,
    color: theme.color,
    fillColor: theme.fillColor,
    fillOpacity: theme.fillOpacity,
    dashArray: '4, 3'
  });

  const nodesDesc = nodes
    .map((n) => `• <strong>${n.id}</strong>: ${getNodeTitle(n, { category: getNodeCategory(n, graph), t })} (${n.z}m)`)
    .join('<br/>');

  ring.bindPopup(
    `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4;">
      <strong style="color: ${theme.titleColor}; font-size: 13px;">⚠️ ${t('legendCoincident')} (${nodes.length})</strong><br/>
      <strong>${t('nodeCoords')}</strong> (${firstNode.x}, ${firstNode.y})<br/>
      <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(0,0,0,0.1);">
        ${nodesDesc}
      </div>
    </div>`
  );

  ring.addTo(group);
}

/**
 * Renders diagnostic rings at world coordinates containing coincident node definitions.
 */
function renderCoincidentNodes(options: Readonly<RenderCoincidentNodesOptions>): void {
  const { group, graph, t } = options;
  const coordMap = groupNodesByCoordinates(graph.nodes.values());

  for (const nodes of coordMap.values()) {
    if (nodes.length > 1) {
      renderCoincidentCluster({ nodes, group, graph, t });
    }
  }
}

/**
 * Evaluates visibility for an official network node against active layer filters.
 */
function isOfficialNodeVisible(node: GraphNode, filters?: LayerFilters): boolean {
  if (node.isGiantComponent) {
    return filters?.officialGiant !== false;
  }
  return filters?.officialIsolated !== false;
}

/**
 * Evaluates visibility for a custom network node against active layer filters.
 */
function isCustomNodeVisible(category: 'patch' | 'shortcut', filters?: LayerFilters): boolean {
  if (category === 'patch') {
    return filters?.patches !== false;
  }
  return filters?.shortcuts !== false;
}

/**
 * Draws visible official traffic nodes onto the Leaflet canvas layer.
 */
function renderOfficialNodes(options: Readonly<RenderNodesLayerOptions>): void {
  const { group, graph, filters, renderer, t } = options;

  for (const node of graph.nodes.values()) {
    const category = getNodeCategory(node, graph);
    if (category !== null) {
      continue;
    }
    if (!isOfficialNodeVisible(node, filters)) {
      continue;
    }

    createNodeMarker({ node, renderer, category: null, t }).addTo(group);
  }
}

/**
 * Draws visible custom nodes (shortcuts and patches) onto the Leaflet canvas layer.
 */
function renderCustomNodes(options: Readonly<RenderNodesLayerOptions>): void {
  const { group, graph, filters, renderer, t } = options;

  for (const node of graph.nodes.values()) {
    const category = getNodeCategory(node, graph);
    if (!category) {
      continue;
    }
    if (!isCustomNodeVisible(category, filters)) {
      continue;
    }

    createNodeMarker({ node, renderer, category, t }).addTo(group);
  }
}

/**
 * Draws filtered road nodes and custom connectors onto the Leaflet layer group.
 */
function renderNodesToLayer(options: Readonly<RenderNodesToLayerOptions>): void {
  const { group, graph, filters, t } = options;
  const renderer = L.canvas({ padding: 0.5 });

  renderOfficialNodes({ group, graph, filters, renderer, t });
  renderCustomEdges({ group, graph, filters, t });
  renderCustomNodes({ group, graph, filters, renderer, t });

  if (filters?.coincidentNodes) {
    renderCoincidentNodes({ group, graph, t });
  }
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
