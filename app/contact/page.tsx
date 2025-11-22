import { ContactForm } from "@/components/contact-form"
import { Mail, MapPin, Globe } from "lucide-react"

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 selection:bg-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Left Column: Info */}
          <div className="space-y-8 sm:space-y-12">
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 tracking-tight">Contact Us</h1>
              <p className="text-lg sm:text-xl text-zinc-400 max-w-md leading-relaxed">
                Ready to upgrade your enterprise payment infrastructure? Our team is here to help you integrate Protocol
                Bank into your workflow.
              </p>
            </div>

            <div className="space-y-6 sm:space-y-8">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-full bg-zinc-900 border border-zinc-800 text-white shrink-0">
                  <Mail className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-1">Email Us</h3>
                  <p className="text-sm sm:text-base text-zinc-400 break-all">protocolbanks@gmail.com</p>
                  <p className="text-zinc-500 text-xs sm:text-sm mt-1">Typical response time: 24 hours</p>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-full bg-zinc-900 border border-zinc-800 text-white shrink-0">
                  <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-1">Socials</h3>
                  <p className="text-sm sm:text-base text-zinc-400">Twitter: @protocolbank</p>
                  <p className="text-sm sm:text-base text-zinc-400">GitHub: Protocol-Banks-web3</p>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-full bg-zinc-900 border border-zinc-800 text-white shrink-0">
                  <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-1">Headquarters</h3>
                  <p className="text-sm sm:text-base text-zinc-400">Decentralized Network</p>
                  <p className="text-zinc-500 text-xs sm:text-sm mt-1">Global Availability</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 sm:p-8 lg:p-12">
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  )
}
