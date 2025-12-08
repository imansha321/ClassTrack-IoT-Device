import { Router, Response } from 'express';
import { body } from 'express-validator';
import { UserRole } from '@prisma/client';
import prisma from '../config/database';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ensureClassroomInSchool, getEffectiveSchoolId, getTeacherClassroomIds } from '../utils/tenant';

const router = Router();

// Get all students
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { class: className, search, classroomId } = req.query;
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);

    const where: any = {};
    if (schoolId) {
      where.schoolId = schoolId;
    }
    if (className && className !== 'all') {
      where.class = className;
    }
    if (classroomId) {
      where.classroomId = classroomId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { studentId: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (req.user?.role === UserRole.TEACHER) {
      const classroomIds = await getTeacherClassroomIds(req.user.id);
      if (classroomIds.length === 0) {
        return res.json([]);
      }
      where.classroomId = { in: classroomIds };
    }

    const students = await prisma.student.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { classroom: true },
    });

    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get student by id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: { classroom: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);
    if (schoolId && student.schoolId !== schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
      return res.status(403).json({ error: 'Student belongs to another school' });
    }

    res.json(student);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// Create student
router.post(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  [
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('name').notEmpty().withMessage('Name is required'),
    body('class').notEmpty().withMessage('Class is required'),
    body('classroomId').optional().isString(),
    validate,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, name, class: className, fingerprintData, classroomId } = req.body;
      const schoolId = getEffectiveSchoolId(req, req.body.schoolId);
      if (!schoolId) {
        return res.status(400).json({ error: 'School context is required' });
      }

      await ensureClassroomInSchool(classroomId, schoolId);

      const existing = await prisma.student.findUnique({
        where: { studentId },
      });

      if (existing) {
        return res.status(400).json({ error: 'Student ID already exists' });
      }

      const student = await prisma.student.create({
        data: {
          studentId,
          name,
          class: className,
          fingerprintData,
          classroomId,
          schoolId,
        },
        include: { classroom: true },
      });

      res.status(201).json(student);
    } catch (error) {
      console.error('Create student error:', error);
      res.status(500).json({ error: 'Failed to create student' });
    }
  }
);

// Update student
router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, class: className, fingerprintData, classroomId } = req.body;
      const schoolId = getEffectiveSchoolId(req, req.body.schoolId);
      if (!schoolId) {
        return res.status(400).json({ error: 'School context is required' });
      }

      await ensureClassroomInSchool(classroomId, schoolId);

      const existing = await prisma.student.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Student not found' });
      }
      if (existing.schoolId !== schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
        return res.status(403).json({ error: 'Cannot update student from another school' });
      }

      const student = await prisma.student.update({
        where: { id },
        data: {
          name,
          class: className,
          fingerprintData,
          classroomId,
        },
        include: { classroom: true },
      });

      res.json(student);
    } catch (error) {
      console.error('Update student error:', error);
      res.status(500).json({ error: 'Failed to update student' });
    }
  }
);

// Delete student
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);

      const student = await prisma.student.findUnique({ where: { id } });
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }
      if (schoolId && student.schoolId !== schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
        return res.status(403).json({ error: 'Cannot delete student from another school' });
      }

      await prisma.student.delete({ where: { id } });

      res.json({ message: 'Student deleted successfully' });
    } catch (error) {
      console.error('Delete student error:', error);
      res.status(500).json({ error: 'Failed to delete student' });
    }
  }
);

export default router;

