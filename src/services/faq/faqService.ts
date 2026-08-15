import { getDocs, query, where } from "firebase/firestore";
import { faqsCol } from "@/services/firebase/collections";
import type { FaqDoc } from "@/types/faq";

/** Every active FAQ, unordered on the wire — sorted client-side by `order` (see useFaqs). */
export async function getFaqs(): Promise<FaqDoc[]> {
  const q = query(faqsCol(), where("active", "==", true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}
