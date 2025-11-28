"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Download, Filter, Clock, Calendar, TrendingUp, CheckCircle, XCircle } from "lucide-react"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

export function AttendanceView() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClass, setSelectedClass] = useState("all")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)

  const students = [
    {
      id: "001",
      name: "Ahmed Hassan",
      class: "10-A",
      checkInTime: "08:05 AM",
      status: "present",
      fingerprint: "Matched",
      reliability: 98,
    },
    {
      id: "002",
      name: "Fatima Ali",
      class: "10-A",
      checkInTime: "08:12 AM",
      status: "present",
      fingerprint: "Matched",
      reliability: 99,
    },
    {
      id: "003",
      name: "Mohammad Khan",
      class: "10-A",
      checkInTime: "08:45 AM",
      status: "late",
      fingerprint: "Matched",
      reliability: 97,
    },
    {
      id: "004",
      name: "Sara Hussein",
      class: "10-B",
      checkInTime: "-",
      status: "absent",
      fingerprint: "Not Scanned",
      reliability: 0,
    },
    {
      id: "005",
      name: "Omar Abdullah",
      class: "10-B",
      checkInTime: "08:08 AM",
      status: "present",
      fingerprint: "Matched",
      reliability: 99,
    },
    {
      id: "006",
      name: "Layla Ahmed",
      class: "10-B",
      checkInTime: "08:03 AM",
      status: "present",
      fingerprint: "Matched",
      reliability: 98,
    },
  ]

  const weeklyTrend = [
    { day: "Mon", present: 1173, absent: 42, late: 32 },
    { day: "Tue", present: 1189, absent: 35, late: 23 },
    { day: "Wed", present: 1156, absent: 58, late: 33 },
    { day: "Thu", present: 1195, absent: 28, late: 24 },
    { day: "Fri", present: 1142, absent: 68, late: 37 },
  ]

  const studentHistory = [
    { date: "Nov 25", status: "present", time: "08:05 AM" },
    { date: "Nov 24", status: "present", time: "08:12 AM" },
    { date: "Nov 23", status: "late", time: "08:45 AM" },
    { date: "Nov 22", status: "present", time: "08:03 AM" },
    { date: "Nov 21", status: "absent", time: "-" },
  ]

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) || student.id.includes(searchTerm)
    const matchesClass = selectedClass === "all" || student.class === selectedClass
    return matchesSearch && matchesClass
  })

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 pt-20 md:pt-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Attendance Management</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          View and manage student attendance records with fingerprint verification
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-start md:items-end">
        <div className="flex-1 w-full md:min-w-64">
          <label className="text-xs md:text-sm font-medium text-foreground mb-2 block">Search Student</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 md:w-5 h-4 md:h-5 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-xs md:text-sm"
            />
          </div>
        </div>

        <div className="w-full md:w-auto md:min-w-40">
          <label className="text-xs md:text-sm font-medium text-foreground mb-2 block">Class</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-xs md:text-sm"
          >
            <option value="all">All Classes</option>
            <option value="10-A">Class 10-A</option>
            <option value="10-B">Class 10-B</option>
            <option value="10-C">Class 10-C</option>
          </select>
        </div>

        <div className="w-full md:w-auto md:min-w-40">
          <label className="text-xs md:text-sm font-medium text-foreground mb-2 block">Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 w-4 md:w-5 h-4 md:h-5 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-md border border-input bg-background text-foreground text-xs md:text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none gap-2 bg-transparent text-xs md:text-sm">
            <Filter className="w-3 md:w-4 h-3 md:h-4" />
            <span className="hidden md:inline">Filter</span>
          </Button>

          <Button className="flex-1 md:flex-none gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs md:text-sm">
            <Download className="w-3 md:w-4 h-3 md:h-4" />
            <span className="hidden md:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Attendance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total Students" value="1,247" icon={<CheckCircle className="w-4 md:w-5 h-4 md:h-5" />} />
        <StatCard
          label="Present"
          value="1,173"
          highlight="secondary"
          icon={<CheckCircle className="w-4 md:w-5 h-4 md:h-5" />}
        />
        <StatCard
          label="Absent"
          value="42"
          highlight="destructive"
          icon={<XCircle className="w-4 md:w-5 h-4 md:h-5" />}
        />
        <StatCard label="Late" value="32" highlight="accent" icon={<Clock className="w-4 md:w-5 h-4 md:h-5" />} />
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg md:text-base">
            <TrendingUp className="w-4 md:w-5 h-4 md:h-5" />
            Weekly Attendance Trend
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Attendance statistics for the past week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="present" fill="hsl(var(--secondary))" name="Present" />
                <Bar dataKey="late" fill="hsl(var(--accent))" name="Late" />
                <Bar dataKey="absent" fill="hsl(var(--destructive))" name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card className="border-border">
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-lg md:text-base">Attendance Records - {selectedDate}</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Real-time attendance records via fingerprint authentication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground">Student ID</th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground">Name</th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground hidden md:table-cell">
                    Class
                  </th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground">Check-in</th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground hidden lg:table-cell">
                    Fingerprint
                  </th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground">Status</th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium text-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <>
                    <tr
                      key={student.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedStudent(expandedStudent === student.id ? null : student.id)}
                    >
                      <td className="px-2 md:px-4 py-3 text-muted-foreground text-xs md:text-sm">{student.id}</td>
                      <td className="px-2 md:px-4 py-3 font-medium text-foreground text-xs md:text-sm">
                        {student.name}
                      </td>
                      <td className="px-2 md:px-4 py-3 hidden md:table-cell text-xs md:text-sm">{student.class}</td>
                      <td className="px-2 md:px-4 py-3 text-muted-foreground text-xs md:text-sm">
                        {student.checkInTime}
                      </td>
                      <td className="px-2 md:px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          {student.fingerprint}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs font-medium ${
                            student.status === "present"
                              ? "bg-secondary/20 text-secondary"
                              : student.status === "late"
                                ? "bg-accent/20 text-accent"
                                : "bg-destructive/20 text-destructive"
                          }`}
                        >
                          {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="text-xs">
                          {expandedStudent === student.id ? "−" : "+"}
                        </Button>
                      </td>
                    </tr>

                    {expandedStudent === student.id && (
                      <tr className="bg-muted/30 border-b border-border/50">
                        <td colSpan={7} className="px-2 md:px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            <div>
                              <h4 className="font-semibold text-sm md:text-base text-foreground mb-3">
                                Fingerprint Details
                              </h4>
                              <div className="space-y-2 text-xs md:text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Match Quality:</span>
                                  <span className="font-medium">{student.reliability}%</span>
                                </div>
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-secondary" style={{ width: `${student.reliability}%` }} />
                                </div>
                                <div className="flex justify-between mt-2">
                                  <span className="text-muted-foreground">Status:</span>
                                  <span className="text-secondary font-medium">{student.fingerprint}</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold text-sm md:text-base text-foreground mb-3">
                                Today's Summary
                              </h4>
                              <div className="space-y-2 text-xs md:text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Check-in:</span>
                                  <span className="font-medium">{student.checkInTime}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Duration:</span>
                                  <span className="font-medium">8 hours 15 min</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold text-sm md:text-base text-foreground mb-3">
                                Recent History
                              </h4>
                              <div className="space-y-2 text-xs">
                                {studentHistory.slice(0, 4).map((record, idx) => (
                                  <div key={idx} className="flex justify-between items-center">
                                    <span className="text-muted-foreground">{record.date}</span>
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${
                                        record.status === "present"
                                          ? "bg-secondary/20 text-secondary"
                                          : record.status === "late"
                                            ? "bg-accent/20 text-accent"
                                            : "bg-destructive/20 text-destructive"
                                      }`}
                                    >
                                      {record.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Daily Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Card className="border-border">
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-lg md:text-base">Peak Check-in Times</CardTitle>
            <CardDescription className="text-xs md:text-sm">When students checked in today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { time: "08:00 - 08:15", count: 542, percentage: 46 },
                { time: "08:15 - 08:30", count: 389, percentage: 33 },
                { time: "08:30 - 09:00", count: 242, percentage: 21 },
              ].map((slot, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-foreground">{slot.time}</span>
                    <span className="font-medium">{slot.count} students</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${slot.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-lg md:text-base">Late Arrivals</CardTitle>
            <CardDescription className="text-xs md:text-sm">Students who arrived after 8:30 AM</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { name: "Mohammad Khan", time: "08:45 AM" },
                { name: "Zara Ali", time: "08:52 AM" },
                { name: "Hassan Ahmed", time: "09:10 AM" },
              ].map((student, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <span className="text-xs md:text-sm font-medium text-foreground">{student.name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {student.time}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ label, value, highlight, icon }: any) {
  const colorClass =
    {
      secondary: "text-secondary",
      destructive: "text-destructive",
      accent: "text-accent",
    }[highlight || "primary"] || "text-primary"

  return (
    <Card className="border-border">
      <CardContent className="p-3 md:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs md:text-sm text-muted-foreground font-medium">{label}</p>
            <p className={`text-lg md:text-3xl font-bold mt-2 ${colorClass}`}>{value}</p>
          </div>
          <div className={`${colorClass} opacity-60`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}
