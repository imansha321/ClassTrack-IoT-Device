"use client"

import { Sidebar } from "@/components/sidebar"
import { Dashboard } from "@/components/dashboard"
import { useAuth } from "@/components/auth-context"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const { isAuthenticated, isLoading, hasHydrated } = useAuth()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!hasHydrated || isLoading) {
      return
    }
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [hasHydrated, isAuthenticated, isLoading, router])

  if (!hasHydrated || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen bg-background flex-col lg:flex-row">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-auto">
        <Dashboard isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      </main>
    </div>
  )
}
