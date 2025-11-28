"use client"

import { Sidebar } from "@/components/sidebar"
import { AirQualityView } from "@/components/air-quality-view"

export default function AirQualityPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <AirQualityView />
      </main>
    </div>
  )
}
