import { Router } from 'express';
import { getUsers, createUser, deleteUser } from '../controllers/userController';
import { getProjects, createProject, deleteProject, createProjectSchedule } from '../controllers/projectController';
import { getTgServers, generateAutomationLogic, createTgServer } from '../controllers/tgController';
import { getAgentConfigs, getAgentLogs } from '../controllers/agentController';
import { getSystemStatus, toggleBigAgent } from '../controllers/systemController';

const router = Router();

// User routes
router.get('/users', getUsers);
router.post('/users', createUser);
router.delete('/users/:id', deleteUser);

// Project routes
router.get('/projects', getProjects);
router.post('/projects', createProject);
router.delete('/projects/:id', deleteProject);
router.post('/projects/schedules', createProjectSchedule);

// TG Server routes
router.get('/tg/servers', getTgServers);
router.post('/tg/servers', createTgServer);
router.post('/tg/generate-logic', generateAutomationLogic);

// Agent routes
router.get('/agents/config', getAgentConfigs);
router.get('/agents/logs', getAgentLogs);

// System routes
router.get('/system/status', getSystemStatus);
router.post('/system/toggle', toggleBigAgent);

export default router;
