import { connectDB } from "~/services/db.server";
import { User, UserRole } from "~/models/user.server";
import { Equipment } from "~/models/equipment.server";
import { hashPassword } from "~/services/auth.server";

const HOURLY_RATE = Number(process.env.HOURLY_RATE) || 70;

export async function seedDatabase() {
  await connectDB();
  // Seed admin
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn("ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables");
    return;
  }

  if (adminPassword.length < 12) {
    console.warn("Admin password must be at least 12 characters");
    return;
  }

  const existingAdmin = await User.findOne({ role: UserRole.ADMIN });
  if (!existingAdmin) {
    const hashed = await hashPassword(adminPassword);
    await User.create({
      email: adminEmail.toLowerCase(),
      hashed_password: hashed,
      full_name: "System Admin",
      phone_number: "0000000000",
      hostel_name: "Admin",
      room_number: "N/A",
      role: UserRole.ADMIN,
      is_active: true,
      is_verified: true,
    });
    console.log(`Admin user created: ${adminEmail}`);
  }

  // Seed equipment
  const equipmentCount = await Equipment.countDocuments();
  if (equipmentCount === 0) {
    const defaultComponents = [
      "PlayStation 5 Console",
      "32-inch TV",
      "2 DualSense Controllers",
      "HDMI Cable",
      "Power Cables",
    ];

    await Equipment.create([
      {
        name: "PS5 Gaming Set 1",
        equipment_id: "PS5-001",
        description: "PlayStation 5 with TV and 2 controllers",
        components: defaultComponents,
        status: "available",
        hourly_rate: HOURLY_RATE,
      },
      {
        name: "PS5 Gaming Set 2",
        equipment_id: "PS5-002",
        description: "PlayStation 5 with TV and 2 controllers",
        components: defaultComponents,
        status: "available",
        hourly_rate: HOURLY_RATE,
      },
    ]);
    console.log("Default equipment created: PS5-001, PS5-002");
  }
}

// Eagerly seed on module load
export const seedPromise = seedDatabase().catch((err) =>
  console.error("Seed error:", err)
);
