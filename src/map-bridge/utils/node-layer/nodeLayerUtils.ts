import type { RoadGraph } from '../../../engine/RoadGraph';
import type { GraphNode, AdjacencyEdge } from '../../../engine/types';
import { NODE_LAYER_THEME, MAP_TOKENS } from '../../theme';
import type { TranslationKey } from '../../../i18n/translations';
import type { LayerFilters } from '../../../features/route/routeReducer';

export type NodeCategory = 'patch' | 'shortcut' | null;
export type Translator = (key: TranslationKey, params?: Record<string, string | number>) => string;

export interface NodeTitleOptions {
  category: NodeCategory;
  t: Translator;
}

export interface NodePopupOptions {
  node: GraphNode;
  category: NodeCategory;
  t: Translator;
}

export interface EdgePopupOptions {
  edge: AdjacencyEdge;
  fromNode: GraphNode;
  toNode: GraphNode;
  color: string;
  title: string;
  t: Translator;
}

/**
 * Determines whether a node is an official patch, curated shortcut, or regular node.
 */
export function getNodeCategory(node: GraphNode, graph: RoadGraph): NodeCategory {
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
export function getNodeTitle(node: GraphNode, options: Readonly<NodeTitleOptions>): string {
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
export function getNodeThemeStyle(node: GraphNode, category: NodeCategory) {
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
export function buildPopupHtml(options: Readonly<NodePopupOptions>): string {
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
 * Determines whether a custom edge meets active layer filter conditions.
 */
export function shouldRenderCustomEdge(edge: AdjacencyEdge, filters?: LayerFilters): boolean {
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
export function getUndirectedEdgeKey(fromId: string, toId: string): string {
  if (fromId < toId) {
    return `${fromId}->${toId}`;
  }
  return `${toId}->${fromId}`;
}

/**
 * Retrieves display color for a custom edge.
 */
export function getCustomEdgeColor(edge: AdjacencyEdge): string {
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
export function getCustomEdgeTitle(edge: AdjacencyEdge, t: Translator): string {
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
export function getOneWayBadge(isOneWay: boolean | undefined, t: Translator): string {
  if (!isOneWay) {
    return '';
  }
  return `<br/><span style="color: ${MAP_TOKENS.warning}; font-weight: 600;">${t('edgeOneWay')}</span>`;
}

/**
 * Builds localized HTML content for a custom edge popup.
 */
export function buildEdgePopupHtml(options: Readonly<EdgePopupOptions>): string {
  const { edge, fromNode, toNode, color, title, t } = options;
  const oneWayBadge = getOneWayBadge(edge.oneWay, t);

  return `<div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4;">
    <strong style="color: ${color}; font-size: 13px;">${title}</strong><br/>
    <strong>${t('edgeConnection', { from: fromNode.name, to: toNode.name })}</strong><br/>
    <strong>${t('edgeDistance', { dist: Math.round(edge.distance) })}</strong>${oneWayBadge}
  </div>`;
}

/**
 * Groups graph nodes sharing identical 2D world coordinates.
 */
export function groupNodesByCoordinates(nodes: Iterable<GraphNode>): Map<string, GraphNode[]> {
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
 * Evaluates visibility for an official network node against active layer filters.
 */
export function isOfficialNodeVisible(node: GraphNode, filters?: LayerFilters): boolean {
  if (node.isGiantComponent) {
    return filters?.officialGiant !== false;
  }
  return filters?.officialIsolated !== false;
}

/**
 * Evaluates visibility for a custom network node against active layer filters.
 */
export function isCustomNodeVisible(category: 'patch' | 'shortcut', filters?: LayerFilters): boolean {
  if (category === 'patch') {
    return filters?.patches !== false;
  }
  return filters?.shortcuts !== false;
}
