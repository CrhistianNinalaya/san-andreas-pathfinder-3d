import { describe, it, expect, vi } from 'vitest';
import type { RouteResult } from '../../../engine/types';
import { renderRoutesToLayer } from './routeLayerRenderer';

interface MockLayer {
  addTo: (group: unknown) => MockLayer;
  on: (event: string, handler: () => void) => MockLayer;
}

const mockLayers: MockLayer[] = [];

vi.mock('leaflet', () => {
  return {
    default: {
      polyline: vi.fn(() => {
        const layer: MockLayer = {
          addTo: (group: unknown) => {
            (group as { addLayer: (l: unknown) => void }).addLayer(layer);
            return layer;
          },
          on: vi.fn().mockReturnThis()
        };
        mockLayers.push(layer);
        return layer;
      })
    }
  };
});

describe('routeLayerRenderer', () => {
  it('renders active route and alternatives to layer group', () => {
    const added: unknown[] = [];
    const group = {
      addLayer: vi.fn((l: unknown) => added.push(l))
    } as unknown as import('leaflet').LayerGroup;

    const mockElevationProfile = {
      points: [],
      elevationGain: 0,
      elevationLoss: 0,
      minElevation: 0,
      maxElevation: 0
    };

    const routes: RouteResult[] = [
      {
        path: [
          { id: '1', name: 'N1', x: 0, y: 0, z: 0, componentId: 0, isGiantComponent: true },
          { id: '2', name: 'N2', x: 100, y: 0, z: 0, componentId: 0, isGiantComponent: true }
        ],
        nodeIds: ['1', '2'],
        totalDistance: 100,
        totalTimeSeconds: 10,
        elevationProfile: mockElevationProfile,
        usedEdges: [],
        isOptimal: true
      },
      {
        path: [
          { id: '1', name: 'N1', x: 0, y: 0, z: 0, componentId: 0, isGiantComponent: true },
          { id: '3', name: 'N3', x: 50, y: 50, z: 0, componentId: 0, isGiantComponent: true },
          { id: '2', name: 'N2', x: 100, y: 0, z: 0, componentId: 0, isGiantComponent: true }
        ],
        nodeIds: ['1', '3', '2'],
        totalDistance: 150,
        totalTimeSeconds: 15,
        elevationProfile: mockElevationProfile,
        usedEdges: [],
        isOptimal: false
      }
    ];

    renderRoutesToLayer({
      group,
      routes,
      activeRouteIndex: 0,
      onSelectAlternative: vi.fn()
    });

    expect(added.length).toBeGreaterThan(0);
  });
});
