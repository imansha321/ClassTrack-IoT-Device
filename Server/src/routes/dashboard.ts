import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get dashboard stats
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalStudents,
      presentToday,
      absentToday,
      lateToday,
      totalDevices,
      onlineDevices,
      recentAlerts,
      latestAirQuality,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.attendance.count({
        where: {
          checkInTime: { gte: today },
          status: 'PRESENT',
        },
      }),
      prisma.attendance.count({
        where: {
          checkInTime: { gte: today },
          status: 'ABSENT',
        },
      }),
      prisma.attendance.count({
        where: {
          checkInTime: { gte: today },
          status: 'LATE',
        },
      }),
      prisma.device.count(),
      prisma.device.count({ where: { status: 'ONLINE' } }),
      prisma.alert.findMany({
        where: { resolved: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.airQuality.findMany({
        orderBy: { timestamp: 'desc' },
        take: 5,
        include: { device: true },
      }),
    ]);

    const presentRate = totalStudents > 0 
      ? ((presentToday / totalStudents) * 100).toFixed(1) 
      : '0.0';

    res.json({
      attendance: {
        total: totalStudents,
        present: presentToday,
        absent: absentToday,
        late: lateToday,
        presentRate,
      },
      devices: {
        total: totalDevices,
        online: onlineDevices,
        offline: totalDevices - onlineDevices,
      },
      airQuality: latestAirQuality[0] || null,
      alerts: recentAlerts,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get weekly attendance trend
router.get('/attendance/weekly', authenticateToken, async (req: Request, res: Response) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const attendances = await prisma.attendance.findMany({
      where: {
        checkInTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        checkInTime: true,
        status: true,
      },
    });

    const weeklyData = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const dayAttendances = attendances.filter(a => {
        const aDate = new Date(a.checkInTime);
        return aDate.toDateString() === date.toDateString();
      });

      weeklyData.push({
        day: days[date.getDay()],
        date: date.toISOString().split('T')[0],
        present: dayAttendances.filter(a => a.status === 'PRESENT').length,
        absent: dayAttendances.filter(a => a.status === 'ABSENT').length,
        late: dayAttendances.filter(a => a.status === 'LATE').length,
      });
    }

    res.json(weeklyData);
  } catch (error) {
    console.error('Weekly attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly attendance' });
  }
});

// Get hourly air quality data
router.get('/airquality/hourly', authenticateToken, async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const readings = await prisma.airQuality.findMany({
      where: {
        timestamp: { gte: today },
      },
      orderBy: { timestamp: 'asc' },
      include: { device: true },
    });

    // Group by hour
    const hourlyData: any = {};
    readings.forEach(reading => {
      const hour = new Date(reading.timestamp).getHours();
      const key = `${String(hour).padStart(2, '0')}:00`;
      
      if (!hourlyData[key]) {
        hourlyData[key] = {
          time: key,
          pm25: [],
          co2: [],
          temp: [],
          humidity: [],
        };
      }
      
      hourlyData[key].pm25.push(reading.pm25);
      hourlyData[key].co2.push(reading.co2);
      hourlyData[key].temp.push(reading.temperature);
      hourlyData[key].humidity.push(reading.humidity);
    });

    const result = Object.values(hourlyData).map((hour: any) => ({
      time: hour.time,
      pm25: +(hour.pm25.reduce((a: number, b: number) => a + b, 0) / hour.pm25.length).toFixed(1),
      co2: Math.round(hour.co2.reduce((a: number, b: number) => a + b, 0) / hour.co2.length),
      temp: +(hour.temp.reduce((a: number, b: number) => a + b, 0) / hour.temp.length).toFixed(1),
      humidity: +(hour.humidity.reduce((a: number, b: number) => a + b, 0) / hour.humidity.length).toFixed(0),
    }));

    res.json(result);
  } catch (error) {
    console.error('Hourly air quality error:', error);
    res.status(500).json({ error: 'Failed to fetch air quality data' });
  }
});

// Get classroom status
router.get('/classrooms', authenticateToken, async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const devices = await prisma.device.findMany({
      where: { status: 'ONLINE' },
      include: {
        airQualityReadings: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    const classrooms = await Promise.all(
      devices.map(async device => {
        const attendance = await prisma.attendance.count({
          where: {
            deviceId: device.id,
            checkInTime: { gte: today },
            status: 'PRESENT',
          },
        });

        const latestReading = device.airQualityReadings[0];
        const airQuality = latestReading
          ? latestReading.pm25 < 35 && latestReading.co2 < 750
            ? 'Good'
            : 'Moderate'
          : 'Unknown';

        return {
          room: device.location,
          occupancy: `${attendance}/45`,
          airQuality,
          temp: latestReading ? `${latestReading.temperature.toFixed(1)}°C` : 'N/A',
          humidity: latestReading ? `${latestReading.humidity.toFixed(0)}%` : 'N/A',
        };
      })
    );

    res.json(classrooms);
  } catch (error) {
    console.error('Classrooms error:', error);
    res.status(500).json({ error: 'Failed to fetch classroom status' });
  }
});

export default router;

