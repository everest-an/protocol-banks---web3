"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { MobileNav } from "@/components/mobile-nav";
import { Toaster } from "@/components/ui/toaster";
import { WelcomeGuide } from "@/components/welcome-guide";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { NotificationPrompt } from "@/components/notification-prompt";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare =
    pathname === "/checkout" ||
    pathname.startsWith("/checkout/") ||
    pathname.startsWith("/p/");

  if (bare) {
    return (
      <>
        <main className="min-h-screen flex-1">{children}</main>
        <Toaster />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <div className="hidden md:block">
        <Footer />
      </div>
      <MobileNav />
      <WelcomeGuide />
      <PWAInstallPrompt />
      <NotificationPrompt />
      <Toaster />
    </>
  );
}
