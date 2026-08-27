import type { RouteState } from '../../features/route/routeReducer';
import type { VehicleProfileType } from '../../terrain/ElevationPhysics';

export interface PanelControlsProps {
  scope: RouteState['scope'];
  vehicleType: VehicleProfileType;
  showNodes?: boolean;
  onScopeChange: (scope: RouteState['scope']) => void;
  onVehicleChange: (vehicle: VehicleProfileType) => void;
  onToggleNodes?: () => void;
}
