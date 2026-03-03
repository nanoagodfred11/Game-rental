import { useLoaderData, Link } from "react-router";
import { Card, CardBody, CardFooter, Button, Chip } from "@heroui/react";
import { Monitor, Clock, Wrench } from "lucide-react";
import { motion } from "framer-motion";
import { Equipment } from "~/models/equipment.server";
import { Booking } from "~/models/booking.server";
import { requireUser } from "~/services/session.server";
import { formatCurrency } from "~/lib/constants";
import StatusBadge from "~/components/ui/status-badge";
import { AnimatedPage, StaggerContainer, StaggerItem } from "~/components/ui/animated-container";

const PS5_IMAGES = [
  "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=600&q=80",
  "https://images.unsplash.com/photo-1617096200347-cb04ae810b1d?w=600&q=80",
];

export async function loader({ request }: { request: Request }) {
  await requireUser(request);
  const equipment = await Equipment.find().lean();

  const equipmentWithBookings = await Promise.all(
    equipment.map(async (eq) => {
      const activeBooking = await Booking.findOne({
        equipment_id: eq.equipment_id,
        status: { $in: ["in_use", "extended", "delivered", "awaiting_confirmation"] },
      }).lean();

      const upcomingBookings = await Booking.find({
        equipment_id: eq.equipment_id,
        status: { $in: ["pending", "payment_received", "confirmed"] },
        start_time: { $gte: new Date() },
      }).sort({ start_time: 1 }).limit(3).lean();

      return {
        id: eq._id.toString(),
        name: eq.name,
        equipment_id: eq.equipment_id,
        description: eq.description,
        components: eq.components,
        status: eq.status,
        hourly_rate: eq.hourly_rate,
        total_bookings: eq.total_bookings,
        activeSession: activeBooking ? {
          booking_id: activeBooking.booking_id,
          end_time: activeBooking.actual_end_time?.toISOString() || activeBooking.end_time.toISOString(),
        } : null,
        upcomingBookings: upcomingBookings.map(b => ({
          booking_id: b.booking_id,
          start_time: b.start_time.toISOString(),
          end_time: b.end_time.toISOString(),
        })),
      };
    })
  );

  return { equipment: equipmentWithBookings };
}

export default function EquipmentPage() {
  const { equipment } = useLoaderData<typeof loader>();

  return (
    <AnimatedPage>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Available Equipment</h1>
            <p className="text-gray-400 mt-1">Choose a PS5 set to book your gaming session</p>
          </div>
          <Link to="/bookings/new">
            <Button className="bg-primary-500 text-white neon-glow-cyan hover:bg-primary-400">
              New Booking
            </Button>
          </Link>
        </div>

        <StaggerContainer className="grid md:grid-cols-2 gap-6">
          {equipment.map((eq: any, index: number) => (
            <StaggerItem key={eq.id}>
              <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                <Card className="glass-card overflow-hidden border border-white/10 group">
                  <div className="h-48 relative overflow-hidden">
                    <img
                      src={PS5_IMAGES[index % 2]}
                      alt={eq.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-900 to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <StatusBadge status={eq.status} />
                    </div>
                  </div>
                  <CardBody className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary-500/10 rounded-xl flex items-center justify-center">
                          <Monitor className="h-6 w-6 text-primary-400" />
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold text-white">{eq.name}</h2>
                          <p className="text-sm text-gray-400">{eq.equipment_id}</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-300 text-sm mb-4">{eq.description}</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {eq.components.map((c: string, i: number) => (
                        <Chip key={i} size="sm" variant="flat" className="bg-white/10 text-gray-300">
                          {c}
                        </Chip>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>{formatCurrency(eq.hourly_rate)}/hour</span>
                      <span>{eq.total_bookings} bookings</span>
                    </div>

                    {eq.activeSession && (
                      <div className="mt-3 p-3 bg-warning-500/10 rounded-lg text-sm">
                        <div className="flex items-center gap-1 text-warning-400 font-medium">
                          <Clock className="h-4 w-4" />
                          Active session until {new Date(eq.activeSession.end_time).toLocaleTimeString()}
                        </div>
                      </div>
                    )}
                  </CardBody>
                  <CardFooter className="border-t border-white/10 px-6 py-3">
                    {eq.status === "available" ? (
                      <Link to={`/bookings/new?equipment=${eq.equipment_id}`} className="w-full">
                        <Button
                          fullWidth
                          size="sm"
                          className="bg-primary-500 text-white neon-glow-cyan hover:bg-primary-400"
                        >
                          Book Now
                        </Button>
                      </Link>
                    ) : eq.status === "maintenance" ? (
                      <Button
                        fullWidth
                        size="sm"
                        isDisabled
                        startContent={<Wrench className="h-4 w-4" />}
                        className="bg-white/5 text-gray-400"
                      >
                        Under Maintenance
                      </Button>
                    ) : (
                      <Link to="/waitlist" className="w-full">
                        <Button fullWidth size="sm" variant="flat" className="bg-white/5 text-gray-300">
                          Join Waitlist
                        </Button>
                      </Link>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </AnimatedPage>
  );
}
