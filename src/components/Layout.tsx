import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { deriveTeacherDepartments, getSundaySchoolScopeLabel, SUNDAY_SCHOOL_POSITION_CATEGORIES } from '@/lib/sundaySchoolAccess';
import {
    LayoutDashboard,
    Users,
    Shield,
    Calendar,
    DollarSign,
    Settings,
    LogOut,
    Bell,
    Menu,
    X,
    User,
    CreditCard,
    UserPlus,
    KeyRound,
    MessageSquare,
    ActivitySquare,
    ClipboardCheck
} from 'lucide-react';

const ROLE_DISPLAY_LABELS: Record<string, string> = {
    church_administrator: 'Administrator',
    pastor: 'Pastor',
    church_clerk: 'Church Clerk',
    treasurer: 'Treasurer',
    recording_secretary: 'Secretary',
    music_minister: 'Music Minister',
    sunday_school_admin: 'SS Teacher',
    goodnews_teacher: 'GN Teacher',
    activity_coordinator: 'Activity Coord.',
    member: 'Member',
};

const formatRoleDisplay = (userRoles: string[]): string => {
    if (!userRoles || userRoles.length === 0) return 'Member';
    const meaningful = userRoles.filter(r => r !== 'member');
    const display = (meaningful.length > 0 ? meaningful : userRoles)
        .map(r => ROLE_DISPLAY_LABELS[r] || r.replace(/_/g, ' ').replace(/ \w/g, c => c.toUpperCase()));
    return display.join(' · ');
};

const Layout: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { signOut, member, user, roles } = useAuth();
    const navigate = useNavigate();

    const [churchName, setChurchName] = useState('Bible Baptist Church');
    const [systemName, setSystemName] = useState('Management System');
    const [churchLogoUrl, setChurchLogoUrl] = useState<string | null>(null);
    const [canAccessSundaySchool, setCanAccessSundaySchool] = useState(false);
    const [sundaySchoolScopeLabel, setSundaySchoolScopeLabel] = useState('All Departments');

    const [notifOpen, setNotifOpen] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const notifRef = useRef<HTMLDivElement>(null);

    const isAdmin = roles.includes(UserRole.CHURCH_ADMINISTRATOR) || roles.includes(UserRole.CHURCH_CLERK);

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('system_settings').select('church_name, system_name, church_logo_url').maybeSingle();
            if (data) {
                if (data.church_name) setChurchName(data.church_name);
                if (data.system_name) setSystemName(data.system_name);
                if (data.church_logo_url) setChurchLogoUrl(data.church_logo_url);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        const resolveSundaySchoolAccess = async () => {
            if (!member?.id) {
                setCanAccessSundaySchool(false);
                setSundaySchoolScopeLabel('');
                return;
            }
            if (roles.includes(UserRole.CHURCH_ADMINISTRATOR) || roles.includes(UserRole.PASTOR) || roles.includes(UserRole.SUNDAY_SCHOOL_ADMIN)) {
                setCanAccessSundaySchool(true);
                setSundaySchoolScopeLabel('All Departments');
                return;
            }
            const { data, error } = await supabase
                .from('church_positions')
                .select('position_category, department, position_name, specific_role, is_ministry_head')
                .eq('member_id', member.id)
                .eq('is_active', true)
                .in('position_category', [...SUNDAY_SCHOOL_POSITION_CATEGORIES]);

            if (error) {
                setCanAccessSundaySchool(false);
                return;
            }
            const teacherDepartments = deriveTeacherDepartments((data || []) as any[]);
            setCanAccessSundaySchool(teacherDepartments.length > 0);
            setSundaySchoolScopeLabel(teacherDepartments.length > 0 ? getSundaySchoolScopeLabel(teacherDepartments) : '');
        };
        resolveSundaySchoolAccess();
    }, [member?.id, roles]);

    useEffect(() => {
        if (!isAdmin) return;
        const fetchPendingRequests = async () => {
            try {
                const { data } = await supabase
                    .from('member_profile_edit_requests')
                    .select(`id, request_message, created_at, target_member_id, members!member_profile_edit_requests_target_member_id_fkey(first_name, surname)`)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(10);
                setPendingRequests(data || []);
            } catch (err) {}
        };
        fetchPendingRequests();
        const interval = setInterval(fetchPendingRequests, 30000);
        return () => clearInterval(interval);
    }, [isAdmin]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const handleSignOut = async () => {
        await signOut();
        navigate("/login");
    };

    const navItems = [
        {
            section: "OVERVIEW",
            items: [
                { to: "/", icon: LayoutDashboard, label: "Dashboard", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK, UserRole.TREASURER] },
                { to: "/announcements", icon: Bell, label: "Announcements" },
                { to: "/profile", icon: User, label: "My Profile" },
                { to: "/change-password", icon: KeyRound, label: "Change Password" }
            ]
        },
        {
            section: "REGISTRY",
            items: [
                { to: "/members", icon: Users, label: "People Directory", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK] },
                { to: "/visitors", icon: UserPlus, label: "Visitors", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK] }
            ]
        },
        {
            section: "STRUCTURE",
            items: [
                { to: "/ministries", icon: Shield, label: "Ministries", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK] }
            ]
        },
        {
            section: "ROUTINE",
            items: [
                { to: "/services", icon: Calendar, label: "Services", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK, UserRole.RECORDING_SECRETARY] },

                { to: "/sunday-school", icon: Users, label: "Sunday School", requiresSundaySchoolAccess: true },
                { to: "/goodnews-class", icon: Users, label: "Goodnews Classes", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.CHURCH_CLERK, UserRole.GOODNEWS_TEACHER] },
                { to: "/activities", icon: Calendar, label: "Activities", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.ACTIVITY_COORDINATOR, UserRole.RECORDING_SECRETARY] },
                { to: "/church-events", icon: Calendar, label: "Church Events", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK, UserRole.ACTIVITY_COORDINATOR] },
                { to: "/music-ministry", icon: UserPlus, label: "Music Ministry", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.MUSIC_MINISTER] }
            ]
        },
        {
            section: "TREASURY",
            items: [
                { to: "/finance", icon: DollarSign, label: "Financials", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.TREASURER] }
            ]
        },
        {
            section: "ADMINISTRATIVE",
            items: [
                { to: "/users", icon: Users, label: "Role Management", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR] },
                { to: "/audit-logs", icon: ActivitySquare, label: "System Audit Logs", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR] },
                { to: "/settings", icon: Settings, label: "System Settings", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR] }
            ]
        }
    ];

    const hasPermission = (item: { allowedRoles?: string[]; requiresSundaySchoolAccess?: boolean }) => {
        if (item.requiresSundaySchoolAccess) return canAccessSundaySchool;
        const allowedRoles = item.allowedRoles;
        if (!allowedRoles || allowedRoles.length === 0) return true;
        return roles.some(role => allowedRoles.includes(role));
    };

    return (
        <div className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-text-main)] w-full flex-col md:flex-row pt-14 md:pt-0 pb-20 md:pb-0">
            {/* Desktop Editorial Sidebar */}
            <aside className="hidden md:flex flex-col fixed top-0 left-0 z-40 h-screen w-64 border-r border-[var(--color-border)] bg-[var(--color-bg)] transition-all">
                {/* Logo Area */}
                <div className="flex items-center gap-3 p-6 border-b border-[var(--color-border)]">
                    <div className="w-9 h-9 rounded-none bg-[var(--color-primary)] flex items-center justify-center overflow-hidden shrink-0">
                        {churchLogoUrl ? (
                            <img src={churchLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                        ) : (
                            <Shield className="text-[var(--color-text-main)]" size={18} />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="font-bold text-sm tracking-tight text-[var(--color-text-main)] truncate">{churchName}</h1>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto py-6 space-y-6">
                    {navItems.map((group, idx) => {
                        const visibleItems = group.items.filter(item => hasPermission(item as any));
                        if (visibleItems.length === 0) return null;
                        return (
                            <div key={idx}>
                                <h3 className="px-6 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">{group.section}</h3>
                                <div className="space-y-1">
                                    {visibleItems.map((item) => {
                                        const label = item.to === "/sunday-school" && sundaySchoolScopeLabel ? `Sunday School (${sundaySchoolScopeLabel})` : item.label;
                                        return (
                                            <NavLink
                                                key={item.to}
                                                to={item.to}
                                                className={({ isActive }) => `flex items-center gap-3 px-6 py-2 transition-all duration-200 group text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-[var(--color-primary)] border-l-2 border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:border-l-2 hover:border-[var(--color-border)] border-l-2 border-transparent'}`}
                                            >
                                                <item.icon size={16} className="shrink-0" />
                                                <span className="truncate">{label}</span>
                                            </NavLink>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>
                
                {/* User Area & Sign Out */}
                <div className="p-6 border-t border-[var(--color-border)]">
                    <div className="flex items-center gap-3 mb-4">
                        {member?.profile_picture_url ? (
                            <img src={member.profile_picture_url} alt="Profile" className="w-9 h-9 rounded-none object-cover ring-1 ring-[var(--color-border)]" />
                        ) : (
                            <div className="w-9 h-9 rounded-none bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-sm font-bold uppercase ring-1 ring-[var(--color-border)]">
                                {member?.first_name ? member.first_name[0] : (user?.email?.[0] || 'U')}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[var(--color-text-main)] truncate">{member?.first_name} {member?.surname}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest truncate">{formatRoleDisplay(roles)}</p>
                        </div>
                    </div>
                    <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-0 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] hover:text-red-600 transition-colors">
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Top Header */}
            <header className="md:hidden fixed top-0 left-0 right-0 h-14 border-b border-[var(--color-border)] flex items-center justify-between px-4 bg-white/90 backdrop-blur-md z-30 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-none bg-[var(--color-primary)] flex items-center justify-center shadow-sm overflow-hidden shrink-0">
                        {churchLogoUrl ? (
                            <img src={churchLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                        ) : (
                            <Shield className="text-[var(--color-text-main)]" size={16} />
                        )}
                    </div>
                    <h2 className="text-sm font-bold truncate max-w-[150px]">{churchName}</h2>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 rounded-none">
                            <Bell size={20} className="text-gray-600" />
                            {pendingRequests.length > 0 && (
                                <span className="absolute top-1 right-1 min-w-[16px] h-[16px] bg-red-500 rounded-none border border-white text-[9px] text-[var(--color-text-main)] font-bold flex items-center justify-center">
                                    {pendingRequests.length}
                                </span>
                            )}
                        </button>
                    </div>
                    {member?.profile_picture_url ? (
                        <img src={member.profile_picture_url} alt="Profile" className="w-8 h-8 rounded-none object-cover ring-2 ring-white" />
                    ) : (
                        <div className="w-8 h-8 rounded-none bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-bold uppercase ring-2 ring-white">
                            {member?.first_name ? member.first_name[0] : (user?.email?.[0] || 'U')}
                        </div>
                    )}
                </div>
            </header>

            {/* Mobile Bottom Tab Bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-gray-200 flex items-center justify-around pb-safe pt-2 px-2 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] pb-2">
                {[{ to: "/", icon: LayoutDashboard, label: "Dash", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK, UserRole.TREASURER] },
                  { to: "/members", icon: Users, label: "Members", allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK] },

                ].map(link => {
                    if (!hasPermission(link)) return null;
                    return (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) => `flex flex-col items-center justify-center w-16 h-12 rounded-none transition-all duration-200 ${isActive ? 'text-[var(--color-primary)] font-semibold' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            <link.icon size={22} className="mb-1" />
                            <span className="text-[10px]">{link.label}</span>
                        </NavLink>
                    );
                })}
                <button 
                    onClick={toggleSidebar} 
                    className={`flex flex-col items-center justify-center w-16 h-12 rounded-none transition-all duration-200 ${sidebarOpen ? 'text-[var(--color-primary)] font-semibold' : 'text-gray-500'}`}
                >
                    <Menu size={22} className="mb-1" />
                    <span className="text-[10px]">Menu</span>
                </button>
            </nav>

            {/* Drawer (Sidebar Overlay) */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 transition-opacity backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            )}
            <aside className={`fixed top-0 right-0 z-50 h-full w-72 bg-white shadow-2xl transition-transform duration-300 transform ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-bold text-lg">Navigation</h2>
                        <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded-none"><X size={20}/></button>
                    </div>
                    <nav className="flex-1 overflow-y-auto p-4 space-y-6">
                        {navItems.map((group, idx) => {
                            const visibleItems = group.items.filter(item => hasPermission(item));
                            if (visibleItems.length === 0) return null;
                            return (
                                <div key={idx}>
                                    <h3 className="px-4 text-[0.7rem] font-bold text-gray-400 uppercase tracking-wider mb-2">{group.section}</h3>
                                    <div className="space-y-1">
                                        {visibleItems.map((item) => {
                                            const label = item.to === "/sunday-school" && sundaySchoolScopeLabel ? `Sunday School (${sundaySchoolScopeLabel})` : item.label;
                                            return (
                                                <NavLink
                                                    key={item.to}
                                                    to={item.to}
                                                    onClick={() => setSidebarOpen(false)}
                                                    className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-none transition-all duration-200 group font-medium ${isActive ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                                                >
                                                    <item.icon size={18} />
                                                    <span className="font-medium text-sm">{label}</span>
                                                </NavLink>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </nav>
                    <div className="p-4 border-t border-gray-100">
                        <button onClick={handleSignOut} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-none bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium text-sm">
                            <LogOut size={18} />
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 md:ml-64 w-full px-4 sm:px-6 lg:px-10 py-6">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
