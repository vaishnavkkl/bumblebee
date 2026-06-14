import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radii, shadows, spacing, animation } from '../constants/theme';
import { useDeviceLayout } from '../hooks/use-device-layout';
import { ScreenBackground } from '../components/app/flat-primitives';

const REMEMBER_KEY = 'bb-remember-login';

type LoginRow = {
  id: 'form';
};

const ROWS: LoginRow[] = [{ id: 'form' }];

export default function LoginScreen() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const layout = useDeviceLayout();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AsyncStorage.getItem(REMEMBER_KEY)
      .then((saved) => {
        if (saved) setIdentifier(saved);
      })
      .catch(() => undefined);
  }, []);

  const handleLogin = useCallback(async () => {
    if (!identifier || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
      const rememberAction = remember
        ? AsyncStorage.setItem(REMEMBER_KEY, identifier)
        : AsyncStorage.removeItem(REMEMBER_KEY);
      rememberAction.catch(() => undefined);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Login failed. Check server connection.');
    } finally {
      setLoading(false);
    }
  }, [identifier, login, password, remember]);

  const toggleRemember = useCallback(() => {
    setRemember((value) => !value);
  }, []);

  const contentStyle = useMemo(
    () => [
      styles.listContent,
      {
        paddingTop: Math.max(insets.top, 16) + spacing.lg,
        paddingBottom: Math.max(insets.bottom, 16) + spacing.xl,
        paddingHorizontal: layout.horizontalPadding,
      },
    ],
    [insets.bottom, insets.top, layout.horizontalPadding],
  );

  const cardWidth = useMemo(() => {
    const availableWidth = Math.max(280, layout.width - layout.horizontalPadding * 2);
    return Math.min(availableWidth, layout.isTablet ? 480 : 560);
  }, [layout.horizontalPadding, layout.isTablet, layout.width]);

  const renderItem = useCallback(
    () => (
      <View style={[styles.itemShell, { width: cardWidth }]}>
        <View style={styles.loginCard}>
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="sparkles" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>BUMBLEBEE</Text>
            <Text style={styles.subtitle}>Car wash operations</Text>
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone or username</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter phone or username"
                placeholderTextColor={colors.textSubtle}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Phone or username"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor={colors.textSubtle}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Password"
              />
            </View>

            <Pressable
              onPress={toggleRemember}
              style={({ pressed }) => [styles.rememberRow, pressed && styles.pressed]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              accessibilityLabel="Remember phone or username"
            >
              <Ionicons
                name={remember ? 'checkbox' : 'square-outline'}
                size={22}
                color={remember ? colors.accent : colors.textSubtle}
              />
              <Text style={styles.rememberText}>Remember this login</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.button, loading && styles.buttonDisabled, pressed && styles.pressed]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Sign In</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    ),
    [cardWidth, error, handleLogin, identifier, loading, password, remember, toggleRemember]
  );

  const keyExtractor = useCallback((item: LoginRow) => item.id, []);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <FlatList
            style={styles.list}
            data={ROWS}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={contentStyle}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardView: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    alignSelf: 'stretch',
  },
  itemShell: {
    alignItems: 'center',
  },
  loginCard: {
    width: '100%',
    backgroundColor: colors.surfaceGlass,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    ...shadows.glass,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoBadge: {
    width: 62,
    height: 62,
    borderRadius: radii.card,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.accent,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.sm,
    color: colors.text,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  rememberRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: -4,
    marginBottom: spacing.md,
  },
  rememberText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  button: {
    minHeight: 50,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentBorder,
    overflow: 'hidden',
    ...shadows.accent,
  },
  buttonDisabled: {
    backgroundColor: '#3B82F680',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    backgroundColor: 'transparent',
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: colors.dangerSoft,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#EF444430',
  },
  pressed: {
    opacity: animation.press.opacity,
    transform: [{ scale: animation.press.scale }],
  },
});
