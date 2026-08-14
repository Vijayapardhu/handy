import { z } from "zod";

export const timetableReportSchema = z.object({
  subjectId: z.string().optional(),
  description: z
    .string()
    .trim()
    .min(10, "Please describe the issue in a bit more detail (10+ characters)")
    .max(500, "Description is too long"),
});

export type TimetableReportFormValues = z.infer<typeof timetableReportSchema>;
