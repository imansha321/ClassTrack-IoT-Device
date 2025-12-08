import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { getEffectiveSchoolId, getTeacherClassroomIds } from '../utils/tenant';

const router = Router();

// Generate attendance report
router.get('/attendance', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, class: className, classroomId } = req.query;
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);
    
    const where: any = {};
    if (schoolId) {
      where.schoolId = schoolId;
    }
    
    if (startDate && endDate) {
      where.checkInTime = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    if (classroomId) {
      where.classroomId = classroomId;
    }

    if (className && className !== 'all') {
      where.student = { class: className };
    }

    if (req.user?.role === UserRole.TEACHER) {
      const assignments = await getTeacherClassroomIds(req.user.id);
      if (!assignments.length) {
        return res.json({ summary: {}, byStudent: [], records: [] });
      }
      if (where.classroomId) {
        const requested = Array.isArray(where.classroomId.in) ? where.classroomId.in : [where.classroomId];
        const allowed = requested.filter((id: string) => assignments.includes(id));
        if (!allowed.length) {
          return res.json({ summary: {}, byStudent: [], records: [] });
        }
        where.classroomId = allowed.length === 1 ? allowed[0] : { in: allowed };
      } else {
        where.classroomId = { in: assignments };
      }
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        student: true,
        device: true,
        classroom: true,
      },
      orderBy: { checkInTime: 'desc' },
    });

    // Generate summary
    const summary = {
      totalRecords: attendances.length,
      present: attendances.filter(a => a.status === 'PRESENT').length,
      absent: attendances.filter(a => a.status === 'ABSENT').length,
      late: attendances.filter(a => a.status === 'LATE').length,
      dateRange: { startDate, endDate },
      class: className || 'all',
    };

    // Group by student
    const byStudent: any = {};
    attendances.forEach(a => {
      const key = a.student.studentId;
      if (!byStudent[key]) {
        byStudent[key] = {
          student: a.student,
          records: [],
          summary: { present: 0, absent: 0, late: 0 },
        };
      }
      byStudent[key].records.push(a);
      byStudent[key].summary[a.status.toLowerCase()]++;
    });

    res.json({
      summary,
      byStudent: Object.values(byStudent),
      records: attendances,
    });
  } catch (error) {
    console.error('Attendance report error:', error);
    res.status(500).json({ error: 'Failed to generate attendance report' });
  }
});

// Generate air quality report
router.get('/airquality', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, room } = req.query;
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);
    
    const where: any = {};
    if (schoolId) {
      where.schoolId = schoolId;
    }
    
    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }
    
    if (room) {
      where.room = room;
    }

    const readings = await prisma.airQuality.findMany({
      where,
      include: { device: true, classroom: true },
      orderBy: { timestamp: 'desc' },
    });

    // Calculate statistics
    const stats = {
      totalReadings: readings.length,
      average: {
        pm25: 0,
        co2: 0,
        temperature: 0,
        humidity: 0,
      },
      max: {
        pm25: 0,
        co2: 0,
        temperature: 0,
      },
      min: {
        pm25: Infinity,
        co2: Infinity,
        temperature: Infinity,
      },
      violations: {
        pm25: 0,
        co2: 0,
      },
    };

    if (readings.length > 0) {
      readings.forEach(r => {
        stats.average.pm25 += r.pm25;
        stats.average.co2 += r.co2;
        stats.average.temperature += r.temperature;
        stats.average.humidity += r.humidity;
        
        stats.max.pm25 = Math.max(stats.max.pm25, r.pm25);
        stats.max.co2 = Math.max(stats.max.co2, r.co2);
        stats.max.temperature = Math.max(stats.max.temperature, r.temperature);
        
        stats.min.pm25 = Math.min(stats.min.pm25, r.pm25);
        stats.min.co2 = Math.min(stats.min.co2, r.co2);
        stats.min.temperature = Math.min(stats.min.temperature, r.temperature);
        
        if (r.pm25 > 50) stats.violations.pm25++;
        if (r.co2 > 800) stats.violations.co2++;
      });

      stats.average.pm25 = +(stats.average.pm25 / readings.length).toFixed(1);
      stats.average.co2 = Math.round(stats.average.co2 / readings.length);
      stats.average.temperature = +(stats.average.temperature / readings.length).toFixed(1);
      stats.average.humidity = +(stats.average.humidity / readings.length).toFixed(0);
      
      stats.max.pm25 = +stats.max.pm25.toFixed(1);
      stats.max.temperature = +stats.max.temperature.toFixed(1);
      
      stats.min.pm25 = +stats.min.pm25.toFixed(1);
      stats.min.temperature = +stats.min.temperature.toFixed(1);
    }

    // Group by room
    const byRoom: any = {};
    readings.forEach(r => {
      if (!byRoom[r.room]) {
        byRoom[r.room] = [];
      }
      byRoom[r.room].push(r);
    });

    res.json({
      dateRange: { startDate, endDate },
      room: room || 'all',
      statistics: stats,
      byRoom,
      readings,
    });
  } catch (error) {
    console.error('Air quality report error:', error);
    res.status(500).json({ error: 'Failed to generate air quality report' });
  }
});

// Generate device health report
router.get('/devices', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);
    const where: any = {};
    if (schoolId) {
      where.schoolId = schoolId;
    }

    if (req.user?.role === UserRole.TEACHER) {
      const assignments = await getTeacherClassroomIds(req.user.id);
      if (!assignments.length) {
        return res.json({ summary: {}, devices: [] });
      }
      where.classroomId = { in: assignments };
    }

    const devices = await prisma.device.findMany({
      where,
      include: {
        _count: {
          select: {
            attendances: true,
            airQualityReadings: true,
          },
        },
        classroom: true,
      },
      orderBy: { name: 'asc' },
    });

    const summary = {
      total: devices.length,
      online: devices.filter(d => d.status === 'ONLINE').length,
      offline: devices.filter(d => d.status === 'OFFLINE').length,
      maintenance: devices.filter(d => d.status === 'MAINTENANCE').length,
      lowBattery: devices.filter(d => d.battery < 30).length,
      weakSignal: devices.filter(d => d.signal < 50).length,
    };

    res.json({
      summary,
      devices,
    });
  } catch (error) {
    console.error('Device report error:', error);
    res.status(500).json({ error: 'Failed to generate device report' });
  }
});

export default router;

