import type React from "react"
import type { Metadata, Viewport } from "next"
import { JetBrains_Mono } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { Web3Provider } from "@/contexts/web3-context"
import { DemoProvider } from "@/contexts/demo-context"
import { UserTypeProvider } from "@/contexts/user-type-context"
import { AuthProvider } from "@/contexts/auth-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MobileNav } from "@/components/mobile-nav"
import { Toaster } from "@/components/ui/toaster"
import { RecaptchaScript } from "@/components/recaptcha-script"
import { WelcomeGuide } from "@/components/welcome-guide"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { NotificationPrompt } from "@/components/notification-prompt"

export const dynamic = "force-dynamic"

// Aeonik font with multiple weights
const aeonik = localFont({
  src: [
    { path: '../public/fonts/Aeonik-Thin.otf', weight: '100', style: 'normal' },
    { path: '../public/fonts/Aeonik-Air.otf', weight: '200', style: 'normal' },
    { path: '../public/fonts/Aeonik-Light.otf', weight: '300', style: 'normal' },
    { path: '../public/fonts/Aeonik-Regular.otf', weight: '400', style: 'normal' },
    { path: '../public/fonts/Aeonik-Medium.otf', weight: '500', style: 'normal' },
    { path: '../public/fonts/Aeonik-Bold.otf', weight: '700', style: 'normal' },
    { path: '../public/fonts/Aeonik-Black.otf', weight: '900', style: 'normal' },
  ],
  variable: '--font-aeonik',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" })

export const metadata: Metadata = {
  title: "Protocol Bank - AI Trading Agent",
  description:
    "Connect your wallet and let an AI agent trade for you on Hyperliquid. Non-custodial, transparent, with one-click control and profit sweep.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Protocol Bank",
    startupImage: "/apple-icon.png",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-dark-32x32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-light-32x32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    title: "Protocol Bank - AI Trading Agent",
    description: "Your AI trades. You keep control.",
    siteName: "Protocol Bank",
    url: "https://protocolbanks.com",
    images: [
      {
        url: "https://protocolbanks.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Protocol Bank - Your AI trades. You keep control.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Protocol Bank - Your AI trades. You keep control.",
    description:
      "An AI trades for you on Hyperliquid. It can trade but never withdraw. Paper mode is free.",
    images: ["https://protocolbanks.com/og-image.png"],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
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
        <link rel="apple-touch-startup-image" href="/apple-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  name: "Protocol Bank",
                  url: "https://protocolbanks.com",
                  description:
                    "AI automated trading on Hyperliquid. Non-custodial, transparent, with one-click control and profit sweep.",
                },
                {
                  "@type": "SoftwareApplication",
                  name: "Protocol Bank AI Trading",
                  applicationCategory: "FinanceApplication",
                  operatingSystem: "Web",
                  url: "https://protocolbanks.com/trading",
                  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
                  description:
                    "Connect a wallet, fund a trading budget on Hyperliquid, and let an AI agent trade perpetual markets with strict risk controls. The agent can trade but never withdraw.",
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${aeonik.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <UserTypeProvider>
            <AuthProvider>
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
            </AuthProvider>
          </UserTypeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
