import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Attachment01Icon,
  BookOpen01Icon,
  Briefcase01Icon,
  Calendar01Icon,
  Calendar03Icon,
  CalendarBlock01Icon,
  CalendarClockIcon,
  CalendarRemove01Icon,
  CalendarSearchIcon,
  Cancel01Icon,
  CancelCircleIcon,
  ChartColumnIcon,
  ChartDownIcon,
  ChartUpIcon,
  CheckListIcon,
  CheckmarkBadge01Icon,
  CheckmarkCircle01Icon,
  ClipboardListIcon,
  Clock01Icon,
  CloudDownloadIcon,
  Coffee01Icon,
  Database01Icon,
  Delete02Icon,
  Download01Icon,
  EyeIcon,
  File01Icon,
  FileAddIcon,
  FireIcon,
  Flag01Icon,
  Globe02Icon,
  GraduationCapIcon,
  HelpCircleIcon,
  HistoryIcon,
  Home01Icon,
  InboxIcon,
  Idea01Icon,
  InformationCircleIcon,
  Key01Icon,
  Link01Icon,
  LinkSquare01Icon,
  Loading03Icon,
  Location01Icon,
  Logout01Icon,
  MailSend01Icon,
  Megaphone01Icon,
  Menu01Icon,
  Message01Icon,
  MessageAdd01Icon,
  MinusSignIcon,
  Moon02Icon,
  Notification01Icon,
  NotificationOff01Icon,
  PartyIcon,
  PieChart01Icon,
  PlayCircleIcon,
  PlugSocketIcon,
  PlusSignIcon,
  Pulse01Icon,
  PuzzleIcon,
  Refresh01Icon,
  Rocket01Icon,
  Shield01Icon,
  Shield02Icon,
  SmartPhone01Icon,
  SourceCodeIcon,
  Sun01Icon,
  Target01Icon,
  Tick01Icon,
  TickDouble01Icon,
  UserIcon,
  UserMultipleIcon,
  ViewOffIcon,
  WifiOff01Icon,
} from "@hugeicons/core-free-icons";
import type { ComponentType } from "react";

/**
 * HugeIcons, wearing lucide's interface.
 *
 * The Flutter app draws HugeIcons and the web drew lucide, which is the last
 * thing that made them look like two products rather than one — the palette,
 * the radii and the type scale already agree.
 *
 * This is an adapter rather than a rewrite. Every icon here is exported under
 * the lucide name it replaces and takes the same props, so the 40-odd files
 * that render icons only change which module they import from. That keeps the
 * diff readable, keeps `const Icon = MAP[type]; <Icon size={17} />` working
 * untouched, and means the *mapping* — the only part that involved judgement —
 * lives in one place where it can be argued with, exactly as
 * mobile/lib/widgets/app_icon.dart does for the app.
 *
 * Where lucide had a distinction HugeIcons does not, the nearer meaning wins
 * over the nearer shape: ShieldCheck becomes a checkmark badge rather than a
 * plain shield, because "verified" is what it was saying.
 */
export interface IconProps {
  size?: number | string;
  color?: string;
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
}

/** The shape every icon in this module has. Replaces lucide's `LucideIcon`. */
export type IconComponent = ComponentType<IconProps>;

function icon(glyph: IconSvgElement, displayName: string): IconComponent {
  // 1.8 rather than HugeIcons' 1.5 default: the app's AppIcon draws heavier,
  // and at 16px a 1.5 stroke on a light ground reads as grey rather than as a
  // line.
  const Component = ({ size = 24, color = "currentColor", strokeWidth = 1.8, ...rest }: IconProps) => (
    <HugeiconsIcon icon={glyph} size={size} color={color} strokeWidth={strokeWidth} {...rest} />
  );
  Component.displayName = displayName;
  return Component;
}

/* Navigation and chrome ---------------------------------------------------- */
export const ArrowLeft = icon(ArrowLeft01Icon, "ArrowLeft");
export const ArrowRight = icon(ArrowRight01Icon, "ArrowRight");
export const ChevronLeft = icon(ArrowLeft01Icon, "ChevronLeft");
export const ChevronRight = icon(ArrowRight01Icon, "ChevronRight");
export const Menu = icon(Menu01Icon, "Menu");
export const Home = icon(Home01Icon, "Home");
export const X = icon(Cancel01Icon, "X");
export const XCircle = icon(CancelCircleIcon, "XCircle");
export const Plus = icon(PlusSignIcon, "Plus");
export const Minus = icon(MinusSignIcon, "Minus");
export const Check = icon(Tick01Icon, "Check");
export const CheckCheck = icon(TickDouble01Icon, "CheckCheck");
export const CheckCircle2 = icon(CheckmarkCircle01Icon, "CheckCircle2");
export const Loader2 = icon(Loading03Icon, "Loader2");
export const ExternalLink = icon(LinkSquare01Icon, "ExternalLink");
export const Link2 = icon(Link01Icon, "Link2");
export const Eye = icon(EyeIcon, "Eye");
export const EyeOff = icon(ViewOffIcon, "EyeOff");
export const Download = icon(Download01Icon, "Download");
export const DownloadCloud = icon(CloudDownloadIcon, "DownloadCloud");
export const RefreshCw = icon(Refresh01Icon, "RefreshCw");
export const RefreshCcw = icon(Refresh01Icon, "RefreshCcw");
export const Trash2 = icon(Delete02Icon, "Trash2");
export const Send = icon(MailSend01Icon, "Send");
export const Paperclip = icon(Attachment01Icon, "Paperclip");
export const Smartphone = icon(SmartPhone01Icon, "Smartphone");
export const Puzzle = icon(PuzzleIcon, "Puzzle");
export const PlugZap = icon(PlugSocketIcon, "PlugZap");
export const WifiOff = icon(WifiOff01Icon, "WifiOff");
export const Globe = icon(Globe02Icon, "Globe");
export const Sun = icon(Sun01Icon, "Sun");
export const Moon = icon(Moon02Icon, "Moon");
export const LogOut = icon(Logout01Icon, "LogOut");
export const KeyRound = icon(Key01Icon, "KeyRound");
export const MapPin = icon(Location01Icon, "MapPin");

/* Meaning ------------------------------------------------------------------ */
export const AlertTriangle = icon(Alert02Icon, "AlertTriangle");
export const Info = icon(InformationCircleIcon, "Info");
export const HelpCircle = icon(HelpCircleIcon, "HelpCircle");
export const Lightbulb = icon(Idea01Icon, "Lightbulb");
export const Flag = icon(Flag01Icon, "Flag");
export const Flame = icon(FireIcon, "Flame");
export const Target = icon(Target01Icon, "Target");
export const Rocket = icon(Rocket01Icon, "Rocket");
export const PartyPopper = icon(PartyIcon, "PartyPopper");
export const Coffee = icon(Coffee01Icon, "Coffee");
// The nearer meaning, not the nearer shape: these were saying "verified",
// "warning" and "unknown", and a set of three near-identical shields would
// have said none of them.
export const ShieldCheck = icon(CheckmarkBadge01Icon, "ShieldCheck");
export const ShieldAlert = icon(Shield01Icon, "ShieldAlert");
export const ShieldQuestion = icon(Shield02Icon, "ShieldQuestion");

/* People, comms, records --------------------------------------------------- */
export const User = icon(UserIcon, "User");
export const Users = icon(UserMultipleIcon, "Users");
export const Bell = icon(Notification01Icon, "Bell");
export const BellOff = icon(NotificationOff01Icon, "BellOff");
export const Megaphone = icon(Megaphone01Icon, "Megaphone");
export const Inbox = icon(InboxIcon, "Inbox");
export const MessageSquare = icon(Message01Icon, "MessageSquare");
export const MessageSquarePlus = icon(MessageAdd01Icon, "MessageSquarePlus");
export const FileText = icon(File01Icon, "FileText");
export const FilePlus = icon(FileAddIcon, "FilePlus");
export const ClipboardList = icon(ClipboardListIcon, "ClipboardList");
export const ListChecks = icon(CheckListIcon, "ListChecks");
export const BookOpen = icon(BookOpen01Icon, "BookOpen");
export const GraduationCap = icon(GraduationCapIcon, "GraduationCap");
export const Briefcase = icon(Briefcase01Icon, "Briefcase");
export const Database = icon(Database01Icon, "Database");
export const Code2 = icon(SourceCodeIcon, "Code2");
export const PlayCircle = icon(PlayCircleIcon, "PlayCircle");

/* Time and measurement ----------------------------------------------------- */
export const Clock = icon(Clock01Icon, "Clock");
export const History = icon(HistoryIcon, "History");
export const Calendar = icon(Calendar01Icon, "Calendar");
export const CalendarDays = icon(Calendar03Icon, "CalendarDays");
export const CalendarClock = icon(CalendarClockIcon, "CalendarClock");
export const CalendarOff = icon(CalendarBlock01Icon, "CalendarOff");
export const CalendarSearch = icon(CalendarSearchIcon, "CalendarSearch");
export const CalendarX2 = icon(CalendarRemove01Icon, "CalendarX2");
export const PieChart = icon(PieChart01Icon, "PieChart");
export const BarChart3 = icon(ChartColumnIcon, "BarChart3");
export const TrendingUp = icon(ChartUpIcon, "TrendingUp");
export const TrendingDown = icon(ChartDownIcon, "TrendingDown");
export const Activity = icon(Pulse01Icon, "Activity");
