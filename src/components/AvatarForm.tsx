"use client";

import { useActionState } from "react";
import { updateAvatar } from "@/app/actions/profile";

export default function AvatarForm() {
  const [state, action, pending] = useActionState(updateAvatar, undefined);

  return (
    <form action={action} className="space-y-3">
      <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" className="input" />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">{state.success}</p>}
      <button className="btn" disabled={pending}>{pending ? "กำลังอัปโหลด..." : "อัปโหลดรูป"}</button>
    </form>
  );
}