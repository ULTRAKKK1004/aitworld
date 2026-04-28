import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Zap, 
  Activity, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Power
} from 'lucide-react';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const [isBigAgentActive, setIsBigAgentActive] = useState(false);

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const res = await axios.get('http://localhost:4000/api/system/status');
      setIsBigAgentActive(res.data.isActive);
    } catch (err) {
      console.error('Failed to fetch status');
    }
  };

  const handleToggleBigAgent = async () => {
    try {
      const newStatus = !isBigAgentActive;
      await axios.post('http://localhost:4000/api/system/toggle', { isActive: newStatus });
      setIsBigAgentActive(newStatus);
    } catch (err) {
      alert('Failed to toggle Big Agent');
    }
  };
  const stats = [
    { label: 'Active Projects', value: '12', icon: <Zap size={24} color="#38bdf8" /> },
    { label: 'Agent Tasks', value: '45', icon: <Activity size={24} color="#10b981" /> },
    { label: 'Pending Issues', value: '3', icon: <AlertTriangle size={24} color="#f59e0b" /> },
    { label: 'Success Rate', value: '98%', icon: <CheckCircle2 size={24} color="#2563eb" /> },
  ];

  const agents = [
    { name: 'Situation Analysis', status: 'Running', color: 'success' },
    { name: 'Task Assignment', status: 'Idle', color: 'muted' },
    { name: 'Verification', status: 'Running', color: 'success' },
    { name: 'Monitoring', status: 'Running', color: 'success' },
  ];

  return (
    <div className="dashboard">
      <header className="page-header dashboard-header">
        <div>
          <h1>Overview</h1>
          <p>Real-time HW development status and agent orchestration.</p>
        </div>
        <div className="agent-control">
          <button 
            className={`btn ${isBigAgentActive ? 'btn-success' : 'btn-error'}`}
            onClick={handleToggleBigAgent}
          >
            <Power size={18} />
            <span>Big Agent: {isBigAgentActive ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </header>

      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div key={i} className="card stat-card">
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-content">
              <span className="stat-label">{stat.label}</span>
              <span className="stat-value">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="card agent-flow-card">
          <h2>Agent Orchestration Flow</h2>
          <div className="agent-flow">
            {agents.map((agent, i) => (
              <React.Fragment key={i}>
                <div className={`agent-node ${agent.color}`}>
                  <span className="agent-name">{agent.name}</span>
                  <span className="agent-status">{agent.status}</span>
                </div>
                {i < agents.length - 1 && <ArrowRight className="flow-arrow" size={20} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="card issue-trend-card">
          <h2>Issue Trends by TG</h2>
          <div className="placeholder-chart">
            {/* Chart component will go here */}
            <div className="bar-container">
              {['System', 'Visual', 'Audio', 'PCB', 'Power'].map(tg => (
                <div key={tg} className="bar-group">
                  <div className="bar" style={{ height: `${Math.random() * 80 + 20}%` }}></div>
                  <span>{tg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
