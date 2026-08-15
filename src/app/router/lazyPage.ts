import { lazy, type ComponentType } from "react";

/**
 * A guard against the app breaking for whoever had it open during a deploy.
 *
 * Every route here is code-split, so visiting /tasks fetches a file whose name
 * carries a content hash — `TasksPage-COnoMok4.js`. A deploy publishes new
 * hashes and the old files stop existing. A tab that has been open across that
 * deploy is still running the previous index.html, so the moment the student
 * navigates somewhere they have not been yet, it asks for a chunk that is gone
 * and React Router shows "Failed to fetch dynamically imported module" over the
 * whole screen. Nothing is actually wrong with their session — the app they are
 * running has simply been replaced underneath them.
 *
 * It is also intermittent in exactly the way that makes it hard to report:
 * only for people who kept a tab or the installed PWA open, only for routes
 * they had not already loaded, and only until they happen to refresh.
 *
 * So a failed import reloads the page once, which fetches the new index.html
 * and the chunk names that go with it. The sessionStorage flag is what stops
 * that being an infinite loop: if the reload did not fix it, the failure is
 * real — offline, or a genuinely missing file — and the error is allowed
 * through to be seen. The flag is cleared on the next successful load so a
 * later deploy gets its own single retry.
 */
const RELOAD_KEY = "handy:chunk-reload";

// Mirrors React.lazy's own signature, which is `ComponentType<any>`. Narrowing
// it to unknown or never makes every call site fail to infer, because a page
// component's props are contravariant here — this wrapper does not care about
// props at all, it only adds a retry around the import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const module = await load();
      sessionStorage.removeItem(RELOAD_KEY);
      return module;
    } catch (error) {
      if (sessionStorage.getItem(RELOAD_KEY)) throw error;
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
      // The reload is already underway; resolving would only render something
      // about to be thrown away, and rejecting would show the error we are
      // busy fixing.
      return new Promise<{ default: T }>(() => {});
    }
  });
}
