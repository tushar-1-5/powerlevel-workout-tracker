import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBlurTarget } from '@/components/BlurTarget';
import { GlassSheen } from '@/components/GlassSurface';
import { PrimaryButton } from '@/components/PrimaryButton';
import * as haptics from '@/lib/haptics';
import { colors, font, glass, radius, spacing } from '@/theme/tokens';

export interface RemarkSheetProps {
  visible: boolean;
  exerciseName: string;
  /** The remark as currently stored — `exercises.notes`. */
  remark: string | null;
  onClose: () => void;
  /** Receives `null` for an empty/whitespace remark, never `''` — see `normalise`. */
  onSave: (remark: string | null) => Promise<void> | void;
}

/**
 * An empty remark is stored as NULL, not ''. Two representations of "no
 * remark" would mean every reader has to check for both; this way `notes ?
 * ... : null` is the only check anyone ever needs.
 */
function normalise(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The editor for an exercise's sticky remark — "seat notch 4", "use the blue
 * bench". Opened from the logging screen's overflow menu and from the remark
 * strip under the exercise name.
 *
 * Built on the same bones as `ReorderSheetBody` in `workout/log.tsx`: a
 * transparent slide-up `Modal`, top-only rounded panel, its own `BlurView` +
 * `GlassSheen` (a Modal portals into a separate native window, so it can't
 * borrow the screen's). The one addition is `KeyboardAvoidingView`: on this
 * SDK Android runs edge-to-edge and the window no longer resizes for the
 * keyboard, so without it the text field would sit underneath the keyboard.
 *
 * Keeps its own draft; nothing is written until Save. Cancel, the backdrop and
 * the Android back button all discard.
 */
export function RemarkSheet({ visible, exerciseName, remark, onClose, onSave }: RemarkSheetProps) {
  const insets = useSafeAreaInsets();
  const blurTarget = useBlurTarget();
  const [draft, setDraft] = useState(remark ?? '');
  const [saving, setSaving] = useState(false);

  // Re-seed the draft every time the sheet opens, so a cancelled edit never
  // leaks into the next opening, and switching exercises shows the right text.
  useEffect(() => {
    if (visible) setDraft(remark ?? '');
  }, [visible, remark]);

  const unchanged = normalise(draft) === (remark ?? null);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    haptics.confirm();
    try {
      await onSave(normalise(draft));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <BlurView
            blurTarget={blurTarget ?? undefined}
            intensity={36}
            tint="dark"
            blurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <GlassSheen />

          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.eyebrow}>Remarks</Text>
              <Text style={styles.title} numberOfLines={1}>
                {exerciseName}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>

          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Seat height, grip, which machine, a cue that works…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            autoFocus
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.hint}>
            Shows every time you train this exercise, and in history. Stays until you change it.
          </Text>

          <View style={styles.actions}>
            {remark ? (
              <Pressable
                onPress={() => setDraft('')}
                hitSlop={8}
                style={styles.clear}
                accessibilityRole="button">
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            ) : null}
            <View style={styles.flex}>
              <PrimaryButton label="Save" onPress={save} loading={saving} disabled={unchanged} compact />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  // Same top-only rounding + overflow clip as log.tsx's `reorderSheet`.
  sheet: {
    backgroundColor: glass.panelRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: glass.borderStrong,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  headText: { flex: 1 },
  eyebrow: {
    color: colors.textMuted,
    fontSize: font.micro,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: font.heading, fontWeight: '800', marginTop: 2 },
  cancel: { color: colors.textSecondary, fontSize: font.body, fontWeight: '600' },
  input: {
    minHeight: 110,
    maxHeight: 200,
    borderRadius: radius.md,
    backgroundColor: glass.panel,
    borderWidth: 1,
    borderColor: glass.border,
    color: colors.text,
    fontSize: font.body,
    padding: spacing.md,
  },
  hint: { color: colors.textMuted, fontSize: font.caption, marginTop: spacing.sm },
  // Row container, so `gap` renders (see ExercisePageV2's note on column gap).
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.lg },
  clear: { paddingHorizontal: spacing.sm },
  clearText: { color: colors.danger, fontSize: font.body, fontWeight: '700' },
});
