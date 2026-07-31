import React, { useState, useEffect } from "react";
import * as dashboardService from "@/services/dashboardService";
import {
    Users,
    Heart,
    TrendingUp,
    Calendar,
    ArrowRight,
    Activity,
    DollarSign,
    BookOpen
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
        activitiesCount: 0,
        churchEventsCount: 0,
        activeGoodnewsSeries: 0,
        goodnewsChildrenReached: 0,
        goodnewsSoulsSaved: 0
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
            const [baseData, charts, birthdaysData] = await Promise.all([
                dashboardService.getDashboardData(),
                dashboardService.getWeeklySoulsSaved(),
                dashboardService.getUpcomingBirthdays(3)
            ]);

            setStats(baseData.stats);
            setChartData(charts);
            setBirthdays(birthdaysData);

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
                <div className="text-sm bg-white border border-[var(--color-border)] shadow-sm px-4 py-2 rounded-none text-[var(--color-text-main)] font-medium flex items-center gap-2">
                    <Calendar size={14} className="text-[var(--color-text-muted)]" />
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* Asymmetric Hub Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-t border-[var(--color-border)] mb-12">
                {/* Hero Metric - Span 8 columns */}
                <div className="lg:col-span-8 p-8 md:p-12 border-b lg:border-r border-[var(--color-border)] bg-[var(--color-bg)] flex flex-col justify-between min-h-[360px]">
                    <div>
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                            <Users size={14} /> Total Active Members
                        </h2>
                        <div className="mt-4 font-display text-[var(--color-text-main)] tracking-tighter" style={{ fontSize: 'clamp(5rem, 8vw, 10rem)', lineHeight: '1', fontWeight: 800, marginLeft: '-0.05em' }}>
                            {stats.activeMembers}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-8 md:gap-16 mt-12">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Monthly Growth</p>
                            <p className="text-2xl font-bold text-[var(--color-text-main)]">+3</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Active GN</p>
                            <p className="text-2xl font-bold text-[var(--color-text-main)]">{stats.activeGoodnewsSeries}</p>
                        </div>
                    </div>
                </div>

                {/* Context Metrics - Span 4 columns */}
                <div className="lg:col-span-4 flex flex-col bg-[var(--color-bg)]">
                    <div className="flex-1 p-8 border-b border-[var(--color-border)] flex flex-col justify-center">
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2 mb-2">
                            <Heart size={14} /> Souls Saved (Week)
                        </h2>
                        <p className="font-display text-5xl md:text-6xl font-bold tracking-tight text-[var(--color-text-main)]">
                            {stats.soulsSavedThisWeek}
                        </p>
                    </div>
                    <div className="flex-1 p-8 border-b border-[var(--color-border)] flex flex-col justify-center">
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2 mb-2">
                            <DollarSign size={14} /> Tithes (Month)
                        </h2>
                        <p className="font-display text-3xl md:text-4xl font-bold tracking-tight text-[var(--color-text-main)]">
                            {formatCurrency(stats.tithesThisMonth)}
                        </p>
                    </div>
                    <div className="flex-1 p-8 border-b border-[var(--color-border)] flex flex-col justify-center">
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2 mb-2">
                            <Activity size={14} /> Activities
                        </h2>
                        <p className="font-display text-5xl md:text-6xl font-bold tracking-tight text-[var(--color-text-main)]">
                            {stats.activitiesCount}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Spiritual Harvest Chart */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center mb-6 border-b border-[var(--color-border)] pb-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-[var(--color-text-main)]">
                            <TrendingUp className="text-[var(--color-text-main)]" size={16} />
                            Spiritual Harvest Trend
                        </h3>
                    </div>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorSouls" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-text-main)" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="var(--color-text-main)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--color-text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '0', boxShadow: 'none' }}
                                    itemStyle={{ color: 'var(--color-text-main)', fontSize: '12px', fontWeight: 'bold' }}
                                    cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
                                />
                                <Area
                                    type="step"
                                    dataKey="souls"
                                    stroke="var(--color-text-main)"
                                    fillOpacity={1}
                                    fill="url(#colorSouls)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Quick Actions / Shortcut */}
                <div className="space-y-12">
                    <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4 text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-4">Quick Actions</h3>
                        <div className="flex flex-col">
                            <QuickActionLink to="/members/new" label="Register New Member" sub="Add to church database" />
                            <QuickActionLink to="/finance/new" label="Record Tithes/Offers" sub="Sunday contribution entry" />
                            <QuickActionLink to="/services/new" label="Log Last Service" sub="Attendance & spiritual results" />
                            <QuickActionLink to="/visitors/new" label="Register Visitor" sub="Follow up new souls" />
                            <QuickActionLink to="/announcements" label="Ministry Announcements" sub="View service and ministry updates" />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-4">
                            <Heart size={14} />
                            Upcoming Birthdays
                        </h3>
                        <div className="space-y-0">
                            {birthdays.length === 0 ? (
                                <p className="text-xs text-[var(--color-text-muted)] py-4">No birthdays in the next 30 days.</p>
                            ) : (
                                birthdays.map((m, i) => {
                                    const dob = new Date(m.date_of_birth);
                                    const month = dob.toLocaleString('default', { month: 'short' }).toUpperCase();
                                    const day = dob.getDate();
                                    return (
                                        <div key={i} className="flex gap-4 items-center py-3 border-b border-[var(--color-border)]">
                                            <div className="bg-transparent h-10 w-10 shrink-0 flex flex-col items-center justify-center font-bold border border-[var(--color-text-main)]">
                                                <span className="text-[8px] uppercase tracking-widest text-[var(--color-text-main)]">{month}</span>
                                                <span className="text-sm text-[var(--color-text-main)]">{day}</span>
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-[var(--color-text-main)] uppercase tracking-wider">{m.first_name} {m.surname}</p>
                                                <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest">Member Birthday</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <Link to="/members">
                            <button className="w-full mt-4 text-[10px] text-[var(--color-text-main)] border border-[var(--color-text-main)] py-2 font-bold uppercase tracking-widest hover:bg-[var(--color-text-main)] hover:text-[var(--color-bg)] transition-colors">
                                View Directory
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
        blue: 'bg-gray-50 text-[var(--color-text-main)]',
        pink: 'bg-transparent text-[var(--color-text-muted)]',
        emerald: 'bg-emerald-50 text-emerald-600',
        violet: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
    };

    const activeColor = colorStyles[color as keyof typeof colorStyles] || colorStyles.blue;

    return (
        <Link to={link || "#"} className="card-panel p-6 group hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-none ${activeColor} transition-colors`}>
                    <Icon size={24} />
                </div>
                {trend && (
                    <span className="text-xs font-medium text-[var(--color-text-muted)] bg-gray-50 px-2 py-1 rounded-none border border-gray-100">
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
    <Link to={to} className="flex items-center justify-between py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-text-main)] hover:text-[var(--color-bg)] transition-all group px-2">
        <div>
            <p className="font-bold text-[10px] uppercase tracking-widest text-[var(--color-text-main)] group-hover:text-[var(--color-bg)] transition-colors">{label}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] group-hover:text-[var(--color-bg)]/70">{sub}</p>
        </div>
        <ArrowRight size={14} className="text-[var(--color-text-main)] group-hover:text-[var(--color-bg)] group-hover:translate-x-1 transition-transform" />
    </Link>
);

export default Dashboard;
