import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import Avatar from "@/components/Avatar";
import AvatarForm from "@/components/AvatarForm";

export default async function ProfilePage() {
  const session = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });

  return (
    <div className="card max-w-md space-y-4">
      <h1 className="text-xl font-bold">โปรไฟล์</h1>
      <div className="flex items-center gap-4">
        <Avatar url={publicUrl(user.avatarKey)} name={user.name} size={80} />
        <div>
          <p className="font-semibold">{user.name}</p>
          <p className="text-sm text-slate-600">{user.email}</p>
          <p className="text-xs text-slate-500">Role: {user.role}</p>
        </div>
      </div>
      <AvatarForm />
    </div>
  );
}