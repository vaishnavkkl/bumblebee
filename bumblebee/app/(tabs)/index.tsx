import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
import {
  IconButton,
  LIST_CONFIG,
  ScreenBackground,
  SectionTitle,
  StateBlock,
  StatGrid,
  StatItem,
} from '../../components/app/flat-primitives';
import { colors, radii, shadows, spacing, TEXT_LIST_CONFIG, typography, animation } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../components/app/custom-dialog';
import { useDeviceLayout } from '../../hooks/use-device-layout';
import api from '../../utils/api';
import { formatMoney, formatTime } from '../../utils/format';

type AdminDashboard = {
  todayIncome: number;
  todayExpenses: number;
  todayBills: number;
  totalInHand: number;
  totalAccount: number;
  pendingWash: number;
  totalEmployees: number;
  weeklyIncome: { date: string; total: string }[];
  weeklyExpenses: { date: string; total: string }[];
  vehicleStats: { label: string; count: number }[];
  monthlyIncome: number;
  monthlyExpenses: number;
};

type EmployeeDashboard = {
  todayBills: number;
  pendingWash: number;
  attendance?: {
    clock_in?: string;
    clock_out?: string | null;
  } | null;
};

type DashboardData = AdminDashboard | EmployeeDashboard;

type Section = {
  id: 'custom_grid' | 'trend_card' | 'actions' | 'chart' | 'vehicles' | 'monthly';
};

type ActionItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: '/billing' | '/queue' | '/finance' | '/employees';
  color: string;
};

type ChartItem = {
  id: string;
  label: string;
  income: number;
  expenses: number;
};

type VehicleStat = {
  id: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
};

const SECTIONS: Section[] = [
  { id: 'custom_grid' },
  { id: 'trend_card' },
  { id: 'actions' },
  { id: 'chart' },
  { id: 'vehicles' },
  { id: 'monthly' },
];

const ACTIONS: ActionItem[] = [
  { id: 'billing', label: 'New Bill', icon: 'receipt-outline', route: '/billing', color: colors.accent },
  { id: 'queue', label: 'Wash Queue', icon: 'car-outline', route: '/queue', color: colors.info },
  { id: 'finance', label: 'Finance', icon: 'wallet-outline', route: '/finance', color: colors.success },
  { id: 'employees', label: 'Team', icon: 'people-outline', route: '/employees', color: colors.violet },
  { id: 'customers', label: 'Customers', icon: 'people-circle-outline', route: '/employees', color: colors.warning },
  { id: 'inventory', label: 'Inventory', icon: 'cube-outline', route: '/queue', color: colors.accent },
  { id: 'services', label: 'Services', icon: 'list-outline', route: '/billing', color: colors.info },
  { id: 'reports', label: 'Reports', icon: 'bar-chart-outline', route: '/finance', color: colors.success },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', route: '/employees', color: colors.textMuted },
];

const CHART_HEIGHT = 100;

export default function DashboardScreen() {
  const { user, isAdmin, logout } = useAuth();
  const router = useRouter();
  const layout = useDeviceLayout();
  const { showDialog, DialogPortal } = useDialog();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get(isAdmin ? '/dashboard/summary' : '/dashboard/employee-summary');
      setData(res.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Dashboard could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  const handleLogout = useCallback(() => {
    showDialog({
      icon: 'log-out-outline',
      iconColor: colors.danger,
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      actions: [
        { label: 'Cancel', tone: 'cancel' },
        { label: 'Sign Out', tone: 'danger', onPress: logout },
      ],
    });
  }, [logout, showDialog]);

  const contentStyle = useMemo(
    () => [
      styles.content,
      {
        paddingHorizontal: layout.horizontalPadding,
        paddingTop: layout.contentTopPadding,
        paddingBottom: layout.contentBottomPadding,
        maxWidth: layout.maxContentWidth,
        alignSelf: layout.isTablet ? ('center' as const) : ('stretch' as const),
      },
    ],
    [layout.contentBottomPadding, layout.contentTopPadding, layout.horizontalPadding, layout.isTablet, layout.maxContentWidth],
  );

  const adminData = data as AdminDashboard;
  const employeeData = data as EmployeeDashboard;

  const weeklyChart = useMemo<ChartItem[]>(() => {
    if (!data || !isAdmin) return [];
    const incomeByDate = new Map(adminData.weeklyIncome?.map((item) => [item.date, Number(item.total)]) || []);
    const expenseByDate = new Map(adminData.weeklyExpenses?.map((item) => [item.date, Number(item.total)]) || []);
    const dates = Array.from(new Set([...incomeByDate.keys(), ...expenseByDate.keys()])).sort();

    return dates.map((date) => ({
      id: date,
      label: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      income: incomeByDate.get(date) || 0,
      expenses: expenseByDate.get(date) || 0,
    }));
  }, [data, isAdmin, adminData]);

  const maxChartValue = useMemo(() => {
    const values = weeklyChart.flatMap((item) => [item.income, item.expenses]);
    return Math.max(1000, ...values);
  }, [weeklyChart]);

  const vehicleStats = useMemo<VehicleStat[]>(() => {
    if (!data || !isAdmin) return [];
    const stats = adminData.vehicleStats || [];
    const total = stats.reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
    const palette = [colors.accent, colors.info, colors.success, colors.violet, colors.warning];
    return stats.map((item, index) => ({
      id: `${item.label}-${index}`,
      label: item.label,
      count: Number(item.count || 0),
      percentage: (Number(item.count || 0) / total) * 100,
      color: palette[index % palette.length],
    }));
  }, [data, isAdmin, adminData]);

  const monthlyStats = useMemo<StatItem[]>(() => {
    if (!data || !isAdmin) return [];
    const profit = Number(adminData.monthlyIncome || 0) - Number(adminData.monthlyExpenses || 0);
    return [
      {
        id: 'monthly-income',
        label: 'Monthly Income',
        value: formatMoney(adminData.monthlyIncome),
        icon: 'trending-up-outline',
        tone: 'success',
      },
      {
        id: 'monthly-expenses',
        label: 'Monthly Expenses',
        value: formatMoney(adminData.monthlyExpenses),
        icon: 'trending-down-outline',
        tone: 'danger',
      },
      {
        id: 'monthly-profit',
        label: 'Monthly Profit',
        value: formatMoney(profit),
        icon: 'analytics-outline',
        tone: profit >= 0 ? 'accent' : 'danger',
      },
    ];
  }, [data, isAdmin, adminData]);

  const keyExtractor = useCallback((item: Section) => item.id, []);

  const renderSection: ListRenderItem<Section> = useCallback(
    ({ item }) => {
      if (!data) return null;

      switch (item.id) {
        case 'custom_grid':
          return (
            <View style={styles.gridRow}>
              {/* Card 1: Income / Bills Status */}
              <Pressable
                onPress={() => router.push(isAdmin ? '/finance' : '/billing')}
                style={({ pressed }) => [styles.gridCard, pressed && styles.pressed]}
              >
                <Text style={styles.cardHeaderTitle}>{isAdmin ? "Wash Revenue" : "My Bills Today"}</Text>
                <Text style={styles.cardHeaderSub} numberOfLines={1}>
                  {isAdmin ? `Total: ${formatMoney(adminData.todayIncome)}` : `${employeeData.todayBills || 0} bills logged`}
                </Text>
                <View style={styles.cardIconContainer}>
                  <View style={[styles.sensorDevice, { borderColor: '#10B981', padding: 4 }]}>
                    <Ionicons name="cash-outline" size={24} color="#10B981" />
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterText}>Show Details</Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.textSubtle} />
                </View>
              </Pressable>

              {/* Card 2: Operations / Queue Monitoring */}
              <Pressable
                onPress={() => router.push('/queue')}
                style={({ pressed }) => [styles.gridCard, pressed && styles.pressed]}
              >
                <Text style={styles.cardHeaderTitle}>Wash Queue</Text>
                <Text style={styles.cardHeaderSub} numberOfLines={1}>
                  {isAdmin ? `${adminData.pendingWash || 0} vehicles pending` : `${employeeData.pendingWash || 0} washing now`}
                </Text>
                <View style={styles.cardIconContainer}>
                  <View style={[styles.sensorDevice, { borderColor: colors.accent, padding: 4 }]}>
                    <Ionicons name="car-sport-outline" size={24} color={colors.accent} />
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterText}>Show Details</Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.textSubtle} />
                </View>
              </Pressable>
            </View>
          );
        case 'trend_card':
          return (
            <Pressable
              onPress={() => router.push(isAdmin ? '/finance' : '/queue')}
              style={({ pressed }) => [styles.trendCard, pressed && styles.pressed]}
            >
              <View style={styles.trendCardHeader}>
                <Text style={styles.trendTitle}>Weekly Revenue Trend</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textSubtle} />
              </View>
              <View style={styles.trendRow}>
                <View style={styles.trendLeft}>
                  <Text style={styles.trendValue}>
                    {isAdmin ? formatMoney(adminData.todayIncome).replace(/[^\d,]/g, '') : String(employeeData.todayBills || 0)}
                    <Text style={styles.trendValueLabel}> {isAdmin ? 'INR' : 'Bills'}</Text>
                  </Text>
                  <Text style={styles.trendSub}>Revenue on track</Text>
                </View>
                <View style={styles.trendGraphContainer}>
                  <Sparkline />
                </View>
              </View>
            </Pressable>
          );
        case 'actions':
          return (
            <View>
              <SectionTitle title="Quick Actions" />
              <ActionGrid
                data={isAdmin ? ACTIONS : ACTIONS.slice(0, 3)}
                onPressRoute={router.push}
              />
            </View>
          );
        case 'chart':
          if (!isAdmin) return null;
          return (
            <View>
              <SectionTitle title="Weekly Performance" subtitle="Income vs expenses" />
              <WeeklyChart data={weeklyChart} maxValue={maxChartValue} />
            </View>
          );
        case 'vehicles':
          if (!isAdmin) return null;
          return (
            <View>
              <SectionTitle title="Vehicle Mix" subtitle="Today's distribution" />
              <VehicleDistribution data={vehicleStats} />
            </View>
          );
        case 'monthly':
          if (!isAdmin) return null;
          return (
            <View>
              <SectionTitle title="This Month" />
              <StatGrid data={monthlyStats} columns={layout.isTablet ? layout.columns : 1} />
            </View>
          );
        default:
          return null;
      }
    },
    [data, isAdmin, adminData, employeeData, layout.columns, layout.isTablet, maxChartValue, monthlyStats, router, weeklyChart, vehicleStats]
  );

  const ListHeaderComponent = useMemo(
    () => (
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>Home</Text>
            <Ionicons name="chevron-down" size={14} color={colors.text} style={styles.chevronIcon} />
          </View>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={11} color={colors.textSubtle} style={{ marginRight: 2 }} />
            <Text style={styles.headerSubtitle}>1234 Oak Street</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.scoreBadge}>
            <Ionicons name="happy" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
            <Text style={styles.scoreText}>92/100</Text>
          </View>
          <IconButton icon="log-out-outline" label="Sign out" tone="danger" onPress={handleLogout} size={34} />
        </View>
      </View>
    ),
    [handleLogout]
  );

  const EmptyComponent = useMemo(() => {
    if (loading) return <StateBlock loading title="Loading dashboard" message="Fetching live data…" />;
    if (error) return <StateBlock title="Dashboard unavailable" message={error} icon="warning-outline" />;
    return <StateBlock title="No data" message="Pull to refresh." />;
  }, [error, loading]);

  if (loading && !data) {
    return (
      <ScreenBackground>
        <View style={styles.safeArea}>
          <View style={styles.loader}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loaderText}>Loading dashboard</Text>
          </View>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <View style={styles.safeArea}>
        <FlatList
          data={data && !error ? SECTIONS : []}
          keyExtractor={keyExtractor}
          renderItem={renderSection}
          ListHeaderComponent={ListHeaderComponent}
          ListEmptyComponent={EmptyComponent}
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
          {...LIST_CONFIG}
        />
        <DialogPortal />
      </View>
    </ScreenBackground>
  );
}

// --- Smooth Custom Sparkline ---
const Sparkline = memo(function Sparkline() {
  // Sparkline coordinates simulating the curved line from the user reference screenshot.
  const points = [
    { x: 5, y: 38 },
    { x: 15, y: 37 },
    { x: 25, y: 35 },
    { x: 35, y: 30 },
    { x: 45, y: 22 },
    { x: 55, y: 15 },
    { x: 65, y: 14 },
    { x: 75, y: 18 },
    { x: 85, y: 26 },
    { x: 95, y: 25 },
    { x: 105, y: 21 },
    { x: 115, y: 14 },
    { x: 125, y: 17 },
    { x: 135, y: 22 },
  ];

  return (
    <View style={styles.sparklineContainer}>
      {points.map((pt, i) => {
        if (i === 0) return null;
        const prev = points[i - 1];
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: prev.x + dx / 2 - dist / 2,
              top: prev.y + dy / 2 - 1,
              width: dist,
              height: 2.2,
              backgroundColor: colors.accent,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
      {/* Wave termination circle */}
      <View
        style={[
          styles.sparklineDot,
          {
            left: points[points.length - 1].x - 3,
            top: points[points.length - 1].y - 2,
          },
        ]}
      />
    </View>
  );
});

// --- Quick Action Grid (3x3) ---
type ActionGridProps = {
  data: ActionItem[];
  onPressRoute: (route: ActionItem['route']) => void;
};

const ActionGrid = memo(function ActionGrid({ data, onPressRoute }: ActionGridProps) {
  return (
    <View style={styles.actionGrid}>
      {data.map((item) => (
        <ActionChip key={item.id} item={item} onPressRoute={onPressRoute} />
      ))}
    </View>
  );
});

type ActionChipProps = {
  item: ActionItem;
  onPressRoute: (route: ActionItem['route']) => void;
};

const ActionChip = memo(function ActionChip({ item, onPressRoute }: ActionChipProps) {
  const handlePress = useCallback(() => onPressRoute(item.route), [item.route, onPressRoute]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.actionChip, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <View style={[styles.actionChipIcon, { backgroundColor: `${item.color}14` }]}>
        <Ionicons name={item.icon} size={20} color={item.color} />
      </View>
      <Text style={styles.actionChipLabel} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
});

// --- Weekly Chart ---
type WeeklyChartProps = {
  data: ChartItem[];
  maxValue: number;
};

const WeeklyChart = memo(function WeeklyChart({ data, maxValue }: WeeklyChartProps) {
  if (data.length === 0) {
    return <StateBlock title="No weekly data" message="Data will appear here." icon="bar-chart-outline" />;
  }

  return (
    <View style={styles.chartCard}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartContent}
      >
        {data.map((item) => (
          <ChartBar key={item.id} item={item} maxValue={maxValue} />
        ))}
      </ScrollView>
      <View style={styles.legend}>
        <LegendDot label="Income" color={colors.success} />
        <LegendDot label="Expenses" color={colors.danger} />
      </View>
    </View>
  );
});

type ChartBarProps = {
  item: ChartItem;
  maxValue: number;
};

const ChartBar = memo(function ChartBar({ item, maxValue }: ChartBarProps) {
  const incomeHeight = Math.max(4, (item.income / maxValue) * CHART_HEIGHT);
  const expenseHeight = Math.max(4, (item.expenses / maxValue) * CHART_HEIGHT);

  return (
    <View style={styles.chartColumn}>
      <View style={styles.barGroup}>
        <View style={[styles.bar, styles.incomeBar, { height: incomeHeight }]} />
        <View style={[styles.bar, styles.expenseBar, { height: expenseHeight }]} />
      </View>
      <Text style={styles.chartLabel} numberOfLines={1}>
        {item.label}
      </Text>
    </View>
  );
});

type LegendDotProps = {
  label: string;
  color: string;
};

const LegendDot = memo(function LegendDot({ label, color }: LegendDotProps) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
});

// --- Vehicle Distribution ---
type VehicleDistributionProps = {
  data: VehicleStat[];
};

const VehicleDistribution = memo(function VehicleDistribution({ data }: VehicleDistributionProps) {
  if (data.length === 0) {
    return <StateBlock title="No vehicles washed today" icon="car-outline" />;
  }

  return (
    <View style={styles.vehicleCard}>
      {data.map((item) => (
        <View key={item.id} style={styles.vehicleRow}>
          <View style={styles.vehicleRowTop}>
            <Text style={styles.vehicleLabel}>{item.label}</Text>
            <Text style={styles.vehicleValue}>
              {item.count} · {Math.round(item.percentage)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${item.percentage}%`, backgroundColor: item.color }]} />
          </View>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
    width: '100%',
    paddingTop: spacing.lg,
    paddingBottom: 90,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    color: colors.textMuted,
    fontSize: typography.body,
    marginTop: spacing.md,
    fontWeight: '700',
  },

  // Header styles modeled after the reference image
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  headerLeft: {},
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  chevronIcon: {
    marginTop: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    ...shadows.glow(colors.accent),
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  // 2-Column Grid modeled after screenshot No Leak & Monitoring
  gridRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridCard: {
    flex: 1,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: radii.card,
    padding: spacing.lg,
    ...shadows.glass,
  },
  cardHeaderTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardHeaderSub: {
    color: colors.textSubtle,
    fontSize: 11,
    marginTop: 2,
  },
  cardIconContainer: {
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  sensorDevice: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cardFooterText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  // Trend card (Water consumption mockup)
  trendCard: {
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.glass,
  },
  trendCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  trendLeft: {},
  trendValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  trendValueLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSubtle,
  },
  trendSub: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  trendGraphContainer: {
    width: 140,
    height: 50,
    position: 'relative',
    justifyContent: 'center',
  },
  sparklineContainer: {
    width: 140,
    height: 50,
    position: 'relative',
  },
  sparklineDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    ...shadows.glow(colors.accent),
  },

  // Action grid — 3x3 layout
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionChip: {
    width: '31%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    marginBottom: spacing.xs,
    ...shadows.glass,
  },
  actionChipIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actionChipLabel: {
    color: colors.text,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    textAlign: 'center',
  },

  // Chart
  chartCard: {
    borderRadius: radii.card,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    padding: spacing.md,
    ...shadows.glass,
  },
  chartContent: {
    minHeight: CHART_HEIGHT + 24,
    paddingHorizontal: spacing.xs,
    alignItems: 'flex-end',
    gap: spacing.lg,
  },
  chartColumn: {
    width: 42,
    alignItems: 'center',
  },
  barGroup: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    width: 9,
    borderRadius: 5,
  },
  incomeBar: {
    backgroundColor: colors.success,
  },
  expenseBar: {
    backgroundColor: colors.danger,
  },
  chartLabel: {
    color: colors.textSubtle,
    fontSize: 9,
    marginTop: spacing.xs,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorder,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: typography.eyebrow,
    fontWeight: '700',
  },

  // Vehicle distribution
  vehicleCard: {
    borderRadius: radii.card,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.glass,
  },
  vehicleRow: {},
  vehicleRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  vehicleLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  vehicleValue: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },

  pressed: {
    opacity: animation.press.opacity,
    transform: [{ scale: animation.press.scale }],
  },
});
