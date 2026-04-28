import { LLMService } from './llmService';
import axios from 'axios';
import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';

export class BigAgent {
  private isRunning = false;

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('Big Agent Engine Started...');
    
    // 1분마다 주기적 스캔
    setInterval(async () => {
      await this.orchestrate();
    }, 60000);
  }

  private async orchestrate() {
    try {
      // Check if Big Agent is active in DB
      const config = await prisma.systemConfig.findUnique({ where: { key: 'big_agent_active' } });
      const isActive = config?.value === 'true';

      if (!isActive) {
        console.log('[Big Agent] System is currently DISABLED. Skipping cycle.');
        return;
      }

      console.log('[Big Agent] Starting orchestration cycle...');
      
      // 1. Situation Analysis Agent
      const tasks = await this.runSituationAnalysis();
      
      if (tasks && tasks.length > 0) {
        for (const task of tasks) {
          // 2. Task Assignment Agent
          const result = await this.runTaskAssignment(task);
          
          // 3. Verification Agent
          await this.runVerification(task, result);
        }
      }

      // 4. Monitoring Agent
      await this.runMonitoring();

    } catch (error) {
      console.error('[Big Agent] Orchestration Error:', error);
      await this.logAgent('Monitoring', 'ERROR', `Orchestration loop failed: ${error}`);
    }
  }

  // --- Specialized Agent Logics ---

  private async runSituationAnalysis() {
    const projects = await prisma.project.findMany({ include: { schedules: true } });
    const prompt = `Analyze current project status: ${JSON.stringify(projects)}. 
    Identify missing tasks or upcoming deadlines. 
    Return a JSON list of tasks: [{ "tg": "SYSTEM", "action": "check_status", "details": "..." }]`;
    
    try {
      const response = await LLMService.chat('Situation', prompt);
      // LLM 응답에서 JSON 파싱 로직 필요 (정규식 등으로 추출)
      const tasks = this.extractJSON(response);
      await this.logAgent('Situation', 'INFO', `Identified ${tasks.length} tasks.`);
      return tasks;
    } catch (err) {
      return [];
    }
  }

  private async runTaskAssignment(task: any) {
    const servers = await prisma.tGServerConfig.findMany({ where: { tgName: task.tg } });
    if (servers.length === 0) {
      await this.logAgent('Assignment', 'WARN', `No automation server found for TG: ${task.tg}`);
      return null;
    }

    // 첫 번째 서버를 예시로 사용 (로직에 따라 적절한 서버 선택 가능)
    const server = servers[0];
    const logic = JSON.parse(server.executionLogic);
    
    try {
      const endpoint = logic.endpoints[0];
      const res = await axios({
        method: endpoint.method,
        url: `${server.serverUrl}${endpoint.path}`,
        data: { ...endpoint.body, details: task.details }
      });
      await this.logAgent('Assignment', 'INFO', `Assigned task to ${server.serverName}. Status: ${res.status}`);
      return res.data;
    } catch (err) {
      await this.logAgent('Assignment', 'ERROR', `Task assignment failed for ${server.serverName}`);
      return null;
    }
  }

  private async runVerification(task: any, result: any) {
    const prompt = `Verify if this automation result is correct. 
    Task: ${JSON.stringify(task)}, Result: ${JSON.stringify(result)}. 
    Reply with "VERIFIED" or "FAILED".`;
    
    const response = await LLMService.chat('Verification', prompt);
    const isVerified = response.includes('VERIFIED');
    await this.logAgent('Verification', isVerified ? 'INFO' : 'WARN', `Verification ${isVerified ? 'Passed' : 'Failed'}`);
  }

  private async runMonitoring() {
    const recentErrors = await prisma.agentLog.findMany({
      where: { 
        level: 'ERROR',
        createdAt: { gte: new Date(Date.now() - 3600000) } // 최근 1시간
      }
    });

    if (recentErrors.length > 0) {
      await this.sendAlertMail(recentErrors);
      await this.logAgent('Monitoring', 'WARN', `Alert email sent for ${recentErrors.length} errors.`);
    }
  }

  // --- Helpers ---

  private async logAgent(agentName: string, level: string, message: string) {
    await prisma.agentLog.create({
      data: { agentName, level, message }
    });
  }

  private extractJSON(text: string) {
    try {
      const match = text.match(/\[.*\]/s);
      return match ? JSON.parse(match[0]) : [];
    } catch {
      return [];
    }
  }

  private async sendAlertMail(errors: any[]) {
    // Nodemailer 설정 (실제 SMTP 정보 필요)
    const transporter = nodemailer.createTransport({
      host: 'smtp.example.com',
      port: 587,
      auth: { user: 'admin@ai-tworld.com', pass: 'password' }
    });

    try {
      // await transporter.sendMail({ ... });
      console.log('[Monitoring] Sending alert email for errors:', errors.length);
    } catch (err) {
      console.error('Mail sending failed');
    }
  }
}
