import { requireUser } from "~/services/session.server";
import { Waitlist } from "~/models/waitlist.server";
import { Equipment } from "~/models/equipment.server";

export async function loader({ request }: { request: Request }) {
  await requireUser(request);
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date) return Response.json({ error: "Date is required" }, { status: 400 });

  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const waitlistCount = await Waitlist.countDocuments({
    preferred_date: { $gte: startOfDay, $lte: endOfDay },
    status: "waiting",
  });

  const totalEquipment = await Equipment.countDocuments({ status: { $ne: "maintenance" } });

  return Response.json({
    date,
    waitlist_count: waitlistCount,
    total_equipment: totalEquipment,
  });
}
