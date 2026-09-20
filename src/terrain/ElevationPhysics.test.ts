import { describe, it, expect } from 'vitest';
import { ElevationPhysics } from './ElevationPhysics';

describe('ElevationPhysics', () => {
  it('should compute accurate 3D Euclidean distances', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 300, y: 400, z: 0 };
    expect(ElevationPhysics.calculate3DDistance(a, b)).toBe(500);

    const c = { x: 0, y: 0, z: 100 };
    const d = { x: 300, y: 400, z: 100 };
    expect(ElevationPhysics.calculate3DDistance(c, d)).toBe(500);

    // 3D diagonal with Z difference
    const e = { x: 0, y: 0, z: 0 };
    const f = { x: 10, y: 20, z: 20 };
    expect(ElevationPhysics.calculate3DDistance(e, f)).toBe(30);
  });

  it('should compute slopes accurately', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 100, y: 0, z: 10 }; // +10m over 100m = +10%
    expect(ElevationPhysics.calculateSlope(a, b)).toBeCloseTo(0.10, 3);

    const c = { x: 100, y: 0, z: -15 }; // -15m over 100m = -15%
    expect(ElevationPhysics.calculateSlope(a, c)).toBeCloseTo(-0.15, 3);
  });

  it('should reduce vehicle speed on steep climbs', () => {
    const flatMultiplier = ElevationPhysics.getSlopeSpeedMultiplier(0, 'car');
    const moderateClimb = ElevationPhysics.getSlopeSpeedMultiplier(0.08, 'car');
    const steepClimb = ElevationPhysics.getSlopeSpeedMultiplier(0.20, 'car');

    expect(flatMultiplier).toBe(1.0);
    expect(moderateClimb).toBeLessThan(flatMultiplier);
    expect(steepClimb).toBeLessThan(moderateClimb);
  });

  it('should differentiate between vehicle profiles', () => {
    const slope = 0.15; // +15% climb
    const sports = ElevationPhysics.getSlopeSpeedMultiplier(slope, 'sports');
    const truck = ElevationPhysics.getSlopeSpeedMultiplier(slope, 'truck');
    const offroad = ElevationPhysics.getSlopeSpeedMultiplier(slope, 'offroad');

    expect(truck).toBeLessThan(sports);
    expect(offroad).toBeGreaterThan(truck);
  });

  it('should accurately calculate total elevation gain and loss profile', () => {
    const path = [
      { z: 10 },
      { z: 25 }, // +15
      { z: 20 }, // -5
      { z: 50 }, // +30
      { z: 45 }  // -5
    ];

    const profile = ElevationPhysics.calculateElevationProfile(path);
    expect(profile.elevationGain).toBe(45); // 15 + 30
    expect(profile.elevationLoss).toBe(10); // 5 + 5
    expect(profile.minElevation).toBe(10);
    expect(profile.maxElevation).toBe(50);
  });

  it('should evaluate full segment metrics using options object', () => {
    const seg = ElevationPhysics.evaluateSegment({
      nodeA: { x: 0, y: 0, z: 0 },
      nodeB: { x: 100, y: 0, z: 10 },
      nominalSpeedKmH: 80,
      vehicleType: 'sports'
    });

    expect(seg.distance3D).toBeCloseTo(100.5, 1);
    expect(seg.slopePercent).toBe(10);
    expect(seg.timeSeconds).toBeGreaterThan(0);
  });
});
