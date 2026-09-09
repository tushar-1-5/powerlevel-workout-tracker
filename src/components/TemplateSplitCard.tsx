import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/GlassSurface';
import { PrimaryButton } from '@/components/PrimaryButton';
import type { SeedSplit } from '@/db/seed/splits';
import * as haptics from '@/lib/haptics';
import { colors, font, radius, spacing } from '@/theme/tokens';

export interface TemplateSplitCardProps {
  template: SeedSplit;
  expanded: boolean;
  onToggle: () => void;
  onPick: () => void;
  picking: boolean;
}

/**
 * One premade split template — collapsed to name/day-count/RECOMMENDED
 * badge, expands to a day-by-day preview with a "Use this template" button.
 * Shared between onboarding's template picker (Block 11) and the Splits
 * screen's "start from a template" path (the only two places a template can
 * actually be turned into a real split), so the two never drift apart.
 */
export function TemplateSplitCard({ template, expanded, onToggle, onPick, picking }: TemplateSplitCardProps) {
  return (
    <GlassSurface style={styles.card}>
      <Pressable
        onPress={() => {
          haptics.tick();
          onToggle();
        }}>
        <View style={styles.head}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{template.name}</Text>
            {template.isDefault ? <Text style={styles.recommended}>RECOMMENDED</Text> : null}
          </View>
          <Text style={styles.meta}>
            {template.days.length} day{template.days.length === 1 ? '' : 's'} · {expanded ? 'Hide' : 'Preview'}
          </Text>
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.detail}>
          {template.days.map((day) => (
            <View key={day.name} style={styles.day}>
              <Text style={styles.dayName}>{day.name}</Text>
              <Text style={styles.dayExercises}>{day.exercises.join(' · ')}</Text>
            </View>
          ))}
          <PrimaryButton label={`Use ${template.name}`} onPress={onPick} loading={picking} />
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  name: { color: colors.text, fontSize: font.heading, fontWeight: '700' },
  recommended: {
    color: colors.onAccent,
    backgroundColor: colors.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  meta: { color: colors.accent, fontSize: font.caption, fontWeight: '700' },
  detail: { gap: spacing.md, marginTop: spacing.xs },
  day: { gap: 2 },
  dayName: { color: colors.text, fontSize: font.label, fontWeight: '700' },
  dayExercises: { color: colors.textSecondary, fontSize: font.caption, lineHeight: 18 },
});
