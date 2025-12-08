"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { Sidebar } from "@/components/sidebar"
import { useAuth } from "@/components/auth-context"
import {
	AttendanceAPI,
	ClassroomsAPI,
	DevicesAPI,
	StudentsAPI,
	AirQualityAPI,
	ReportsAPI,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Activity, Calendar, Cpu, Plus, RefreshCcw, Users, Wind, UserPlus, UserMinus } from "lucide-react"

type ClassroomTeacher = {
	id?: string
	teacherId: string
	teacher?: {
		id: string
		fullName: string
		email: string
	}
}

type Classroom = {
	id: string
	name: string
	grade?: string
	section?: string
	capacity?: number
	teachers?: ClassroomTeacher[]
	_count?: {
		students?: number
		devices?: number
	}
}

type TeacherSummary = {
	id: string
	fullName: string | null
	email: string | null
}

type StudentSummary = {
	id: string
	studentId?: string
	name?: string
	fingerprintData?: string | null
}

type AttendanceRecord = {
	id: string
	studentId?: string
	status?: "PRESENT" | "LATE" | "ABSENT" | string
	checkInTime?: string | null
	student?: {
		id?: string
		name?: string
	}
}

type DeviceInfo = {
	id: string
	name?: string
	deviceId?: string
	status?: string
	battery?: number | null
	signal?: number | null
	firmwareVersion?: string | null
	lastSeen?: string | null
}

type AirQualityReading = {
	timestamp?: string
	pm25?: number | null
	co2?: number | null
	temperature?: number | null
	humidity?: number | null
}

type AttendanceReportEntry = {
	date?: string
	present?: number
	absent?: number
	late?: number
}

type AttendanceRollup = {
	present: number
	absent: number
	late: number
	total: number
}

const today = new Date().toISOString().split("T")[0]

export default function ClassroomsPage() {
	const { user } = useAuth()
	const role = user?.role
	const isPlatformAdmin = role === "PLATFORM_ADMIN"
	const isSchoolAdmin = role === "SCHOOL_ADMIN"
	const isTeacher = role === "TEACHER"
	const canManageClassrooms = isPlatformAdmin || isSchoolAdmin
	const canManageStudents = canManageClassrooms

	const [classrooms, setClassrooms] = useState<Classroom[]>([])
	const [classroomsError, setClassroomsError] = useState("")
	const [loadingClassrooms, setLoadingClassrooms] = useState(true)
	const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null)
	const [selectedDate, setSelectedDate] = useState(today)

	const [students, setStudents] = useState<StudentSummary[]>([])
	const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
	const [devices, setDevices] = useState<DeviceInfo[]>([])
	const [airQualityReadings, setAirQualityReadings] = useState<AirQualityReading[]>([])
	const [attendanceReports, setAttendanceReports] = useState<AttendanceReportEntry[]>([])

	const [detailsLoading, setDetailsLoading] = useState(false)
	const [detailsError, setDetailsError] = useState("")

	const [addLoading, setAddLoading] = useState(false)
	const [addError, setAddError] = useState("")
	const [newClassroom, setNewClassroom] = useState({ name: "", grade: "", section: "", capacity: "" })

	const [teacherIdInput, setTeacherIdInput] = useState("")
	const [teacherActionError, setTeacherActionError] = useState("")
	const [assigningTeacherId, setAssigningTeacherId] = useState<string | null>(null)
	const [removingTeacherId, setRemovingTeacherId] = useState<string | null>(null)

	const [availableTeachers, setAvailableTeachers] = useState<TeacherSummary[]>([])
	const [teachersLoading, setTeachersLoading] = useState(false)
	const [teachersError, setTeachersError] = useState("")

	const syncClassroomState = useCallback((list: Classroom[]) => {
		setClassrooms(list)
		setSelectedClassroomId((prev) => {
			if (prev && list.some((cls) => cls.id === prev)) {
				return prev
			}
			return list[0]?.id ?? null
		})
	}, [])

	const refreshClassrooms = useCallback(async () => {
		if (!user) return
		setLoadingClassrooms(true)
		setClassroomsError("")
		try {
			const data = await ClassroomsAPI.list()
			syncClassroomState(data as Classroom[])
		} catch (e: any) {
			setClassroomsError(e?.message || "Failed to load classrooms")
		} finally {
			setLoadingClassrooms(false)
		}
	}, [syncClassroomState, user])

	const fetchAvailableTeachers = useCallback(async () => {
		if (!canManageClassrooms) {
			setAvailableTeachers([])
			setTeachersError("")
			return
		}
		setTeachersLoading(true)
		setTeachersError("")
		try {
			const list = await ClassroomsAPI.teachers()
			setAvailableTeachers(list)
		} catch (e: any) {
			setTeachersError(e?.message || "Failed to load teachers")
		} finally {
			setTeachersLoading(false)
		}
	}, [canManageClassrooms])

	useEffect(() => {
		if (!user) return
		refreshClassrooms()
	}, [user, refreshClassrooms])

	useEffect(() => {
		fetchAvailableTeachers()
	}, [fetchAvailableTeachers])

	const selectedClassroom = useMemo(() => classrooms.find((c) => c.id === selectedClassroomId) || null, [
		classrooms,
		selectedClassroomId,
	])
	const assignedTeachers = selectedClassroom?.teachers ?? []
	const unassignedTeachers = useMemo(() => {
		if (!availableTeachers.length) return []
		const assignedIds = new Set(assignedTeachers.map((assignment) => assignment.teacherId))
		return availableTeachers.filter((teacher) => !assignedIds.has(teacher.id))
	}, [availableTeachers, assignedTeachers])

	useEffect(() => {
		if (!selectedClassroomId || !selectedClassroom) return
		let active = true
		setDetailsLoading(true)
		setDetailsError("")
		;(async () => {
			try {
				const [studentList, attendanceList, deviceList, airQualityList, attendanceReport] = (await Promise.all([
					StudentsAPI.list({ classroomId: selectedClassroomId }),
					AttendanceAPI.list({ date: selectedDate, classroomId: selectedClassroomId }),
					DevicesAPI.list({ classroomId: selectedClassroomId }),
					selectedClassroom.name
						? AirQualityAPI.list({ room: selectedClassroom.name, limit: 32 })
						: AirQualityAPI.list({ limit: 32 }),
					selectedClassroom.name ? ReportsAPI.attendance({ class: selectedClassroom.name }) : ReportsAPI.attendance(),
				])) as [
					StudentSummary[],
					AttendanceRecord[],
					DeviceInfo[],
					AirQualityReading[],
					AttendanceReportEntry[],
				]
				if (!active) return
				const sortedReadings = (airQualityList || []).slice().sort((a: any, b: any) => {
					return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
				})
				setStudents(studentList)
				setAttendance(attendanceList)
				setDevices(deviceList)
				setAirQualityReadings(sortedReadings)
				setAttendanceReports(attendanceReport || [])
			} catch (e: any) {
				if (!active) return
				setDetailsError(e?.message || "Failed to load classroom data")
			} finally {
				if (active) setDetailsLoading(false)
			}
		})()
		return () => {
			active = false
		}
	}, [selectedClassroomId, selectedClassroom?.name, selectedDate])

	useEffect(() => {
		setTeacherActionError("")
		setTeacherIdInput("")
	}, [selectedClassroomId])

	const attendanceStats = useMemo(() => {
		return attendance.reduce(
			(acc, record) => {
				const status = record.status || "UNKNOWN"
				if (status === "PRESENT") acc.present += 1
				else if (status === "LATE") acc.late += 1
				else acc.absent += 1
				return acc
			},
			{ present: 0, late: 0, absent: 0 }
		)
	}, [attendance])

	const airQualityLatest = airQualityReadings.length
		? airQualityReadings[airQualityReadings.length - 1]
		: null

	const reportAverage = useMemo(() => {
		if (!attendanceReports.length) return null
		const totals = attendanceReports.reduce<AttendanceRollup>(
			(acc, r) => {
				acc.present += r.present || 0
				acc.absent += r.absent || 0
				acc.late += r.late || 0
				acc.total += (r.present || 0) + (r.absent || 0) + (r.late || 0)
				return acc
			},
			{ present: 0, absent: 0, late: 0, total: 0 }
		)
		const pct = totals.total ? ((totals.present / totals.total) * 100).toFixed(1) : "0"
		return { ...totals, pct }
	}, [attendanceReports])

	const handleCreateClassroom = async () => {
		if (!canManageClassrooms) return
		if (!newClassroom.name.trim()) {
			setAddError("Classroom name is required")
			return
		}
		setAddError("")
		setAddLoading(true)
		try {
			const payload: any = {
				name: newClassroom.name.trim(),
			}
			if (newClassroom.grade.trim()) payload.grade = newClassroom.grade.trim()
			if (newClassroom.section.trim()) payload.section = newClassroom.section.trim()
			if (newClassroom.capacity.trim()) payload.capacity = Number(newClassroom.capacity)
			const created = (await ClassroomsAPI.create(payload)) as Classroom
			setNewClassroom({ name: "", grade: "", section: "", capacity: "" })
			setSelectedClassroomId(created.id)
			await refreshClassrooms()
		} catch (e: any) {
			setAddError(e?.message || "Unable to create classroom")
		} finally {
			setAddLoading(false)
		}
	}

	const handleAssignTeacher = async (teacherIdOverride?: string) => {
		if (!canManageClassrooms || !selectedClassroomId) return
		const resolvedId = (teacherIdOverride ?? teacherIdInput).trim()
		if (!resolvedId) {
			setTeacherActionError("Select a teacher to assign")
			return
		}
		setTeacherActionError("")
		setAssigningTeacherId(teacherIdOverride ?? "manual")
		try {
			await ClassroomsAPI.assignTeacher(selectedClassroomId, resolvedId)
			if (!teacherIdOverride) {
				setTeacherIdInput("")
			}
			await refreshClassrooms()
			await fetchAvailableTeachers()
		} catch (e: any) {
			setTeacherActionError(e?.message || "Failed to assign teacher")
		} finally {
			setAssigningTeacherId(null)
		}
	}

	const handleRemoveTeacher = async (teacherId: string) => {
		if (!canManageClassrooms || !selectedClassroomId) return
		setTeacherActionError("")
		setRemovingTeacherId(teacherId)
		try {
			await ClassroomsAPI.removeTeacher(selectedClassroomId, teacherId)
			await refreshClassrooms()
		} catch (e: any) {
			setTeacherActionError(e?.message || "Failed to remove teacher")
		} finally {
			setRemovingTeacherId(null)
		}
	}

	return (
		<div className="flex h-screen bg-background">
			<Sidebar />
			<main className="flex-1 overflow-auto p-6 space-y-6">
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div>
						<h1 className="text-2xl font-bold">Classrooms</h1>
						<p className="text-sm text-muted-foreground">
							Manage classes, students, devices, attendance, and environmental data in one place.
						</p>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" className="bg-transparent" onClick={refreshClassrooms} disabled={loadingClassrooms}>
							<RefreshCcw className="w-4 h-4 mr-2" />
							Refresh
						</Button>
					</div>
				</div>

				<div className={cn("grid grid-cols-1 gap-6", canManageClassrooms ? "lg:grid-cols-3" : "lg:grid-cols-1")}>
					<Card className={cn("border-border", canManageClassrooms && "lg:col-span-2")}>
						<CardHeader>
							<CardTitle>Classroom Directory</CardTitle>
							<CardDescription>Select a classroom to view its live data</CardDescription>
						</CardHeader>
						<CardContent>
							{loadingClassrooms && <p className="text-sm text-muted-foreground">Loading classrooms...</p>}
							{classroomsError && !loadingClassrooms && (
								<p className="text-sm text-destructive">{classroomsError}</p>
							)}
							{!loadingClassrooms && !classrooms.length && !classroomsError && (
								<p className="text-sm text-muted-foreground">
									{isTeacher ? "No classrooms have been assigned to you yet." : "No classrooms yet. Create one to get started."}
								</p>
							)}
							<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
								{classrooms.map((room) => (
									<button
										key={room.id}
										onClick={() => setSelectedClassroomId(room.id)}
										className={cn(
											"text-left border rounded-xl p-4 transition relative",
											selectedClassroomId === room.id
												? "border-primary bg-primary/5 shadow-sm"
												: "border-border hover:border-primary/60"
										)}
									>
										<div className="flex items-center justify-between">
											<div>
												<p className="text-xs uppercase text-muted-foreground">Classroom</p>
												<h3 className="text-lg font-semibold text-foreground">{room.name}</h3>
												{(room.grade || room.section) && (
													<p className="text-xs text-muted-foreground">
														{[room.grade, room.section].filter(Boolean).join(" • ")}
													</p>
												)}
												{isTeacher && room.teachers?.some((assignment) => assignment.teacherId === user?.id) && (
													<p className="text-[11px] text-secondary font-semibold mt-1">Assigned to you</p>
												)}
											</div>
											<Badge variant="secondary" className="shrink-0">
												{room.capacity ? `${room.capacity} seats` : "No capacity"}
											</Badge>
										</div>
									</button>
								))}
							</div>
						</CardContent>
					</Card>

					{canManageClassrooms && (
						<Card className="border-border">
							<CardHeader>
								<CardTitle>Create Classroom</CardTitle>
								<CardDescription>Add a new class to start tracking</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<div>
									<label className="text-xs font-medium text-foreground">Name</label>
									<Input
										value={newClassroom.name}
										onChange={(e) => setNewClassroom((prev) => ({ ...prev, name: e.target.value }))}
										placeholder="e.g., Grade 10"
										className="mt-1"
									/>
								</div>
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label className="text-xs font-medium text-foreground">Grade</label>
										<Input
											value={newClassroom.grade}
											onChange={(e) => setNewClassroom((prev) => ({ ...prev, grade: e.target.value }))}
											placeholder="10"
											className="mt-1"
										/>
									</div>
									<div>
										<label className="text-xs font-medium text-foreground">Section</label>
										<Input
											value={newClassroom.section}
											onChange={(e) => setNewClassroom((prev) => ({ ...prev, section: e.target.value }))}
											placeholder="A"
											className="mt-1"
										/>
									</div>
								</div>
								<div>
									<label className="text-xs font-medium text-foreground">Capacity</label>
									<Input
										type="number"
										value={newClassroom.capacity}
										onChange={(e) => setNewClassroom((prev) => ({ ...prev, capacity: e.target.value }))}
										placeholder="35"
										className="mt-1"
									/>
								</div>
								{addError && <p className="text-xs text-destructive">{addError}</p>}
								<Button className="w-full" onClick={handleCreateClassroom} disabled={addLoading}>
									<Plus className="w-4 h-4 mr-2" />
									Add Classroom
								</Button>
							</CardContent>
						</Card>
					)}
				</div>

				{!selectedClassroom && !loadingClassrooms ? (
					<Card className="border-border">
						<CardContent className="p-6">
							<p className="text-sm text-muted-foreground">Select or create a classroom to view details.</p>
						</CardContent>
					</Card>
				) : null}

				{selectedClassroom && (
					<div className="space-y-6">
						<Card className="border-border">
							<CardHeader>
								<CardTitle>{selectedClassroom.name}</CardTitle>
								<CardDescription>
									{[selectedClassroom.grade, selectedClassroom.section].filter(Boolean).join(" • ") || "Class overview"}
								</CardDescription>
							</CardHeader>
							<CardContent>
								{detailsError && <p className="text-sm text-destructive mb-4">{detailsError}</p>}
								<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
									<OverviewStat
										label="Students"
										value={students.length || "—"}
										icon={<Users className="w-4 h-4" />}
									/>
									<OverviewStat
										label="Devices"
										value={devices.length || "—"}
										icon={<Cpu className="w-4 h-4" />}
									/>
									<OverviewStat
										label="Attendance Today"
										value={attendanceStats.present + attendanceStats.late}
										icon={<Calendar className="w-4 h-4" />}
										helper={`${attendanceStats.present} present • ${attendanceStats.late} late`}
									/>
									<OverviewStat
										label="Air Quality"
										value={airQualityLatest ? `${airQualityLatest.pm25 ?? "—"} µg/m³` : "—"}
										icon={<Wind className="w-4 h-4" />}
										helper={airQualityLatest ? `CO₂ ${airQualityLatest.co2 ?? "—"} ppm` : "No readings"}
									/>
								</div>
							</CardContent>
						</Card>

						<Card className="border-border">
							<CardHeader className="flex flex-col gap-2">
								<div>
									<CardTitle>Teachers</CardTitle>
									<CardDescription>Manage classroom assignments</CardDescription>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								{assignedTeachers.length === 0 ? (
									<p className="text-sm text-muted-foreground">No teachers assigned yet.</p>
								) : (
									<div className="space-y-3">
										{assignedTeachers.map((assignment) => (
											<div
												key={assignment.teacherId}
												className="flex items-center justify-between rounded-lg border border-border p-3"
											>
												<div>
													<p className="text-sm font-semibold text-foreground">
														{assignment.teacher?.fullName || "Teacher"}
													</p>
													<p className="text-xs text-muted-foreground">{assignment.teacher?.email || "No email"}</p>
												</div>
												{canManageClassrooms && (
													<Button
														variant="ghost"
														size="icon"
														onClick={() => handleRemoveTeacher(assignment.teacherId)}
														disabled={removingTeacherId === assignment.teacherId}
														aria-label="Remove teacher"
													>
														<UserMinus className="w-4 h-4" />
													</Button>
												)}
											</div>
										))}
									</div>
								)}
								{teacherActionError && <p className="text-xs text-destructive">{teacherActionError}</p>}
								{canManageClassrooms && (
									<div className="space-y-4">
										<div className="space-y-2">
											<label className="text-xs font-medium text-foreground">Assign teacher by ID (optional)</label>
											<div className="flex flex-col gap-2 sm:flex-row">
												<Input
													value={teacherIdInput}
													onChange={(e) => setTeacherIdInput(e.target.value)}
													placeholder="e.g., usr_123"
													disabled={assigningTeacherId !== null}
												/>
												<Button
													onClick={() => handleAssignTeacher()}
													disabled={assigningTeacherId !== null || !teacherIdInput.trim()}
												>
													<UserPlus className="w-4 h-4 mr-2" />
													Assign
												</Button>
											</div>
											<p className="text-xs text-muted-foreground">Use this if a staff member is missing from the directory list.</p>
										</div>
										<div className="space-y-3 border-t border-border/60 pt-4">
											<div className="flex items-center justify-between">
												<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registered teachers</p>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 px-2 text-xs"
													onClick={() => fetchAvailableTeachers()}
													disabled={teachersLoading}
												>
													<RefreshCcw className="w-3.5 h-3.5 mr-1" /> Refresh
												</Button>
											</div>
											{teachersError && <p className="text-xs text-destructive">{teachersError}</p>}
											{teachersLoading ? (
												<p className="text-sm text-muted-foreground">Loading teachers...</p>
											) : availableTeachers.length === 0 ? (
												<p className="text-sm text-muted-foreground">No teachers registered for this school yet.</p>
											) : unassignedTeachers.length === 0 ? (
												<p className="text-sm text-muted-foreground">All registered teachers are already assigned to this classroom.</p>
											) : (
												<div className="space-y-2 max-h-64 overflow-y-auto pr-1">
													{unassignedTeachers.map((teacher) => (
														<div key={teacher.id} className="flex items-center justify-between rounded-lg border border-border p-3">
															<div>
																<p className="text-sm font-semibold text-foreground">{teacher.fullName || "Teacher"}</p>
																<p className="text-xs text-muted-foreground">{teacher.email || "No email"}</p>
															</div>
															<Button
																	size="sm"
																	variant="secondary"
																	onClick={() => handleAssignTeacher(teacher.id)}
																	disabled={assigningTeacherId === teacher.id}
															>
																	<UserPlus className="w-4 h-4 mr-2" /> Assign
																</Button>
														</div>
													))}
												</div>
											)}
										</div>
									</div>
								)}
							</CardContent>
						</Card>

						<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
							<Card className="border-border">
								<CardHeader className="flex flex-col gap-2">
									<div className="flex items-center justify-between gap-4">
										<div>
											<CardTitle>Students</CardTitle>
											<CardDescription>Enrolled students and fingerprint status</CardDescription>
										</div>
										{canManageStudents && (
											<Button asChild size="sm">
												<Link href={`/students/add?classroomId=${selectedClassroom.id}`}>
													<Plus className="w-4 h-4 mr-2" />
													Add
												</Link>
											</Button>
										)}
									</div>
								</CardHeader>
								<CardContent>
									{detailsLoading ? (
										<p className="text-sm text-muted-foreground">Loading students...</p>
									) : students.length === 0 ? (
										<p className="text-sm text-muted-foreground">No students in this classroom yet.</p>
									) : (
										<div className="overflow-x-auto">
											<table className="w-full text-sm">
												<thead>
													<tr className="border-b border-border text-left">
														<th className="py-2 pr-2">ID</th>
														<th className="py-2 pr-2">Name</th>
														<th className="py-2 pr-2">Fingerprint</th>
													</tr>
												</thead>
												<tbody>
													{students.slice(0, 8).map((student) => (
														<tr key={student.id} className="border-b border-border/50">
															<td className="py-2 pr-2 text-muted-foreground">{student.studentId}</td>
															<td className="py-2 pr-2 font-medium">{student.name}</td>
															<td className="py-2 pr-2">
																<Badge variant={student.fingerprintData ? "secondary" : "outline"}>
																	{student.fingerprintData ? "Enrolled" : "Missing"}
																</Badge>
															</td>
														</tr>
													))}
												</tbody>
											</table>
											{students.length > 8 && (
												<p className="text-xs text-muted-foreground mt-2">Showing first 8 students</p>
											)}
										</div>
									)}
								</CardContent>
							</Card>

							<Card className="border-border">
								<CardHeader>
									<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
										<div>
											<CardTitle>Attendance</CardTitle>
											<CardDescription>Fingerprint scans for the selected date</CardDescription>
										</div>
										<div className="flex items-center gap-2 text-sm">
											<Calendar className="w-4 h-4 text-muted-foreground" />
											<input
												type="date"
												value={selectedDate}
												onChange={(e) => setSelectedDate(e.target.value)}
												className="border border-input rounded-md px-3 py-2 bg-background"
											/>
										</div>
									</div>
								</CardHeader>
								<CardContent>
									{detailsLoading ? (
										<p className="text-sm text-muted-foreground">Loading attendance...</p>
									) : attendance.length === 0 ? (
										<p className="text-sm text-muted-foreground">No attendance records for this date.</p>
									) : (
										<div className="space-y-3">
											<div className="flex flex-wrap gap-3 text-xs">
												<Badge variant="secondary">Present {attendanceStats.present}</Badge>
												<Badge variant="outline">Late {attendanceStats.late}</Badge>
												<Badge variant="destructive">Absent {attendanceStats.absent}</Badge>
											</div>
											<div className="max-h-64 overflow-auto border border-border rounded-lg">
												<table className="w-full text-sm">
													<thead>
														<tr className="border-b border-border text-left">
															<th className="py-2 px-3">Student</th>
															<th className="py-2 px-3">Check-in</th>
															<th className="py-2 px-3">Status</th>
														</tr>
													</thead>
													<tbody>
														{attendance.slice(0, 10).map((record) => (
															<tr key={record.id} className="border-b border-border/50">
																<td className="py-2 px-3 text-sm font-medium">{record.student?.name || record.studentId}</td>
																<td className="py-2 px-3 text-muted-foreground">
																	{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : "—"}
																</td>
																<td className="py-2 px-3">
																	<Badge
																		variant={
																			record.status === "PRESENT"
																				? "secondary"
																				: record.status === "LATE"
																					? "outline"
																					: "destructive"
																		}
																	>
																		{record.status || "—"}
																	</Badge>
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
									)}
								</CardContent>
							</Card>
						</div>

						<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
							<Card className="border-border">
								<CardHeader>
									<CardTitle>Devices</CardTitle>
									<CardDescription>Hardware assigned to this classroom</CardDescription>
								</CardHeader>
								<CardContent>
									{detailsLoading ? (
										<p className="text-sm text-muted-foreground">Loading devices...</p>
									) : devices.length === 0 ? (
										<p className="text-sm text-muted-foreground">No devices linked to this classroom.</p>
									) : (
										<div className="space-y-3">
											{devices.map((device) => (
												<div key={device.id} className="border border-border rounded-lg p-3">
													<div className="flex items-center justify-between">
														<div>
															<p className="text-sm font-semibold">{device.name}</p>
															<p className="text-xs text-muted-foreground">{device.deviceId}</p>
														</div>
														<Badge variant={device.status === "ONLINE" ? "secondary" : "destructive"}>
															{device.status || "UNKNOWN"}
														</Badge>
													</div>
													<div className="grid grid-cols-2 gap-3 text-xs mt-3 text-muted-foreground">
														<div>Battery {device.battery ?? "—"}%</div>
														<div>Signal {device.signal ?? "—"}%</div>
														<div>Firmware {device.firmwareVersion || "—"}</div>
														<div>Last seen {device.lastSeen ? new Date(device.lastSeen).toLocaleTimeString() : "—"}</div>
													</div>
												</div>
											))}
										</div>
									)}
								</CardContent>
							</Card>

							<Card className="border-border">
								<CardHeader>
									<CardTitle>Air Quality</CardTitle>
									<CardDescription>Latest PM2.5 and CO₂ readings</CardDescription>
								</CardHeader>
								<CardContent>
									{detailsLoading ? (
										<p className="text-sm text-muted-foreground">Loading air quality...</p>
									) : !airQualityReadings.length ? (
										<p className="text-sm text-muted-foreground">No sensor data for this classroom.</p>
									) : (
										<div className="space-y-4">
											{airQualityLatest && (
												<div className="grid grid-cols-2 gap-3 text-sm">
													<AirMetric label="PM2.5" value={`${airQualityLatest.pm25 ?? "—"} µg/m³`} />
													<AirMetric label="CO₂" value={`${airQualityLatest.co2 ?? "—"} ppm`} />
													<AirMetric label="Temp" value={`${airQualityLatest.temperature ?? "—"}°C`} />
													<AirMetric label="Humidity" value={`${airQualityLatest.humidity ?? "—"}%`} />
												</div>
											)}
											<div className="max-h-48 overflow-auto border border-border rounded-lg">
												<table className="w-full text-xs">
													<thead>
														<tr className="border-b border-border text-left">
															<th className="py-2 px-3">Time</th>
															<th className="py-2 px-3">PM2.5</th>
															<th className="py-2 px-3">CO₂</th>
														</tr>
													</thead>
													<tbody>
														{airQualityReadings.slice(-10).map((reading, idx) => (
															<tr key={idx} className="border-b border-border/50">
																<td className="py-2 px-3 text-muted-foreground">
																	{reading.timestamp ? new Date(reading.timestamp).toLocaleTimeString() : "—"}
																</td>
																<td className="py-2 px-3">{reading.pm25 ?? "—"}</td>
																<td className="py-2 px-3">{reading.co2 ?? "—"}</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
									)}
								</CardContent>
							</Card>
						</div>

						<Card className="border-border">
							<CardHeader>
								<CardTitle>Reports & Insights</CardTitle>
								<CardDescription>Aggregated attendance trends for this classroom</CardDescription>
							</CardHeader>
							<CardContent>
								{detailsLoading ? (
									<p className="text-sm text-muted-foreground">Loading reports...</p>
								) : !attendanceReports.length ? (
									<p className="text-sm text-muted-foreground">No report data yet.</p>
								) : (
									<div className="space-y-4">
										{reportAverage && (
											<div className="flex flex-wrap gap-4 text-sm">
												<Badge variant="secondary">Avg Present {reportAverage.pct}%</Badge>
												<Badge variant="outline">Late {reportAverage.late}</Badge>
												<Badge variant="destructive">Absent {reportAverage.absent}</Badge>
											</div>
										)}
										<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
											{attendanceReports.slice(-4).map((report, idx) => (
												<div key={idx} className="border border-border rounded-lg p-3">
													<div className="flex items-center justify-between">
														<div>
															<p className="text-sm font-semibold">
																{report.date ? new Date(report.date).toLocaleDateString() : `Report ${idx + 1}`}
															</p>
															<p className="text-xs text-muted-foreground">Present {report.present ?? "—"}</p>
														</div>
														<Activity className="w-4 h-4 text-muted-foreground" />
													</div>
												</div>
											))}
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				)}
			</main>
		</div>
	)
}

function OverviewStat({
	label,
	value,
	icon,
	helper,
}: {
	label: string
	value: string | number
	icon: ReactNode
	helper?: string
}) {
	return (
		<div className="border border-border rounded-lg p-4">
			<div className="flex items-center gap-2 text-muted-foreground text-xs uppercase font-medium">
				{icon}
				{label}
			</div>
			<p className="text-2xl font-bold mt-2">{value}</p>
			{helper && <p className="text-xs text-muted-foreground mt-1">{helper}</p>}
		</div>
	)
}

function AirMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="border border-border rounded-lg p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="text-lg font-semibold">{value}</p>
		</div>
	)
}
