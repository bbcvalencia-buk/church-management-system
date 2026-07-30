import { supabase } from "../lib/supabase";
import type { ChurchPosition } from "../types";

export const getMemberPositions = async (memberId: string): Promise<ChurchPosition[]> => {
    const { data, error } = await supabase.from("church_positions").select("*").eq("member_id", memberId);
    if (error) throw new Error(`Failed to fetch positions for member ${memberId}: ${error.message}`);
    return data as ChurchPosition[];
};
export const upsertChurchPosition = async (position: Partial<ChurchPosition> | Partial<ChurchPosition>[]): Promise<void> => {
    const { error } = await supabase.from("church_positions").upsert(position);
    if (error) throw new Error(`Failed to save church position: ${error.message}`);
};
export const deleteChurchPositions = async (memberId: string, positionIds: string[]): Promise<void> => {
    const { error } = await supabase.from("church_positions").delete().eq("member_id", memberId).in("id", positionIds);
    if (error) throw new Error(`Failed to delete church positions: ${error.message}`);
};
export const getTeammates = async (department: string) => {
    const { data, error } = await supabase.from("church_positions").select(`position_name, is_ministry_head, members!inner(id, first_name, surname, profile_picture_url)`).eq("department", department).eq("is_active", true);
    if (error) throw new Error(`Failed to fetch teammates: ${error.message}`);
    return data || [];
};
export const getChurchPositions = async (activeOnly = true): Promise<any[]> => {
    let query = supabase.from('church_positions').select('*, members(id, first_name, surname, profile_picture_url)').order('position_name', { ascending: true });
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch positions: ${error.message}`);
    return data || [];
};
export const updateChurchPositions = async (ids: string[], updates: Partial<ChurchPosition>): Promise<void> => {
    if (ids.length === 0) return;
    const { error } = await supabase.from('church_positions').update(updates).in('id', ids);
    if (error) throw new Error(`Failed to update positions: ${error.message}`);
};
