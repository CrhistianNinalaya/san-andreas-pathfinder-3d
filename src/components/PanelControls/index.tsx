import { useTranslation } from '../../i18n/useTranslation';
import type { Language } from '../../i18n/translations';
import type { RouteState } from '../../features/route/routeReducer';
import type { VehicleProfileType } from '../../terrain/ElevationPhysics';
import styles from './PanelControls.module.css';

export interface PanelControlsProps {
  scope: RouteState['scope'];
  vehicleType: VehicleProfileType;
  onScopeChange: (scope: RouteState['scope']) => void;
  onVehicleChange: (vehicle: VehicleProfileType) => void;
}

export function PanelControls({
  scope,
  vehicleType,
  onScopeChange,
  onVehicleChange
}: Readonly<PanelControlsProps>) {
  const { t, lang, setLang } = useTranslation();

  return (
    <div className={styles.controlsContainer}>
      {/* Scope and Language Row */}
      <div className={styles.controlsRow}>
        <div style={{ flex: 1 }}>
          <select
            value={scope}
            onChange={(e) => onScopeChange(e.target.value as RouteState['scope'])}
            className={styles.selectInput}
            title={t('networkScope')}
          >
            <option value="all">{t('scopeAll')}</option>
            <option value="losSantos">{t('scopeLS')}</option>
            <option value="sanFierro">{t('scopeSF')}</option>
            <option value="lasVenturas">{t('scopeLV')}</option>
            <option value="countryside">{t('scopeCountry')}</option>
          </select>
        </div>

        <div style={{ width: '85px' }}>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
            className={styles.selectInput}
            aria-label="Language / Idioma"
          >
            <option value="es">🇵🇪 ES</option>
            <option value="en">🇺🇸 EN</option>
          </select>
        </div>
      </div>

      {/* Vehicle Profile Selector */}
      <div>
        <select
          value={vehicleType}
          onChange={(e) => onVehicleChange(e.target.value as VehicleProfileType)}
          className={styles.selectInput}
          title={t('vehicleProfile')}
        >
          <option value="car">{t('vehCar')}</option>
          <option value="sports">{t('vehSports')}</option>
          <option value="bike">{t('vehBike')}</option>
          <option value="truck">{t('vehTruck')}</option>
          <option value="offroad">{t('vehOffroad')}</option>
        </select>
      </div>
    </div>
  );
}
