import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { GlassSurface } from '@/components/GlassSurface';
import { KiAura } from '@/components/KiAura';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Stepper } from '@/components/Stepper';
import type { AppSettings } from '@/db/types';
import { formatDuration, formatLongDate, toDateKey } from '@/lib/format';
import * as haptics from '@/lib/haptics';
import { TODAY } from '@/lib/routes';
import { formatWeight, fromDisplay, kgToLb, toDisplay, UNIT_LABEL } from '@/lib/units';
import { getLatestBodyweight, logBodyweight } from '@/queries/bodyweight';
import { getSettings } from '@/queries/settings';
import { getWorkoutSummary, type WorkoutSummary } from '@/queries/workouts';
import { colors, font, radius, spacing } from '@/theme/tokens';

/**
 * The finish screen from the PRD's §5 — duration, PRs hit, and (§9) the
 * ki-aura charge-up, playing purely for its own sake (glow/particle/shake/
 * flash), skippable by tapping and entirely skipped when the settings
 * toggle is off. No longer shows a total-volume stat — see the Stats tab's
 * own "Volume — last 8 weeks" section for that number instead.
 */
export default function WorkoutSummaryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [animPhase, setAnimPhase] = useState<'charging' | 'done'>('done');
  const prsCelebratedRef = useRef(false);
  const [bwDraft, setBwDraft] = useState(70);
  const [bwLogged, setBwLogged] = useState(false);
  const [bwSaving, setBwSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [s, appSettings, latestBw] = await Promise.all([
        getWorkoutSummary(workoutId),
        getSettings(),
        getLatestBodyweight(),
      ]);
      if (cancelled) return;
      setSummary(s);
      setSettings(appSettings);
      setBwDraft(toDisplay(latestBw?.weight_kg ?? 70, appSettings.units));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  const handleLogBodyweight = async () => {
    if (!settings || bwSaving) return;
    setBwSaving(true);
    haptics.confirm();
    try {
      // Upserts by today's date key — safe to log again even if you already
      // logged today (from this screen or the dedicated Bodyweight screen),
      // it just overwrites rather than creating a duplicate.
      await logBodyweight(fromDisplay(bwDraft, settings.units), toDateKey(Date.now()));
      setBwLogged(true);
    } finally {
      setBwSaving(false);
    }
  };

  // Triggers the aura the moment both are loaded, respecting the settings
  // toggle. No count-up to drive any more — the aura plays purely for its
  // own sake now that the volume number it used to count up to is gone.
  useEffect(() => {
    if (!summary || !settings) return;

    // Independent of the animations toggle — a PR is a haptics moment, not
    // a visual one, and celebrate() already respects settings.haptics_enabled
    // itself. Guarded so it can only ever fire once per screen, regardless of
    // how many times this effect re-runs.
    if (!prsCelebratedRef.current && summary.exercises.some((e) => e.isPr)) {
      prsCelebratedRef.current = true;
      haptics.celebrate();
    }

    setAnimPhase(settings.animations_enabled ? 'charging' : 'done');
  }, [summary, settings]);

  const handleAuraDone = () => setAnimPhase('done');

  const done = () => router.replace(TODAY);

  if (loading || !settings) {
    return (
      <View style={[styles.screen, styles.centre]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <EmptyState
          title="Workout not found"
          body="This session may have been deleted."
          actionLabel="Back to Today"
          onAction={done}
        />
      </View>
    );
  }

  const unitLabel = UNIT_LABEL[settings.units];
  const toDisplayWeight = (kg: number) => (settings.units === 'lb' ? kgToLb(kg) : kg);
  const prs = summary.exercises.filter((e) => e.isPr);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.lg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Text style={styles.label}>Workout Complete</Text>
          <Text style={styles.dayName}>{summary.workout.day_name}</Text>
          <Text style={styles.date}>{formatLongDate(summary.workout.started_at)}</Text>
        </View>

        <GlassSurface style={styles.statCard} variant="raised">
          <Text style={styles.statValue}>{formatDuration(summary.workout.duration_seconds)}</Text>
          <Text style={styles.statLabel}>Duration</Text>
        </GlassSurface>

        {prs.length > 0 ? (
          <GlassSurface style={styles.card}>
            <Text style={styles.sectionTitle}>New PRs</Text>
            {prs.map((pr) => (
              <View key={pr.exerciseId} style={styles.prRow}>
                <Ionicons name="star" size={16} color={colors.accent} />
                <Text style={styles.prText}>
                  {pr.exerciseName} — {formatWeight(toDisplayWeight(pr.topWeightKg))} {unitLabel} ×{' '}
                  {pr.topReps}
                </Text>
              </View>
            ))}
          </GlassSurface>
        ) : null}

        <GlassSurface style={styles.card}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          {summary.exercises.map((ex, index) => (
            <View
              key={ex.exerciseId}
              style={[styles.exRow, index < summary.exercises.length - 1 && styles.exRowDivider]}>
              <Text style={styles.exName} numberOfLines={1}>
                {ex.exerciseName}
              </Text>
              <Text style={styles.exTop}>
                {formatWeight(toDisplayWeight(ex.topWeightKg))} {unitLabel} × {ex.topReps}
              </Text>
              {ex.isPr ? <Text style={styles.exPr}>PR</Text> : null}
            </View>
          ))}
          <Text style={styles.setCount}>
            {summary.setCount} set{summary.setCount === 1 ? '' : 's'} logged
          </Text>
        </GlassSurface>

        <GlassSurface style={styles.card}>
          <Text style={styles.sectionTitle}>Bodyweight</Text>
          <Stepper
            value={bwDraft}
            onChange={(v) => {
              setBwDraft(v);
              setBwLogged(false);
            }}
            step={settings.units === 'lb' ? 0.5 : 0.25}
            min={0}
            max={settings.units === 'lb' ? 1000 : 450}
            format={formatWeight}
            unitLabel={unitLabel}
            allowDecimal
            accessibilityLabel="bodyweight"
          />
          <Pressable
            onPress={handleLogBodyweight}
            disabled={bwLogged || bwSaving}
            style={styles.bwLogButtonWrap}>
            <GlassSurface style={styles.bwLogButton}>
              {bwSaving ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={bwLogged ? styles.bwLoggedText : styles.bwLogButtonText}>
                  {bwLogged ? '✓ Logged' : 'Log Bodyweight'}
                </Text>
              )}
            </GlassSurface>
          </Pressable>
        </GlassSurface>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton label="Done" onPress={done} />
      </View>

      {animPhase === 'charging' ? <KiAura duration={2500} onDone={handleAuraDone} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centre: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  head: { alignItems: 'center', gap: 2, marginBottom: spacing.sm },
  label: {
    color: colors.accent,
    fontSize: font.micro,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  dayName: { color: colors.text, fontSize: font.title, fontWeight: '800', marginTop: spacing.xs },
  date: { color: colors.textSecondary, fontSize: font.label },
  statCard: { padding: spacing.lg, alignItems: 'center', gap: spacing.xs },
  statValue: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  card: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prText: { color: colors.text, fontSize: font.body, fontWeight: '600', flex: 1 },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  exRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  exName: { flex: 1, color: colors.text, fontSize: font.body, fontWeight: '600' },
  exTop: { color: colors.textSecondary, fontSize: font.label, fontVariant: ['tabular-nums'] },
  exPr: {
    color: colors.onAccent,
    backgroundColor: colors.accent,
    fontSize: font.micro,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  setCount: {
    color: colors.textMuted,
    fontSize: font.caption,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  bwLogButtonWrap: { marginTop: spacing.sm },
  bwLogButton: {
    minHeight: 44,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bwLogButtonText: { color: colors.accent, fontSize: font.label, fontWeight: '700' },
  bwLoggedText: { color: colors.up, fontSize: font.label, fontWeight: '700' },
  footer: { padding: spacing.lg, paddingTop: spacing.sm },
});
