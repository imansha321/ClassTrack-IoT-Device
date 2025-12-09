import { Router, Response } from 'express';
import { body } from 'express-validator';
import prisma from '../config/database';
import { authenticateToken, authenticateDeviceSecret, AuthRequest, authorizeRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AlertSeverity, AlertType, UserRole } from '@prisma/client';
import { getEffectiveSchoolId, getTeacherClassroomIds } from '../utils/tenant';

const router = Router();

// Get air quality readings
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { room, startDate, endDate, limit = 100, classroomId } = req.query;
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);

    const where: any = {};
    if (schoolId) {
      where.schoolId = schoolId;
    }
    if (room) {
      where.room = room;
    }
    let classroomFilter: string[] | undefined;
    if (classroomId) {
      classroomFilter = [classroomId as string];
    }
    
    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    if (req.user?.role === UserRole.TEACHER) {
      const assignments = await getTeacherClassroomIds(req.user.id);
      if (!assignments.length) {
        return res.json([]);
      }
      classroomFilter = classroomFilter
        ? classroomFilter.filter((id) => assignments.includes(id))
        : assignments;
      if (!classroomFilter.length) {
        return res.json([]);
      }
    }

    if (classroomFilter && classroomFilter.length > 0) {
      where.classroomId = classroomFilter.length === 1 ? classroomFilter[0] : { in: classroomFilter };
    }

    const readings = await prisma.airQuality.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: Number(limit),
      include: { device: true, classroom: true },
    });

    res.json(readings);
  } catch (error) {
    console.error('Get air quality error:', error);
    res.status(500).json({ error: 'Failed to fetch air quality readings' });
  }
});

// Get air quality by room
router.get('/rooms', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);
    let classroomFilter: string[] | undefined;
    if (req.user?.role === UserRole.TEACHER) {
      classroomFilter = await getTeacherClassroomIds(req.user.id);
      if (!classroomFilter.length) {
        return res.json([]);
      }
    }

    const rooms = await prisma.airQuality.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        ...(classroomFilter ? { classroomId: { in: classroomFilter } } : {}),
      },
      distinct: ['room'],
      select: { room: true },
    });

    const roomsData = await Promise.all(
      rooms.map(async ({ room }) => {
        const latestReading = await prisma.airQuality.findFirst({
          where: {
            room,
            ...(schoolId ? { schoolId } : {}),
            ...(classroomFilter ? { classroomId: { in: classroomFilter } } : {}),
          },
          orderBy: { timestamp: 'desc' },
          include: { device: true, classroom: true },
        });

        const avgReadings = await prisma.airQuality.aggregate({
          where: {
            room,
            ...(schoolId ? { schoolId } : {}),
            ...(classroomFilter ? { classroomId: { in: classroomFilter } } : {}),
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
          _avg: {
            pm25: true,
            co2: true,
            temperature: true,
            humidity: true,
          },
        });

        const quality = latestReading
          ? latestReading.pm25 < 35 && latestReading.co2 < 750
            ? 'Good'
            : latestReading.pm25 < 55 && latestReading.co2 < 1000
              ? 'Moderate'
              : 'Poor'
          : 'Unknown';

        return {
          name: room,
          quality,
          latest: latestReading
            ? {
                pm25: +latestReading.pm25.toFixed(1),
                co2: Math.round(latestReading.co2),
                temp: +latestReading.temperature.toFixed(1),
                humidity: +latestReading.humidity.toFixed(0),
                timestamp: latestReading.timestamp,
              }
            : null,
          average24h: {
            pm25: avgReadings._avg.pm25 ? +avgReadings._avg.pm25.toFixed(1) : 0,
            co2: avgReadings._avg.co2 ? Math.round(avgReadings._avg.co2) : 0,
            temp: avgReadings._avg.temperature ? +avgReadings._avg.temperature.toFixed(1) : 0,
            humidity: avgReadings._avg.humidity ? +avgReadings._avg.humidity.toFixed(0) : 0,
          },
        };
      })
    );

    res.json(roomsData);
  } catch (error) {
    console.error('Get rooms air quality error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms air quality' });
  }
});

// Record air quality reading (from ESP32)
router.post(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.STAFF),
  [
    body('deviceId').notEmpty().withMessage('Device ID is required'),
    body('room').notEmpty().withMessage('Room is required'),
    body('pm25').isFloat({ min: 0 }).withMessage('PM2.5 must be a positive number'),
    body('co2').isInt({ min: 0 }).withMessage('CO2 must be a positive integer'),
    body('temperature').isFloat().withMessage('Temperature must be a number'),
    body('humidity').isFloat({ min: 0, max: 100 }).withMessage('Humidity must be between 0 and 100'),
    validate,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { deviceId, room, pm25, co2, temperature, humidity } = req.body;

      const device = await prisma.device.findUnique({
        where: { deviceId },
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      if (req.user?.role !== UserRole.PLATFORM_ADMIN) {
        const schoolId = req.user?.schoolId;
        if (!schoolId || schoolId !== device.schoolId) {
          return res.status(403).json({ error: 'Device belongs to another school' });
        }
      }

      const reading = await prisma.airQuality.create({
        data: {
          deviceId: device.id,
          schoolId: device.schoolId,
          classroomId: device.classroomId,
          room,
          pm25,
          co2,
          temperature,
          humidity,
        },
      });

      // Check for threshold violations and create alerts
      const alerts = [];
      
      if (co2 > 800) {
        alerts.push({
          type: AlertType.AIR_QUALITY,
          severity: co2 > 1000 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          message: `${room} CO₂ level ${co2 > 1000 ? 'critical' : 'exceeded threshold'} (${co2} ppm)`,
          room,
          metric: 'CO₂',
          value: `${co2} ppm`,
          threshold: '800 ppm',
        });
      }

      if (pm25 > 50) {
        alerts.push({
          type: AlertType.AIR_QUALITY,
          severity: pm25 > 75 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          message: `${room} PM2.5 level ${pm25 > 75 ? 'critical' : 'exceeded threshold'} (${pm25.toFixed(1)} µg/m³)`,
          room,
          metric: 'PM2.5',
          value: `${pm25.toFixed(1)} µg/m³`,
          threshold: '50 µg/m³',
        });
      }

      if (alerts.length > 0) {
        await prisma.alert.createMany({
          data: alerts.map((alert) => ({ ...alert, schoolId: device.schoolId })),
        });
      }

      res.status(201).json(reading);
    } catch (error) {
      console.error('Record air quality error:', error);
      res.status(500).json({ error: 'Failed to record air quality' });
    }
  }
);

// Record air quality reading using device token (ESP32)
router.post(
  '/device',
  [
    authenticateDeviceSecret,
    body('room').optional().isString().withMessage('Room must be a string'),
    body('pm25').isFloat({ min: 0 }).withMessage('PM2.5 must be a positive number'),
    body('co2').isInt({ min: 0 }).withMessage('CO2 must be a positive integer'),
    body('temperature').isFloat().withMessage('Temperature must be a number'),
    body('humidity').isFloat({ min: 0, max: 100 }).withMessage('Humidity must be between 0 and 100'),
    validate,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { room, pm25, co2, temperature, humidity } = req.body;
      const deviceRecord = req.deviceRecord;

      if (!deviceRecord) {
        return res.status(404).json({ error: 'Device not registered' });
      }

      const device = await prisma.device.findUnique({
        where: { id: deviceRecord.id },
        include: { classroom: true },
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not registered' });
      }

      const derivedRoom = typeof room === 'string' && room.trim().length
        ? room.trim()
        : device.classroom?.name || device.location || 'Unassigned';

      const reading = await prisma.airQuality.create({
        data: {
          deviceId: device.id,
          schoolId: device.schoolId,
          classroomId: device.classroomId,
          room: derivedRoom,
          pm25,
          co2,
          temperature,
          humidity,
        },
      });

      const alerts = [] as any[];
      if (co2 > 800) {
        alerts.push({
          type: AlertType.AIR_QUALITY,
          severity: co2 > 1000 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          message: `${room} CO₂ level ${co2 > 1000 ? 'critical' : 'exceeded threshold'} (${co2} ppm)`,
          room,
          metric: 'CO₂',
          value: `${co2} ppm`,
          threshold: '800 ppm',
        });
      }
      if (pm25 > 50) {
        alerts.push({
          type: AlertType.AIR_QUALITY,
          severity: pm25 > 75 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          message: `${room} PM2.5 level ${pm25 > 75 ? 'critical' : 'exceeded threshold'} (${pm25.toFixed(1)} µg/m³)`,
          room,
          metric: 'PM2.5',
          value: `${pm25.toFixed(1)} µg/m³`,
          threshold: '50 µg/m³',
        });
      }
      if (alerts.length > 0) {
        await prisma.alert.createMany({
          data: alerts.map((alert) => ({ ...alert, schoolId: device.schoolId })),
        });
      }

      res.status(201).json(reading);
    } catch (error) {
      console.error('Record air quality (device) error:', error);
      res.status(500).json({ error: 'Failed to record air quality' });
    }
  }
);

// Get air quality statistics
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
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

    const stats = await prisma.airQuality.aggregate({
      where,
      _avg: {
        pm25: true,
        co2: true,
        temperature: true,
        humidity: true,
      },
      _max: {
        pm25: true,
        co2: true,
        temperature: true,
      },
      _min: {
        pm25: true,
        co2: true,
        temperature: true,
      },
    });

    res.json({
      average: {
        pm25: stats._avg.pm25 ? +stats._avg.pm25.toFixed(1) : 0,
        co2: stats._avg.co2 ? Math.round(stats._avg.co2) : 0,
        temperature: stats._avg.temperature ? +stats._avg.temperature.toFixed(1) : 0,
        humidity: stats._avg.humidity ? +stats._avg.humidity.toFixed(0) : 0,
      },
      max: {
        pm25: stats._max.pm25 ? +stats._max.pm25.toFixed(1) : 0,
        co2: stats._max.co2 || 0,
        temperature: stats._max.temperature ? +stats._max.temperature.toFixed(1) : 0,
      },
      min: {
        pm25: stats._min.pm25 ? +stats._min.pm25.toFixed(1) : 0,
        co2: stats._min.co2 || 0,
        temperature: stats._min.temperature ? +stats._min.temperature.toFixed(1) : 0,
      },
    });
  } catch (error) {
    console.error('Air quality stats error:', error);
    res.status(500).json({ error: 'Failed to fetch air quality statistics' });
  }
});

export default router;

