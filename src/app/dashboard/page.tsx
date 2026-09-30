import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { joinEvent, leaveEvent } from "@/app/actions/events";

export default async function EventsPage() {
  const session = await requireUser();

  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { eventDate: "asc" },
    include: {
      _count: { select: { registrations: true } },
      registrations: { where: { userId: session.userId } },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">กิจกรรมที่เปิดรับสมัคร</h1>
      {events.length === 0 && <p className="text-slate-500">ยังไม่มีกิจกรรม</p>}

      {events.map((event) => {
        const joined = event.registrations.length > 0;
        const full = event._count.registrations >= event.capacity;
        return (
          <div key={event.id} className="card flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">{event.title}</h2>
              <p className="text-sm text-slate-600">{event.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                📅 {event.eventDate.toLocaleString("th-TH")} · 📍 {event.location} · 👥{" "}
                {event._count.registrations}/{event.capacity}
              </p>
            </div>
            {joined ? (
              <form action={leaveEvent.bind(null, event.id)}>
                <button className="btn-outline">ยกเลิก</button>
              </form>
            ) : (
              <form action={joinEvent.bind(null, event.id)}>
                <button className="btn" disabled={full}>{full ? "เต็มแล้ว" : "ลงทะเบียน"}</button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}