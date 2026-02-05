"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SoundSettings } from "@/components/sound-settings"
import { ThemeToggle } from "@/components/theme-toggle"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Palette, Play } from "lucide-react"

export default function PreferencesPage() {
  return (
    <div className="container mx-auto py-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Preferences</h1>
        <p className="text-muted-foreground">
          Customize your interface and experience.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Manage theme and display settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Theme</Label>
                <div className="text-sm text-muted-foreground">
                  Select your preferred color theme
                </div>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        <Card>
           <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Sound & Haptics
            </CardTitle>
            <CardDescription>
              Manage audio feedback for interactions
            </CardDescription>
           </CardHeader>
           <div className="px-6 pb-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Sound Effects</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable sound feedback for actions
                  </p>
                </div>
                <div className="border rounded-lg p-2">
                    <SoundSettings />
                </div>
              </div>
           </div>
        </Card>
      </div>
    </div>
  )
}
