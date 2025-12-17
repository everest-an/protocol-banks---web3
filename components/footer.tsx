import Link from "next/link"
import { Github, Twitter, HelpCircle, Mail, FileText, BookOpen } from "lucide-react"
import Image from "next/image"

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-[#09090b] py-8 sm:py-12 px-4 sm:px-6 md:px-12 mt-auto pb-safe">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 md:gap-12 mb-8 sm:mb-12">
          {/* Brand Column - full width on mobile */}
          <div className="col-span-2 sm:col-span-2 md:col-span-1 space-y-4 sm:space-y-6">
            <div className="flex items-center gap-3">
              <div className="relative h-6 sm:h-8 w-32 sm:w-40">
                <Image src="/logo-text-white.png" alt="Protocol Bank" fill className="object-contain object-left" />
              </div>
            </div>
            <p className="text-zinc-500 text-xs sm:text-sm leading-relaxed">
              Enterprise-grade crypto payment infrastructure for modern businesses.
            </p>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-mono text-[10px] sm:text-xs uppercase tracking-widest mb-4 sm:mb-6">
              Resources
            </h4>
            <ul className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-zinc-500">
              <li>
                <Link
                  href="/whitepaper"
                  className="flex items-center gap-2 hover:text-white transition-colors active:text-white"
                >
                  <FileText className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Whitepaper</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/help"
                  className="flex items-center gap-2 hover:text-white transition-colors active:text-white"
                >
                  <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Usage Guide</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/help"
                  className="flex items-center gap-2 hover:text-white transition-colors active:text-white"
                >
                  <HelpCircle className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Help Center</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="text-white font-mono text-[10px] sm:text-xs uppercase tracking-widest mb-4 sm:mb-6">
              Community
            </h4>
            <ul className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-zinc-500">
              <li>
                <Link
                  href="https://github.com/everest-an/protocol-banks---web3"
                  target="_blank"
                  className="flex items-center gap-2 hover:text-white transition-colors active:text-white"
                >
                  <Github className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  GitHub
                </Link>
              </li>
              <li>
                <Link
                  href="https://x.com/0xPrococolBank"
                  target="_blank"
                  className="flex items-center gap-2 hover:text-white transition-colors active:text-white"
                >
                  <Twitter className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  Twitter / X
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact - hidden on smallest screens, shown on sm+ */}
          <div className="hidden sm:block md:block">
            <h4 className="text-white font-mono text-[10px] sm:text-xs uppercase tracking-widest mb-4 sm:mb-6">
              Contact
            </h4>
            <ul className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-zinc-500">
              <li>
                <Link
                  href="/contact"
                  className="flex items-center gap-2 hover:text-white transition-colors active:text-white"
                >
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  Contact Us
                </Link>
              </li>
              <li className="text-[10px] sm:text-xs text-zinc-600 mt-4 break-all">everest9812@gmail.com</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 sm:pt-8 border-t border-zinc-900 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-zinc-600">
          <p>© 2025 Protocol Bank. All rights reserved.</p>
          <div className="flex gap-4 sm:gap-6">
            <Link href="/privacy" className="hover:text-zinc-400 active:text-zinc-400">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-zinc-400 active:text-zinc-400">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
