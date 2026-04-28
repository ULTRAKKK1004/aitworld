import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getSystemStatus = async (req: Request, res: Response) => {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: 'big_agent_active' } });
    res.json({ isActive: config?.value === 'true' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
};

export const toggleBigAgent = async (req: Request, res: Response) => {
  const { isActive } = req.body;
  try {
    await prisma.systemConfig.upsert({
      where: { key: 'big_agent_active' },
      update: { value: isActive ? 'true' : 'false' },
      create: { key: 'big_agent_active', value: isActive ? 'true' : 'false' }
    });
    res.json({ success: true, isActive });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle status' });
  }
};
