import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Calendar, Clock, ChevronRight, MoreHorizontal, Trash2 } from 'lucide-react';
import './Projects.css';

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    status: 'IN_PROGRESS'
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await axios.get('http://localhost:4000/api/projects');
      setProjects(res.data);
    } catch (err) {
      console.error('Failed to fetch projects');
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:4000/api/projects', newProject);
      setShowAddModal(false);
      fetchProjects();
    } catch (err) {
      alert('Failed to add project');
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm('Are you sure? All schedules will be deleted.')) return;
    try {
      await axios.delete(`http://localhost:4000/api/projects/${id}`);
      fetchProjects();
    } catch (err) {
      alert('Failed to delete project');
    }
  };

  return (
    <div className="projects-page">
      <header className="page-header">
        <div>
          <h1>Projects & Milestones</h1>
          <p>Track hardware development progress and key deadlines.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} />
          <span>New Project</span>
        </button>
      </header>

      <div className="projects-grid">
        {projects.map(project => (
          <div key={project.id} className="card project-card">
            <div className="project-card-header">
              <div className={`status-dot ${project.status.toLowerCase()}`}></div>
              <span className="project-status">{project.status}</span>
              <button className="icon-btn" onClick={() => handleDeleteProject(project.id)}>
                <Trash2 size={16} />
              </button>
            </div>
            <h3>{project.name}</h3>
            <p className="project-desc">{project.description}</p>
            
            <div className="project-dates">
              <div className="date-item">
                <Calendar size={14} />
                <span>{new Date(project.startDate).toLocaleDateString()}</span>
              </div>
              <ChevronRight size={14} />
              <div className="date-item">
                <Calendar size={14} />
                <span>{new Date(project.endDate).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="milestones-section">
              <h4>Upcoming Milestones</h4>
              {project.schedules && project.schedules.length > 0 ? (
                <div className="milestone-list">
                  {project.schedules.slice(0, 3).map((s: any) => (
                    <div key={s.id} className="milestone-item">
                      <Clock size={14} />
                      <span className="m-name">{s.milestone}</span>
                      <span className="m-date">{new Date(s.deadline).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-milestones">No milestones defined yet.</p>
              )}
            </div>

            <button className="btn btn-outline full-width">View Details</button>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal card">
            <h2>Create New Project</h2>
            <form onSubmit={handleAddProject}>
              <div className="form-group">
                <label>Project Name</label>
                <input type="text" required onChange={e => setNewProject({...newProject, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea onChange={e => setNewProject({...newProject, description: e.target.value})}></textarea>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" required onChange={e => setNewProject({...newProject, startDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" required onChange={e => setNewProject({...newProject, endDate: e.target.value})} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
