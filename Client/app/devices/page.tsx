"use client"

import { Sidebar } from "@/components/sidebar"
import { DevicesView } from "@/components/devices-view"

export default function DevicesPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <DevicesView />
      </main>
    </div>
  )
}
