/** Tiny classnames joiner — avoids pulling in the `clsx` dependency for one function. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
