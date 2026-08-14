import { describe, expect, it } from "vitest";
import { getDeadline, getDueSoon, sortByUrgency } from "./deadlines";
import type { TaskDoc } from "@/types/task";

const TODAY = "2026-08-15";

function task(id: string, dueDate: string, extra: Partial<TaskDoc> = {}): TaskDoc {
  return {
    id,
    studentId: "u1",
    title: id,
    notes: "",
    kind: "assignment",
    dueDate,
    dueTime: null,
    subjectId: null,
    done: false,
    completedAt: null,
    createdAt: TODAY,
    updatedAt: TODAY,
    ...extra,
  };
}

describe("getDeadline", () => {
  it("counts whole days remaining", () => {
    expect(getDeadline("2026-08-17", TODAY)).toMatchObject({ daysLeft: 2, label: "2 days left" });
  });

  it("names today and tomorrow instead of counting them", () => {
    expect(getDeadline(TODAY, TODAY)).toMatchObject({ urgency: "today", label: "Due today" });
    expect(getDeadline("2026-08-16", TODAY)).toMatchObject({
      urgency: "tomorrow",
      label: "Due tomorrow",
    });
  });

  it("reports overdue in the positive, and singularises one day", () => {
    expect(getDeadline("2026-08-14", TODAY)).toMatchObject({
      daysLeft: -1,
      urgency: "overdue",
      label: "1 day overdue",
    });
    expect(getDeadline("2026-08-12", TODAY).label).toBe("3 days overdue");
  });

  it("separates 'soon' from 'later' so only the near ones can shout", () => {
    expect(getDeadline("2026-08-18", TODAY).urgency).toBe("soon"); // 3 days
    expect(getDeadline("2026-08-19", TODAY).urgency).toBe("later"); // 4 days
  });

  it("crosses a month boundary correctly", () => {
    expect(getDeadline("2026-09-01", "2026-08-30").daysLeft).toBe(2);
  });

  it("reports a completed task as done regardless of date", () => {
    expect(getDeadline("2026-08-01", TODAY, true).urgency).toBe("done");
  });
});

describe("sortByUrgency", () => {
  it("puts overdue first, then nearest deadline", () => {
    const sorted = sortByUrgency(
      [task("later", "2026-08-20"), task("overdue", "2026-08-13"), task("today", TODAY)],
      TODAY,
    );
    expect(sorted.map((t) => t.id)).toEqual(["overdue", "today", "later"]);
  });

  it("breaks ties on the same day by time, all-day last", () => {
    const sorted = sortByUrgency(
      [
        task("allday", TODAY),
        task("evening", TODAY, { dueTime: "17:00" }),
        task("morning", TODAY, { dueTime: "09:00" }),
      ],
      TODAY,
    );
    expect(sorted.map((t) => t.id)).toEqual(["morning", "evening", "allday"]);
  });

  it("drops completed tasks", () => {
    const sorted = sortByUrgency([task("done", TODAY, { done: true }), task("open", TODAY)], TODAY);
    expect(sorted.map((t) => t.id)).toEqual(["open"]);
  });
});

describe("getDueSoon", () => {
  it("keeps only what needs attention this week", () => {
    const soon = getDueSoon(
      [
        task("overdue", "2026-08-10"),
        task("today", TODAY),
        task("in3", "2026-08-18"),
        task("in9", "2026-08-24"),
      ],
      TODAY,
    );
    expect(soon.map((t) => t.id)).toEqual(["overdue", "today", "in3"]);
  });
});
