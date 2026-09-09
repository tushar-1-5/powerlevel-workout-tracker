import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/GlassSurface';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TemplateSplitCard } from '@/components/TemplateSplitCard';
import { createSplitFromTemplate } from '@/db/seed';
import { SEED_SPLITS, type SeedSplit } from '@/db/seed/splits';
import type { ScheduleMode } from '@/db/types';
import * as haptics from '@/lib/haptics';
import { createSplit } from '@/queries/splits';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

type Mode = 'choose' | 'template' | 'blank';

/**
 * A new split. Onboarding is the only OTHER place the premade templates
 * (`SEED_SPLITS`) were ever reachable from — once past first launch there
 * was no way back to them, which is exactly the bug this screen's "start
 * from a template" path fixes. Picking a template here does NOT call
 * `setDefaultSplit` (that's onboarding-only semantics, for the very first
 * split); this is just another split alongside whatever already exists.
 */
export default function NewSplitScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('choose');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('rotation');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && !saving;

  const saveBlank = async () => {
    if (!canSave) return;
    setSaving(true);
    haptics.confirm();
    try {
      const id = await createSplit(name, scheduleMode);
      router.replace({ pathname: '/splits/[splitId]', params: { splitId: id } });
    } catch {
      haptics.warn();
      setSaving(false);
    }
  };

  const pickTemplate = async (template: SeedSplit) => {
    if (picking) return;
    setPicking(true);
    setTemplateError(null);
    haptics.confirm();
    try {
      const id = await createSplitFromTemplate(template);
      router.replace({ pathname: '/splits/[splitId]', params: { splitId: id } });
    } catch (err) {
      haptics.warn();
      setTemplateError(err instanceof Error ? err.message : 'Could not create that split.');
      setPicking(false);
    }
  };

  // Step-local back, not router history — from either sub-screen, back means
  // "back to choosing," not "leave this whole flow."
  const back = () => {
    if (mode === 'choose') router.back();
    else setMode('choose');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
          <Text style={styles.back}>{mode === 'choose' ? 'Cancel' : 'Back'}</Text>
        </Pressable>
        <Text style={styles.title}>New Split</Text>
        <View style={styles.backSpacer} />
      </View>

      {mode === 'choose' ? (
        <View style={styles.content}>
          <Pressable onPress={() => setMode('template')}>
            <GlassSurface style={styles.choiceCard}>
              <Text style={styles.choiceTitle}>Start from a template</Text>
              <Text style={styles.choiceBody}>
                Pick one of the built-in splits — Push/Pull/Legs, Upper/Lower, and more — previewed
                before you commit.
              </Text>
            </GlassSurface>
          </Pressable>
          <Pressable onPress={() => setMode('blank')}>
            <GlassSurface style={styles.choiceCard}>
              <Text style={styles.choiceTitle}>Start blank</Text>
              <Text style={styles.choiceBody}>Name it and build it up day-group by day-group yourself.</Text>
            </GlassSurface>
          </Pressable>
        </View>
      ) : mode === 'template' ? (
        <ScrollView contentContainerStyle={styles.content}>
          {templateError ? <Text style={styles.errorText}>{templateError}</Text> : null}
          {SEED_SPLITS.map((template, index) => (
            <TemplateSplitCard
              key={template.name}
              template={template}
              expanded={expanded === index}
              onToggle={() => setExpanded(expanded === index ? null : index)}
              onPick={() => pickTemplate(template)}
              picking={picking}
            />
          ))}
        </ScrollView>
      ) : (
        <>
          <View style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Push Pull Legs"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoFocus
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Schedule mode</Text>
              <View style={styles.segmented}>
                <SegmentButton
                  label="Rotation"
                  hint="Suggests the next day in order"
                  active={scheduleMode === 'rotation'}
                  onPress={() => setScheduleMode('rotation')}
                />
                <SegmentButton
                  label="Calendar"
                  hint="Assign days to weekdays"
                  active={scheduleMode === 'calendar'}
                  onPress={() => setScheduleMode('calendar')}
                />
              </View>
            </View>
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            <PrimaryButton label="Create Split" onPress={saveBlank} disabled={!canSave} loading={saving} />
          </View>
        </>
      )}
    </View>
  );
}

function SegmentButton({
  label,
  hint,
  active,
  onPress,
}: {
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.tick();
        onPress();
      }}
      style={[styles.segment, active && styles.segmentActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
      <Text style={[styles.segmentHint, active && styles.segmentHintActive]}>{hint}</Text>
    </Pressable>
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
  backSpacer: { width: 60 },
  title: { color: colors.text, fontSize: font.heading, fontWeight: '800' },
  content: { flexGrow: 1, padding: spacing.lg, gap: spacing.md },
  choiceCard: { padding: spacing.lg, gap: spacing.xs },
  choiceTitle: { color: colors.text, fontSize: font.heading, fontWeight: '700' },
  choiceBody: { color: colors.textSecondary, fontSize: font.body, lineHeight: 20 },
  errorText: { color: colors.danger, fontSize: font.caption, marginBottom: spacing.xs },
  section: { gap: spacing.sm },
  label: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
  },
  segmented: { gap: spacing.sm },
  segment: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
  },
  segmentActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  segmentText: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  segmentTextActive: { color: colors.accent },
  segmentHint: { color: colors.textSecondary, fontSize: font.caption, marginTop: 2 },
  segmentHintActive: { color: colors.textSecondary },
  footer: { padding: spacing.lg, paddingTop: spacing.sm },
});
