import { useEffect } from 'react';
import type { RouteAction } from '../../features/route/routeReducer';
import { loadFullRoadGraph } from '../utils/loadGraphData';

/**
 * Hook coordinating the asynchronous fetch and initialization of the road graph.
 */
export function useRoadGraph(dispatch: React.Dispatch<RouteAction>): void {
  useEffect(() => {
    loadFullRoadGraph()
      .then((graph) => {
        dispatch({ type: 'SET_GRAPH', graph });
      })
      .catch((err) => {
        console.error('Failed to load road graph:', err);
        dispatch({ type: 'SET_LOADING', isLoading: false });
      });
  }, [dispatch]);
}
