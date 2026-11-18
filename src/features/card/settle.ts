/** Nearest face angle (multiple of 180°), nudged by a fast fling. Runs on the UI thread. */
export function settleAngle(angle: number, velocity: number) {
  'worklet';
  return Math.round((angle + velocity * 0.1) / 180) * 180;
}
