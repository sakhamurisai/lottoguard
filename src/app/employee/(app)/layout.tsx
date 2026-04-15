import { AuthGuard } from "@/components/auth-guard";

export default function EmployeeAppLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard role="employee">{children}</AuthGuard>;
}
