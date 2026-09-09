import { useEffect, useState } from 'react';

import { formatDuration } from '@/lib/format';

/**
 * A live "how long has this workout been running" string, shared between
 * Today's in-progress header and the workout screen so neither reimplements
 * it. Ticks once a second only while `startedAt` is set.
 *
 * Recomputes from `Date.now() - startedAt` on every tick rather than
 * incrementing a counter, so the display self-corrects if a backgrounded tab
 * causes a tick to fire late — it can never drift behind the real elapsed time.
 */
export function useWorkoutTimer(startedAt: number | null): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;

    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (startedAt === null) return '0:00';
  return formatDuration((now - startedAt) / 1000);
}
