import { supabase } from "../lib/supabase";
import type { FamilyRelationship } from "../types";

export const getFamilyRelationships = async (memberId: string): Promise<any[]> => {
    const { data, error } = await supabase.from("family_relationships").select(`*, members:related_member_id (id, first_name, surname, member_number, profile_picture_url)`).eq("member_id", memberId);
    if (error) throw new Error(`Failed to fetch family relationships for member ${memberId}: ${error.message}`);
    return data;
};
export const getReciprocalRelation = (relation: string, sourceGender?: string): string => {
    const isFemale = sourceGender?.toLowerCase() === 'female';
    switch (relation.toLowerCase()) {
        case 'spouse': return 'spouse';
        case 'father': return isFemale ? 'daughter' : 'son';
        case 'mother': return isFemale ? 'daughter' : 'son';
        case 'son': return isFemale ? 'mother' : 'father';
        case 'daughter': return isFemale ? 'mother' : 'father';
        case 'brother': return isFemale ? 'sister' : 'brother';
        case 'sister': return isFemale ? 'sister' : 'brother';
        case 'grandfather': return isFemale ? 'granddaughter' : 'grandson';
        case 'grandmother': return isFemale ? 'granddaughter' : 'grandson';
        case 'grandson': return isFemale ? 'grandmother' : 'grandfather';
        case 'granddaughter': return isFemale ? 'grandmother' : 'grandfather';
        case 'uncle': return isFemale ? 'niece' : 'nephew';
        case 'aunt': return isFemale ? 'niece' : 'nephew';
        case 'nephew': return isFemale ? 'aunt' : 'uncle';
        case 'niece': return isFemale ? 'aunt' : 'uncle';
        case 'cousin': return 'cousin';
        case 'in_law': return 'in_law';
        default: return relation;
    }
};
export const upsertFamilyRelationship = async (relationship: Partial<FamilyRelationship>, skipReciprocal = false): Promise<void> => {
    const { members, ...dbPayload } = relationship as any;
    const { error, data: savedRelation } = await supabase.from("family_relationships").upsert(dbPayload).select().single();
    if (error) throw new Error(`Failed to save family relationship: ${error.message}`);
    if (!skipReciprocal && relationship.related_member_id && relationship.member_id) {
        const { data: existingReciprocal } = await supabase.from("family_relationships").select("id").eq("member_id", relationship.related_member_id).eq("related_member_id", relationship.member_id).maybeSingle();
        if (!existingReciprocal) {
            const { data: sourceMember } = await supabase.from("members").select("gender, first_name, surname").eq("id", relationship.member_id).single();
            if (sourceMember) {
                const reciprocalType = getReciprocalRelation(relationship.relationship_type || '', sourceMember.gender);
                await supabase.from("family_relationships").insert({ member_id: relationship.related_member_id, related_member_id: relationship.member_id, relationship_type: reciprocalType, non_member_name: `${sourceMember.first_name} ${sourceMember.surname}` });
            }
        }
    }
};
export const deleteFamilyRelationships = async (relationshipIds: string[]): Promise<void> => {
    if (!relationshipIds?.length) return;
    const { data: deletingRels } = await supabase.from("family_relationships").select("member_id, related_member_id").in("id", relationshipIds).not("related_member_id", "is", null);
    const { error } = await supabase.from("family_relationships").delete().in("id", relationshipIds);
    if (error) throw new Error(`Failed to delete family relationships: ${error.message}`);
    if (deletingRels && deletingRels.length > 0) {
        for (const rel of deletingRels) {
            await supabase.from("family_relationships").delete().eq("member_id", rel.related_member_id!).eq("related_member_id", rel.member_id);
        }
    }
};
