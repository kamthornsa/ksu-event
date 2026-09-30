"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/actions/auth";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : register, undefined);
  const isLogin = mode === "login";

  return (
    <form action={action} className="card w-full max-w-sm space-y-4">
      <h1 className="text-xl font-bold">{isLogin ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</h1>

      {!isLogin && <input name="name" placeholder="ชื่อ-นามสกุล" className="input" required />}
      <input name="email" type="email" placeholder="อีเมล" className="input" required />
      <input name="password" type="password" placeholder="รหัสผ่าน" className="input" required />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button className="btn w-full" disabled={pending}>
        {pending ? "กำลังดำเนินการ..." : isLogin ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
      </button>

      <p className="text-center text-sm text-slate-600">
        {isLogin ? (
          <>ยังไม่มีบัญชี? <Link href="/register" className="text-indigo-600">สมัครสมาชิก</Link></>
        ) : (
          <>มีบัญชีแล้ว? <Link href="/login" className="text-indigo-600">เข้าสู่ระบบ</Link></>
        )}
      </p>
    </form>
  );
}