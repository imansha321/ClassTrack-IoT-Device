"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Filter } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, LineChart, Line } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const monthlyAttendance = [
  { month: "Jan", present: 95.2, absent: 4.8 },
  { month: "Feb", present: 94.8, absent: 5.2 },
  { month: "Mar", present: 96.1, absent: 3.9 },
  { month: "Apr", present: 93.5, absent: 6.5 },
  { month: "May", present: 95.8, absent: 4.2 },
  { month: "Jun", present: 94.2, absent: 5.8 },
]

const airQualityTrend = [
  { week: "W1", pm25_avg: 35, co2_avg: 550, temp_avg: 22.5 },
  { week: "W2", pm25_avg: 38, co2_avg: 580, temp_avg: 22.8 },
  { week: "W3", pm25_avg: 40, co2_avg: 620, temp_avg: 23.2 },
  { week: "W4", pm25_avg: 37, co2_avg: 600, temp_avg: 23.1 },
]

export function ReportsView() {
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-2">Comprehensive data analysis and export capabilities</p>
        </div>
      </div>

      {/* Report Filters */}
      <div className="flex gap-4 flex-wrap items-end">
        <div className="min-w-40">
          <label className="text-sm font-medium text-foreground mb-2 block">Date Range</label>
          <select className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm">
            <option>This Month</option>
            <option>Last 3 Months</option>
            <option>This Year</option>
            <option>Custom Range</option>
          </select>
        </div>

        <div className="min-w-40">
          <label className="text-sm font-medium text-foreground mb-2 block">Report Type</label>
          <select className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm">
            <option>Attendance</option>
            <option>Air Quality</option>
            <option>Device Status</option>
            <option>Comprehensive</option>
          </select>
        </div>

        <Button variant="outline" className="gap-2 bg-transparent">
          <Filter className="w-4 h-4" />
          Filter
        </Button>

        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Download className="w-4 h-4" />
          Export as CSV
        </Button>

        <Button variant="outline" className="gap-2 bg-transparent">
          <Download className="w-4 h-4" />
          Export as PDF
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard label="Avg Attendance" value="94.6%" color="secondary" />
        <SummaryCard label="Avg PM2.5" value="37.5 µg/m³" color="accent" />
        <SummaryCard label="Avg CO₂" value="588 ppm" color="primary" />
        <SummaryCard label="Device Uptime" value="99.8%" color="secondary" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Attendance */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Attendance Trend</CardTitle>
            <CardDescription>Monthly attendance rates</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                present: { label: "Present (%)", color: "hsl(var(--chart-2))" },
                absent: { label: "Absent (%)", color: "hsl(var(--chart-4))" },
              }}
              className="h-64"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyAttendance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="present" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Air Quality Trend */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Air Quality Average</CardTitle>
            <CardDescription>Weekly environmental trends</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                pm25_avg: { label: "PM2.5 (µg/m³)", color: "hsl(var(--chart-1))" },
                co2_avg: { label: "CO₂ (ppm)", color: "hsl(var(--chart-2))" },
              }}
              className="h-64"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={airQualityTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="week" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="pm25_avg"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="co2_avg"
                    stroke="var(--color-chart-2)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>Generated reports available for download</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: "June Attendance Report", date: "2024-06-30", type: "Attendance", size: "2.4 MB" },
              { name: "June Air Quality Analysis", date: "2024-06-30", type: "Air Quality", size: "1.8 MB" },
              { name: "May Combined Report", date: "2024-05-31", type: "Comprehensive", size: "4.2 MB" },
              { name: "May Device Health", date: "2024-05-31", type: "Device Status", size: "1.1 MB" },
            ].map((report, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">{report.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {report.type} • {report.date} • {report.size}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                  <Download className="w-4 h-4" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Generate Custom Report</CardTitle>
          <CardDescription>Create and download a custom report with selected metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Select Metrics to Include</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "Daily Attendance",
                  "Hourly Air Quality",
                  "Device Status",
                  "Room Comparisons",
                  "Trend Analysis",
                  "Alerts & Incidents",
                ].map((metric) => (
                  <label key={metric} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-input" />
                    <span className="text-sm text-foreground">{metric}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Report Format</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="format" defaultChecked />
                  <span className="text-sm text-foreground">PDF</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="format" />
                  <span className="text-sm text-foreground">CSV</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="format" />
                  <span className="text-sm text-foreground">Excel</span>
                </label>
              </div>
            </div>

            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Generate & Download Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ label, value, color }: any) {
  const colorClass =
    {
      primary: "text-primary",
      secondary: "text-secondary",
      accent: "text-accent",
    }[color] || "text-primary"

  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-2 ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
