import { supabase } from "../lib/supabase";

export interface DashboardStats {
    activeMembers: number;
    soulsSavedThisWeek: number;
    tithesThisMonth: number;
    activitiesCount: number;
    churchEventsCount: number;
    activeGoodnewsSeries: number;
    goodnewsChildrenReached: number;
    goodnewsSoulsSaved: number;
}

/**
 * Fetches all stats for the dashboard.
 */
export const getDashboardData = async () => {
    // 1. Members count
    const { count: memberCount } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('membership_status', 'active');

    // 2. Souls saved this week (Services + Activities)
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const dateStr = startOfWeek.toISOString().split('T')[0];

    const [serviceRes, activityRes] = await Promise.all([
        supabase.from('services').select('souls_saved').gte('service_date', dateStr),
        supabase.from('activities').select('souls_saved').gte('activity_date', dateStr)
    ]);

    const sSouls = serviceRes.data?.reduce((sum, s) => sum + (s.souls_saved || 0), 0) || 0;
    const aSouls = activityRes.data?.reduce((sum, a) => sum + (a.souls_saved || 0), 0) || 0;
    const totalSouls = sSouls + aSouls;

    // 3. Tithes this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const { data: monthTithes } = await supabase
        .from('financial_records')
        .select('amount')
        .is('deleted_at', null)
        .eq('transaction_type', 'tithe')
        .gte('transaction_date', startOfMonth.toISOString().split('T')[0]);

    const totalTithes = monthTithes?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    // 4. Activities count
    const { count: activityCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true });

    // 5. Church Events count
    const { count: eventsCount } = await supabase
        .from('church_events')
        .select('*', { count: 'exact', head: true });

    // 6. Goodnews Stats
    let activeGoodnewsSeries = 0;
    let goodnewsChildrenReached = 0;
    let goodnewsSoulsSaved = 0;

    try {
        const { count: gnSeriesCount } = await supabase
            .from('goodnews_series')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'ongoing');

        activeGoodnewsSeries = gnSeriesCount || 0;

        const { data: gnSessions } = await supabase
            .from('goodnews_sessions')
            .select('children_count, souls_saved_count');

        if (gnSessions) {
            goodnewsChildrenReached = gnSessions.reduce((sum, s) => sum + (s.children_count || 0), 0);
            goodnewsSoulsSaved = gnSessions.reduce((sum, s) => sum + (s.souls_saved_count || 0), 0);
        }
    } catch (e) {
        console.warn("Goodnews tables might not exist yet", e);
    }

    return {
        stats: {
            activeMembers: memberCount || 0,
            soulsSavedThisWeek: totalSouls,
            tithesThisMonth: totalTithes,
            activitiesCount: activityCount || 0,
            churchEventsCount: eventsCount || 0,
            activeGoodnewsSeries,
            goodnewsChildrenReached,
            goodnewsSoulsSaved
        },
        dateStr
    };
};

/**
 * Fetches chart data for the last 7 days.
 */
export const getWeeklySoulsSaved = async () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
    });

    const { data: weekServices } = await supabase
        .from('services')
        .select('service_date, souls_saved')
        .gte('service_date', last7Days[0]);

    const { data: weekActivities } = await supabase
        .from('activities')
        .select('activity_date, souls_saved')
        .gte('activity_date', last7Days[0]);

    return last7Days.map(dateStr => {
        const dateObj = new Date(dateStr);
        const dayName = days[dateObj.getDay()];

        const sCount = weekServices
            ?.filter(s => s.service_date === dateStr)
            .reduce((sum, s) => sum + (s.souls_saved || 0), 0) || 0;

        const aCount = weekActivities
            ?.filter(a => a.activity_date === dateStr)
            .reduce((sum, a) => sum + (a.souls_saved || 0), 0) || 0;

        return { name: dayName, souls: sCount + aCount, fullDate: dateStr };
    });
};

/**
 * Fetches upcoming birthdays (next 30 days).
 */
export const getUpcomingBirthdays = async (limit: number = 3) => {
    const today = new Date();
    const { data: bdays, error } = await supabase
        .from('members')
        .select('first_name, surname, date_of_birth')
        .eq('membership_status', 'active')
        .not('date_of_birth', 'is', null);

    if (error) throw error;

    return (bdays || [])
        .filter(m => {
            const dob = new Date(m.date_of_birth);
            const bdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
            const diffTime = (bdayThisYear.getTime() - today.getTime()) / (1000 * 3600 * 24);
            return diffTime >= -1 && diffTime <= 30;
        })
        .sort((a, b) => {
            const da = new Date(a.date_of_birth);
            const db = new Date(b.date_of_birth);
            return da.getMonth() - db.getMonth() || da.getDate() - db.getDate();
        })
        .slice(0, limit);
};
