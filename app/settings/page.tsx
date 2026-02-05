"use client"

import {
  Shield,
  Key,
  Webhook,
  CreditCard,
  Users,
  FileSignature,
  Settings,
  Bell,
  Volume2
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const settingGroups = [
  {
    title: "Organization",
    items: [
      {
        title: "Team Management",
        description: "Manage team members and roles",
        href: "/settings/team",
        icon: Users,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
      },
      {
        title: "Billing & Plans",
        description: "Manage subscription and invoices",
        href: "/settings/billing",
        icon: CreditCard,
        color: "text-green-500",
        bg: "bg-green-500/10",
      },
    ],
  },
  {
    title: "Security & Access",
    items: [
      {
        title: "API Keys",
        description: "Manage API keys for integration",
        href: "/settings/api-keys",
        icon: Key,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
      },
      {
        title: "Multi-sig Wallets",
        description: "Configure multi-signature requirements",
        href: "/settings/multisig",
        icon: Shield,
        color: "text-purple-500",
        bg: "bg-purple-500/10",
      },
      {
        title: "Session Keys",
        description: "Manage session-based access controls",
        href: "/settings/session-keys",
        icon: FileSignature,
        color: "text-pink-500",
        bg: "bg-pink-500/10",
      },
    ],
  },
  {
    title: "Developers",
    items: [
      {
        title: "Webhooks",
        description: "Configure event callbacks",
        href: "/settings/webhooks",
        icon: Webhook,
        color: "text-cyan-500",
        bg: "bg-cyan-500/10",
      },
      {
        title: "Authorizations",
        description: "View signed authorizations",
        href: "/settings/authorizations",
        icon: FileSignature,
        color: "text-indigo-500",
        bg: "bg-indigo-500/10",
      },
      {
        title: "Preferences",
        description: "Theme, sounds and display",
        href: "/settings/preferences",
        icon: Settings,
        color: "text-slate-500",
        bg: "bg-slate-500/10",
      },
    ],
  },
]

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="grid gap-8">
        {settingGroups.map((group) => (
          <div key={group.title} className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">{group.title}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer border-muted">
                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                      <div className={`p-2 rounded-lg ${item.bg}`}>
                        <item.icon className={`h-5 w-5 ${item.color}`} />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-base">{item.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{item.description}</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
