import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import {
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  type Equipment,
  type MuscleGroup,
} from '@/db/types';
import * as haptics from '@/lib/haptics';
import { createExercise } from '@/queries/exercises';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

const MUSCLE_GROUPS = Object.keys(MUSCLE_LABELS) as MuscleGroup[];
const EQUIPMENT_TYPES = Object.keys(EQUIPMENT_LABELS) as Equipment[];

/** A custom exercise, added to the library from the picker's "+ New" link. */
export default function NewExerciseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    haptics.confirm();
    try {
      await createExercise({ name, muscle_group: muscleGroup, equipment });
      router.back();
    } catch {
      haptics.warn();
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
          <Text style={styles.back}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>New Exercise</Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Cable Y-Raise"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoFocus
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Muscle group</Text>
          <View style={styles.grid}>
            {MUSCLE_GROUPS.map((mg) => (
              <PickChip
                key={mg}
                label={MUSCLE_LABELS[mg]}
                active={muscleGroup === mg}
                onPress={() => setMuscleGroup(mg)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Equipment</Text>
          <View style={styles.grid}>
            {EQUIPMENT_TYPES.map((eq) => (
              <PickChip
                key={eq}
                label={EQUIPMENT_LABELS[eq]}
                active={equipment === eq}
                onPress={() => setEquipment(eq)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton label="Add Exercise" onPress={save} disabled={!canSave} loading={saving} />
      </View>
    </View>
  );
}

function PickChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptics.tick();
        onPress();
      }}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl },
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: font.caption, fontWeight: '700' },
  chipTextActive: { color: colors.onAccent },
  footer: { padding: spacing.lg, paddingTop: spacing.sm },
});
