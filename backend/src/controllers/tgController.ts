import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';

// TG 자동화 서버 목록 조회
export const getTgServers = async (req: Request, res: Response) => {
  try {
    const servers = await prisma.tGServerConfig.findMany();
    res.json(servers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch TG servers' });
  }
};

// 자연어를 구조화된 로직으로 변환 (LLM 연동)
export const generateAutomationLogic = async (req: Request, res: Response) => {
  const { description } = req.body;
  
  try {
    // 실제 구현 시 프로젝트에 설정된 LLM(Ollama 등)에게 프롬프트를 보냅니다.
    // 여기서는 예시로 구조화된 결과를 시뮬레이션합니다.
    const prompt = `
      As an expert HW automation engineer, convert the following natural language description into a structured JSON execution logic.
      Description: "${description}"
      
      The JSON must include:
      - endpoints: array of { path, method, input_mapping, output_mapping }
      - post_processing: { on_success, on_failure }
    `;

    // Ollama 연동 예시 (실제 서버 주소 필요)
    // const llmRes = await axios.post('http://localhost:11434/api/generate', { model: 'llama3', prompt });
    
    // 시뮬레이션 결과
    const simulatedLogic = {
      endpoints: [
        { path: '/api/v1/analyze', method: 'POST', body: { task: '{{task_data}}' } }
      ],
      post_processing: {
        on_success: 'Verify results and update DB',
        on_failure: 'Alert administrator via email'
      }
    };

    res.json({ logic: simulatedLogic });
  } catch (error) {
    res.status(500).json({ error: 'LLM generation failed' });
  }
};

// TG 서버 등록
export const createTgServer = async (req: Request, res: Response) => {
  const { tgName, serverName, serverUrl, description, executionLogic } = req.body;
  try {
    const server = await prisma.tGServerConfig.create({
      data: { tgName, serverName, serverUrl, description, executionLogic }
    });
    res.status(201).json(server);
  } catch (error) {
    res.status(400).json({ error: 'Failed to save TG server' });
  }
};
