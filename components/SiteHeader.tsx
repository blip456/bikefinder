'use client'

import { Settings as SettingsIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { GeometricLogo } from '@/components/ui/ShapeMark'

export function SiteHeader({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <header className="border-b-4 border-ink bg-canvas">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2.5">
          <GeometricLogo />
          <span className="text-xl font-black uppercase leading-none tracking-tighter sm:text-2xl">
            Bike<span className="text-bh-red">/</span>Finder
          </span>
        </div>

        <Button variant="outline" size="sm" onClick={onOpenSettings} aria-label="Open settings">
          <SettingsIcon className="h-4 w-4" strokeWidth={3} />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </div>
    </header>
  )
}
