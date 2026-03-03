import { PromoCode } from "~/models/promo-code.server";

export async function loader() {
  const now = new Date();
  const promos = await PromoCode.find({
    is_active: true,
    $and: [
      { $or: [{ valid_until: null }, { valid_until: { $gte: now } }] },
      { $or: [{ max_uses: null }, { $expr: { $lt: ["$current_uses", "$max_uses"] } }] },
    ],
  }).select("code name description discount_type discount_value min_hours").lean();

  return Response.json(promos.map(p => ({
    code: p.code,
    name: p.name,
    description: p.description,
    discount_type: p.discount_type,
    discount_value: p.discount_value,
    min_hours: p.min_hours,
  })));
}
