import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Web3Provider } from "@/contexts/web3-context"
import { ReownProvider } from "@/contexts/reown-provider"
import { DemoProvider } from "@/contexts/demo-context"
import { UserTypeProvider } from "@/contexts/user-type-context"
import { AuthProvider } from "@/contexts/auth-provider"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MobileNav } from "@/components/mobile-nav"
import { Toaster } from "@/components/ui/toaster"
import { RecaptchaScript } from "@/components/recaptcha-script"
import { WelcomeGuide } from "@/components/welcome-guide"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { NotificationPrompt } from "@/components/notification-prompt"
import { ThemeProvider } from "@/components/theme-provider"

export const dynamic = "force-dynamic"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" })

export const metadata: Metadata = {
  title: "Protocol Banks - Crypto Batch Payment Platform",
  description:
    "Efficiently manage and execute batch cryptocurrency payments with vendor tracking and financial analytics",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Protocol Banks",
    startupImage: "/logo.png",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/logo.png", sizes: "32x32", type: "image/png" },
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/logo.png",
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    title: "Protocol Banks",
    description: "Enterprise Crypto Batch Payment Platform",
    siteName: "Protocol Banks",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Protocol Banks" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="apple-touch-startup-image" href="/logo.png" />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <UserTypeProvider>
            <AuthProvider>
              <ReownProvider>
                <Web3Provider>
                  <DemoProvider>
                    <div className="relative min-h-screen flex flex-col pb-safe">
                      <Header />
                      <main className="flex-1 pb-16 md:pb-0">{children}</main>
                      <div className="hidden md:block">
                        <Footer />
                      </div>
                      <MobileNav />
                    </div>
                    <Toaster />
                    <RecaptchaScript />
                    <WelcomeGuide />
                    <PWAInstallPrompt />
                    <NotificationPrompt />
                  </DemoProvider>
                </Web3Provider>
              </ReownProvider>
            </AuthProvider>
          </UserTypeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
