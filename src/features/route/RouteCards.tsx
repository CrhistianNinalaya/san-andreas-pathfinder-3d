import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDistance, formatDuration } from '../../geo/coordinates';
import { VEHICLE_PROFILES, type VehicleProfileType } from '../../terrain/ElevationPhysics';
import type { RouteResult } from '../../engine/types';

interface RouteCardsProps {
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

export const RouteCards: React.FC<RouteCardsProps> = ({
  routes,
  activeRouteIndex,
  onSelectRoute,
  waypointCount,
  vehicleType
}) => {
  const { t } = useTranslation();
  const vehicle = VEHICLE_PROFILES[vehicleType] ?? VEHICLE_PROFILES.car;
  const vehicleIcon = VEHICLE_ICONS[vehicleType] ?? '🚗';

  if (routes.length === 0) {
    if (waypointCount >= 2) {
      return (
        <div style={{
          padding: '12px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#fca5a5',
          textAlign: 'center'
        }}>
          ⚠️ {t('noRouteFound')}
        </div>
      );
    }

    return (
      <div style={{
        padding: '12px',
        background: 'rgba(15, 23, 42, 0.5)',
        borderRadius: '8px',
        fontSize: '11.5px',
        color: '#94a3b8',
        lineHeight: '1.5'
      }}>
        💡 {t('dragHint')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {routes.map((route, idx) => {
        const isActive = idx === activeRouteIndex;
        const distStr = formatDistance(route.totalDistance);
        const timeStr = formatDuration(route.totalTimeSeconds);
        const gain = route.elevationProfile?.elevationGain ?? 0;
        const loss = route.elevationProfile?.elevationLoss ?? 0;

        // Calculate average speed
        const distKm = route.totalDistance / 1000;
        const timeHours = route.totalTimeSeconds / 3600;
        const avgSpeed = timeHours > 0 ? Math.round(distKm / timeHours) : 0;

        let title = route.label || t('alternativeRoute', { index: idx });
        if (route.isOptimal) title = t('fastestRoute');

        return (
          <div
            key={idx}
            onClick={() => onSelectRoute(idx)}
            style={{
              padding: '10px 12px',
              background: isActive ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.65)',
              border: isActive ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: isActive ? '0 0 15px rgba(56, 189, 248, 0.2)' : 'none'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: isActive ? '#38bdf8' : '#f8fafc' }}>
                {title}
              </span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  {vehicleIcon} {vehicle.name.split('/')[0]}
                </span>
                {route.isOptimal && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    background: '#0284c7',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {t('optimal')}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#e2e8f0', margin: '4px 0' }}>
              <span>📏 <strong>{distStr} (3D)</strong></span>
              <span style={{ color: '#38bdf8' }}>⏱️ <strong>{timeStr}</strong></span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              <span>⛰️ {t('elevation', { gain, loss })}</span>
              <span style={{ color: '#cbd5e1' }}>⚡ <strong>{avgSpeed} km/h</strong> avg</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
