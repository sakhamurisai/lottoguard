export type UserRole = "owner" | "employee";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  orgId: string;
  orgName: string;
};
