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
  title: "Protocol Bank — The control plane for agent commerce",
  description:
    "One credential, one server-enforced mandate across commerce, payments and trading, with cards coming soon. Agents can buy, sell, trade and spend within limits they cannot widen.",
  alternates: { canonical: "https://www.protocolbanks.com" },
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
    title: "Protocol Bank — The control plane for agent commerce",
    description: "One credential. One server-enforced mandate. Audit on every call.",
    siteName: "Protocol Bank",
    url: "https://www.protocolbanks.com",
    images: [
      {
        url: "https://www.protocolbanks.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Protocol Bank — the control plane for agent commerce.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Protocol Bank — The control plane for agent commerce",
    description:
      "Give an agent a mandate it can use but cannot widen: server-enforced caps, allowlists, commerce orders, trading and audit; cards are coming soon.",
    images: ["https://www.protocolbanks.com/og-image.png"],
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
    <html lang="en" translate="no" suppressHydrationWarning>
      <head>
        {/* Google Translate rewrites text nodes into <font> wrappers; React then
            throws on the next client navigation (removeChild of a moved node).
            The product UI is English-only by design, so the page opts out of
            machine translation instead of shipping a crash. */}
        <meta name="google" content="notranslate" />
        <link rel="alternate" type="application/json" href="/.well-known/agent.json" />
        <link rel="alternate" type="text/plain" href="/llms.txt" />
        <link rel="alternate" type="application/vnd.oai.openapi+json" href="/api/agent.openapi.json" />
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
                  url: "https://www.protocolbanks.com",
                  inLanguage: "en",
                  description:
                    "The control plane for agent commerce: one credential per agent, server-enforced mandates, commerce orders, non-custodial execution and audit.",
                },
                {
                  "@type": "SoftwareApplication",
                  name: "Protocol Bank Agent API",
                  applicationCategory: "DeveloperApplication",
                  operatingSystem: "Web",
                  url: "https://www.protocolbanks.com/agent-api",
                  inLanguage: "en",
                  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
                  description:
                    "One credential gives an agent a commerce, payments and trading account under a server-enforced mandate: operations, per-call cap, daily cap and allowlist. Orders bind seller, amount and terms; payments execute from a signed authorization; cards are coming soon and will consume the agent budget; the platform holds no funds.",
                },
                {
                  "@type": "Organization",
                  name: "Protocol Bank",
                  url: "https://www.protocolbanks.com",
                  inLanguage: "en",
                  logo: "https://www.protocolbanks.com/logo.png",
                  description:
                    "Protocol Bank builds the control plane for agent commerce: scoped credentials, server-enforced mandates, commerce orders, non-custodial execution and audit across payments and trading, with cards coming soon.",
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
