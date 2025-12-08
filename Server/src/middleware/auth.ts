import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

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
export const generateDeviceToken = (payload: { deviceId: string; schoolId?: string }): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.DEVICE_JWT_EXPIRES_IN || '90d',
  } as jwt.SignOptions);
};

export const authenticateDeviceToken = (
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
    if (decoded && decoded.deviceId) {
      req.device = { deviceId: decoded.deviceId, schoolId: decoded.schoolId };
      return next();
    }
    return res.status(403).json({ error: 'Invalid device token' });
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
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
