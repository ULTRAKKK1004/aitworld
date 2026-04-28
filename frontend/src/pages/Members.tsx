import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Trash2, Search, Filter } from 'lucide-react';
import './Members.css';

const TG_LIST = [
  'SYSTEM', 'VISUAL', 'AUDIO', 'PCB', 'POWER', 'COMMON', 'PL', 'RF', 'CONDUCTION'
];

const Members: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: 'password123',
    name: '',
    department: '',
    techGroup: 'SYSTEM',
    detailTask: '',
    isAdmin: false
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:4000/api/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:4000/api/users', newUser);
      setShowAddModal(false);
      fetchUsers();
    } catch (err) {
      alert('Failed to add member');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this member?')) return;
    try {
      await axios.delete(`http://localhost:4000/api/users/${id}`);
      fetchUsers();
    } catch (err) {
      alert('Failed to delete member');
    }
  };

  return (
    <div className="members-page">
      <header className="page-header">
        <div>
          <h1>Member Management</h1>
          <p>Manage tech groups, roles, and administrative access.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <UserPlus size={18} />
          <span>Add Member</span>
        </button>
      </header>

      <div className="members-toolbar card">
        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Search members..." />
        </div>
        <div className="filter-box">
          <Filter size={18} />
          <select>
            <option value="">All Tech Groups</option>
            {TG_LIST.map(tg => <option key={tg} value={tg}>{tg}</option>)}
          </select>
        </div>
      </div>

      <div className="members-list card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Department / TG</th>
              <th>Task</th>
              <th>Admin</th>
              <th>Joined Date</th>
              <th>Recent Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="user-info">
                    <span className="user-name">{user.name}</span>
                    <span className="user-email">{user.email}</span>
                  </div>
                </td>
                <td>
                  <div className="user-group">
                    <span className="dept">{user.department}</span>
                    <span className="tg-badge">{user.techGroup}</span>
                  </div>
                </td>
                <td><span className="task-text">{user.detailTask}</span></td>
                <td>{user.isAdmin ? <span className="admin-badge">Admin</span> : 'User'}</td>
                <td>{new Date(user.joinDate).toLocaleDateString()}</td>
                <td>{new Date(user.recentLogin).toLocaleString()}</td>
                <td>
                  <button className="delete-btn" onClick={() => handleDeleteUser(user.id)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal card">
            <h2>Add New Member</h2>
            <form onSubmit={handleAddUser}>
              <div className="form-group">
                <label>Name</label>
                <input type="text" required onChange={e => setNewUser({...newUser, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" required onChange={e => setNewUser({...newUser, email: e.target.value})} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Department</label>
                  <input type="text" required onChange={e => setNewUser({...newUser, department: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Tech Group</label>
                  <select onChange={e => setNewUser({...newUser, techGroup: e.target.value})}>
                    {TG_LIST.map(tg => <option key={tg} value={tg}>{tg}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Detailed Task</label>
                <textarea onChange={e => setNewUser({...newUser, detailTask: e.target.value})}></textarea>
              </div>
              <div className="form-group checkbox">
                <input type="checkbox" id="isAdmin" onChange={e => setNewUser({...newUser, isAdmin: e.target.checked})} />
                <label htmlFor="isAdmin">Grant Admin Access</label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Member</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;
