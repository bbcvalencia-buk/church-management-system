import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import MembersDirectory from './views/MembersDirectory';
import MemberProfile from './views/MemberProfile';
import FamilyProfile from './views/FamilyProfile';
import MemberIDPrint from './views/MemberIDPrint';
import VisitorList from './views/VisitorList';
import VisitorForm from './views/VisitorForm';
import MinistryDirectory from './views/MinistryDirectory';
import ServiceList from './views/ServiceList';
import ServiceForm from './views/ServiceForm';

import SundaySchool from './views/SundaySchool';
import TreasuryDashboard from './views/TreasuryDashboard';
import FinancialRecordForm from './views/FinancialRecordForm';
import FinancialReportPrint from './views/FinancialReportPrint';
import FaithPromiseStatementPrint from './views/FaithPromiseStatementPrint';
import MyFinancialRecords from './views/MyFinancialRecords';
import SystemSettings from './views/SystemSettings';
import Activities from './views/Activities';
import GoodnewsClass from './views/GoodnewsClass';
import MusicMinistry from './views/MusicMinistry';
import Dashboard from './views/Dashboard';
import Announcements from './views/Announcements';
import RoleManagement from './views/RoleManagement';
import ChurchEvents from './views/ChurchEvents';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { supabase } from './lib/supabase';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './views/Login';
import SetPassword from './views/SetPassword';
import ResetPassword from './views/ResetPassword';
import ChangePassword from './views/ChangePassword';
import AuditLogs from './views/AuditLogs';
import { UserRole } from './types';
import { deriveTeacherDepartments, SUNDAY_SCHOOL_POSITION_CATEGORIES } from './lib/sundaySchoolAccess';

const CLERK_ROLES = [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK];
const CLERK_WRITE_ROLES = [UserRole.CHURCH_ADMINISTRATOR, UserRole.CHURCH_CLERK];
const SERVICE_ROLES = [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK, UserRole.RECORDING_SECRETARY];
const SERVICE_WRITE_ROLES = [UserRole.CHURCH_ADMINISTRATOR, UserRole.CHURCH_CLERK, UserRole.RECORDING_SECRETARY];
const DASHBOARD_ROLES = [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK, UserRole.TREASURER];
const SUNDAY_SCHOOL_ROLES = [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.SUNDAY_SCHOOL_ADMIN];
const SUNDAY_SCHOOL_TEACHER_ROLES = [
  UserRole.SUNDAY_SCHOOL_TEACHER_BEGINNERS,
  UserRole.SUNDAY_SCHOOL_TEACHER_CHILDREN,
  UserRole.SUNDAY_SCHOOL_TEACHER_ADULT
];
const ACTIVITY_ROLES = [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.ACTIVITY_COORDINATOR, UserRole.RECORDING_SECRETARY];
const MUSIC_ROLES = [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.MUSIC_MINISTER];
const GOODNEWS_ROLES = [UserRole.CHURCH_ADMINISTRATOR, UserRole.CHURCH_CLERK, UserRole.GOODNEWS_TEACHER];
const TREASURY_ROLES = [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.TREASURER];
const TREASURY_WRITE_ROLES = [UserRole.CHURCH_ADMINISTRATOR, UserRole.TREASURER];
const ADMIN_ROLES = [UserRole.CHURCH_ADMINISTRATOR];
const CHURCH_EVENT_ROLES = [UserRole.CHURCH_ADMINISTRATOR, UserRole.CHURCH_CLERK, UserRole.ACTIVITY_COORDINATOR, UserRole.PASTOR, UserRole.RECORDING_SECRETARY];
const MEMBER_ROLES = [UserRole.MEMBER];
const MEMBER_PROFILE_MANAGER_ROLES = [UserRole.CHURCH_ADMINISTRATOR, UserRole.PASTOR, UserRole.CHURCH_CLERK, UserRole.SUNDAY_SCHOOL_ADMIN];

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-[#111] flex items-center justify-center text-[var(--color-text-main)]">Loading...</div>
);

const hasAllowedRole = (userRoles: string[], allowedRoles: UserRole[]) => {
  if (allowedRoles.length === 0) return true;
  if (userRoles.includes(UserRole.CHURCH_ADMINISTRATOR)) return true;
  return allowedRoles.some(role => userRoles.includes(role));
};

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const RequireRoles: React.FC<{ allowedRoles: UserRole[]; children: React.ReactNode }> = ({ allowedRoles, children }) => {
  const { roles, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!hasAllowedRole(roles, allowedRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

const RequireRolesOrRedirect: React.FC<{ allowedRoles: UserRole[]; redirectTo: string; children: React.ReactNode }> = ({ allowedRoles, redirectTo, children }) => {
  const { roles, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!hasAllowedRole(roles, allowedRoles)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

const RequireSundaySchoolAccess: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { roles, member, loading } = useAuth();
  const [checkingTeacherAccess, setCheckingTeacherAccess] = useState(true);
  const [hasTeacherAccess, setHasTeacherAccess] = useState(false);

  useEffect(() => {
    const checkTeacherAccess = async () => {
      if (loading) return;

      if (hasAllowedRole(roles, [...SUNDAY_SCHOOL_ROLES, ...SUNDAY_SCHOOL_TEACHER_ROLES])) {
        setHasTeacherAccess(true);
        setCheckingTeacherAccess(false);
        return;
      }

      if (!member?.id) {
        setHasTeacherAccess(false);
        setCheckingTeacherAccess(false);
        return;
      }

      setCheckingTeacherAccess(true);
      const { data, error } = await supabase
        .from('church_positions')
        .select('position_category, department, position_name, specific_role, is_ministry_head')
        .eq('member_id', member.id)
        .eq('is_active', true)
        .in('position_category', [...SUNDAY_SCHOOL_POSITION_CATEGORIES]);

      if (error) {
        console.error('Failed to verify Sunday School teacher access:', error);
        setHasTeacherAccess(false);
        setCheckingTeacherAccess(false);
        return;
      }

      const departments = deriveTeacherDepartments((data || []) as any[], roles);
      setHasTeacherAccess(departments.length > 0);
      setCheckingTeacherAccess(false);
    };

    checkTeacherAccess();
  }, [loading, roles, member?.id]);

  if (loading || checkingTeacherAccess) {
    return <LoadingScreen />;
  }

  if (!hasTeacherAccess) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

const RequireMemberProfileAccess: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { roles, member, loading } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [checkingScopedAccess, setCheckingScopedAccess] = useState(true);
  const [hasScopedAccess, setHasScopedAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (loading) return;

      if (!id) {
        setHasScopedAccess(false);
        setCheckingScopedAccess(false);
        return;
      }

      if (member?.id === id || hasAllowedRole(roles, MEMBER_PROFILE_MANAGER_ROLES)) {
        setHasScopedAccess(true);
        setCheckingScopedAccess(false);
        return;
      }

      if (!member?.id) {
        setHasScopedAccess(false);
        setCheckingScopedAccess(false);
        return;
      }

      setCheckingScopedAccess(true);
      const { data, error } = await supabase
        .from('church_positions')
        .select('id')
        .eq('member_id', id)
        .eq('is_active', true)
        .in('position_category', [...SUNDAY_SCHOOL_POSITION_CATEGORIES])
        .limit(1);

      if (error) {
        console.error('Failed to verify member profile access:', error);
        setHasScopedAccess(false);
        setCheckingScopedAccess(false);
        return;
      }

      setHasScopedAccess((data || []).length > 0);
      setCheckingScopedAccess(false);
    };

    checkAccess();
  }, [loading, id, member?.id, roles]);

  if (loading || checkingScopedAccess) {
    return <LoadingScreen />;
  }

  if (!hasScopedAccess) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

const RequireSelfOrRoles: React.FC<{ allowedRoles: UserRole[]; children: React.ReactNode }> = ({ allowedRoles, children }) => {
  const { roles, member, loading } = useAuth();
  const { id } = useParams<{ id: string }>();

  if (loading) {
    return <LoadingScreen />;
  }

  if (hasAllowedRole(roles, allowedRoles)) {
    return <>{children}</>;
  }

  if (id && member?.id === id) {
    return <>{children}</>;
  }

  return <Navigate to="/unauthorized" replace />;
};

const AccessDenied: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto mt-10 bg-white border border-red-100 rounded-none p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-red-600">Access Restricted</h1>
      <p className="text-sm text-gray-600 mt-2">
        You are unable to access this section. Please contact the administrator.
      </p>
      <button
        onClick={() => navigate('/')}
        className="mt-6 px-4 py-2 rounded-none bg-[var(--color-primary)] text-white hover:opacity-90"
      >
        Return to Dashboard
      </button>
    </div>
  );
};

const HomeLanding: React.FC = () => {
  const { roles, loading } = useAuth();

  // AuthContext blocks children (via {!loading && children}) until both member
  // and roles are fully fetched. So by the time this renders, roles is definitive.
  if (loading) {
    return <LoadingScreen />;
  }

  if (hasAllowedRole(roles, DASHBOARD_ROLES)) {
    return <Dashboard />;
  }

  if (hasAllowedRole(roles, [UserRole.RECORDING_SECRETARY])) {
    return <Navigate to="/services" replace />;
  }

  if (hasAllowedRole(roles, [...SUNDAY_SCHOOL_ROLES, ...SUNDAY_SCHOOL_TEACHER_ROLES])) {
    return <Navigate to="/sunday-school" replace />;
  }

  if (hasAllowedRole(roles, MUSIC_ROLES)) {
    return <Navigate to="/music-ministry" replace />;
  }

  if (hasAllowedRole(roles, ACTIVITY_ROLES)) {
    return <Navigate to="/activities" replace />;
  }

  if (hasAllowedRole(roles, TREASURY_ROLES)) {
    return <Navigate to="/finance" replace />;
  }

  if (hasAllowedRole(roles, CLERK_ROLES)) {
    return <Navigate to="/members" replace />;
  }

  if (hasAllowedRole(roles, MEMBER_ROLES)) {
    return <Navigate to="/profile" replace />;
  }

  return <Navigate to="/unauthorized" replace />;
};

const MyProfileRedirect: React.FC = () => {
  const { member, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!member?.id) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Navigate to={`/members/${member.id}`} replace />;
};

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/set-password" element={<SetPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route
                path="/"
                element={
                  <RequireAuth>
                    <Layout />
                  </RequireAuth>
                }
              >
                <Route index element={<HomeLanding />} />
                <Route path="unauthorized" element={<AccessDenied />} />

                <Route
                  path="members"
                  element={<RequireRoles allowedRoles={CLERK_ROLES}><MembersDirectory /></RequireRoles>}
                />
                <Route
                  path="members/new"
                  element={<RequireRoles allowedRoles={CLERK_WRITE_ROLES}><MemberProfile /></RequireRoles>}
                />
                <Route
                  path="members/:id"
                  element={<RequireMemberProfileAccess><MemberProfile /></RequireMemberProfileAccess>}
                />
                <Route path="profile" element={<MyProfileRedirect />} />
                <Route path="change-password" element={<ChangePassword />} />
                <Route path="announcements" element={<Announcements />} />
                <Route
                  path="families/:surname"
                  element={<RequireRoles allowedRoles={CLERK_ROLES}><FamilyProfile /></RequireRoles>}
                />
                <Route
                  path="visitors"
                  element={<RequireRoles allowedRoles={CLERK_ROLES}><VisitorList /></RequireRoles>}
                />
                <Route
                  path="visitors/new"
                  element={<RequireRoles allowedRoles={CLERK_WRITE_ROLES}><VisitorForm /></RequireRoles>}
                />
                <Route
                  path="visitors/:id"
                  element={<RequireRoles allowedRoles={CLERK_WRITE_ROLES}><VisitorForm /></RequireRoles>}
                />

                <Route
                  path="ministries"
                  element={<RequireRoles allowedRoles={CLERK_ROLES}><MinistryDirectory /></RequireRoles>}
                />

                <Route
                  path="services"
                  element={<RequireRoles allowedRoles={SERVICE_ROLES}><ServiceList /></RequireRoles>}
                />
                <Route
                  path="services/new"
                  element={<RequireRoles allowedRoles={SERVICE_WRITE_ROLES}><ServiceForm /></RequireRoles>}
                />
                <Route
                  path="services/:id"
                  element={<RequireRoles allowedRoles={SERVICE_WRITE_ROLES}><ServiceForm /></RequireRoles>}
                />

                <Route
                  path="sunday-school"
                  element={<RequireSundaySchoolAccess><SundaySchool /></RequireSundaySchoolAccess>}
                />
                <Route
                  path="activities"
                  element={<RequireRoles allowedRoles={ACTIVITY_ROLES}><Activities /></RequireRoles>}
                />
                <Route
                  path="church-events"
                  element={<RequireRoles allowedRoles={CHURCH_EVENT_ROLES}><ChurchEvents /></RequireRoles>}
                />
                <Route
                  path="goodnews-class"
                  element={<RequireRoles allowedRoles={GOODNEWS_ROLES}><GoodnewsClass /></RequireRoles>}
                />
                <Route
                  path="music-ministry"
                  element={<RequireRoles allowedRoles={MUSIC_ROLES}><MusicMinistry /></RequireRoles>}
                />
                <Route
                  path="finance"
                  element={<RequireRoles allowedRoles={TREASURY_ROLES}><TreasuryDashboard /></RequireRoles>}
                />
                <Route
                  path="finance/new"
                  element={<RequireRoles allowedRoles={TREASURY_WRITE_ROLES}><FinancialRecordForm /></RequireRoles>}
                />
                <Route
                  path="finance/:id"
                  element={<RequireRoles allowedRoles={TREASURY_WRITE_ROLES}><FinancialRecordForm /></RequireRoles>}
                />
                <Route
                  path="finance/reports"
                  element={<RequireRoles allowedRoles={TREASURY_ROLES}><FinancialReportPrint /></RequireRoles>}
                />
                <Route
                  path="finance/faith-promise-print"
                  element={<RequireRoles allowedRoles={TREASURY_ROLES}><FaithPromiseStatementPrint /></RequireRoles>}
                />

                <Route
                  path="settings"
                  element={<RequireRolesOrRedirect allowedRoles={ADMIN_ROLES} redirectTo="/announcements"><SystemSettings /></RequireRolesOrRedirect>}
                />
                <Route
                  path="audit-logs"
                  element={<RequireRoles allowedRoles={ADMIN_ROLES}><AuditLogs /></RequireRoles>}
                />
                <Route
                  path="users"
                  element={<RequireRoles allowedRoles={ADMIN_ROLES}><RoleManagement /></RequireRoles>}
                />
                <Route
                  path="my-financial-records"
                  element={<RequireRoles allowedRoles={MEMBER_ROLES}><MyFinancialRecords /></RequireRoles>}
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>

              <Route
                path="members/:id/print-id"
                element={
                  <RequireAuth>
                    <RequireRoles allowedRoles={CLERK_ROLES}>
                      <MemberIDPrint />
                    </RequireRoles>
                  </RequireAuth>
                }
              />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
