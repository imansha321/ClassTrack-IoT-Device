"use client"

import { Sidebar } from "@/components/sidebar"
import { ReportsView } from "@/components/reports-view"

export default function ReportsPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <ReportsView />
      </main>
    </div>
  )
}
