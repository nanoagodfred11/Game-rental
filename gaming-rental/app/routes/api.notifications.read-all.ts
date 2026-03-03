import { requireUser } from "~/services/session.server";
import { Notification } from "~/models/notification.server";

export async function action({ request }: { request: Request }) {
  const user = await requireUser(request);
  await Notification.updateMany(
    { user_id: user._id.toString(), is_read: false },
    { $set: { is_read: true, read_at: new Date() } }
  );
  return Response.json({ success: true });
}
