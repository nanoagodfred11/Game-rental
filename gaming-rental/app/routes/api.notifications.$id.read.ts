import { requireUser } from "~/services/session.server";
import { Notification } from "~/models/notification.server";

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  await Notification.updateOne(
    { _id: params.id, user_id: user._id.toString() },
    { $set: { is_read: true, read_at: new Date() } }
  );
  return Response.json({ success: true });
}
