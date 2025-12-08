import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { getEffectiveSchoolId, getTeacherClassroomIds } from '../utils/tenant';

const router = Router();

// Get dashboard stats
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);

    const [
      totalStudents,
      presentToday,
      absentToday,
      lateToday,
      totalDevices,
      onlineDevices,
      recentAlerts,
      latestAirQuality,
      schoolBreakdown,
    ] = await Promise.all([
      prisma.student.count({ where: schoolId ? { schoolId } : undefined }),
      prisma.attendance.count({
        where: {
          checkInTime: { gte: today },
          status: 'PRESENT',
          ...(schoolId ? { schoolId } : {}),
        },
      }),
      prisma.attendance.count({
        where: {
          checkInTime: { gte: today },
          status: 'ABSENT',
          ...(schoolId ? { schoolId } : {}),
        },
      }),
      prisma.attendance.count({
        where: {
          checkInTime: { gte: today },
          status: 'LATE',
          ...(schoolId ? { schoolId } : {}),
        },
      }),
      prisma.device.count({ where: schoolId ? { schoolId } : undefined }),
      prisma.device.count({ where: { status: 'ONLINE', ...(schoolId ? { schoolId } : {}) } }),
      prisma.alert.findMany({
        where: { resolved: false, ...(schoolId ? { schoolId } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.airQuality.findMany({
        where: schoolId ? { schoolId } : undefined,
        orderBy: { timestamp: 'desc' },
        take: 5,
        include: { device: true, classroom: true },
      }),
      req.user?.role === UserRole.PLATFORM_ADMIN && !schoolId
        ? prisma.school.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              status: true,
              _count: { select: { students: true, devices: true } },
            },
          })
        : Promise.resolve([]),
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
      schools: schoolBreakdown,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get weekly attendance trend
router.get('/attendance/weekly', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);

    let classroomFilter: string[] | undefined;
    if (req.user?.role === UserRole.TEACHER) {
      classroomFilter = await getTeacherClassroomIds(req.user.id);
      if (!classroomFilter.length) {
        return res.json([]);
      }
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        checkInTime: {
          gte: startDate,
          lte: endDate,
        },
        ...(schoolId ? { schoolId } : {}),
        ...(classroomFilter ? { classroomId: { in: classroomFilter } } : {}),
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
router.get('/airquality/hourly', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);

    let classroomFilter: string[] | undefined;
    if (req.user?.role === UserRole.TEACHER) {
      classroomFilter = await getTeacherClassroomIds(req.user.id);
      if (!classroomFilter.length) {
        return res.json([]);
      }
    }

    const readings = await prisma.airQuality.findMany({
      where: {
        timestamp: { gte: today },
        ...(schoolId ? { schoolId } : {}),
        ...(classroomFilter ? { classroomId: { in: classroomFilter } } : {}),
      },
      orderBy: { timestamp: 'asc' },
      include: { device: true, classroom: true },
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
router.get('/classrooms', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);

    let classroomFilter: string[] | undefined;
    if (req.user?.role === UserRole.TEACHER) {
      classroomFilter = await getTeacherClassroomIds(req.user.id);
      if (!classroomFilter.length) {
        return res.json([]);
      }
    }

    const devices = await prisma.device.findMany({
      where: {
        status: 'ONLINE',
        ...(schoolId ? { schoolId } : {}),
        ...(classroomFilter ? { classroomId: { in: classroomFilter } } : {}),
      },
      include: {
        classroom: true,
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
            ...(schoolId ? { schoolId } : {}),
          },
        });

        const latestReading = device.airQualityReadings[0];
        const airQuality = latestReading
          ? latestReading.pm25 < 35 && latestReading.co2 < 750
            ? 'Good'
            : 'Moderate'
          : 'Unknown';
        const capacity = device.classroom?.capacity || 45;

        return {
          room: device.location,
          occupancy: `${attendance}/${capacity}`,
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

