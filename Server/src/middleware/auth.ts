import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { UserRole, Device } from '@prisma/client';
import prisma from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    schoolId?: string;
  };
  device?: {
    deviceId: string;
    schoolId?: string;
  };
  deviceRecord?: Device;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const generateToken = (payload: { id: string; email: string; role: UserRole; schoolId?: string }): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};

// Device token utilities
export const authenticateDeviceSecret = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const headerValue = req.headers['x-device-id'] || req.headers['x-device-secret'];
  const deviceId = (typeof headerValue === 'string' && headerValue.trim())
    || (typeof req.body?.deviceId === 'string' && req.body.deviceId.trim())
    || (typeof req.query?.deviceId === 'string' && (req.query.deviceId as string).trim());

  if (!deviceId) {
    return res.status(401).json({ error: 'Device identifier required' });
  }

  try {
    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device) {
      return res.status(404).json({ error: 'Device not registered' });
    }
    req.device = { deviceId: device.deviceId, schoolId: device.schoolId };
    req.deviceRecord = device;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to authenticate device' });
  }
};

export const authorizeRoles = (
  ...roles: UserRole[]
) => (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient role permissions' });
  }
  next();
};
