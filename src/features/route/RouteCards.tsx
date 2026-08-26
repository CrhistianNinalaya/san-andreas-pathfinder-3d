import { useTranslation } from '../../i18n/useTranslation';
import { formatDistance, formatDuration } from '../../geo/coordinates';
import { VEHICLE_PROFILES, type VehicleProfileType } from '../../terrain/ElevationPhysics';
import { ElevationChart } from '../../components/ElevationChart';
import type { RouteResult } from '../../engine/types';
import styles from './RouteCards.module.css';

export interface RouteCardsProps {
  routes: RouteResult[];
  activeRouteIndex: number;
  onSelectRoute: (index: number) => void;
  waypointCount: number;
  vehicleType: VehicleProfileType;
}

const VEHICLE_ICONS: Record<VehicleProfileType, string> = {
  car: '🚗',
  sports: '🏎️',
  bike: '🏍️',
  truck: '🚛',
  offroad: '🚙'
};

export function RouteCards({
  routes,
  activeRouteIndex,
  onSelectRoute,
  waypointCount,
  vehicleType
}: Readonly<RouteCardsProps>) {
  const { t } = useTranslation();
  const vehicle = VEHICLE_PROFILES[vehicleType] ?? VEHICLE_PROFILES.car;
  const vehicleIcon = VEHICLE_ICONS[vehicleType] ?? '🚗';

  if (routes.length === 0) {
    if (waypointCount >= 2) {
      return (
        <div className={styles.errorBox}>
          ⚠️ {t('noRouteFound')}
        </div>
      );
    }

    return (
      <div className={styles.hintBox}>
        💡 {t('dragHint')}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {routes.map((route, idx) => {
        const isActive = idx === activeRouteIndex;
        const distStr = formatDistance(route.totalDistance);
        const timeStr = formatDuration(route.totalTimeSeconds);
        const gain = Math.round(route.elevationProfile?.elevationGain ?? 0);
        const loss = Math.round(route.elevationProfile?.elevationLoss ?? 0);

        // Calculate average speed
        const distKm = route.totalDistance / 1000;
        const timeHours = route.totalTimeSeconds / 3600;
        const avgSpeed = timeHours > 0 ? Math.round(distKm / timeHours) : 0;

        let title = route.label || t('alternativeRoute', { index: idx });
        if (route.isOptimal) title = t('fastestRoute');

        return (
          <button
            type="button"
            key={idx}
            onClick={() => onSelectRoute(idx)}
            aria-pressed={isActive}
            className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
          >
            <div className={styles.cardHeader}>
              <span className={`${styles.cardTitle} ${isActive ? styles.cardTitleActive : ''}`}>
                {title}
              </span>
              <div className={styles.badgesRow}>
                <span className={styles.vehicleBadge}>
                  {vehicleIcon} {vehicle.name.split('/')[0]}
                </span>
                {route.isOptimal && (
                  <span className={styles.optimalBadge}>
                    {t('optimal')}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.metricsRow}>
              <span>📏 <strong>{distStr} (3D)</strong></span>
              <span className={styles.timeText}>⏱️ <strong>{timeStr}</strong></span>
            </div>

            <div className={styles.statsRow}>
              <span>⛰️ {t('elevation', { gain, loss })}</span>
              <span className={styles.speedText}>⚡ <strong>{avgSpeed} km/h</strong> avg</span>
            </div>

            {/* 3D Elevation Profile Chart rendered for active route */}
            {isActive && route.path.length > 1 && (
              <ElevationChart
                path={route.path}
                gain={gain}
                loss={loss}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
