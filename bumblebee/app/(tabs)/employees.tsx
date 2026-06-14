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
import { formatDate, formatMoney, formatTime, thisMonthValue, todayIsoDate } from '../../utils/format';

type EmployeeTab = 'attendance' | 'team' | 'hours' | 'salary';
type Role = 'admin' | 'employee';

type AttendanceRecord = { id: number; user_id: number; name: string; clock_in: string; clock_out: string | null; total_hours: string | null };
type TeamMember = { id: number; name: string; phone: string; role: Role; salary: number; is_active: number; att_id?: number | null; clock_in?: string | null };
type WorkingHour = { id: number; name: string; role: Role; total_hours: string; days_present: number };
type SalaryHistory = { id: number; user_id: number; name: string; amount: string; month: string; paid_date: string; notes: string | null };

const BASE_TABS: SegmentOption<EmployeeTab>[] = [{ id: 'attendance', label: 'Attendance', icon: 'calendar-outline' }];
const ADMIN_TABS: SegmentOption<EmployeeTab>[] = [
  { id: 'team', label: 'Team', icon: 'people-outline' },
  { id: 'hours', label: 'Hours', icon: 'time-outline' },
  { id: 'salary', label: 'Salary', icon: 'cash-outline' },
];

const ROLES: SegmentOption<Role>[] = [
  { id: 'employee', label: 'Employee', icon: 'person-outline' },
  { id: 'admin', label: 'Admin', icon: 'shield-outline' },
];

export default function EmployeesScreen() {
  const { user, isAdmin } = useAuth();
  const layout = useDeviceLayout();
  const { showDialog, DialogPortal } = useDialog();
  const [activeTab, setActiveTab] = useState<EmployeeTab>('attendance');
  const [attendanceDate, setAttendanceDate] = useState(todayIsoDate);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('employee');
  const [newSalary, setNewSalary] = useState('');
  const [savingEmployee, setSavingEmployee] = useState(false);

  const [hoursStart, setHoursStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [hoursEnd, setHoursEnd] = useState(todayIsoDate);

  const [salaryUserId, setSalaryUserId] = useState<number | null>(null);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryMonth, setSalaryMonth] = useState(thisMonthValue);
  const [salaryDate, setSalaryDate] = useState(todayIsoDate);
  const [salaryNotes, setSalaryNotes] = useState('');
  const [payingSalary, setPayingSalary] = useState(false);

  const tabs = useMemo(() => (isAdmin ? [...BASE_TABS, ...ADMIN_TABS] : BASE_TABS), [isAdmin]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get(`/employees/attendance?startDate=${attendanceDate}&endDate=${attendanceDate}`); setAttendance(res.data); }
    catch { showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to load attendance.' }); }
    finally { setLoading(false); setRefreshing(false); }
  }, [attendanceDate, showDialog]);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get('/employees'); setTeam(res.data); }
    catch { showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to load team.' }); }
    finally { setLoading(false); setRefreshing(false); }
  }, [showDialog]);

  const loadHours = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get(`/employees/working-hours?startDate=${hoursStart}&endDate=${hoursEnd}`); setHours(res.data); }
    catch { showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to load working hours.' }); }
    finally { setLoading(false); setRefreshing(false); }
  }, [hoursEnd, hoursStart, showDialog]);

  const loadSalary = useCallback(async () => {
    setLoading(true);
    try {
      const [empsRes, histRes] = await Promise.all([api.get('/employees'), api.get('/employees/salary-history')]);
      const active = empsRes.data.filter((m: TeamMember) => m.is_active);
      setTeam(active); setSalaryHistory(histRes.data);
      const first = active[0];
      if (!salaryUserId && first) { setSalaryUserId(first.id); setSalaryAmount(String(first.salary || '')); }
    } catch { showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to load salary data.' }); }
    finally { setLoading(false); setRefreshing(false); }
  }, [salaryUserId, showDialog]);

  useEffect(() => {
    if (activeTab === 'attendance') loadAttendance();
    if (activeTab === 'team') loadTeam();
    if (activeTab === 'hours') loadHours();
    if (activeTab === 'salary') loadSalary();
  }, [activeTab, loadAttendance, loadHours, loadSalary, loadTeam]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (activeTab === 'attendance') loadAttendance();
    if (activeTab === 'team') loadTeam();
    if (activeTab === 'hours') loadHours();
    if (activeTab === 'salary') loadSalary();
  }, [activeTab, loadAttendance, loadHours, loadSalary, loadTeam]);

  const handleCheckInUser = useCallback(async (id: number, name = 'You') => {
    setActionId(id);
    try {
      await api.post('/employees/check-in', { user_id: id });
      showDialog({ icon: 'checkmark-circle-outline', iconColor: colors.success, title: 'Checked In', message: `${name} checked in.` });
      if (activeTab === 'team') loadTeam(); else loadAttendance();
    } catch (e: any) {
      showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: e.response?.data?.message || 'Failed to check in.' });
    } finally { setActionId(null); }
  }, [activeTab, loadAttendance, loadTeam, showDialog]);

  const handleCheckOutUser = useCallback(async (id: number, name = 'You') => {
    setActionId(id);
    try {
      const res = await api.post('/employees/check-out', { user_id: id });
      showDialog({ icon: 'checkmark-circle-outline', iconColor: colors.success, title: 'Checked Out', message: `${name} checked out. Total: ${res.data.hours}h.` });
      if (activeTab === 'team') loadTeam(); else loadAttendance();
    } catch (e: any) {
      showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: e.response?.data?.message || 'Failed to check out.' });
    } finally { setActionId(null); }
  }, [activeTab, loadAttendance, loadTeam, showDialog]);

  const handleAddEmployee = useCallback(async () => {
    if (!newName || !newPhone || !newPassword) {
      showDialog({ icon: 'alert-circle-outline', iconColor: colors.warning, title: 'Missing Details', message: 'Name, phone, and password required.' }); return;
    }
    setSavingEmployee(true);
    try {
      await api.post('/employees', { name: newName, phone: newPhone, password: newPassword, role: newRole, salary: Number(newSalary || 0) });
      setNewName(''); setNewPhone(''); setNewPassword(''); setNewSalary(''); setNewRole('employee'); loadTeam();
    } catch (e: any) {
      showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: e.response?.data?.message || 'Failed to add employee.' });
    } finally { setSavingEmployee(false); }
  }, [loadTeam, newName, newPassword, newPhone, newRole, newSalary, showDialog]);

  const handleRemoveEmployee = useCallback((member: TeamMember) => {
    showDialog({
      icon: 'person-remove-outline', iconColor: colors.danger, title: 'Remove Employee', message: `Remove ${member.name} from the team?`,
      actions: [
        { label: 'Cancel', tone: 'cancel' },
        { label: 'Remove', tone: 'danger', onPress: async () => { try { await api.delete(`/employees/${member.id}`); loadTeam(); } catch { showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to remove employee.' }); } } },
      ],
    });
  }, [loadTeam, showDialog]);

  const handleSalarySelect = useCallback((id: number) => {
    const member = team.find((m) => m.id === id);
    setSalaryUserId(id); setSalaryAmount(String(member?.salary || ''));
  }, [team]);

  const handlePaySalary = useCallback(async () => {
    if (!salaryUserId || !salaryAmount || !salaryMonth) {
      showDialog({ icon: 'alert-circle-outline', iconColor: colors.warning, title: 'Missing Details', message: 'Employee, amount, and month required.' }); return;
    }
    setPayingSalary(true);
    try {
      await api.post('/employees/salary-pay', { user_id: salaryUserId, amount: Number(salaryAmount), month: salaryMonth, paid_date: salaryDate, notes: salaryNotes || null });
      setSalaryNotes(''); loadSalary();
    } catch (e: any) {
      showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: e.response?.data?.message || 'Failed to pay salary.' });
    } finally { setPayingSalary(false); }
  }, [loadSalary, salaryAmount, salaryDate, salaryMonth, salaryNotes, salaryUserId, showDialog]);

  const handleSalaryUpdate = useCallback(async (id: number, salary: string) => {
    try { await api.put(`/employees/${id}/salary`, { salary: Number(salary || 0) }); loadSalary(); }
    catch { showDialog({ icon: 'warning-outline', iconColor: colors.danger, title: 'Error', message: 'Failed to update salary.' }); }
  }, [loadSalary, showDialog]);

  const contentStyle = useMemo(() => [
    styles.content, {
      paddingHorizontal: layout.horizontalPadding, paddingTop: layout.contentTopPadding,
      paddingBottom: layout.contentBottomPadding, maxWidth: layout.maxContentWidth,
      alignSelf: layout.isTablet ? ('center' as const) : ('stretch' as const),
    },
  ], [layout.contentBottomPadding, layout.contentTopPadding, layout.horizontalPadding, layout.isTablet, layout.maxContentWidth]);

  const Header = useMemo(() => (
    <View style={styles.headerWrap}>
      <ScreenHeader title="Team" subtitle="Attendance, staff & salary" />
      <SegmentedControl options={tabs} value={activeTab} onChange={setActiveTab} accessibilityLabel="Employee section" />
    </View>
  ), [activeTab, tabs]);

  const renderScreen = () => {
    if (activeTab === 'team' && isAdmin) {
      return <TeamScreen header={Header} contentStyle={contentStyle} team={team} userId={user?.id} loading={loading} refreshing={refreshing} actionId={actionId} columns={layout.columns} newName={newName} newPhone={newPhone} newPassword={newPassword} newRole={newRole} newSalary={newSalary} savingEmployee={savingEmployee} onRefresh={handleRefresh} onCheckIn={handleCheckInUser} onCheckOut={handleCheckOutUser} onRemove={handleRemoveEmployee} onNewNameChange={setNewName} onNewPhoneChange={setNewPhone} onNewPasswordChange={setNewPassword} onNewRoleChange={setNewRole} onNewSalaryChange={setNewSalary} onAddEmployee={handleAddEmployee} />;
    }
    if (activeTab === 'hours' && isAdmin) {
      return <HoursScreen header={Header} contentStyle={contentStyle} hours={hours} loading={loading} refreshing={refreshing} columns={layout.columns} startDate={hoursStart} endDate={hoursEnd} onStartChange={setHoursStart} onEndChange={setHoursEnd} onRefresh={handleRefresh} />;
    }
    if (activeTab === 'salary' && isAdmin) {
      return <SalaryScreen header={Header} contentStyle={contentStyle} team={team} history={salaryHistory} loading={loading} refreshing={refreshing} columns={layout.columns} selectedUserId={salaryUserId} amount={salaryAmount} month={salaryMonth} date={salaryDate} notes={salaryNotes} paying={payingSalary} onRefresh={handleRefresh} onEmployeeSelect={handleSalarySelect} onAmountChange={setSalaryAmount} onMonthChange={setSalaryMonth} onDateChange={setSalaryDate} onNotesChange={setSalaryNotes} onPay={handlePaySalary} onSalaryUpdate={handleSalaryUpdate} />;
    }

    const myRecord = attendance.find((r) => r.user_id === user?.id);
    const checkedIn = !!myRecord && !myRecord.clock_out;
    return <AttendanceScreen header={Header} contentStyle={contentStyle} records={attendance} loading={loading} refreshing={refreshing} actionLoading={actionId === user?.id} columns={layout.columns} date={attendanceDate} checkedIn={checkedIn} hasRecord={!!myRecord} onDateChange={setAttendanceDate} onRefresh={handleRefresh} onCheckIn={() => user && handleCheckInUser(user.id)} onCheckOut={() => user && handleCheckOutUser(user.id)} />;
  };

  return (
    <ScreenBackground>
      <View style={styles.safeArea}>
        {renderScreen()}
        <DialogPortal />
      </View>
    </ScreenBackground>
  );
}

// --- Attendance ---
const AttendanceScreen = memo(function AttendanceScreen({ header, contentStyle, records, loading, refreshing, actionLoading, columns, date, checkedIn, hasRecord, onDateChange, onRefresh, onCheckIn, onCheckOut }: { header: React.ReactElement; contentStyle: object; records: AttendanceRecord[]; loading: boolean; refreshing: boolean; actionLoading: boolean; columns: number; date: string; checkedIn: boolean; hasRecord: boolean; onDateChange: (v: string) => void; onRefresh: () => void; onCheckIn: () => void; onCheckOut: () => void }) {
  const keyExtractor = useCallback((item: AttendanceRecord) => item.id.toString(), []);
  const renderItem: ListRenderItem<AttendanceRecord> = useCallback(({ item }) => <AttendanceCard item={item} columns={columns} />, [columns]);
  const columnWrapperStyle = useMemo(() => (columns > 1 ? styles.columnWrapper : undefined), [columns]);
  const ListHeader = useMemo(() => (
    <View>
      {header}
      <View style={styles.statusCard}>
        <View style={[styles.statusDot, { backgroundColor: checkedIn ? colors.success : hasRecord ? colors.textSubtle : colors.warning }]} />
        <View style={styles.statusCopy}>
          <Text style={styles.statusTitle}>{checkedIn ? 'Clocked In' : hasRecord ? 'Shift Done' : 'Not Clocked In'}</Text>
        </View>
        {actionLoading ? <ActivityIndicator color={colors.accent} /> :
          !hasRecord ? <IconButton icon="log-in-outline" label="Clock in" onPress={onCheckIn} tone="accent" size={36} /> :
          checkedIn ? <IconButton icon="log-out-outline" label="Clock out" onPress={onCheckOut} tone="danger" size={36} /> : null}
      </View>
      <View style={styles.dateRow}>
        <TextInput style={styles.dateInput} value={date} onChangeText={onDateChange} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSubtle} />
        <Text style={styles.countBadge}>{records.length} records</Text>
      </View>
    </View>
  ), [actionLoading, checkedIn, date, hasRecord, header, onCheckIn, onCheckOut, onDateChange, records.length]);
  const Empty = useMemo(() => loading ? <StateBlock loading title="Loading attendance" /> : <StateBlock title="No logs" message="Try another date." icon="calendar-outline" />, [loading]);
  return <FlatList key={`att-${columns}`} data={loading ? [] : records} numColumns={columns} keyExtractor={keyExtractor} renderItem={renderItem} columnWrapperStyle={columnWrapperStyle} ListHeaderComponent={ListHeader} ListEmptyComponent={Empty} contentContainerStyle={contentStyle} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />} showsVerticalScrollIndicator={false} {...LIST_CONFIG} />;
});

const AttendanceCard = memo(function AttendanceCard({ item, columns }: { item: AttendanceRecord; columns: number }) {
  const flexStyle = useMemo(() => ({ flex: columns > 1 ? 1 : undefined }), [columns]);
  const completed = !!item.clock_out;
  return (
    <View style={[styles.recordCard, flexStyle]}>
      <View style={styles.recordHeader}>
        <Text style={styles.recordTitle}>{item.name}</Text>
        <Badge label={completed ? 'Done' : 'Active'} tone={completed ? 'success' : 'warning'} />
      </View>
      <InfoLine label="In" value={formatTime(item.clock_in)} />
      <InfoLine label="Out" value={formatTime(item.clock_out)} />
      <InfoLine label="Hours" value={item.total_hours ? `${Number(item.total_hours).toFixed(1)}h` : '-'} accent />
    </View>
  );
});

// --- Team ---
const TeamScreen = memo(function TeamScreen(props: any) {
  const { header, contentStyle, team, userId, loading, refreshing, actionId, columns, newName, newPhone, newPassword, newRole, newSalary, savingEmployee, onRefresh, onCheckIn, onCheckOut, onRemove, onNewNameChange, onNewPhoneChange, onNewPasswordChange, onNewRoleChange, onNewSalaryChange, onAddEmployee } = props;
  const activeCount = useMemo(() => team.filter((m: TeamMember) => m.is_active).length, [team]);
  const clockedIn = useMemo(() => team.filter((m: TeamMember) => m.is_active && m.att_id).length, [team]);
  const stats = useMemo<StatItem[]>(() => [
    { id: 'active', label: 'Active', value: String(activeCount), icon: 'people-outline', tone: 'success' },
    { id: 'clocked', label: 'Clocked In', value: String(clockedIn), icon: 'log-in-outline', tone: 'accent' },
    { id: 'total', label: 'Total', value: String(team.length), icon: 'person-outline', tone: 'info' },
  ], [activeCount, clockedIn, team.length]);
  const keyExtractor = useCallback((item: TeamMember) => item.id.toString(), []);
  const renderItem: ListRenderItem<TeamMember> = useCallback(({ item }) => <TeamCard item={item} columns={columns} userId={userId} actionId={actionId} onCheckIn={onCheckIn} onCheckOut={onCheckOut} onRemove={onRemove} />, [actionId, columns, onCheckIn, onCheckOut, onRemove, userId]);
  const columnWrapperStyle = useMemo(() => (columns > 1 ? styles.columnWrapper : undefined), [columns]);
  const ListHeader = useMemo(() => (
    <View>
      {header}
      <StatGrid data={stats} columns={columns > 1 ? columns : 3} />
      <SectionTitle title="Add Employee" />
      <View style={styles.formPanel}>
        <TextInput style={styles.input} value={newName} onChangeText={onNewNameChange} placeholder="Full name" placeholderTextColor={colors.textSubtle} />
        <TextInput style={styles.input} value={newPhone} onChangeText={onNewPhoneChange} placeholder="Phone" placeholderTextColor={colors.textSubtle} keyboardType="phone-pad" />
        <TextInput style={styles.input} value={newPassword} onChangeText={onNewPasswordChange} placeholder="Password" placeholderTextColor={colors.textSubtle} secureTextEntry />
        <SegmentedControl options={ROLES} value={newRole} onChange={onNewRoleChange} accessibilityLabel="Employee role" />
        <TextInput style={styles.input} value={newSalary} onChangeText={onNewSalaryChange} placeholder="Monthly salary" placeholderTextColor={colors.textSubtle} keyboardType="numeric" />
        <PrimaryButton label="Add Employee" onPress={onAddEmployee} loading={savingEmployee} icon="person-add-outline" />
      </View>
      <SectionTitle title="Team Members" />
    </View>
  ), [columns, header, newName, newPassword, newPhone, newRole, newSalary, onAddEmployee, onNewNameChange, onNewPasswordChange, onNewPhoneChange, onNewRoleChange, onNewSalaryChange, savingEmployee, stats]);
  const Empty = useMemo(() => loading ? <StateBlock loading title="Loading team" /> : <StateBlock title="No team members" icon="people-outline" />, [loading]);
  return <FlatList key={`team-${columns}`} data={loading ? [] : team} numColumns={columns} keyExtractor={keyExtractor} renderItem={renderItem} columnWrapperStyle={columnWrapperStyle} ListHeaderComponent={ListHeader} ListEmptyComponent={Empty} contentContainerStyle={contentStyle} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />} showsVerticalScrollIndicator={false} {...LIST_CONFIG} />;
});

const TeamCard = memo(function TeamCard({ item, columns, userId, actionId, onCheckIn, onCheckOut, onRemove }: { item: TeamMember; columns: number; userId?: number; actionId: number | null; onCheckIn: (id: number, name: string) => void; onCheckOut: (id: number, name: string) => void; onRemove: (m: TeamMember) => void }) {
  const flexStyle = useMemo(() => ({ flex: columns > 1 ? 1 : undefined }), [columns]);
  const checkedIn = !!item.att_id;
  const isLoading = actionId === item.id;
  const handleCheckIn = useCallback(() => onCheckIn(item.id, item.name), [item.id, item.name, onCheckIn]);
  const handleCheckOut = useCallback(() => onCheckOut(item.id, item.name), [item.id, item.name, onCheckOut]);
  const handleRemove = useCallback(() => onRemove(item), [item, onRemove]);
  return (
    <View style={[styles.recordCard, flexStyle]}>
      <View style={styles.recordHeader}>
        <View style={styles.recordCopy}><Text style={styles.recordTitle}>{item.name}</Text><Text style={styles.recordMeta}>{item.phone}</Text></View>
        <Badge label={item.role} tone={item.role === 'admin' ? 'warning' : 'info'} />
      </View>
      <InfoLine label="Salary" value={formatMoney(item.salary)} />
      <InfoLine label="Status" value={checkedIn ? `In since ${formatTime(item.clock_in)}` : item.is_active ? 'Not clocked in' : 'Inactive'} accent={checkedIn} />
      <View style={styles.actionRow}>
        {item.is_active ? (checkedIn ? <PrimaryButton label="Out" onPress={handleCheckOut} loading={isLoading} icon="log-out-outline" /> : <PrimaryButton label="In" onPress={handleCheckIn} loading={isLoading} icon="log-in-outline" />) : null}
        {item.id !== userId && <IconButton icon="trash-outline" label="Remove" onPress={handleRemove} tone="danger" size={34} />}
      </View>
    </View>
  );
});

// --- Hours ---
const HoursScreen = memo(function HoursScreen({ header, contentStyle, hours, loading, refreshing, columns, startDate, endDate, onStartChange, onEndChange, onRefresh }: { header: React.ReactElement; contentStyle: object; hours: WorkingHour[]; loading: boolean; refreshing: boolean; columns: number; startDate: string; endDate: string; onStartChange: (v: string) => void; onEndChange: (v: string) => void; onRefresh: () => void }) {
  const keyExtractor = useCallback((item: WorkingHour) => item.id.toString(), []);
  const renderItem: ListRenderItem<WorkingHour> = useCallback(({ item }) => <HoursCard item={item} columns={columns} />, [columns]);
  const columnWrapperStyle = useMemo(() => (columns > 1 ? styles.columnWrapper : undefined), [columns]);
  const Header = useMemo(() => (<View>{header}<View style={styles.dateRow}><TextInput style={styles.dateInput} value={startDate} onChangeText={onStartChange} placeholder="Start" placeholderTextColor={colors.textSubtle} /><TextInput style={styles.dateInput} value={endDate} onChangeText={onEndChange} placeholder="End" placeholderTextColor={colors.textSubtle} /></View></View>), [endDate, header, onEndChange, onStartChange, startDate]);
  return <FlatList key={`hrs-${columns}`} data={loading ? [] : hours} numColumns={columns} keyExtractor={keyExtractor} renderItem={renderItem} columnWrapperStyle={columnWrapperStyle} ListHeaderComponent={Header} ListEmptyComponent={loading ? <StateBlock loading title="Loading hours" /> : <StateBlock title="No hours found" icon="time-outline" />} contentContainerStyle={contentStyle} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />} showsVerticalScrollIndicator={false} {...LIST_CONFIG} />;
});

const HoursCard = memo(function HoursCard({ item, columns }: { item: WorkingHour; columns: number }) {
  const flexStyle = useMemo(() => ({ flex: columns > 1 ? 1 : undefined }), [columns]);
  const h = Number(item.total_hours || 0);
  const d = Number(item.days_present || 0);
  return (
    <View style={[styles.recordCard, flexStyle]}>
      <Text style={styles.recordTitle}>{item.name}</Text>
      <InfoLine label="Hours" value={`${h.toFixed(1)}h`} accent />
      <InfoLine label="Days" value={String(d)} />
      <InfoLine label="Avg/Day" value={`${d > 0 ? (h / d).toFixed(1) : '0.0'}h`} />
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, h)}%` }]} /></View>
    </View>
  );
});

// --- Salary ---
const SalaryScreen = memo(function SalaryScreen(props: any) {
  const { header, contentStyle, team, history, loading, refreshing, columns, selectedUserId, amount, month, date, notes, paying, onRefresh, onEmployeeSelect, onAmountChange, onMonthChange, onDateChange, onNotesChange, onPay, onSalaryUpdate } = props;
  const keyExtractor = useCallback((item: SalaryHistory) => item.id.toString(), []);
  const renderItem: ListRenderItem<SalaryHistory> = useCallback(({ item }) => <SalaryHistoryCard item={item} columns={columns} />, [columns]);
  const columnWrapperStyle = useMemo(() => (columns > 1 ? styles.columnWrapper : undefined), [columns]);
  const Header = useMemo(() => (
    <View>
      {header}
      <SectionTitle title="Pay Salary" />
      <View style={styles.formPanel}>
        <EmployeePicker data={team} selectedId={selectedUserId} onSelect={onEmployeeSelect} />
        <TextInput style={styles.input} value={amount} onChangeText={onAmountChange} placeholder="Amount" placeholderTextColor={colors.textSubtle} keyboardType="numeric" />
        <TextInput style={styles.input} value={month} onChangeText={onMonthChange} placeholder="YYYY-MM" placeholderTextColor={colors.textSubtle} />
        <TextInput style={styles.input} value={date} onChangeText={onDateChange} placeholder="Paid date" placeholderTextColor={colors.textSubtle} />
        <TextInput style={styles.input} value={notes} onChangeText={onNotesChange} placeholder="Notes" placeholderTextColor={colors.textSubtle} />
        <PrimaryButton label="Pay Salary" onPress={onPay} loading={paying} icon="cash-outline" />
      </View>
      <SectionTitle title="Base Salaries" />
      <SalaryEditor data={team} columns={columns} onSalaryUpdate={onSalaryUpdate} />
      <SectionTitle title="Payment History" />
    </View>
  ), [amount, columns, date, header, month, notes, onAmountChange, onDateChange, onEmployeeSelect, onMonthChange, onNotesChange, onPay, onSalaryUpdate, paying, selectedUserId, team]);
  return <FlatList key={`sal-${columns}`} data={loading ? [] : history} numColumns={columns} keyExtractor={keyExtractor} renderItem={renderItem} columnWrapperStyle={columnWrapperStyle} ListHeaderComponent={Header} ListEmptyComponent={loading ? <StateBlock loading title="Loading salary records" /> : <StateBlock title="No salary payments" icon="cash-outline" />} contentContainerStyle={contentStyle} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />} showsVerticalScrollIndicator={false} {...LIST_CONFIG} />;
});

const EmployeePicker = memo(function EmployeePicker({ data, selectedId, onSelect }: { data: TeamMember[]; selectedId: number | null; onSelect: (id: number) => void }) {
  const keyExtractor = useCallback((item: TeamMember) => item.id.toString(), []);
  const renderItem: ListRenderItem<TeamMember> = useCallback(({ item }) => <EmployeeChip item={item} selected={item.id === selectedId} onSelect={onSelect} />, [onSelect, selectedId]);
  return <FlatList horizontal data={data} keyExtractor={keyExtractor} renderItem={renderItem} contentContainerStyle={styles.horizontalList} showsHorizontalScrollIndicator={false} {...TEXT_LIST_CONFIG} />;
});

const EmployeeChip = memo(function EmployeeChip({ item, selected, onSelect }: { item: TeamMember; selected: boolean; onSelect: (id: number) => void }) {
  const handlePress = useCallback(() => onSelect(item.id), [item.id, onSelect]);
  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.chip, selected && styles.chipActive, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Select ${item.name}`}>
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item.name}</Text>
    </Pressable>
  );
});

const SalaryEditor = memo(function SalaryEditor({ data, columns, onSalaryUpdate }: { data: TeamMember[]; columns: number; onSalaryUpdate: (id: number, salary: string) => void }) {
  const keyExtractor = useCallback((item: TeamMember) => item.id.toString(), []);
  const renderItem: ListRenderItem<TeamMember> = useCallback(({ item }) => <SalaryEditCard item={item} columns={columns} onSalaryUpdate={onSalaryUpdate} />, [columns, onSalaryUpdate]);
  const columnWrapperStyle = useMemo(() => (columns > 1 ? styles.columnWrapper : undefined), [columns]);
  return <FlatList key={`se-${columns}`} data={data} numColumns={columns} keyExtractor={keyExtractor} renderItem={renderItem} columnWrapperStyle={columnWrapperStyle} scrollEnabled={false} contentContainerStyle={styles.nestedList} showsVerticalScrollIndicator={false} {...TEXT_LIST_CONFIG} />;
});

const SalaryEditCard = memo(function SalaryEditCard({ item, columns, onSalaryUpdate }: { item: TeamMember; columns: number; onSalaryUpdate: (id: number, salary: string) => void }) {
  const [salary, setSalary] = useState(String(item.salary || ''));
  const handleUpdate = useCallback(() => onSalaryUpdate(item.id, salary), [item.id, onSalaryUpdate, salary]);
  const flexStyle = useMemo(() => ({ flex: columns > 1 ? 1 : undefined }), [columns]);
  return (
    <View style={[styles.recordCard, flexStyle]}>
      <Text style={styles.recordTitle}>{item.name}</Text>
      <TextInput style={styles.input} value={salary} onChangeText={setSalary} keyboardType="numeric" />
      <PrimaryButton label="Update" onPress={handleUpdate} icon="save-outline" />
    </View>
  );
});

const SalaryHistoryCard = memo(function SalaryHistoryCard({ item, columns }: { item: SalaryHistory; columns: number }) {
  const flexStyle = useMemo(() => ({ flex: columns > 1 ? 1 : undefined }), [columns]);
  return (
    <View style={[styles.recordCard, flexStyle]}>
      <Text style={styles.recordTitle}>{item.name}</Text>
      <InfoLine label="Amount" value={formatMoney(item.amount)} accent />
      <InfoLine label="Month" value={item.month} />
      <InfoLine label="Paid" value={formatDate(item.paid_date)} />
      {!!item.notes && <Text style={styles.recordMeta}>{item.notes}</Text>}
    </View>
  );
});

// --- Shared sub-components ---
const InfoLine = memo(function InfoLine({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (<View style={styles.infoLine}><Text style={styles.infoLabel}>{label}</Text><Text style={[styles.infoValue, accent && styles.infoAccent]} numberOfLines={1}>{value}</Text></View>);
});

const Badge = memo(function Badge({ label, tone }: { label: string; tone: 'success' | 'warning' | 'info' }) {
  const bg = tone === 'success' ? colors.successSoft : tone === 'warning' ? colors.warningSoft : colors.infoSoft;
  const fg = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.info;
  return (<View style={[styles.badge, { backgroundColor: bg }]}><Text style={[styles.badgeText, { color: fg }]}>{label.toUpperCase()}</Text></View>);
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { flexGrow: 1, width: '100%', paddingTop: spacing.lg, paddingBottom: 80 },
  headerWrap: { marginBottom: spacing.lg },
  columnWrapper: { gap: spacing.sm },
  statusCard: {
    borderRadius: radii.card, backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder,
    padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.sm, ...shadows.subtle,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusCopy: { flex: 1, minWidth: 0 },
  statusTitle: { color: colors.text, fontSize: typography.bodyLarge, fontWeight: '800' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  dateInput: { flex: 1, minHeight: 42, borderRadius: radii.sm, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: spacing.md, fontSize: typography.caption },
  input: { minHeight: 44, borderRadius: radii.sm, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: spacing.md, fontSize: typography.bodyLarge },
  countBadge: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  formPanel: {
    borderRadius: radii.card, backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder,
    padding: spacing.md, gap: spacing.md, ...shadows.subtle,
  },
  recordCard: {
    borderRadius: radii.card, backgroundColor: colors.surfaceGlass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder,
    padding: spacing.md, marginBottom: spacing.sm, gap: spacing.xs, ...shadows.subtle,
  },
  recordHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  recordCopy: { flex: 1, minWidth: 0 },
  recordTitle: { color: colors.text, fontSize: typography.bodyLarge, fontWeight: '800' },
  recordMeta: { color: colors.textSubtle, fontSize: typography.eyebrow },
  infoLine: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  infoLabel: { color: colors.textSubtle, fontSize: typography.eyebrow, fontWeight: '700' },
  infoValue: { color: colors.text, fontSize: typography.caption, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  infoAccent: { color: colors.accent },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.xs },
  badgeText: { fontSize: typography.eyebrow, fontWeight: '800' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs, marginTop: spacing.xs },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfacePressed, overflow: 'hidden', marginTop: spacing.xs },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  horizontalList: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: { minHeight: 38, borderRadius: radii.card, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder, justifyContent: 'center', paddingHorizontal: spacing.md },
  chipActive: { backgroundColor: colors.accentGlass, borderColor: colors.accentBorder },
  chipText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  chipTextActive: { color: colors.accent },
  nestedList: { gap: spacing.sm },
  pressed: { opacity: animation.press.opacity, transform: [{ scale: animation.press.scale }] },
});
