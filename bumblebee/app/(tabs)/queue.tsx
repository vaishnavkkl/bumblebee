import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
import {
  IconButton,
  LIST_CONFIG,
  ScreenHeader,
  SegmentOption,
  SegmentedControl,
  StateBlock,
  ScreenBackground,
} from '../../components/app/flat-primitives';
import { colors, radii, shadows, spacing, typography, animation } from '../../constants/theme';
import { useDialog } from '../../components/app/custom-dialog';
import { useDeviceLayout } from '../../hooks/use-device-layout';
import api from '../../utils/api';
import { formatMoney, formatTime } from '../../utils/format';

type QueueFilter = 'in_progress' | 'completed' | 'all';

type Bill = {
  id: number;
  vehicle_type: string;
  vehicle_number: string;
  service_name: string;
  total_amount: string;
  wash_status: 'pending' | 'in_progress' | 'completed';
  created_by_name: string;
  created_at: string;
  wash_completed_at: string | null;
  extras?: { name: string; price: string }[];
};

const FILTERS: SegmentOption<QueueFilter>[] = [
  { id: 'in_progress', label: 'Active', icon: 'time-outline' },
  { id: 'completed', label: 'Done', icon: 'checkmark-done-outline' },
  { id: 'all', label: 'All', icon: 'albums-outline' },
];

function getVehicleIcon(type: string): keyof typeof Ionicons.glyphMap {
  const normalized = type?.toLowerCase() || '';
  if (normalized.includes('bike')) return 'bicycle-outline';
  if (normalized.includes('car')) return 'car-outline';
  return 'bus-outline';
}

function getStatusColor(status: Bill['wash_status']) {
  if (status === 'in_progress') return colors.info;
  if (status === 'completed') return colors.success;
  return colors.textSubtle;
}

function getStatusLabel(status: Bill['wash_status']) {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'completed') return 'Done';
  return 'Pending';
}

function getDuration(created: string, completed: string | null) {
  if (!completed) return '-';
  const diffMins = Math.floor((new Date(completed).getTime() - new Date(created).getTime()) / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return '<1m';
}

function getExtrasLabel(extras?: Bill['extras']) {
  return extras?.map((item) => item.name).join(', ') || '';
}

export default function QueueScreen() {
  const layout = useDeviceLayout();
  const { showDialog, DialogPortal } = useDialog();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<QueueFilter>('in_progress');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(
    async (pageNum = 1, isRefresh = false) => {
      if (!isRefresh && pageNum === 1) setLoading(true);
      try {
        setError(null);
        const statusParam = filter === 'all' ? '' : `&status=${filter}`;
        const res = await api.get(`/billing?page=${pageNum}&limit=15${statusParam}`);
        setBills((previous) => (pageNum === 1 ? res.data.data : [...previous, ...res.data.data]));
        setTotal(res.data.total || 0);
      } catch (e: any) {
        setError(e.response?.data?.message || 'Could not load wash queue.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    setPage(1);
    loadQueue(1);
  }, [loadQueue]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    loadQueue(1, true);
  }, [loadQueue]);

  const handleLoadMore = useCallback(() => {
    if (loading || bills.length >= total) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadQueue(nextPage);
  }, [bills.length, loadQueue, loading, page, total]);

  const markCompleted = useCallback(
    (id: number, vehicleNumber: string) => {
      showDialog({
        icon: 'checkmark-done-outline',
        iconColor: colors.success,
        title: 'Complete Wash',
        message: `Mark ${vehicleNumber || 'this vehicle'} as completed?`,
        actions: [
          { label: 'Cancel', tone: 'cancel' },
          {
            label: 'Complete',
            tone: 'primary',
            onPress: async () => {
              setUpdatingId(id);
              try {
                await api.put(`/billing/${id}/status`, { status: 'completed' });
                setPage(1);
                loadQueue(1);
              } catch {
                showDialog({
                  icon: 'warning-outline',
                  iconColor: colors.danger,
                  title: 'Error',
                  message: 'Failed to update wash status.',
                });
              } finally {
                setUpdatingId(null);
              }
            },
          },
        ],
      });
    },
    [loadQueue, showDialog],
  );

  const contentStyle = useMemo(
    () => [
      styles.listContent,
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

  const keyExtractor = useCallback((item: Bill) => item.id.toString(), []);
  const renderItem: ListRenderItem<Bill> = useCallback(
    ({ item }) => (
      <QueueCard
        item={item}
        columns={layout.columns}
        updatingId={updatingId}
        onMarkCompleted={markCompleted}
      />
    ),
    [layout.columns, markCompleted, updatingId],
  );
  const columnWrapperStyle = useMemo(
    () => (layout.columns > 1 ? styles.columnWrapper : undefined),
    [layout.columns],
  );

  const Header = useMemo(
    () => (
      <View>
        <ScreenHeader
          title="Wash Queue"
          subtitle={`${total} vehicles`}
          right={<IconButton icon="refresh-outline" label="Refresh" onPress={handleRefresh} tone="accent" />}
        />
        <SegmentedControl
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          accessibilityLabel="Queue filter"
        />
      </View>
    ),
    [filter, handleRefresh, total],
  );

  const Empty = useMemo(() => {
    if (loading) return <StateBlock loading title="Loading queue" message="Fetching wash status…" />;
    if (error) return <StateBlock title="Queue unavailable" message={error} icon="warning-outline" />;
    return <StateBlock title="No vehicles" message="Pull to refresh or change filter." icon="car-outline" />;
  }, [error, loading]);

  return (
    <ScreenBackground>
      <View style={styles.safeArea}>
        <FlatList
          key={`queue-${layout.columns}`}
          data={loading || error ? [] : bills}
          numColumns={layout.columns}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          columnWrapperStyle={columnWrapperStyle}
          ListHeaderComponent={Header}
          ListEmptyComponent={Empty}
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}
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

type QueueCardProps = {
  item: Bill;
  columns: number;
  updatingId: number | null;
  onMarkCompleted: (id: number, vehicleNumber: string) => void;
};

const QueueCard = memo(function QueueCard({
  item,
  columns,
  updatingId,
  onMarkCompleted,
}: QueueCardProps) {
  const handleComplete = useCallback(() => onMarkCompleted(item.id, item.vehicle_number), [item.id, item.vehicle_number, onMarkCompleted]);
  const cardFlex = useMemo(() => ({ flex: columns > 1 ? 1 : undefined }), [columns]);
  const statusColor = getStatusColor(item.wash_status);
  const extrasLabel = useMemo(() => getExtrasLabel(item.extras), [item.extras]);

  return (
    <View style={[styles.card, cardFlex]}>
      <View style={styles.cardHeader}>
        <View style={styles.vehicleInfo}>
          <View style={[styles.vehicleIcon, { backgroundColor: `${statusColor}18` }]}>
            <Ionicons name={getVehicleIcon(item.vehicle_type)} size={18} color={statusColor} />
          </View>
          <View style={styles.vehicleCopy}>
            <Text style={styles.vehicleNumber} numberOfLines={1}>
              {item.vehicle_number || 'NO PLATE'}
            </Text>
            <Text style={styles.vehicleMeta} numberOfLines={1}>
              {item.vehicle_type} · {item.service_name}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{getStatusLabel(item.wash_status)}</Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <InfoRow label="Amount" value={formatMoney(item.total_amount)} />
        <InfoRow label="By" value={item.created_by_name} />
        <InfoRow label="Time" value={formatTime(item.created_at)} />
        {item.wash_status === 'completed' && (
          <InfoRow label="Duration" value={getDuration(item.created_at, item.wash_completed_at)} accent />
        )}
      </View>

      {!!extrasLabel && (
        <View style={styles.extrasBox}>
          <Text style={styles.extrasText} numberOfLines={1}>
            + {extrasLabel}
          </Text>
        </View>
      )}

      {item.wash_status === 'in_progress' && (
        <Pressable
          onPress={handleComplete}
          disabled={updatingId === item.id}
          style={({ pressed }) => [
            styles.actionButton,
            updatingId === item.id && styles.disabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Mark ${item.vehicle_number || 'vehicle'} completed`}
        >
          {updatingId === item.id ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={15} color="#FFFFFF" style={styles.actionIcon} />
              <Text style={styles.actionText}>Mark Completed</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
});

type InfoRowProps = {
  label: string;
  value: string;
  accent?: boolean;
};

const InfoRow = memo(function InfoRow({ label, value, accent = false }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent && styles.infoValueAccent]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: {
    flexGrow: 1,
    width: '100%',
    paddingTop: spacing.lg,
    paddingBottom: 80,
    gap: spacing.sm,
  },
  columnWrapper: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: radii.card,
    backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    padding: spacing.md,
    ...shadows.subtle,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder,
  },
  vehicleInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  vehicleCopy: {
    flex: 1,
    minWidth: 0,
  },
  vehicleNumber: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    lineHeight: 18,
    fontWeight: '800',
  },
  vehicleMeta: {
    color: colors.textSubtle,
    fontSize: typography.eyebrow,
    lineHeight: 14,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: typography.eyebrow,
    fontWeight: '800',
  },
  infoGrid: {
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  infoRow: {
    minHeight: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.textSubtle,
    fontSize: typography.eyebrow,
    fontWeight: '700',
  },
  infoValue: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  infoValueAccent: {
    color: colors.success,
  },
  extrasBox: {
    marginTop: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.glassFrost,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  extrasText: {
    color: colors.accent,
    fontSize: typography.eyebrow,
    fontWeight: '700',
  },
  actionButton: {
    minHeight: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: spacing.sm,
    overflow: 'hidden',
    ...shadows.accent,
  },
  actionIcon: {
    marginRight: 5,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: animation.press.opacity,
    transform: [{ scale: animation.press.scale }],
  },
});
