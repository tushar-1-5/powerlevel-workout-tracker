import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import * as haptics from '@/lib/haptics';
import type { SplitDay } from '@/db/types';
import { colors, font, glass, hit, radius, spacing } from '@/theme/tokens';

export interface GroupSelectorRowProps {
  days: SplitDay[];
  selectedDayId: string | null;
  onSelect: (dayId: string) => void;
}

/**
 * The row of day-group chips — Push / Pull / Legs, and so on. Always
 * tappable, never locked: the suggested day is a default, not a lock (the
 * PRD is explicit about this), so every chip stays enabled regardless of
 * which one is currently selected.
 */
export function GroupSelectorRow({ days, selectedDayId, onSelect }: GroupSelectorRowProps) {
  const pick = (dayId: string) => {
    if (dayId === selectedDayId) return;
    haptics.tick();
    onSelect(dayId);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {days.map((day) => {
        const active = day.id === selectedDayId;
        return (
          <Pressable
            key={day.id}
            onPress={() => pick(day.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{day.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    minHeight: hit.min,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  chipTextActive: { color: colors.onAccent },
});
