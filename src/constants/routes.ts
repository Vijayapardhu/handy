export const ROUTES = {
  login: "/login",
  // No signup route: accounts exist only because the browser extension
  // created one (extension/src/account.js).
  connectPortal: "/connect-portal",
  home: "/",
  subjects: "/subjects",
  subjectDetail: (id: string = ":subjectId") => `/subjects/${id}`,
  subjectHistory: (id: string) => `/attendance/history?subjectId=${id}`,
  subjectPlanner: (id: string = ":subjectId") => `/subjects/${id}/planner`,
  timetable: "/timetable",
  tasks: "/tasks",
  leaves: "/leaves",
  leavePlanner: "/leaves/planner",
  leaveRequestNew: "/leaves/request",
  leaveDetail: (id: string = ":leaveId") => `/leaves/${id}`,
  attendancePlanner: "/planner",
  attendanceHistory: "/attendance/history",
  profile: "/profile",
  profilePersonal: "/profile/personal",
  profileAcademic: "/profile/academic",
  profilePassword: "/profile/password",
  notifications: "/notifications",
  // Reachable by anyone, but useful only to a class rep — the page itself says
  // so rather than the route pretending the capability doesn't exist.
  announce: "/announce",
} as const;
