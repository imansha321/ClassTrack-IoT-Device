import { UserRole } from '@prisma/client';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getEffectiveSchoolId = (
  req: AuthRequest,
  requestedSchoolId?: string | null
): string | undefined => {
  if (req.user?.role === UserRole.PLATFORM_ADMIN) {
    return requestedSchoolId || (req.query.schoolId as string | undefined);
  }
  if (!req.user?.schoolId) {
    throw new Error('School context is required for this operation');
  }
  return req.user.schoolId;
};

export const getTeacherClassroomIds = async (teacherId: string): Promise<string[]> => {
  const assignments = await prisma.teacherClassAssignment.findMany({
    where: { teacherId },
    select: { classroomId: true },
  });
  return assignments.map((assignment) => assignment.classroomId);
};

export const ensureClassroomInSchool = async (classroomId: string, schoolId: string) => {
  if (!classroomId) return;
  const classroom = await prisma.classroom.findFirst({
    where: {
      id: classroomId,
      schoolId,
    },
    select: { id: true },
  });

  if (!classroom) {
    throw new Error('Classroom does not belong to the selected school');
  }
};
