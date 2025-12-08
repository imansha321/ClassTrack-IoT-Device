import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { getEffectiveSchoolId } from '../utils/tenant';

const router = Router();

// Get all alerts
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { resolved, severity, type } = req.query;
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);
    
    const where: any = {};
    if (schoolId) {
      where.schoolId = schoolId;
    }
    
    if (resolved !== undefined) {
      where.resolved = resolved === 'true';
    }
    
    if (severity) {
      where.severity = severity.toString().toUpperCase();
    }
    
    if (type) {
      where.type = type.toString().toUpperCase();
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(alerts);
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Mark alert as resolved
router.patch(
  '/:id/resolve',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.STAFF),
  async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);

    const alertRecord = await prisma.alert.findUnique({ where: { id } });
    if (!alertRecord) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    if (schoolId && alertRecord.schoolId !== schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
      return res.status(403).json({ error: 'Alert belongs to another school' });
    }

    const alert = await prisma.alert.update({
      where: { id },
      data: { resolved: true },
    });

    res.json(alert);
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
  }
);

// Delete alert
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);

      const alertRecord = await prisma.alert.findUnique({ where: { id } });
      if (!alertRecord) {
        return res.status(404).json({ error: 'Alert not found' });
      }
      if (schoolId && alertRecord.schoolId !== schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
        return res.status(403).json({ error: 'Alert belongs to another school' });
      }

      await prisma.alert.delete({ where: { id } });

      res.json({ message: 'Alert deleted successfully' });
    } catch (error) {
      console.error('Delete alert error:', error);
      res.status(500).json({ error: 'Failed to delete alert' });
    }
  }
);

export default router;

