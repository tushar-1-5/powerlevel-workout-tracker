import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/GlassSurface';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Stepper } from '@/components/Stepper';
import { TemplateSplitCard } from '@/components/TemplateSplitCard';
import { createSplitFromTemplate } from '@/db/seed';
import { SEED_SPLITS, type SeedSplit } from '@/db/seed/splits';
import type { Units } from '@/db/types';
import * as haptics from '@/lib/haptics';
import { TODAY } from '@/lib/routes';
import { formatWeight } from '@/lib/units';
import { updateSettings } from '@/queries/settings';
import { createSplit, setDefaultSplit } from '@/queries/splits';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

type Step = 'welcome' | 'template' | 'confirm';
const STEPS: Step[] = ['welcome', 'template', 'confirm'];

/**
 * First-launch onboarding from the PRD's §10: what's one-time setup vs. what
 * you do every workout, pick a starting split (previewed before you commit),
 * confirm units and step size, straight to Today. One file, one internal
 * step index rather than three routes — a linear wizard with no reason to
 * ever be deep-linked into its middle, so a router back-stack between steps
 * would only add complexity (what does "back" even mean mid-onboarding?)
 * without buying anything.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<Step>('welcome');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [units, setUnits] = useState<Units>('kg');
  const [stepKg, setStepKg] = useState(0.5);
  const [stepLb, setStepLb] = useState(1);
  const [finishing, setFinishing] = useState(false);

  const pickTemplate = async (template: SeedSplit) => {
    if (creating) return;
    setCreating(true);
    haptics.confirm();
    try {
      const id = await createSplitFromTemplate(template);
      await setDefaultSplit(id);
      setStep('confirm');
    } finally {
      setCreating(false);
    }
  };

  const pickBlank = async () => {
    if (creating) return;
    setCreating(true);
    haptics.tick();
    try {
      const id = await createSplit('My Split', 'rotation');
      await setDefaultSplit(id);
      setStep('confirm');
    } finally {
      setCreating(false);
    }
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    haptics.confirm();
    await updateSettings({
      onboarded: true,
      units,
      weight_step_kg: stepKg,
      weight_step_lb: stepLb,
    });
    router.replace(TODAY);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.dots}>
        {STEPS.map((s) => (
          <View key={s} style={[styles.dot, s === step && styles.dotActive]} />
        ))}
      </View>

      {step === 'welcome' ? (
        <View style={styles.welcomeWrap}>
          <Text style={styles.eyebrow}>Welcome to</Text>
          <Text style={styles.brand}>PowerLevel</Text>
          <Text style={styles.body}>
            A couple of screens now set up your training split, units, and step size — one-time
            setup. After that, every workout is just Start → log sets → Finish.
          </Text>
          <View style={styles.welcomeFooter}>
            <PrimaryButton label="Get Started" onPress={() => setStep('template')} />
          </View>
        </View>
      ) : step === 'template' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Pick a split</Text>
          <Text style={styles.subtitle}>Everything here is editable later.</Text>

          {SEED_SPLITS.map((template, index) => (
            <TemplateSplitCard
              key={template.name}
              template={template}
              expanded={expanded === index}
              onToggle={() => setExpanded(expanded === index ? null : index)}
              onPick={() => pickTemplate(template)}
              picking={creating}
            />
          ))}

          <Pressable onPress={pickBlank} style={styles.blankRow} disabled={creating}>
            {creating ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.blankText}>Start blank instead</Text>
            )}
          </Pressable>
        </ScrollView>
      ) : (
        <View style={styles.content}>
          <Text style={styles.title}>Units &amp; step size</Text>
          <Text style={styles.subtitle}>Change these anytime in Settings.</Text>

          <View style={styles.segmented}>
            <SegmentButton label="Kilograms (kg)" active={units === 'kg'} onPress={() => setUnits('kg')} />
            <SegmentButton label="Pounds (lb)" active={units === 'lb'} onPress={() => setUnits('lb')} />
          </View>

          <GlassSurface style={styles.stepCard}>
            <Stepper
              value={units === 'lb' ? stepLb : stepKg}
              onChange={units === 'lb' ? setStepLb : setStepKg}
              step={units === 'lb' ? 0.5 : 0.25}
              min={units === 'lb' ? 0.5 : 0.25}
              max={units === 'lb' ? 50 : 25}
              format={formatWeight}
              unitLabel={units}
              allowDecimal
              accessibilityLabel="weight step size"
            />
          </GlassSurface>

          <View style={styles.welcomeFooter}>
            <PrimaryButton label="Start Training" onPress={finish} loading={finishing} />
          </View>
        </View>
      )}
    </View>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptics.tick();
        onPress();
      }}
      style={[styles.segment, active && styles.segmentActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingTop: spacing.lg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent },
  welcomeWrap: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.xs },
  eyebrow: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  brand: { color: colors.accent, fontSize: 44, fontWeight: '800', marginBottom: spacing.lg },
  body: { color: colors.textSecondary, fontSize: font.body, lineHeight: 23 },
  welcomeFooter: { marginTop: spacing.xxl },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md, flexGrow: 1 },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: font.body, marginBottom: spacing.sm },
  blankRow: { alignItems: 'center', paddingVertical: spacing.lg },
  blankText: { color: colors.textSecondary, fontSize: font.body, fontWeight: '600' },
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
  stepCard: { padding: spacing.lg },
});
