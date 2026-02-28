
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { deriveTeacherDepartments, SUNDAY_SCHOOL_POSITION_CATEGORIES } from '@/lib/sundaySchoolAccess';
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
    ActivitySquare
} from 'lucide-react';

// Human-friendly role labels (short versions for the header)
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
    // Filter out 'member' if they have other roles
    const meaningful = userRoles.filter(r => r !== 'member');
    const display = (meaningful.length > 0 ? meaningful : userRoles)
        .map(r => ROLE_DISPLAY_LABELS[r] || r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
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

    // Notification state
    const [notifOpen, setNotifOpen] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [notifLoading, setNotifLoading] = useState(false);
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
                return;
            }

            if (roles.includes(UserRole.CHURCH_ADMINISTRATOR) || roles.includes(UserRole.PASTOR) || roles.includes(UserRole.SUNDAY_SCHOOL_ADMIN)) {
                setCanAccessSundaySchool(true);
                return;
            }

            const { data, error } = await supabase
                .from('church_positions')
                .select('position_category, department, position_name, specific_role, is_ministry_head')
                .eq('member_id', member.id)
                .eq('is_active', true)
                .in('position_category', [...SUNDAY_SCHOOL_POSITION_CATEGORIES]);

            if (error) {
                console.error('Failed to evaluate Sunday School sidebar access:', error);
                setCanAccessSundaySchool(false);
                return;
            }

            const teacherDepartments = deriveTeacherDepartments((data || []) as any[]);
            setCanAccessSundaySchool(teacherDepartments.length > 0);
        };

        resolveSundaySchoolAccess();
    }, [member?.id, roles]);

    // Fetch pending edit requests for admins
    useEffect(() => {
        if (!isAdmin) return;
        const fetchPendingRequests = async () => {
            try {
                const { data } = await supabase
                    .from('member_profile_edit_requests')
                    .select(`
                        id,
                        request_message,
                        created_at,
                        target_member_id,
                        members!member_profile_edit_requests_target_member_id_fkey(first_name, surname)
                    `)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(10);
                setPendingRequests(data || []);
            } catch (err) {
                console.error('Failed to fetch edit requests:', err);
            }
        };
        fetchPendingRequests();
        // Poll every 30 seconds
        const interval = setInterval(fetchPendingRequests, 30000);
        return () => clearInterval(interval);
    }, [isAdmin]);

    // Close notif dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const navItems = [
        {
            section: 'OVERVIEW',
            items: [
                { to: '/', icon: LayoutDashboard, label: 'Dashboard', allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK, UserRole.TREASURER] },
                { to: '/announcements', icon: Bell, label: 'Announcements' },
                { to: '/profile', icon: User, label: 'My Profile' },
                { to: '/change-password', icon: KeyRound, label: 'Change Password' }
            ]
        },
        {
            section: 'REGISTRY',
            items: [
                { to: '/members', icon: Users, label: 'Members', allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK] },
                { to: '/visitors', icon: UserPlus, label: 'Visitors', allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK] }
            ]
        },
        {
            section: 'STRUCTURE',
            items: [
                { to: '/ministries', icon: Shield, label: 'Ministries', allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK] }
            ]
        },
        {
            section: 'ROUTINE',
            items: [
                { to: '/services', icon: Calendar, label: 'Services', allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK, UserRole.RECORDING_SECRETARY] },
                { to: '/sunday-school', icon: Users, label: 'Sunday School', requiresSundaySchoolAccess: true },
                { to: '/goodnews-class', icon: Users, label: 'Goodnews Classes', allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.CHURCH_CLERK, UserRole.GOODNEWS_TEACHER] },
                { to: '/activities', icon: Calendar, label: 'Activities', allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.ACTIVITY_COORDINATOR, UserRole.RECORDING_SECRETARY] },
                { to: '/church-events', icon: Calendar, label: 'Church Events', allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK, UserRole.ACTIVITY_COORDINATOR] },
                { to: '/music-ministry', icon: UserPlus, label: 'Music Ministry', allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.MUSIC_MINISTER] }
            ]
        },
        {
            section: 'TREASURY',
            items: [
                { to: '/finance', icon: DollarSign, label: 'Financials', allowedRoles: [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.TREASURER] }
            ]
        },
        {
            section: 'ADMINISTRATIVE',
            items: [
                { to: '/users', icon: Users, label: 'Role Management', allowedRoles: [UserRole.CHURCH_ADMINISTRATOR] },
                { to: '/audit-logs', icon: ActivitySquare, label: 'System Audit Logs', allowedRoles: [UserRole.CHURCH_ADMINISTRATOR] },
                { to: '/settings', icon: Settings, label: 'System Settings', allowedRoles: [UserRole.CHURCH_ADMINISTRATOR] }
            ]
        }
    ];

    // Helper to check permission
    const hasPermission = (item: { allowedRoles?: string[]; requiresSundaySchoolAccess?: boolean }) => {
        if (item.requiresSundaySchoolAccess) return canAccessSundaySchool;
        const allowedRoles = item.allowedRoles;
        if (!allowedRoles || allowedRoles.length === 0) return true;
        return roles.some(role => allowedRoles.includes(role));
    };

    return (
        <div className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-text-main)] w-full">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden print:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 z-50 h-full w-64 bg-[var(--color-surface)] border-r border-[var(--color-border)] shadow-sm transition-transform duration-300 print:hidden lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="p-6 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shadow-md shadow-blue-500/20 overflow-hidden">
                            {churchLogoUrl ? (
                                <img src={churchLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                            ) : (
                                <Shield className="text-white" size={24} />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="font-bold text-lg tracking-tight text-[var(--color-text-main)] truncate">{churchName}</h1>
                            <p className="text-xs text-[var(--color-text-muted)] truncate">{systemName}</p>
                        </div>
                        <button className="ml-auto lg:hidden flex-shrink-0" onClick={toggleSidebar}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto p-4 space-y-6">
                        {navItems.map((group, idx) => {
                            // Filter items based on role
                            const visibleItems = group.items.filter(item => hasPermission(item));

                            if (visibleItems.length === 0) return null;

                            return (
                                <div key={idx}>
                                    <h3 className="px-4 text-[0.7rem] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                                        {group.section}
                                    </h3>
                                    <div className="space-y-1">
                                        {visibleItems.map((item) => (
                                            <NavLink
                                                key={item.to}
                                                to={item.to}
                                                onClick={() => setSidebarOpen(false)}
                                                className={({ isActive }) => `
                            flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group font-medium
                            ${isActive
                                                        ? 'bg-gray-100 text-[var(--color-primary)]'
                                                        : 'text-[var(--color-text-muted)] hover:bg-gray-50 hover:text-[var(--color-text-main)]'
                                                    }
                          `}
                                            >
                                                <item.icon size={18} />
                                                <span className="font-medium text-sm">{item.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </nav>

                    {/* Footer - Sign Out */}
                    <div className="p-4 border-t border-[var(--color-border)]">
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors pointer"
                        >
                            <LogOut size={18} />
                            <span className="font-medium text-sm">Sign Out</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* Top Header */}
                <header className="h-14 sm:h-16 border-b border-[var(--color-border)] flex items-center justify-between px-3 sm:px-6 bg-white/80 sticky top-0 z-30 print:hidden backdrop-blur-sm">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <button
                            onClick={toggleSidebar}
                            className="lg:hidden p-2 hover:bg-slate-100 text-[var(--color-text-main)] rounded-lg transition-colors"
                        >
                            <Menu size={20} />
                        </button>
                        <h2 className="text-base sm:text-lg font-semibold hidden sm:block truncate">{churchName}</h2>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* Notification Bell */}
                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={() => setNotifOpen(!notifOpen)}
                                className="relative cursor-pointer hover:bg-slate-100 p-2 rounded-full transition-colors"
                            >
                                <Bell size={20} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors" />
                                {pendingRequests.length > 0 && (
                                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white text-[10px] text-white font-bold flex items-center justify-center">
                                        {pendingRequests.length}
                                    </span>
                                )}
                            </button>

                            {/* Notification Dropdown */}
                            {notifOpen && (
                                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">
                                    <div className="p-4 border-b border-gray-100">
                                        <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                                    </div>
                                    <div className="max-h-[320px] overflow-y-auto">
                                        {pendingRequests.length > 0 ? (
                                            pendingRequests.map((req) => (
                                                <Link
                                                    key={req.id}
                                                    to={`/members/${req.target_member_id}`}
                                                    onClick={() => setNotifOpen(false)}
                                                    className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors border-b border-gray-50"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                                                        <MessageSquare size={14} className="text-amber-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-gray-900 truncate">
                                                            Edit request: {req.members?.first_name} {req.members?.surname}
                                                        </p>
                                                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{req.request_message}</p>
                                                        <p className="text-[10px] text-gray-400 mt-1">
                                                            {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </Link>
                                            ))
                                        ) : (
                                            <div className="p-6 text-center text-sm text-gray-400">
                                                No new notifications
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="h-8 w-[1px] bg-[var(--color-border)] mx-0 sm:mx-2 hidden sm:block"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium">
                                    {member ? `${member.first_name} ${member.surname}` : (user?.email?.split('@')[0] || 'User')}
                                </p>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    {formatRoleDisplay(roles)}
                                </p>
                            </div>
                            {member?.profile_picture_url ? (
                                <img
                                    src={member.profile_picture_url}
                                    alt="Profile"
                                    className="w-9 h-9 rounded-full object-cover shadow-md ring-2 ring-white"
                                />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-sm font-bold shadow-md uppercase ring-2 ring-white">
                                    {member?.first_name ? member.first_name[0] : (user?.email?.[0] || 'U')}
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto w-full">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Layout;
