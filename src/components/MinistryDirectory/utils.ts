import { Users, Shield, Music, BookOpen, Activity } from "lucide-react";

export const CATEGORIES = [
  { id: 'all', label: 'All Ministries', icon: Users },
  { id: 'leadership', label: 'Pastoral & Admin', icon: Shield },
  { id: 'music_ministry', label: 'Music & Creatives', icon: Music },
  { id: 'sunday_school_adult', label: 'Sunday School & Ed.', icon: BookOpen },
  { id: 'other_ministries', label: 'Operations & Support', icon: Activity },
];

export const CATEGORY_LABELS: Record<string, string> = {
  leadership: 'Pastoral & Admin',
  music_ministry: 'Music & Creatives',
  sunday_school: 'Sunday School & Ed.',
  sunday_school_adult: 'Sunday School & Ed.',
  sunday_school_children: 'Sunday School & Ed.',
  beginners_class: 'Sunday School & Ed.',
  other_ministries: 'Operations & Support',
};

export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  sunday_school: 'sunday_school_adult',
  sunday_school_children: 'sunday_school_adult',
  beginners_class: 'sunday_school_adult',
};

export const normalizeCategory = (category?: string | null) => {
  if (!category) return 'other_ministries';
  return LEGACY_CATEGORY_MAP[category] || category;
};

export const getCategoryLabel = (category?: string | null) => {
  if (!category) return 'General';
  return CATEGORY_LABELS[category] || category.replace(/_/g, ' ');
};

export const sortGroupMembers = (groupMembers: any[]) => {
  return [...groupMembers].sort((a, b) => {
    const aHead = a.full_pos?.is_ministry_head ? 1 : 0;
    const bHead = b.full_pos?.is_ministry_head ? 1 : 0;
    if (aHead !== bHead) return bHead - aHead;
    const aName = `${a.first_name || ''} ${a.surname || ''}`.trim();
    const bName = `${b.first_name || ''} ${b.surname || ''}`.trim();
    return aName.localeCompare(bName);
  });
};

export const INITIAL_STATE = {
  member_id: '',
  position_name: '',
  department: '',
  position_category: 'leadership',
  assignment_reason: '',
  start_date: new Date().toISOString().split('T')[0],
  is_active: true
};

export const getCategoryStyle = (catId: string) => {
  switch (catId) {
    case 'leadership':
      return {
        bg: 'bg-emerald-50/50',
        border: 'border-emerald-50',
        text: 'text-emerald-700',
      };
    case 'music_ministry':
      return {
        bg: 'bg-orange-50/50',
        border: 'border-orange-50',
        text: 'text-orange-700',
      };
    case 'sunday_school_adult':
    case 'sunday_school_children':
      return {
        bg: 'bg-rose-50/50',
        border: 'border-rose-50',
        text: 'text-rose-700',
      };
    case 'other_ministries':
    default:
      return {
        bg: 'bg-[#f4f7ff]',
        border: 'border-[#eef2fc]',
        text: 'text-indigo-700',
      };
  }
};
