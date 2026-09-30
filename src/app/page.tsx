import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">KSU Events</h1>
      <p className="text-slate-600">ระบบจัดการกิจกรรม — Admin / Staff / User</p>
      <div className="flex gap-3">
        <Link href="/login" className="btn">เข้าสู่ระบบ</Link>
        <Link href="/register" className="btn-outline">สมัครสมาชิก</Link>
      </div>
    </main>
  );
}