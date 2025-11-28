import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import prisma from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Get all devices
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status.toString().toUpperCase();
    }

    const devices = await prisma.device.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
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
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({
      where: { id },
      include: {
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
  [
    body('deviceId').notEmpty().withMessage('Device ID is required'),
    body('name').notEmpty().withMessage('Name is required'),
    body('type').isIn(['FINGERPRINT_SCANNER', 'MULTI_SENSOR', 'AIR_QUALITY_SENSOR']).withMessage('Invalid device type'),
    body('location').notEmpty().withMessage('Location is required'),
    validate,
  ],
  async (req: Request, res: Response) => {
    try {
      const { deviceId, name, type, location, firmwareVersion } = req.body;

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
          firmwareVersion: firmwareVersion || 'v2.1.3',
        },
      });

      res.status(201).json(device);
    } catch (error) {
      console.error('Create device error:', error);
      res.status(500).json({ error: 'Failed to create device' });
    }
  }
);

// Update device
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, location, status, battery, signal, firmwareVersion } = req.body;

    const device = await prisma.device.update({
      where: { id },
      data: {
        name,
        location,
        status,
        battery,
        signal,
        firmwareVersion,
        lastSeen: new Date(),
      },
    });

    res.json(device);
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

// Update device status (from ESP32)
router.post(
  '/status',
  [
    body('deviceId').notEmpty().withMessage('Device ID is required'),
    body('battery').isInt({ min: 0, max: 100 }).withMessage('Battery must be between 0 and 100'),
    body('signal').isInt({ min: 0, max: 100 }).withMessage('Signal must be between 0 and 100'),
    validate,
  ],
  async (req: Request, res: Response) => {
    try {
      const { deviceId, battery, signal, uptime } = req.body;

      const device = await prisma.device.findUnique({
        where: { deviceId },
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const updated = await prisma.device.update({
        where: { deviceId },
        data: {
          battery,
          signal,
          uptime,
          status: 'ONLINE',
          lastSeen: new Date(),
        },
      });

      res.json(updated);
    } catch (error) {
      console.error('Update device status error:', error);
      res.status(500).json({ error: 'Failed to update device status' });
    }
  }
);

// Delete device
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.device.delete({ where: { id } });

    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

export default router;

