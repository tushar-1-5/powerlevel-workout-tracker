import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { GlassSurface } from '@/components/GlassSurface';
import { MUSCLE_LABELS, type AppSettings, type MuscleGroup } from '@/db/types';
import { formatShortDate } from '@/lib/format';
import { formatWeight, kgToLb, UNIT_LABEL } from '@/lib/units';
import { weightSuffix } from '@/lib/weightMode';
import { getSettings } from '@/queries/settings';
import { getAllTimePRs, type AllTimePR } from '@/queries/stats';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

/** Section order follows `MUSCLE_LABELS`' own key order — the same order the exercise library's filter chips use. */
const GROUP_ORDER = Object.keys(MUSCLE_LABELS) as MuscleGroup[];

/**
 * The full PR board, reached from "View all PRs" on the Stats tab — every
 * exercise's heaviest working set, grouped by muscle.
 *
 * Same data and same PR rule as the Stats tab's featured tiles: one
 * `getAllTimePRs()` call, heaviest top-level working set at any rep count,
 * earliest date wins a tie. Per-side PRs are shown as typed with a "/arm"
 * suffix, never doubled. Read-only; nothing here writes.
 */
export default function AllPRsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [prs, setPrs] = useState<AllTimePR[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getSettings(), getAllTimePRs()]).then(([appSettings, rows]) => {
      if (cancelled) return;
      setSettings(appSettings);
      setPrs(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter, then bucket by muscle group. `getAllTimePRs` already returns rows
  // sorted by name, and Map insertion keeps that order within each bucket.
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const buckets = new Map<MuscleGroup, AllTimePR[]>();
    for (const p of prs) {
      if (q && !p.exerciseName.toLowerCase().includes(q)) continue;
      const list = buckets.get(p.muscleGroup) ?? [];
      list.push(p);
      buckets.set(p.muscleGroup, list);
    }
    return GROUP_ORDER.filter((g) => buckets.has(g)).map((g) => ({ group: g, rows: buckets.get(g)! }));
  }, [prs, search]);

  if (loading || !settings) {
    return (
      <View style={[styles.screen, styles.centre]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const unitLabel = UNIT_LABEL[settings.units];
  const toDisplayWeight = (kg: number) => (settings.units === 'lb' ? kgToLb(kg) : kg);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
          <Text style={styles.back}>Stats</Text>
        </Pressable>
        <Text style={styles.title}>All PRs</Text>
        <View style={styles.backSpacer} />
      </View>

      {prs.length === 0 ? (
        <EmptyState
          title="No PRs yet"
          body="Finish a workout with at least one working set and your records show up here."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search an exercise"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
          />

          {sections.length === 0 ? (
            <Text style={styles.hint}>No PRs match “{search.trim()}”.</Text>
          ) : null}

          {sections.map(({ group, rows }) => (
            <View key={group} style={styles.section}>
              <Text style={styles.sectionTitle}>{MUSCLE_LABELS[group]}</Text>
              <GlassSurface style={styles.card}>
                {rows.map((p, index) => (
                  <View key={p.exerciseId} style={[styles.row, index < rows.length - 1 && styles.rowDivider]}>
                    <Text style={styles.name} numberOfLines={1}>
                      {p.exerciseName}
                    </Text>
                    <View style={styles.valueWrap}>
                      <Text style={styles.value}>
                        {formatWeight(toDisplayWeight(p.weightKg))}{' '}
                        {weightSuffix({ weight_mode: p.weightMode, muscle_group: p.muscleGroup }, unitLabel)} ×{' '}
                        {p.reps}
                      </Text>
                      <Text style={styles.date}>{formatShortDate(p.achievedAt)}</Text>
                    </View>
                  </View>
                ))}
              </GlassSurface>
            </View>
          ))}
        </ScrollView>
      )}
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
  backButton: { flexDirection: 'row', alignItems: 'center', width: 70 },
  back: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  backSpacer: { width: 70 },
  title: { color: colors.text, fontSize: font.heading, fontWeight: '800' },
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxxl, gap: spacing.xl },
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
  hint: { color: colors.textSecondary, fontSize: font.caption, textAlign: 'center' },
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  card: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { flex: 1, color: colors.text, fontSize: font.body, fontWeight: '600' },
  valueWrap: { alignItems: 'flex-end' },
  value: { color: colors.text, fontSize: font.label, fontWeight: '700', fontVariant: ['tabular-nums'] },
  date: { color: colors.textMuted, fontSize: font.caption, marginTop: 1 },
});
