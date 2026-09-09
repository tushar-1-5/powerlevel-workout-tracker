import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/GlassSurface';
import * as haptics from '@/lib/haptics';
import { colors, font, spacing } from '@/theme/tokens';

export interface OverflowMenuItem {
  label: string;
  onPress: () => void;
}

export interface OverflowMenuProps {
  items: OverflowMenuItem[];
}

/**
 * The top-right overflow (⋮) menu the PRD places on every tab (§11): Splits,
 * Exercises, Settings, and eventually Account. Deliberately a custom `Modal`
 * rather than the native `Alert.alert` used for the per-set kebab menu in
 * `ExercisePage` — Android's `Alert.alert` only ever renders its first three
 * buttons, which is already one short of three destinations plus Cancel, and
 * would silently drop an item the moment a fourth destination joins.
 */
export function OverflowMenu({ items }: OverflowMenuProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => {
          haptics.tick();
          setOpen(true);
        }}
        hitSlop={12}
        style={[styles.trigger, { top: insets.top + spacing.xs }]}
        accessibilityRole="button"
        accessibilityLabel="Menu">
        <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <GlassSurface variant="raised" style={[styles.menu, { top: insets.top + spacing.xxl }]}>
            {items.map((item, index) => (
              <Pressable
                key={item.label}
                onPress={() => {
                  haptics.tick();
                  setOpen(false);
                  item.onPress();
                }}
                style={[styles.item, index < items.length - 1 && styles.itemDivider]}>
                <Text style={styles.itemText}>{item.label}</Text>
              </Pressable>
            ))}
          </GlassSurface>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1 },
  menu: {
    position: 'absolute',
    right: spacing.lg,
    minWidth: 180,
    paddingVertical: spacing.xs,
  },
  item: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  itemDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemText: { color: colors.text, fontSize: font.body, fontWeight: '600' },
});
