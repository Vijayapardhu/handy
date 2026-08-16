import { useEffect } from "react";

const ORIGIN = "https://handy.vijayaapardhu.dev";

interface DocumentMeta {
  title: string;
  description: string;
  /** Path this page is served at, e.g. "/faq" — becomes the canonical URL. */
  path: string;
}

/**
 * Overrides the document's title, meta description, canonical link and OG
 * tags for as long as the calling page is mounted, restoring index.html's
 * own values on unmount.
 *
 * The app has exactly three public, crawlable routes (`/`, `/faq`, `/about`
 * — see robots.txt) sharing one static index.html. Without this, every one
 * of them describes itself to search engines and link previews as the
 * landing page — including telling Google the landing page is the canonical
 * version of /faq and /about, which would keep either from being indexed as
 * its own result no matter how good its content is.
 */
export function useDocumentMeta({ title, description, path }: DocumentMeta) {
  useEffect(() => {
    const descriptionEl = document.querySelector('meta[name="description"]');
    const canonicalEl = document.querySelector('link[rel="canonical"]');
    const ogTitleEl = document.querySelector('meta[property="og:title"]');
    const ogDescriptionEl = document.querySelector('meta[property="og:description"]');
    const ogUrlEl = document.querySelector('meta[property="og:url"]');

    const previous = {
      title: document.title,
      description: descriptionEl?.getAttribute("content") ?? null,
      canonical: canonicalEl?.getAttribute("href") ?? null,
      ogTitle: ogTitleEl?.getAttribute("content") ?? null,
      ogDescription: ogDescriptionEl?.getAttribute("content") ?? null,
      ogUrl: ogUrlEl?.getAttribute("content") ?? null,
    };

    const url = `${ORIGIN}${path}`;
    document.title = title;
    descriptionEl?.setAttribute("content", description);
    canonicalEl?.setAttribute("href", url);
    ogTitleEl?.setAttribute("content", title);
    ogDescriptionEl?.setAttribute("content", description);
    ogUrlEl?.setAttribute("content", url);

    return () => {
      document.title = previous.title;
      if (previous.description !== null) descriptionEl?.setAttribute("content", previous.description);
      if (previous.canonical !== null) canonicalEl?.setAttribute("href", previous.canonical);
      if (previous.ogTitle !== null) ogTitleEl?.setAttribute("content", previous.ogTitle);
      if (previous.ogDescription !== null) ogDescriptionEl?.setAttribute("content", previous.ogDescription);
      if (previous.ogUrl !== null) ogUrlEl?.setAttribute("content", previous.ogUrl);
    };
  }, [title, description, path]);
}
