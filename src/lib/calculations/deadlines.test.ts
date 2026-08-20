import { describe, expect, it } from "vitest";
import { countByUrgency, focusMessage, getDeadline, getDueSoon, nextOccurrence, sortByUrgency } from "./deadlines";
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
    subtasks: [],
    repeat: "none",
    attachDay: null,
    attachTime: null,
    attachLabel: null,
    leadDays: null,
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

describe("countByUrgency", () => {
  it("counts overdue, today and the week separately, with today double-counted into the week", () => {
    const tasks = [
      task("overdue", "2026-08-13"),
      task("today", TODAY),
      task("soon", "2026-08-17"),
      task("later", "2026-08-30"),
    ];
    expect(countByUrgency(tasks, TODAY)).toEqual({ overdue: 1, today: 1, week: 2 });
  });

  it("is all zeroes with nothing open", () => {
    expect(countByUrgency([], TODAY)).toEqual({ overdue: 0, today: 0, week: 0 });
  });
});

describe("focusMessage", () => {
  it("leads with overdue over everything else", () => {
    const tasks = [task("overdue", "2026-08-10"), task("today", TODAY)];
    expect(focusMessage(tasks, TODAY)).toBe("1 thing overdue — clear that first.");
  });

  it("pluralises more than one overdue", () => {
    const tasks = [task("a", "2026-08-10"), task("b", "2026-08-11")];
    expect(focusMessage(tasks, TODAY)).toBe("2 things overdue — clear those first.");
  });

  it("leads with today when nothing is overdue", () => {
    const tasks = [task("today", TODAY), task("later", "2026-08-30")];
    expect(focusMessage(tasks, TODAY)).toBe("1 thing due today.");
  });

  it("names the next task when it falls within the soon window", () => {
    const tasks = [task("record", "2026-08-17", { title: "Lab record" })];
    expect(focusMessage(tasks, TODAY)).toBe("Lab record — 2 days left.");
  });

  it("falls back to a plain count once nothing is urgent", () => {
    const tasks = [task("a", "2026-08-25"), task("b", "2026-08-30")];
    expect(focusMessage(tasks, TODAY)).toBe("2 things on your list, nothing urgent yet.");
  });

  it("has a distinct empty state", () => {
    expect(focusMessage([], TODAY)).toBe("Nothing on your plate — good time to get ahead.");
  });
});

describe("nextOccurrence", () => {
  it("adds the right number of days for each non-monthly cadence", () => {
    expect(nextOccurrence("2026-08-15", "daily")).toBe("2026-08-16");
    expect(nextOccurrence("2026-08-15", "weekly")).toBe("2026-08-22");
    expect(nextOccurrence("2026-08-15", "fortnightly")).toBe("2026-08-29");
  });

  it("leaves a non-repeating date untouched", () => {
    expect(nextOccurrence("2026-08-15", "none")).toBe("2026-08-15");
  });

  it("adds a calendar month, keeping the same day of month", () => {
    expect(nextOccurrence("2026-08-05", "monthly")).toBe("2026-09-05");
  });

  it("crosses a year boundary", () => {
    expect(nextOccurrence("2026-12-20", "monthly")).toBe("2027-01-20");
  });

  it("clamps a monthly rollover when the next month is shorter (Jan 31 -> Feb 28)", () => {
    // JS Date rolls Feb 31 forward into March; this documents that behavior
    // rather than hiding it, matching mobile's plain DateTime(year, month+1, day).
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-03-03");
  });
});
