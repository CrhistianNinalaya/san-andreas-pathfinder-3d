import L from 'leaflet';
import { gtaToLatLng } from '../../../geo/coordinates';
import type { RoadGraph } from '../../../engine/RoadGraph';
import type { GraphNode, AdjacencyEdge } from '../../../engine/types';
import { NODE_LAYER_THEME } from '../../theme';
import type { LayerFilters } from '../../../features/route/routeReducer';
import {
  type NodeCategory,
  type Translator,
  getNodeCategory,
  getNodeTitle,
  getNodeThemeStyle,
  buildPopupHtml,
  shouldRenderCustomEdge,
  getUndirectedEdgeKey,
  getCustomEdgeColor,
  getCustomEdgeTitle,
  buildEdgePopupHtml,
  groupNodesByCoordinates,
  isOfficialNodeVisible,
  isCustomNodeVisible
} from './nodeLayerUtils';

export interface CreateNodeMarkerOptions {
  node: GraphNode;
  renderer: L.Canvas;
  category: NodeCategory;
  t: Translator;
}

export interface EdgePolylineOptions {
  edge: AdjacencyEdge;
  fromNode: GraphNode;
  toNode: GraphNode;
  t: Translator;
}

export interface RenderNodeEdgesOptions {
  fromNode: GraphNode;
  edges: AdjacencyEdge[];
  graph: RoadGraph;
  filters?: LayerFilters;
  seen: Set<string>;
  group: L.LayerGroup;
  t: Translator;
}

export interface RenderCustomEdgesOptions {
  group: L.LayerGroup;
  graph: RoadGraph;
  filters?: LayerFilters;
  t: Translator;
}

export interface RenderNodesLayerOptions {
  group: L.LayerGroup;
  graph: RoadGraph;
  filters?: LayerFilters;
  renderer: L.Canvas;
  t: Translator;
}

export interface RenderCoincidentClusterOptions {
  nodes: GraphNode[];
  group: L.LayerGroup;
  graph: RoadGraph;
  t: Translator;
}

export interface RenderCoincidentNodesOptions {
  group: L.LayerGroup;
  graph: RoadGraph;
  t: Translator;
}

export interface RenderNodesToLayerOptions {
  group: L.LayerGroup;
  graph: RoadGraph;
  filters?: LayerFilters;
  t: Translator;
}

/**
 * Creates a Leaflet circle marker for a graph node with appropriate styling and popup.
 */
export function createNodeMarker(options: Readonly<CreateNodeMarkerOptions>): L.CircleMarker {
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
 * Creates a Leaflet polyline for a custom edge with dashed styling and popup.
 */
export function createCustomPolyline(options: Readonly<EdgePolylineOptions>): L.Polyline {
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
export function renderFromNodeEdges(options: Readonly<RenderNodeEdgesOptions>): void {
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
export function renderCustomEdges(options: Readonly<RenderCustomEdgesOptions>): void {
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
 * Renders a diagnostic marker ring and popup for a coincident node cluster.
 */
export function renderCoincidentCluster(options: Readonly<RenderCoincidentClusterOptions>): void {
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
export function renderCoincidentNodes(options: Readonly<RenderCoincidentNodesOptions>): void {
  const { group, graph, t } = options;
  const coordMap = groupNodesByCoordinates(graph.nodes.values());

  for (const nodes of coordMap.values()) {
    if (nodes.length > 1) {
      renderCoincidentCluster({ nodes, group, graph, t });
    }
  }
}

/**
 * Draws visible official traffic nodes onto the Leaflet canvas layer.
 */
export function renderOfficialNodes(options: Readonly<RenderNodesLayerOptions>): void {
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
export function renderCustomNodes(options: Readonly<RenderNodesLayerOptions>): void {
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
export function renderNodesToLayer(options: Readonly<RenderNodesToLayerOptions>): void {
  const { group, graph, filters, t } = options;
  const renderer = L.canvas({ padding: 0.5 });

  renderOfficialNodes({ group, graph, filters, renderer, t });
  renderCustomEdges({ group, graph, filters, t });
  renderCustomNodes({ group, graph, filters, renderer, t });

  if (filters?.coincidentNodes) {
    renderCoincidentNodes({ group, graph, t });
  }
}
