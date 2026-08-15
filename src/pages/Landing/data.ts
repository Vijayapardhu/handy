/**
 * Page content, kept out of the section components so copy edits don't mean
 * reading JSX. Everything here describes something that actually ships — if a
 * feature is removed from the product, its entry comes out of this file.
 */
import {
  Airplane01Icon,
  Analytics01Icon,
  Calendar03Icon,
  ChartLineData02Icon,
  Clock01Icon,
  Grid02Icon,
  Notification03Icon,
  Task01Icon,
  Target01Icon,
  Wifi01Icon,
} from "@hugeicons/core-free-icons";

/**
 * The eight widget palettes, mirroring THEMES in
 * mobile/android/app/src/main/kotlin/dev/vijayaapardhu/handy/WidgetStyle.kt and
 * the widget_bg_*.xml drawables. Android's gradient angle 315° is CSS's 135deg.
 */
export const WIDGET_THEMES = [
  { id: "accent", label: "Accent", from: "#F97316", to: "#EA580C", primary: "#FFFFFF", secondary: "#FFE7D5" },
  { id: "dark", label: "Dark", from: "#0F172A", to: "#1E293B", primary: "#F1F5F9", secondary: "#94A3B8" },
  { id: "light", label: "Light", from: "#FFFFFF", to: "#E2E8F0", primary: "#0F172A", secondary: "#475569" },
  { id: "midnight", label: "Midnight", from: "#0B1020", to: "#111A33", primary: "#E2E8F0", secondary: "#8FA3C8" },
  { id: "forest", label: "Forest", from: "#14532D", to: "#166534", primary: "#ECFDF5", secondary: "#A7F3D0" },
  { id: "rose", label: "Rose", from: "#9F1239", to: "#BE123C", primary: "#FFF1F2", secondary: "#FECDD3" },
  { id: "slate", label: "Slate", from: "#334155", to: "#475569", primary: "#F8FAFC", secondary: "#CBD5E1" },
  { id: "plum", label: "Plum", from: "#4C1D95", to: "#5B21B6", primary: "#F5F3FF", secondary: "#DDD6FE" },
] as const;

export type WidgetTheme = (typeof WIDGET_THEMES)[number];

/** The five home-screen widgets, in the order they appear on the rail. */
export const WIDGETS = [
  {
    id: "next",
    icon: Clock01Icon,
    name: "Next class",
    blurb: "Where to be, which room, and how long you have.",
  },
  {
    id: "attendance",
    icon: Analytics01Icon,
    name: "Attendance",
    blurb: "The one number, without opening anything.",
  },
  {
    id: "today",
    icon: Calendar03Icon,
    name: "Today",
    blurb: "Every session for the day, in order.",
  },
  {
    id: "dues",
    icon: Task01Icon,
    name: "Dues",
    blurb: "Assignments and deadlines closing in.",
  },
  {
    id: "overview",
    icon: Grid02Icon,
    name: "Overview",
    blurb: "Build your own — pick the rows and their order.",
  },
] as const;

export const FEATURES = [
  {
    icon: Target01Icon,
    title: "Attendance planner",
    body: "How many classes you must attend to reach 75%, where you land if you keep showing up, and how many you can still miss. Per subject, not just overall.",
    // Marks the card that leads the grid. It is the reason the app exists, and
    // a nine-up grid of equal cards says everything is equally important.
    featured: true,
    stats: [
      { value: "5", label: "classes to your target" },
      { value: "80.0%", label: "projected by term end" },
      { value: "0", label: "absences to spare" },
    ],
  },
  {
    icon: ChartLineData02Icon,
    title: "Subject breakdown",
    body: "Held, attended and percentage for every subject, with an eight-week trend so you can see which way it is moving.",
  },
  {
    icon: Calendar03Icon,
    title: "Timetable that knows the date",
    body: "Your weekly grid, versioned by effective date — jump to any day and see the timetable that actually applied then.",
  },
  {
    icon: Task01Icon,
    title: "Deadlines with steps",
    body: "Break an assignment into steps, set it to repeat weekly, and see what is due in the next few days on the home screen.",
  },
  {
    icon: Airplane01Icon,
    title: "Leave planner",
    body: "Enter the dates you want to be away and see exactly what it costs each subject before you commit to it.",
  },
  {
    icon: Grid02Icon,
    title: "Home-screen widgets",
    body: "Five widgets in eight palettes and four typefaces, sized to fit the space you give them. Answers without unlocking anything.",
  },
  {
    icon: Notification03Icon,
    title: "Alerts that matter",
    body: "A push notification when a subject drops below the threshold — not a daily digest you learn to swipe away.",
  },
  {
    icon: Wifi01Icon,
    title: "Works offline",
    body: "The last sync is cached and readable with no signal. When you are offline you are told, never quietly shown stale numbers as if they were live.",
  },
] as const;

export const FAQS = [
  {
    q: "Is this an official Aditya University app?",
    a: "No. Handy is built by a student and is not affiliated with, endorsed by, or operated by Aditya University. It reads the data the university's own portal already shows you, and presents it better.",
  },
  {
    q: "Do I have to give Handy my college password?",
    a: "At Aditya University, no — and there is nowhere to type it. You sign in to Campus Connect in your own browser tab exactly as you always do, Cloudflare check and all. The extension only reads the responses that page has already fetched once you are signed in; it never sends a request of its own, and never sees what you typed. At AEC and ACET it is different, because their portal cannot be read that way: you type your portal password into Handy once, it is sent to the college to check it is you, and it is never stored — not in the app, not on the server, not in a log.",
  },
  {
    q: "Why do I need the extension at all?",
    a: "The university has no public API. The only way to get your attendance out of the portal is to read it from a page you are already logged into, which is precisely what the extension does. Once it has synced, the phone app and the web app work on their own.",
  },
  {
    q: "Is there an iPhone version?",
    a: "Not a native one. The web app installs to your home screen as a PWA and gives you every screen the Android app has, minus the widgets — those are an Android feature.",
  },
  {
    q: "Will this work at my college?",
    a: "No. The extension reads info.aec.edu.in specifically, and the parser is written against that portal's exact responses. Another college's portal would need its own parser.",
  },
  {
    q: "My numbers look out of date. What happened?",
    a: "Handy shows the last successful sync. Open your Campus Connect profile page again with the extension installed and it will re-capture — the extension badge turns green when it lands, and shows a red exclamation mark rather than failing quietly.",
  },
] as const;
