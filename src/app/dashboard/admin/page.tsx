import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import { changeRole } from "@/app/actions/admin";
import Avatar from "@/components/Avatar";

export default async function AdminPage() {
  const session = await requireUser("ADMIN");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="card overflow-x-auto">
      <h1 className="mb-4 text-xl font-bold">จัดการผู้ใช้ ({users.length})</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="py-2">ผู้ใช้</th>
            <th>อีเมล</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b last:border-0">
              <td className="flex items-center gap-2 py-2">
                <Avatar url={publicUrl(u.avatarKey)} name={u.name} size={28} /> {u.name}
              </td>
              <td>{u.email}</td>
              <td>
                {u.id === session.userId ? (
                  <span className="text-xs text-slate-500">{u.role} (คุณ)</span>
                ) : (
                  <form action={changeRole.bind(null, u.id)} className="flex gap-2">
                    <select name="role" defaultValue={u.role} className="rounded border px-2 py-1">
                      <option>ADMIN</option>
                      <option>STAFF</option>
                      <option>USER</option>
                    </select>
                    <button className="btn-outline">บันทึก</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}