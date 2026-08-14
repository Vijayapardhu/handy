import { getDoc } from "firebase/firestore";
import { collegeDocRef } from "@/services/firebase/collections";
import { DEFAULT_COLLEGE_CONFIG } from "@/constants/collegeConfig";
import type { CollegeConfigDoc } from "@/types/config";

/**
 * Loads the college-wide configuration (minimum attendance %, status bands —
 * SRS §65). Falls back to DEFAULT_COLLEGE_CONFIG only if the document hasn't
 * been provisioned yet, so a fresh Firebase project still renders sensibly.
 */
export async function getCollegeConfig(collegeId: string): Promise<CollegeConfigDoc> {
  const snapshot = await getDoc(collegeDocRef(collegeId));
  return snapshot.exists() ? snapshot.data() : { ...DEFAULT_COLLEGE_CONFIG, id: collegeId };
}
