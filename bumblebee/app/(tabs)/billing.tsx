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
  TextInput,
  View,
} from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
import {
  IconButton,
  LIST_CONFIG,
  PrimaryButton,
  ScreenHeader,
  SectionTitle,
  SegmentOption,
  SegmentedControl,
  StateBlock,
  TEXT_LIST_CONFIG,
  ScreenBackground,
} from '../../components/app/flat-primitives';
import { colors, radii, shadows, spacing, typography, animation } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../components/app/custom-dialog';
import { useDeviceLayout } from '../../hooks/use-device-layout';
import api from '../../utils/api';
import { formatDate, formatMoney, formatTime, todayIsoDate } from '../../utils/format';

type BillingTab = 'new_bill' | 'history' | 'pending';
type PaymentMode = 'cash' | 'account';
type PaymentStatus = 'paid' | 'pending';

type VehicleType = { id: number; name: string; label: string };
type Service = { id: number; vehicle_type_id: number; name: string; price: string };
type ExtraService = { id: number; name: string; price: string };
type Employee = { id: number; name: string; role: string; is_active: number };

type Payment = {
  id: number;
  bill_id: number | null;
  amount: string;
  payment_mode: PaymentMode;
  is_advance: number;
  vehicle_number: string | null;
  created_by_name: string;
  created_at: string;
};

type PendingBill = {
  id: number;
  vehicle_number: string | null;
  customer_mobile: string | null;
  total_amount: string;
  balance_amount: string;
  created_at: string;
};

type FormSection = { id: 'vehicle' | 'service' | 'extras' | 'details' | 'summary' | 'submit' };

const TABS: SegmentOption<BillingTab>[] = [
  { id: 'new_bill', label: 'New', icon: 'add-circle-outline' },
  { id: 'history', label: 'History', icon: 'receipt-outline' },
  { id: 'pending', label: 'Pending', icon: 'time-outline' },
];

const PAYMENT_MODES: SegmentOption<PaymentMode>[] = [
  { id: 'cash', label: 'Cash', icon: 'cash-outline' },
  { id: 'account', label: 'Account', icon: 'card-outline' },
];

const PAYMENT_STATUSES: SegmentOption<PaymentStatus>[] = [
  { id: 'paid', label: 'Paid', icon: 'checkmark-circle-outline' },
  { id: 'pending', label: 'Pending', icon: 'time-outline' },
];

const FORM_SECTIONS: FormSection[] = [
  { id: 'vehicle' }, { id: 'service' }, { id: 'extras' },
  { id: 'details' }, { id: 'summary' }, { id: 'submit' },
];

function vehicleIcon(name: string): keyof typeof Ionicons.glyphMap {
  const normalized = name?.toLowerCase();
  if (normalized === 'bike') return 'bicycle-outline';
  if (normalized === 'car') return 'car-outline';
  return 'bus-outline';
}

function formatVehicleNumber(value: string) {
  const raw = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const match = raw.match(/^([A-Z]{1,2})?([0-9]{1,2})?([A-Z]{1,3})?([0-9]{1,4})?/);
  if (!match || !match[0]) return raw.slice(0, 15);
  const parts = [match[1], match[2], match[3], match[4]].filter(Boolean);
  const remainder = raw.slice(match[0].length);
  return `${parts.join('-')}${remainder ? `-${remainder}` : ''}`.slice(0, 15);
}

export default function BillingScreen() {
  const { user, isAdmin } = useAuth();
  const layout = useDeviceLayout();
  const { showDialog, DialogPortal } = useDialog();
  const [activeTab, setActiveTab] = useState<BillingTab>('new_bill');

  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [extras, setExtras] = useState<ExtraService[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedVT, setSelectedVT] = useState<number | null>(null);
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<number[]>([]);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [createdBy, setCreatedBy] = useState<number | null>(null);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [historyDate, setHistoryDate] = useState(todayIsoDate);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);

  const [pendingBills, setPendingBills] = useState<PendingBill[]>([]);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingRefreshing, setPendingRefreshing] = useState(false);
  const [updatingPendingId, setUpdatingPendingId] = useState<number | null>(null);

  const loadNewBillConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const [typesRes, extrasRes, empsRes] = await Promise.all([
        api.get('/vehicles/types'),
        api.get('/vehicles/extra-services'),
        api.get('/employees'),
      ]);
      const activeEmployees = empsRes.data.filter((employee: Employee) => employee.is_active);
      setVehicleTypes(typesRes.data);
      setExtras(extrasRes.data);
      setEmployees(activeEmployees);
      setCreatedBy((current) => current || activeEmployees.find((employee: Employee) => employee.id === user?.id)?.id || null);
    } catch {
      showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to load billing configuration.' });
    } finally {
      setLoadingConfig(false);
    }
  }, [showDialog, user?.id]);

  useEffect(() => {
    if (activeTab === 'new_bill') loadNewBillConfig();
  }, [activeTab, loadNewBillConfig]);

  useEffect(() => {
    if (!selectedVT) { setServices([]); setSelectedService(null); return; }
    setLoadingServices(true);
    api.get(`/vehicles/services?vehicleTypeId=${selectedVT}`)
      .then((res) => setServices(res.data))
      .catch(() => showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to load service packages.' }))
      .finally(() => setLoadingServices(false));
    setSelectedService(null);
  }, [selectedVT, showDialog]);

  const loadHistory = useCallback(async (pageNum = 1, isRefresh = false) => {
    if (!isRefresh) setLoadingHistory(true);
    try {
      const res = await api.get(`/billing/payments?date=${historyDate}&page=${pageNum}&limit=15`);
      setPayments((previous) => (pageNum === 1 ? res.data.data : [...previous, ...res.data.data]));
      setHistoryTotal(res.data.total || 0);
    } finally {
      setLoadingHistory(false);
      setHistoryRefreshing(false);
    }
  }, [historyDate]);

  const loadPending = useCallback(async (pageNum = 1, isRefresh = false) => {
    if (!isRefresh) setLoadingPending(true);
    try {
      const res = await api.get(`/billing?payment_status=pending&page=${pageNum}&limit=15`);
      setPendingBills((previous) => (pageNum === 1 ? res.data.data : [...previous, ...res.data.data]));
      setPendingTotal(res.data.total || 0);
    } finally {
      setLoadingPending(false);
      setPendingRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') { setHistoryPage(1); loadHistory(1); }
    if (activeTab === 'pending') { setPendingPage(1); loadPending(1); }
  }, [activeTab, historyDate, loadHistory, loadPending]);

  const toggleExtra = useCallback((id: number) => {
    setSelectedExtras((prev) => prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id]);
  }, []);

  const selectedExtraIds = useMemo(() => new Set(selectedExtras), [selectedExtras]);
  const selectedServicePrice = useMemo(() => Number(services.find((s) => s.id === selectedService)?.price || 0), [selectedService, services]);
  const extrasTotal = useMemo(() => selectedExtras.reduce((sum, id) => sum + Number(extras.find((e) => e.id === id)?.price || 0), 0), [extras, selectedExtras]);
  const totalAmount = selectedServicePrice + extrasTotal;
  const advance = Number(advanceAmount) || 0;
  const paidAmount = paymentStatus === 'pending' ? 0 : Math.max(totalAmount - advance, 0);

  const resetForm = useCallback(() => {
    setSelectedVT(null); setSelectedService(null); setSelectedExtras([]); setVehicleNumber('');
    setCustomerMobile(''); setAdvanceAmount(''); setPaymentMode('cash'); setPaymentStatus('paid');
    setCreatedBy(employees.find((e) => e.id === user?.id)?.id || null);
  }, [employees, user?.id]);

  const handleCreateBill = useCallback(async () => {
    if (!selectedVT || !selectedService || !vehicleNumber || !createdBy) {
      showDialog({ icon: 'alert-circle-outline', iconColor: colors.warning, title: 'Missing Details', message: 'Select vehicle, service, operator, and vehicle number.' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/billing', {
        vehicle_type_id: selectedVT, vehicle_number: vehicleNumber, customer_mobile: customerMobile || null,
        service_id: selectedService, extra_service_ids: selectedExtras, total_amount: totalAmount,
        paid_amount: paidAmount, advance_amount: advance, payment_mode: paymentMode,
        payment_status: paymentStatus, created_by: createdBy,
      });
      showDialog({ icon: 'checkmark-circle-outline', iconColor: colors.success, title: 'Success', message: 'Bill created successfully.' });
      resetForm();
    } catch (e: any) {
      showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: e.response?.data?.message || 'Failed to create bill.' });
    } finally {
      setSubmitting(false);
    }
  }, [advance, createdBy, customerMobile, paidAmount, paymentMode, paymentStatus, resetForm, selectedExtras, selectedService, selectedVT, showDialog, totalAmount, vehicleNumber]);

  const handleHistoryRefresh = useCallback(() => { setHistoryRefreshing(true); setHistoryPage(1); loadHistory(1, true); }, [loadHistory]);
  const handlePendingRefresh = useCallback(() => { setPendingRefreshing(true); setPendingPage(1); loadPending(1, true); }, [loadPending]);
  const handleHistoryLoadMore = useCallback(() => { if (loadingHistory || payments.length >= historyTotal) return; const n = historyPage + 1; setHistoryPage(n); loadHistory(n); }, [historyPage, historyTotal, loadHistory, loadingHistory, payments.length]);
  const handlePendingLoadMore = useCallback(() => { if (loadingPending || pendingBills.length >= pendingTotal) return; const n = pendingPage + 1; setPendingPage(n); loadPending(n); }, [loadPending, loadingPending, pendingBills.length, pendingPage, pendingTotal]);

  const handleDeletePayment = useCallback((id: number) => {
    showDialog({
      icon: 'trash-outline', iconColor: colors.danger, title: 'Delete Payment', message: 'Delete this payment record?',
      actions: [
        { label: 'Cancel', tone: 'cancel' },
        { label: 'Delete', tone: 'danger', onPress: async () => { try { await api.delete(`/billing/payments/${id}`); loadHistory(1); } catch { showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to delete payment.' }); } } },
      ],
    });
  }, [loadHistory, showDialog]);

  const handleMarkPending = useCallback((billId: number) => {
    showDialog({
      icon: 'time-outline', iconColor: colors.warning, title: 'Mark Pending', message: 'Move this bill back to pending?',
      actions: [
        { label: 'Cancel', tone: 'cancel' },
        { label: 'Mark Pending', tone: 'primary', onPress: async () => { try { await api.put(`/billing/${billId}/payment-status`, { status: 'pending' }); loadHistory(1); } catch { showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to update status.' }); } } },
      ],
    });
  }, [loadHistory, showDialog]);

  const handleMarkPaid = useCallback((id: number, mode: PaymentMode) => {
    setUpdatingPendingId(id);
    api.put(`/billing/${id}/payment-status`, { status: 'paid', payment_mode: mode })
      .then(() => loadPending(1))
      .catch(() => showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to record payment.' }))
      .finally(() => setUpdatingPendingId(null));
  }, [loadPending, showDialog]);

  const contentStyle = useMemo(() => [
    styles.content, {
      paddingHorizontal: layout.horizontalPadding, paddingTop: layout.contentTopPadding,
      paddingBottom: layout.contentBottomPadding, maxWidth: layout.maxContentWidth,
      alignSelf: layout.isTablet ? ('center' as const) : ('stretch' as const),
    },
  ], [layout.contentBottomPadding, layout.contentTopPadding, layout.horizontalPadding, layout.isTablet, layout.maxContentWidth]);

  const Header = useMemo(() => (
    <View style={styles.headerWrap}>
      <ScreenHeader title="Billing" subtitle="Create bills & manage payments" />
      <SegmentedControl options={TABS} value={activeTab} onChange={setActiveTab} accessibilityLabel="Billing section" />
    </View>
  ), [activeTab]);

  if (activeTab === 'history') {
    return (
      <ScreenBackground>
        <View style={styles.safeArea}>
          <HistoryList header={Header} contentStyle={contentStyle} isAdmin={isAdmin} payments={payments} loading={loadingHistory} refreshing={historyRefreshing} total={historyTotal} date={historyDate} columns={layout.columns} onDateChange={setHistoryDate} onRefresh={handleHistoryRefresh} onEndReached={handleHistoryLoadMore} onDeletePayment={handleDeletePayment} onMarkPending={handleMarkPending} />
          <DialogPortal />
        </View>
      </ScreenBackground>
    );
  }

  if (activeTab === 'pending') {
    return (
      <ScreenBackground>
        <View style={styles.safeArea}>
          <PendingList header={Header} contentStyle={contentStyle} bills={pendingBills} loading={loadingPending} refreshing={pendingRefreshing} total={pendingTotal} columns={layout.columns} updatingId={updatingPendingId} onRefresh={handlePendingRefresh} onEndReached={handlePendingLoadMore} onMarkPaid={handleMarkPaid} />
          <DialogPortal />
        </View>
      </ScreenBackground>
    );
  }

  const formContext: FormContext = {
    columns: layout.columns, loadingConfig, loadingServices, vehicleTypes, services, extras, employees,
    selectedVT, selectedService, selectedExtraIds, vehicleNumber, customerMobile, paymentMode, paymentStatus,
    advanceAmount, createdBy, selectedServicePrice, extrasTotal, totalAmount, advance, submitting,
    onSelectVehicle: setSelectedVT, onSelectService: setSelectedService, onToggleExtra: toggleExtra,
    onVehicleNumberChange: (text) => setVehicleNumber(formatVehicleNumber(text)),
    onCustomerMobileChange: setCustomerMobile, onPaymentModeChange: setPaymentMode,
    onPaymentStatusChange: setPaymentStatus, onAdvanceAmountChange: setAdvanceAmount,
    onCreatedByChange: setCreatedBy, onCreateBill: handleCreateBill,
  };

  return (
    <ScreenBackground>
      <View style={styles.safeArea}>
        <NewBillForm header={Header} contentStyle={contentStyle} context={formContext} />
        <DialogPortal />
      </View>
    </ScreenBackground>
  );
}

// --- Form Types ---
type FormContext = {
  columns: number; loadingConfig: boolean; loadingServices: boolean;
  vehicleTypes: VehicleType[]; services: Service[]; extras: ExtraService[]; employees: Employee[];
  selectedVT: number | null; selectedService: number | null; selectedExtraIds: Set<number>;
  vehicleNumber: string; customerMobile: string; paymentMode: PaymentMode; paymentStatus: PaymentStatus;
  advanceAmount: string; createdBy: number | null; selectedServicePrice: number; extrasTotal: number;
  totalAmount: number; advance: number; submitting: boolean;
  onSelectVehicle: (id: number) => void; onSelectService: (id: number) => void; onToggleExtra: (id: number) => void;
  onVehicleNumberChange: (value: string) => void; onCustomerMobileChange: (value: string) => void;
  onPaymentModeChange: (value: PaymentMode) => void; onPaymentStatusChange: (value: PaymentStatus) => void;
  onAdvanceAmountChange: (value: string) => void; onCreatedByChange: (id: number) => void; onCreateBill: () => void;
};

// --- New Bill Form ---
const NewBillForm = memo(function NewBillForm({ header, contentStyle, context }: { header: React.ReactElement; contentStyle: object; context: FormContext }) {
  const keyExtractor = useCallback((item: FormSection) => item.id, []);
  const renderItem: ListRenderItem<FormSection> = useCallback(({ item }) => <FormSectionView section={item} context={context} />, [context]);
  const Empty = useMemo(() => context.loadingConfig ? <StateBlock loading title="Loading billing setup" /> : <StateBlock title="Setup unavailable" icon="warning-outline" />, [context.loadingConfig]);

  return (
    <FlatList
      data={context.loadingConfig ? [] : FORM_SECTIONS}
      keyExtractor={keyExtractor} renderItem={renderItem}
      ListHeaderComponent={header} ListEmptyComponent={Empty}
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false} {...LIST_CONFIG}
    />
  );
});

const FormSectionView = memo(function FormSectionView({ section, context }: { section: FormSection; context: FormContext }) {
  if (section.id === 'vehicle') {
    return (<View><SectionTitle title="1. Vehicle Type" /><VehicleTypeGrid data={context.vehicleTypes} columns={context.columns > 1 ? context.columns : 3} selectedId={context.selectedVT} onSelect={context.onSelectVehicle} /></View>);
  }
  if (section.id === 'service') {
    if (!context.selectedVT) return null;
    return (<View><SectionTitle title="2. Service" />{context.loadingServices ? <ActivityIndicator color={colors.accent} style={styles.inlineLoader} /> : <ServiceList data={context.services} selectedId={context.selectedService} onSelect={context.onSelectService} />}</View>);
  }
  if (section.id === 'extras') {
    if (!context.selectedService) return null;
    return (<View><SectionTitle title="3. Extras" subtitle="Optional add-ons" /><ExtraList data={context.extras} selectedIds={context.selectedExtraIds} onToggle={context.onToggleExtra} /></View>);
  }
  if (section.id === 'details') {
    if (!context.selectedService) return null;
    return <BillDetails context={context} />;
  }
  if (section.id === 'summary') {
    if (!context.selectedService) return null;
    return <BillSummary context={context} />;
  }
  if (!context.selectedService) return null;
  return <PrimaryButton label={`Create Bill · ${formatMoney(context.totalAmount)}`} onPress={context.onCreateBill} loading={context.submitting} disabled={context.totalAmount <= 0} icon="checkmark-circle-outline" />;
});

// --- Vehicle Type Grid ---
const VehicleTypeGrid = memo(function VehicleTypeGrid({ data, columns, selectedId, onSelect }: { data: VehicleType[]; columns: number; selectedId: number | null; onSelect: (id: number) => void }) {
  const keyExtractor = useCallback((item: VehicleType) => item.id.toString(), []);
  const renderItem: ListRenderItem<VehicleType> = useCallback(({ item }) => <VehicleTypeCard item={item} columns={columns} selected={selectedId === item.id} onSelect={onSelect} />, [columns, onSelect, selectedId]);
  const columnWrapperStyle = useMemo(() => (columns > 1 ? styles.columnWrapper : undefined), [columns]);
  return <FlatList key={`vt-${columns}`} data={data} numColumns={columns} keyExtractor={keyExtractor} renderItem={renderItem} scrollEnabled={false} columnWrapperStyle={columnWrapperStyle} contentContainerStyle={styles.optionList} showsVerticalScrollIndicator={false} {...TEXT_LIST_CONFIG} />;
});

const VehicleTypeCard = memo(function VehicleTypeCard({ item, columns, selected, onSelect }: { item: VehicleType; columns: number; selected: boolean; onSelect: (id: number) => void }) {
  const handlePress = useCallback(() => onSelect(item.id), [item.id, onSelect]);
  const flexStyle = useMemo(() => ({ flex: columns > 1 ? 1 : undefined }), [columns]);
  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.vehicleCard, flexStyle, selected && styles.selectedCard, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Select ${item.label}`}>
      <Ionicons name={vehicleIcon(item.name)} size={22} color={selected ? colors.accent : colors.textMuted} />
      <Text style={[styles.vehicleLabel, selected && styles.selectedText]} numberOfLines={1}>{item.label}</Text>
    </Pressable>
  );
});

// --- Service List ---
const ServiceList = memo(function ServiceList({ data, selectedId, onSelect }: { data: Service[]; selectedId: number | null; onSelect: (id: number) => void }) {
  const keyExtractor = useCallback((item: Service) => item.id.toString(), []);
  const renderItem: ListRenderItem<Service> = useCallback(({ item }) => <ServiceChip item={item} selected={selectedId === item.id} onSelect={onSelect} />, [onSelect, selectedId]);
  return <FlatList horizontal data={data} keyExtractor={keyExtractor} renderItem={renderItem} contentContainerStyle={styles.horizontalList} showsHorizontalScrollIndicator={false} {...TEXT_LIST_CONFIG} />;
});

const ServiceChip = memo(function ServiceChip({ item, selected, onSelect }: { item: Service; selected: boolean; onSelect: (id: number) => void }) {
  const handlePress = useCallback(() => onSelect(item.id), [item.id, onSelect]);
  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.serviceChip, selected && styles.selectedCard, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Select ${item.name}`}>
      <Text style={[styles.serviceText, selected && styles.selectedText]}>{item.name}</Text>
      <Text style={[styles.servicePrice, selected && styles.selectedText]}>{formatMoney(item.price)}</Text>
    </Pressable>
  );
});

// --- Extra List ---
const ExtraList = memo(function ExtraList({ data, selectedIds, onToggle }: { data: ExtraService[]; selectedIds: Set<number>; onToggle: (id: number) => void }) {
  const keyExtractor = useCallback((item: ExtraService) => item.id.toString(), []);
  const renderItem: ListRenderItem<ExtraService> = useCallback(({ item }) => <ExtraRow item={item} selected={selectedIds.has(item.id)} onToggle={onToggle} />, [onToggle, selectedIds]);
  return <FlatList data={data} keyExtractor={keyExtractor} renderItem={renderItem} scrollEnabled={false} contentContainerStyle={styles.extraList} showsVerticalScrollIndicator={false} {...TEXT_LIST_CONFIG} />;
});

const ExtraRow = memo(function ExtraRow({ item, selected, onToggle }: { item: ExtraService; selected: boolean; onToggle: (id: number) => void }) {
  const handlePress = useCallback(() => onToggle(item.id), [item.id, onToggle]);
  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.extraRow, selected && styles.extraRowSelected, pressed && styles.pressed]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`Toggle ${item.name}`}>
      <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={18} color={selected ? colors.accent : colors.textSubtle} />
      <Text style={styles.extraName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.extraPrice}>{formatMoney(item.price)}</Text>
    </Pressable>
  );
});

// --- Bill Details ---
const BillDetails = memo(function BillDetails({ context }: { context: FormContext }) {
  return (
    <View>
      <SectionTitle title="4. Details" />
      <View style={styles.formPanel}>
        <Field label="Vehicle Number">
          <TextInput style={styles.input} placeholder="KA-01-AB-1234" placeholderTextColor={colors.textSubtle} value={context.vehicleNumber} onChangeText={context.onVehicleNumberChange} autoCapitalize="characters" accessibilityLabel="Vehicle number" />
        </Field>
        <Field label="Customer Mobile">
          <TextInput style={styles.input} placeholder="Optional" placeholderTextColor={colors.textSubtle} value={context.customerMobile} onChangeText={context.onCustomerMobileChange} keyboardType="phone-pad" accessibilityLabel="Customer mobile" />
        </Field>
        <Field label="Payment Mode">
          <SegmentedControl options={PAYMENT_MODES} value={context.paymentMode} onChange={context.onPaymentModeChange} accessibilityLabel="Payment mode" />
        </Field>
        <Field label="Payment Status">
          <SegmentedControl options={PAYMENT_STATUSES} value={context.paymentStatus} onChange={context.onPaymentStatusChange} accessibilityLabel="Payment status" />
        </Field>
        <Field label="Advance Amount">
          <TextInput style={styles.input} placeholder="0" placeholderTextColor={colors.textSubtle} value={context.advanceAmount} onChangeText={context.onAdvanceAmountChange} keyboardType="numeric" accessibilityLabel="Advance amount" />
        </Field>
        <Field label="Bill Added By">
          <EmployeePicker data={context.employees} selectedId={context.createdBy} onSelect={context.onCreatedByChange} />
        </Field>
      </View>
    </View>
  );
});

const Field = memo(function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>);
});

// --- Employee Picker ---
const EmployeePicker = memo(function EmployeePicker({ data, selectedId, onSelect }: { data: Employee[]; selectedId: number | null; onSelect: (id: number) => void }) {
  const keyExtractor = useCallback((item: Employee) => item.id.toString(), []);
  const renderItem: ListRenderItem<Employee> = useCallback(({ item }) => <EmployeeChip item={item} selected={selectedId === item.id} onSelect={onSelect} />, [onSelect, selectedId]);
  return <FlatList horizontal data={data} keyExtractor={keyExtractor} renderItem={renderItem} contentContainerStyle={styles.horizontalList} showsHorizontalScrollIndicator={false} {...TEXT_LIST_CONFIG} />;
});

const EmployeeChip = memo(function EmployeeChip({ item, selected, onSelect }: { item: Employee; selected: boolean; onSelect: (id: number) => void }) {
  const handlePress = useCallback(() => onSelect(item.id), [item.id, onSelect]);
  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.employeeChip, selected && styles.selectedCard, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Select ${item.name}`}>
      <Text style={[styles.employeeText, selected && styles.selectedText]}>{item.name}</Text>
    </Pressable>
  );
});

// --- Bill Summary ---
const BillSummary = memo(function BillSummary({ context }: { context: FormContext }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>Bill Summary</Text>
      <SummaryLine label="Base Wash" value={formatMoney(context.selectedServicePrice)} />
      <SummaryLine label="Extras" value={formatMoney(context.extrasTotal)} />
      <SummaryLine label="Advance" value={`-${formatMoney(context.advance)}`} danger />
      <View style={styles.summaryDivider} />
      <SummaryLine label="Grand Total" value={formatMoney(context.totalAmount)} total />
    </View>
  );
});

const SummaryLine = memo(function SummaryLine({ label, value, danger = false, total = false }: { label: string; value: string; danger?: boolean; total?: boolean }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={[styles.summaryLabel, total && styles.summaryTotalLabel]}>{label}</Text>
      <Text style={[styles.summaryValue, danger && styles.dangerText, total && styles.summaryTotalValue]}>{value}</Text>
    </View>
  );
});

// --- History List ---
type HistoryListProps = { header: React.ReactElement; contentStyle: object; isAdmin: boolean; payments: Payment[]; loading: boolean; refreshing: boolean; total: number; date: string; columns: number; onDateChange: (d: string) => void; onRefresh: () => void; onEndReached: () => void; onDeletePayment: (id: number) => void; onMarkPending: (id: number) => void };

const HistoryList = memo(function HistoryList({ header, contentStyle, isAdmin, payments, loading, refreshing, total, date, columns, onDateChange, onRefresh, onEndReached, onDeletePayment, onMarkPending }: HistoryListProps) {
  const keyExtractor = useCallback((item: Payment) => item.id.toString(), []);
  const renderItem: ListRenderItem<Payment> = useCallback(({ item }) => <PaymentCard item={item} columns={columns} isAdmin={isAdmin} onDelete={onDeletePayment} onMarkPending={onMarkPending} />, [columns, isAdmin, onDeletePayment, onMarkPending]);
  const columnWrapperStyle = useMemo(() => (columns > 1 ? styles.columnWrapper : undefined), [columns]);
  const ListHeader = useMemo(() => (
    <View>{header}<View style={styles.filterBar}><TextInput style={styles.dateInput} value={date} onChangeText={onDateChange} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSubtle} accessibilityLabel="Payment history date" /><Text style={styles.filterBadge}>{total} payments</Text></View></View>
  ), [date, header, onDateChange, total]);
  const Empty = useMemo(() => loading ? <StateBlock loading title="Loading payments" /> : <StateBlock title="No payments found" message="Try another date." icon="receipt-outline" />, [loading]);

  return (
    <FlatList key={`history-${columns}`} data={loading ? [] : payments} numColumns={columns} keyExtractor={keyExtractor} renderItem={renderItem} columnWrapperStyle={columnWrapperStyle} ListHeaderComponent={ListHeader} ListEmptyComponent={Empty} contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false} onEndReached={onEndReached} onEndReachedThreshold={0.35} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />} {...LIST_CONFIG} />
  );
});

const PaymentCard = memo(function PaymentCard({ item, columns, isAdmin, onDelete, onMarkPending }: { item: Payment; columns: number; isAdmin: boolean; onDelete: (id: number) => void; onMarkPending: (id: number) => void }) {
  const cardFlex = useMemo(() => ({ flex: columns > 1 ? 1 : undefined }), [columns]);
  const handleDelete = useCallback(() => onDelete(item.id), [item.id, onDelete]);
  const handleMarkPending = useCallback(() => { if (item.bill_id) onMarkPending(item.bill_id); }, [item.bill_id, onMarkPending]);

  return (
    <View style={[styles.recordCard, cardFlex]}>
      <View style={styles.recordHeader}>
        <Text style={styles.recordTitle} numberOfLines={1}>{item.vehicle_number || 'NO PLATE'}</Text>
        <Text style={styles.recordAmount}>{formatMoney(item.amount)}</Text>
      </View>
      <Text style={styles.recordMeta}>{formatTime(item.created_at)} · {item.created_by_name}</Text>
      <View style={styles.badgeRow}>
        <Badge label={item.payment_mode.toUpperCase()} tone={item.payment_mode === 'cash' ? 'success' : 'info'} />
        <Badge label={item.is_advance ? 'ADVANCE' : 'PAYMENT'} tone={item.is_advance ? 'warning' : 'info'} />
      </View>
      {isAdmin && (
        <View style={styles.actionRow}>
          {!!item.bill_id && <IconButton icon="time-outline" label="Revert pending" onPress={handleMarkPending} tone="accent" size={34} />}
          <IconButton icon="trash-outline" label="Delete payment" onPress={handleDelete} tone="danger" size={34} />
        </View>
      )}
    </View>
  );
});

// --- Pending List ---
type PendingListProps = { header: React.ReactElement; contentStyle: object; bills: PendingBill[]; loading: boolean; refreshing: boolean; total: number; columns: number; updatingId: number | null; onRefresh: () => void; onEndReached: () => void; onMarkPaid: (id: number, mode: PaymentMode) => void };

const PendingList = memo(function PendingList({ header, contentStyle, bills, loading, refreshing, total, columns, updatingId, onRefresh, onEndReached, onMarkPaid }: PendingListProps) {
  const keyExtractor = useCallback((item: PendingBill) => item.id.toString(), []);
  const renderItem: ListRenderItem<PendingBill> = useCallback(({ item }) => <PendingCard item={item} columns={columns} updatingId={updatingId} onMarkPaid={onMarkPaid} />, [columns, onMarkPaid, updatingId]);
  const columnWrapperStyle = useMemo(() => (columns > 1 ? styles.columnWrapper : undefined), [columns]);
  const ListHeader = useMemo(() => (<View>{header}<Text style={styles.pendingTotal}>{total} pending</Text></View>), [header, total]);
  const Empty = useMemo(() => loading ? <StateBlock loading title="Loading pending" /> : <StateBlock title="No pending payments" icon="checkmark-done-outline" />, [loading]);

  return (
    <FlatList key={`pending-${columns}`} data={loading ? [] : bills} numColumns={columns} keyExtractor={keyExtractor} renderItem={renderItem} columnWrapperStyle={columnWrapperStyle} ListHeaderComponent={ListHeader} ListEmptyComponent={Empty} contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false} onEndReached={onEndReached} onEndReachedThreshold={0.35} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />} {...LIST_CONFIG} />
  );
});

const PendingCard = memo(function PendingCard({ item, columns, updatingId, onMarkPaid }: { item: PendingBill; columns: number; updatingId: number | null; onMarkPaid: (id: number, mode: PaymentMode) => void }) {
  const cardFlex = useMemo(() => ({ flex: columns > 1 ? 1 : undefined }), [columns]);
  const markCash = useCallback(() => onMarkPaid(item.id, 'cash'), [item.id, onMarkPaid]);
  const markAccount = useCallback(() => onMarkPaid(item.id, 'account'), [item.id, onMarkPaid]);
  const isLoading = updatingId === item.id;

  return (
    <View style={[styles.recordCard, cardFlex]}>
      <View style={styles.recordHeader}>
        <Text style={styles.recordTitle} numberOfLines={1}>#{item.id} · {item.vehicle_number || 'NO PLATE'}</Text>
        <Text style={[styles.recordAmount, styles.dangerText]}>{formatMoney(item.balance_amount)}</Text>
      </View>
      <Text style={styles.recordMeta}>Total: {formatMoney(item.total_amount)} · {formatDate(item.created_at)}</Text>
      <View style={styles.payActions}>
        <PrimaryButton label="Cash" onPress={markCash} loading={isLoading} disabled={isLoading} icon="cash-outline" />
        <PrimaryButton label="Account" onPress={markAccount} loading={isLoading} disabled={isLoading} icon="card-outline" />
      </View>
    </View>
  );
});

// --- Badge ---
const Badge = memo(function Badge({ label, tone }: { label: string; tone: 'success' | 'info' | 'warning' }) {
  const bg = tone === 'success' ? colors.successSoft : tone === 'warning' ? colors.warningSoft : colors.infoSoft;
  const fg = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.info;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
});

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { flexGrow: 1, width: '100%', paddingTop: spacing.lg, paddingBottom: 80 },
  headerWrap: { marginBottom: spacing.lg },
  inlineLoader: { marginVertical: spacing.lg },
  optionList: { gap: spacing.sm },
  columnWrapper: { gap: spacing.sm },
  vehicleCard: {
    minHeight: 68, borderRadius: radii.card, backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder,
    alignItems: 'center', justifyContent: 'center', padding: spacing.sm, ...shadows.subtle,
  },
  selectedCard: { backgroundColor: colors.accentGlass, borderColor: colors.accentBorder },
  vehicleLabel: { color: colors.text, fontSize: typography.caption, fontWeight: '800', marginTop: spacing.xs },
  selectedText: { color: colors.accent },
  horizontalList: { gap: spacing.sm, paddingRight: spacing.lg },
  serviceChip: {
    minHeight: 42, borderRadius: radii.card, backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder,
    paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  serviceText: { color: colors.text, fontSize: typography.caption, fontWeight: '700' },
  servicePrice: { color: colors.accent, fontSize: typography.caption, fontWeight: '800' },
  extraList: { borderRadius: radii.card, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder },
  extraRow: {
    minHeight: 46, backgroundColor: colors.surfaceGlass, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder, gap: spacing.sm,
  },
  extraRowSelected: { backgroundColor: colors.surfacePressed },
  extraName: { flex: 1, color: colors.text, fontSize: typography.body, fontWeight: '700' },
  extraPrice: { color: colors.accent, fontSize: typography.caption, fontWeight: '800' },
  formPanel: {
    borderRadius: radii.card, backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder,
    padding: spacing.md, gap: spacing.md, ...shadows.subtle,
  },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  input: {
    minHeight: 44, borderRadius: radii.sm, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: colors.border,
    color: colors.text, paddingHorizontal: spacing.md, fontSize: typography.bodyLarge,
  },
  employeeChip: {
    minHeight: 36, borderRadius: radii.card, backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center',
  },
  employeeText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  summaryCard: {
    borderRadius: radii.card, backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder,
    padding: spacing.md, marginTop: spacing.xl, marginBottom: spacing.lg, ...shadows.subtle,
  },
  summaryTitle: { color: colors.text, fontSize: typography.bodyLarge, fontWeight: '800', marginBottom: spacing.sm },
  summaryLine: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  summaryLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  summaryValue: { color: colors.text, fontSize: typography.caption, fontWeight: '800' },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.glassBorder, marginVertical: spacing.xs },
  summaryTotalLabel: { color: colors.text, fontSize: typography.bodyLarge, fontWeight: '800' },
  summaryTotalValue: { color: colors.accent, fontSize: typography.title },
  dangerText: { color: colors.danger },
  filterBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm },
  dateInput: {
    minHeight: 40, width: 140, borderRadius: radii.sm, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: colors.border,
    color: colors.text, paddingHorizontal: spacing.md, fontSize: typography.caption,
  },
  filterBadge: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  pendingTotal: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.xs },
  recordCard: {
    borderRadius: radii.card, backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder,
    padding: spacing.md, marginBottom: spacing.sm, ...shadows.subtle,
  },
  recordHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  recordTitle: { flex: 1, color: colors.text, fontSize: typography.bodyLarge, fontWeight: '800' },
  recordAmount: { color: colors.success, fontSize: typography.bodyLarge, fontWeight: '800' },
  recordMeta: { color: colors.textSubtle, fontSize: typography.eyebrow, marginTop: spacing.xs },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.xs },
  badgeText: { fontSize: typography.eyebrow, fontWeight: '800' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs, paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.glassBorder },
  payActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  pressed: { opacity: animation.press.opacity, transform: [{ scale: animation.press.scale }] },
});
