"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { ClassroomsAPI, DevicesAPI } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, Loader2 } from "lucide-react"

const DEVICE_TYPES = [
  { value: "FINGERPRINT_SCANNER", label: "Fingerprint Scanner", helper: "Used for student attendance enrollment." },
  { value: "MULTI_SENSOR", label: "Multi Sensor", helper: "Combined attendance + air quality node." },
  { value: "AIR_QUALITY_SENSOR", label: "Air Quality Sensor", helper: "Environmental monitoring only." },
]

const INITIAL_FORM = {
  deviceId: "",
  name: "",
  type: "FINGERPRINT_SCANNER" as "FINGERPRINT_SCANNER" | "MULTI_SENSOR" | "AIR_QUALITY_SENSOR",
  location: "",
  classroomId: "",
  firmwareVersion: "",
}

type Classroom = {
  id: string
  name: string
  grade?: string | null
  section?: string | null
}

export default function AddDevicePage() {
  const router = useRouter()
  const [form, setForm] = useState({ ...INITIAL_FORM })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<"form" | "instructions">("form")
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loadingClassrooms, setLoadingClassrooms] = useState(true)
  const [classroomsError, setClassroomsError] = useState("")
  const [registration, setRegistration] = useState<{ device: any; deviceToken: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await ClassroomsAPI.list()
        if (mounted) setClassrooms(data)
      } catch (err: any) {
        if (mounted) setClassroomsError(err?.message || "Unable to load classrooms")
      } finally {
        if (mounted) setLoadingClassrooms(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const selectedType = useMemo(() => DEVICE_TYPES.find((t) => t.value === form.type), [form.type])
  const setField = <K extends keyof typeof INITIAL_FORM>(key: K, value: typeof INITIAL_FORM[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const reset = () => {
    setForm({ ...INITIAL_FORM })
    setStep("form")
    setRegistration(null)
    setCopied(false)
    setError("")
  }

  const formatClassroomLabel = (room?: Classroom | null) => {
    if (!room) return "Unassigned"
    const parts = [room.grade, room.section].filter(Boolean)
    return parts.length ? `${room.name} • ${parts.join("-")}` : room.name
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    if (!form.deviceId || !form.name || !form.type || !form.location) {
      setError("Device ID, name, type, and location are required")
      return
    }

    try {
      setLoading(true)
      const payload = {
        deviceId: form.deviceId.trim(),
        name: form.name.trim(),
        type: form.type,
        location: form.location.trim(),
        firmwareVersion: form.firmwareVersion.trim() || undefined,
        classroomId: form.classroomId || undefined,
      }
      const response = await DevicesAPI.register(payload)
      setRegistration(response)
      setStep("instructions")
    } catch (err: any) {
      setError(err?.message || "Failed to register device")
    } finally {
      setLoading(false)
    }
  }

  const copyToken = async () => {
    if (!registration?.deviceToken) return
    try {
      await navigator.clipboard.writeText(registration.deviceToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <p className="text-sm uppercase text-muted-foreground tracking-wide">Devices</p>
            <h1 className="text-3xl font-semibold text-foreground mt-2">Register a device</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              School admins can pair new IoT hardware by creating a device record and generating a one-time token for the installer.
            </p>
          </div>

          {step === "form" && (
            <Card>
              <CardHeader>
                <CardTitle>Device details</CardTitle>
                <CardDescription>Identify the hardware and link it to a classroom.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Device ID</label>
                      <Input
                        name="deviceId"
                        placeholder="ESP32-001"
                        value={form.deviceId}
                        onChange={(e) => setField("deviceId", e.target.value)}
                      />
                      <p className="text-[11px] text-muted-foreground">Match the ID flashed on the hardware.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Friendly name</label>
                      <Input
                        name="name"
                        placeholder="Room 101 Sensor"
                        value={form.name}
                        onChange={(e) => setField("name", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Device type</label>
                      <Select value={form.type} onValueChange={(value) => setField("type", value as typeof INITIAL_FORM["type"]) }>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a device type" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEVICE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedType && <p className="text-[11px] text-muted-foreground">{selectedType.helper}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Location label</label>
                      <Input
                        name="location"
                        placeholder="Room 101"
                        value={form.location}
                        onChange={(e) => setField("location", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Assign classroom (optional)</label>
                      <Select
                        value={form.classroomId || "__none"}
                        onValueChange={(value) => setField("classroomId", value === "__none" ? "" : value)}
                        disabled={loadingClassrooms || !!classroomsError}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingClassrooms ? "Loading..." : "Select classroom"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Unassigned</SelectItem>
                          {classrooms.map((room) => (
                            <SelectItem key={room.id} value={room.id}>
                              {formatClassroomLabel(room)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {classroomsError && <p className="text-[11px] text-destructive">{classroomsError}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Firmware version (optional)</label>
                      <Input
                        name="firmwareVersion"
                        placeholder="v2.1.3"
                        value={form.firmwareVersion}
                        onChange={(e) => setField("firmwareVersion", e.target.value)}
                      />
                    </div>
                  </div>

                  {error && <p className="text-xs text-destructive">{error}</p>}

                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Registering...
                        </>
                      ) : (
                        "Register device"
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => router.push("/devices")}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {step === "instructions" && registration && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Device token generated</CardTitle>
                  <CardDescription>Share this token with the installer. It expires once the device checks in.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">One-time token</p>
                    <div className="flex flex-col gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 p-3">
                      <code className="text-sm font-mono break-all text-foreground">{registration.deviceToken}</code>
                      <Button type="button" size="sm" variant="secondary" className="self-end" onClick={copyToken}>
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        {copied ? "Copied" : "Copy token"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 text-sm">
                    <Detail label="Device" value={registration.device.name} />
                    <Detail label="Device ID" value={registration.device.deviceId} />
                    <Detail label="Type" value={registration.device.type.replace(/_/g, " ")} />
                    <Detail label="Classroom" value={formatClassroomLabel(registration.device.classroom)} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Status: {registration.device.status}</Badge>
                    {registration.device.firmwareVersion && <Badge variant="outline">FW {registration.device.firmwareVersion}</Badge>}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => router.push("/devices")}>Go to devices</Button>
                    <Button variant="outline" onClick={reset}>Register another</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Next steps</CardTitle>
                  <CardDescription>Use these steps to finish pairing the hardware.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-4 text-sm list-decimal list-inside text-muted-foreground">
                    <li>
                      Flash the device with the provided Device ID <span className="font-semibold text-foreground">{registration.device.deviceId}</span>.
                    </li>
                    <li>
                      Apply the token above to the device configuration (`DEVICE_TOKEN`).
                    </li>
                    <li>Power on the device and connect it to Wi-Fi. It will call the heartbeat endpoint and claim the token.</li>
                    <li>Return to the devices list to confirm the status turns online.</li>
                  </ol>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col rounded-md border border-border px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground mt-1">{value || "—"}</span>
    </div>
  )
}
