import { z } from "zod";

/** Mirrors MAX_TITLE / MAX_BODY in api/announce.js — the server re-checks both. */
export const announcementSchema = z.object({
  groupKey: z.string().min(1, "Choose which class this is for"),
  title: z
    .string()
    .trim()
    .min(1, "Give the announcement a title")
    .max(140, "Title is too long"),
  body: z.string().trim().max(4000, "Message is too long"),
  important: z.boolean(),
});

export type AnnouncementFormValues = z.infer<typeof announcementSchema>;
