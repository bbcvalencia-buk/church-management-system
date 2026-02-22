
export enum UserRole {
    SUPER_ADMIN = 'super_admin',
    CHURCH_CLERK = 'church_clerk',
    TREASURER = 'treasurer',
    MUSIC_MINISTER = 'music_minister',
    SUNDAY_SCHOOL_ADMIN = 'sunday_school_admin',
    ACTIVITY_COORDINATOR = 'activity_coordinator',
    MEMBER = 'member'
}

export type Gender = 'Male' | 'Female';
export type MaritalStatus = 'Single' | 'Married' | 'Widow' | 'Widower' | 'Separated';

export interface Member {
    id: string;
    id_number: number;

    // Biographical
    first_name: string;
    middle_name?: string;
    surname: string;
    name_ext?: string;
    nickname?: string;
    date_of_birth: string;
    gender: Gender;
    civil_status: MaritalStatus;
    nationality: string;
    place_of_birth?: string;

    // Contact
    home_address: string;
    phone_number: string;
    alternative_phone?: string;
    email?: string;

    // Emergency Contact
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;

    // Spiritual
    salvation_date?: string;
    baptism_date?: string;
    membership_date?: string;
    previous_church?: string;
    previous_religion?: string;

    // Status
    membership_status: 'active' | 'inactive' | 'under_discipline';
    is_regular_member: boolean;
    is_visitor: boolean;
    is_pastor: boolean;
    is_pastors_wife: boolean;

    // Media
    profile_picture_url?: string;
    id_card_url?: string;

    // Metadata
    created_at: string;
    updated_at: string;
}

export interface Visitor {
    id: string;
    member_id: string; // Creates a shadow member record
    name: string;
    address: string;
    office_address?: string;
    marital_status: MaritalStatus;
    gender: Gender;
    church_name?: string;
    age?: number;
    date_of_birth?: string;
    contact_number: string;
    invited_by?: string;
    visit_time: 'AM' | 'PM';
    visit_date: string;
    service_id?: string;
    sunday_school_session_id?: string;

    // Tracking
    address_sketch_url?: string;
    visitor_card_image_url?: string; // Legacy
    visitor_card_images?: string[]; // Multiple
    is_saved: boolean;
    is_prospect_for_baptism: boolean;
    follow_up_status: 'pending' | 'contacted' | 'visiting' | 'converted' | 'inactive';
    next_follow_up_date?: string;
    converted_to_member: boolean;
    conversion_date?: string;
}

export interface ChurchPosition {
    id: string;
    member_id: string;
    position_name: string;
    position_category: 'leadership' | 'music_ministry' | 'sunday_school_adult' | 'sunday_school_children' | 'beginners_class' | 'other_ministries';
    department?: string;
    specific_role?: string;
    is_ministry_head?: boolean;
    start_date: string;
    end_date?: string;
    is_active: boolean;
    assignment_reason?: string;
}

export interface FamilyRelationship {
    id: string;
    member_id: string;
    related_member_id?: string;
    non_member_name?: string;
    relationship_type: 'father' | 'mother' | 'son' | 'daughter' | 'spouse' | 'brother' | 'sister' | 'grandfather' | 'grandmother' | 'uncle' | 'aunt' | 'nephew' | 'niece' | 'cousin' | 'in_law';
    non_member_contact?: string;
    notes?: string;
}

export interface FinancialRecord {
    id: string;
    member_id: string;
    transaction_date: string;
    transaction_type: 'tithe' | 'faith_promise' | 'love_gift' | 'pledge';
    amount: number;
    pledge_purpose?: string;
    faith_promise_year?: number; // linking to specific year commitment
    notes?: string;
    description?: string;
    created_at: string;
}

export interface FaithPromiseCommitment {
    id: string;
    member_id: string;
    year: number;
    promised_amount: number;
    total_given: number; // Calculated/Cached
    remaining: number; // Calculated
}

export type ServiceType = 'sunday_morning' | 'sunday_afternoon' | 'wednesday_prayer' | 'pre_service' | 'funeral';

export interface Service {
    id: string;
    service_type: ServiceType;
    service_date: string;
    service_time?: string;

    // Stats
    members_present: number;
    total_attendance: number;
    visitors_present: number;
    visitors_saved: number;
    prospects_for_baptism?: number;
    souls_saved: number;
    members_who_prayed?: number; // Sunday AM only

    // Info
    title?: string;
    sermon_title?: string;
    sermon_notes?: string;
    visitor_card_url?: string;
}

export interface AttendanceLog {
    id: string;
    member_id: string;
    event_type: 'service' | 'activity' | 'sunday_school' | 'music_practice';
    event_id: string;
    event_date: string;
    was_present: boolean;
    excuse_reason?: string;
    notes?: string;
}

export interface Activity {
    id: string;
    activity_type: 'goodnews_class' | 'soul_winning' | 'bible_study' | 'outreach';
    activity_date: string;
    members_present: number;
    non_member_attendance?: number;
    total_attendance: number; // members + others
    kids_attended?: number; // good news class
    area?: string;
    souls_saved: number;
    tracts_distributed?: number;
    facebook_post_link?: string;

    // Bible Study Specific
    bible_study_type?: 'individual' | 'family';
    family_name?: string;
    mission_church_name?: string; // Outreach
}

export interface SundaySchoolSession {
    id: string;
    department: 'adult' | 'beginners' | 'nursery_kinder_primary' | 'junior';
    session_date: string;
    members_present: number;
    total_attendance: number;
    souls_saved?: number;
    visitors_present?: number;
    visitor_card_url?: string;
}

export interface MusicPracticeSession {
    id: string;
    practice_type: 'choir' | 'mini_ensemble';
    practice_date: string;
    practice_start_time?: string;
    practice_end_time?: string;
    members_present: number; // Count
    non_member_attendance?: number;
    // Linking to individual attendance via AttendanceLog
}

export interface SystemSettings {
    id: string;
    church_name: string;
    system_name: string;
    church_address: string;
    church_logo_url?: string;
    system_version?: string;
}

export interface AuditLog {
    id: string;
    action_type: string;
    table_name: string;
    record_id: string;
    old_values?: any;
    new_values?: any;
    description?: string;
    timestamp: string;
    user_id?: string;
}
