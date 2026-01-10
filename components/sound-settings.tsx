"use client"

import { useState, useEffect } from "react"
import { Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSonicBranding } from "@/lib/sonic-branding"

export function SoundSettings() {
  const { play, setEnabled, setVolume, isEnabled, getVolume } = useSonicBranding()
  const [enabled, setEnabledState] = useState(true)
  const [volume, setVolumeState] = useState(0.5)

  useEffect(() => {
    setEnabledState(isEnabled())
    setVolumeState(getVolume())
  }, [isEnabled, getVolume])

  const handleToggle = () => {
    const newEnabled = !enabled
    setEnabledState(newEnabled)
    setEnabled(newEnabled)
    if (newEnabled) {
      play("notification")
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolumeState(newVolume)
    setVolume(newVolume)
  }

  const testSound = (type: "personal" | "business") => {
    if (type === "personal") {
      play("personal-switch")
    } else {
      play("business-switch")
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Sound Effects</span>
            <Button variant={enabled ? "default" : "outline"} size="sm" onClick={handleToggle}>
              {enabled ? "On" : "Off"}
            </Button>
          </div>

          {enabled && (
            <>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Volume</label>
                <Slider value={[volume]} onValueChange={handleVolumeChange} max={1} step={0.1} className="w-full" />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Test Sounds</label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => testSound("personal")} className="flex-1 text-xs">
                    Personal
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => testSound("business")} className="flex-1 text-xs">
                    Business
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
