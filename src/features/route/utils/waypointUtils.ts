/**
 * Generates an alphabetical or indexed label for a waypoint position (A, B, C... or P27).
 */
export function getWaypointLabel(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return letters[index] ?? `P${index + 1}`;
}
