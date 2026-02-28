"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Loader2, Send, CheckCircle2, Shield } from "lucide-react"
import { getRecaptchaSiteKey } from "@/lib/actions/get-recaptcha-key"

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

export function ContactForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recaptchaReady, setRecaptchaReady] = useState(false)
  const [siteKey, setSiteKey] = useState<string>("")

  useEffect(() => {
    getRecaptchaSiteKey().then((key) => setSiteKey(key))
  }, [])

  useEffect(() => {
    if (!siteKey) return

    const checkRecaptcha = () => {
      if (window.grecaptcha && window.grecaptcha.ready) {
        window.grecaptcha.ready(() => {
          setRecaptchaReady(true)
        })
      }
    }

    checkRecaptcha()
    const interval = setInterval(checkRecaptcha, 100)
    setTimeout(() => clearInterval(interval), 10000)

    return () => clearInterval(interval)
  }, [siteKey])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      subject: formData.get("subject") as string,
      message: formData.get("message") as string,
    }

    try {
      let recaptchaToken = ""
      if (recaptchaReady && window.grecaptcha && siteKey) {
        try {
          recaptchaToken = await window.grecaptcha.execute(siteKey, { action: "contact_form" })
        } catch (err) {
          console.error("reCAPTCHA error:", err)
          throw new Error("Verification failed. Please try again.")
        }
      }

      const response = await fetch("/api/send-contact-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          recaptchaToken,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Failed to send message")
      }

      setIsSuccess(true)
      ;(e.target as HTMLFormElement).reset()
    } catch (error) {
      console.error("Error submitting form:", error)
      setError(error instanceof Error ? error.message : "Failed to send message. Please try again.")
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
          Thank you for reaching out. We've received your message and will get back to you within 24 hours.
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

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      <div className="flex items-start gap-2 text-xs text-zinc-500">
        <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          This form is protected by reCAPTCHA. By submitting, you agree to Google's{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-400"
          >
            Privacy Policy
          </a>{" "}
          and{" "}
          <a
            href="https://policies.google.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-400"
          >
            Terms of Service
          </a>
          .
        </p>
      </div>

      <button
        type="submit"
        disabled={isLoading || !recaptchaReady}
        className="w-full py-4 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        {!recaptchaReady && !isLoading ? "Loading verification..." : "Send Message"}
      </button>
    </form>
  )
}
