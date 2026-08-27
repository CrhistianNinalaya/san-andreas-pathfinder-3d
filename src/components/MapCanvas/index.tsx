import { useRef } from 'react';
import type { MapCanvasProps } from './types';
import { useMapIntegration } from './hooks/useMapIntegration';
import styles from './MapCanvas.module.css';

export function MapCanvas({
  routes,
  activeRouteIndex,
  waypoints,
  graph,
  showNodes,
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
    onMapClick,
    onCursorMove,
    onWaypointDrag,
    onSelectAlternative,
    onMapReady
  });

  return <div ref={containerRef} className={styles.mapCanvas} />;
}
