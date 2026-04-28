import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getProjects = async (req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      include: { schedules: true },
    });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

export const createProject = async (req: Request, res: Response) => {
  const { name, description, startDate, endDate, status } = req.body;
  try {
    const project = await prisma.project.create({
      data: {
        name,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || 'IN_PROGRESS',
      },
    });
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create project' });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.project.delete({ where: { id: parseInt(id) } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete project' });
  }
};

export const createProjectSchedule = async (req: Request, res: Response) => {
  const { projectId, milestone, deadline, status } = req.body;
  try {
    const schedule = await prisma.projectSchedule.create({
      data: {
        projectId: parseInt(projectId),
        milestone,
        deadline: new Date(deadline),
        status: status || 'PENDING',
      },
    });
    res.status(201).json(schedule);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create schedule' });
  }
};
