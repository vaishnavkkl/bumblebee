import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  LIST_CONFIG,
  PrimaryButton,
  ScreenHeader,
  SectionTitle,
  SegmentOption,
  SegmentedControl,
  StateBlock,
  StatGrid,
  StatItem,
  TEXT_LIST_CONFIG,
  ScreenBackground,
} from '../../components/app/flat-primitives';
import { colors, radii, shadows, spacing, typography, animation } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../components/app/custom-dialog';
import { useDeviceLayout } from '../../hooks/use-device-layout';
import api from '../../utils/api';
import { formatDate, formatMoney, monthEndIsoDate, monthStartIsoDate, thisMonthValue, todayIsoDate } from '../../utils/format';

type FinanceTab = 'overview' | 'expense' | 'income' | 'analytics' | 'security';
type IncomeType = 'in_hand' | 'account';
type DeleteType = 'full' | 'month';

type Expense = { id: number; amount: string; category: string; description: string | null; date: string; created_by_name: string };
type Income = { id: number; amount: string; type: IncomeType; source: string; description: string | null; date: string; created_by_name: string };
type TimelineItem = { id: string; amount: string; label: string; description: string | null; date: string; created_by_name: string; direction: 'income' | 'expense'; tone: string };
type CustomerKpis = { total_tracked?: number; repeat_customers?: number; total_revenue?: number; active_customers?: number; at_risk_customers?: number; lost_customers?: number };
type Customer = { customer_mobile: string; visit_count: number; total_spent: string; avg_spend: string; last_visit: string; preferred_types?: string };

const BASE_TABS: SegmentOption<FinanceTab>[] = [
  { id: 'overview', label: 'Overview', icon: 'analytics-outline' },
  { id: 'expense', label: 'Expense', icon: 'remove-circle-outline' },
];
const ADMIN_TABS: SegmentOption<FinanceTab>[] = [
  { id: 'income', label: 'Income', icon: 'add-circle-outline' },
  { id: 'analytics', label: 'Customers', icon: 'people-circle-outline' },
  { id: 'security', label: 'Security', icon: 'shield-checkmark-outline' },
];

const CATEGORIES = ['Water', 'Electricity', 'Supplies', 'Maintenance', 'Rent', 'Food', 'salary', 'Other'];
const SOURCES = ['wash', 'advance', 'balance_payment', 'other'];

const CATEGORY_COLORS: Record<string, string> = {
  Water: colors.info, Electricity: colors.warning, Supplies: colors.success, Maintenance: colors.violet,
  Rent: '#EC4899', Food: '#14B8A6', salary: '#F97316', Other: colors.textSubtle,
};

export default function FinanceScreen() {
  const { isAdmin } = useAuth();
  const layout = useDeviceLayout();
  const { showDialog, DialogPortal } = useDialog();
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [startDate, setStartDate] = useState(monthStartIsoDate);
  const [endDate, setEndDate] = useState(monthEndIsoDate);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Water');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayIsoDate);
  const [savingExpense, setSavingExpense] = useState(false);

  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeType, setIncomeType] = useState<IncomeType>('in_hand');
  const [incomeSource, setIncomeSource] = useState('wash');
  const [incomeDescription, setIncomeDescription] = useState('');
  const [incomeDate, setIncomeDate] = useState(todayIsoDate);
  const [savingIncome, setSavingIncome] = useState(false);

  const [kpis, setKpis] = useState<CustomerKpis | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const [securityPassword, setSecurityPassword] = useState('');
  const [deleteType, setDeleteType] = useState<DeleteType>('month');
  const [deleteMonth, setDeleteMonth] = useState(thisMonthValue);
  const [securityBusy, setSecurityBusy] = useState(false);

  const tabs = useMemo(() => (isAdmin ? [...BASE_TABS, ...ADMIN_TABS] : BASE_TABS), [isAdmin]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const expenseRequest = api.get(`/finance/expenses?startDate=${startDate}&endDate=${endDate}`);
      if (isAdmin) {
        const [expenseRes, incomeRes] = await Promise.all([expenseRequest, api.get(`/finance/income?startDate=${startDate}&endDate=${endDate}`)]);
        setExpenses(expenseRes.data); setIncomes(incomeRes.data);
      } else {
        const expenseRes = await expenseRequest;
        setExpenses(expenseRes.data); setIncomes([]);
      }
    } catch {
      showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to load finance records.' });
    } finally { setLoading(false); setRefreshing(false); }
  }, [endDate, isAdmin, showDialog, startDate]);

  const loadAnalytics = useCallback(async () => {
    if (!isAdmin) return;
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20', search: customerSearch, status: 'All' });
      const [kpiRes, customerRes] = await Promise.all([api.get('/analytics/customers/kpis'), api.get(`/analytics/customers?${params.toString()}`)]);
      setKpis(kpiRes.data); setCustomers(customerRes.data.data || []);
    } catch {
      showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to load customer analytics.' });
    } finally { setAnalyticsLoading(false); }
  }, [customerSearch, isAdmin, showDialog]);

  useEffect(() => {
    if (activeTab === 'overview') loadOverview();
    if (activeTab === 'analytics') loadAnalytics();
  }, [activeTab, loadAnalytics, loadOverview]);

  const handleRefresh = useCallback(() => {
    if (activeTab === 'analytics') { loadAnalytics(); return; }
    setRefreshing(true); loadOverview();
  }, [activeTab, loadAnalytics, loadOverview]);

  const handleSaveExpense = useCallback(async () => {
    if (!expenseAmount || !expenseCategory) {
      showDialog({ icon: 'alert-circle-outline', iconColor: colors.warning, title: 'Missing Details', message: 'Enter amount and category.' }); return;
    }
    setSavingExpense(true);
    try {
      await api.post('/finance/expenses', { amount: Number(expenseAmount), category: expenseCategory, description: expenseDescription || null, date: expenseDate });
      setExpenseAmount(''); setExpenseDescription(''); setExpenseDate(todayIsoDate()); setActiveTab('overview'); loadOverview();
    } catch {
      showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to log expense.' });
    } finally { setSavingExpense(false); }
  }, [expenseAmount, expenseCategory, expenseDate, expenseDescription, loadOverview, showDialog]);

  const handleSaveIncome = useCallback(async () => {
    if (!incomeAmount || Number(incomeAmount) <= 0) {
      showDialog({ icon: 'alert-circle-outline', iconColor: colors.warning, title: 'Missing Details', message: 'Enter a valid income amount.' }); return;
    }
    setSavingIncome(true);
    try {
      await api.post('/finance/income', { amount: Number(incomeAmount), type: incomeType, source: incomeSource, description: incomeDescription || null, date: incomeDate });
      setIncomeAmount(''); setIncomeDescription(''); setIncomeDate(todayIsoDate()); setActiveTab('overview'); loadOverview();
    } catch {
      showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to add income.' });
    } finally { setSavingIncome(false); }
  }, [incomeAmount, incomeDate, incomeDescription, incomeSource, incomeType, loadOverview, showDialog]);

  const handleDeleteIncome = useCallback((id: number) => {
    showDialog({
      icon: 'trash-outline', iconColor: colors.danger, title: 'Delete Income', message: 'Delete this income record?',
      actions: [
        { label: 'Cancel', tone: 'cancel' },
        { label: 'Delete', tone: 'danger', onPress: async () => { try { await api.delete(`/finance/income/${id}`); loadOverview(); } catch { showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to delete income.' }); } } },
      ],
    });
  }, [loadOverview, showDialog]);

  const handleBackup = useCallback(async () => {
    if (!securityPassword) { showDialog({ icon: 'key-outline', iconColor: colors.warning, title: 'Password Required', message: 'Enter admin password first.' }); return; }
    setSecurityBusy(true);
    try {
      const res = await api.post('/system/backup', { password: securityPassword });
      showDialog({ icon: 'checkmark-circle-outline', iconColor: colors.success, title: 'Backup Created', message: res.data.message || 'Backup created on the server.' });
    } catch (e: any) {
      showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: e.response?.data?.message || 'Backup failed.' });
    } finally { setSecurityBusy(false); }
  }, [securityPassword, showDialog]);

  const handleClearData = useCallback(() => {
    if (!securityPassword) { showDialog({ icon: 'key-outline', iconColor: colors.warning, title: 'Password Required', message: 'Enter admin password first.' }); return; }
    if (deleteType === 'month' && !deleteMonth) { showDialog({ icon: 'calendar-outline', iconColor: colors.warning, title: 'Month Required', message: 'Select a month to clear.' }); return; }
    showDialog({
      icon: 'trash-outline', iconColor: colors.danger, title: 'Clear Data', message: 'This permanently removes selected data. Continue?',
      actions: [
        { label: 'Cancel', tone: 'cancel' },
        {
          label: 'Clear', tone: 'danger',
          onPress: async () => {
            setSecurityBusy(true);
            try {
              const res = await api.post('/system/clear', { password: securityPassword, type: deleteType, month: deleteMonth });
              showDialog({ icon: 'checkmark-circle-outline', iconColor: colors.success, title: 'Data Cleared', message: res.data.message || 'Selected data cleared.' });
            } catch (e: any) {
              showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: e.response?.data?.message || 'Clear failed.' });
            } finally { setSecurityBusy(false); }
          },
        },
      ],
    });
  }, [deleteMonth, deleteType, securityPassword, showDialog]);

  const totalExpenses = useMemo(() => expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0), [expenses]);
  const totalIncome = useMemo(() => incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0), [incomes]);
  const netProfit = totalIncome - totalExpenses;

  const stats = useMemo<StatItem[]>(() => [
    { id: 'income', label: 'Total Income', value: formatMoney(totalIncome), icon: 'trending-up-outline', tone: 'success' },
    { id: 'expense', label: 'Total Expenses', value: formatMoney(totalExpenses), icon: 'trending-down-outline', tone: 'danger' },
    { id: 'profit', label: 'Net Profit', value: formatMoney(netProfit), icon: 'analytics-outline', tone: netProfit >= 0 ? 'accent' : 'danger' },
  ], [netProfit, totalExpenses, totalIncome]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items = [
      ...expenses.map((item) => ({ id: `e-${item.id}`, amount: item.amount, label: item.category, description: item.description, date: item.date, created_by_name: item.created_by_name, direction: 'expense' as const, tone: CATEGORY_COLORS[item.category] || colors.textSubtle })),
      ...incomes.map((item) => ({ id: `i-${item.id}`, amount: item.amount, label: item.source || item.type, description: item.description, date: item.date, created_by_name: item.created_by_name, direction: 'income' as const, tone: colors.success })),
    ];
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, incomes]);

  const contentStyle = useMemo(() => [
    styles.content, {
      paddingHorizontal: layout.horizontalPadding, paddingTop: layout.contentTopPadding,
      paddingBottom: layout.contentBottomPadding, maxWidth: layout.maxContentWidth,
      alignSelf: layout.isTablet ? ('center' as const) : ('stretch' as const),
    },
  ], [layout.contentBottomPadding, layout.contentTopPadding, layout.horizontalPadding, layout.isTablet, layout.maxContentWidth]);

  const Header = useMemo(() => (
    <View style={styles.headerWrap}>
      <ScreenHeader title="Finance" subtitle="Expenses, income & analytics" />
      <SegmentedControl options={tabs} value={activeTab} onChange={setActiveTab} accessibilityLabel="Finance section" />
    </View>
  ), [activeTab, tabs]);

  if (activeTab === 'expense') {
    return (
      <ScreenBackground>
        <View style={styles.safeArea}>
          <FormScreen header={Header} contentStyle={contentStyle}>
            <FinanceField label="Amount"><TextInput style={styles.input} value={expenseAmount} onChangeText={setExpenseAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSubtle} /></FinanceField>
            <FinanceField label="Category"><ChoiceList data={CATEGORIES} selected={expenseCategory} onSelect={setExpenseCategory} /></FinanceField>
            <FinanceField label="Description"><TextInput style={[styles.input, styles.textArea]} value={expenseDescription} onChangeText={setExpenseDescription} multiline placeholder="Optional notes" placeholderTextColor={colors.textSubtle} /></FinanceField>
            <FinanceField label="Date"><TextInput style={styles.input} value={expenseDate} onChangeText={setExpenseDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSubtle} /></FinanceField>
            <PrimaryButton label="Log Expense" onPress={handleSaveExpense} loading={savingExpense} icon="remove-circle-outline" />
          </FormScreen>
          <DialogPortal />
        </View>
      </ScreenBackground>
    );
  }

  if (activeTab === 'income' && isAdmin) {
    return (
      <ScreenBackground>
        <View style={styles.safeArea}>
          <IncomeScreen header={Header} contentStyle={contentStyle} incomes={incomes} amount={incomeAmount} incomeType={incomeType} source={incomeSource} description={incomeDescription} date={incomeDate} saving={savingIncome} columns={layout.columns} onAmountChange={setIncomeAmount} onTypeChange={setIncomeType} onSourceChange={setIncomeSource} onDescriptionChange={setIncomeDescription} onDateChange={setIncomeDate} onSave={handleSaveIncome} onDelete={handleDeleteIncome} />
          <DialogPortal />
        </View>
      </ScreenBackground>
    );
  }

  if (activeTab === 'analytics' && isAdmin) {
    return (
      <ScreenBackground>
        <View style={styles.safeArea}>
          <AnalyticsScreen header={Header} contentStyle={contentStyle} kpis={kpis} customers={customers} loading={analyticsLoading} search={customerSearch} columns={layout.columns} onSearchChange={setCustomerSearch} onRefresh={handleRefresh} />
          <DialogPortal />
        </View>
      </ScreenBackground>
    );
  }

  if (activeTab === 'security' && isAdmin) {
    return (
      <ScreenBackground>
        <View style={styles.safeArea}>
          <FormScreen header={Header} contentStyle={contentStyle}>
            <View style={styles.securityNotice}><Ionicons name="warning-outline" size={20} color={colors.danger} /><Text style={styles.securityNoticeText}>These actions affect server data permanently. Create a backup first.</Text></View>
            <FinanceField label="Admin Password"><TextInput style={styles.input} value={securityPassword} onChangeText={setSecurityPassword} secureTextEntry placeholder="Required" placeholderTextColor={colors.textSubtle} /></FinanceField>
            <PrimaryButton label="Generate Backup" onPress={handleBackup} loading={securityBusy} icon="cloud-download-outline" />
            <FinanceField label="Deletion Type"><SegmentedControl options={[{ id: 'month' as DeleteType, label: 'Month', icon: 'calendar-outline' }, { id: 'full' as DeleteType, label: 'Full', icon: 'trash-outline' }]} value={deleteType} onChange={setDeleteType} accessibilityLabel="Deletion type" /></FinanceField>
            {deleteType === 'month' && <FinanceField label="Month"><TextInput style={styles.input} value={deleteMonth} onChangeText={setDeleteMonth} placeholder="YYYY-MM" placeholderTextColor={colors.textSubtle} /></FinanceField>}
            <PrimaryButton label="Clear Selected Data" onPress={handleClearData} loading={securityBusy} icon="trash-outline" danger />
          </FormScreen>
          <DialogPortal />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <View style={styles.safeArea}>
        <OverviewScreen header={Header} contentStyle={contentStyle} stats={stats} timeline={timeline} loading={loading} refreshing={refreshing} columns={layout.columns} startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} onRefresh={handleRefresh} />
        <DialogPortal />
      </View>
    </ScreenBackground>
  );
}

// --- Form Screen ---
const FormScreen = memo(function FormScreen({ header, contentStyle, children }: { header: React.ReactElement; contentStyle: object; children: React.ReactNode }) {
  const data = useMemo(() => [{ id: 'form' }], []);
  const keyExtractor = useCallback((item: { id: string }) => item.id, []);
  const renderItem = useCallback(() => <View style={styles.formPanel}>{children}</View>, [children]);
  return <FlatList data={data} keyExtractor={keyExtractor} renderItem={renderItem} ListHeaderComponent={header} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} {...LIST_CONFIG} />;
});

const FinanceField = memo(function FinanceField({ label, children }: { label: string; children: React.ReactNode }) {
  return (<View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>);
});

const ChoiceList = memo(function ChoiceList({ data, selected, onSelect }: { data: string[]; selected: string; onSelect: (v: string) => void }) {
  const keyExtractor = useCallback((item: string) => item, []);
  const renderItem: ListRenderItem<string> = useCallback(({ item }) => <ChoiceChip item={item} selected={selected === item} onSelect={onSelect} />, [onSelect, selected]);
  return <FlatList horizontal data={data} keyExtractor={keyExtractor} renderItem={renderItem} contentContainerStyle={styles.horizontalList} showsHorizontalScrollIndicator={false} {...TEXT_LIST_CONFIG} />;
});

const ChoiceChip = memo(function ChoiceChip({ item, selected, onSelect }: { item: string; selected: boolean; onSelect: (v: string) => void }) {
  const handlePress = useCallback(() => onSelect(item), [item, onSelect]);
  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.choiceChip, selected && styles.choiceChipActive, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Select ${item}`}>
      <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{item.replace(/_/g, ' ')}</Text>
    </Pressable>
  );
});

// --- Overview ---
const OverviewScreen = memo(function OverviewScreen({ header, contentStyle, stats, timeline, loading, refreshing, columns, startDate, endDate, onStartDateChange, onEndDateChange, onRefresh }: { header: React.ReactElement; contentStyle: object; stats: StatItem[]; timeline: TimelineItem[]; loading: boolean; refreshing: boolean; columns: number; startDate: string; endDate: string; onStartDateChange: (v: string) => void; onEndDateChange: (v: string) => void; onRefresh: () => void }) {
  const keyExtractor = useCallback((item: TimelineItem) => item.id, []);
  const renderItem: ListRenderItem<TimelineItem> = useCallback(({ item }) => <TimelineCard item={item} columns={columns} />, [columns]);
  const columnWrapperStyle = useMemo(() => (columns > 1 ? styles.columnWrapper : undefined), [columns]);
  const ListHeader = useMemo(() => (
    <View>{header}<View style={styles.dateRow}><TextInput style={styles.dateInput} value={startDate} onChangeText={onStartDateChange} placeholder="Start" placeholderTextColor={colors.textSubtle} /><TextInput style={styles.dateInput} value={endDate} onChangeText={onEndDateChange} placeholder="End" placeholderTextColor={colors.textSubtle} /></View><StatGrid data={stats} columns={columns} /><SectionTitle title="Timeline" subtitle="Income & expense activity" /></View>
  ), [columns, endDate, header, onEndDateChange, onStartDateChange, startDate, stats]);
  const Empty = useMemo(() => loading ? <StateBlock loading title="Loading records" /> : <StateBlock title="No records" message="Try another date range." icon="receipt-outline" />, [loading]);
  return <FlatList key={`fin-${columns}`} data={loading ? [] : timeline} numColumns={columns} keyExtractor={keyExtractor} renderItem={renderItem} columnWrapperStyle={columnWrapperStyle} ListHeaderComponent={ListHeader} ListEmptyComponent={Empty} contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />} {...LIST_CONFIG} />;
});

const TimelineCard = memo(function TimelineCard({ item, columns }: { item: TimelineItem; columns: number }) {
  const flexStyle = useMemo(() => ({ flex: columns > 1 ? 1 : undefined }), [columns]);
  const isIncome = item.direction === 'income';
  return (
    <View style={[styles.recordCard, flexStyle]}>
      <View style={[styles.toneBar, { backgroundColor: item.tone }]} />
      <View style={styles.recordBody}>
        <View style={styles.recordTop}>
          <View style={styles.recordCopy}>
            <Text style={styles.recordTitle} numberOfLines={1}>{item.label.replace(/_/g, ' ')}</Text>
            <Text style={styles.recordMeta} numberOfLines={1}>{item.description || `By ${item.created_by_name}`}</Text>
          </View>
          <Text style={[styles.recordAmount, isIncome ? styles.incomeText : styles.expenseText]}>{isIncome ? '+' : '-'}{formatMoney(item.amount)}</Text>
        </View>
        <Text style={styles.recordDate}>{formatDate(item.date)}</Text>
      </View>
    </View>
  );
});

// --- Income ---
const IncomeScreen = memo(function IncomeScreen({ header, contentStyle, incomes, amount, incomeType, source, description, date, saving, columns, onAmountChange, onTypeChange, onSourceChange, onDescriptionChange, onDateChange, onSave, onDelete }: { header: React.ReactElement; contentStyle: object; incomes: Income[]; amount: string; incomeType: IncomeType; source: string; description: string; date: string; saving: boolean; columns: number; onAmountChange: (v: string) => void; onTypeChange: (v: IncomeType) => void; onSourceChange: (v: string) => void; onDescriptionChange: (v: string) => void; onDateChange: (v: string) => void; onSave: () => void; onDelete: (id: number) => void }) {
  const keyExtractor = useCallback((item: Income) => item.id.toString(), []);
  const renderItem: ListRenderItem<Income> = useCallback(({ item }) => <IncomeRecord item={item} columns={columns} onDelete={onDelete} />, [columns, onDelete]);
  const columnWrapperStyle = useMemo(() => (columns > 1 ? styles.columnWrapper : undefined), [columns]);
  const Header = useMemo(() => (
    <View>{header}<View style={styles.formPanel}>
      <FinanceField label="Amount"><TextInput style={styles.input} value={amount} onChangeText={onAmountChange} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSubtle} /></FinanceField>
      <FinanceField label="Type"><SegmentedControl options={[{ id: 'in_hand' as IncomeType, label: 'Cash', icon: 'cash-outline' }, { id: 'account' as IncomeType, label: 'Account', icon: 'card-outline' }]} value={incomeType} onChange={onTypeChange} accessibilityLabel="Income type" /></FinanceField>
      <FinanceField label="Source"><ChoiceList data={SOURCES} selected={source} onSelect={onSourceChange} /></FinanceField>
      <FinanceField label="Description"><TextInput style={styles.input} value={description} onChangeText={onDescriptionChange} placeholder="Optional" placeholderTextColor={colors.textSubtle} /></FinanceField>
      <FinanceField label="Date"><TextInput style={styles.input} value={date} onChangeText={onDateChange} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSubtle} /></FinanceField>
      <PrimaryButton label="Add Income" onPress={onSave} loading={saving} icon="add-circle-outline" />
    </View><SectionTitle title="Income Records" /></View>
  ), [amount, date, description, header, incomeType, onAmountChange, onDateChange, onDescriptionChange, onSave, onSourceChange, onTypeChange, saving, source]);
  return <FlatList key={`inc-${columns}`} data={incomes} numColumns={columns} keyExtractor={keyExtractor} renderItem={renderItem} columnWrapperStyle={columnWrapperStyle} ListHeaderComponent={Header} ListEmptyComponent={<StateBlock title="No income records" icon="cash-outline" />} contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false} {...LIST_CONFIG} />;
});

const IncomeRecord = memo(function IncomeRecord({ item, columns, onDelete }: { item: Income; columns: number; onDelete: (id: number) => void }) {
  const flexStyle = useMemo(() => ({ flex: columns > 1 ? 1 : undefined }), [columns]);
  const handleDelete = useCallback(() => onDelete(item.id), [item.id, onDelete]);
  return (
    <View style={[styles.recordCard, flexStyle]}>
      <View style={[styles.toneBar, { backgroundColor: colors.success }]} />
      <View style={styles.recordBody}>
        <View style={styles.recordTop}>
          <View style={styles.recordCopy}><Text style={styles.recordTitle}>{item.source.replace(/_/g, ' ')}</Text><Text style={styles.recordMeta}>{item.type === 'in_hand' ? 'Cash' : 'Account'} · {formatDate(item.date)}</Text></View>
          <Text style={[styles.recordAmount, styles.incomeText]}>{formatMoney(item.amount)}</Text>
        </View>
        <Pressable onPress={handleDelete} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Delete income">
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
});

// --- Analytics ---
const AnalyticsScreen = memo(function AnalyticsScreen({ header, contentStyle, kpis, customers, loading, search, columns, onSearchChange, onRefresh }: { header: React.ReactElement; contentStyle: object; kpis: CustomerKpis | null; customers: Customer[]; loading: boolean; search: string; columns: number; onSearchChange: (v: string) => void; onRefresh: () => void }) {
  const stats = useMemo<StatItem[]>(() => [
    { id: 'tracked', label: 'Tracked', value: String(kpis?.total_tracked || 0), icon: 'people-outline', tone: 'info' },
    { id: 'repeat', label: 'Repeat', value: String(kpis?.repeat_customers || 0), icon: 'repeat-outline', tone: 'success' },
    { id: 'revenue', label: 'Revenue', value: formatMoney(kpis?.total_revenue || 0), icon: 'cash-outline', tone: 'accent' },
    { id: 'risk', label: 'At Risk', value: String(kpis?.at_risk_customers || 0), icon: 'warning-outline', tone: 'warning' },
  ], [kpis]);
  const keyExtractor = useCallback((item: Customer) => item.customer_mobile, []);
  const renderItem: ListRenderItem<Customer> = useCallback(({ item }) => <CustomerCard item={item} columns={columns} />, [columns]);
  const columnWrapperStyle = useMemo(() => (columns > 1 ? styles.columnWrapper : undefined), [columns]);
  const Header = useMemo(() => (
    <View>{header}<TextInput style={styles.input} value={search} onChangeText={onSearchChange} placeholder="Search mobile" placeholderTextColor={colors.textSubtle} /><View style={styles.analyticsStats}><StatGrid data={stats} columns={columns > 1 ? columns : 2} /></View><SectionTitle title="Tracked Customers" /></View>
  ), [columns, header, onSearchChange, search, stats]);
  const Empty = useMemo(() => loading ? <StateBlock loading title="Loading customers" /> : <StateBlock title="No customers found" icon="people-outline" />, [loading]);
  return <FlatList key={`cust-${columns}`} data={loading ? [] : customers} numColumns={columns} keyExtractor={keyExtractor} renderItem={renderItem} columnWrapperStyle={columnWrapperStyle} ListHeaderComponent={Header} ListEmptyComponent={Empty} contentContainerStyle={contentStyle} refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.accent} />} showsVerticalScrollIndicator={false} {...LIST_CONFIG} />;
});

const CustomerCard = memo(function CustomerCard({ item, columns }: { item: Customer; columns: number }) {
  const flexStyle = useMemo(() => ({ flex: columns > 1 ? 1 : undefined }), [columns]);
  return (
    <View style={[styles.simpleCard, flexStyle]}>
      <Text style={styles.recordTitle}>{item.customer_mobile}</Text>
      <Text style={styles.recordMeta}>{item.visit_count} visits · Avg {formatMoney(item.avg_spend)}</Text>
      <Text style={[styles.recordAmount, styles.incomeText]}>{formatMoney(item.total_spent)}</Text>
      <Text style={styles.recordDate}>Last visit {formatDate(item.last_visit)}</Text>
      {!!item.preferred_types && <Text style={styles.recordMeta}>{item.preferred_types}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { flexGrow: 1, width: '100%', paddingTop: spacing.lg, paddingBottom: 80 },
  headerWrap: { marginBottom: spacing.lg },
  formPanel: { borderRadius: radii.card, backgroundColor: colors.surfaceGlass, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder, padding: spacing.md, gap: spacing.md, ...shadows.subtle },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  input: { minHeight: 44, borderRadius: radii.sm, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: spacing.md, fontSize: typography.bodyLarge },
  textArea: { minHeight: 76, paddingTop: spacing.md, textAlignVertical: 'top' },
  horizontalList: { gap: spacing.sm, paddingRight: spacing.lg },
  choiceChip: { minHeight: 38, borderRadius: radii.card, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder, paddingHorizontal: spacing.md, justifyContent: 'center' },
  choiceChipActive: { backgroundColor: colors.accentGlass, borderColor: colors.accentBorder },
  choiceText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700', textTransform: 'capitalize' },
  choiceTextActive: { color: colors.accent },
  dateRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  dateInput: { flex: 1, minHeight: 42, borderRadius: radii.sm, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: spacing.md, fontSize: typography.caption },
  columnWrapper: { gap: spacing.sm },
  recordCard: { borderRadius: radii.card, backgroundColor: colors.surfaceGlass, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder, marginBottom: spacing.sm, flexDirection: 'row', overflow: 'hidden', ...shadows.subtle },
  toneBar: { width: 4 },
  recordBody: { flex: 1, padding: spacing.md },
  recordTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  recordCopy: { flex: 1, minWidth: 0 },
  recordTitle: { color: colors.text, fontSize: typography.bodyLarge, fontWeight: '800', textTransform: 'capitalize' },
  recordMeta: { color: colors.textSubtle, fontSize: typography.eyebrow, marginTop: 1 },
  recordAmount: { fontSize: typography.bodyLarge, fontWeight: '800' },
  incomeText: { color: colors.success },
  expenseText: { color: colors.danger },
  recordDate: { color: colors.textSubtle, fontSize: typography.eyebrow, marginTop: spacing.xs },
  simpleCard: { borderRadius: radii.card, backgroundColor: colors.surfaceGlass, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder, padding: spacing.md, marginBottom: spacing.sm, gap: 2, ...shadows.subtle },
  deleteButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerSoft, marginTop: spacing.sm, alignSelf: 'flex-end' },
  analyticsStats: { marginTop: spacing.sm },
  securityNotice: { borderRadius: radii.card, backgroundColor: colors.dangerSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.danger, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  securityNoticeText: { flex: 1, color: colors.text, fontSize: typography.caption, lineHeight: 17, fontWeight: '700' },
  pressed: { opacity: animation.press.opacity, transform: [{ scale: animation.press.scale }] },
});
