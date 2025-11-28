"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Cpu, Signal, Battery, AlertCircle, CheckCircle2, Clock } from "lucide-react"

export function DevicesView() {
  const [devices] = useState([
    {
      id: "ESP32-101",
      name: "Room 101 Sensor",
      type: "fingerprint-scanner",
      status: "online",
      lastSeen: "2 min ago",
      battery: 92,
      signal: 85,
      uptime: "45 days",
      version: "v2.1.3",
    },
    {
      id: "ESP32-102",
      name: "Room 102 Sensor",
      type: "multi-sensor",
      status: "online",
      lastSeen: "1 min ago",
      battery: 87,
      signal: 78,
      uptime: "45 days",
      version: "v2.1.3",
    },
    {
      id: "ESP32-103",
      name: "Room 103 Sensor",
      type: "fingerprint-scanner",
      status: "online",
      lastSeen: "3 min ago",
      battery: 76,
      signal: 91,
      uptime: "44 days",
      version: "v2.1.2",
    },
    {
      id: "ESP32-Lab",
      name: "Lab Sensor",
      type: "multi-sensor",
      status: "offline",
      lastSeen: "2 hours ago",
      battery: 0,
      signal: 0,
      uptime: "-",
      version: "v2.0.9",
    },
    {
      id: "ESP32-104",
      name: "Room 104 Sensor",
      type: "fingerprint-scanner",
      status: "online",
      lastSeen: "5 min ago",
      battery: 68,
      signal: 72,
      uptime: "42 days",
      version: "v2.1.3",
    },
  ])

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Device Management</h1>
          <p className="text-muted-foreground mt-2">Monitor all IoT devices and their connectivity</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">+ Add Device</Button>
      </div>

      {/* Device Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Devices" value="42" color="primary" />
        <StatCard label="Online" value="41" color="secondary" />
        <StatCard label="Offline" value="1" color="destructive" />
        <StatCard label="Low Battery" value="3" color="accent" />
      </div>

      {/* Device List */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Connected Devices</CardTitle>
          <CardDescription>Status and diagnostics of all ESP32 IoT modules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {devices.map((device) => (
              <div key={device.id} className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Cpu className="w-5 h-5 text-primary" />
                      <div>
                        <h3 className="font-semibold text-foreground">{device.name}</h3>
                        <p className="text-xs text-muted-foreground">{device.id}</p>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        {device.status === "online" ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-secondary bg-secondary/10 px-2 py-1 rounded">
                            <CheckCircle2 className="w-3 h-3" />
                            Online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded">
                            <AlertCircle className="w-3 h-3" />
                            Offline
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Type</p>
                        <p className="font-medium text-foreground capitalize mt-1">{device.type.replace("-", " ")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Seen</p>
                        <p className="font-medium text-foreground mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {device.lastSeen}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Battery</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Battery
                            className={`w-3 h-3 ${
                              device.battery > 50
                                ? "text-secondary"
                                : device.battery > 25
                                  ? "text-accent"
                                  : "text-destructive"
                            }`}
                          />
                          <span className="font-medium">{device.battery}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Signal</p>
                        <p className="font-medium text-foreground mt-1 flex items-center gap-1">
                          <Signal className="w-3 h-3" />
                          {device.signal}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Uptime</p>
                        <p className="font-medium text-foreground mt-1">{device.uptime}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Version</p>
                        <p className="font-medium text-foreground mt-1">{device.version}</p>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" size="sm">
                    Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Device Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Battery Status</CardTitle>
            <CardDescription>Device battery levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "Room 101", level: 92 },
                { name: "Room 102", level: 87 },
                { name: "Room 103", level: 76 },
                { name: "Room 104", level: 68 },
              ].map((device, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{device.name}</span>
                    <span className="font-medium">{device.level}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        device.level > 50 ? "bg-secondary" : device.level > 25 ? "bg-accent" : "bg-destructive"
                      }`}
                      style={{ width: `${device.level}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Signal Strength</CardTitle>
            <CardDescription>WiFi signal quality</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "Room 101", signal: 85 },
                { name: "Room 103", signal: 91 },
                { name: "Room 102", signal: 78 },
                { name: "Room 104", signal: 72 },
              ].map((device, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{device.name}</span>
                    <span className="font-medium">{device.signal}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${device.signal}%` }} />
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

function StatCard({ label, value, color }: any) {
  const colorClass =
    {
      primary: "text-primary",
      secondary: "text-secondary",
      destructive: "text-destructive",
      accent: "text-accent",
    }[color] || "text-primary"

  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className={`text-3xl font-bold mt-2 ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
