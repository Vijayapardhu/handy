import { z } from "zod";

export const leaveRequestSchema = z
  .object({
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    reason: z
      .string()
      .trim()
      .min(10, "Please provide a bit more detail (10+ characters)")
      .max(500, "Reason is too long"),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export type LeaveRequestFormValues = z.infer<typeof leaveRequestSchema>;

export const attendanceCorrectionSchema = z.object({
  subjectId: z.string().min(1, "Select a subject"),
  date: z.string().min(1, "Select a date"),
  expectedStatus: z.enum(["present", "absent", "leave", "excused"]),
  reason: z.string().trim().min(10, "Please explain the issue (10+ characters)").max(500),
});

export type AttendanceCorrectionFormValues = z.infer<typeof attendanceCorrectionSchema>;
