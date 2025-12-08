"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-context"
import { AuthAPI } from "@/lib/api"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, Mail, User, Building2, Fingerprint, CheckCircle } from "lucide-react"

export default function SignupPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    schoolName: "",
    password: "",
    confirmPassword: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [passwordStrength, setPasswordStrength] = useState<"weak" | "medium" | "strong">("weak")
  const [schoolMode, setSchoolMode] = useState<"existing" | "new">("existing")
  const [selectedSchoolId, setSelectedSchoolId] = useState("")
  const [role, setRole] = useState<"TEACHER" | "STAFF">("TEACHER")
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([])
  const [schoolsLoading, setSchoolsLoading] = useState(true)
  const [schoolsError, setSchoolsError] = useState("")
  const router = useRouter()
  const { signup } = useAuth()

  useEffect(() => {
    let active = true
    setSchoolsLoading(true)
    setSchoolsError("")
    ;(async () => {
      try {
        const list = await AuthAPI.schools()
        if (!active) return
        setSchools(list)
        if (!list.length) {
          setSchoolMode("new")
        }
      } catch (err: any) {
        if (!active) return
        setSchoolsError(err?.message || "Failed to load schools")
        setSchoolMode("new")
      } finally {
        if (active) setSchoolsLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const handleSchoolSelect = (value: string) => {
    if (value === "__new__") {
      setSchoolMode("new")
      setSelectedSchoolId("")
    } else {
      setSchoolMode("existing")
      setSelectedSchoolId(value)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // Check password strength
    if (name === "password") {
      if (value.length < 6) {
        setPasswordStrength("weak")
      } else if (value.length < 10 || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
        setPasswordStrength("medium")
      } else {
        setPasswordStrength("strong")
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    if (schoolMode === "existing" && !selectedSchoolId) {
      setError("Select a school to join or switch to creating a new one")
      return
    }

    if (schoolMode === "new" && !formData.schoolName.trim()) {
      setError("Provide a school name to create a new tenant")
      return
    }

    if (schoolMode === "new" && selectedSchoolId) {
      setSelectedSchoolId("")
    }

    setIsLoading(true)

    try {
      await signup({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        schoolName: schoolMode === "new" ? formData.schoolName : undefined,
        schoolId: schoolMode === "existing" ? selectedSchoolId : undefined,
        role: schoolMode === "existing" ? role : undefined,
      })
      router.push("/")
    } catch (err: any) {
      setError(err?.message || "Failed to create account")
    } finally {
      setIsLoading(false)
    }
  }

  const strengthColor = {
    weak: "bg-red-200",
    medium: "bg-yellow-200",
    strong: "bg-green-200",
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Fingerprint className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-foreground">ClassTrack</h1>
          </div>
          <p className="text-muted-foreground">Create your school's attendance system</p>
        </div>

        {/* Signup Card */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Create Account</CardTitle>
            <CardDescription className="text-center">Set up your ClassTrack dashboard today</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="John Administrator"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="bg-background"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="admin@school.edu"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="bg-background"
                />
              </div>

              {/* School Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  School
                </Label>
                <div className="space-y-2">
                  <div className="flex flex-col gap-2">
                    {schoolsError ? (
                      <p className="text-xs text-destructive">{schoolsError}</p>
                    ) : schoolsLoading ? (
                      <p className="text-xs text-muted-foreground">Loading schools...</p>
                    ) : schools.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No schools available yet. Create a new one.</p>
                    ) : (
                      <select
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                        value={schoolMode === "existing" ? selectedSchoolId : "__new__"}
                        onChange={(e) => handleSchoolSelect(e.target.value)}
                        disabled={isLoading}
                      >
                        <option value="">Select a school</option>
                        {schools.map((school) => (
                          <option key={school.id} value={school.id}>
                            {school.name}
                          </option>
                        ))}
                        <option value="__new__">+ Create new school</option>
                      </select>
                    )}
                  </div>
                  {schoolMode === "new" && (
                    <Input
                      id="schoolName"
                      name="schoolName"
                      type="text"
                      placeholder="New School Name"
                      value={formData.schoolName}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="bg-background"
                    />
                  )}
                  {schoolMode === "existing" && (
                    <div>
                      <Label htmlFor="role" className="text-xs font-medium text-muted-foreground">
                        Role
                      </Label>
                      <select
                        id="role"
                        className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                        value={role}
                        onChange={(e) => setRole(e.target.value as "TEACHER" | "STAFF")}
                        disabled={isLoading}
                      >
                        <option value="TEACHER">Teacher</option>
                        <option value="STAFF">Staff</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="bg-background"
                />
                {formData.password && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${strengthColor[passwordStrength]}`}
                        style={{
                          width: passwordStrength === "weak" ? "33%" : passwordStrength === "medium" ? "66%" : "100%",
                        }}
                      ></div>
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {passwordStrength.charAt(0).toUpperCase() + passwordStrength.slice(1)}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="bg-background"
                />
                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Passwords match
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">{error}</div>
              )}

              {/* Terms Agreement */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <input type="checkbox" id="terms" required className="mt-1" />
                <label htmlFor="terms">
                  I agree to the{" "}
                  <Link href="#" className="text-blue-600 hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="#" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            {/* Footer */}
            <div className="text-center text-sm mt-6">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Benefits */}
        <div className="mt-8 space-y-3 text-sm">
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg shadow-sm">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Instant Setup</p>
              <p className="text-xs text-muted-foreground">Get started in minutes</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white rounded-lg shadow-sm">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Secure & Reliable</p>
              <p className="text-xs text-muted-foreground">Enterprise-grade security</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
