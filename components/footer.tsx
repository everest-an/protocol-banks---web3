"use client"

import Link from "next/link"
import { Github, Twitter, HelpCircle, Mail, FileText, BookOpen } from "lucide-react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function Footer() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const logoTextSrc = mounted && resolvedTheme === "light" ? "/logo-text-black.png" : "/logo-text-white.png"

  return (
    <footer className="border-t border-border bg-background py-8 sm:py-12 px-4 sm:px-6 md:px-12 mt-auto pb-safe">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 md:gap-12 mb-8 sm:mb-12">
          {/* Brand Column - full width on mobile */}
          <div className="col-span-2 sm:col-span-2 md:col-span-1 space-y-4 sm:space-y-6">
            <div className="flex items-center gap-3">
              <div className="relative h-6 sm:h-8 w-32 sm:w-40">
                <Image src={logoTextSrc || "/placeholder.svg"} alt="Protocol Bank" fill className="object-contain object-left" />
              </div>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
              Enterprise-grade crypto payment infrastructure for modern businesses.
            </p>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-foreground font-mono text-[10px] sm:text-xs uppercase tracking-widest mb-4 sm:mb-6">
              Resources
            </h4>
            <ul className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-muted-foreground">
              <li>
                <Link
                  href="/whitepaper"
                  className="flex items-center gap-2 hover:text-foreground transition-colors active:text-foreground"
                >
                  <FileText className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Whitepaper</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/help"
                  className="flex items-center gap-2 hover:text-foreground transition-colors active:text-foreground"
                >
                  <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Usage Guide</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/help"
                  className="flex items-center gap-2 hover:text-foreground transition-colors active:text-foreground"
                >
                  <HelpCircle className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Help Center</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="text-foreground font-mono text-[10px] sm:text-xs uppercase tracking-widest mb-4 sm:mb-6">
              Community
            </h4>
            <ul className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-muted-foreground">
              <li>
                <Link
                  href="https://github.com/everest-an/protocol-banks---web3"
                  target="_blank"
                  className="flex items-center gap-2 hover:text-foreground transition-colors active:text-foreground"
                >
                  <Github className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  GitHub
                </Link>
              </li>
              <li>
                <Link
                  href="https://x.com/0xPrococolBank"
                  target="_blank"
                  className="flex items-center gap-2 hover:text-foreground transition-colors active:text-foreground"
                >
                  <Twitter className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  Twitter / X
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact - hidden on smallest screens, shown on sm+ */}
          <div className="hidden sm:block md:block">
            <h4 className="text-foreground font-mono text-[10px] sm:text-xs uppercase tracking-widest mb-4 sm:mb-6">
              Contact
            </h4>
            <ul className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-muted-foreground">
              <li>
                <Link
                  href="/contact"
                  className="flex items-center gap-2 hover:text-foreground transition-colors active:text-foreground"
                >
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 sm:pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
          <p>© 2025 Protocol Bank. All rights reserved.</p>
          <div className="flex gap-4 sm:gap-6">
            <Link href="/privacy" className="hover:text-foreground active:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground active:text-foreground">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
