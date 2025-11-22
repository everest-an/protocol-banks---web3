"use client"

import type React from "react"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Loader2, Send, CheckCircle2 } from "lucide-react"

export function ContactForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      subject: formData.get("subject") as string,
      message: formData.get("message") as string,
    }

    try {
      // 1. Try to save to database if table exists
      const { error } = await supabase.from("contact_messages").insert([data])

      if (error) throw error

      // 2. Also open mailto link as fallback/confirmation for the user
      const mailtoLink = `mailto:protocolbanks@gmail.com?subject=[${data.subject}] Contact from ${data.name}&body=${encodeURIComponent(data.message)}%0A%0AFrom: ${data.email}`
      window.location.href = mailtoLink

      setIsSuccess(true)
    } catch (error) {
      console.error("Error submitting form:", error)
      // Fallback to mailto even if DB fails
      const mailtoLink = `mailto:protocolbanks@gmail.com?subject=[${data.subject}] Contact from ${data.name}&body=${encodeURIComponent(data.message)}%0A%0AFrom: ${data.email}`
      window.location.href = mailtoLink
      setIsSuccess(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
        <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-2xl font-bold text-white">Message Sent!</h3>
        <p className="text-zinc-400 max-w-xs">
          Thank you for reaching out. We've opened your email client to finalize the transmission. We'll get back to you
          shortly.
        </p>
        <button
          onClick={() => setIsSuccess(false)}
          className="mt-8 text-sm text-zinc-500 hover:text-white underline underline-offset-4"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium text-zinc-300">
          Full Name
        </label>
        <input
          id="name"
          name="name"
          required
          className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all text-white placeholder:text-zinc-600"
          placeholder="John Doe"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-zinc-300">
          Email Address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all text-white placeholder:text-zinc-600"
          placeholder="john@company.com"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="subject" className="text-sm font-medium text-zinc-300">
          Subject
        </label>
        <select
          id="subject"
          name="subject"
          required
          className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all text-white"
        >
          <option value="Sales Inquiry">Sales Inquiry</option>
          <option value="Technical Support">Technical Support</option>
          <option value="Partnership">Partnership</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="message" className="text-sm font-medium text-zinc-300">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all text-white placeholder:text-zinc-600 resize-none"
          placeholder="How can we help you?"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        Send Message
      </button>
    </form>
  )
}
