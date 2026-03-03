import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  Link,
  useLocation,
} from "react-router";
import { HeroUIProvider } from "@heroui/react";
import { getUser } from "~/services/session.server";
import { Notification } from "~/models/notification.server";
import Navbar from "~/components/ui/navbar";
import "~/styles/tailwind.css";

export const links = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
  { rel: "preconnect", href: "https://images.unsplash.com" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" },
  { rel: "preload", as: "image", href: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=1920&q=80" },
];

export async function loader({ request }: { request: Request }) {
  const user = await getUser(request);
  let unreadCount = 0;
  if (user) {
    unreadCount = await Notification.countDocuments({ user_id: user._id.toString(), is_read: false });
  }
  return { user: user ? { id: user._id.toString(), email: user.email, full_name: user.full_name, role: user.role } : null, unreadCount };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>PS5 Gaming Rental</title>
        <Meta />
        <Links />
      </head>
      <body className="bg-surface-900 text-gray-100">
        <HeroUIProvider>
          {children}
        </HeroUIProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { user, unreadCount } = useLoaderData<typeof loader>();
  return (
    <>
      <Navbar user={user} unreadCount={unreadCount} />
      <main className="min-h-screen">
        <Outlet />
      </main>
      <footer className="relative mt-8 md:mt-16">
        <div className="h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent" />
        <div className="glass-card rounded-none border-x-0 border-b-0 py-6 md:py-8">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-xs md:text-sm text-gray-400">
              &copy; {new Date().getFullYear()}{" "}
              <span className="neon-text-cyan font-semibold">PS5 Gaming Rental</span>
              . All rights reserved.
            </p>
            <p className="text-[10px] md:text-xs mt-1 text-gray-500">Premium gaming experiences for hostel students in Ghana</p>
          </div>
        </div>
      </footer>
    </>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1 className="text-3xl font-bold text-danger-500">{message}</h1>
      <p className="mt-2 text-gray-400">{details}</p>
      {stack && <pre className="w-full p-4 overflow-x-auto mt-4 bg-white/5 rounded-lg text-sm font-mono text-gray-300"><code>{stack}</code></pre>}
    </main>
  );
}
