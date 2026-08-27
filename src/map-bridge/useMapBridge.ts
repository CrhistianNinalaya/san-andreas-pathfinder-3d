import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import mapImageUrl from '../assets/mapa-gta-sa-hd.webp';
import { GTA_BOUNDS, GTA_CENTERS, latLngToGta } from '../geo/coordinates';
import type { GtaCoords } from '../engine/types';

export interface UseMapBridgeOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onMapClick: (coords: GtaCoords) => void;
  onCursorMove?: (coords: GtaCoords) => void;
}

export function useMapBridge(options: Readonly<UseMapBridgeOptions>) {
  const { containerRef, onMapClick, onCursorMove } = options;
  const mapRef = useRef<L.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Create Leaflet instance ONCE
    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 4,
      maxBounds: [
        [-3800, -3800],
        [3800, 3800]
      ],
      maxBoundsViscosity: 0.7,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Overlay Ultra HD GTA San Andreas Map (Vite auto content-hashed)
    L.imageOverlay(mapImageUrl, GTA_BOUNDS.leafletBounds).addTo(map);

    // Initial View
    map.setView(GTA_CENTERS.all.center, GTA_CENTERS.all.zoom);

    // Event Listeners with Bounds Validation
    map.on('click', (e: L.LeafletMouseEvent) => {
      const gta = latLngToGta(e.latlng);
      if (gta.x < -3000 || gta.x > 3000 || gta.y < -3000 || gta.y > 3000) {
        return; // Ignore clicks outside the GTA map bounds
      }
      onMapClick(gta);
    });

    if (onCursorMove) {
      map.on('mousemove', (e: L.LeafletMouseEvent) => {
        const gta = latLngToGta(e.latlng);
        onCursorMove(gta);
      });
    }

    mapRef.current = map;
    setIsMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return { map: mapRef.current, isMapReady };
}
