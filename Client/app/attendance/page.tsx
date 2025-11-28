"use client"

import { Sidebar } from "@/components/sidebar"
import { AttendanceView } from "@/components/attendance-view"

export default function AttendancePage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <AttendanceView />
      </main>
    </div>
  )
}
