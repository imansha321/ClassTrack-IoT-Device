"use client"

import { RefreshCw } from "lucide-react"

import { useTenant } from "@/components/tenant-context"
import { useAuth } from "@/components/auth-context"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TenantSwitcherProps {
  inline?: boolean
}

export function TenantSwitcher({ inline }: TenantSwitcherProps) {
  const { user } = useAuth()
  const { activeSchoolId, schools, setActiveSchoolId, refreshSchools, isLoading, activeSchool } = useTenant()

  if (!user) {
    return null
  }

  if (user.role !== "PLATFORM_ADMIN") {
    return (
      <div className="text-xs leading-tight">
        <p className="font-semibold text-sidebar-foreground">School</p>
        <p className="text-muted-foreground">{user.schoolName || activeSchool?.name || "Assigned"}</p>
      </div>
    )
  }

  return (
    <div className={`flex ${inline ? "flex-row items-center gap-2" : "flex-col gap-2"}`}>
      {!inline && <p className="text-xs font-semibold text-muted-foreground">Active School</p>}
      <div className="flex items-center gap-2">
        <Select value={activeSchoolId || undefined} onValueChange={setActiveSchoolId} disabled={isLoading || !schools.length}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue placeholder={isLoading ? "Loading schools..." : "Choose school"} />
          </SelectTrigger>
          <SelectContent>
            {schools.map((school) => (
              <SelectItem key={school.id} value={school.id} className="truncate">
                {school.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={refreshSchools}
          disabled={isLoading}
          title="Refresh school list"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
