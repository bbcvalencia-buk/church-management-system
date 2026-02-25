
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
    Users,
    Heart,
    TrendingUp,
    Calendar,
    ArrowRight,
    Activity,
    DollarSign
} from "lucide-react";
import { Link } from "react-router-dom";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from "recharts";

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState({
        activeMembers: 0,
        soulsSavedThisWeek: 0,
        tithesThisMonth: 0,
        activitiesCount: 0
    });
    const [birthdays, setBirthdays] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
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

            // 5. Upcoming Birthdays (next 30 days)
            const today = new Date();
            const { data: bdays } = await supabase
                .from('members')
                .select('first_name, surname, date_of_birth')
                .eq('membership_status', 'active');

            const upcoming = bdays?.filter(m => {
                const dob = new Date(m.date_of_birth);
                const bdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
                const diffTime = (bdayThisYear.getTime() - today.getTime()) / (1000 * 3600 * 24);
                return diffTime >= -1 && diffTime <= 30; // -1 to include today
            }).sort((a, b) => {
                const da = new Date(a.date_of_birth);
                const db = new Date(b.date_of_birth);
                return da.getMonth() - db.getMonth() || da.getDate() - db.getDate();
            }).slice(0, 3) || [];

            // 6. Chart Data (Last 7 Days)
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const last7Days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return d.toISOString().split('T')[0];
            });

            // Fetch daily stats
            const { data: weekServices } = await supabase
                .from('services')
                .select('service_date, souls_saved')
                .gte('service_date', last7Days[0]);

            const { data: weekActivities } = await supabase
                .from('activities')
                .select('activity_date, souls_saved')
                .gte('activity_date', last7Days[0]);

            // Aggregate by date
            const dailyStats = last7Days.map(dateStr => {
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

            setChartData(dailyStats);

            setStats({
                activeMembers: memberCount || 0,
                soulsSavedThisWeek: totalSouls,
                tithesThisMonth: totalTithes,
                activitiesCount: activityCount || 0
            });
            setBirthdays(upcoming);

        } catch (err) {
            console.error("Dashboard fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
    };

    return (
        <div className="space-y-6 pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-main)] tracking-tight">
                        Dashboard
                    </h1>
                    <p className="text-[var(--color-text-muted)] text-sm">Welcome back, Pastor. Here's your overview.</p>
                </div>
                <div className="text-sm bg-white border border-[var(--color-border)] shadow-sm px-4 py-2 rounded-full text-[var(--color-text-main)] font-medium flex items-center gap-2">
                    <Calendar size={14} className="text-[var(--color-text-muted)]" />
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Tot. Members"
                    value={stats.activeMembers}
                    icon={Users}
                    color="blue"
                    trend="+3 this month"
                    link="/members"
                />
                <StatCard
                    title="Souls (Week)"
                    value={stats.soulsSavedThisWeek}
                    icon={Heart}
                    color="pink"
                    trend="+2 vs last week"
                    link="/services"
                />
                <StatCard
                    title="Tithes (Month)"
                    value={formatCurrency(stats.tithesThisMonth)}
                    icon={DollarSign}
                    color="emerald"
                    trend="75% of goal"
                    link="/finance"
                />
                <StatCard
                    title="Activities"
                    value={stats.activitiesCount}
                    icon={Activity}
                    color="violet"
                    trend="Next: Sat Outreach"
                    link="/activities"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Spiritual Harvest Chart */}
                <div className="lg:col-span-2 card-panel p-6 space-y-4">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--color-text-main)]">
                            <TrendingUp className="text-[var(--color-primary)]" size={20} />
                            Spiritual Harvest
                        </h3>
                        {/* <select className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs">
                            <option>Last 7 Days</option>
                        </select> */}
                    </div>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorSouls" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    itemStyle={{ color: 'var(--color-primary)' }}
                                    cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="souls"
                                    stroke="var(--color-primary)"
                                    fillOpacity={1}
                                    fill="url(#colorSouls)"
                                    strokeWidth={3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Quick Actions / Shortcut */}
                <div className="space-y-6">
                    <div className="card-panel p-6">
                        <h3 className="text-lg font-bold mb-4 text-[var(--color-text-main)]">Quick Actions</h3>
                        <div className="grid grid-cols-1 gap-2">
                            <QuickActionLink to="/members/new" label="Register New Member" sub="Add to church database" />
                            <QuickActionLink to="/finance/new" label="Record Tithes/Offers" sub="Sunday contribution entry" />
                            <QuickActionLink to="/services/new" label="Log Last Service" sub="Attendance & spiritual results" />
                            <QuickActionLink to="/visitors/new" label="Register Visitor" sub="Follow up new souls" />
                            <QuickActionLink to="/announcements" label="Ministry Announcements" sub="View service and ministry updates" />
                        </div>
                    </div>

                    <div className="card-panel p-6 bg-gradient-to-br from-[var(--color-primary)]/5 to-transparent">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-[var(--color-text-main)]">
                            <Heart className="text-pink-500" size={18} />
                            Upcoming Birthdays
                        </h3>
                        <div className="space-y-4">
                            {birthdays.length === 0 ? (
                                <p className="text-xs text-[var(--color-text-muted)] italic">No birthdays in the next 30 days.</p>
                            ) : (
                                birthdays.map((m, i) => {
                                    const dob = new Date(m.date_of_birth);
                                    const month = dob.toLocaleString('default', { month: 'short' }).toUpperCase();
                                    const day = dob.getDate();
                                    return (
                                        <div key={i} className="flex gap-4 items-center p-2 rounded hover:bg-white/50 transition-colors">
                                            <div className="bg-[var(--color-surface)] h-10 w-10 shrink-0 rounded flex flex-col items-center justify-center font-bold border border-[var(--color-border)] shadow-sm">
                                                <span className="text-[10px] text-pink-500">{month}</span>
                                                <span className="text-sm text-gray-700">{day}</span>
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-[var(--color-text-main)]">{m.first_name} {m.surname}</p>
                                                <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold">Member Birthday</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <Link to="/members">
                            <button className="w-full mt-6 text-xs text-[var(--color-primary)] font-bold uppercase tracking-widest hover:text-white transition-colors">
                                View Member Directory
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon: Icon, color, trend, link }: any) => {
    const colorStyles = {
        blue: 'bg-blue-50 text-blue-600',
        pink: 'bg-pink-50 text-pink-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        violet: 'bg-violet-50 text-violet-600',
    };

    const activeColor = colorStyles[color as keyof typeof colorStyles] || colorStyles.blue;

    return (
        <Link to={link || "#"} className="card-panel p-6 group hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${activeColor} transition-colors`}>
                    <Icon size={24} />
                </div>
                {trend && (
                    <span className="text-xs font-medium text-[var(--color-text-muted)] bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <p className="text-3xl font-bold text-[var(--color-text-main)] tracking-tight">{value}</p>
                <h3 className="text-[var(--color-text-muted)] text-sm font-medium mt-1">{title}</h3>
            </div>
        </Link>
    );
};

const QuickActionLink = ({ to, label, sub }: any) => (
    <Link to={to} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg)] border border-transparent hover:border-[var(--color-border)] hover:bg-white hover:shadow-sm transition-all group">
        <div>
            <p className="font-bold text-sm text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors">{label}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">{sub}</p>
        </div>
        <ArrowRight size={14} className="text-[var(--color-text-muted)] group-hover:translate-x-1 transition-transform" />
    </Link>
);

export default Dashboard;
