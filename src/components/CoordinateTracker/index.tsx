import type { GtaCoords } from '../../engine/types';
import styles from './CoordinateTracker.module.css';

export interface CoordinateTrackerProps {
  coords: GtaCoords;
}

export function CoordinateTracker({ coords }: Readonly<CoordinateTrackerProps>) {
  return (
    <div className={styles.coordDisplay}>
      📍 X: {coords.x} | Y: {coords.y}
    </div>
  );
}
