"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface User {
  id: string
  email: string
  fullName: string
  schoolName: string
  role: "admin" | "teacher" | "staff"
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (fullName: string, email: string, schoolName: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      // TODO: Replace with actual API call
      console.log("[v0] Login API call:", { email })
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setUser({
        id: "1",
        email,
        fullName: "Admin User",
        schoolName: "Sample School",
        role: "admin",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (fullName: string, email: string, schoolName: string, password: string) => {
    setIsLoading(true)
    try {
      // TODO: Replace with actual API call
      console.log("[v0] Signup API call:", { fullName, email, schoolName })
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setUser({
        id: "1",
        email,
        fullName,
        schoolName,
        role: "admin",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
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
