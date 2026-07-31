
export enum UserRole {
    CHURCH_ADMINISTRATOR = 'church_administrator',
    PASTOR = 'pastor',
    CHURCH_CLERK = 'church_clerk',
    TREASURER = 'treasurer',
    RECORDING_SECRETARY = 'recording_secretary',
    MUSIC_MINISTER = 'music_minister',
    SUNDAY_SCHOOL_ADMIN = 'sunday_school_admin',
    GOODNEWS_TEACHER = 'goodnews_teacher',
    ACTIVITY_COORDINATOR = 'activity_coordinator',
    MEMBER = 'member',
    SUNDAY_SCHOOL_TEACHER_BEGINNERS = 'sunday_school_teacher_beginners',
    SUNDAY_SCHOOL_TEACHER_CHILDREN = 'sunday_school_teacher_children',
    SUNDAY_SCHOOL_TEACHER_ADULT = 'sunday_school_teacher_adult'
}

export type Gender = 'Male' | 'Female';
export type MaritalStatus = 'Single' | 'Married' | 'Widow' | 'Widower' | 'Separated';

export interface ChurchEvent {
    id: string;
    event_name: string;
    event_theme?: string | null;
    event_type: 'fellowship' | 'bible_quiz' | 'camp' | 'anniversary' | 'special_program' | 'thanksgiving' | 'other';
    event_date: string;
    location: string;
    total_attendance: number;
    visitors_count?: number;
    notes: string;
    attachment_urls?: string[];
    created_by: string;
    created_at: string;
}

export interface Member {
    id: string;
    id_number: number;
    member_number?: string;
    member_number_year?: number;
    member_number_seq?: number;
    legacy_v1_id?: string;

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
    is_pastor: boolean;
    is_pastors_wife: boolean;

    // Media
    profile_picture_url?: string;
    id_card_url?: string;
    attachment_url?: string;

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

    status?: 'active' | 'converted' | 'archived';
    converted_to_member_id?: string;
    converted_at?: string;
    converted_by?: string;

    converted_to_member: boolean; // Legacy
    conversion_date?: string; // Legacy
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
    assignment_reason?: string | null;
}

export type MinistryCategory =
    | 'leadership'
    | 'music_ministry'
    | 'sunday_school'
    | 'operations'
    | 'other_ministries';

export interface Ministry {
    id: string;
    code: string;
    name: string;
    category: MinistryCategory;
    description?: string | null;
    schedule?: string | null;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface MinistryAssignment {
    id: string;
    member_id: string;
    ministry_id: string;
    role_name: string;
    is_leader: boolean;
    start_date: string;
    end_date?: string | null;
    status: 'active' | 'inactive';
    ministry?: Ministry;
    members?: Partial<Member> | null;
}

export interface ChurchOffice {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    is_active: boolean;
    created_at?: string;
}

export interface SundaySchoolClass {
    id: string;
    code: string;
    name: string;
    department: 'adult' | 'beginners' | 'nursery' | 'kinder' | 'primary' | 'junior';
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface SundaySchoolEnrollment {
    id: string;
    class_id: string;
    member_id: string;
    role: 'student' | 'teacher' | 'assistant';
    status: 'active' | 'inactive';
    start_date: string;
    end_date?: string | null;
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

export type GoodnewsSeriesStatus = 'ongoing' | 'completed' | 'paused';
export type GoodnewsSessionRole = 'teacher' | 'helper' | 'musician' | 'accompanist' | 'driver' | 'other';

export interface GoodnewsSeries {
    id: string;
    title: string;
    area: string;
    location?: string;
    start_date: string;
    end_date?: string;
    lead_member_id?: string;
    status: GoodnewsSeriesStatus;
    notes?: string;
    created_at?: string;
    lead_member?: Partial<Member>;
}

export interface GoodnewsSession {
    members?: any;
    id: string;
    series_id: string;
    session_number: number;
    date: string;
    lesson_topic?: string;
    children_count: number;
    souls_saved_count: number;
    notes?: string;
    created_at?: string;
}

export interface GoodnewsSessionMember {
    id: string;
    session_id: string;
    member_id: string;
    role: GoodnewsSessionRole;
    notes?: string;
    member?: Partial<Member>;
}

export interface FaithPromiseCommitment {
    id: string;
    member_id: string;
    year: number;
    promised_amount: number;

    // New Fields
    started_giving_date?: string;
    weeks_committed?: number;
    status?: string | null;
    fulfillment_date?: string;
    notes?: string;
    created_by?: string;
}

export interface FaithPromiseLedger {
    id: string;
    member_id: string;
    first_name: string;
    surname: string;
    member_number?: string;
    year: number;
    committed_amount: number;
    started_giving_date?: string;
    weeks_committed: number;
    manual_status?: string | null;
    fulfillment_date?: string;
    notes?: string;

    // Calculated by VIEW
    total_paid: number;
    weekly_target: number;
    remaining_balance: number;
    expected_paid_by_now: number;
    variance: number;
    fulfillment_pct: number;
    catchup_weekly: number;
    status: 'FULFILLED' | 'INCOMPLETE' | 'ON TRACK' | 'BEHIND';
}

export type ServiceType = 'sunday_morning' | 'sunday_afternoon' | 'wednesday_prayer' | 'pre_service' | 'funeral';
export type ServiceRole = 'songleader' | 'pastor' | 'moderator' | 'pianist' | 'technicals' | 'mini_ensemble' | 'usher' | 'choir' | 'preacher' | 'other';

export interface ServiceAssignment {
    id: string;
    service_id: string;
    member_id: string;
    role: ServiceRole;
    notes?: string;
    created_at?: string;
    member?: Partial<Member>; // For populated joins
}

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
    event_type: 'service' | 'activity' | 'sunday_school' | 'music_practice' | 'church_event' | 'goodnews_session';
    event_id: string;
    event_date: string;
    was_present: boolean;
    was_tardy?: boolean;
    excuse_reason?: string;
    notes?: string;
    assessment_score?: number | null;
}

export interface Activity {
    id: string;
    activity_type: 'goodnews_class' | 'soul_winning' | 'bible_study' | 'outreach' | 'visitation';
    activity_date: string;
    members_present: number;
    non_member_attendance?: number;
    total_attendance: number; // members + others
    kids_attended?: number; // good news class
    area?: string;
    souls_saved: number;
    tracts_distributed?: number;
    facebook_post_link?: string;
    activity_data?: any;

    // Bible Study Specific (Legacy fields - mostly moving to activity_data)
    bible_study_type?: 'individual' | 'family';
    family_name?: string;
    mission_church_name?: string; // Outreach
}

export interface SundaySchoolSession {
    id: string;
    department: 'adult' | 'beginners' | 'nursery' | 'kinder' | 'primary' | 'junior';
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
