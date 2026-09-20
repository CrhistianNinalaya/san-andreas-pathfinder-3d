import { describe, it, expect, vi } from 'vitest';
import type { RoadGraph } from '../../../engine/RoadGraph';
import type { GraphNode, AdjacencyEdge } from '../../../engine/types';
import {
  createNodeMarker,
  createCustomPolyline,
  renderNodesToLayer
} from './nodeLayerRenderer';

interface MockLayer {
  addTo: (group: unknown) => MockLayer;
  bindPopup: (content: string) => MockLayer;
  options?: unknown;
  latlng?: unknown;
  latlngs?: unknown;
}

const mockLayers: MockLayer[] = [];

vi.mock('leaflet', () => {
  return {
    default: {
      canvas: vi.fn(() => ({})),
      circleMarker: vi.fn((latlng, options) => {
        const layer: MockLayer = {
          latlng,
          options,
          addTo: (group: unknown) => {
            (group as { addLayer: (l: unknown) => void }).addLayer(layer);
            return layer;
          },
          bindPopup: vi.fn().mockReturnThis()
        };
        mockLayers.push(layer);
        return layer;
      }),
      polyline: vi.fn((latlngs, options) => {
        const layer: MockLayer = {
          latlngs,
          options,
          addTo: (group: unknown) => {
            (group as { addLayer: (l: unknown) => void }).addLayer(layer);
            return layer;
          },
          bindPopup: vi.fn().mockReturnThis()
        };
        mockLayers.push(layer);
        return layer;
      })
    }
  };
});

describe('nodeLayerRenderer', () => {
  const dummyTranslator = (key: string) => key;

  it('creates circle marker with popup', () => {
    const node: GraphNode = {
      id: 'n1',
      name: 'Node 1',
      x: 100,
      y: 200,
      z: 10,
      componentId: 1,
      isGiantComponent: true
    };
    const renderer = {} as never;

    const marker = createNodeMarker({
      node,
      renderer,
      category: null,
      t: dummyTranslator
    });

    expect(marker).toBeDefined();
    expect(marker.bindPopup).toHaveBeenCalled();
  });

  it('creates custom polyline with popup', () => {
    const fromNode: GraphNode = {
      id: 'f1',
      name: 'From',
      x: 0,
      y: 0,
      z: 0,
      componentId: 1,
      isGiantComponent: true
    };
    const toNode: GraphNode = {
      id: 't1',
      name: 'To',
      x: 10,
      y: 10,
      z: 0,
      componentId: 1,
      isGiantComponent: true
    };
    const edge: AdjacencyEdge = {
      to: 't1',
      distance: 10,
      speed: 60,
      nominalSpeed: 60,
      slope: 0,
      slopePercent: 0,
      type: 'shortcut',
      isCustom: true
    };

    const polyline = createCustomPolyline({
      edge,
      fromNode,
      toNode,
      t: dummyTranslator
    });

    expect(polyline).toBeDefined();
    expect(polyline.bindPopup).toHaveBeenCalled();
  });

  it('renders nodes and custom edges to layer group', () => {
    const added: unknown[] = [];
    const group = {
      addLayer: vi.fn((l: unknown) => added.push(l))
    } as unknown as import('leaflet').LayerGroup;

    const mockEdge: AdjacencyEdge = {
      to: '2',
      distance: 14,
      speed: 60,
      nominalSpeed: 60,
      slope: 0,
      slopePercent: 0,
      isCustom: true
    };

    const mockGraph = {
      nodes: new Map<string, GraphNode>([
        [
          '1',
          { id: '1', name: 'Official 1', x: 0, y: 0, z: 0, componentId: 1, isGiantComponent: true }
        ],
        [
          '2',
          { id: '2', name: 'Shortcut 1', x: 10, y: 10, z: 0, componentId: 1, isGiantComponent: true, isCustom: true, customType: 'shortcut' }
        ]
      ]),
      adjacencyList: new Map<string, AdjacencyEdge[]>([
        ['1', [mockEdge]],
        ['2', []]
      ])
    } as unknown as RoadGraph;

    renderNodesToLayer({
      group,
      graph: mockGraph,
      filters: {
        officialGiant: true,
        officialIsolated: true,
        shortcuts: true,
        patches: true,
        coincidentNodes: true
      },
      t: dummyTranslator
    });

    expect(added.length).toBeGreaterThan(0);
  });
});
