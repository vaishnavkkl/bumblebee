import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, LIST_CONFIG, radii, shadows, spacing, TEXT_LIST_CONFIG, typography, animation, toneMap } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ScreenBackground = memo(function ScreenBackground({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={['#F8FAFC', '#E2E8F0']} style={styles.bgContainer}>
      {children}
    </LinearGradient>
  );
});

export type SegmentOption<T extends string> = {
  id: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const keyExtractor = useCallback((item: SegmentOption<T>) => item.id, []);
  const renderItem: ListRenderItem<SegmentOption<T>> = useCallback(
    ({ item }) => (
      <SegmentItem
        item={item}
        selected={item.id === value}
        onPress={onChange as (value: string) => void}
        accessibilityLabel={accessibilityLabel}
      />
    ),
    [accessibilityLabel, onChange, value],
  );

  return (
    <View style={styles.segmentWrap}>
      <FlatList
        horizontal
        data={options}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.segmentContent}
        showsHorizontalScrollIndicator={false}
        {...TEXT_LIST_CONFIG}
      />
    </View>
  );
}

type SegmentItemProps = {
  item: SegmentOption<string>;
  selected: boolean;
  onPress: (value: string) => void;
  accessibilityLabel: string;
};

const SegmentItem = memo(function SegmentItem({
  item,
  selected,
  onPress,
  accessibilityLabel,
}: SegmentItemProps) {
  const handlePress = useCallback(() => onPress(item.id), [item.id, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.segmentItem,
        selected && styles.segmentItemActive,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}: ${item.label}`}
    >
      {!!item.icon && (
        <Ionicons
          name={item.icon}
          size={14}
          color={selected ? colors.accent : colors.textMuted}
          style={styles.segmentIcon}
        />
      )}
      <Text style={[styles.segmentText, selected && styles.segmentTextActive]} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
});

export type StatItem = {
  id: string;
  label: string;
  value: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'accent' | 'success' | 'danger' | 'info' | 'warning' | 'violet';
};

type StatGridProps = {
  data: StatItem[];
  columns: number;
};

export function StatGrid({ data, columns }: StatGridProps) {
  const keyExtractor = useCallback((item: StatItem) => item.id, []);
  const renderItem: ListRenderItem<StatItem> = useCallback(
    ({ item }) => <StatCard item={item} columns={columns} />,
    [columns],
  );
  const columnWrapperStyle = useMemo(
    () => (columns > 1 ? styles.gridColumnWrapper : undefined),
    [columns],
  );

  return (
    <FlatList
      key={`stats-${columns}`}
      data={data}
      numColumns={columns}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      scrollEnabled={false}
      columnWrapperStyle={columnWrapperStyle}
      contentContainerStyle={styles.gridContent}
      showsVerticalScrollIndicator={false}
      {...TEXT_LIST_CONFIG}
    />
  );
}

type StatCardProps = {
  item: StatItem;
  columns: number;
};

const StatCard = memo(function StatCard({ item, columns }: StatCardProps) {
  const tone = toneMap[item.tone || 'accent'];
  const widthStyle = useMemo<ViewStyle>(
    () => ({ flex: columns > 1 ? 1 : undefined }),
    [columns],
  );

  return (
    <View style={[styles.statCard, widthStyle]}>
      <View style={styles.statContent}>
        <View style={styles.statTop}>
          <View style={[styles.statIconBadge, { backgroundColor: tone.bg }]}>
            <Ionicons name={item.icon} size={15} color={tone.fg} />
          </View>
          <Text style={styles.statLabel} numberOfLines={1}>
            {item.label}
          </Text>
        </View>
        <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
          {item.value}
        </Text>
        {!!item.sub && (
          <Text style={styles.statSub} numberOfLines={1}>
            {item.sub}
          </Text>
        )}
      </View>
    </View>
  );
});

type StateBlockProps = {
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
};

export const StateBlock = memo(function StateBlock({
  title,
  message,
  icon = 'file-tray-outline',
  loading = false,
}: StateBlockProps) {
  return (
    <View style={styles.stateBlock}>
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Ionicons name={icon} size={32} color={colors.textSubtle} />
      )}
      <Text style={styles.stateTitle}>{title}</Text>
      {!!message && <Text style={styles.stateMessage}>{message}</Text>}
    </View>
  );
});

type SectionTitleProps = {
  title: string;
  subtitle?: string;
};

export const SectionTitle = memo(function SectionTitle({ title, subtitle }: SectionTitleProps) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
});

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export const ScreenHeader = memo(function ScreenHeader({
  title,
  subtitle,
  right,
}: ScreenHeaderProps) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderCopy}>
        <Text style={styles.screenTitle} numberOfLines={1} adjustsFontSizeToFit>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.screenSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
});

type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger' | 'accent';
  disabled?: boolean;
  size?: number;
};

export const IconButton = memo(function IconButton({
  icon,
  label,
  onPress,
  tone = 'default',
  disabled = false,
  size = 38,
}: IconButtonProps) {
  const color = tone === 'danger' ? colors.danger : tone === 'accent' ? colors.accent : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        tone === 'danger' && styles.iconButtonDanger,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={size > 36 ? 18 : 16} color={color} />
    </Pressable>
  );
});

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
};

export const PrimaryButton = memo(function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  danger = false,
}: PrimaryButtonProps) {
  const activeDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={activeDisabled}
      style={({ pressed }) => [
        styles.primaryButtonStyle,
        danger && styles.dangerButton,
        activeDisabled && styles.disabled,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={danger ? colors.text : '#FFFFFF'} />
      ) : (
        <>
          {!!icon && (
            <Ionicons
              name={icon}
              size={16}
              color={danger ? colors.text : '#FFFFFF'}
              style={styles.buttonIcon}
            />
          )}
          <Text style={[styles.primaryButtonText, danger && styles.dangerButtonText]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
});

export function getGridListProps(columns: number) {
  return {
    key: `grid-${columns}`,
    numColumns: columns,
    columnWrapperStyle: columns > 1 ? styles.gridColumnWrapper : undefined,
  };
}

const styles = StyleSheet.create({
  // Background gradient
  bgContainer: {
    flex: 1,
  },

  // Segmented control
  segmentWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFrost,
    borderRadius: radii.card,
    paddingVertical: 3,
  },
  segmentContent: {
    paddingHorizontal: 3,
    gap: 4,
  },
  segmentItem: {
    minHeight: 36,
    minWidth: 90,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  segmentItemActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    ...shadows.subtle,
  },
  segmentIcon: {
    marginRight: 5,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.accent,
  },

  // Press state
  pressed: {
    opacity: animation.press.opacity,
    transform: [{ scale: animation.press.scale }],
  },

  // Grids
  gridContent: {
    gap: spacing.sm,
  },
  gridColumnWrapper: {
    gap: spacing.sm,
  },

  // Stat card — compact with clean icon badge
  statCard: {
    minHeight: 74,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadows.glass,
  },
  statContent: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  statValue: {
    color: colors.text,
    fontSize: typography.statValue,
    lineHeight: 28,
    fontWeight: '800',
  },
  statSub: {
    color: colors.textSubtle,
    fontSize: typography.caption,
    marginTop: 2,
  },

  // State block
  stateBlock: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    marginTop: spacing.md,
    ...shadows.glass,
  },
  stateTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  stateMessage: {
    color: colors.textSubtle,
    fontSize: typography.body,
    lineHeight: 18,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // Section title
  sectionTitleWrap: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    lineHeight: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.textSubtle,
    fontSize: typography.caption,
    lineHeight: 16,
    marginTop: 2,
  },

  // Screen header
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  screenHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  screenTitle: {
    color: colors.text,
    fontSize: typography.screenTitle,
    lineHeight: 26,
    fontWeight: '800',
  },
  screenSubtitle: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 16,
    marginTop: 2,
  },

  // Icon button — circular
  iconButton: {
    borderRadius: 19,
    backgroundColor: colors.surfaceGlassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  iconButtonDanger: {
    backgroundColor: colors.dangerSoft,
  },
  disabled: {
    opacity: 0.5,
  },

  // Primary button
  primaryButtonStyle: {
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentBorder,
    ...shadows.accent,
  },
  dangerButton: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    lineHeight: 18,
    fontWeight: '800',
    backgroundColor: 'transparent',
  },
  dangerButtonText: {
    color: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  buttonIcon: {
    marginRight: 6,
  },
});

export { LIST_CONFIG, TEXT_LIST_CONFIG };
