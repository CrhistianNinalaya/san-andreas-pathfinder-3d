import { useTranslation } from '../../i18n/useTranslation';
import type { Waypoint } from '../../map-bridge/hooks/useWaypointMarkers';
import styles from './WaypointsList.module.css';

interface WaypointsListProps {
  waypoints: Waypoint[];
  onRemove: (index: number) => void;
}

export function WaypointsList({ waypoints, onRemove }: Readonly<WaypointsListProps>) {
  const { t } = useTranslation();
  const total = waypoints.length;

  if (total === 0) {
    return (
      <div className={styles.emptyHint}>
        💡 {t('addWaypointHint')}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {waypoints.map((wp, idx) => {
        let badgeClass = styles.badgeWaypoint;
        let roleText = t('stop', { label: wp.label });

        if (idx === 0) {
          badgeClass = styles.badgeStart;
          roleText = t('origin');
        } else if (idx === total - 1 && total > 1) {
          badgeClass = styles.badgeEnd;
          roleText = t('destination');
        }

        return (
          <div key={wp.id} className={styles.waypointItem}>
            <div className={styles.waypointLeft}>
              <div className={`${styles.badgeCircle} ${badgeClass}`}>
                {wp.label}
              </div>
              <div className={styles.infoCol}>
                <span className={styles.roleText}>{roleText}</span>
                <span className={styles.coordText}>
                  X: {wp.snapNode.x}, Y: {wp.snapNode.y}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onRemove(idx)}
              title="Remove"
              className={styles.removeBtn}
            >
              ✖
            </button>
          </div>
        );
      })}
    </div>
  );
};
