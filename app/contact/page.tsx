import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ContactForm } from "@/components/contact-form"
import { Mail, MapPin, Globe } from "lucide-react"

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 selection:bg-white/20">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          {/* Left Column: Info */}
          <div className="space-y-12">
            <div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">Contact Us</h1>
              <p className="text-xl text-zinc-400 max-w-md leading-relaxed">
                Ready to upgrade your enterprise payment infrastructure? Our team is here to help you integrate Protocol
                Bank into your workflow.
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-zinc-900 border border-zinc-800 text-white">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Email Us</h3>
                  <p className="text-zinc-400">everest9812@gmail.com</p>
                  <p className="text-zinc-500 text-sm mt-1">Typical response time: 24 hours</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-zinc-900 border border-zinc-800 text-white">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Socials</h3>
                  <p className="text-zinc-400">Twitter: @protocolbank</p>
                  <p className="text-zinc-400">GitHub: Protocol-Banks-web3</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-zinc-900 border border-zinc-800 text-white">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Headquarters</h3>
                  <p className="text-zinc-400">Decentralized Network</p>
                  <p className="text-zinc-500 text-sm mt-1">Global Availability</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-8 lg:p-12">
            <ContactForm />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
