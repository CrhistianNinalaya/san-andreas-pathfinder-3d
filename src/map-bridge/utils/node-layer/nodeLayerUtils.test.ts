import { describe, it, expect } from 'vitest';
import {
  getNodeCategory,
  getNodeTitle,
  shouldRenderCustomEdge,
  getUndirectedEdgeKey,
  getCustomEdgeColor,
  getCustomEdgeTitle,
  getOneWayBadge,
  groupNodesByCoordinates,
  isOfficialNodeVisible,
  isCustomNodeVisible
} from './nodeLayerUtils';
import type { GraphNode, AdjacencyEdge } from '../../../engine/types';
import { RoadGraph } from '../../../engine/RoadGraph';
import { MAP_TOKENS, NODE_LAYER_THEME } from '../../theme';

describe('nodeLayerUtils', () => {
  const dummyTranslator = (key: string, params?: Record<string, string | number>) => {
    if (params) {
      return Object.entries(params).reduce(
        (str, [k, v]) => str.replace(`{${k}}`, String(v)),
        key
      );
    }
    return key;
  };

  describe('getUndirectedEdgeKey', () => {
    it('creates canonical undirected pair key independent of traversal order', () => {
      expect(getUndirectedEdgeKey('10', '20')).toBe('10->20');
      expect(getUndirectedEdgeKey('20', '10')).toBe('10->20');
      expect(getUndirectedEdgeKey('abc', 'def')).toBe('abc->def');
      expect(getUndirectedEdgeKey('def', 'abc')).toBe('abc->def');
    });
  });

  describe('shouldRenderCustomEdge', () => {
    it('returns false for standard non-custom edges', () => {
      const edge: AdjacencyEdge = {
        to: '2',
        distance: 10,
        slope: 0,
        slopePercent: 0,
        nominalSpeed: 60
      };
      expect(shouldRenderCustomEdge(edge)).toBe(false);
    });

    it('filters patches based on layer filter state', () => {
      const patchEdge: AdjacencyEdge = {
        to: '2',
        distance: 10,
        slope: 0,
        slopePercent: 0,
        nominalSpeed: 60,
        isCustom: true,
        type: 'patch'
      };
      expect(shouldRenderCustomEdge(patchEdge, { officialGiant: true, officialIsolated: true, shortcuts: true, patches: true, coincidentNodes: false })).toBe(true);
      expect(shouldRenderCustomEdge(patchEdge, { officialGiant: true, officialIsolated: true, shortcuts: true, patches: false, coincidentNodes: false })).toBe(false);
    });

    it('filters shortcuts based on layer filter state', () => {
      const shortcutEdge: AdjacencyEdge = {
        to: '2',
        distance: 10,
        slope: 0,
        slopePercent: 0,
        nominalSpeed: 60,
        isCustom: true,
        type: 'shortcut'
      };
      expect(shouldRenderCustomEdge(shortcutEdge, { officialGiant: true, officialIsolated: true, shortcuts: true, patches: true, coincidentNodes: false })).toBe(true);
      expect(shouldRenderCustomEdge(shortcutEdge, { officialGiant: true, officialIsolated: true, shortcuts: false, patches: true, coincidentNodes: false })).toBe(false);
    });
  });

  describe('getCustomEdgeColor and getCustomEdgeTitle', () => {
    it('returns custom edge color and title fallback for patches and shortcuts', () => {
      const patchEdge: AdjacencyEdge = {
        to: '2',
        distance: 10,
        slope: 0,
        slopePercent: 0,
        nominalSpeed: 60,
        type: 'patch'
      };
      expect(getCustomEdgeColor(patchEdge)).toBe(NODE_LAYER_THEME.patch.fillColor);
      expect(getCustomEdgeTitle(patchEdge, dummyTranslator)).toBe('edgePatch');

      const customEdge: AdjacencyEdge = {
        to: '3',
        distance: 20,
        slope: 0,
        slopePercent: 0,
        nominalSpeed: 60,
        type: 'shortcut',
        color: '#ff00aa',
        description: 'My Shortcut'
      };
      expect(getCustomEdgeColor(customEdge)).toBe('#ff00aa');
      expect(getCustomEdgeTitle(customEdge, dummyTranslator)).toBe('My Shortcut');
    });
  });

  describe('getOneWayBadge', () => {
    it('returns empty string if edge is bidirectional', () => {
      expect(getOneWayBadge(false, dummyTranslator)).toBe('');
      expect(getOneWayBadge(undefined, dummyTranslator)).toBe('');
    });

    it('returns formatted badge with warning color if one-way', () => {
      const badge = getOneWayBadge(true, dummyTranslator);
      expect(badge).toContain(MAP_TOKENS.warning);
      expect(badge).toContain('edgeOneWay');
    });
  });

  describe('groupNodesByCoordinates', () => {
    it('clusters nodes that share identical 2D coordinates', () => {
      const nodes: GraphNode[] = [
        { id: '1', name: 'N1', x: 100.0, y: 200.0, z: 10, componentId: 1, isGiantComponent: true },
        { id: '2', name: 'N2', x: 100.0, y: 200.0, z: 25, componentId: 1, isGiantComponent: true },
        { id: '3', name: 'N3', x: 500.0, y: 600.0, z: 5, componentId: 1, isGiantComponent: true }
      ];

      const grouped = groupNodesByCoordinates(nodes);
      expect(grouped.size).toBe(2);
      expect(grouped.get('100.0,200.0')).toHaveLength(2);
      expect(grouped.get('500.0,600.0')).toHaveLength(1);
    });
  });

  describe('isOfficialNodeVisible and isCustomNodeVisible', () => {
    it('evaluates official giant vs isolated node visibility', () => {
      const giantNode: GraphNode = { id: '1', name: 'G', x: 0, y: 0, z: 0, componentId: 1, isGiantComponent: true };
      const isolatedNode: GraphNode = { id: '2', name: 'I', x: 0, y: 0, z: 0, componentId: 2, isGiantComponent: false };

      expect(isOfficialNodeVisible(giantNode, { officialGiant: true, officialIsolated: false, shortcuts: true, patches: true, coincidentNodes: false })).toBe(true);
      expect(isOfficialNodeVisible(giantNode, { officialGiant: false, officialIsolated: false, shortcuts: true, patches: true, coincidentNodes: false })).toBe(false);

      expect(isOfficialNodeVisible(isolatedNode, { officialGiant: true, officialIsolated: false, shortcuts: true, patches: true, coincidentNodes: false })).toBe(false);
      expect(isOfficialNodeVisible(isolatedNode, { officialGiant: true, officialIsolated: true, shortcuts: true, patches: true, coincidentNodes: false })).toBe(true);
    });

    it('evaluates custom node visibility for patches and shortcuts', () => {
      expect(isCustomNodeVisible('patch', { officialGiant: true, officialIsolated: false, shortcuts: true, patches: true, coincidentNodes: false })).toBe(true);
      expect(isCustomNodeVisible('patch', { officialGiant: true, officialIsolated: false, shortcuts: true, patches: false, coincidentNodes: false })).toBe(false);

      expect(isCustomNodeVisible('shortcut', { officialGiant: true, officialIsolated: false, shortcuts: true, patches: true, coincidentNodes: false })).toBe(true);
      expect(isCustomNodeVisible('shortcut', { officialGiant: true, officialIsolated: false, shortcuts: false, patches: true, coincidentNodes: false })).toBe(false);
    });
  });

  describe('getNodeCategory and getNodeTitle', () => {
    it('detects category from node or adjacent edges', () => {
      const graph = new RoadGraph();
      const node: GraphNode = { id: '1', name: 'N1', x: 0, y: 0, z: 0, componentId: 1, isGiantComponent: true, customType: 'patch' };
      expect(getNodeCategory(node, graph)).toBe('patch');

      const shortcutNode: GraphNode = {
        id: '2',
        name: 'S2',
        x: 0,
        y: 0,
        z: 0,
        componentId: 1,
        isGiantComponent: true,
        customType: 'shortcut',
        shortcutId: 1,
        pointIndex: 5,
        totalPoints: 23,
        colorToken: 'gold'
      };
      expect(getNodeCategory(shortcutNode, graph)).toBe('shortcut');
      expect(getNodeTitle(shortcutNode, { category: 'shortcut', t: dummyTranslator })).toContain('shortcutPointLabel');
    });
  });
});
