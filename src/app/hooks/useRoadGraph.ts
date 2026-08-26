import { useEffect } from 'react';
import { RoadGraph } from '../../engine/RoadGraph';
import type { RawDataset } from '../../engine/types';
import type { RouteAction } from '../../features/route/routeReducer';

/**
 * Hook responsible solely for loading the official road graph dataset on mount
 */
export function useRoadGraph(dispatch: React.Dispatch<RouteAction>): void {
  useEffect(() => {
    fetch('data/san_andreas_official_nodes.json')
      .then(res => res.json())
      .then((data: RawDataset) => {
        const graph = new RoadGraph(data);
        dispatch({ type: 'SET_GRAPH', graph });
      })
      .catch(err => {
        console.error('Failed to load road graph:', err);
        dispatch({ type: 'SET_LOADING', isLoading: false });
      });
  }, [dispatch]);
}
