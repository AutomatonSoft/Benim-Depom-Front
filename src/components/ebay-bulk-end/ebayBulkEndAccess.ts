export type ManagerAccessState = "manager" | "guest" | "denied" | "error";

export function managerAccessStateForStatus(status: number): ManagerAccessState {
  if (status === 401) return "guest";
  if (status === 403) return "denied";
  if (status >= 200 && status < 300) return "manager";
  return "error";
}
