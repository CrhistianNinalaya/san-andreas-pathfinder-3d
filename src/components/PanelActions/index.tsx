import { useTranslation } from '../../i18n/useTranslation';
import styles from './PanelActions.module.css';

export interface PanelActionsProps {
  waypointCount: number;
  onReverse: () => void;
  onClear: () => void;
  onCenter: () => void;
}

export function PanelActions({
  waypointCount,
  onReverse,
  onClear,
  onCenter
}: Readonly<PanelActionsProps>) {
  const { t } = useTranslation();

  return (
    <div className={styles.btnGroup}>
      <button
        type="button"
        onClick={onReverse}
        className={`${styles.btn} ${styles.btnSecondary}`}
        disabled={waypointCount < 2}
        title={t('reverse')}
      >
        🔄 {t('reverse')}
      </button>

      <button
        type="button"
        onClick={onClear}
        className={`${styles.btn} ${styles.btnSecondary}`}
        disabled={waypointCount === 0}
        title={t('clear')}
      >
        🗑️ {t('clear')}
      </button>

      <button
        type="button"
        onClick={onCenter}
        className={`${styles.btn} ${styles.btnPrimary}`}
        title={t('center')}
      >
        🗺️ {t('center')}
      </button>
    </div>
  );
}
