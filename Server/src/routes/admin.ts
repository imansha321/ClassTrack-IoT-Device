import { Router, Response } from 'express';
import { body } from 'express-validator';
import prisma from '../config/database';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { UserRole } from '@prisma/client';

const router = Router();

// Platform overview
router.get('/overview', authenticateToken, authorizeRoles(UserRole.PLATFORM_ADMIN), async (_req, res) => {
  try {
    const [schools, devicesOnline, totalUsers, recentLogs] = await Promise.all([
      prisma.school.count(),
      prisma.device.count({ where: { status: 'ONLINE' } }),
      prisma.user.count(),
      prisma.systemLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { school: true },
      }),
    ]);

    res.json({
      schools,
      devicesOnline,
      totalUsers,
      recentLogs,
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to load system overview' });
  }
});

// List users (platform admin only)
router.get('/users', authenticateToken, authorizeRoles(UserRole.PLATFORM_ADMIN), async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        school: { select: { id: true, name: true } },
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Admin list users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role (admin only)
router.patch(
  '/users/:id/role',
  authenticateToken,
  authorizeRoles(UserRole.PLATFORM_ADMIN),
  [
    body('role')
      .isIn(['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'])
      .withMessage('Role must be one of PLATFORM_ADMIN, SCHOOL_ADMIN, TEACHER, STAFF'),
    validate,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { role, schoolId } = req.body as { role: UserRole; schoolId?: string };

      const updated = await prisma.user.update({
        where: { id },
        data: { role, schoolId },
        select: { id: true, email: true, fullName: true, schoolId: true, role: true },
      });

      res.json(updated);
    } catch (error) {
      console.error('Admin update role error:', error);
      res.status(500).json({ error: 'Failed to update user role' });
    }
  }
);

// Delete user (admin only) - prevent deleting self
router.delete('/users/:id', authenticateToken, authorizeRoles(UserRole.PLATFORM_ADMIN), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const requesterId = req.user?.id;
    if (requesterId && requesterId === id) {
      return res.status(400).json({ error: "You can't delete your own account" });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Manage schools
router.get('/schools', authenticateToken, authorizeRoles(UserRole.PLATFORM_ADMIN), async (_req, res) => {
  try {
    const schools = await prisma.school.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { students: true, devices: true, users: true },
        },
      },
    });
    res.json(schools);
  } catch (error) {
    console.error('Admin schools error:', error);
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

router.post(
  '/schools',
  authenticateToken,
  authorizeRoles(UserRole.PLATFORM_ADMIN),
  [
    body('name').notEmpty().withMessage('School name is required'),
    body('code').notEmpty().withMessage('School code is required'),
    body('contactEmail').isEmail().withMessage('Valid email is required'),
    validate,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, code, contactEmail, contactPhone, address, status } = req.body;
      const school = await prisma.school.create({
        data: {
          name,
          code,
          contactEmail,
          contactPhone,
          address,
          status,
        },
      });

      await prisma.systemLog.create({
        data: {
          action: 'SCHOOL_CREATED',
          actorId: req.user?.id,
          actorRole: req.user?.role,
          schoolId: school.id,
          metadata: { code, contactEmail },
        },
      });
      res.status(201).json(school);
    } catch (error) {
      console.error('Create school error:', error);
      res.status(500).json({ error: 'Failed to create school' });
    }
  }
);

router.patch(
  '/schools/:id',
  authenticateToken,
  authorizeRoles(UserRole.PLATFORM_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const school = await prisma.school.update({
        where: { id },
        data: req.body,
      });

      await prisma.systemLog.create({
        data: {
          action: 'SCHOOL_UPDATED',
          actorId: req.user?.id,
          actorRole: req.user?.role,
          schoolId: school.id,
          metadata: req.body,
        },
      });
      res.json(school);
    } catch (error) {
      console.error('Update school error:', error);
      res.status(500).json({ error: 'Failed to update school' });
    }
  }
);

router.get('/logs', authenticateToken, authorizeRoles(UserRole.PLATFORM_ADMIN), async (_req, res) => {
  try {
    const logs = await prisma.systemLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { school: true },
    });
    res.json(logs);
  } catch (error) {
    console.error('System logs error:', error);
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
});

export default router;
