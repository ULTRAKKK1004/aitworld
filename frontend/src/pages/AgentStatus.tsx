import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bot, Activity, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import './AgentStatus.css';

const AgentStatus: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // 5초마다 로그 갱신
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await axios.get('http://localhost:4000/api/agents/logs');
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch logs');
    }
  };

  return (
    <div className="agent-status-page">
      <header className="page-header">
        <h1>Agent Activity Monitor</h1>
        <p>Live feed of Big Agent and specialized sub-agents' activities.</p>
      </header>

      <div className="status-overview card">
        <div className="status-item">
          <Activity className="icon success" size={32} />
          <div>
            <h3>Big Agent System</h3>
            <span className="badge success">Active / Operational</span>
          </div>
        </div>
      </div>

      <div className="logs-container card">
        <h2>Activity Logs</h2>
        <div className="log-list">
          {logs.map((log, i) => (
            <div key={log.id || i} className={`log-item ${log.level.toLowerCase()}`}>
              <span className="log-time">{new Date(log.createdAt).toLocaleTimeString()}</span>
              <span className="log-agent">[{log.agentName}]</span>
              <span className="log-level">{log.level}</span>
              <span className="log-message">{log.message}</span>
              {log.level === 'ERROR' && <AlertCircle size={16} className="error-icon" />}
              {log.level === 'INFO' && <CheckCircle size={16} className="info-icon" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AgentStatus;
