import { supabase } from "@/lib/supabase";

export interface VisitorMatchInput {
    name: string;
    contact?: string;
    date_of_birth?: string;
    gender?: string;
}

export interface MatchedMember {
    id: string;
    is_visitor?: boolean;
}

interface MemberCandidate extends MatchedMember {
    first_name?: string;
    surname?: string;
    phone_number?: string;
    alternative_phone?: string;
    date_of_birth?: string;
    gender?: string;
}

const normalize = (value?: string | null) =>
    (value || "").trim().toLowerCase().replace(/\s+/g, " ");

const digitsOnly = (value?: string | null) => (value || "").replace(/\D/g, "");

const sanitizeLike = (value: string) => value.replace(/[%_]/g, "").trim();

export const splitVisitorName = (fullName: string) => {
    const compact = fullName.trim().replace(/\s+/g, " ");
    const pieces = compact.split(" ").filter(Boolean);
    return {
        firstName: pieces[0] || "Visitor",
        surname: pieces.slice(1).join(" ")
    };
};

const hasPhoneMatch = (candidate: MemberCandidate, incomingContact?: string) => {
    const contactDigits = digitsOnly(incomingContact);
    if (!contactDigits) return false;

    const candidatePhones = [candidate.phone_number, candidate.alternative_phone]
        .map((p) => digitsOnly(p))
        .filter(Boolean);

    if (candidatePhones.length === 0) return false;

    const suffix = contactDigits.length >= 7 ? contactDigits.slice(-7) : contactDigits;
    return candidatePhones.some((phone) => phone === contactDigits || phone.endsWith(suffix));
};

export const findExistingMemberForVisitor = async (
    input: VisitorMatchInput
): Promise<MatchedMember | null> => {
    const { firstName, surname } = splitVisitorName(input.name || "");
    const normalizedFirst = normalize(firstName);
    const normalizedSurname = normalize(surname);
    const normalizedBirth = normalize(input.date_of_birth);
    const normalizedGender = normalize(input.gender);
    const contact = (input.contact || "").trim();

    const candidateMap = new Map<string, MemberCandidate>();

    const pushCandidates = (rows: MemberCandidate[] | null | undefined) => {
        (rows || []).forEach((row) => {
            if (!candidateMap.has(row.id)) candidateMap.set(row.id, row);
        });
    };

    const memberSelect =
        "id, first_name, surname, phone_number, alternative_phone, date_of_birth, gender";

    if (contact) {
        const safeContact = sanitizeLike(contact);
        if (safeContact) {
            const { data } = await supabase
                .from("members")
                .select(memberSelect)
                .or(`phone_number.ilike.%${safeContact}%,alternative_phone.ilike.%${safeContact}%`)
                .limit(25);
            pushCandidates(data as MemberCandidate[] | null | undefined);
        }

        const phoneDigits = digitsOnly(contact);
        if (phoneDigits.length >= 7) {
            const suffix = phoneDigits.slice(-7);
            const { data } = await supabase
                .from("members")
                .select(memberSelect)
                .or(`phone_number.ilike.%${suffix}%,alternative_phone.ilike.%${suffix}%`)
                .limit(25);
            pushCandidates(data as MemberCandidate[] | null | undefined);
        }
    }

    if (normalizedFirst && normalizedSurname) {
        const { data } = await supabase
            .from("members")
            .select(memberSelect)
            .ilike("first_name", firstName)
            .ilike("surname", surname)
            .limit(25);
        pushCandidates(data as MemberCandidate[] | null | undefined);
    }

    if (candidateMap.size === 0) return null;

    let bestCandidate: MemberCandidate | null = null;
    let bestScore = 0;

    for (const candidate of candidateMap.values()) {
        let score = 0;

        const candidateFirst = normalize(candidate.first_name);
        const candidateSurname = normalize(candidate.surname);

        if (candidateFirst && candidateSurname && candidateFirst === normalizedFirst && candidateSurname === normalizedSurname) {
            score += 5;
        } else if (candidateSurname && normalizedSurname && candidateSurname === normalizedSurname) {
            score += 2;
        }

        if (hasPhoneMatch(candidate, contact)) {
            score += 6;
        }

        if (normalizedBirth && normalize(candidate.date_of_birth) === normalizedBirth) {
            score += 3;
        }

        if (normalizedGender && normalize(candidate.gender) === normalizedGender) {
            score += 1;
        }

        if (score > bestScore) {
            bestScore = score;
            bestCandidate = candidate;
        }
    }

    if (!bestCandidate || bestScore < 5) return null;

    return {
        id: bestCandidate.id,
        is_visitor: !!false
    };
};
