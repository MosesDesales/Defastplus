export function runningSegmentSeconds(startedAt: Date | null, isRunning: boolean): number {
  if (!isRunning || !startedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
}

export function liveDurationSeconds(entry: {
  durationSeconds: number;
  isRunning: boolean;
  startedAt: Date | null;
}): number {
  return entry.durationSeconds + runningSegmentSeconds(entry.startedAt, entry.isRunning);
}
