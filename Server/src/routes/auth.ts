import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import prisma from '../config/database';
import { generateToken } from '../middleware/auth';
import { validate } from '../middleware/validate';

const buildSchoolCode = (name: string) => {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().replace(/\s+/g, '-');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${normalized}-${suffix}`;
};

const router = Router();

// Public list of schools for signup selection
router.get('/schools', async (_req: Request, res: Response) => {
  try {
    const schools = await prisma.school.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json(schools);
  } catch (error) {
    console.error('List public schools error:', error);
    res.status(500).json({ error: 'Failed to load schools' });
  }
});

// Register
router.post(
  '/signup',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('schoolId').optional().isString().withMessage('Invalid school selection'),
    body('role').optional().isIn(Object.values(UserRole)).withMessage('Invalid role selection'),
    body('schoolName')
      .custom((value, { req }) => {
        if (!req.body.schoolId && !value) {
          throw new Error('School name is required when no school is selected');
        }
        return true;
      }),
    validate,
  ],
  async (req: Request, res: Response) => {
    try {
      const { email, password, fullName, schoolName, schoolId, role } = req.body as {
        email: string;
        password: string;
        fullName: string;
        schoolName?: string;
        schoolId?: string;
        role?: UserRole;
      };

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      let targetSchool = null as { id: string; name: string } | null;
      let assignedRole: UserRole = UserRole.SCHOOL_ADMIN;

      if (schoolId) {
        const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true } });
        if (!school) {
          return res.status(404).json({ error: 'School not found' });
        }
        targetSchool = school;
        const allowedRoles: UserRole[] = [UserRole.TEACHER, UserRole.STAFF];
        assignedRole = role && allowedRoles.includes(role) ? role : UserRole.TEACHER;
      } else {
        if (!schoolName) {
          return res.status(400).json({ error: 'School name is required' });
        }
        // Create school tenant
        let code = buildSchoolCode(schoolName);
        while (await prisma.school.findUnique({ where: { code } })) {
          code = buildSchoolCode(schoolName);
        }
        const school = await prisma.school.create({
          data: {
            name: schoolName,
            code,
            contactEmail: email,
          },
        });
        targetSchool = { id: school.id, name: school.name };
      }
      if (!targetSchool) {
        return res.status(400).json({ error: 'Unable to resolve school' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          fullName,
          role: assignedRole,
          schoolId: targetSchool.id,
        },
        include: { school: true },
      });

      // Generate token
      const token = generateToken({ id: user.id, email: user.email, role: user.role, schoolId: user.schoolId || undefined });

      if (schoolId) {
        await prisma.systemLog.create({
          data: {
            schoolId: targetSchool.id,
            actorId: user.id,
            actorRole: user.role,
            action: 'USER_SELF_SIGNUP',
            metadata: {
              role: user.role,
            },
          },
        });
      } else {
        await prisma.systemLog.create({
          data: {
            schoolId: targetSchool.id,
            actorId: user.id,
            actorRole: user.role,
            action: 'SCHOOL_ONBOARDED',
            metadata: {
              schoolName,
              contactEmail: email,
            },
          },
        });
      }

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          schoolId: user.schoolId,
          schoolName: user.school?.name,
          school: user.school,
        },
        token,
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Failed to create account' });
    }
  }
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
  ],
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await prisma.user.findUnique({ where: { email }, include: { school: true } });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const token = generateToken({ id: user.id, email: user.email, role: user.role as UserRole, schoolId: user.schoolId || undefined });

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        user: {
          ...userWithoutPassword,
          schoolName: user.school?.name,
        },
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

export default router;
