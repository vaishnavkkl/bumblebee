import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, shadows, spacing, typography, animation } from '../../constants/theme';

type DialogAction = {
  label: string;
  onPress?: () => void;
  tone?: 'primary' | 'danger' | 'cancel';
};

type DialogConfig = {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  message?: string;
  actions?: DialogAction[];
};

type DialogState = DialogConfig & { visible: boolean };

const INITIAL: DialogState = { visible: false, title: '' };

export function useDialog() {
  const [state, setState] = useState<DialogState>(INITIAL);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const show = useCallback(
    (config: DialogConfig) => {
      setState({ ...config, visible: true });
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: animation.spring.damping,
          stiffness: animation.spring.stiffness,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: animation.timing.fast,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [opacityAnim, scaleAnim],
  );

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: animation.timing.fast,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: animation.timing.fast,
        useNativeDriver: true,
      }),
    ]).start(() => setState(INITIAL));
  }, [opacityAnim, scaleAnim]);

  const showDialog = useCallback(
    (config: DialogConfig) => show(config),
    [show],
  );

  const Portal = memo(function DialogPortal() {
    if (!state.visible) return null;
    return (
      <Modal transparent animationType="none" visible onRequestClose={hide}>
        <Pressable style={styles.backdrop} onPress={hide}>
          <Animated.View
            style={{ opacity: opacityAnim, flex: 1, justifyContent: 'center', alignItems: 'center' }}
          >
            <Pressable
              style={[styles.dialog]}
              onPress={(e) => e.stopPropagation()}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                {!!state.icon && (
                  <View style={[styles.iconWrap, { backgroundColor: `${state.iconColor || colors.accent}18` }]}>
                    <Ionicons
                      name={state.icon}
                      size={28}
                      color={state.iconColor || colors.accent}
                    />
                  </View>
                )}
                <Text style={styles.title}>{state.title}</Text>
                {!!state.message && (
                  <Text style={styles.message}>{state.message}</Text>
                )}
                <View style={styles.actions}>
                  {(state.actions || [{ label: 'OK', tone: 'primary' }]).map(
                    (action, index) => (
                      <DialogButton
                        key={`${action.label}-${index}`}
                        action={action}
                        onDismiss={hide}
                        isLast={index === (state.actions || []).length - 1}
                      />
                    ),
                  )}
                </View>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  });

  return { showDialog, DialogPortal: Portal };
}

type DialogButtonProps = {
  action: DialogAction;
  onDismiss: () => void;
  isLast: boolean;
};

const DialogButton = memo(function DialogButton({
  action,
  onDismiss,
  isLast,
}: DialogButtonProps) {
  const handlePress = useCallback(() => {
    onDismiss();
    action.onPress?.();
  }, [action, onDismiss]);

  const isCancel = action.tone === 'cancel';
  const isDanger = action.tone === 'danger';

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        isCancel && styles.cancelButton,
        isDanger && styles.dangerButton,
        !isCancel && !isDanger && styles.primaryButton,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={action.label}
    >
      <Text
        style={[
          styles.buttonText,
          isCancel && styles.cancelText,
          isDanger && styles.dangerText,
          !isCancel && !isDanger && styles.primaryText,
        ]}
      >
        {action.label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.glassOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFFEE',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    padding: spacing.xl,
    ...shadows.glass,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    lineHeight: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  button: {
    minHeight: 46,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  primaryButton: {
    backgroundColor: colors.accent,
    overflow: 'hidden',
    ...shadows.accent,
  },
  cancelButton: {
    backgroundColor: colors.surfacePressed,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  dangerButton: {
    backgroundColor: colors.danger,
  },
  buttonText: {
    fontSize: typography.bodyLarge,
    fontWeight: '800',
  },
  primaryText: {
    color: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  cancelText: {
    color: colors.textMuted,
    backgroundColor: 'transparent',
  },
  dangerText: {
    color: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: animation.press.opacity,
    transform: [{ scale: animation.press.scale }],
  },
});
