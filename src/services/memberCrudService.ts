import { supabase } from "../lib/supabase";
import type { Member } from "../types";

export const getAllMembers = async (): Promise<Member[]> => {
    const { data, error } = await supabase.from("members").select("*").order("surname", { ascending: true });
    return data as Member[];
};
export const getActiveMembers = async (): Promise<Member[]> => {
    const { data, error } = await supabase.from("members").select("*").eq("membership_status", "active").order("surname", { ascending: true });
    if (error) throw new Error(`Failed to fetch active members: ${error.message}`);
    return data as Member[];
};
export const getActiveMembersWithPositions = async (): Promise<any[]> => {
    const { data, error } = await supabase.from("members").select(`id, first_name, surname, member_number, profile_picture_url, church_positions (position_name, is_active)`).eq("membership_status", "active").order("surname", { ascending: true });
    if (error) throw new Error(`Failed to fetch active members with positions: ${error.message}`);
    return data || [];
};
export const getMemberById = async (id: string): Promise<Member> => {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_member_by_id', { target_id: id });
    if (!rpcError && rpcData) return rpcData as Member;
    const { data, error } = await supabase.from("members").select("*").eq("id", id).single();
    if (error) throw new Error(`Failed to fetch member with ID ${id}: ${error.message}`);
    return data as Member;
};
export const upsertMember = async (memberData: Partial<Member>): Promise<Member> => {
    const { data, error } = await supabase.from("members").upsert(memberData).select().single();
    if (error) throw new Error(`Failed to save member: ${error.message}`);
    return data as Member;
};
export const deleteMember = async (id: string): Promise<void> => {
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) throw new Error(`Failed to delete member with ID ${id}: ${error.message}`);
};
export const searchMembers = async (query: string, limit: number = 20): Promise<Member[]> => {
    let req = supabase.from('members').select('*').order('surname').limit(limit);
    if (query) req = req.or(`first_name.ilike.%${query}%,surname.ilike.%${query}%,member_number.ilike.%${query}%`);
    const { data, error } = await req;
    if (error) throw new Error(`Failed to search members: ${error.message}`);
    return data as Member[];
};
export const getMemberCount = async (): Promise<number> => {
    const { count, error } = await supabase.from('members').select('id', { count: 'exact', head: true });
    if (error) throw new Error(`Failed to get member count: ${error.message}`);
    return count ?? 0;
};
export const updateMember = async (id: string, memberData: Partial<Member>): Promise<Member> => {
    const { error } = await supabase.from("members").update(memberData).eq("id", id);
    if (error) throw new Error(`Failed to update member: ${error.message}`);
    const { data: updatedRow } = await supabase.from("members").select("*").eq("id", id).maybeSingle();
    if (updatedRow) return updatedRow as Member;
    return { id, ...memberData } as Member;
};
export const createMember = async (memberData: Omit<Partial<Member>, 'id'>): Promise<Member> => {
    const { data, error } = await supabase.from("members").insert(memberData).select().single();
    if (error) throw new Error(`Failed to create member: ${error.message}`);
    return data as Member;
};
export const isVisitorMember = async (id: string): Promise<boolean> => {
    const { data, error } = await supabase.from('visitors').select('id').eq('member_id', id).maybeSingle();
    if (error) return false;
    return !!data;
};
export const getMembersBySurname = async (surname: string): Promise<Member[]> => {
    const { data, error } = await supabase.from("members").select("*").ilike("surname", surname).order("date_of_birth", { ascending: true });
    if (error) throw new Error(`Failed to fetch family members: ${error.message}`);
    return data as Member[];
};
