import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HelpCircle, Search, X, MessageSquarePlus, ChevronDown } from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFaqs } from "@/hooks/useFaqs";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import styles from "./FaqPage.module.css";

export function FaqPage() {
  useDocumentMeta({
    title: "Help & FAQ — Handy for Aditya University",
    description:
      "Answers about signing in, syncing your Campus Connect data, how the 75% attendance rule works, widgets, and privacy — everything students ask about Handy.",
    path: ROUTES.faq,
  });

  const { data, isLoading, isError, refetch } = useFaqs();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const all = [...(data ?? [])].sort((a, b) => a.order - b.order);
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? all.filter((f) => f.question.toLowerCase().includes(needle) || f.answer.toLowerCase().includes(needle))
      : all;

    const byCategory = new Map<string, typeof filtered>();
    for (const faq of filtered) {
      const list = byCategory.get(faq.category) ?? [];
      list.push(faq);
      byCategory.set(faq.category, list);
    }
    return byCategory;
  }, [data, query]);

  const hasResults = [...grouped.values()].some((list) => list.length > 0);

  return (
    <div className="page-narrow">
      <TopHeader title="Help & FAQ" subtitle="Get help and find answers" back />

      <div className={styles.searchRow}>
        <Search size={16} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder="Search help"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className={styles.clearButton} onClick={() => setQuery("")} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      {isError && <ErrorState message="Unable to load help right now." onRetry={refetch} />}

      {!isError && isLoading && (
        <div className={styles.loadingStack}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </div>
      )}

      {!isError && !isLoading && !hasResults && (
        <EmptyState
          icon={HelpCircle}
          title={query ? `Nothing matches "${query}"` : "No help articles yet"}
          description="Didn't find what you needed?"
          action={
            <Link to={ROUTES.feedback} className={styles.askLink}>
              <MessageSquarePlus size={15} /> Ask us instead
            </Link>
          }
        />
      )}

      {!isError && !isLoading && hasResults && (
        <>
          {[...grouped.entries()].map(([category, faqs]) =>
            faqs.length === 0 ? null : (
              <section key={category} className={styles.section}>
                <p className={styles.categoryLabel}>{category}</p>
                <div className={styles.card}>
                  {faqs.map((faq) => {
                    const open = openId === faq.id;
                    return (
                      <div key={faq.id} className={styles.item}>
                        <button
                          type="button"
                          className={styles.question}
                          onClick={() => setOpenId(open ? null : faq.id)}
                          aria-expanded={open}
                        >
                          {faq.question}
                          <ChevronDown size={16} className={cn(styles.chevron, open && styles.chevronOpen)} />
                        </button>
                        {open && <p className={styles.answer}>{faq.answer}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            ),
          )}

          <Link to={ROUTES.feedback} className={styles.footerLink}>
            <MessageSquarePlus size={15} /> Didn't find it? Send us a message
          </Link>
        </>
      )}
    </div>
  );
}
