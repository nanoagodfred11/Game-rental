import { Link, useLoaderData } from "react-router";
import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Gamepad2, Truck, Clock, CreditCard, Star, Shield, Zap, ArrowRight, Users, CheckCircle2, Headphones } from "lucide-react";
import { motion } from "framer-motion";
import { Review } from "~/models/review.server";
import { HOURLY_RATE, MIN_BOOKING_HOURS, formatCurrency } from "~/lib/constants";
import { DualSenseController } from "~/components/ui/ps5-svg";

export async function loader() {
  const featuredReviews = await Review.find({ is_visible: true, is_featured: true })
    .sort({ created_at: -1 })
    .limit(3)
    .lean();
  return {
    hourlyRate: HOURLY_RATE,
    minHours: MIN_BOOKING_HOURS,
    reviews: featuredReviews.map(r => ({
      id: r._id.toString(),
      user_name: r.user_name,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at.toISOString(),
    })),
  };
}

export default function Index() {
  const { hourlyRate, minHours, reviews } = useLoaderData<typeof loader>();

  return (
    <div className="bg-surface-900">
      {/* Hero */}
      <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=1920&q=80')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-900/80 via-surface-900/60 to-surface-900" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/20 via-transparent to-accent-900/20" />
        <div className="absolute inset-0 grid-pattern opacity-50" />

        {/* Animated orbs */}
        <div className="absolute top-1/4 left-1/4 w-40 md:w-64 h-40 md:h-64 bg-primary-500/10 rounded-full blur-[80px] md:blur-[100px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-44 md:w-72 h-44 md:h-72 bg-accent-500/10 rounded-full blur-[80px] md:blur-[100px] animate-pulse-glow" style={{ animationDelay: "1s" }} />

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-16 md:py-24 flex items-center">
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <Chip variant="flat" className="bg-primary-500/10 text-primary-400 border border-primary-500/20 mb-4 md:mb-6" size="sm">
                Premium Gaming Rental Service
              </Chip>
              <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black mb-4 md:mb-6 leading-[1.1]">
                <span className="text-white">PS5 GAMING</span>
                <br />
                <span className="neon-text-cyan">IN YOUR ROOM</span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-base md:text-xl text-gray-400 mb-6 md:mb-8 max-w-xl mx-auto lg:mx-0"
            >
              Premium PlayStation 5 gaming setups delivered right to your hostel room. Complete with TV, controllers, and all accessories.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="flex gap-3 md:gap-4 justify-center lg:justify-start flex-wrap"
            >
              <Link to="/bookings/new">
                <Button size="lg" className="bg-primary-500 text-white font-semibold neon-glow-cyan hover:bg-primary-400 px-6 md:px-8 text-sm md:text-base">
                  Book Now <ArrowRight className="ml-1.5 h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </Link>
              <Link to="/equipment">
                <Button size="lg" variant="bordered" className="text-gray-200 border-white/20 hover:bg-white/5 backdrop-blur-sm text-sm md:text-base">
                  Browse Equipment
                </Button>
              </Link>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.7 }}
              className="flex items-center gap-4 md:gap-6 mt-8 md:mt-10 justify-center lg:justify-start flex-wrap"
            >
              {[
                { icon: CheckCircle2, text: "Setup Included" },
                { icon: Shield, text: "Safe & Secure" },
                { icon: Headphones, text: "24/7 Support" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs md:text-sm text-gray-400">
                  <item.icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-400" />
                  {item.text}
                </div>
              ))}
            </motion.div>
          </div>

          {/* Floating PS5 image (desktop) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:block flex-1 relative"
          >
            <div className="animate-float">
              <img
                src="https://images.unsplash.com/photo-1622297845775-5ff3fef71d13?w=600&q=80"
                alt="PS5 Console"
                className="w-full max-w-md mx-auto rounded-2xl shadow-2xl shadow-primary-500/20"
              />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-surface-900/40 to-transparent" />
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator - hidden on short mobile screens */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:block"
        >
          <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-2"
            />
          </div>
        </motion.div>
      </section>

      {/* Stats Strip */}
      <section className="py-6 md:py-8 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-4 gap-3 md:gap-8">
            {[
              { value: "500+", label: "Sessions", icon: Gamepad2 },
              { value: "100+", label: "Students", icon: Users },
              { value: "4.8/5", label: "Rating", icon: Star },
              { value: "<30m", label: "Delivery", icon: Truck },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center"
              >
                <stat.icon className="h-4 w-4 md:h-5 md:w-5 text-primary-400 mx-auto mb-1 md:mb-2" />
                <p className="text-lg md:text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-[10px] md:text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Games */}
      <section className="py-16 md:py-24 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8 md:mb-12"
          >
            <Chip variant="flat" className="bg-accent-500/10 text-accent-400 border border-accent-500/20 mb-3 md:mb-4" size="sm">
              Featured Titles
            </Chip>
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-3">Play The Biggest Games</h2>
            <p className="text-sm md:text-base text-gray-400 max-w-lg mx-auto">Access the latest and greatest PS5 titles during your session</p>
          </motion.div>
        </div>

        {/* Horizontal scroll on mobile, grid on desktop */}
        <div className="max-w-6xl mx-auto">
          <div className="flex md:grid md:grid-cols-4 gap-4 md:gap-5 overflow-x-auto px-4 pb-4 md:pb-0 snap-x snap-mandatory scrollbar-hide">
            {[
              { name: "God of War Ragnarok", genre: "Action RPG", img: "/games/god-of-war-ragnarok.jpg" },
              { name: "Ghost of Yotei", genre: "Open World", img: "/games/ghost-of-yotei.jpg" },
              { name: "Stellar Blade", genre: "Action", img: "/games/stellar-blade.jpg" },
              { name: "The Last of Us Part I", genre: "Adventure", img: "/games/the-last-of-us.jpg" },
              { name: "Astro Bot", genre: "Platformer", img: "/games/astro-bot.jpg" },
              { name: "God of War: Sparta", genre: "Action RPG", img: "/games/god-of-war-sparta.jpg" },
              { name: "Helldivers 2", genre: "Co-op Shooter", img: "/games/helldivers-2.jpg" },
              { name: "Horizon Adventures", genre: "Open World", img: "/games/horizon.jpg" },
            ].map((game, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="flex-shrink-0 w-[200px] md:w-auto snap-start group"
              >
                <div className="relative rounded-xl overflow-hidden aspect-video">
                  <img
                    src={game.img}
                    alt={game.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  {/* Game info */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                    <p className="text-white font-bold text-xs md:text-sm leading-tight">{game.name}</p>
                    <p className="text-primary-400 text-[10px] md:text-xs mt-0.5">{game.genre}</p>
                  </div>
                  {/* Hover glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ring-2 ring-inset ring-primary-400/50 rounded-xl" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 px-4 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 md:mb-16"
        >
          <Chip variant="flat" className="bg-primary-500/10 text-primary-400 border border-primary-500/20 mb-3 md:mb-4" size="sm">
            Why Choose Us
          </Chip>
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-3">The Premium Gaming Experience</h2>
          <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto">Experience premium gaming without the investment</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          {[
            { icon: Zap, title: "Easy Booking", desc: "Book your gaming session in just a few clicks. Choose your time slot and we handle the rest.", color: "primary" },
            { icon: Truck, title: "Fast Delivery", desc: "Equipment delivered directly to your hostel room. Setup included — just start playing!", color: "accent" },
            { icon: Shield, title: "Affordable Rates", desc: `Starting at just ${formatCurrency(hourlyRate)}/hour with a minimum of ${minHours} hours.`, color: "warning" },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Card className="glass-card-hover border border-white/10 h-full">
                <CardBody className="p-5 md:p-8 flex flex-row md:flex-col items-start md:items-center md:text-center gap-4 md:gap-0">
                  <div className={`w-12 h-12 md:w-14 md:h-14 shrink-0 md:mx-auto md:mb-5 rounded-xl md:rounded-2xl flex items-center justify-center bg-${feature.color}-500/10`}>
                    <feature.icon className={`h-6 w-6 md:h-7 md:w-7 text-${feature.color}-400`} />
                  </div>
                  <div>
                    <h3 className="text-base md:text-xl font-semibold text-white mb-1 md:mb-3">{feature.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 md:py-24 px-4 relative">
        <div className="absolute inset-0 bg-white/[0.02]" />
        <div className="max-w-6xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10 md:mb-16"
          >
            <Chip variant="flat" className="bg-accent-500/10 text-accent-400 border border-accent-500/20 mb-3 md:mb-4" size="sm">
              How It Works
            </Chip>
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-3">Four Simple Steps</h2>
            <p className="text-sm md:text-base text-gray-400">From booking to gaming in minutes</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { step: "1", icon: Gamepad2, title: "Browse", desc: "Check available PS5 sets and time slots" },
              { step: "2", icon: Clock, title: "Book", desc: "Select your preferred time (2-6 hours)" },
              { step: "3", icon: CreditCard, title: "Pay", desc: "Send payment via MTN Mobile Money" },
              { step: "4", icon: Star, title: "Play", desc: "We deliver, set up, and you game on!" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center relative"
              >
                {/* Connecting line (desktop only) */}
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary-500/30 to-accent-500/30" />
                )}
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white text-lg md:text-2xl font-bold flex items-center justify-center mx-auto mb-3 md:mb-4 relative z-10 shadow-lg shadow-primary-500/20">
                  {item.step}
                </div>
                <h3 className="text-sm md:text-lg font-semibold text-white mb-1 md:mb-2">{item.title}</h3>
                <p className="text-xs md:text-sm text-gray-400">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 md:py-24 px-4 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Chip variant="flat" className="bg-primary-500/10 text-primary-400 border border-primary-500/20 mb-3 md:mb-4" size="sm">
            Pricing
          </Chip>
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-3">Simple, Transparent Pricing</h2>
          <p className="text-sm md:text-base text-gray-400 mb-8 md:mb-12">No hidden fees. Pay only for the time you play.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-sm md:max-w-md mx-auto"
        >
          <Card className="glass-card gradient-border overflow-hidden">
            <CardBody className="p-6 md:p-8 relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary-500/5 to-transparent rounded-bl-full" />
              <p className="text-4xl md:text-5xl font-extrabold mb-2 relative">
                <span className="neon-text-cyan">{formatCurrency(hourlyRate)}</span>
              </p>
              <p className="text-gray-400 text-sm mb-5 md:mb-6">per hour</p>
              <ul className="text-left text-gray-300 space-y-2.5 md:space-y-3 mb-6 md:mb-8 text-sm md:text-base">
                {[
                  "PS5 Console + 32\" TV",
                  "2 DualSense Controllers",
                  "Delivery & Setup Included",
                  `Minimum ${minHours} hours booking`,
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link to="/bookings/new">
                <Button fullWidth size="lg" className="bg-primary-500 text-white font-semibold neon-glow-cyan hover:bg-primary-400">
                  Book Now
                </Button>
              </Link>
            </CardBody>
          </Card>
        </motion.div>
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="py-16 md:py-24 px-4 relative">
          <div className="absolute inset-0 bg-white/[0.02]" />
          <div className="max-w-6xl mx-auto relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-10 md:mb-16"
            >
              <Chip variant="flat" className="bg-warning-500/10 text-warning-500 border border-warning-500/20 mb-3 md:mb-4" size="sm">
                Testimonials
              </Chip>
              <h2 className="text-2xl md:text-4xl font-bold text-white mb-3">What Students Say</h2>
              <p className="text-sm md:text-base text-gray-400">Real reviews from our happy gamers</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-4 md:gap-6">
              {reviews.map((review: any, i: number) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Card className="glass-card-hover border border-white/10 h-full">
                    <CardBody className="p-5 md:p-6">
                      <div className="flex items-center gap-1 mb-3">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star
                            key={j}
                            className={`h-3.5 w-3.5 md:h-4 md:w-4 ${
                              j < review.rating
                                ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.4)]"
                                : "text-gray-600"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-gray-300 mb-4 text-sm leading-relaxed">{review.comment}</p>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-xs font-bold">
                          {review.user_name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <p className="font-semibold text-sm text-white">{review.user_name}</p>
                      </div>
                    </CardBody>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 md:py-24 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-900/10 to-transparent" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <DualSenseController className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-6 md:mb-8 opacity-20" />
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 md:mb-4">Ready to Play?</h2>
          <p className="text-sm md:text-base text-gray-400 mb-6 md:mb-8 max-w-md mx-auto">Join hundreds of students already enjoying premium PS5 gaming in their rooms.</p>
          <div className="flex gap-3 md:gap-4 justify-center flex-wrap">
            <Link to="/auth/register">
              <Button size="lg" className="bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold px-6 md:px-8 shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transition-shadow text-sm md:text-base">
                Get Started <ArrowRight className="ml-1.5 h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </Link>
            <Link to="/equipment">
              <Button size="lg" variant="bordered" className="text-gray-300 border-white/20 hover:bg-white/5 text-sm md:text-base">
                View Equipment
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
