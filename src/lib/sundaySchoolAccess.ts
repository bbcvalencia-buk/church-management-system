export const SUNDAY_SCHOOL_POSITION_CATEGORIES = [
    "sunday_school_adult",
    "sunday_school_children",
    "beginners_class",
] as const;

export type SundaySchoolDepartmentId =
    | "adult"
    | "beginners"
    | "nursery" | "kinder" | "primary"
    | "junior";

const TEACHER_ROLE_KEYWORDS = [
    "teacher",
    "assistant teacher",
    "coordinator",
    "director",
    "superintendent",
    "head",
    "leader",
    "advisor",
    "adviser",
    "facilitator",
    "mentor",
];

const normalizeText = (value?: string | null) =>
    (value || "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export interface SundaySchoolAssignmentLike {
    position_category?: string | null;
    department?: string | null;
    position_name?: string | null;
    specific_role?: string | null;
    is_ministry_head?: boolean | null;
}

export const normalizeSundaySchoolDepartment = (
    assignment: SundaySchoolAssignmentLike
): SundaySchoolDepartmentId | null => {
    const positionCategory = normalizeText(assignment.position_category);
    const haystack = normalizeText(
        `${assignment.department || ""} ${assignment.position_name || ""} ${assignment.specific_role || ""}`
    );

    if (haystack.includes("nursery") || haystack.includes("toddler")) {
        return "nursery";
    }
    if (haystack.includes("kinder")) {
        return "kinder";
    }
    if (haystack.includes("primary")) {
        return "primary";
    }
    if (haystack.includes("beginner")) {
        return "beginners";
    }
    if (haystack.includes("junior") || haystack.includes("youth")) {
        return "junior";
    }
    if (haystack.includes("adult")) {
        return "adult";
    }

    if (positionCategory === "beginners class") return "beginners";
    if (positionCategory === "sunday school adult") return "adult";
    if (positionCategory === "sunday school children") return "junior";
    return null;
};

export const isSundaySchoolTeacherAssignment = (assignment: SundaySchoolAssignmentLike) => {
    if (assignment.is_ministry_head) return true;
    const roleText = normalizeText(`${assignment.position_name || ""} ${assignment.specific_role || ""}`);
    if (!roleText) return false;
    return TEACHER_ROLE_KEYWORDS.some((keyword) => roleText.includes(keyword));
};

export const deriveTeacherDepartments = (assignments: SundaySchoolAssignmentLike[]): SundaySchoolDepartmentId[] => {
    const departments = new Set<SundaySchoolDepartmentId>();

    for (const assignment of assignments) {
        if (!isSundaySchoolTeacherAssignment(assignment)) continue;
        const normalizedDept = normalizeSundaySchoolDepartment(assignment);
        if (normalizedDept) {
            departments.add(normalizedDept);
        }
    }

    return Array.from(departments);
};
