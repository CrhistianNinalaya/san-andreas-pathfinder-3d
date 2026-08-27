import { useEffect } from 'react';
import { RoadGraph } from '../../engine/RoadGraph';
import type { RawDataset, CustomNetworkDataset } from '../../engine/types';
import type { RouteAction } from '../../features/route/routeReducer';

/**
 * Hook responsible solely for loading the official road graph and custom network overlay on mount
 */
export function useRoadGraph(dispatch: React.Dispatch<RouteAction>): void {
  useEffect(() => {
    Promise.all([
      fetch('data/official/san_andreas_official_nodes.json').then((res) => res.json()),
      fetch('data/custom/custom_network.json')
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
    ])
      .then(([officialData, customData]: [RawDataset, CustomNetworkDataset | null]) => {
        const graph = new RoadGraph(officialData, customData ?? undefined);
        dispatch({ type: 'SET_GRAPH', graph });
      })
      .catch((err) => {
        console.error('Failed to load road graph:', err);
        dispatch({ type: 'SET_LOADING', isLoading: false });
      });
  }, [dispatch]);
}
