import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/GlassSurface';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, font, spacing } from '@/theme/tokens';

export interface EmptyStateProps {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** A centered, quiet card for a screen with nothing (yet) to show. */
export function EmptyState({ title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <GlassSurface style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {actionLabel && onAction ? (
          <View style={styles.action}>
            <PrimaryButton label={actionLabel} onPress={onAction} />
          </View>
        ) : null}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: font.heading,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: colors.textSecondary,
    fontSize: font.body,
    textAlign: 'center',
    lineHeight: 21,
  },
  action: { marginTop: spacing.md, alignSelf: 'stretch' },
});
