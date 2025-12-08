"use client"

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { ClassroomsAPI, FingerprintAPI, StudentsAPI } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Fingerprint as FingerprintIcon, Loader2, RefreshCcw } from "lucide-react"

type ClassroomOption = {
  id: string
  name: string
  grade?: string | null
  section?: string | null
}

type StudentRecord = {
  id: string
  studentId: string
  name: string
  class: string
  classroomId?: string | null
}

type FingerprintEnrollment = {
  id: string
  status: string
  failureReason?: string | null
  student: { studentId: string; name: string }
  classroom?: { name: string | null }
  device?: { deviceId: string; name: string | null }
}

const initialFormState = {
  studentId: "",
  name: "",
  class: "",
  classroomId: "",
  fingerprintData: "",
}

const formatClassValue = (room?: ClassroomOption) => {
  if (!room) return ""
  const grade = room.grade?.trim()
  const section = room.section?.trim()
  if (grade && section) return `${grade}-${section}`
  if (grade) return grade
  return room.name
}

export default function AddStudentPage() {
  const router = useRouter()
  const [form, setForm] = useState(initialFormState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([])
  const [classroomsLoading, setClassroomsLoading] = useState(true)
  const [classroomsError, setClassroomsError] = useState("")
  const [createdStudent, setCreatedStudent] = useState<StudentRecord | null>(null)
  const [enrollment, setEnrollment] = useState<FingerprintEnrollment | null>(null)
  const [enrollmentLoading, setEnrollmentLoading] = useState(false)
  const [enrollmentError, setEnrollmentError] = useState("")

  const enrollmentStatusMessage = !enrollment
    ? ""
    : enrollment.status === "COMPLETED"
      ? "Template stored. Attendance devices will now match this student."
      : enrollment.status === "FAILED"
        ? "Scanner reported a failure. Try capturing again."
        : "Waiting for IoT scanner to finish capturing."

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setClassroomsLoading(true)
        setClassroomsError("")
        const list = await ClassroomsAPI.list()
        if (!active) return
        setClassrooms(
          (list as any[]).map((room) => ({
            id: room.id,
            name: room.name,
            grade: room.grade,
            section: room.section,
          }))
        )
      } catch (err: any) {
        if (!active) return
        setClassroomsError(err?.message || "Failed to load classrooms")
      } finally {
        if (active) setClassroomsLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const onChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const resetWorkflow = () => {
    setForm(initialFormState)
    setCreatedStudent(null)
    setEnrollment(null)
    setEnrollmentError("")
    setError("")
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setCreatedStudent(null)
    setEnrollment(null)
    if (!form.studentId || !form.name) {
      setError("Student ID and name are required")
      return
    }
    if (!form.classroomId) {
      setError("Please select a classroom so devices know where to capture fingerprints")
      return
    }
    const classroomRef = classrooms.find((room) => room.id === form.classroomId)
    const formattedClass = form.class || formatClassValue(classroomRef)
    if (!formattedClass) {
      setError("Selected classroom is missing grade/section info")
      return
    }
    try {
      setLoading(true)
      const payload = {
        studentId: form.studentId,
        name: form.name,
        class: formattedClass,
        fingerprintData: form.fingerprintData || undefined,
        classroomId: form.classroomId,
      }
      const student = await StudentsAPI.create(payload)
      setCreatedStudent(student as StudentRecord)
      setForm(initialFormState)
    } catch (err: any) {
      setError(err?.message || "Failed to create student")
    } finally {
      setLoading(false)
    }
  }

  const startFingerprintEnrollment = async () => {
    if (!createdStudent) return
    setEnrollmentError("")
      setEnrollmentLoading(true)
    try {
      const enrollmentRecord = await FingerprintAPI.requestEnrollment({
        studentId: createdStudent.id,
        classroomId: createdStudent.classroomId || form.classroomId || undefined,
      })
      setEnrollment(enrollmentRecord as FingerprintEnrollment)
    } catch (err: any) {
      setEnrollmentError(err?.message || "Unable to start fingerprint enrollment")
    } finally {
      setEnrollmentLoading(false)
    }
  }

  const refreshEnrollment = async () => {
    if (!enrollment) return
    setEnrollmentError("")
    setEnrollmentLoading(true)
    try {
      const latest = await FingerprintAPI.getEnrollment(enrollment.id)
      setEnrollment(latest as FingerprintEnrollment)
    } catch (err: any) {
      setEnrollmentError(err?.message || "Failed to refresh status")
    } finally {
      setEnrollmentLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Register Student</h1>
          <p className="text-sm text-muted-foreground">
            Capture both the student profile and their fingerprint template for secure attendance.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Step 1 · Student details</CardTitle>
              <CardDescription>Store classroom context before collecting biometrics.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1 block">Student ID</label>
                  <Input name="studentId" value={form.studentId} onChange={onChange} placeholder="STU0001" disabled={loading} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Full name</label>
                  <Input name="name" value={form.name} onChange={onChange} placeholder="Student Name" disabled={loading} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Classroom</label>
                  {classroomsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading classrooms
                    </div>
                  ) : classroomsError ? (
                    <p className="text-xs text-destructive">{classroomsError}</p>
                  ) : classrooms.length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">No classrooms yet. Create one before enrolling students.</p>
                      <Button size="sm" variant="outline" type="button" onClick={() => router.push("/classrooms")}>Go to classrooms</Button>
                    </div>
                  ) : (
                    <Select
                      value={form.classroomId}
                      onValueChange={(value) => {
                        const room = classrooms.find((entry) => entry.id === value)
                        setForm((prev) => ({ ...prev, classroomId: value, class: formatClassValue(room) }))
                      }}
                    >
                      <SelectTrigger className="w-full text-left">
                        <SelectValue placeholder="Select classroom" />
                      </SelectTrigger>
                      <SelectContent>
                        {classrooms.map((room) => {
                          const meta = [room.grade, room.section].filter(Boolean).join(" • ")
                          return (
                            <SelectItem key={room.id} value={room.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{room.name}</span>
                                {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Fingerprint Data (optional)</label>
                  <Input name="fingerprintData" value={form.fingerprintData} onChange={onChange} placeholder="Upload template only if already captured" disabled={loading} />
                  <p className="text-[11px] text-muted-foreground mt-1">Leave blank to capture via IoT scanner in the next step.</p>
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertTitle>Unable to save</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={loading || classroomsLoading || classrooms.length === 0}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving
                      </>
                    ) : (
                      "Save student"
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push("/students")}>
                    Cancel
                  </Button>
                  {createdStudent && (
                    <Button type="button" variant="ghost" onClick={resetWorkflow}>
                      Start another
                    </Button>
                  )}
              </div>
            </form>
          </CardContent>
        </Card>

        {createdStudent ? (
            <Card>
              <CardHeader className="flex flex-col gap-1">
                <CardTitle>Step 2 · Collect fingerprint</CardTitle>
                <CardDescription>Send the enrollment request to the classroom scanner.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">{createdStudent.name}</p>
                  <p className="text-xs text-muted-foreground">ID {createdStudent.studentId}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">How it works</p>
                  <ul className="list-disc text-sm pl-4 space-y-1 text-muted-foreground">
                    <li>Click “Start fingerprint capture” to queue the enrollment.</li>
                    <li>The IoT scanner polls <code className="rounded bg-muted px-1 py-0.5 text-xs">POST /api/fingerprint/device/next</code> to pull pending students.</li>
                    <li>Once the scan completes, the device posts the template back and this status updates.</li>
                  </ul>
                </div>
                {enrollmentError && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertTitle>Enrollment issue</AlertTitle>
                    <AlertDescription>{enrollmentError}</AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={startFingerprintEnrollment} disabled={enrollmentLoading}>
                    {enrollmentLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FingerprintIcon className="w-4 h-4 mr-2" />
                    )}
                    {enrollment ? "Re-run capture" : "Start fingerprint capture"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={refreshEnrollment} disabled={!enrollment || enrollmentLoading}>
                    <RefreshCcw className="w-4 h-4 mr-2" /> Refresh status
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push("/students")}>Back to students</Button>
                </div>
                {enrollment ? (
                  <div className="rounded-lg border border-dashed border-border/70 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={enrollment.status === "COMPLETED" ? "secondary" : enrollment.status === "FAILED" ? "destructive" : "outline"}>
                        {enrollment.status}
                      </Badge>
                      {enrollment.status === "COMPLETED" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : enrollment.status === "FAILED" ? (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      ) : (
                        <FingerprintIcon className="w-4 h-4 text-muted-foreground" />
                      )}
                        <p className="text-sm text-muted-foreground">{enrollmentStatusMessage}</p>
                    </div>
                    <Separator />
                    <div className="grid gap-2 text-sm">
                      <p>Classroom: {enrollment.classroom?.name || "—"}</p>
                      <p>Device: {enrollment.device?.name || enrollment.device?.deviceId || "—"}</p>
                      {enrollment.failureReason && (
                        <p className="text-destructive text-xs">Reason: {enrollment.failureReason}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No active enrollment yet. Start the capture when the classroom device is ready.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-border/60">
              <CardHeader>
                <CardTitle>Step 2 · Fingerprint capture</CardTitle>
                <CardDescription>Save the student first to unlock biometric enrollment.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Fill out the form on the left. Once the student exists, you can trigger the scanner workflow without leaving this page.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
