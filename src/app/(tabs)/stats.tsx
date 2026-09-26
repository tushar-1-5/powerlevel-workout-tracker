import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConsistencyHeatmap } from '@/components/ConsistencyHeatmap';
import { GlassSurface } from '@/components/GlassSurface';
import { LineChart } from '@/components/LineChart';
import type { AppSettings, BodyweightLog, Exercise } from '@/db/types';
import { formatShortDate } from '@/lib/format';
import { computeBestStreak, computeStreak } from '@/lib/streak';
import { formatWeight, kgToLb, UNIT_LABEL } from '@/lib/units';
import { weightSuffix } from '@/lib/weightMode';
import { getLatestBodyweight, listBodyweightLogs } from '@/queries/bodyweight';
import { listExercises } from '@/queries/exercises';
import { getSettings } from '@/queries/settings';
import {
  getAllTimePRs,
  getExercisePR,
  getExerciseProgress,
  getMonthlyWorkoutCounts,
  getTrainingDayKeys,
  getWeeklyVolume,
  type AllTimePR,
  type ExercisePR,
  type MonthCount,
  type ProgressPoint,
  type WeekVolume,
} from '@/queries/stats';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

/**
 * The four lifts pinned to the top of the PR section, by their seed names.
 * Matched case-insensitively against `getAllTimePRs()` — which this screen
 * already loads — so there's no extra query. If one is renamed or has never
 * been logged, its tile stays and shows "—" rather than vanishing: a grid that
 * silently reshuffles when data is missing reads as if nothing is missing.
 */
const FEATURED_PRS: readonly { name: string; label: string }[] = [
  { name: 'Back Squat', label: 'Squat' },
  { name: 'Barbell Bench Press', label: 'Bench Press' },
  { name: 'Deadlift', label: 'Deadlift' },
  { name: 'Leg Press', label: 'Leg Press' },
];

/**
 * Stats from the PRD's §7: per-exercise progress chart, PRs, volume trend,
 * and a consistency heatmap + streak. "Sets per day-group per week" from the
 * PRD's frequency-trends line is deliberately reduced to workouts/month —
 * per-day-group frequency would need grouping by a day-group name that can
 * be renamed or deleted independently of the workouts that reference it
 * (Block 5's `day_name` snapshot exists for exactly this reason), which is
 * a meaningfully bigger feature than this block's scope.
 */
export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Exercise | null>(null);

  const [progress, setProgress] = useState<ProgressPoint[]>([]);
  const [pr, setPr] = useState<ExercisePR | null>(null);
  const [weeklyVolume, setWeeklyVolume] = useState<WeekVolume[]>([]);
  const [monthlyCounts, setMonthlyCounts] = useState<MonthCount[]>([]);
  const [trainingDays, setTrainingDays] = useState<Set<string>>(new Set());
  const [allTimePRs, setAllTimePRs] = useState<AllTimePR[]>([]);
  const [bodyweightLogs, setBodyweightLogs] = useState<BodyweightLog[]>([]);
  const [latestBodyweight, setLatestBodyweight] = useState<BodyweightLog | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [appSettings, exercises, volume, months, days, prs, bwLogs, latestBw] = await Promise.all([
      getSettings(),
      listExercises(),
      getWeeklyVolume(8),
      getMonthlyWorkoutCounts(6),
      // A generous window (~10 years), not just enough for the heatmap's own
      // 12-week view — computeBestStreak below wants full history to find a
      // genuinely "best ever" run, not just the best within a short window.
      // computeStreak's own safety valve (Block 15) already bounds how far
      // back it will scan regardless of how much extra data is in the set.
      getTrainingDayKeys(3650),
      getAllTimePRs(),
      listBodyweightLogs(30),
      getLatestBodyweight(),
    ]);
    setSettings(appSettings);
    setAllExercises(exercises);
    setWeeklyVolume(volume);
    setMonthlyCounts(months);
    setTrainingDays(days);
    setAllTimePRs(prs);
    setBodyweightLogs(bwLogs);
    setLatestBodyweight(latestBw);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setProgress([]);
      setPr(null);
      return;
    }
    void Promise.all([getExerciseProgress(selected.id), getExercisePR(selected.id)]).then(
      ([p, prRow]) => {
        setProgress(p);
        setPr(prRow);
      },
    );
  }, [selected]);

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allExercises.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8);
  }, [allExercises, search]);

  if (loading || !settings) {
    return (
      <View style={[styles.screen, styles.centre, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const unitLabel = UNIT_LABEL[settings.units];
  const toDisplayWeight = (kg: number) => (settings.units === 'lb' ? kgToLb(kg) : kg);
  const streak = computeStreak(trainingDays, Date.now());
  const bestStreak = computeBestStreak(trainingDays);
  const maxMonthCount = Math.max(1, ...monthlyCounts.map((m) => m.count));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
        {streak > 0 || bestStreak > 0 ? (
          <View style={styles.streakWrap}>
            {streak > 0 ? (
              <Text style={styles.streak}>
                {streak} day{streak === 1 ? '' : 's'} 🔥
              </Text>
            ) : null}
            <Text style={styles.bestStreak}>Best: {bestStreak} days</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progress</Text>
          <TextInput
            value={selected ? selected.name : search}
            onChangeText={(text) => {
              setSelected(null);
              setSearch(text);
            }}
            placeholder="Search an exercise"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
          />
          {!selected && filteredExercises.length > 0 ? (
            <GlassSurface style={styles.resultsCard}>
              {filteredExercises.map((ex) => (
                <Pressable
                  key={ex.id}
                  style={styles.resultRow}
                  onPress={() => {
                    setSelected(ex);
                    setSearch('');
                  }}>
                  <Text style={styles.resultText}>{ex.name}</Text>
                </Pressable>
              ))}
            </GlassSurface>
          ) : null}

          {selected ? (
            <GlassSurface style={styles.card}>
              {progress.length >= 2 ? (
                <LineChart values={progress.map((p) => toDisplayWeight(p.topWeightKg))} />
              ) : (
                <Text style={styles.hint}>Log this exercise in at least 2 sessions to see a trend.</Text>
              )}
              {pr ? (
                <View style={styles.prRow}>
                  <Text style={styles.prLabel}>PR</Text>
                  <Text style={styles.prValue}>
                    {formatWeight(toDisplayWeight(pr.weightKg))} {weightSuffix(selected, unitLabel)} × {pr.reps}
                  </Text>
                  <Text style={styles.prDate}>{formatShortDate(pr.achievedAt)}</Text>
                </View>
              ) : (
                <Text style={styles.hint}>No working sets logged for this exercise yet.</Text>
              )}
            </GlassSurface>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Records</Text>
          {/* Row container — `gap` renders on rows (see ExercisePageV2's note). */}
          <View style={styles.tileGrid}>
            {FEATURED_PRS.map((featured) => {
              const p = allTimePRs.find((x) => x.exerciseName.toLowerCase() === featured.name.toLowerCase());
              return (
                <GlassSurface key={featured.name} style={styles.tile}>
                  <Text style={styles.tileLabel} numberOfLines={1}>
                    {featured.label}
                  </Text>
                  {p ? (
                    <>
                      <Text style={styles.tileValue} numberOfLines={1}>
                        {formatWeight(toDisplayWeight(p.weightKg))}
                        <Text style={styles.tileUnit}>
                          {' '}
                          {weightSuffix({ weight_mode: p.weightMode, muscle_group: p.muscleGroup }, unitLabel)}
                        </Text>
                      </Text>
                      <Text style={styles.tileMeta} numberOfLines={1}>
                        × {p.reps} · {formatShortDate(p.achievedAt)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.tileValue, styles.tileValueEmpty]}>—</Text>
                      <Text style={styles.tileMeta}>Not logged yet</Text>
                    </>
                  )}
                </GlassSurface>
              );
            })}
          </View>
          <Pressable onPress={() => router.push('/stats/prs')} accessibilityRole="button">
            <GlassSurface style={styles.viewAll}>
              <Text style={styles.viewAllText}>View all PRs</Text>
              <Text style={styles.viewAllCount}>{allTimePRs.length}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.accent} />
            </GlassSurface>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Volume — last 8 weeks</Text>
          <GlassSurface style={styles.card}>
            <LineChart values={weeklyVolume.map((w) => toDisplayWeight(w.volumeKg))} />
            <Text style={styles.hint}>
              {formatWeight(toDisplayWeight(weeklyVolume[weeklyVolume.length - 1]?.volumeKg ?? 0))} {unitLabel}{' '}
              this week
            </Text>
          </GlassSurface>
        </View>

        {bodyweightLogs.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bodyweight</Text>
            <Pressable onPress={() => router.push('/bodyweight')}>
              <GlassSurface style={styles.card}>
                {bodyweightLogs.length >= 2 ? (
                  <LineChart
                    values={[...bodyweightLogs].reverse().map((l) => toDisplayWeight(l.weight_kg))}
                  />
                ) : (
                  <Text style={styles.hint}>Log on a few more days to see a trend.</Text>
                )}
                {latestBodyweight ? (
                  <Text style={styles.hint}>
                    Latest: {formatWeight(toDisplayWeight(latestBodyweight.weight_kg))} {unitLabel}
                  </Text>
                ) : null}
              </GlassSurface>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consistency</Text>
          <GlassSurface style={styles.card}>
            <ConsistencyHeatmap trainingDays={trainingDays} />
          </GlassSurface>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workouts per month</Text>
          <GlassSurface style={styles.card}>
            {monthlyCounts.map((m) => (
              <View key={m.label} style={styles.monthRow}>
                <Text style={styles.monthLabel}>{m.label}</Text>
                <View style={styles.monthBarTrack}>
                  <View style={[styles.monthBarFill, { width: `${(m.count / maxMonthCount) * 100}%` }]} />
                </View>
                <Text style={styles.monthCount}>{m.count}</Text>
              </View>
            ))}
          </GlassSurface>
        </View>
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
  streakWrap: { alignItems: 'flex-end', gap: 1 },
  streak: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  bestStreak: { color: colors.textMuted, fontSize: font.caption, fontWeight: '600' },
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxxl, gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  search: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    color: colors.text,
    fontSize: font.body,
    paddingHorizontal: spacing.lg,
  },
  resultsCard: { padding: spacing.xs },
  resultRow: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  resultText: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  card: { padding: spacing.lg, gap: spacing.sm },
  hint: { color: colors.textSecondary, fontSize: font.caption, textAlign: 'center' },
  prRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, justifyContent: 'center' },
  prLabel: {
    color: colors.onAccent,
    backgroundColor: colors.accent,
    fontSize: font.micro,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  prValue: { color: colors.text, fontSize: font.heading, fontWeight: '800', fontVariant: ['tabular-nums'] },
  prDate: { color: colors.textMuted, fontSize: font.caption },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // 47%, not 50%: two tiles plus the 8px gap must fit inside one row. 50%
  // each would overflow by exactly the gap and wrap every tile onto its own line.
  tile: { flexBasis: '47%', flexGrow: 1, padding: spacing.md },
  tileLabel: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  tileValue: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xs,
  },
  tileValueEmpty: { color: colors.textMuted },
  tileUnit: { color: colors.textSecondary, fontSize: font.label, fontWeight: '700' },
  tileMeta: { color: colors.textSecondary, fontSize: font.caption, marginTop: 2, fontVariant: ['tabular-nums'] },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  viewAllText: { flex: 1, color: colors.accent, fontSize: font.body, fontWeight: '700' },
  viewAllCount: { color: colors.textMuted, fontSize: font.label, fontWeight: '700', fontVariant: ['tabular-nums'] },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  monthLabel: { width: 72, color: colors.textSecondary, fontSize: font.caption },
  monthBarTrack: { flex: 1, height: 10, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  monthBarFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.sm },
  monthCount: { width: 24, color: colors.text, fontSize: font.caption, fontWeight: '700', textAlign: 'right' },
});
