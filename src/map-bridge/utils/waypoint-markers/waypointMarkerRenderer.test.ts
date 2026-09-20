import { describe, it, expect, vi } from 'vitest';
import type { Waypoint } from './waypointMarkerRenderer';
import { createWaypointMarker, renderWaypointMarkers } from './waypointMarkerRenderer';

interface MockMarker {
  addTo: (group: unknown) => MockMarker;
  on: (event: string, handler: (e?: unknown) => void) => MockMarker;
}

const mockMarkers: MockMarker[] = [];

vi.mock('leaflet', () => {
  return {
    default: {
      divIcon: vi.fn(() => ({})),
      marker: vi.fn(() => {
        const marker: MockMarker = {
          addTo: (group: unknown) => {
            (group as { addLayer: (l: unknown) => void }).addLayer(marker);
            return marker;
          },
          on: vi.fn().mockReturnThis()
        };
        mockMarkers.push(marker);
        return marker;
      })
    }
  };
});

describe('waypointMarkerRenderer', () => {
  const sampleWaypoint: Waypoint = {
    id: 'wp1',
    label: 'A',
    coords: { x: 100, y: 200 },
    snapNode: {
      id: '1',
      name: 'N1',
      x: 100,
      y: 200,
      z: 10,
      componentId: 0,
      isGiantComponent: true
    }
  };

  it('creates draggable marker', () => {
    const marker = createWaypointMarker({
      wp: sampleWaypoint,
      idx: 0,
      total: 2,
      onDragEnd: vi.fn()
    });

    expect(marker).toBeDefined();
    expect(marker.on).toHaveBeenCalled();
  });

  it('renders all waypoints into group when visible', () => {
    const added: unknown[] = [];
    const group = {
      addLayer: vi.fn((l: unknown) => added.push(l))
    } as unknown as import('leaflet').LayerGroup;

    renderWaypointMarkers({
      group,
      waypoints: [sampleWaypoint],
      visible: true,
      onWaypointDrag: vi.fn()
    });

    expect(added).toHaveLength(1);
  });
});
