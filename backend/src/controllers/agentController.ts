import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getAgentConfigs = async (req: Request, res: Response) => {
  try {
    const configs = await prisma.agentConfig.findMany();
    res.json(configs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch configs' });
  }
};

export const getAgentLogs = async (req: Request, res: Response) => {
  try {
    const logs = await prisma.agentLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};
