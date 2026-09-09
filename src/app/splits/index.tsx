import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { GlassSurface } from '@/components/GlassSurface';
import type { Split } from '@/db/types';
import * as haptics from '@/lib/haptics';
import {
  deleteSplit,
  duplicateSplit,
  getSplitDays,
  listSplits,
  setDefaultSplit,
} from '@/queries/splits';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

interface SplitRow extends Split {
  dayCount: number;
}

/** Splits list from the PRD's nav table: list, set default, duplicate, delete. */
export default function SplitsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [splits, setSplits] = useState<SplitRow[]>([]);

  const load = useCallback(async () => {
    const list = await listSplits();
    const withCounts = await Promise.all(
      list.map(async (s) => ({ ...s, dayCount: (await getSplitDays(s.id)).length })),
    );
    setSplits(withCounts);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleSetDefault = async (id: string) => {
    haptics.tick();
    await setDefaultSplit(id);
    await load();
  };

  const handleDuplicate = async (id: string) => {
    haptics.confirm();
    const newId = await duplicateSplit(id);
    await load();
    if (newId) router.push({ pathname: '/splits/[splitId]', params: { splitId: newId } });
  };

  const handleDelete = (split: SplitRow) => {
    Alert.alert(`Delete "${split.name}"?`, 'This removes every day-group and exercise in it. Past workout history is unaffected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptics.warn();
          void deleteSplit(split.id).then(load);
        },
      },
    ]);
  };

  const handleCreate = () => router.push('/splits/new');

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Splits</Text>
        <Pressable onPress={handleCreate} hitSlop={12}>
          <Text style={styles.add}>+ New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : splits.length === 0 ? (
        <EmptyState title="No splits yet" body="Create one to start training." actionLabel="New Split" onAction={handleCreate} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {splits.map((split) => (
            <GlassSurface key={split.id} style={styles.card}>
              <Pressable
                onPress={() => router.push({ pathname: '/splits/[splitId]', params: { splitId: split.id } })}>
                <View style={styles.rowTop}>
                  <Text style={styles.name}>{split.name}</Text>
                  {split.is_default ? <Text style={styles.defaultPill}>DEFAULT</Text> : null}
                </View>
                <Text style={styles.meta}>
                  {split.schedule_mode === 'rotation' ? 'Rotation' : 'Calendar'} · {split.dayCount} day
                  {split.dayCount === 1 ? '' : 's'}
                </Text>
              </Pressable>
              <View style={styles.actions}>
                {!split.is_default ? (
                  <Pressable onPress={() => handleSetDefault(split.id)} hitSlop={8}>
                    <Text style={styles.action}>Set Default</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => handleDuplicate(split.id)} hitSlop={8}>
                  <Text style={styles.action}>Duplicate</Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(split)} hitSlop={8}>
                  <Text style={styles.actionDanger}>Delete</Text>
                </Pressable>
              </View>
            </GlassSurface>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  add: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  title: { color: colors.text, fontSize: font.heading, fontWeight: '800' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  card: { padding: spacing.lg, gap: spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, color: colors.text, fontSize: font.heading, fontWeight: '700' },
  defaultPill: {
    color: colors.onAccent,
    backgroundColor: colors.accent,
    fontSize: font.micro,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  meta: { color: colors.textSecondary, fontSize: font.caption },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: glass.border,
  },
  action: { color: colors.accent, fontSize: font.caption, fontWeight: '700' },
  actionDanger: { color: colors.danger, fontSize: font.caption, fontWeight: '700' },
});
