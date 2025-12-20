import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Web3Provider } from "@/contexts/web3-context"
import { ReownProvider } from "@/contexts/reown-provider"
import { DemoProvider } from "@/contexts/demo-context"
import { UserTypeProvider } from "@/contexts/user-type-context"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Toaster } from "@/components/ui/toaster"
import { RecaptchaScript } from "@/components/recaptcha-script"
import { WelcomeGuide } from "@/components/welcome-guide"

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
    <html lang="en" className="dark">
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
      >
        <UserTypeProvider>
          <ReownProvider>
            <Web3Provider>
              <DemoProvider>
                <div className="relative min-h-screen flex flex-col pb-safe">
                  <Header />
                  <main className="flex-1">{children}</main>
                  <Footer />
                </div>
                <Toaster />
                <RecaptchaScript />
                <WelcomeGuide />
              </DemoProvider>
            </Web3Provider>
          </ReownProvider>
        </UserTypeProvider>
      </body>
    </html>
  )
}
