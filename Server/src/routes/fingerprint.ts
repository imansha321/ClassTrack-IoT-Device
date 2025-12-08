import { Router, Response } from 'express'
import { body } from 'express-validator'
import { FingerprintEnrollmentStatus, UserRole } from '@prisma/client'
import prisma from '../config/database'
import {
	authenticateDeviceToken,
	authenticateToken,
	authorizeRoles,
	type AuthRequest,
} from '../middleware/auth'
import { validate } from '../middleware/validate'
import { ensureClassroomInSchool, getEffectiveSchoolId, getTeacherClassroomIds } from '../utils/tenant'

const router = Router()

const enrollmentIncludes = {
	student: { select: { id: true, studentId: true, name: true, class: true, classroomId: true } },
	classroom: { select: { id: true, name: true, grade: true, section: true } },
	device: { select: { id: true, deviceId: true, name: true, classroomId: true } },
}

const statusSet = new Set(Object.values(FingerprintEnrollmentStatus))

router.post(
	'/enrollments',
	authenticateToken,
	authorizeRoles(UserRole.SCHOOL_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.TEACHER),
	[
		body('studentId').notEmpty().withMessage('studentId is required'),
		body('classroomId').optional().isString(),
		body('deviceId').optional().isString(),
		validate,
	],
	async (req: AuthRequest, res: Response) => {
		try {
			const { studentId, classroomId, deviceId } = req.body as { studentId: string; classroomId?: string; deviceId?: string }

			const student = await prisma.student.findUnique({
				where: { id: studentId },
				select: { id: true, schoolId: true, classroomId: true },
			})
			if (!student) {
				return res.status(404).json({ error: 'Student not found' })
			}

			const schoolId = student.schoolId
			if (req.user?.role !== UserRole.PLATFORM_ADMIN && req.user?.schoolId !== schoolId) {
				return res.status(403).json({ error: 'Student belongs to another school' })
			}

			const resolvedClassroomId = classroomId || student.classroomId
			if (!resolvedClassroomId) {
				return res.status(400).json({ error: 'Classroom is required for fingerprint enrollment' })
			}
			await ensureClassroomInSchool(resolvedClassroomId, schoolId)

			if (req.user?.role === UserRole.TEACHER) {
				const allowed = await getTeacherClassroomIds(req.user.id)
				if (!allowed.includes(resolvedClassroomId)) {
					return res.status(403).json({ error: 'Teacher is not assigned to this classroom' })
				}
			}

			let resolvedDeviceId: string | undefined
			if (deviceId) {
				let device = await prisma.device.findUnique({ where: { id: deviceId } })
				if (!device) {
					device = await prisma.device.findUnique({ where: { deviceId } })
				}
				if (!device || device.schoolId !== schoolId) {
					return res.status(400).json({ error: 'Device not found for this school' })
				}
				if (device.classroomId && device.classroomId !== resolvedClassroomId) {
					return res.status(400).json({ error: 'Device is mapped to another classroom' })
				}
				resolvedDeviceId = device.id
			}

			const existing = await prisma.fingerprintEnrollment.findFirst({
				where: {
					studentId: student.id,
					status: { in: [FingerprintEnrollmentStatus.PENDING, FingerprintEnrollmentStatus.CAPTURING] },
				},
				include: enrollmentIncludes,
			})
			if (existing) {
				return res.json(existing)
			}

			const enrollment = await prisma.fingerprintEnrollment.create({
				data: {
					studentId: student.id,
					schoolId,
					classroomId: resolvedClassroomId,
					deviceId: resolvedDeviceId,
					status: FingerprintEnrollmentStatus.PENDING,
					requestedBy: req.user?.id,
				},
				include: enrollmentIncludes,
			})

			return res.status(201).json(enrollment)
		} catch (error) {
			console.error('Create fingerprint enrollment error:', error)
			return res.status(500).json({ error: 'Failed to request fingerprint enrollment' })
		}
	}
)

router.get('/enrollments', authenticateToken, async (req: AuthRequest, res: Response) => {
	try {
		const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined)
		const { status, classroomId, studentId, limit = '20' } = req.query

		const where: any = { schoolId }
		if (status && typeof status === 'string') {
			const normalized = status.toUpperCase() as FingerprintEnrollmentStatus
			if (statusSet.has(normalized)) {
				where.status = normalized
			}
		}
		if (classroomId && typeof classroomId === 'string') {
			where.classroomId = classroomId
		}
		if (studentId && typeof studentId === 'string') {
			where.studentId = studentId
		}

		if (req.user?.role === UserRole.TEACHER) {
			const allowed = await getTeacherClassroomIds(req.user.id)
			if (!allowed.length) {
				return res.json([])
			}
			if (typeof where.classroomId === 'string') {
				if (!allowed.includes(where.classroomId)) {
					return res.json([])
				}
			} else {
				where.classroomId = { in: allowed }
			}
		}

		const enrollments = await prisma.fingerprintEnrollment.findMany({
			where,
			orderBy: { createdAt: 'desc' },
			take: Number(limit) || 20,
			include: enrollmentIncludes,
		})

		return res.json(enrollments)
	} catch (error) {
		console.error('List fingerprint enrollments error:', error)
		return res.status(500).json({ error: 'Failed to fetch fingerprint enrollments' })
	}
})

router.get('/enrollments/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params
		const enrollment = await prisma.fingerprintEnrollment.findUnique({
			where: { id },
			include: enrollmentIncludes,
		})

		if (!enrollment) {
			return res.status(404).json({ error: 'Enrollment not found' })
		}

		const schoolId = getEffectiveSchoolId(req, req.query.schoolId as string | undefined)
		if (enrollment.schoolId !== schoolId && req.user?.role !== UserRole.PLATFORM_ADMIN) {
			return res.status(403).json({ error: 'Enrollment belongs to another school' })
		}

		if (req.user?.role === UserRole.TEACHER) {
			const allowed = await getTeacherClassroomIds(req.user.id)
			if (enrollment.classroomId && !allowed.includes(enrollment.classroomId)) {
				return res.status(403).json({ error: 'Teacher is not assigned to this classroom' })
			}
		}

		return res.json(enrollment)
	} catch (error) {
		console.error('Get fingerprint enrollment error:', error)
		return res.status(500).json({ error: 'Failed to fetch enrollment' })
	}
})

router.post('/device/next', authenticateDeviceToken, async (req: AuthRequest, res: Response) => {
	try {
		const tokenDeviceId = req.device?.deviceId
		if (!tokenDeviceId) {
			return res.status(401).json({ error: 'Device token missing deviceId' })
		}

		const device = await prisma.device.findUnique({ where: { deviceId: tokenDeviceId } })
		if (!device) {
			return res.status(404).json({ error: 'Device not registered' })
		}

		const where: any = {
			schoolId: device.schoolId,
			status: FingerprintEnrollmentStatus.PENDING,
		}
		if (device.classroomId) {
			where.classroomId = device.classroomId
		}

		const enrollment = await prisma.fingerprintEnrollment.findFirst({
			where,
			orderBy: { createdAt: 'asc' },
			include: enrollmentIncludes,
		})

		if (!enrollment) {
			return res.json(null)
		}

		const updated = await prisma.fingerprintEnrollment.update({
			where: { id: enrollment.id },
			data: {
				status: FingerprintEnrollmentStatus.CAPTURING,
				deviceId: device.id,
			},
			include: enrollmentIncludes,
		})

		return res.json(updated)
	} catch (error) {
		console.error('Device fingerprint next error:', error)
		return res.status(500).json({ error: 'Failed to fetch enrollment for device' })
	}
})

router.post(
	'/device/:id/complete',
	authenticateDeviceToken,
	[body('template').notEmpty().withMessage('Fingerprint template is required'), validate],
	async (req: AuthRequest, res: Response) => {
		try {
			const tokenDeviceId = req.device?.deviceId
			if (!tokenDeviceId) {
				return res.status(401).json({ error: 'Device token missing deviceId' })
			}

			const device = await prisma.device.findUnique({ where: { deviceId: tokenDeviceId } })
			if (!device) {
				return res.status(404).json({ error: 'Device not registered' })
			}

			const enrollment = await prisma.fingerprintEnrollment.findUnique({
				where: { id: req.params.id },
				include: { student: true },
			})
			if (!enrollment) {
				return res.status(404).json({ error: 'Enrollment not found' })
			}

			if (enrollment.schoolId !== device.schoolId) {
				return res.status(403).json({ error: 'Enrollment belongs to another school' })
			}

			if (enrollment.deviceId && enrollment.deviceId !== device.id) {
				return res.status(403).json({ error: 'Enrollment is locked by another device' })
			}

			const template = req.body.template as string

			const [updatedEnrollment] = await prisma.$transaction([
				prisma.fingerprintEnrollment.update({
					where: { id: enrollment.id },
					data: {
						status: FingerprintEnrollmentStatus.COMPLETED,
						template,
						deviceId: device.id,
						completedAt: new Date(),
					},
					include: enrollmentIncludes,
				}),
				prisma.student.update({
					where: { id: enrollment.studentId },
					data: { fingerprintData: template },
				}),
			])

			return res.json(updatedEnrollment)
		} catch (error) {
			console.error('Complete fingerprint enrollment error:', error)
			return res.status(500).json({ error: 'Failed to complete enrollment' })
		}
	}
)

router.post(
	'/device/:id/fail',
	authenticateDeviceToken,
	[body('reason').optional().isString(), validate],
	async (req: AuthRequest, res: Response) => {
		try {
			const tokenDeviceId = req.device?.deviceId
			if (!tokenDeviceId) {
				return res.status(401).json({ error: 'Device token missing deviceId' })
			}

			const device = await prisma.device.findUnique({ where: { deviceId: tokenDeviceId } })
			if (!device) {
				return res.status(404).json({ error: 'Device not registered' })
			}

			const enrollment = await prisma.fingerprintEnrollment.findUnique({ where: { id: req.params.id } })
			if (!enrollment) {
				return res.status(404).json({ error: 'Enrollment not found' })
			}

			if (enrollment.schoolId !== device.schoolId) {
				return res.status(403).json({ error: 'Enrollment belongs to another school' })
			}

			await prisma.fingerprintEnrollment.update({
				where: { id: enrollment.id },
				data: {
					status: FingerprintEnrollmentStatus.FAILED,
					template: null,
					failureReason: (req.body.reason as string | undefined) || 'Device reported failure',
				},
			})

			return res.json({ message: 'Enrollment marked as failed' })
		} catch (error) {
			console.error('Fail fingerprint enrollment error:', error)
			return res.status(500).json({ error: 'Failed to update enrollment status' })
		}
	}
)

export default router
