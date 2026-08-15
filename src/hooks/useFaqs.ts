import { useQuery } from "@tanstack/react-query";
import { getFaqs } from "@/services/faq/faqService";

/** No student scoping — FAQs are the same for every signed-in student. */
export function useFaqs() {
  return useQuery({
    queryKey: ["faqs"],
    queryFn: getFaqs,
    staleTime: 10 * 60_000,
  });
}
