import styles from "../landing.module.css";
import { Faq } from "../components/Faq";
import { SectionHead } from "../components/SectionHead";
import { FAQS } from "../data";

// Same six questions as <Faq />, shaped for Google's FAQ rich result and for
// AI answer engines that read FAQPage schema directly rather than rendering
// the page. Kept next to the visible copy so the two can't drift apart.
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

export function FaqSection() {
  return (
    <section className={styles.section} id="faq">
      <script type="application/ld+json">{JSON.stringify(FAQ_JSON_LD)}</script>
      <div className={`${styles.inner} ${styles.split}`}>
        <div className={styles.splitHead}>
          <SectionHead
            eyebrow="Questions"
            title="The ones everybody asks"
            lede="If something here is still unclear, the source is public and the developer answers email."
          />
        </div>

        <div data-reveal>
          <Faq />
        </div>
      </div>
    </section>
  );
}
