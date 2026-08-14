import {
  Rocket,
  PieChart,
  Code2,
  Database,
  BarChart3,
  Clock,
  Briefcase,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import type { SubjectIcon } from "@/types/subject";

export const SUBJECT_ICONS: Record<SubjectIcon, LucideIcon> = {
  rocket: Rocket,
  "pie-chart": PieChart,
  code: Code2,
  database: Database,
  "bar-chart": BarChart3,
  cpp: Code2,
  clock: Clock,
  briefcase: Briefcase,
  book: BookOpen,
};
