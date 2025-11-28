"use client"

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  AlertCircle,
  TrendingUp,
  Users,
  Wind,
  Download,
  RefreshCw,
  Battery,
  Wifi,
  CheckCircle,
  AlertTriangle,
} from "lucide-react"
import { Sidebar } from "./sidebar"
import { useState } from "react"

const attendanceData = [
  { date: "Mon", present: 280, absent: 45, late: 12 },
  { date: "Tue", present: 295, absent: 28, late: 8 },
  { date: "Wed", present: 290, absent: 35, late: 10 },
  { date: "Thu", present: 305, absent: 18, late: 5 },
  { date: "Fri", present: 288, absent: 40, late: 15 },
]

const airQualityData = [
  { time: "08:00", pm25: 25, co2: 420, temp: 22.5, humidity: 45 },
  { time: "10:00", pm25: 38, co2: 580, temp: 23.1, humidity: 48 },
  { time: "12:00", pm25: 52, co2: 720, temp: 24.2, humidity: 52 },
  { time: "14:00", pm25: 48, co2: 680, temp: 24.8, humidity: 50 },
  { time: "16:00", pm25: 35, co2: 550, temp: 23.9, humidity: 47 },
]

const attendanceBreakdown = [
  { name: "Present", value: 1247, color: "hsl(var(--chart-2))" },
  { name: "Absent", value: 150, color: "hsl(var(--chart-4))" },
  { name: "Late", value: 48, color: "hsl(var(--chart-3))" },
]

const deviceStatus = [
  { id: "ESP32-Lab-01", room: "Lab", battery: 95, signal: 5, status: "Online", lastSeen: "Just now" },
  { id: "ESP32-Class-02", room: "101", battery: 78, signal: 4, status: "Online", lastSeen: "Just now" },
  { id: "ESP32-Class-03", room: "102", battery: 45, signal: 3, status: "Online", lastSeen: "2 min ago" },
  { id: "ESP32-Class-04", room: "103", battery: 92, signal: 5, status: "Online", lastSeen: "Just now" },
]

export function Dashboard({ isMobileMenuOpen, setIsMobileMenuOpen }: any) {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  return (
    <div className="pt-20 lg:pt-0">
      <div className="lg:hidden">
        <Sidebar />
      </div>

      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        <div className="flex justify-between items-start flex-col md:flex-row gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-2">
              Welcome back! Here's your school's attendance and air quality overview.
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded-lg border transition-colors ${
                autoRefresh
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted border-border text-muted-foreground"
              }`}
              title="Toggle auto-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Students"
            value="1,247"
            subtitle="Present today"
            icon={Users}
            trend="+12%"
            color="primary"
            isSelected={selectedMetric === "students"}
            onClick={() => setSelectedMetric("students")}
          />
          <MetricCard
            title="Present Rate"
            value="94.2%"
            subtitle="School average"
            icon={TrendingUp}
            trend="+2.3%"
            color="secondary"
            isSelected={selectedMetric === "rate"}
            onClick={() => setSelectedMetric("rate")}
          />
          <MetricCard
            title="Air Quality"
            value="Moderate"
            subtitle="PM2.5: 48 µg/m³"
            icon={Wind}
            trend="⚠️"
            color="accent"
            isSelected={selectedMetric === "air"}
            onClick={() => setSelectedMetric("air")}
          />
          <MetricCard
            title="Active Devices"
            value="42"
            subtitle="All online"
            icon={AlertCircle}
            trend="✓"
            color="primary"
            isSelected={selectedMetric === "devices"}
            onClick={() => setSelectedMetric("devices")}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <Card className="border-border lg:col-span-2">
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-lg md:text-base">Weekly Attendance</CardTitle>
              <CardDescription className="text-xs md:text-sm">Student check-ins by day</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  present: { label: "Present", color: "#000000" },
                  absent: { label: "Absent", color: "#000000" },
                  late: { label: "Late", color: "#000000" },
                }}
                className="h-48 md:h-64"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ paddingTop: "16px" }} />
                    <Bar dataKey="present" stackId="a" fill="#000000" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent" stackId="a" fill="#404040" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late" stackId="a" fill="#666666" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-lg md:text-base">Attendance Breakdown</CardTitle>
              <CardDescription className="text-xs md:text-sm">Today's distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-48 md:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attendanceBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {attendanceBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="mt-4 space-y-2">
                {attendanceBreakdown.map((item) => (
                  <div key={item.name} className="flex justify-between text-xs md:text-sm">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-lg md:text-base">Air Quality Trend</CardTitle>
            <CardDescription className="text-xs md:text-sm">PM2.5 and CO₂ levels throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                pm25: { label: "PM2.5 (µg/m³)", color: "hsl(var(--chart-1))" },
                co2: { label: "CO₂ (ppm)", color: "hsl(var(--chart-2))" },
              }}
              className="h-48 md:h-80"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={airQualityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="time" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend wrapperStyle={{ paddingTop: "16px" }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="pm25"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="co2"
                    stroke="var(--color-chart-2)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-lg md:text-base">Classroom Status</CardTitle>
            <CardDescription className="text-xs md:text-sm">Current air quality and occupancy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {[
                { room: "Room 101", occupancy: "42/45", airQuality: "Good", temp: "22.5°C", humidity: "45%" },
                { room: "Room 102", occupancy: "38/40", airQuality: "Moderate", temp: "24.2°C", humidity: "52%" },
                { room: "Room 103", occupancy: "40/42", airQuality: "Good", temp: "23.1°C", humidity: "48%" },
              ].map((room) => (
                <div
                  key={room.room}
                  className="p-3 md:p-4 border border-border rounded-lg bg-card/50 hover:bg-card/70 transition-colors cursor-pointer"
                >
                  <h3 className="font-semibold text-sm md:text-base text-card-foreground">{room.room}</h3>
                  <div className="mt-3 space-y-2 text-xs md:text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Occupancy:</span>
                      <span className="font-medium">{room.occupancy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Air Quality:</span>
                      <span className={`font-medium ${room.airQuality === "Good" ? "text-secondary" : "text-accent"}`}>
                        {room.airQuality}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Temp/Humidity:</span>
                      <span className="font-medium">
                        {room.temp} / {room.humidity}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3 md:pb-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg md:text-base">IoT Device Status</CardTitle>
              <CardDescription className="text-xs md:text-sm">Fingerprint scanner and sensor health</CardDescription>
            </div>
            <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="Download alerts">
              <Download className="w-4 h-4 text-muted-foreground" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 md:p-3 font-semibold text-muted-foreground">Device ID</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-muted-foreground">Location</th>
                    <th className="text-center p-2 md:p-3 font-semibold text-muted-foreground">Battery</th>
                    <th className="text-center p-2 md:p-3 font-semibold text-muted-foreground">Signal</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-muted-foreground">Status</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-muted-foreground">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceStatus.map((device) => (
                    <tr key={device.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-2 md:p-3 font-medium text-foreground">{device.id}</td>
                      <td className="p-2 md:p-3 text-muted-foreground">{device.room}</td>
                      <td className="p-2 md:p-3">
                        <div className="flex items-center justify-center gap-1">
                          <Battery className="w-4 h-4 text-muted-foreground" />
                          <span
                            className={
                              device.battery > 60
                                ? "text-secondary"
                                : device.battery > 30
                                  ? "text-accent"
                                  : "text-destructive"
                            }
                          >
                            {device.battery}%
                          </span>
                        </div>
                      </td>
                      <td className="p-2 md:p-3">
                        <div className="flex items-center justify-center gap-1">
                          <Wifi className="w-4 h-4 text-secondary" />
                          <span>{device.signal}/5</span>
                        </div>
                      </td>
                      <td className="p-2 md:p-3">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-secondary" />
                          <span className="text-secondary font-medium">{device.status}</span>
                        </div>
                      </td>
                      <td className="p-2 md:p-3 text-muted-foreground text-xs">{device.lastSeen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3 md:pb-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg md:text-base">Recent Alerts</CardTitle>
              <CardDescription className="text-xs md:text-sm">System notifications and warnings</CardDescription>
            </div>
            <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="Download alerts">
              <Download className="w-4 h-4 text-muted-foreground" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 md:space-y-3">
              {[
                { type: "warning", message: "Room 102 CO₂ level exceeded threshold (780 ppm)", time: "2 min ago" },
                { type: "info", message: "Device ESP32-Lab updated successfully", time: "15 min ago" },
                { type: "success", message: "All fingerprint scanners calibrated", time: "1 hour ago" },
                { type: "warning", message: "PM2.5 levels rising in Room 105", time: "3 hours ago" },
              ].map((alert, idx) => (
                <div
                  key={idx}
                  className="flex gap-3 p-2 md:p-3 rounded-lg bg-muted/30 border border-border/50 hover:border-border transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {alert.type === "warning" ? (
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    ) : alert.type === "info" ? (
                      <AlertCircle className="w-4 h-4 text-primary" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-secondary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium text-card-foreground">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">{alert.time}</p>
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

function MetricCard({ title, value, subtitle, icon: Icon, trend, color, isSelected, onClick }: any) {
  const colorClass = {
    primary: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-secondary/10 text-secondary border-secondary/20",
    accent: "bg-accent/10 text-accent border-accent/20",
  }[color]

  return (
    <Card
      className={`border-border cursor-pointer transition-all ${
        isSelected ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs md:text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-xl md:text-3xl font-bold mt-2">{value}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-2">{subtitle}</p>
          </div>
          <div
            className={`w-10 md:w-12 h-10 md:h-12 rounded-lg flex items-center justify-center border flex-shrink-0 ${colorClass}`}
          >
            <Icon className="w-5 md:w-6 h-5 md:h-6" />
          </div>
        </div>
        <div className="mt-3 md:mt-4 text-xs md:text-sm font-medium text-secondary">{trend}</div>
      </CardContent>
    </Card>
  )
}
