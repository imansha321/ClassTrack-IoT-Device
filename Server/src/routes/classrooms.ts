import { Router, Response } from 'express';
import { body } from 'express-validator';
import { UserRole } from '@prisma/client';
import prisma from '../config/database';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getEffectiveSchoolId, getTeacherClassroomIds } from '../utils/tenant';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);
    const where: any = schoolId ? { schoolId } : {};

    if (req.user?.role !== UserRole.PLATFORM_ADMIN && !schoolId) {
      return res.status(400).json({ error: 'School context is required' });
    }

    if (req.user?.role === UserRole.TEACHER) {
      const assignments = await getTeacherClassroomIds(req.user.id);
      if (!assignments.length) {
        return res.json([]);
      }
      where.id = { in: assignments };
    }

    const classrooms = await prisma.classroom.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        teachers: {
          include: {
            teacher: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        _count: {
          select: { students: true, devices: true },
        },
      },
    });

    res.json(classrooms);
  } catch (error) {
    console.error('List classrooms error:', error);
    res.status(500).json({ error: 'Failed to fetch classrooms' });
  }
});

router.post(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  [
    body('name').notEmpty().withMessage('Classroom name is required'),
    body('grade').optional().isString(),
    body('section').optional().isString(),
    body('capacity').optional().isInt({ min: 1 }),
    validate,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const schoolId = getEffectiveSchoolId(req, req.body.schoolId);
      if (!schoolId) {
        return res.status(400).json({ error: 'School context is required' });
      }

      const classroom = await prisma.classroom.create({
        data: {
          name: req.body.name,
          grade: req.body.grade,
          section: req.body.section,
          capacity: req.body.capacity,
          schoolId,
        },
      });

      res.status(201).json(classroom);
    } catch (error) {
      console.error('Create classroom error:', error);
      res.status(500).json({ error: 'Failed to create classroom' });
    }
  }
);

router.get(
  '/teachers',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);
      if (req.user?.role !== UserRole.PLATFORM_ADMIN && !schoolId) {
        return res.status(400).json({ error: 'School context is required' });
      }

      const teachers = await prisma.user.findMany({
        where: {
          role: UserRole.TEACHER,
          ...(schoolId ? { schoolId } : {}),
        },
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: 'asc' },
      });

      res.json(teachers);
    } catch (error) {
      console.error('List school teachers error:', error);
      res.status(500).json({ error: 'Failed to fetch teachers' });
    }
  }
);

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const classroom = await prisma.classroom.findUnique({
      where: { id },
      include: {
        teachers: {
          include: { teacher: { select: { id: true, fullName: true, email: true } } },
        },
        students: true,
        devices: true,
      },
    });

    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);
    if (schoolId && classroom.schoolId !== schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
      return res.status(403).json({ error: 'Classroom belongs to another school' });
    }

    if (req.user?.role === UserRole.TEACHER) {
      const assignments = await getTeacherClassroomIds(req.user.id);
      if (!assignments.includes(id)) {
        return res.status(403).json({ error: 'Teacher is not assigned to this classroom' });
      }
    }

    res.json(classroom);
  } catch (error) {
    console.error('Get classroom error:', error);
    res.status(500).json({ error: 'Failed to fetch classroom' });
  }
});

router.patch(
  '/:id',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const schoolId = getEffectiveSchoolId(req, req.body.schoolId);
      if (!schoolId) {
        return res.status(400).json({ error: 'School context is required' });
      }

      const classroom = await prisma.classroom.findUnique({ where: { id } });
      if (!classroom) {
        return res.status(404).json({ error: 'Classroom not found' });
      }
      if (classroom.schoolId !== schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
        return res.status(403).json({ error: 'Classroom belongs to another school' });
      }

      const { name, grade, section, capacity } = req.body;

      const updated = await prisma.classroom.update({
        where: { id },
        data: {
          name,
          grade,
          section,
          capacity,
        },
      });

      res.json(updated);
    } catch (error) {
      console.error('Update classroom error:', error);
      res.status(500).json({ error: 'Failed to update classroom' });
    }
  }
);

router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);

      const classroom = await prisma.classroom.findUnique({ where: { id } });
      if (!classroom) {
        return res.status(404).json({ error: 'Classroom not found' });
      }
      if (schoolId && classroom.schoolId !== schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
        return res.status(403).json({ error: 'Classroom belongs to another school' });
      }

      await prisma.classroom.delete({ where: { id } });
      res.json({ message: 'Classroom deleted successfully' });
    } catch (error) {
      console.error('Delete classroom error:', error);
      res.status(500).json({ error: 'Failed to delete classroom' });
    }
  }
);

router.post(
  '/:id/teachers',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  [body('teacherId').notEmpty().withMessage('Teacher ID is required'), validate],
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { teacherId } = req.body;
      const classroom = await prisma.classroom.findUnique({ where: { id } });
      if (!classroom) {
        return res.status(404).json({ error: 'Classroom not found' });
      }

      const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
      if (!teacher || teacher.role !== UserRole.TEACHER) {
        return res.status(400).json({ error: 'Teacher not found or invalid role' });
      }
      if (teacher.schoolId !== classroom.schoolId) {
        return res.status(403).json({ error: 'Teacher belongs to another school' });
      }

      const assignment = await prisma.teacherClassAssignment.upsert({
        where: { teacherId_classroomId: { teacherId, classroomId: id } },
        update: {},
        create: {
          teacherId,
          classroomId: id,
          schoolId: classroom.schoolId,
        },
      });

      res.json(assignment);
    } catch (error) {
      console.error('Assign teacher error:', error);
      res.status(500).json({ error: 'Failed to assign teacher' });
    }
  }
);

router.delete(
  '/:id/teachers/:teacherId',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id, teacherId } = req.params;
      await prisma.teacherClassAssignment.deleteMany({
        where: { classroomId: id, teacherId },
      });
      res.json({ message: 'Teacher unassigned successfully' });
    } catch (error) {
      console.error('Remove teacher error:', error);
      res.status(500).json({ error: 'Failed to remove teacher from classroom' });
    }
  }
);

export default router;
