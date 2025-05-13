import React, { useState, useEffect } from 'react';
// Import API services
import { addResearchCollaborator, removeResearchCollaborator } from '../../services/api/researchService';
// TODO: Import user search/selection component or hook
// import { fetchUsers } from '../../services/api/userService'; // Example

// Placeholder for user data - replace with actual user fetching/selection
let MOCK_USERS = [
  { id: 1, email: 'admin@example.com' },
  { id: 2, email: 'researcher@example.com' },
  { id: 3, email: 'sales@example.com' },
  { id: 4, email: 'another.researcher@example.com' },
];

const COLLABORATOR_ROLES = ['EDITOR', 'VIEWER']; // Exclude OWNER for general adding

function CollaboratorManager({ researchId, currentCollaborators = [], onCollaboratorsUpdate }) {
  const [users, setUsers] = useState([]); // State to hold fetched users
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState(COLLABORATOR_ROLES[0]); // Default to EDITOR
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch users for the dropdown
  useEffect(() => {
    const loadUsers = async () => {
      // TODO: Implement actual user fetching
      // try {
      //   const response = await fetchUsers({ /* params for simple list? */ });
      //   setUsers(response.data || []);
      // } catch (err) {
      //   console.error("Error fetching users:", err);
      //   setError('Could not load users for collaborator selection.');
      // }
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate fetch
      setUsers(MOCK_USERS);
    };
    loadUsers();
  }, []);

  const handleAddCollaborator = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Please select a user to add.');
      return;
    }
    setLoading(true);
    setError(null);
    
    try {
      const userIdToAdd = parseInt(selectedUserId, 10);
      const response = await addResearchCollaborator(researchId, userIdToAdd, selectedRole);
      const newCollaboratorData = response.data; // Get data from API response

      // Update parent state with the data returned by the API
      onCollaboratorsUpdate([...currentCollaborators, newCollaboratorData]);

      setSelectedUserId('');
      setSelectedRole(COLLABORATOR_ROLES[0]);

    } catch (err) {
      console.error("Error adding collaborator:", err);
      setError(err.response?.data?.message || 'Failed to add collaborator.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCollaborator = async (userIdToRemove) => {
    setLoading(true); 
    setError(null);
    try {
      await removeResearchCollaborator(researchId, userIdToRemove);
      
      onCollaboratorsUpdate(currentCollaborators.filter(c => c.userId !== userIdToRemove));

    } catch (err) {
      console.error("Error removing collaborator:", err);
      setError(err.response?.data?.message || 'Failed to remove collaborator.');
    } finally {
      setLoading(false);
    }
  };

  // Filter out users who are already collaborators from the dropdown
  const availableUsers = users.filter(user => 
    !currentCollaborators.some(collaborator => collaborator.userId === user.id)
  );

  return (
    <div className="collaborator-manager">
      <h4>Manage Collaborators</h4>
      
      {/* List Current Collaborators */}
      <ul>
        {currentCollaborators.map(collab => (
          <li key={collab.userId}>
            {collab.user?.email || `User ID: ${collab.userId}`} ({collab.role})
            {/* Avoid removing OWNER or potentially self? Add logic here */}
            {collab.role !== 'OWNER' && (
              <button 
                onClick={() => handleRemoveCollaborator(collab.userId)} 
                disabled={loading} 
                style={{ marginLeft: '10px' }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Add New Collaborator Form */}
      <h5>Add Collaborator</h5>
      <form onSubmit={handleAddCollaborator}>
        <select 
          value={selectedUserId} 
          onChange={(e) => setSelectedUserId(e.target.value)}
          required
          disabled={loading || users.length === 0}
        >
          <option value="">-- Select User --</option>
          {availableUsers.map(user => (
            <option key={user.id} value={user.id.toString()}>{user.email}</option>
          ))}
        </select>
        
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          required
          disabled={loading}
          style={{ marginLeft: '10px' }}
        >
          {COLLABORATOR_ROLES.map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>

        <button type="submit" disabled={loading || !selectedUserId} style={{ marginLeft: '10px' }}>
          {loading ? 'Adding...' : 'Add Collaborator'}
        </button>
      </form>
      {error && <p style={{ color: 'red', marginTop: '10px' }}>Error: {error}</p>}
    </div>
  );
}

export default CollaboratorManager; 