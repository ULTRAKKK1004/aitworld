import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Projects from './pages/Projects';
import AgentSettings from './pages/AgentSettings';
import AgentStatus from './pages/AgentStatus';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';
import './App.css';

const Header: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <header className="top-bar">
      <div className="search-placeholder">
        Search projects, tasks, or issues...
      </div>
      <div className="header-right">
        <div className="theme-switcher">
          <button 
            onClick={() => setTheme('midnight')} 
            className={theme === 'midnight' ? 'active' : ''}
            title="Midnight Blue"
          >
            <Monitor size={18} />
          </button>
          <button 
            onClick={() => setTheme('light')} 
            className={theme === 'light' ? 'active' : ''}
            title="Light Mode"
          >
            <Sun size={18} />
          </button>
          <button 
            onClick={() => setTheme('high-dark')} 
            className={theme === 'high-dark' ? 'active' : ''}
            title="High Contrast Dark"
          >
            <Moon size={18} />
          </button>
        </div>
        <div className="user-profile">
          <div className="avatar">AD</div>
          <span>Admin User</span>
        </div>
      </div>
    </header>
  );
};

const AppContent: React.FC = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Header />
        <div className="content-area">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/members" element={<Members />} />
            <Route path="/agents" element={<AgentStatus />} />
            <Route path="/issues" element={<div>Issues Page (Coming Soon)</div>} />
            <Route path="/schedule" element={<div>Schedule Page (Coming Soon)</div>} />
            <Route path="/settings" element={<AgentSettings />} />
            </Routes>        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
};

export default App;
