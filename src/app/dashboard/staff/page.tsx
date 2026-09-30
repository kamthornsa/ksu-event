import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { createEvent, setEventStatus } from "@/app/actions/events";

export default async function StaffPage() {
  const session = await requireUser("STAFF", "ADMIN");

  // ADMIN เห็นทุกกิจกรรม, STAFF เห็นเฉพาะของตัวเอง
  const events = await prisma.event.findMany({
    where: session.role === "ADMIN" ? {} : { createdById: session.userId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: true, _count: { select: { registrations: true } } },
  });

  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr]">
      <form action={createEvent} className="card h-fit space-y-3">
        <h2 className="font-bold">สร้างกิจกรรมใหม่</h2>
        <input name="title" placeholder="ชื่อกิจกรรม" className="input" required />
        <textarea name="description" placeholder="รายละเอียด" className="input" rows={3} />
        <input name="location" placeholder="สถานที่" className="input" />
        <input name="eventDate" type="datetime-local" className="input" required />
        <input name="capacity" type="number" min={1} defaultValue={50} className="input" />
        <button className="btn w-full">บันทึก (Draft)</button>
      </form>

      <div className="space-y-3">
        <h2 className="text-xl font-bold">กิจกรรม ({events.length})</h2>
        {events.map((e) => (
          <div key={e.id} className="card flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{e.title}</p>
              <p className="text-xs text-slate-500">
                โดย {e.createdBy.name} · ผู้สมัคร {e._count.registrations}/{e.capacity}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{e.status}</span>
              {e.status === "DRAFT" && (
                <form action={setEventStatus.bind(null, e.id, "PUBLISHED")}>
                  <button className="btn-outline">เผยแพร่</button>
                </form>
              )}
              {e.status === "PUBLISHED" && (
                <form action={setEventStatus.bind(null, e.id, "CLOSED")}>
                  <button className="btn-outline">ปิดรับสมัคร</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}