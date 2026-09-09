import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/GlassSurface';
import { Stepper } from '@/components/Stepper';
import type { AppSettings, Units } from '@/db/types';
import * as haptics from '@/lib/haptics';
import { exportBackup, importBackup } from '@/lib/backup';
import { formatWeight } from '@/lib/units';
import { getSettings, updateSettings } from '@/queries/settings';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

/**
 * Settings from the PRD's nav table: step size, units, rep chips, haptics,
 * animations, and (§13, Phase 3) export/import. Account is Phase 4 and
 * intentionally absent. Lives as the 4th bottom tab (moved here from a
 * pushed route reached via the overflow menu) — always one tap away rather
 * than a menu-hunt, per Jakob's Law.
 *
 * Every field saves immediately on change rather than behind a "Save"
 * button, matching how the rest of the app already treats mutations (a
 * logged set, a toggled warm-up flag) as committed the instant you make
 * them.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [chipDrafts, setChipDrafts] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getSettings().then((s) => {
      if (cancelled) return;
      setSettings(s);
      setChipDrafts(s.rep_chips.map(String));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = useCallback(async (next: Partial<AppSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...next } : prev));
    await updateSettings(next);
  }, []);

  const setUnits = useCallback(
    (units: Units) => {
      if (units === settings?.units) return;
      haptics.tick();
      void patch({ units });
    },
    [settings?.units, patch],
  );

  const setStep = useCallback(
    (value: number) => {
      if (!settings) return;
      void patch(settings.units === 'lb' ? { weight_step_lb: value } : { weight_step_kg: value });
    },
    [settings, patch],
  );

  const commitChip = useCallback(
    (index: number) => {
      setChipDrafts((drafts) => {
        const parsed = Number.parseInt(drafts[index], 10);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          haptics.warn();
          return settings ? settings.rep_chips.map(String) : drafts;
        }
        const nextChips = (settings?.rep_chips ?? []).map((c, i) => (i === index ? parsed : c));
        void patch({ rep_chips: nextChips });
        return nextChips.map(String);
      });
    },
    [settings, patch],
  );

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    haptics.confirm();
    try {
      await exportBackup();
    } catch {
      haptics.warn();
      Alert.alert('Export failed', 'Could not create the backup file.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = () => {
    if (importing) return;
    Alert.alert(
      'Restore from backup?',
      'This replaces everything currently in PowerLevel — every split, workout, and set — with what\'s in the backup file. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setImporting(true);
            haptics.warn();
            try {
              const result = await importBackup();
              if (result.ok) {
                haptics.confirm();
                Alert.alert('Restored', 'Restart the app to see the restored data everywhere.');
              } else if (result.error) {
                Alert.alert('Restore failed', result.error);
              }
            } catch {
              Alert.alert('Restore failed', 'Something went wrong reading that file.');
            } finally {
              setImporting(false);
            }
          },
        },
      ],
    );
  };

  if (!settings) {
    return (
      <View style={[styles.screen, styles.centre, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const step = settings.units === 'lb' ? settings.weight_step_lb : settings.weight_step_kg;
  const stepIncrement = settings.units === 'lb' ? 0.5 : 0.25;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Units">
          <View style={styles.segmented}>
            <SegmentButton label="Kilograms (kg)" active={settings.units === 'kg'} onPress={() => setUnits('kg')} />
            <SegmentButton label="Pounds (lb)" active={settings.units === 'lb'} onPress={() => setUnits('lb')} />
          </View>
        </Section>

        <Section title="Weight step size" hint={`Applied to every weight stepper, in ${settings.units}.`}>
          <GlassSurface style={styles.card}>
            <Stepper
              value={step}
              onChange={setStep}
              step={stepIncrement}
              min={stepIncrement}
              max={settings.units === 'lb' ? 50 : 25}
              format={formatWeight}
              unitLabel={settings.units}
              allowDecimal
              accessibilityLabel="weight step size"
            />
          </GlassSurface>
        </Section>

        <Section title="Rep chips" hint="Quick-select values on the logging screen.">
          <View style={styles.chipsRow}>
            {chipDrafts.map((draft, index) => (
              <TextInput
                key={index}
                value={draft}
                onChangeText={(text) =>
                  setChipDrafts((drafts) => drafts.map((d, i) => (i === index ? text.replace(/[^0-9]/g, '') : d)))
                }
                onBlur={() => commitChip(index)}
                onSubmitEditing={() => commitChip(index)}
                keyboardType="number-pad"
                returnKeyType="done"
                selectTextOnFocus
                style={styles.chipInput}
                maxLength={3}
              />
            ))}
          </View>
        </Section>

        <Section title="Feel">
          <ToggleRow
            label="Haptics"
            hint="A light tick on every stepper press."
            active={settings.haptics_enabled}
            onToggle={() => {
              haptics.tick();
              void patch({ haptics_enabled: !settings.haptics_enabled });
            }}
          />
          <ToggleRow
            label="Animations"
            hint="Includes the finish-workout ki aura."
            active={settings.animations_enabled}
            onToggle={() => {
              haptics.tick();
              void patch({ animations_enabled: !settings.animations_enabled });
            }}
          />
        </Section>

        <Section title="Backup" hint="A JSON file with everything — splits, workouts, sets, settings.">
          <GlassSurface style={styles.card}>
            <Pressable style={styles.backupRow} onPress={handleExport} disabled={exporting}>
              {exporting ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={styles.backupAction}>Export Backup</Text>
              )}
            </Pressable>
            <View style={styles.backupDivider} />
            <Pressable style={styles.backupRow} onPress={handleImport} disabled={importing}>
              {importing ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={styles.backupActionDanger}>Restore from Backup…</Text>
              )}
            </Pressable>
          </GlassSurface>
        </Section>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------- rows */

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.segment, active && styles.segmentActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({
  label,
  hint,
  active,
  onToggle,
}: {
  label: string;
  hint: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <GlassSurface style={styles.toggleCard}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: active }}
        style={[styles.switch, active && styles.switchActive]}>
        <View style={[styles.switchKnob, active && styles.switchKnobActive]} />
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centre: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxxl, gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionHint: { color: colors.textSecondary, fontSize: font.caption, marginTop: -spacing.xs },
  card: { padding: spacing.lg },
  segmented: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  segmentActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segmentText: { color: colors.textSecondary, fontSize: font.label, fontWeight: '700' },
  segmentTextActive: { color: colors.onAccent },
  chipsRow: { flexDirection: 'row', gap: spacing.sm },
  chipInput: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    color: colors.text,
    fontSize: font.heading,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  toggleCard: {
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  toggleInfo: { flex: 1, gap: 2, paddingRight: spacing.md },
  toggleLabel: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  toggleHint: { color: colors.textSecondary, fontSize: font.caption },
  switch: {
    width: 52,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    justifyContent: 'center',
    padding: 2,
  },
  switchActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  switchKnob: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.textSecondary,
  },
  switchKnobActive: { backgroundColor: colors.accent, alignSelf: 'flex-end' },
  backupRow: { paddingVertical: spacing.md, alignItems: 'center' },
  backupAction: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  backupActionDanger: { color: colors.danger, fontSize: font.body, fontWeight: '700' },
  backupDivider: { height: 1, backgroundColor: glass.border },
});
