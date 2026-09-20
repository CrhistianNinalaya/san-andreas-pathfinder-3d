import { useRef } from 'react';
import type { MapCanvasProps } from './types';
import { useMapIntegration } from './hooks/useMapIntegration';
import styles from './MapCanvas.module.css';

/**
 * Renders the full-screen Leaflet interactive map canvas with custom road network and route layers.
 */
export function MapCanvas({
  routes,
  activeRouteIndex,
  waypoints,
  graph,
  showNodes,
  layerFilters,
  onMapClick,
  onCursorMove,
  onWaypointDrag,
  onSelectAlternative,
  onMapReady
}: Readonly<MapCanvasProps>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useMapIntegration({
    containerRef,
    routes,
    activeRouteIndex,
    waypoints,
    graph,
    showNodes,
    layerFilters,
    onMapClick,
    onCursorMove,
    onWaypointDrag,
    onSelectAlternative,
    onMapReady
  });

  return <div ref={containerRef} className={styles.mapCanvas} />;
}
