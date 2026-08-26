import { useMemo } from 'react';
import type { GraphNode } from '../../engine/types';
import { useTranslation } from '../../i18n/useTranslation';
import { calculateChartPoints } from './utils/calculatePoints';
import styles from './ElevationChart.module.css';

export interface ElevationChartProps {
  path: readonly GraphNode[];
  gain?: number;
  loss?: number;
}

export function ElevationChart({
  path,
  gain = 0,
  loss = 0
}: Readonly<ElevationChartProps>) {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    return calculateChartPoints(path, 300, 70);
  }, [path]);

  if (!chartData) {
    return null;
  }

  const distKm = (chartData.totalDistanceMeters / 1000).toFixed(1);

  return (
    <div className={styles.chartContainer}>
      {/* Chart Header with Min/Max Badges */}
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>
          📊 {t('elevationProfile')}
        </span>
        <div className={styles.rangeBadges}>
          <span className={styles.badgeMin}>Min: {chartData.minZ}m</span>
          <span className={styles.badgeMax}>Max: {chartData.maxZ}m</span>
        </div>
      </div>

      {/* SVG Canvas using Design Token Palette */}
      <div className={styles.svgWrapper}>
        <svg
          viewBox="0 0 300 70"
          preserveAspectRatio="none"
          className={styles.elevationSvg}
        >
          <defs>
            <linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Area fill underneath altitude curve */}
          <path d={chartData.areaPath} className={styles.areaFill} />

          {/* Altitude trajectory line */}
          <path d={chartData.linePath} className={styles.lineStroke} />
        </svg>
      </div>

      {/* Footer with Start, End & Delta */}
      <div className={styles.chartFooter}>
        <span>0 km ({chartData.startZ}m)</span>
        <span>▲ +{Math.round(gain)}m · ▼ -{Math.round(loss)}m</span>
        <span>{distKm} km ({chartData.endZ}m)</span>
      </div>
    </div>
  );
}
