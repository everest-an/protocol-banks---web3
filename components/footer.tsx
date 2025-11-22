import Link from "next/link"
import { Github, Twitter, HelpCircle, Mail, FileText, BookOpen } from "lucide-react"
import Image from "next/image"

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-[#09090b] py-12 px-6 md:px-12 mt-auto">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand Column */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="relative h-8 w-40">
                <Image src="/logo-text-white.png" alt="Protocol Bank" fill className="object-contain object-left" />
              </div>
            </div>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Enterprise-grade crypto payment infrastructure for modern businesses. Manage batch payments, track
              expenses, and visualize your financial network with precision.
            </p>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-mono text-xs uppercase tracking-widest mb-6">Resources</h4>
            <ul className="space-y-4 text-sm text-zinc-500">
              <li>
                <Link href="/whitepaper" className="flex items-center gap-2 hover:text-white transition-colors">
                  <FileText className="w-4 h-4" />
                  Whitepaper (EN)
                </Link>
              </li>
              <li>
                <Link href="/help" className="flex items-center gap-2 hover:text-white transition-colors">
                  <BookOpen className="w-4 h-4" />
                  Usage Guide
                </Link>
              </li>
              <li>
                <Link href="/help" className="flex items-center gap-2 hover:text-white transition-colors">
                  <HelpCircle className="w-4 h-4" />
                  Help Center
                </Link>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="text-white font-mono text-xs uppercase tracking-widest mb-6">Community</h4>
            <ul className="space-y-4 text-sm text-zinc-500">
              <li>
                <Link
                  href="https://github.com/everest-an/protocol-banks---web3"
                  target="_blank"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </Link>
              </li>
              <li>
                <Link
                  href="https://twitter.com/protocolbank"
                  target="_blank"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Twitter className="w-4 h-4" />
                  Twitter / X
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-mono text-xs uppercase tracking-widest mb-6">Contact</h4>
            <ul className="space-y-4 text-sm text-zinc-500">
              <li>
                <Link href="/contact" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Mail className="w-4 h-4" />
                  Contact Us
                </Link>
              </li>
              <li className="text-xs text-zinc-600 mt-4">protocolbanks@gmail.com</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-600">
          <p>© 2025 Protocol Bank. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-zinc-400">
              Privacy Policy
            </Link>
            <Link href="#" className="hover:text-zinc-400">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
