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
    if (haystack.includes("children") || haystack.includes("child")) {
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

const CHILDREN_DEPARTMENTS: SundaySchoolDepartmentId[] = ["nursery", "kinder", "primary", "junior"];

const isChildrenAssignment = (assignment: SundaySchoolAssignmentLike) => {
    const positionCategory = normalizeText(assignment.position_category);
    const department = normalizeText(assignment.department);
    const positionName = normalizeText(assignment.position_name);
    const specificRole = normalizeText(assignment.specific_role);

    return [positionCategory, department, positionName, specificRole].some((value) => value.includes("children") || value.includes("child"));
};

export const getSundaySchoolDepartmentGroups = (departmentIds: SundaySchoolDepartmentId[]) => {
    const groups = new Set<string>();
    const hasChildren = departmentIds.some((id) => CHILDREN_DEPARTMENTS.includes(id));

    if (hasChildren) groups.add("Children");
    if (departmentIds.includes("adult")) groups.add("Adult");
    if (departmentIds.includes("beginners")) groups.add("Beginners");

    return Array.from(groups);
};

export const getSundaySchoolScopeLabel = (departmentIds: SundaySchoolDepartmentId[]) => {
    const groups = getSundaySchoolDepartmentGroups(departmentIds);
    if (groups.length === 0) return "";
    if (groups.length === 3) return "All Departments";
    return groups.join(" / ");
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
        const positionCategory = normalizeText(assignment.position_category);

        if (positionCategory === "sunday school children") {
            if (normalizedDept && CHILDREN_DEPARTMENTS.includes(normalizedDept)) {
                departments.add(normalizedDept);
            } else {
                CHILDREN_DEPARTMENTS.forEach((dept) => departments.add(dept));
            }
            continue;
        }

        if (positionCategory === "beginners class") {
            departments.add("beginners");
            continue;
        }

        if (positionCategory === "sunday school adult") {
            departments.add("adult");
            continue;
        }

        if (!normalizedDept) continue;

        if (normalizedDept === "junior" && isChildrenAssignment(assignment)) {
            CHILDREN_DEPARTMENTS.forEach((dept) => departments.add(dept));
        } else {
            departments.add(normalizedDept);
        }
    }

    return Array.from(departments);
};
