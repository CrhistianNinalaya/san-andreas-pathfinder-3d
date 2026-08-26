import type { GraphNode } from '../../../engine/types';
import { ElevationPhysics } from '../../../terrain/ElevationPhysics';

export interface ChartPoint {
  x: number;
  y: number;
  distanceMeters: number;
  elevationMeters: number;
}

export interface ElevationChartData {
  linePath: string;
  areaPath: string;
  minZ: number;
  maxZ: number;
  startZ: number;
  endZ: number;
  totalDistanceMeters: number;
}

export function calculateChartPoints(
  path: readonly GraphNode[],
  width = 300,
  height = 70,
  paddingTop = 8,
  paddingBottom = 8
): ElevationChartData | null {
  if (!path || path.length < 2) {
    return null;
  }

  // 1. Compute cumulative 2D distances and track Z range
  const cumulativeDistances: number[] = [0];
  let currentDist = 0;
  let minZ = path[0]!.z;
  let maxZ = path[0]!.z;

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]!;
    const curr = path[i]!;
    const stepDist = ElevationPhysics.calculate2DDistance(prev, curr);
    currentDist += stepDist;
    cumulativeDistances.push(currentDist);

    if (curr.z < minZ) minZ = curr.z;
    if (curr.z > maxZ) maxZ = curr.z;
  }

  const totalDistance = currentDist;
  if (totalDistance <= 0) {
    return null;
  }

  // Add margin to Z range so flat roads don't divide by zero
  const zRange = Math.max(10, maxZ - minZ);
  const effectiveHeight = height - paddingTop - paddingBottom;

  // 2. Generate SVG coordinates
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i < path.length; i++) {
    const node = path[i]!;
    const dist = cumulativeDistances[i]!;

    const normX = (dist / totalDistance) * width;
    // Invert Y for SVG coordinates (0 is top, height is bottom)
    const normY = height - paddingBottom - ((node.z - minZ) / zRange) * effectiveHeight;

    points.push({
      x: Number(normX.toFixed(1)),
      y: Number(normY.toFixed(1))
    });
  }

  // 3. Build SVG Path strings
  const first = points[0]!;
  const last = points[points.length - 1]!;

  const linePathCommands = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPathCommands = `${linePathCommands} L ${last.x} ${height} L ${first.x} ${height} Z`;

  return {
    linePath: linePathCommands,
    areaPath: areaPathCommands,
    minZ: Math.round(minZ),
    maxZ: Math.round(maxZ),
    startZ: Math.round(path[0]!.z),
    endZ: Math.round(path[path.length - 1]!.z),
    totalDistanceMeters: Math.round(totalDistance)
  };
}
