import { Router, Response } from 'express';
import { body } from 'express-validator';
import { UserRole } from '@prisma/client';
import prisma from '../config/database';
import { authenticateToken, authorizeRoles, AuthRequest, authenticateDeviceSecret } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ensureClassroomInSchool, getEffectiveSchoolId, getTeacherClassroomIds } from '../utils/tenant';

const router = Router();

// Get all devices
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status, classroomId } = req.query;
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);

    const where: any = {};
    if (schoolId) {
      where.schoolId = schoolId;
    }
    if (status && status !== 'all') {
      where.status = status.toString().toUpperCase();
    }

    let classroomFilter: string[] | undefined;
    if (classroomId) {
      classroomFilter = [classroomId as string];
    }

    if (req.user?.role === UserRole.TEACHER) {
      const assignments = await getTeacherClassroomIds(req.user.id);
      classroomFilter = classroomFilter
        ? classroomFilter.filter((id) => assignments.includes(id))
        : assignments;
      if (!classroomFilter || classroomFilter.length === 0) {
        return res.json([]);
      }
    }

    if (classroomFilter && classroomFilter.length > 0) {
      where.classroomId = classroomFilter.length === 1 ? classroomFilter[0] : { in: classroomFilter };
    }

    const devices = await prisma.device.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        classroom: true,
        _count: {
          select: {
            attendances: true,
            airQualityReadings: true,
          },
        },
      },
    });

    res.json(devices);
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Get device by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        classroom: true,
        attendances: {
          take: 10,
          orderBy: { checkInTime: 'desc' },
          include: { student: true },
        },
        airQualityReadings: {
          take: 24,
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);
    if (schoolId && schoolId !== device.schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
      return res.status(403).json({ error: 'Device belongs to another school' });
    }

    if (req.user?.role === UserRole.TEACHER) {
      const assignments = await getTeacherClassroomIds(req.user.id);
      if (device.classroomId && !assignments.includes(device.classroomId)) {
        return res.status(403).json({ error: 'Teacher is not assigned to this classroom' });
      }
    }

    res.json(device);
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// Create device
router.post(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  [
    body('deviceId').notEmpty().withMessage('Device ID is required'),
    body('name').notEmpty().withMessage('Name is required'),
    body('type').isIn(['FINGERPRINT_SCANNER', 'MULTI_SENSOR', 'AIR_QUALITY_SENSOR']).withMessage('Invalid device type'),
    body('location').notEmpty().withMessage('Location is required'),
    body('classroomId').optional().isString(),
    validate,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { deviceId, name, type, location, firmwareVersion, classroomId } = req.body;
      const schoolId = getEffectiveSchoolId(req, req.body.schoolId);
      if (!schoolId) {
        return res.status(400).json({ error: 'School context is required' });
      }

      await ensureClassroomInSchool(classroomId, schoolId);

      const existing = await prisma.device.findUnique({
        where: { deviceId },
      });

      if (existing) {
        return res.status(400).json({ error: 'Device ID already exists' });
      }

      const device = await prisma.device.create({
        data: {
          deviceId,
          name,
          type,
          location,
          classroomId,
          schoolId,
          firmwareVersion: firmwareVersion || 'v2.1.3',
        },
        include: { classroom: true },
      });

      res.status(201).json(device);
    } catch (error) {
      console.error('Create device error:', error);
      res.status(500).json({ error: 'Failed to create device' });
    }
  }
);

// Update device
router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
      const { name, location, status, battery, signal, firmwareVersion, classroomId } = req.body;
      const schoolId = getEffectiveSchoolId(req, req.body.schoolId);
      if (!schoolId) {
        return res.status(400).json({ error: 'School context is required' });
      }

      const existing = await prisma.device.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Device not found' });
      }
      if (existing.schoolId !== schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
        return res.status(403).json({ error: 'Device belongs to another school' });
      }

      await ensureClassroomInSchool(classroomId, schoolId);

      const device = await prisma.device.update({
        where: { id },
        data: {
          name,
          location,
          classroomId,
          status,
          battery,
          signal,
          firmwareVersion,
          lastSeen: new Date(),
        },
        include: { classroom: true },
      });

      res.json(device);
    } catch (error) {
      console.error('Update device error:', error);
      res.status(500).json({ error: 'Failed to update device' });
    }
  }
);

// Update device status (from ESP32)
router.post(
  '/status',
  authenticateDeviceSecret,
  [
    body('battery').optional().isInt({ min: 0, max: 100 }).withMessage('Battery must be between 0 and 100'),
    body('signal').optional().isInt({ min: -120, max: 0 }).withMessage('Signal (RSSI dBm) must be between -120 and 0'),
    body('classroomId').optional().isString(),
    body('location').optional().isString(),
    body('status').optional().isString(),
    body('uptime').optional().isString(),
    validate,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const device = req.deviceRecord;
      if (!device) {
        return res.status(404).json({ error: 'Device not registered' });
      }

      const { battery, signal, uptime, status, classroomId, location } = req.body;

      if (classroomId) {
        await ensureClassroomInSchool(classroomId, device.schoolId);
      }

      const updated = await prisma.device.update({
        where: { deviceId: device.deviceId },
        data: {
          battery: battery ?? device.battery,
          signal: signal ?? device.signal,
          uptime: uptime ?? device.uptime,
          status: (status || 'ONLINE').toUpperCase(),
          classroomId: classroomId || device.classroomId,
          location: location || device.location,
          lastSeen: new Date(),
        },
        include: { classroom: true },
      });

      res.json(updated);
    } catch (error) {
      console.error('Update device status error:', error);
      res.status(500).json({ error: 'Failed to update device status' });
    }
  }
);

// Provision device: user-authenticated, returns a device token for runtime
router.post(
  '/connect',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  [
    body('deviceId').notEmpty().withMessage('Device ID is required'),
    body('name').notEmpty().withMessage('Name is required'),
    body('type').isIn(['FINGERPRINT_SCANNER', 'MULTI_SENSOR', 'AIR_QUALITY_SENSOR']).withMessage('Invalid device type'),
    body('location').notEmpty().withMessage('Location is required'),
    body('classroomId').optional().isString(),
    body('firmwareVersion').optional().isString(),
    validate,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { deviceId, name, type, location, firmwareVersion, classroomId } = req.body;
      const schoolId = getEffectiveSchoolId(req, req.body.schoolId);
      if (!schoolId) {
        return res.status(400).json({ error: 'School context is required' });
      }

      await ensureClassroomInSchool(classroomId, schoolId);

      let device = await prisma.device.findUnique({
        where: { deviceId },
        include: { classroom: true },
      });
      const isNewDevice = !device;

      if (device) {
        if (device.schoolId !== schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
          return res.status(403).json({ error: 'Device belongs to another school' });
        }

        device = await prisma.device.update({
          where: { deviceId },
          data: {
            name,
            type,
            location,
            classroomId,
            firmwareVersion: firmwareVersion || device.firmwareVersion,
            status: 'OFFLINE',
          },
          include: { classroom: true },
        });
      } else {
        device = await prisma.device.create({
          data: {
            deviceId,
            name,
            type,
            location,
            classroomId,
            firmwareVersion: firmwareVersion || 'v2.1.3',
            schoolId,
            status: 'OFFLINE',
          },
          include: { classroom: true },
        });
      }

      res.status(isNewDevice ? 201 : 200).json(device);
    } catch (error) {
      console.error('Register device error:', error);
      res.status(500).json({ error: 'Failed to register device' });
    }
  }
);

// Delete device
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);

      const device = await prisma.device.findUnique({ where: { id } });
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      if (schoolId && device.schoolId !== schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
        return res.status(403).json({ error: 'Device belongs to another school' });
      }

      await prisma.device.delete({ where: { id } });

      res.json({ message: 'Device deleted successfully' });
    } catch (error) {
      console.error('Delete device error:', error);
      res.status(500).json({ error: 'Failed to delete device' });
    }
  }
);

export default router;

