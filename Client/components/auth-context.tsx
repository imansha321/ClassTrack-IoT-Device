"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { AuthAPI, type SignupPayload } from "@/lib/api"

export type UserRole = "PLATFORM_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "STAFF"

interface User {
  id: string
  email: string
  fullName: string
  schoolName?: string | null
  schoolId?: string | null
  role: UserRole
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  hasHydrated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (payload: SignupPayload) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasHydrated, setHasHydrated] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedUser = typeof window !== "undefined" ? localStorage.getItem("classtrack:user") : null
      if (storedUser) {
        setUser(JSON.parse(storedUser))
      }
    } catch {}
    setHasHydrated(true)
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { user, token } = await AuthAPI.login(email, password)
      if (typeof window !== "undefined") {
        localStorage.setItem("classtrack:token", token)
        localStorage.setItem("classtrack:user", JSON.stringify(user))
      }
      setUser(user)
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (payload: SignupPayload) => {
    setIsLoading(true)
    try {
      const { user, token } = await AuthAPI.signup(payload)
      if (typeof window !== "undefined") {
        localStorage.setItem("classtrack:token", token)
        localStorage.setItem("classtrack:user", JSON.stringify(user))
      }
      setUser(user)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("classtrack:token")
      localStorage.removeItem("classtrack:user")
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        hasHydrated,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
