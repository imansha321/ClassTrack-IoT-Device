import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get all alerts
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { resolved, severity, type } = req.query;
    
    const where: any = {};
    
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
router.patch('/:id/resolve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.update({
      where: { id },
      data: { resolved: true },
    });

    res.json(alert);
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// Delete alert
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.alert.delete({ where: { id } });

    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

export default router;

