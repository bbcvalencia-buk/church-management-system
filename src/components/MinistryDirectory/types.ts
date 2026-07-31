import type { ChurchPosition } from "@/types";

export interface PartialMember {
  id: string;
  first_name: string;
  surname: string;
  profile_picture_url?: string;
  member_number?: string;
  phone_number?: string;
}

export interface PositionWithMember extends ChurchPosition {
  ministry_id?: string;
  members: PartialMember | null;
}
