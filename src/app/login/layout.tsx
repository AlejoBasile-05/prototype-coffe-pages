import { redirect } from "next/navigation";

import { verifyAdminSession } from "@/server/auth/verify-admin";

/**
 * Si ya hay sesión, `/login` no tiene nada que ofrecer.
 *
 * ⚠️ Esta redirección es **UX**. Lo que protege el panel es
 *    `verifyAdminSession` en cada action y en `/admin/layout.tsx`.
 */
export default async function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await verifyAdminSession();
  if (session !== null) {
    redirect("/admin");
  }

  return children;
}
