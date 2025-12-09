import { Router, Response } from 'express';
import { body } from 'express-validator';
import { UserRole } from '@prisma/client';
import prisma from '../config/database';
import { authenticateToken, authenticateDeviceSecret, AuthRequest, authorizeRoles } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getEffectiveSchoolId, getTeacherClassroomIds } from '../utils/tenant';

const router = Router();

const getDayBounds = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const dedupeDailyAttendance = <T extends { studentId: string }>(records: T[]): T[] => {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i];
    if (seen.has(record.studentId)) {
      continue;
    }
    seen.add(record.studentId);
    unique.push(record);
  }
  return unique.reverse();
};

// Get attendance records
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { date, class: className, classroomId } = req.query;
    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);

    const where: any = {};
    if (schoolId) {
      where.schoolId = schoolId;
    }

    if (date) {
      const targetDate = new Date(date as string);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      where.checkInTime = {
        gte: targetDate,
        lt: nextDay,
      };
    }

    let classroomFilter: string[] | undefined;
    if (classroomId) {
      classroomFilter = [classroomId as string];
    }

    if (className && className !== 'all') {
      where.student = { class: className as string };
    }

    if (req.user?.role === UserRole.TEACHER) {
      const assignments = await getTeacherClassroomIds(req.user.id);
      if (assignments.length === 0) {
        return res.json([]);
      }
      classroomFilter = classroomFilter
        ? classroomFilter.filter((id) => assignments.includes(id))
        : assignments;
      if (classroomFilter.length === 0) {
        return res.json([]);
      }
    }

    if (classroomFilter && classroomFilter.length > 0) {
      where.classroomId = classroomFilter.length === 1 ? classroomFilter[0] : { in: classroomFilter };
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

    const responsePayload = date ? dedupeDailyAttendance(attendances) : attendances;

    res.json(responsePayload);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// Record attendance (from ESP32)
router.post(
  '/',
  authenticateToken,
  authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.STAFF, UserRole.TEACHER),
  [
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('deviceId').notEmpty().withMessage('Device ID is required'),
    body('fingerprintMatch').isBoolean().withMessage('Fingerprint match must be boolean'),
    validate,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, deviceId, fingerprintMatch, reliability } = req.body;

      // Find student
      const student = await prisma.student.findUnique({
        where: { studentId },
        include: { classroom: true },
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      if (req.user?.role !== UserRole.PLATFORM_ADMIN) {
        const schoolId = req.user?.schoolId;
        if (!schoolId || schoolId !== student.schoolId) {
          return res.status(403).json({ error: 'Student belongs to another school' });
        }
      }

      if (req.user?.role === UserRole.TEACHER) {
        const assignments = await getTeacherClassroomIds(req.user.id);
        if (student.classroomId && !assignments.includes(student.classroomId)) {
          return res.status(403).json({ error: 'Teacher is not assigned to this class' });
        }
      }

      // Find device
      const device = await prisma.device.findUnique({
        where: { deviceId },
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      if (device.schoolId !== student.schoolId) {
        return res.status(400).json({ error: 'Device is not mapped to the same school as the student' });
      }

      // Determine status based on time
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const timeInMinutes = hour * 60 + minute;
      const cutoffTime = 8 * 60 + 30; // 8:30 AM

      const status = timeInMinutes <= cutoffTime ? 'PRESENT' : 'LATE';

      const { start: dayStart, end: dayEnd } = getDayBounds(now);
      const existingAttendance = await prisma.attendance.findFirst({
        where: {
          studentId: student.id,
          checkInTime: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
        include: {
          student: true,
          classroom: true,
        },
        orderBy: { checkInTime: 'asc' },
      });

      if (existingAttendance) {
        return res.status(200).json(existingAttendance);
      }

      // Create attendance record
      const attendance = await prisma.attendance.create({
        data: {
          studentId: student.id,
          deviceId: device.id,
          schoolId: student.schoolId,
          classroomId: student.classroomId,
          teacherId: req.user?.role === UserRole.TEACHER ? req.user.id : undefined,
          checkInTime: now,
          status,
          fingerprintMatch,
          reliability: reliability || 98,
        },
        include: {
          student: true,
          classroom: true,
        },
      });

      res.status(201).json(attendance);
    } catch (error) {
      console.error('Record attendance error:', error);
      res.status(500).json({ error: 'Failed to record attendance' });
    }
  }
);

// Record attendance using device token (ESP32)
router.post(
  '/device',
  [
    authenticateDeviceSecret,
    body('studentId').optional().isString().withMessage('Student ID must be a string'),
    body('fingerprintId').optional().isInt({ min: 1 }).withMessage('Fingerprint ID must be a positive integer'),
    body('fingerprintMatch').isBoolean().withMessage('Fingerprint match must be boolean'),
    validate,
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, fingerprintId, fingerprintMatch, reliability } = req.body;
      const device = req.deviceRecord;

      if (!device) {
        return res.status(404).json({ error: 'Device not registered' });
      }

      const normalizedFingerprintId =
        typeof fingerprintId === 'number'
          ? String(fingerprintId)
          : typeof fingerprintId === 'string'
            ? fingerprintId.trim()
            : undefined;

      if (!studentId && !normalizedFingerprintId) {
        return res.status(400).json({ error: 'studentId or fingerprintId is required' });
      }

      const student = studentId
        ? await prisma.student.findUnique({ where: { studentId }, include: { classroom: true } })
        : await prisma.student.findFirst({ where: { fingerprintData: normalizedFingerprintId! }, include: { classroom: true } });

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      if (device.schoolId !== student.schoolId) {
        return res.status(400).json({ error: 'Device is not mapped to the same school as the student' });
      }

      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const timeInMinutes = hour * 60 + minute;
      const cutoffTime = 8 * 60 + 30; // 8:30 AM
      const status = timeInMinutes <= cutoffTime ? 'PRESENT' : 'LATE';

      const { start: dayStart, end: dayEnd } = getDayBounds(now);
      const existingAttendance = await prisma.attendance.findFirst({
        where: {
          studentId: student.id,
          checkInTime: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
        include: { student: true, classroom: true },
        orderBy: { checkInTime: 'asc' },
      });

      if (existingAttendance) {
        return res.status(200).json(existingAttendance);
      }

      const attendance = await prisma.attendance.create({
        data: {
          studentId: student.id,
          deviceId: device.id,
          schoolId: student.schoolId,
          classroomId: student.classroomId,
          checkInTime: now,
          status,
          fingerprintMatch,
          reliability: reliability || 98,
        },
        include: { student: true, classroom: true },
      });

      res.status(201).json(attendance);
    } catch (error) {
      console.error('Record attendance (device) error:', error);
      res.status(500).json({ error: 'Failed to record attendance' });
    }
  }
);

// Get attendance statistics
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
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

    if (req.user?.role === UserRole.TEACHER) {
      const assignments = await getTeacherClassroomIds(req.user.id);
      if (!assignments.length) {
        return res.json({ total: 0, present: 0, absent: 0, late: 0, presentRate: '0.0' });
      }
      where.classroomId = { in: assignments };
    }

    const [total, present, absent, late] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.count({ where: { ...where, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { ...where, status: 'ABSENT' } }),
      prisma.attendance.count({ where: { ...where, status: 'LATE' } }),
    ]);

    res.json({
      total,
      present,
      absent,
      late,
      presentRate: total > 0 ? ((present / total) * 100).toFixed(1) : '0.0',
    });
  } catch (error) {
    console.error('Attendance stats error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance statistics' });
  }
});

// Get student attendance history
router.get('/student/:studentId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const { limit = 10 } = req.query;

    const student = await prisma.student.findUnique({
      where: { studentId },
      select: { id: true, schoolId: true, classroomId: true },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined);
    if (schoolId && schoolId !== student.schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
      return res.status(403).json({ error: 'Student belongs to another school' });
    }

    if (req.user?.role === UserRole.TEACHER) {
      const assignments = await getTeacherClassroomIds(req.user.id);
      if (student.classroomId && !assignments.includes(student.classroomId)) {
        return res.status(403).json({ error: 'Student belongs to another classroom' });
      }
    }

    const attendances = await prisma.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { checkInTime: 'desc' },
      take: Number(limit),
      include: { device: true, classroom: true },
    });

    res.json(attendances);
  } catch (error) {
    console.error('Student attendance history error:', error);
    res.status(500).json({ error: 'Failed to fetch student attendance history' });
  }
});

export default router;

