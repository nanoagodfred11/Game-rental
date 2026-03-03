import { Link, useLocation } from "react-router";
import {
  Navbar as HeroNavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
  Button,
} from "@heroui/react";
import { Gamepad2, Bell, User, Shield, LogOut } from "lucide-react";
import { useState } from "react";

interface NavbarProps {
  user: { id: string; email: string; full_name: string; role: string } | null;
  unreadCount: number;
}

export default function Navbar({ user, unreadCount }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const isAdmin = user?.role === "admin";

  const customerLinks = [
    { href: "/equipment", label: "Equipment" },
    { href: "/bookings", label: "My Bookings" },
    { href: "/reviews", label: "Reviews" },
    { href: "/waitlist", label: "Waitlist" },
  ];

  return (
    <HeroNavbar
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      className="bg-surface-900/80 backdrop-blur-xl border-b border-white/5"
      maxWidth="xl"
    >
      <NavbarContent>
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="sm:hidden text-gray-300 h-10 w-10 [&>span:first-child]:sr-only"
        />
        <NavbarBrand>
          <Link to="/" className="flex items-center gap-2 text-white group">
            <div className="relative">
              <Gamepad2 className="h-6 w-6 text-primary-400 group-hover:text-primary-300 transition-colors" />
              <div className="absolute inset-0 blur-md bg-primary-400/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="font-bold text-lg">
              <span className="neon-text-cyan">PS5</span>{" "}
              <span className="text-gray-200">Rental</span>
            </span>
          </Link>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden sm:flex gap-4" justify="center">
        {user && customerLinks.map((link) => {
          const isActive = location.pathname === link.href;
          return (
            <NavbarItem key={link.href} isActive={isActive}>
              <Link
                to={link.href}
                className={`relative text-sm py-1 transition-colors ${
                  isActive
                    ? "text-primary-400 font-semibold"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary-400 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                )}
              </Link>
            </NavbarItem>
          );
        })}
        {isAdmin && (
          <NavbarItem isActive={location.pathname.startsWith("/admin")}>
            <Link
              to="/admin"
              className={`relative text-sm flex items-center gap-1 py-1 transition-colors ${
                location.pathname.startsWith("/admin")
                  ? "text-accent-400 font-semibold"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Shield className="h-4 w-4" />
              Admin
              {location.pathname.startsWith("/admin") && (
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent-400 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
              )}
            </Link>
          </NavbarItem>
        )}
      </NavbarContent>

      <NavbarContent justify="end">
        {user ? (
          <>
            <NavbarItem>
              <Link to="/notifications" className="relative text-gray-400 hover:text-gray-200 transition-colors">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-danger-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center animate-pulse-glow shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            </NavbarItem>
            <NavbarItem>
              <Link to="/profile" className="text-gray-400 hover:text-gray-200 transition-colors">
                <User className="h-5 w-5" />
              </Link>
            </NavbarItem>
            <NavbarItem>
              <form action="/auth/logout" method="post">
                <button type="submit" className="text-gray-500 hover:text-gray-300 transition-colors">
                  <LogOut className="h-5 w-5" />
                </button>
              </form>
            </NavbarItem>
          </>
        ) : (
          <>
            <NavbarItem>
              <Link to="/auth/login">
                <Button size="sm" variant="flat" className="text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10">Login</Button>
              </Link>
            </NavbarItem>
            <NavbarItem>
              <Link to="/auth/register">
                <Button size="sm" className="bg-primary-500 text-white neon-glow-cyan hover:bg-primary-400">Register</Button>
              </Link>
            </NavbarItem>
          </>
        )}
      </NavbarContent>

      {/* Gradient bottom line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />

      <NavbarMenu className="bg-surface-900/95 backdrop-blur-xl pt-4 border-t border-white/5">
        {user && customerLinks.map((link) => (
          <NavbarMenuItem key={link.href}>
            <Link
              to={link.href}
              className={`w-full py-2 ${
                location.pathname === link.href
                  ? "text-primary-400 font-semibold"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              {link.label}
            </Link>
          </NavbarMenuItem>
        ))}
        {isAdmin && (
          <NavbarMenuItem>
            <Link to="/admin" className="text-accent-400 hover:text-accent-300 w-full py-2" onClick={() => setIsMenuOpen(false)}>
              Admin Dashboard
            </Link>
          </NavbarMenuItem>
        )}
      </NavbarMenu>
    </HeroNavbar>
  );
}
