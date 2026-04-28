import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: { leaveSchedules: true },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const createUser = async (req: Request, res: Response) => {
  const { email, password, name, department, techGroup, detailTask, isAdmin } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        email,
        password, // 추후 bcrypt 적용 필요
        name,
        department,
        techGroup,
        detailTask,
        isAdmin: isAdmin || false,
      },
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create user' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete user' });
  }
};
