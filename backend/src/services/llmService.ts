import axios from 'axios';
import prisma from '../lib/prisma';

export class LLMService {
  static async chat(agentName: string, prompt: string) {
    const config = await prisma.agentConfig.findUnique({
      where: { agentName }
    });

    if (!config) {
      console.warn(`No config found for agent: ${agentName}. Using defaults.`);
    }

    const provider = config?.provider || 'ollama';
    const model = config?.model || 'llama3';
    const systemPrompt = config?.systemPrompt || 'You are a helpful HW engineering assistant.';

    try {
      if (provider === 'ollama') {
        const res = await axios.post('http://localhost:11434/api/generate', {
          model: model,
          prompt: `${systemPrompt}\n\nUser: ${prompt}`,
          stream: false
        });
        return res.data.response;
      } else if (provider === 'openwebui') {
        // OpenWebUI API specification (assuming standard OpenAI-compatible)
        const res = await axios.post('http://your-openwebui-url/api/chat/completions', {
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ]
        }, {
          headers: { 'Authorization': `Bearer ${process.env.OPENWEBUI_KEY}` }
        });
        return res.data.choices[0].message.content;
      } else {
        // Simple Request (Placeholder for future implementation)
        return "Simple request response (Mock)";
      }
    } catch (error) {
      console.error(`LLM Error for ${agentName}:`, error);
      throw error;
    }
  }
}
