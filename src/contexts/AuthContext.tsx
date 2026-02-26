
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

// Define the shape of our AuthContext
interface AuthContextType {
    session: Session | null;
    user: User | null;
    member: any | null; // The linked member record
    roles: string[];    // Array of roles assigned to this member e.g., ['treasurer', 'deacon']
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    member: null,
    roles: [],
    loading: true,
    signOut: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [member, setMember] = useState<any | null>(null);
    const [roles, setRoles] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Check active session on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                // fetchMemberProfile will set loading=false when done
                fetchMemberProfile(session.user.email);
            } else {
                setLoading(false);
            }
        });

        // 2. Listen for auth changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                // Immediately set loading=true so children are blocked while
                // we fetch the member profile and roles. This prevents HomeLanding
                // from rendering with empty roles and redirecting to /unauthorized.
                setLoading(true);
                fetchMemberProfile(session.user.email);
            } else {
                setMember(null);
                setRoles([]);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchMemberProfile = async (email: string | undefined) => {
        if (!email) {
            console.warn('[Auth] No email provided for member lookup');
            setLoading(false);
            return;
        }

        console.log('[Auth] ========== ROLE FETCH START ==========');
        console.log('[Auth] JWT email:', email);

        try {
            // Use a single SECURITY DEFINER RPC call that bypasses all RLS
            // This avoids "infinite recursion detected in policy for relation members"
            const { data, error } = await supabase.rpc('get_my_profile_and_roles');

            if (error) {
                console.error('[Auth] RPC get_my_profile_and_roles error:', error.message);
                // Fallback: no member/roles
                setMember(null);
                setRoles([]);
                return;
            }

            console.log('[Auth] RPC result:', data);

            if (data?.member) {
                console.log('[Auth] Found member:', data.member.first_name, data.member.surname, '(id:', data.member.id, ')');
                setMember(data.member);
            } else {
                console.warn('[Auth] No member record found for this user');
                setMember(null);
            }

            if (data?.roles && Array.isArray(data.roles) && data.roles.length > 0) {
                console.log('[Auth] Roles:', data.roles);
                setRoles(data.roles);
            } else {
                console.warn('[Auth] No roles found for this user');
                setRoles([]);
            }

            console.log('[Auth] ========== ROLE FETCH COMPLETE ==========');
        } catch (error) {
            console.error('[Auth] Error loading member profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setMember(null);
        setRoles([]);
    };

    return (
        <AuthContext.Provider value={{ session, user, member, roles, loading, signOut }}>
            {/* Block all child rendering until member profile + roles are fully loaded.
                This prevents HomeLanding from seeing empty roles and redirecting prematurely. */}
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
