import { useTranslation } from '../../i18n/useTranslation';
import { formatNodeCount } from './utils/formatNodeCount';
import styles from './PanelHeader.module.css';

export interface PanelHeaderProps {
  isLoading: boolean;
  nodeCount: number;
}

export function PanelHeader({ isLoading, nodeCount }: Readonly<PanelHeaderProps>) {
  const { t } = useTranslation();

  return (
    <div className={styles.panelHeader}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}>🧭</span>
        <div>
          <h1>{t('appTitle')}</h1>
        </div>
      </div>
      <span className={styles.badge}>
        {isLoading
          ? t('loading')
          : t('nodesLoaded', { count: formatNodeCount(nodeCount) })}
      </span>
    </div>
  );
}
