import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Users } from 'lucide-react';
import { User, Shift, PlannedShift, MonthStats, PlanStats, RateType, ScheduleMode, FixedPattern, OnlinePresenceUser } from './types';
import { initTelegramApp, getTelegramUser, triggerHaptic } from './lib/telegram';
import { supabase } from './lib/supabase';
import { Header } from './components/Header';
import { StartScreen } from './components/StartScreen';
import { FinancialDashboard } from './components/FinancialDashboard';
import { CalendarMonth } from './components/CalendarMonth';
import { ShiftModal } from './components/ShiftModal';
import { TeamScheduleTab } from './components/TeamScheduleTab';
import { RateSettingsModal } from './components/RateSettingsModal';
import { ExportSummaryModal } from './components/ExportSummaryModal';
import {
  fetchUserFromSupabase,
  fetchTeamMembersFromSupabase,
  fetchShiftsFromSupabase,
  saveActualShiftToSupabase,
  savePlannedShiftToSupabase,
  deleteShiftInSupabase,
  swapShiftInSupabase,
  generatePatternShiftsInSupabase,
  resetPlannedShiftsInSupabase,
  updateRateSettingsInSupabase,
} from './services/supabaseService';

export default function App() {
  // Active Telegram User ID or Username
  const [activeTgId, setActiveTgId] = useState<string>(() => {
    const tgUser = getTelegramUser();
    if (tgUser?.id) return String(tgUser.id);
    return localStorage.getItem('chaspik_tg_id') || '';
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Navigation tab: 'wallet' (Календарь - ФАКТ) / 'team' (Команда и график - ПЛАН)
  const [activeTab, setActiveTab] = useState<'wallet' | 'team'>('wallet');

  // Month navigation: default to current month
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const now = new Date();
  const defaultDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState<string>(defaultDateStr);

  // Shifts state (FACT vs PLAN)
  const [myShifts, setMyShifts] = useState<Shift[]>([]); // Actual worked shifts
  const [stats, setStats] = useState<MonthStats>({ totalEarned: 0, totalHours: 0, shiftsCount: 0 }); // Actual salary stats

  const [plannedShifts, setPlannedShifts] = useState<PlannedShift[]>([]); // Planned team schedule
  const [planStats, setPlanStats] = useState<PlanStats>({ plannedTotalEarned: 0, plannedTotalHours: 0, plannedShiftsCount: 0 });
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  // Realtime Presence state for online users
  const [onlineUsers, setOnlineUsers] = useState<OnlinePresenceUser[]>([]);

  // Modals
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<string>(defaultDateStr);
  const [editingPrefillPlanned, setEditingPrefillPlanned] = useState<PlannedShift | undefined>(undefined);
  const [rateSettingsOpen, setRateSettingsOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Track online users with Supabase Realtime Presence
  useEffect(() => {
    if (!currentUser) return;

    // Connect to Supabase Realtime Presence channel 'online-users'
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: currentUser.id || currentUser.username,
        },
      },
    });

    const handlePresenceUpdate = () => {
      const state = channel.presenceState();
      const userMap = new Map<string, OnlinePresenceUser>();

      Object.values(state).forEach((presences) => {
        (presences as any[]).forEach((p) => {
          const key = p.user_id || p.username;
          if (key) {
            userMap.set(key, {
              user_id: p.user_id,
              username: p.username,
              role: p.role,
              name: p.name,
              workplace_code: p.workplace_code,
              online_at: p.online_at,
            });
          }
        });
      });

      const allActive = Array.from(userMap.values());
      const pointActive = currentUser.workplace_code
        ? allActive.filter((u) => !u.workplace_code || u.workplace_code === currentUser.workplace_code)
        : allActive;

      setOnlineUsers(pointActive.length > 0 ? pointActive : [
        {
          user_id: currentUser.id,
          username: currentUser.username || currentUser.name,
          role: currentUser.role_title || 'Сотрудник',
          name: currentUser.name,
          workplace_code: currentUser.workplace_code,
        }
      ]);
    };

    channel
      .on('presence', { event: 'sync' }, handlePresenceUpdate)
      .on('presence', { event: 'join' }, handlePresenceUpdate)
      .on('presence', { event: 'leave' }, handlePresenceUpdate)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            username: currentUser.username || currentUser.name,
            role: currentUser.role_title || 'Сотрудник',
            name: currentUser.name,
            workplace_code: currentUser.workplace_code,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUser?.workplace_code, currentUser?.username, currentUser?.role_title, currentUser?.name]);

  const onlineCount = Math.max(1, onlineUsers.length);

  // Format month string YYYY-MM
  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const monthNames = [
    'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
    'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'
  ];
  const currentMonthLocative = monthNames[currentDate.getMonth()] || 'месяце';

  // Initialize Telegram WebApp SDK
  useEffect(() => {
    initTelegramApp();
    try {
      // Clean up legacy multi-profile local cache on shared devices
      localStorage.removeItem('chaspik_saved_accounts');
    } catch (e) {
      console.warn('Storage cleanup notice:', e);
    }
    const tgUser = getTelegramUser();
    if (tgUser?.id) {
      const idStr = String(tgUser.id);
      setActiveTgId(idStr);
      localStorage.setItem('chaspik_tg_id', idStr);
    }
  }, []);

  // Fetch current user & workplace profile directly from Supabase
  const fetchUserProfile = useCallback(async (tgIdToFetch: string) => {
    if (!tgIdToFetch) {
      setCurrentUser(null);
      setIsInitializing(false);
      return;
    }

    try {
      const user = await fetchUserFromSupabase(tgIdToFetch);
      if (user && user.workplace_code) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.warn('Supabase fetch profile error:', err);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Fetch team members list for workplace directly from Supabase
  const fetchTeamMembers = useCallback(async (workplaceCode: string) => {
    if (!workplaceCode) return;
    try {
      const members = await fetchTeamMembersFromSupabase(workplaceCode);
      setTeamMembers(members || []);
    } catch (err) {
      console.warn('Supabase error fetching team members:', err);
    }
  }, []);

  // Fetch shifts data directly from Supabase (both Actual FACT shifts and Planned PLAN shifts)
  const fetchShiftsData = useCallback(async (month: string, user: User | null) => {
    if (!user?.workplace_code) return;
    try {
      const res = await fetchShiftsFromSupabase({
        pointCode: user.workplace_code,
        month,
        userId: user.id,
        username: user.username,
      });
      setMyShifts(res.myShifts || []);
      setStats(res.stats || { totalEarned: 0, totalHours: 0, shiftsCount: 0 });
      setPlannedShifts(res.plannedShifts || []);
      setPlanStats(res.planStats || { plannedTotalEarned: 0, plannedTotalHours: 0, plannedShiftsCount: 0 });
    } catch (err) {
      console.warn('Supabase error fetching shifts:', err);
    }
  }, []);

  // Load user profile when activeTgId changes
  useEffect(() => {
    fetchUserProfile(activeTgId);
  }, [activeTgId, fetchUserProfile]);

  // Load shifts & team when user profile is ready
  useEffect(() => {
    if (currentUser?.workplace_code) {
      fetchShiftsData(currentMonthStr, currentUser);
      fetchTeamMembers(currentUser.workplace_code);
    }
  }, [currentMonthStr, currentUser, fetchShiftsData, fetchTeamMembers]);

  // Month navigation
  const handleChangeMonth = (delta: number) => {
    setCurrentDate((prev) => {
      return new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
    });
  };

  // Open shift editor (FACT)
  const handleOpenShiftModal = (dateStr: string, prefillFromPlan?: PlannedShift) => {
    setEditingDate(dateStr);
    setEditingPrefillPlanned(prefillFromPlan);
    setShiftModalOpen(true);
  };

  // Confirm planned shift into actual shift (ФАКТ) directly in Supabase
  const handleConfirmPlan = async (dateStr: string) => {
    if (!currentUser?.workplace_code) return;
    try {
      const planned = plannedShifts.find(
        (ps) => ps.date === dateStr && (ps.user_id === currentUser.id || ps.user_name === currentUser.username)
      );
      await saveActualShiftToSupabase({
        point_code: currentUser.workplace_code,
        user_id: currentUser.id,
        username: currentUser.username || currentUser.name,
        date: dateStr,
        start_time: planned?.start_time || '12:00',
        end_time: planned?.end_time || '00:00',
        hourly_rate: currentUser.hourly_rate || 350,
        tips: 0,
        is_day_off: 0,
      });
      await fetchShiftsData(currentMonthStr, currentUser);
    } catch (err) {
      console.error('Confirm plan error:', err);
    }
  };

  // Save actual shift handler (ФАКТ) directly in Supabase
  const handleSaveShift = async (shiftData: any) => {
    if (!currentUser?.workplace_code) return;
    await saveActualShiftToSupabase({
      point_code: currentUser.workplace_code,
      user_id: currentUser.id,
      username: currentUser.username || currentUser.name,
      date: shiftData.date,
      start_time: shiftData.start_time || '12:00',
      end_time: shiftData.end_time || '00:00',
      hourly_rate: Number(shiftData.hourly_rate) || currentUser.hourly_rate || 350,
      tips: Number(shiftData.tips) || 0,
      is_day_off: shiftData.is_day_off ? 1 : 0,
    });
    await fetchShiftsData(currentMonthStr, currentUser);
  };

  // Delete actual shift handler directly in Supabase
  const handleDeleteShift = async (shiftId: string) => {
    if (!currentUser) return;
    await deleteShiftInSupabase(shiftId);
    await fetchShiftsData(currentMonthStr, currentUser);
  };

  // Save planned shift handler (ПЛАН) directly in Supabase
  const handleSavePlannedShift = async (planData: {
    date: string;
    target_user_id: string;
    is_day_off: number;
    start_time: string;
    end_time: string;
    comment?: string;
    schedule_type?: ScheduleMode;
  }) => {
    if (!currentUser?.workplace_code) return;
    const targetMember = teamMembers.find((m) => m.id === planData.target_user_id) || currentUser;
    const targetUsername = targetMember.username || targetMember.name;
    const targetRate = targetMember.hourly_rate || currentUser.hourly_rate || 350;

    const saved = await savePlannedShiftToSupabase({
      point_code: currentUser.workplace_code,
      user_id: targetMember.id,
      username: targetUsername,
      date: planData.date,
      start_time: planData.start_time || '12:00',
      end_time: planData.end_time || '00:00',
      hourly_rate: targetRate,
      schedule_type: planData.schedule_type || 'weekly',
      is_day_off: planData.is_day_off,
    });

    setPlannedShifts((prev) => {
      const filtered = prev.filter((s) => !(s.user_name === targetUsername && s.date === planData.date));
      return [...filtered, saved];
    });

    await fetchShiftsData(currentMonthStr, currentUser);
  };

  // Delete planned shift handler directly in Supabase
  const handleDeletePlannedShift = async (shiftId: string) => {
    if (!currentUser) return;
    setPlannedShifts((prev) => prev.filter((s) => s.id !== shiftId));
    await deleteShiftInSupabase(shiftId);
    await fetchShiftsData(currentMonthStr, currentUser);
  };

  // Generate cyclic pattern shifts handler (2/2, 3/3, 5/2) directly in Supabase
  const handleGeneratePattern = async (patternData: {
    target_user_id: string;
    pattern: FixedPattern;
    start_date: string;
    day_in_cycle?: number;
    target_month?: string;
    start_time?: string;
    end_time?: string;
  }) => {
    if (!currentUser?.workplace_code) return;
    const targetMember = teamMembers.find((m) => m.id === patternData.target_user_id) || currentUser;
    await generatePatternShiftsInSupabase({
      point_code: currentUser.workplace_code,
      target_user: targetMember,
      pattern: patternData.pattern,
      start_date: patternData.start_date,
      day_in_cycle: patternData.day_in_cycle,
      target_month: patternData.target_month,
      start_time: patternData.start_time,
      end_time: patternData.end_time,
    });
    await fetchShiftsData(currentMonthStr, currentUser);
  };

  // Reset / Clear planned shifts for month directly in Supabase
  const handleResetPattern = async (resetData: { month: string; target_user_id?: string }) => {
    if (!currentUser?.workplace_code) return;
    const targetMember = resetData.target_user_id ? teamMembers.find((m) => m.id === resetData.target_user_id) : undefined;
    await resetPlannedShiftsInSupabase({
      point_code: currentUser.workplace_code,
      month: resetData.month,
      target_user_id: resetData.target_user_id,
      target_username: targetMember?.username,
    });
    await fetchShiftsData(currentMonthStr, currentUser);
  };

  // Shift swap actions on planned shifts (Биржа подмен) directly in Supabase
  const handleSwapAction = async (shiftId: string, action: 'request' | 'take' | 'cancel', _note?: string) => {
    if (!currentUser) return;
    await swapShiftInSupabase(shiftId, action, {
      id: currentUser.id,
      username: currentUser.username || currentUser.name,
    });
    await fetchShiftsData(currentMonthStr, currentUser);
  };

  // Personal rate settings save directly in Supabase
  const handleSaveRateSettings = async (settings: {
    default_rate_type: RateType;
    hourly_rate: number;
    shift_flat_rate: number;
    sales_percent: number;
    role_title?: string;
    username?: string;
    password?: string;
  }) => {
    if (!currentUser) return;
    const updatedUser = await updateRateSettingsInSupabase(currentUser.id, settings);
    setCurrentUser(updatedUser);
    await fetchShiftsData(currentMonthStr, updatedUser);
    if (updatedUser.workplace_code) {
      await fetchTeamMembers(updatedUser.workplace_code);
    }
  };

  // Update workplace schedule mode (weekly / fixed)
  const handleUpdateScheduleMode = async (mode: ScheduleMode) => {
    if (!currentUser) return;
    setCurrentUser((prev) => (prev ? { ...prev, schedule_mode: mode } : prev));
    try {
      const updated = await updateRateSettingsInSupabase(currentUser.id, { schedule_mode: mode });
      setCurrentUser(updated);
    } catch (err) {
      console.warn('Failed to persist schedule mode:', err);
    }
  };

  // Logout handler
  const handleLogout = () => {
    try {
      localStorage.removeItem('chaspik_tg_id');
      localStorage.removeItem('chaspik_user');
      localStorage.removeItem('chaspik_saved_accounts');
    } catch (e) {
      console.warn('Storage clear notice:', e);
    }
    setCurrentUser(null);
    setActiveTgId('');
    setMyShifts([]);
    setPlannedShifts([]);
    setStats({ totalEarned: 0, totalHours: 0, shiftsCount: 0 });
    setPlanStats({ plannedTotalEarned: 0, plannedTotalHours: 0, plannedShiftsCount: 0 });
  };

  // Workplace joined callback
  const handleWorkplaceJoined = (_workplace: any, user: User) => {
    setCurrentUser(user);
    if (user.username || user.tg_id) {
      const idToStore = user.username || user.tg_id;
      setActiveTgId(idToStore);
      localStorage.setItem('chaspik_tg_id', idToStore);
      fetchShiftsData(currentMonthStr, user);
      if (user.workplace_code) {
        fetchTeamMembers(user.workplace_code);
      }
    }
  };

  // 1. Initial Loading Spinner
  if (isInitializing) {
    return (
      <div key="loading-screen" className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs text-gray-400 font-semibold font-mono">Загрузка ЧасПик...</span>
      </div>
    );
  }

  // 2. If not authorized in a workplace: Show Start Screen
  if (!currentUser) {
    const effectiveTgId = activeTgId || (getTelegramUser()?.id ? String(getTelegramUser()?.id) : `tg-${Math.floor(100000 + Math.random() * 900000)}`);
    return (
      <StartScreen
        key="start-screen-view"
        tgId={effectiveTgId}
        onSuccess={handleWorkplaceJoined}
      />
    );
  }

  const editingShift = myShifts.find((s) => s.date === editingDate);

  // 3. Main Interface with Bottom Tabs
  return (
    <div key={`app-main-${currentUser.id}-${activeTab}`} className="min-h-screen bg-gray-50 dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 flex flex-col font-sans transition-colors selection:bg-teal-500 selection:text-white">
      {/* Mobile container centered on desktop */}
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col bg-white dark:bg-neutral-900 shadow-2xl relative min-h-screen border-x border-gray-100 dark:border-neutral-800">
        
        {/* App Header with Logo, Settings and Logout */}
        <Header
          user={currentUser}
          onlineCount={onlineCount}
          onOpenRateSettings={() => setRateSettingsOpen(true)}
          onLogout={handleLogout}
        />

        {/* Main Content Area */}
        <main className="flex-1 pb-24 overflow-y-auto">
          {activeTab === 'wallet' ? (
            <div key="tab-wallet-content">
              {/* Financial Dashboard (FACTUAL SALARY ONLY) */}
              <FinancialDashboard
                stats={stats}
                monthName={currentMonthLocative}
                user={currentUser}
                onOpenRateSettings={() => setRateSettingsOpen(true)}
              />

              {/* Month Interactive Calendar Grid (FACT + PLAN overlay) */}
              <CalendarMonth
                currentDate={currentDate}
                selectedDate={selectedDate}
                shifts={myShifts}
                plannedShifts={plannedShifts}
                currentUser={currentUser}
                onSelectDate={(d) => setSelectedDate(d)}
                onOpenShiftModal={handleOpenShiftModal}
                onConfirmPlan={handleConfirmPlan}
                onChangeMonth={handleChangeMonth}
              />
            </div>
          ) : (
            /* Team Schedule & Shift Swap Exchange Tab (PLAN) */
            <TeamScheduleTab
              key="tab-team-content"
              plannedShifts={plannedShifts}
              currentUser={currentUser}
              teamMembers={teamMembers}
              planStats={planStats}
              onlineCount={onlineCount}
              onTakeSwap={(shiftId) => handleSwapAction(shiftId, 'take')}
              onRequestSwap={(shiftId, note) => handleSwapAction(shiftId, 'request', note)}
              onCancelSwap={(shiftId) => handleSwapAction(shiftId, 'cancel')}
              onSavePlannedShift={handleSavePlannedShift}
              onDeletePlannedShift={handleDeletePlannedShift}
              onGeneratePattern={handleGeneratePattern}
              onResetPattern={handleResetPattern}
              onOpenReportModal={() => setReportModalOpen(true)}
              onUpdateWorkplaceScheduleMode={handleUpdateScheduleMode}
            />
          )}
        </main>

        {/* Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-t border-gray-100 dark:border-neutral-800 px-6 py-2 z-40 flex items-center justify-around">
          {/* Tab 1: Календарь (ФАКТ) */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('wallet');
            }}
            className={`flex flex-col items-center gap-1 py-1 transition-all ${
              activeTab === 'wallet'
                ? 'text-[#1E88E5] font-bold scale-105'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-medium'
            }`}
          >
            <div className="relative">
              <CalendarDays className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[11px] leading-tight">Календарь</span>
          </button>

          {/* Tab 2: Команда и График (ПЛАН) */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('team');
            }}
            className={`flex flex-col items-center gap-1 py-1 transition-all ${
              activeTab === 'team'
                ? 'text-[#1E88E5] font-bold scale-105'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-medium'
            }`}
          >
            <div className="relative">
              <Users className="w-5 h-5 stroke-[2.2]" />
              {/* Notification badge if any coworker planned shift is seeking swap */}
              {plannedShifts.some((s) => s.swap_status === 'seeking_swap' && s.user_id !== currentUser?.id) && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-neutral-900 animate-pulse" />
              )}
            </div>
            <span className="text-[11px] leading-tight">Команда</span>
          </button>
        </nav>

        {/* Modals */}
        {shiftModalOpen && (
          <ShiftModal
            isOpen={shiftModalOpen}
            dateStr={editingDate}
            existingShift={editingShift}
            currentUser={currentUser}
            onClose={() => setShiftModalOpen(false)}
            onSave={handleSaveShift}
            onDelete={handleDeleteShift}
            onSwapAction={(id, act, note) => handleSwapAction(id, act, note)}
          />
        )}

        {rateSettingsOpen && currentUser && (
          <RateSettingsModal
            isOpen={rateSettingsOpen}
            user={currentUser}
            onlineCount={onlineCount}
            onlineUsers={onlineUsers}
            onClose={() => setRateSettingsOpen(false)}
            onSave={handleSaveRateSettings}
            onLogout={handleLogout}
          />
        )}

        {reportModalOpen && currentUser && (
          <ExportSummaryModal
            isOpen={reportModalOpen}
            onClose={() => setReportModalOpen(false)}
            month={currentMonthStr}
            tgId={currentUser.tg_id}
          />
        )}

      </div>
    </div>
  );
}
