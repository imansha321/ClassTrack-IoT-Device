"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { AlertTriangle, Wind, Droplets, Thermometer } from "lucide-react"

const hourlyData = [
  { time: "08:00", pm25: 22, co2: 410, temp: 22.1, humidity: 44 },
  { time: "09:00", pm25: 28, co2: 480, temp: 22.8, humidity: 46 },
  { time: "10:00", pm25: 35, co2: 560, temp: 23.4, humidity: 49 },
  { time: "11:00", pm25: 42, co2: 650, temp: 24.1, humidity: 51 },
  { time: "12:00", pm25: 48, co2: 720, temp: 24.6, humidity: 53 },
  { time: "13:00", pm25: 45, co2: 680, temp: 24.4, humidity: 52 },
  { time: "14:00", pm25: 38, co2: 600, temp: 23.9, humidity: 50 },
  { time: "15:00", pm25: 32, co2: 540, temp: 23.5, humidity: 48 },
]

const roomsData = [
  { name: "Room 101", pm25: 28, co2: 520, temp: 22.8, humidity: 46, quality: "Good" },
  { name: "Room 102", pm25: 52, co2: 780, temp: 24.9, humidity: 54, quality: "Moderate" },
  { name: "Room 103", pm25: 31, co2: 550, temp: 23.2, humidity: 48, quality: "Good" },
  { name: "Lab 104", pm25: 65, co2: 850, temp: 25.2, humidity: 56, quality: "Poor" },
]

export function AirQualityView() {
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Air Quality Monitoring</h1>
        <p className="text-muted-foreground mt-2">Real-time environmental conditions across all classrooms</p>
      </div>

      {/* Current Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <QualityMetric label="PM2.5" value="42 µg/m³" unit="(Moderate)" icon={Wind} warning={true} />
        <QualityMetric label="CO₂" value="680 ppm" unit="(High)" icon={AlertTriangle} warning={true} />
        <QualityMetric label="Temperature" value="24.2°C" unit="(Optimal)" icon={Thermometer} />
        <QualityMetric label="Humidity" value="51%" unit="(Good)" icon={Droplets} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly PM2.5 Trend */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>PM2.5 Levels (Hourly)</CardTitle>
            <CardDescription>Particulate matter concentration</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                pm25: { label: "PM2.5 (µg/m³)", color: "hsl(var(--chart-1))" },
              }}
              className="h-64"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="colorPm25" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="pm25"
                    stroke="var(--color-chart-1)"
                    fillOpacity={1}
                    fill="url(#colorPm25)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Hourly CO2 Trend */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>CO₂ Levels (Hourly)</CardTitle>
            <CardDescription>Carbon dioxide concentration</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                co2: { label: "CO₂ (ppm)", color: "hsl(var(--chart-2))" },
              }}
              className="h-64"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="co2"
                    stroke="var(--color-chart-2)"
                    fillOpacity={1}
                    fill="url(#colorCo2)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Classroom Comparison */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Air Quality by Classroom</CardTitle>
          <CardDescription>Comparison of current readings across all rooms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roomsData.map((room) => (
              <div
                key={room.name}
                className={`p-4 rounded-lg border ${
                  room.quality === "Good"
                    ? "bg-secondary/10 border-secondary/30"
                    : room.quality === "Moderate"
                      ? "bg-accent/10 border-accent/30"
                      : "bg-destructive/10 border-destructive/30"
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-foreground">{room.name}</h3>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      room.quality === "Good"
                        ? "bg-secondary/20 text-secondary"
                        : room.quality === "Moderate"
                          ? "bg-accent/20 text-accent"
                          : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {room.quality}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">PM2.5</p>
                    <p className="font-semibold">{room.pm25} µg/m³</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CO₂</p>
                    <p className="font-semibold">{room.co2} ppm</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Temp</p>
                    <p className="font-semibold">{room.temp}°C</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Humidity</p>
                    <p className="font-semibold">{room.humidity}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Air Quality Alerts */}
      <Card className="border-border border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Active Alerts</CardTitle>
          <CardDescription>Thresholds exceeded</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { room: "Lab 104", metric: "CO₂", value: "850 ppm", threshold: "800 ppm", severity: "critical" },
              { room: "Room 102", metric: "PM2.5", value: "52 µg/m³", threshold: "50 µg/m³", severity: "warning" },
              { room: "Room 102", metric: "CO₂", value: "780 ppm", threshold: "750 ppm", severity: "warning" },
            ].map((alert, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 rounded-lg bg-card/50 border border-border">
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    alert.severity === "critical" ? "bg-destructive" : "bg-accent"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {alert.room}: {alert.metric} exceeds threshold
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Current: {alert.value} → Threshold: {alert.threshold}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Health Recommendations */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>Actions to improve air quality</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {[
              "Open windows in Room 102 and Lab 104 for 10-15 minutes",
              "Activate ventilation system in Lab 104 - CO₂ levels critical",
              "Check air filter status in Room 102",
              "Schedule HVAC maintenance for next week",
            ].map((rec, idx) => (
              <li key={idx} className="flex items-start gap-3 text-foreground">
                <span className="text-secondary mt-1">✓</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function QualityMetric({ label, value, unit, icon: Icon, warning }: any) {
  return (
    <Card className={`border-border ${warning ? "bg-accent/5" : ""}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-2">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{unit}</p>
          </div>
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              warning ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
