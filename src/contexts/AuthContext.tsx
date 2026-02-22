
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
            setLoading(false);
            return;
        }

        // Keep loading=true (set by caller) until everything resolves
        try {
            // Find member by email
            const { data: memberData } = await supabase
                .from('members')
                .select('*')
                .eq('email', email)
                .single();

            if (memberData) {
                setMember(memberData);

                // Fetch roles for this member
                const { data: roleData } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('member_id', memberData.id);

                setRoles(roleData ? roleData.map((r: any) => r.role) : []);
            } else {
                // No member record matched by email — try looking up by auth user id
                const { data: currentUser } = await supabase.auth.getUser();
                if (currentUser?.user?.id) {
                    const { data: roleData } = await supabase
                        .from('user_roles')
                        .select('role')
                        .eq('user_id', currentUser.user.id);
                    if (roleData && roleData.length > 0) {
                        setRoles(roleData.map((r: any) => r.role));
                    }
                }
                console.log('No member record found for this user email.');
            }
        } catch (error) {
            console.error('Error loading member profile:', error);
        } finally {
            // Only unblock rendering AFTER both member and roles are set
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
