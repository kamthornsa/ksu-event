import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import { logout } from "@/app/actions/auth";
import Avatar from "@/components/Avatar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });

  return (
    <div>
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3 text-sm">
          <Link href="/dashboard" className="font-bold">KSU Events</Link>
          <Link href="/dashboard">กิจกรรม</Link>
          {session.role !== "USER" && <Link href="/dashboard/staff">จัดการกิจกรรม</Link>}
          {session.role === "ADMIN" && <Link href="/dashboard/admin">จัดการผู้ใช้</Link>}

          <div className="ml-auto flex items-center gap-3">
            <Link href="/dashboard/profile" className="flex items-center gap-2">
              <Avatar url={publicUrl(user?.avatarKey)} name={session.name} size={32} />
              <span>{session.name}</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{session.role}</span>
            </Link>
            <form action={logout}>
              <button className="btn-outline">ออกจากระบบ</button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}