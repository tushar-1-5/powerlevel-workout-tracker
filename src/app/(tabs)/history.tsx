import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { GlassSurface } from '@/components/GlassSurface';
import type { Workout } from '@/db/types';
import { formatDuration, formatMonthYear, formatShortDate } from '@/lib/format';
import { listWorkouts } from '@/queries/workouts';
import { colors, font, glass, spacing } from '@/theme/tokens';

interface MonthGroup {
  label: string;
  workouts: Workout[];
}

function groupByMonth(workouts: Workout[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const w of workouts) {
    const label = formatMonthYear(w.started_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.workouts.push(w);
    else groups.push({ label, workouts: [w] });
  }
  return groups;
}

/**
 * The real History tab — a basic list for Phase 1 (per the PRD's own phase
 * split): finished workouts, most recent first, grouped by month. Editing a
 * past set, deleting a session, and backfilling one you forgot to log are
 * explicitly Phase 2 — this screen and the read-only session detail it opens
 * are the foundation those land on.
 */
export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const list = await listWorkouts(100);
        if (!cancelled) {
          setWorkouts(list);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.centre, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (workouts.length === 0) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <EmptyState
          title="No workouts yet"
          body="Finish your first workout and it'll show up here."
          actionLabel="Log a Past Workout"
          onAction={() => router.push('/history/backfill')}
        />
      </View>
    );
  }

  const groups = groupByMonth(workouts);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Pressable onPress={() => router.push('/history/backfill')} hitSlop={8}>
          <Text style={styles.backfillLink}>+ Past Workout</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {groups.map((group) => (
          <View key={group.label} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <GlassSurface style={styles.card}>
              {group.workouts.map((w, index) => (
                <Pressable
                  key={w.id}
                  onPress={() => router.push({ pathname: '/history/[workoutId]', params: { workoutId: w.id } })}
                  style={[styles.row, index < group.workouts.length - 1 && styles.rowDivider]}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{w.day_name}</Text>
                    <Text style={styles.rowDate}>{formatShortDate(w.started_at)}</Text>
                  </View>
                  <Text style={styles.rowDuration}>{formatDuration(w.duration_seconds)}</Text>
                </Pressable>
              ))}
            </GlassSurface>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centre: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  backfillLink: { color: colors.accent, fontSize: font.caption, fontWeight: '700' },
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxxl, gap: spacing.lg },
  group: { gap: spacing.sm },
  groupLabel: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  card: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: glass.border },
  rowInfo: { flex: 1 },
  rowName: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  rowDate: { color: colors.textSecondary, fontSize: font.caption, marginTop: 1 },
  rowDuration: { color: colors.textSecondary, fontSize: font.label, fontVariant: ['tabular-nums'] },
});
