import { supabase } from "../lib/supabase";
import type { ChurchPosition, Ministry, MinistryAssignment, MinistryCategory } from "../types";
import { isMissingTableError, markTableMissing } from "./supabaseErrorUtils";

export interface MinistryAssignmentView extends ChurchPosition {
    ministry_id?: string;
    ministry?: Ministry;
    members: {
        id: string;
        first_name: string;
        surname: string;
        profile_picture_url?: string;
        member_number?: string;
        phone_number?: string;
    } | null;
}

interface AssignmentMember {
    id: string;
    first_name: string;
    surname: string;
    profile_picture_url?: string;
    member_number?: string;
    phone_number?: string;
}

interface MinistryAssignmentRow {
    id: string;
    member_id: string;
    ministry_id: string;
    role_name: string;
    is_leader: boolean;
    start_date: string;
    end_date?: string | null;
    status: "active" | "inactive";
    ministry?: Ministry | null;
    ministries?: Ministry | null;
    members?: AssignmentMember | null;
}

interface MusicMinistryAssignmentRow {
    member_id: string;
    role_name: string;
    ministry?: Ministry | Ministry[] | null;
}

export interface MusicMinistryAssignment {
    member_id: string;
    department: string;
    position_name: string;
    ministry_id: string;
    ministry_code: string;
}

type LegacyPositionPayload = Partial<ChurchPosition> & {
    id?: string;
    member_id: string;
    position_name: string;
};

const LEGACY_TO_MINISTRY_CATEGORY: Record<string, MinistryCategory> = {
    leadership: "leadership",
    music_ministry: "music_ministry",
    sunday_school_adult: "sunday_school",
    sunday_school_children: "sunday_school",
    beginners_class: "sunday_school",
    other_ministries: "operations",
};

const MINISTRY_TO_LEGACY_CATEGORY: Record<MinistryCategory, ChurchPosition["position_category"]> = {
    leadership: "leadership",
    music_ministry: "music_ministry",
    sunday_school: "sunday_school_adult",
    operations: "other_ministries",
    other_ministries: "other_ministries",
};

const slugCode = (value: string) => {
    const code = value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return code || "MINISTRY";
};

const toMinistryCategory = (category?: string | null): MinistryCategory =>
    LEGACY_TO_MINISTRY_CATEGORY[category || ""] || "other_ministries";

const toLegacyCategory = (category?: MinistryCategory | null): ChurchPosition["position_category"] =>
    MINISTRY_TO_LEGACY_CATEGORY[category || "other_ministries"];

const mapAssignment = (row: MinistryAssignmentRow): MinistryAssignmentView => {
    const ministry = row.ministry || row.ministries || undefined;
    return {
        id: row.id,
        member_id: row.member_id,
        ministry_id: row.ministry_id,
        ministry,
        position_name: row.role_name,
        position_category: toLegacyCategory(ministry?.category),
        department: ministry?.name || "",
        specific_role: row.role_name,
        is_ministry_head: row.is_leader,
        start_date: row.start_date,
        end_date: row.end_date || undefined,
        is_active: row.status === "active" && ministry?.is_active !== false,
        assignment_reason: ministry?.schedule || null,
        members: row.members || null,
    };
};

const ensureMinistry = async (payload: {
    name: string;
    category?: string | null;
    schedule?: string | null;
}): Promise<Ministry> => {
    const name = payload.name.trim();
    if (!name) throw new Error("Ministry group / department is required.");

    const code = slugCode(name);
    const category = toMinistryCategory(payload.category);

    const { data, error } = await supabase
        .from("ministries")
        .upsert({
            code,
            name,
            category,
            schedule: payload.schedule || null,
            is_active: true,
        }, { onConflict: "code" })
        .select("*")
        .single();

    if (error) throw new Error(`Failed to save ministry: ${error.message}`);
    return data as Ministry;
};

export const getMinistryAssignments = async (activeOnly = true): Promise<MinistryAssignmentView[]> => {
    let query = supabase
        .from("ministry_assignments")
        .select(`
            *,
            ministry:ministries(*),
            members(id, first_name, surname, profile_picture_url, member_number, phone_number)
        `)
        .order("role_name", { ascending: true });

    if (activeOnly) {
        query = query.eq("status", "active");
    }

    const { data, error } = await query;
    if (error) {
        if (isMissingTableError(error)) {
            markTableMissing("ministry_assignments");
        }
        throw new Error(`Failed to fetch ministry assignments: ${error.message}`);
    }

    return ((data || []) as unknown as MinistryAssignmentRow[]).map(mapAssignment);
};

export const upsertMinistryAssignmentsFromPositions = async (
    positions: LegacyPositionPayload[]
): Promise<void> => {
    for (const position of positions) {
        const ministry = await ensureMinistry({
            name: position.department || position.position_name,
            category: position.position_category,
            schedule: position.assignment_reason || null,
        });

        const payload: Partial<MinistryAssignment> = {
            member_id: position.member_id,
            ministry_id: ministry.id,
            role_name: position.position_name,
            is_leader: !!position.is_ministry_head,
            start_date: position.start_date || new Date().toISOString().split("T")[0],
            end_date: position.end_date || null,
            status: position.is_active === false ? "inactive" : "active",
        };

        if (position.id) {
            payload.id = position.id;
        }

        const { error } = await supabase
            .from("ministry_assignments")
            .upsert(payload)
            .select("id");

        if (error) {
            throw new Error(`Failed to save ministry assignment: ${error.message}`);
        }
    }
};

export const updateMinistry = async (
    id: string,
    updates: Partial<Pick<Ministry, "name" | "category" | "schedule" | "description" | "is_active">>
): Promise<void> => {
    const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
    if (updates.name) {
        payload.name = updates.name.trim();
    }

    const { error } = await supabase
        .from("ministries")
        .update(payload)
        .eq("id", id);

    if (error) throw new Error(`Failed to update ministry: ${error.message}`);
};

export const updateMinistryAssignments = async (
    ids: string[],
    updates: Partial<Pick<MinistryAssignment, "role_name" | "is_leader" | "start_date" | "end_date" | "status">>
): Promise<void> => {
    if (ids.length === 0) return;
    const { error } = await supabase
        .from("ministry_assignments")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .in("id", ids);

    if (error) throw new Error(`Failed to update ministry assignments: ${error.message}`);
};

export const deactivateMinistryAssignment = async (id: string): Promise<void> => {
    await updateMinistryAssignments([id], {
        status: "inactive",
        end_date: new Date().toISOString().split("T")[0],
    });
};

export const getMusicMinistryAssignments = async (): Promise<MusicMinistryAssignment[]> => {
    const { data, error } = await supabase
        .from("ministry_assignments")
        .select(`
            member_id,
            role_name,
            ministry:ministries!inner(id, name, code, category)
        `)
        .eq("status", "active")
        .eq("ministries.category", "music_ministry");

    if (error) throw new Error(`Failed to fetch music ministry assignments: ${error.message}`);

    return ((data || []) as unknown as MusicMinistryAssignmentRow[])
        .map((row) => {
            const ministry = Array.isArray(row.ministry) ? row.ministry[0] : row.ministry;
            return { row, ministry };
        })
        .filter(({ ministry }) => ministry)
        .map(({ row, ministry }) => ({
            member_id: row.member_id,
            department: ministry!.name,
            position_name: row.role_name,
            ministry_id: ministry!.id,
            ministry_code: ministry!.code,
        }));
};
