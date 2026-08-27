/**
 * Route Overlap Partitioning Utilities
 * Splits multi-stop legs into contiguous solo (solid) and overlapping (dashed) segment spans
 */

import type { RouteLeg } from '../../engine/types';
import { gtaToLatLng } from '../../geo/coordinates';

export interface LegRenderSegment {
  latlngs: [number, number][];
  isOverlapping: boolean;
  legIndex: number;
}

function getUndirectedEdgeKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}<->${idB}` : `${idB}<->${idA}`;
}

export function partitionLegSegments(legs: readonly RouteLeg[]): LegRenderSegment[] {
  const result: LegRenderSegment[] = [];
  const seenEdges = new Set<string>();

  legs.forEach((leg, legIdx) => {
    const path = leg.path;
    if (path.length < 2) return;

    let currentSegment: [number, number][] = [];
    let currentIsOverlapping: boolean | null = null;

    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i];
      const v = path[i + 1];
      if (!u || !v) continue;

      const edgeKey = getUndirectedEdgeKey(u.id, v.id);
      const isOverlapping = seenEdges.has(edgeKey);

      const latlngU = gtaToLatLng(u.x, u.y);
      const latlngV = gtaToLatLng(v.x, v.y);

      if (currentIsOverlapping === null || currentIsOverlapping !== isOverlapping) {
        if (currentSegment.length >= 2 && currentIsOverlapping !== null) {
          result.push({
            latlngs: currentSegment,
            isOverlapping: currentIsOverlapping,
            legIndex: legIdx
          });
        }
        currentSegment = [latlngU, latlngV];
        currentIsOverlapping = isOverlapping;
      } else {
        currentSegment.push(latlngV);
      }

      seenEdges.add(edgeKey);
    }

    if (currentSegment.length >= 2 && currentIsOverlapping !== null) {
      result.push({
        latlngs: currentSegment,
        isOverlapping: currentIsOverlapping,
        legIndex: legIdx
      });
    }
  });

  return result;
}
