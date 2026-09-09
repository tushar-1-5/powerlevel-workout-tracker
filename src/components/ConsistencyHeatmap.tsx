import { StyleSheet, View } from 'react-native';

import { startOfDay, toDateKey } from '@/lib/format';
import { colors } from '@/theme/tokens';

export interface ConsistencyHeatmapProps {
  /** "YYYY-MM-DD" keys of every day with a finished workout. */
  trainingDays: Set<string>;
  weeks?: number;
}

const CELL = 12;
const GAP = 3;
const DAY_MS = 86_400_000;

/**
 * A GitHub-style contribution grid — columns are weeks (Sunday to Saturday,
 * top to bottom), oldest on the left, today's column on the right. Plain
 * `View`s, not SVG: every cell is a uniform square, which flexbox already
 * lays out perfectly well without reaching for a drawing API.
 */
export function ConsistencyHeatmap({ trainingDays, weeks = 12 }: ConsistencyHeatmapProps) {
  const today = startOfDay(Date.now());
  const todayDate = new Date(today);
  const saturdayOfThisWeek = new Date(today);
  saturdayOfThisWeek.setDate(todayDate.getDate() + (6 - todayDate.getDay()));
  const gridStart = new Date(saturdayOfThisWeek);
  gridStart.setDate(saturdayOfThisWeek.getDate() - (weeks * 7 - 1));

  const columns: { key: string; active: boolean; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w += 1) {
    const col: { key: string; active: boolean; future: boolean }[] = [];
    for (let d = 0; d < 7; d += 1) {
      const ms = gridStart.getTime() + (w * 7 + d) * DAY_MS;
      const key = toDateKey(ms);
      col.push({ key, active: trainingDays.has(key), future: ms > today });
    }
    columns.push(col);
  }

  return (
    <View style={styles.grid}>
      {columns.map((col, i) => (
        <View key={i} style={styles.column}>
          {col.map((cell) => (
            <View
              key={cell.key}
              style={[styles.cell, cell.active && styles.cellActive, cell.future && styles.cellFuture]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: GAP },
  column: { gap: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 3, backgroundColor: colors.surfaceAlt },
  cellActive: { backgroundColor: colors.accent },
  cellFuture: { backgroundColor: 'transparent' },
});
