import { useTranslation } from '../../i18n/useTranslation';
import { formatDistance, formatDuration } from '../../geo/coordinates';
import type { VehicleProfileType } from '../../terrain/ElevationPhysics';
import { ElevationChart } from '../../components/ElevationChart';
import type { RouteResult } from '../../engine/types';
import type { TranslationKey } from '../../i18n/translations';
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

const VEHICLE_SHORT_KEYS: Record<VehicleProfileType, TranslationKey> = {
  car: 'vehShort_car',
  sports: 'vehShort_sports',
  bike: 'vehShort_bike',
  truck: 'vehShort_truck',
  offroad: 'vehShort_offroad'
};

export function RouteCards({
  routes,
  activeRouteIndex,
  onSelectRoute,
  waypointCount,
  vehicleType
}: Readonly<RouteCardsProps>) {
  const { t } = useTranslation();
  const vehicleName = t(VEHICLE_SHORT_KEYS[vehicleType] ?? 'vehShort_car');
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

        const distKm = route.totalDistance / 1000;
        const timeHours = route.totalTimeSeconds / 3600;
        const avgSpeed = timeHours > 0 ? Math.round(distKm / timeHours) : 0;

        const title = route.isOptimal ? t('fastestRoute') : t('alternativeRoute', { index: idx });

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
                  {vehicleIcon} {vehicleName}
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
              <span className={styles.speedText}>⚡ <strong>{avgSpeed} km/h</strong> {t('avgSpeed')}</span>
            </div>

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
