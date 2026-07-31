import type { ServiceRole } from "@/types";

export const ROLES: ServiceRole[] = [
    'pastor', 'preacher', 'songleader', 'moderator', 'pianist', 
    'technicals', 'choir', 'mini_ensemble', 'usher', 'other'
];

export const ROLE_LABELS: Record<ServiceRole, string> = {
    songleader: 'Songleader',
    pastor: 'Pastor',
    moderator: 'Moderator',
    pianist: 'Pianist',
    technicals: 'Technicals',
    mini_ensemble: 'Mini Ensemble',
    usher: 'Usher',
    choir: 'Choir',
    preacher: 'Preacher',
    other: 'Other'
};

export const MULTI_MEMBER_ROLES: ServiceRole[] = [
    'choir', 'mini_ensemble', 'usher', 'technicals', 'pianist'
];
