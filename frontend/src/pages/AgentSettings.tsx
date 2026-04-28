import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bot, Server, Zap, Save, RefreshCw, Plus, Trash2, Code } from 'lucide-react';
import './AgentSettings.css';

const AGENT_NAMES = ['Situation Analysis', 'Task Assignment', 'Verification', 'Monitoring'];
const TG_LIST = ['SYSTEM', 'VISUAL', 'AUDIO', 'PCB', 'POWER', 'COMMON', 'PL', 'RF', 'CONDUCTION'];

const AgentSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agents' | 'tg-servers'>('agents');
  const [agentConfigs, setAgentConfigs] = useState<any[]>([]);
  const [tgServers, setTgServers] = useState<any[]>([]);
  
  // TG Server Form
  const [newTgServer, setNewTgServer] = useState({
    tgName: 'SYSTEM',
    serverName: '',
    serverUrl: '',
    description: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      // Mocking for now, will connect to real API
      const resAgents = await axios.get('http://localhost:4000/api/agents/config');
      setAgentConfigs(resAgents.data);
      const resTg = await axios.get('http://localhost:4000/api/tg/servers');
      setTgServers(resTg.data);
    } catch (err) {
      console.error('Fetch failed');
    }
  };

  const handleGenerateLogic = async () => {
    setIsGenerating(true);
    // 이 부분에서 백엔드의 LLM 연동 엔드포인트를 호출하여 자연어 설명을 JSON 로직으로 변환합니다.
    try {
      const res = await axios.post('http://localhost:4000/api/tg/generate-logic', {
        description: newTgServer.description
      });
      // 결과로 받은 logic을 저장
      await axios.post('http://localhost:4000/api/tg/servers', {
        ...newTgServer,
        executionLogic: JSON.stringify(res.data.logic)
      });
      alert('Automation logic generated and saved successfully!');
      fetchConfigs();
    } catch (err) {
      alert('Failed to generate logic via LLM');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="agent-settings">
      <header className="page-header">
        <h1>Agent & Automation Settings</h1>
        <p>Configure LLM models, system prompts, and TG-specific automation workflows.</p>
      </header>

      <div className="tabs">
        <button className={activeTab === 'agents' ? 'active' : ''} onClick={() => setActiveTab('agents')}>Core Agents</button>
        <button className={activeTab === 'tg-servers' ? 'active' : ''} onClick={() => setActiveTab('tg-servers')}>TG Automation Servers</button>
      </div>

      {activeTab === 'agents' ? (
        <div className="agents-grid">
          {AGENT_NAMES.map(name => (
            <div key={name} className="card agent-card">
              <div className="agent-header">
                <Bot size={24} className="icon" />
                <h3>{name} Agent</h3>
              </div>
              <div className="form-group">
                <label>LLM Provider</label>
                <select>
                  <option value="ollama">Ollama</option>
                  <option value="openwebui">OpenWebUI</option>
                  <option value="request">Simple Request</option>
                </select>
              </div>
              <div className="form-group">
                <label>Model Name</label>
                <input type="text" placeholder="e.g. llama3, gpt-4" />
              </div>
              <div className="form-group">
                <label>System Prompt</label>
                <textarea rows={6} placeholder="Define how this agent should behave..."></textarea>
              </div>
              <button className="btn btn-primary"><Save size={16} /> Save Config</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="tg-servers-section">
          <div className="card add-server-card">
            <h2><Plus size={20} /> Register New Automation Server</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Target Tech Group</label>
                <select value={newTgServer.tgName} onChange={e => setNewTgServer({...newTgServer, tgName: e.target.value})}>
                  {TG_LIST.map(tg => <option key={tg} value={tg}>{tg}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Server Name</label>
                <input type="text" placeholder="e.g. PCB Artwork Auto Server" onChange={e => setNewTgServer({...newTgServer, serverName: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label>Server Base URL</label>
              <input type="text" placeholder="https://api.tg-server.com" onChange={e => setNewTgServer({...newTgServer, serverUrl: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Natural Language Description (Automation Logic)</label>
              <textarea 
                rows={5} 
                placeholder="Describe what this server does and how to handle results. e.g., 'If I send a circuit design, call /analyze- artwork with POST, and if it fails, send an alert to PCB group email...'"
                onChange={e => setNewTgServer({...newTgServer, description: e.target.value})}
              ></textarea>
            </div>
            <button className="btn btn-primary" onClick={handleGenerateLogic} disabled={isGenerating}>
              {isGenerating ? <RefreshCw className="spin" size={16} /> : <Zap size={16} />}
              {isGenerating ? 'Code-ifying via LLM...' : 'Generate Automation Logic'}
            </button>
          </div>

          <div className="server-list">
            <h3>Registered Servers</h3>
            <div className="server-grid">
              {tgServers.map(server => (
                <div key={server.id} className="card server-card">
                  <div className="server-card-header">
                    <Server size={20} />
                    <span className="tg-badge">{server.tgName}</span>
                    <button className="delete-btn"><Trash2 size={16} /></button>
                  </div>
                  <h4>{server.serverName}</h4>
                  <p className="url">{server.serverUrl}</p>
                  <div className="logic-preview">
                    <Code size={14} />
                    <span>Structured Logic Active</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentSettings;
