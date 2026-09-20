import { useState, useCallback } from 'react';
import type { LayerFilters } from '../../features/route/routeReducer';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './MapLegend.module.css';

/**
 * Properties for the MapLegend component.
 */
interface MapLegendProps {
  filters: LayerFilters;
  onToggleFilter: (key: keyof LayerFilters) => void;
  showNodes?: boolean;
}

/**
 * Floating road network legend card explaining node types and providing per-class visibility filters.
 */
export function MapLegend({
  filters,
  onToggleFilter,
  showNodes = false
}: Readonly<MapLegendProps>) {
  const { t } = useTranslation();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const getContainerClassName = useCallback(() => {
    if (isCollapsed) {
      return `${styles.legendContainer} ${styles.collapsed}`;
    }
    return styles.legendContainer;
  }, [isCollapsed]);

  const getItemClassName = useCallback((isActive: boolean) => {
    if (!isActive) {
      return `${styles.filterItem} ${styles.inactive}`;
    }
    return styles.filterItem;
  }, []);

  const getSwitchClassName = useCallback((isActive: boolean) => {
    if (isActive) {
      return `${styles.toggleSwitch} ${styles.active}`;
    }
    return styles.toggleSwitch;
  }, []);

  if (!showNodes) {
    return null;
  }

  return (
    <aside className={getContainerClassName()} aria-label={t('legendTitle')}>
      <button
        type="button"
        className={styles.legendHeader}
        onClick={handleToggleCollapse}
        aria-expanded={!isCollapsed}
      >
        <span className={styles.headerTitle}>
          <span>🌐</span>
          <span>{t('legendTitle')}</span>
        </span>
        <span
          className={styles.headerToggle}
          title={isCollapsed ? t('legendExpand') : t('legendCollapse')}
          aria-hidden="true"
        >
          {isCollapsed ? '➕' : '➖'}
        </span>
      </button>

      {!isCollapsed && (
        <div className={styles.legendBody}>
          <button
            type="button"
            className={getItemClassName(filters.officialGiant)}
            onClick={() => onToggleFilter('officialGiant')}
            role="switch"
            aria-checked={filters.officialGiant}
          >
            <div className={styles.itemLeft}>
              <div className={styles.symbolWrapper}>
                <div className={styles.officialDot} />
              </div>
              <div className={styles.itemText}>
                <span className={styles.itemLabel}>{t('legendOfficialGiant')}</span>
                <span className={styles.itemDesc}>{t('legendOfficialGiantDesc')}</span>
              </div>
            </div>
            <div className={getSwitchClassName(filters.officialGiant)}>
              <div className={styles.toggleThumb} />
            </div>
          </button>

          <button
            type="button"
            className={getItemClassName(filters.officialIsolated)}
            onClick={() => onToggleFilter('officialIsolated')}
            role="switch"
            aria-checked={filters.officialIsolated}
          >
            <div className={styles.itemLeft}>
              <div className={styles.symbolWrapper}>
                <div className={styles.isolatedDot} />
              </div>
              <div className={styles.itemText}>
                <span className={styles.itemLabel}>{t('legendOfficialIsolated')}</span>
                <span className={styles.itemDesc}>{t('legendOfficialIsolatedDesc')}</span>
              </div>
            </div>
            <div className={getSwitchClassName(filters.officialIsolated)}>
              <div className={styles.toggleThumb} />
            </div>
          </button>

          <button
            type="button"
            className={getItemClassName(filters.shortcuts)}
            onClick={() => onToggleFilter('shortcuts')}
            role="switch"
            aria-checked={filters.shortcuts}
          >
            <div className={styles.itemLeft}>
              <div className={styles.symbolWrapper}>
                <div className={styles.shortcutDot} />
              </div>
              <div className={styles.itemText}>
                <span className={styles.itemLabel}>{t('legendShortcuts')}</span>
                <span className={styles.itemDesc}>{t('legendShortcutsDesc')}</span>
              </div>
            </div>
            <div className={getSwitchClassName(filters.shortcuts)}>
              <div className={styles.toggleThumb} />
            </div>
          </button>

          <button
            type="button"
            className={getItemClassName(filters.patches)}
            onClick={() => onToggleFilter('patches')}
            role="switch"
            aria-checked={filters.patches}
          >
            <div className={styles.itemLeft}>
              <div className={styles.symbolWrapper}>
                <div className={styles.patchLine} />
              </div>
              <div className={styles.itemText}>
                <span className={styles.itemLabel}>{t('legendPatches')}</span>
                <span className={styles.itemDesc}>{t('legendPatchesDesc')}</span>
              </div>
            </div>
            <div className={getSwitchClassName(filters.patches)}>
              <div className={styles.toggleThumb} />
            </div>
          </button>

          <button
            type="button"
            className={getItemClassName(filters.coincidentNodes)}
            onClick={() => onToggleFilter('coincidentNodes')}
            role="switch"
            aria-checked={filters.coincidentNodes}
          >
            <div className={styles.itemLeft}>
              <div className={styles.symbolWrapper}>
                <div className={styles.coincidentRing} />
              </div>
              <div className={styles.itemText}>
                <span className={styles.itemLabel}>{t('legendCoincident')}</span>
                <span className={styles.itemDesc}>{t('legendCoincidentDesc')}</span>
              </div>
            </div>
            <div className={getSwitchClassName(filters.coincidentNodes)}>
              <div className={styles.toggleThumb} />
            </div>
          </button>
        </div>
      )}
    </aside>
  );
}
