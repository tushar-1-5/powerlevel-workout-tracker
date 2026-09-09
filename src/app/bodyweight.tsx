import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { GlassSurface } from '@/components/GlassSurface';
import { LineChart } from '@/components/LineChart';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Stepper } from '@/components/Stepper';
import type { AppSettings, BodyweightLog } from '@/db/types';
import * as haptics from '@/lib/haptics';
import { formatShortDate, fromDateKey, toDateKey } from '@/lib/format';
import { formatWeight, fromDisplay, toDisplay, UNIT_LABEL } from '@/lib/units';
import { deleteBodyweightLog, listBodyweightLogs, logBodyweight } from '@/queries/bodyweight';
import { getSettings } from '@/queries/settings';
import { colors, font, glass, spacing } from '@/theme/tokens';

/** Bodyweight log + trend chart — the PRD's §8 "extra": a log entry plus a trend chart. */
export default function BodyweightScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [logs, setLogs] = useState<BodyweightLog[]>([]);
  const [draft, setDraft] = useState(70);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [appSettings, list] = await Promise.all([getSettings(), listBodyweightLogs()]);
    setSettings(appSettings);
    setLogs(list);
    const latest = list[0];
    setDraft(latest ? toDisplay(latest.weight_kg, appSettings.units) : toDisplay(70, appSettings.units));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleLog = async () => {
    if (!settings || saving) return;
    setSaving(true);
    haptics.confirm();
    try {
      await logBodyweight(fromDisplay(draft, settings.units), toDateKey(Date.now()));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (log: BodyweightLog) => {
    Alert.alert('Delete this entry?', formatShortDate(fromDateKey(log.logged_on)), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptics.warn();
          void deleteBodyweightLog(log.id).then(load);
        },
      },
    ]);
  };

  if (!settings) return null;

  const unitLabel = UNIT_LABEL[settings.units];
  // Chart wants oldest-first; `logs` is newest-first from the query.
  const chartValues = [...logs].reverse().map((l) => toDisplay(l.weight_kg, settings.units));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Bodyweight</Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <GlassSurface style={styles.card}>
          <Stepper
            value={draft}
            onChange={setDraft}
            step={settings.units === 'lb' ? 0.5 : 0.25}
            min={0}
            max={settings.units === 'lb' ? 1000 : 450}
            format={formatWeight}
            unitLabel={unitLabel}
            allowDecimal
            accessibilityLabel="bodyweight"
          />
          <PrimaryButton label="Log Today's Weight" onPress={handleLog} loading={saving} />
        </GlassSurface>

        {chartValues.length >= 2 ? (
          <GlassSurface style={styles.card}>
            <Text style={styles.sectionTitle}>Trend</Text>
            <LineChart values={chartValues} />
          </GlassSurface>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History</Text>
          {logs.length === 0 ? (
            <EmptyState title="No entries yet" body="Log your weight above to start a trend." />
          ) : (
            <GlassSurface style={styles.card}>
              {logs.map((log, index) => (
                <View key={log.id} style={[styles.row, index < logs.length - 1 && styles.rowDivider]}>
                  <Text style={styles.rowDate}>{formatShortDate(fromDateKey(log.logged_on))}</Text>
                  <Text style={styles.rowWeight}>
                    {formatWeight(toDisplay(log.weight_kg, settings.units))} {unitLabel}
                  </Text>
                  <Pressable onPress={() => handleDelete(log)} hitSlop={8}>
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </GlassSurface>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  backSpacer: { width: 44 },
  title: { color: colors.text, fontSize: font.heading, fontWeight: '800' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  card: { padding: spacing.lg, gap: spacing.md },
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: glass.border },
  rowDate: { flex: 1, color: colors.text, fontSize: font.body, fontWeight: '600' },
  rowWeight: { color: colors.textSecondary, fontSize: font.body, fontVariant: ['tabular-nums'] },
});
