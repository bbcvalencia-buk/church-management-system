export interface ActivityRecord {
    id: string;
    activity_type: string;
    activity_date: string; // YYYY-MM-DD
    members_present: number;
    non_member_attendance: number;
    total_attendance: number;
    souls_saved: number;
    kids_attended: number;
    tracts_distributed: number;
    area?: string;
    bible_study_type?: 'individual' | 'family';
    family_name?: string;
    mission_church_name?: string;
    facebook_post_link?: string;
    attachment_url?: string;
    activity_data?: any;
}
