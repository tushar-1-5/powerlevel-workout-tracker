import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/GlassSurface';
import { LastSessionDelta } from '@/components/LastSessionDelta';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RepChips } from '@/components/RepChips';
import { Stepper } from '@/components/Stepper';
import type { AppSettings, Exercise, WorkoutSet } from '@/db/types';
import * as haptics from '@/lib/haptics';
import { displayStep, formatWeight, fromDisplay, toDisplay, UNIT_LABEL } from '@/lib/units';
import {
  deleteSet,
  getBestWeightKg,
  getLastSessionSets,
  getSetsFor,
  logSet,
  updateSet,
  type LastSessionSet,
} from '@/queries/workouts';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

export interface ExercisePageProps {
  workoutId: string;
  workoutExerciseId: string;
  exercise: Exercise;
  settings: AppSettings;
}

/**
 * What the entry area (steppers, toggles, the primary button) is currently
 * doing. Kept as one discriminated union rather than separate booleans/ids so
 * "logging a drop AND editing at once" is structurally impossible, not just
 * something every branch has to remember to guard against.
 */
type EntryMode =
  | { kind: 'log' }
  | { kind: 'drop'; parentId: string; label: string }
  | { kind: 'edit'; setId: string; label: string };

/**
 * One page of the workout pager: everything needed to log sets for a single
 * exercise. Owns its own data — last session's sets (the prefill/comparison
 * reference) and this session's sets logged so far — so the parent pager
 * only has to mount one of these per exercise and never touch set-level state.
 *
 * Layout below is built directly off the "Logging Page Spacing Fix" design
 * mockup, value for value — see `listContent`/`setGroup`/`rowActions` for the
 * spots that previously drifted from it.
 */
export function ExercisePage({ workoutId, workoutExerciseId, exercise, settings }: ExercisePageProps) {
  const [loading, setLoading] = useState(true);
  const [lastSession, setLastSession] = useState<LastSessionSet[]>([]);
  const [allSets, setAllSets] = useState<WorkoutSet[]>([]);
  const [bestWeightKg, setBestWeightKg] = useState<number | null>(null);

  const [mode, setMode] = useState<EntryMode>({ kind: 'log' });
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(settings.rep_chips[0] ?? 8);
  const [warmup, setWarmup] = useState(false);
  const [toFailure, setToFailure] = useState(false);
  const [saving, setSaving] = useState(false);

  // Drop-chain links point at their parent via parent_set_id; everything else
  // is a normal top-level set. getSetsFor returns both mixed together.
  const topLevel = allSets.filter((s) => s.parent_set_id === null);
  const childrenOf = (parentId: string) =>
    allSets.filter((s) => s.parent_set_id === parentId).sort((a, b) => a.position - b.position);

  const setLabel = useCallback(
    (set: WorkoutSet): string => {
      if (set.parent_set_id === null) {
        return `Set ${topLevel.findIndex((s) => s.id === set.id) + 1}`;
      }
      const parent = topLevel.find((s) => s.id === set.parent_set_id);
      const parentIdx = parent ? topLevel.findIndex((s) => s.id === parent.id) + 1 : '?';
      const dropIdx = parent ? childrenOf(parent.id).findIndex((s) => s.id === set.id) + 1 : '?';
      return `Set ${parentIdx}, drop ${dropIdx}`;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allSets],
  );

  const resetToLogMode = useCallback(
    (sets: WorkoutSet[], last: LastSessionSet[]) => {
      const tops = sets.filter((s) => s.parent_set_id === null).sort((a, b) => a.position - b.position);
      setMode({ kind: 'log' });
      setWarmup(false);
      setToFailure(false);

      if (tops.length > 0) {
        // Carries forward from the set you just logged today.
        const mostRecent = tops[tops.length - 1];
        setWeight(toDisplay(mostRecent.weight_kg, settings.units));
        setReps(mostRecent.reps);
      } else if (last.length > 0) {
        // Set 1 pre-fills from last session's Set 1.
        setWeight(toDisplay(last[0].weight_kg, settings.units));
        setReps(last[0].reps);
      } else {
        setWeight(0);
        setReps(settings.rep_chips[0] ?? 8);
      }
    },
    [settings],
  );

  const refresh = useCallback(async () => {
    const sets = await getSetsFor(workoutExerciseId);
    setAllSets(sets);
    resetToLogMode(sets, lastSession);
    return sets;
    // `lastSession` IS a real dependency here, even though it only ever
    // changes once (set by the initial-load effect below, sometime after
    // this callback is first created with it still at its `[]` initial
    // value). Omitting it would leave `refresh` permanently closed over
    // that empty array — harmless once at least one set is logged (the
    // carry-forward branch takes over), but wrong the moment `topLevel`
    // drops back to zero (e.g. deleting your only logged set), where it
    // would wrongly show "no history" instead of re-prefilling from last
    // session.
  }, [workoutExerciseId, resetToLogMode, lastSession]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [last, sets, best] = await Promise.all([
        getLastSessionSets(exercise.id, workoutId),
        getSetsFor(workoutExerciseId),
        getBestWeightKg(exercise.id, workoutId),
      ]);
      if (cancelled) return;
      setLastSession(last);
      setAllSets(sets);
      setBestWeightKg(best);
      resetToLogMode(sets, last);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id, workoutExerciseId, workoutId]);

  const beginDrop = useCallback(
    (parent: WorkoutSet) => {
      setMode({ kind: 'drop', parentId: parent.id, label: setLabel(parent) });
      setWeight(toDisplay(parent.weight_kg, settings.units));
      setReps(parent.reps);
      setWarmup(false);
      setToFailure(false);
    },
    [setLabel, settings.units],
  );

  const beginEdit = useCallback(
    (set: WorkoutSet) => {
      setMode({ kind: 'edit', setId: set.id, label: setLabel(set) });
      setWeight(toDisplay(set.weight_kg, settings.units));
      setReps(set.reps);
      setWarmup(set.set_type === 'warmup');
      setToFailure(set.to_failure === 1);
    },
    [setLabel, settings.units],
  );

  const openMenu = useCallback(
    (set: WorkoutSet) => {
      const label = setLabel(set);
      Alert.alert(label, `${formatWeight(toDisplay(set.weight_kg, settings.units))} ${UNIT_LABEL[settings.units]} × ${set.reps}`, [
        { text: 'Edit', onPress: () => beginEdit(set) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            haptics.warn();
            void deleteSet(set.id).then(refresh);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [setLabel, settings.units, beginEdit, refresh],
  );

  const cancelEntry = useCallback(() => {
    resetToLogMode(allSets, lastSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSets, lastSession, resetToLogMode]);

  const submit = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    haptics.confirm();

    try {
      const weightKg = fromDisplay(weight, settings.units);

      if (mode.kind === 'log') {
        await logSet({ workoutExerciseId, weightKg, reps, setType: warmup ? 'warmup' : 'working', toFailure });
      } else if (mode.kind === 'drop') {
        await logSet({
          workoutExerciseId,
          weightKg,
          reps,
          setType: 'working',
          toFailure,
          parentSetId: mode.parentId,
        });
      } else {
        await updateSet(mode.setId, {
          weightKg,
          reps,
          setType: warmup ? 'warmup' : 'working',
          toFailure,
        });
      }

      await refresh();
    } finally {
      setSaving(false);
    }
  }, [saving, mode, weight, reps, warmup, toFailure, settings.units, workoutExerciseId, refresh]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // "Set N" and the last-session comparison both count working sets only —
  // warm-ups are excluded from the last-time reference (per Block 1's rule),
  // so they must also be excluded from which position "N" refers to. The
  // list below still numbers every top-level set in the order you did it,
  // warm-ups included — that's a chronological log, a different thing from
  // "which working set is this".
  const workingTopLevel = topLevel.filter((s) => s.set_type === 'working');
  const nextSetNumber = workingTopLevel.length + 1;
  const headerLabel =
    mode.kind === 'log'
      ? `Set ${nextSetNumber}`
      : mode.kind === 'drop'
        ? `Drop · ${mode.label}`
        : `Editing ${mode.label}`;

  const comparison = mode.kind === 'log' ? lastSession[workingTopLevel.length] ?? null : null;
  const step = displayStep(settings);
  const unitLabel = UNIT_LABEL[settings.units];

  // Live mid-set PR flag (PRD §7): only in plain log mode — a drop link or an
  // edit to an old set isn't "beating a PR" in the moment the way a fresh
  // working set is — and only once there's a real best to beat, so a
  // brand-new exercise with zero history doesn't flag its very first set.
  const bestDisplay = bestWeightKg !== null ? toDisplay(bestWeightKg, settings.units) : null;
  const isPr = mode.kind === 'log' && !warmup && bestDisplay !== null && weight > bestDisplay;

  // Fires the instant a stepper change crosses into PR territory (not via a
  // useEffect watching `isPr` — that value isn't computed until after this
  // component's one early return above, so a hook depending on it would run
  // a different number of times across renders). Mirrors `isPr`'s own guard
  // conditions exactly, so a drop-set weight or an edit to an old set never
  // celebrates — only a genuine new working set does.
  const handleWeightChange = (next: number) => {
    const nextBeatsRecord = mode.kind === 'log' && !warmup && bestDisplay !== null && next > bestDisplay;
    if (nextBeatsRecord && !isPr) haptics.celebrate();
    setWeight(next);
  };

  return (
    <View style={styles.page}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pageContent}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled">
        {/* Index 0 = sticky. It stays pinned at the top while the list below
            scrolls underneath it, so it's always reachable to check while
            logged sets scroll past — and unlike the old fixed-section
            layout, nothing here is fighting the logged-sets list for a
            shared flex:1 budget, so the list can never get squeezed to zero
            height on a short screen. Needs its own opaque background — once
            sticky, scrolled content passes directly underneath it. */}
        <View style={styles.entrySection}>
          <View style={styles.entryHead}>
            <Text style={styles.setLabel} allowFontScaling={false}>
              {headerLabel}
            </Text>
            {mode.kind !== 'log' ? (
              <Pressable onPress={cancelEntry} hitSlop={8}>
                <Text style={styles.cancel} allowFontScaling={false}>
                  Cancel
                </Text>
              </Pressable>
            ) : null}
          </View>

          <GlassSurface style={[styles.card, styles.stackTop]}>
            <Stepper
              value={weight}
              onChange={handleWeightChange}
              step={step}
              min={0}
              max={500}
              format={formatWeight}
              unitLabel={unitLabel}
              allowDecimal
              compact
              accessibilityLabel="weight"
              footer={
                mode.kind === 'log' ? (
                  <View style={styles.stepperFooter}>
                    <LastSessionDelta
                      current={weight}
                      previous={comparison ? toDisplay(comparison.weight_kg, settings.units) : null}
                      format={formatWeight}
                      suffix={unitLabel}
                    />
                    {isPr ? (
                      <Text style={styles.prBadge} allowFontScaling={false}>
                        🏆 New PR
                      </Text>
                    ) : null}
                  </View>
                ) : undefined
              }
            />
          </GlassSurface>

          <GlassSurface style={[styles.card, styles.stackTop]}>
            <Stepper
              value={reps}
              onChange={setReps}
              step={1}
              min={1}
              max={100}
              unitLabel="reps"
              compact
              accessibilityLabel="reps"
              footer={
                mode.kind === 'log' ? (
                  <LastSessionDelta current={reps} previous={comparison?.reps ?? null} />
                ) : undefined
              }
            />
            <View style={styles.chipsRow}>
              <RepChips chips={settings.rep_chips} value={reps} onSelect={setReps} />
            </View>
          </GlassSurface>

          <View style={[styles.toggles, styles.stackTop]}>
            {mode.kind !== 'drop' ? (
              <TogglePill
                label="Warm-up"
                active={warmup}
                onPress={() => {
                  haptics.tick();
                  setWarmup((v) => !v);
                }}
              />
            ) : null}
            <TogglePill
              label="To failure"
              active={toFailure}
              onPress={() => {
                haptics.tick();
                setToFailure((v) => !v);
              }}
            />
          </View>
        </View>

        {topLevel.length > 0 ? (
          <View style={styles.listContent}>
            {topLevel.map((set, index) => (
              <View key={set.id} style={index > 0 ? styles.setGroupSpaced : undefined}>
                <SetRow
                  index={index + 1}
                  set={set}
                  settings={settings}
                  onMenu={() => openMenu(set)}
                  onDrop={() => beginDrop(set)}
                />
                {childrenOf(set.id).map((child) => (
                  <SetRow key={child.id} set={child} settings={settings} onMenu={() => openMenu(child)} drop />
                ))}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Docked to the bottom of this PAGE's own flex column, not the
          scrolling content — it never moves as the logged-sets list grows,
          and since this page fills the same height as the pager itself,
          it lands directly above the outer Finish Workout footer. */}
      <View style={styles.logSetFooter}>
        <PrimaryButton
          label={mode.kind === 'log' ? 'Log Set' : mode.kind === 'drop' ? 'Add Drop' : 'Save Changes'}
          onPress={submit}
          loading={saving}
          compact
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------- rows */

interface TogglePillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

/**
 * Active state is purple glass — `colors.accent` tint, real blur — not the
 * old solid warmup-blue/failure-orange fill. Only the active state gets
 * `GlassSurface`'s blur layer; inactive stays the plain token-based look
 * every other rest-state pill in the app uses, since there's no need to pay
 * for blur on a state that's just sitting there unselected.
 */
function TogglePill({ label, active, onPress }: TogglePillProps) {
  if (active) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={styles.pillFlex}>
        <GlassSurface style={styles.pillActive}>
          <Text style={styles.pillTextActive} allowFontScaling={false}>
            {label}
          </Text>
        </GlassSurface>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.pillFlex, styles.pill]}>
      <Text style={styles.pillText} allowFontScaling={false}>
        {label}
      </Text>
    </Pressable>
  );
}

interface SetRowProps {
  set: WorkoutSet;
  settings: AppSettings;
  onMenu: () => void;
  onDrop?: () => void;
  index?: number;
  drop?: boolean;
}

function SetRow({ set, settings, onMenu, onDrop, index, drop }: SetRowProps) {
  const weightText = formatWeight(toDisplay(set.weight_kg, settings.units));
  const unitLabel = UNIT_LABEL[settings.units];

  const content = (
    <>
      <Text style={[styles.rowIndex, drop && styles.rowIndexDrop]} allowFontScaling={false}>
        {drop ? '→' : index}
      </Text>
      <Text style={[styles.rowText, drop && styles.rowTextDrop]} allowFontScaling={false}>
        {weightText} {unitLabel} × {set.reps}
      </Text>
      {set.set_type === 'warmup' ? (
        <Text style={[styles.tag, styles.tagWarmup]} allowFontScaling={false}>
          WU
        </Text>
      ) : null}
      {set.to_failure === 1 ? (
        <Text style={[styles.tag, styles.tagFailure]} allowFontScaling={false}>
          TF
        </Text>
      ) : null}
      <View style={styles.rowActions}>
        {!drop && onDrop ? (
          <Pressable onPress={onDrop} hitSlop={8}>
            <Text style={styles.dropAction} allowFontScaling={false}>
              +drop
            </Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onMenu} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    </>
  );

  // Drop children stay a plain transparent, indented row — no card of their
  // own, visually subordinate to the working set above them. The glass
  // treatment (and the blur-skip, see GlassSurface's own comment) is only
  // for the top-level logged sets, which is what was actually invisible
  // right after logging.
  if (drop) {
    return <View style={[styles.row, styles.rowDrop]}>{content}</View>;
  }

  return (
    <GlassSurface blur={false} style={styles.row}>
      {content}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1 },
  scroll: { flex: 1 },
  pageContent: { flexGrow: 1 },
  // Opaque, not transparent — required once this is a sticky header (index 0
  // of the outer ScrollView): without a real fill, content scrolled
  // underneath it would show straight through.
  // NO `gap` here, deliberately. On this RN/Yoga version `gap` is honoured on
  // `flexDirection: 'row'` containers but silently ignored on column ones —
  // measured off a device screenshot: the toggles row's 8dp row-gap rendered
  // exactly 8dp, while this container's 16dp gap rendered 0 and the cards sat
  // flush against each other. Vertical spacing on this screen therefore uses
  // margins (`stackTop`), which do render. Same reason for `listContent` and
  // `rowDrop` below.
  entrySection: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  /** The 12px vertical rhythm between the entry section's stacked children. */
  stackTop: { marginTop: spacing.md },
  // Below the scrolling ScrollView, not inside it — a flex sibling that
  // always sits at the bottom of this page's own height, immediately above
  // workout/log.tsx's screen-level Finish Workout footer. `paddingBottom` is
  // the whole gap between the two buttons (12px): log.tsx's footer pairs
  // this with `paddingTop: 0`, so the two paddings can't stack into 24.
  logSetFooter: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  /** Applied to every logged-set group except the first — see `entrySection`. */
  setGroupSpaced: { marginTop: spacing.md },
  entryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setLabel: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  cancel: { color: colors.textSecondary, fontSize: font.label, fontWeight: '600' },
  // Padding trimmed 16 → 12 as part of shrinking both boxes; the 12px gap
  // between the stepper row and the chip row below it is unchanged.
  // No `gap` — column container, see `entrySection`. The reps card's chip row
  // carries its own `chipsRow` margin instead.
  card: { padding: spacing.md },
  /** The 12px between the reps stepper and the quick-pick chips below it. */
  chipsRow: { marginTop: spacing.md },
  stepperFooter: { alignItems: 'center' },
  prBadge: { color: colors.accent, fontSize: font.caption, fontWeight: '800', marginTop: 2 },
  toggles: { flexDirection: 'row', gap: spacing.sm },
  pillFlex: { flex: 1 },
  pill: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { color: colors.textSecondary, fontSize: font.label, fontWeight: '700' },
  pillTextActive: { color: colors.accent, fontSize: font.label, fontWeight: '800' },
  // Mockup: logged-set row is one flat flex row, `padding:8px 12px`,
  // `gap:8px` applied uniformly between every child.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  // `marginTop` carries the 12px from the working set above (or the previous
  // drop in the same chain) — the old `setGroup` `gap` never rendered.
  rowDrop: { marginLeft: spacing.xl, marginTop: spacing.md, backgroundColor: 'transparent' },
  rowIndex: {
    color: colors.textMuted,
    fontSize: font.caption,
    fontWeight: '700',
    minWidth: 18,
    fontVariant: ['tabular-nums'],
  },
  rowIndexDrop: { color: colors.drop },
  rowText: {
    flex: 1,
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rowTextDrop: { color: colors.drop, fontSize: font.label },
  tag: {
    fontSize: font.micro,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  tagWarmup: { color: colors.warmup, backgroundColor: 'rgba(91, 168, 255, 0.14)' },
  tagFailure: { color: colors.failure, backgroundColor: 'rgba(255, 138, 61, 0.14)' },
  // `gap: spacing.sm` (8px), matching `row`'s own gap — the mockup's row is
  // one flat flex container with a single uniform 8px gap between every
  // child, "+drop" and the ⋮ icon included. Was `spacing.md` (12px), which
  // broke that rhythm between just those last two elements.
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dropAction: { color: colors.accent, fontSize: font.caption, fontWeight: '700' },
});
