"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { AdminAPI } from "@/lib/api"
import { useAuth, type UserRole } from "@/components/auth-context"

interface SchoolSummary {
  id: string
  name: string
  code?: string
  status?: string
}

interface TenantContextType {
  activeSchoolId: string | null
  activeSchool?: SchoolSummary
  schools: SchoolSummary[]
  isLoading: boolean
  setActiveSchoolId: (schoolId: string | null) => void
  refreshSchools: () => Promise<void>
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

const STORAGE_KEY = "classtrack:schoolId"

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [schools, setSchools] = useState<SchoolSummary[]>([])
  const [activeSchoolId, setActiveSchoolIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const persistSchool = (schoolId: string | null) => {
    if (typeof window === "undefined") return
    if (schoolId) {
      localStorage.setItem(STORAGE_KEY, schoolId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const handleSetActiveSchoolId = (schoolId: string | null) => {
    setActiveSchoolIdState(schoolId)
    persistSchool(schoolId)
  }

  const bootstrapActiveSchool = useCallback(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
    const fallback = user?.schoolId || null
    handleSetActiveSchoolId(stored || fallback)
  }, [user?.schoolId])

  useEffect(() => {
    bootstrapActiveSchool()
  }, [bootstrapActiveSchool])

  const loadSchools = useCallback(async () => {
    if (!user) {
      setSchools([])
      return
    }

    if (user.role !== "PLATFORM_ADMIN") {
      if (user.schoolId) {
        setSchools([{ id: user.schoolId, name: user.schoolName || "My School" }])
      } else {
        setSchools([])
      }
      return
    }

    try {
      setIsLoading(true)
      const list = await AdminAPI.listSchools()
      setSchools(list)
      if (list.length && !activeSchoolId) {
        handleSetActiveSchoolId(list[0].id)
      }
    } catch (error) {
      console.error("Failed to load schools", error)
    } finally {
      setIsLoading(false)
    }
  }, [user, activeSchoolId])

  useEffect(() => {
    loadSchools()
  }, [loadSchools])

  const refreshSchools = useCallback(async () => {
    await loadSchools()
  }, [loadSchools])

  const activeSchool = useMemo(() => schools.find((s) => s.id === activeSchoolId), [schools, activeSchoolId])

  const value: TenantContextType = {
    activeSchoolId,
    activeSchool,
    schools,
    isLoading,
    setActiveSchoolId: handleSetActiveSchoolId,
    refreshSchools,
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error("useTenant must be used within TenantProvider")
  }
  return ctx
}
