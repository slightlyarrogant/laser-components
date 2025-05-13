import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
// Import actual API call service
import { fetchResearchList, deleteResearch } from '../../services/api/researchService';
import AiResearchInitiator from './AiResearchInitiator';
// TODO: Add context/hook for user permissions to show/hide actions
// TODO: Import debounce utility

function ResearchList() {
  const [researchItems, setResearchItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); // State for search term
  // TODO: Add state for pagination
  // TODO: Add state for other filters (status, user, etc.)

  // Debounced version of loadResearch - assumes debounce utility exists
  // const debouncedLoadResearch = useCallback(debounce(loadResearch, 500), []);

  const loadResearch = useCallback(async (currentSearchTerm) => {
    setLoading(true);
    setError(null); 
    try {
      const params = {
         // Fetch only active/reviewed statuses for the main list
         status: 'DRAFT,IN_PROGRESS,COMPLETED,ARCHIVED,REVIEWED', // Excluded PENDING_APPROVAL, AI_DISCOVERED
         // Add pagination params here
         // Add other filter params here
      };
      if (currentSearchTerm && currentSearchTerm.trim().length > 0) {
          params.searchTerm = currentSearchTerm.trim();
      }
      
      const response = await fetchResearchList(params);
      setResearchItems(response.data.data || []); 
      // TODO: Set pagination
    } catch (err) {
      console.error("Error fetching research list:", err);
      setError(err.response?.data?.message || 'Failed to load research items.');
      setResearchItems([]); 
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array as search term is passed directly

  // Initial load
  useEffect(() => {
    loadResearch(searchTerm); // Load with initial (empty) search term
  }, [loadResearch, searchTerm]); // Depend on the memoized load function AND searchTerm

  // Handle search input change
  const handleSearchChange = (event) => {
    const newSearchTerm = event.target.value;
    setSearchTerm(newSearchTerm);
    // Trigger search - use debounce here if available
    // debouncedLoadResearch(newSearchTerm);
    loadResearch(newSearchTerm); // Simple immediate search for now
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this research item?')) {
        // Indicate loading/disabling delete button? 
        try {
            await deleteResearch(id);
            loadResearch(searchTerm); // Refresh list using current search term
        } catch (err) {
             console.error("Error deleting research item:", err);
             // Display error to user
             alert(err.response?.data?.message || 'Failed to delete item.');
        }
    }
  };

  // Callback function for AiResearchInitiator
  const handleDraftCreated = () => {
    loadResearch(searchTerm); // Refresh list using current search term
  };

  if (loading && researchItems.length === 0) {
    return <div>Loading research items...</div>;
  }

  // Display error prominently if loading fails
  if (error && researchItems.length === 0) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div className="research-list-container">
      <h2>Industrial Application Research</h2>

      {/* TODO: Check permissions before showing AI initiator */}
      <AiResearchInitiator onDraftCreated={handleDraftCreated} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0' }}>
        <Link to="/research/new">Create New Research Manually</Link>
        {/* Export Button */}
        <div>
          {/* Export URL should only include active filters relevant to this view */}
          <a href={`/api/research/export/csv?status=DRAFT,IN_PROGRESS,COMPLETED,ARCHIVED,REVIEWED&searchTerm=${encodeURIComponent(searchTerm)}`} download="research_export.csv">
            <button>Export as CSV</button>
          </a>
        </div>
      </div>

      {/* Search Input */}
       <div style={{ margin: '15px 0' }}>
         <input
            type="text"
            placeholder="Search research items..."
            value={searchTerm}
            onChange={handleSearchChange}
            style={{ padding: '8px', width: '300px' }}
          />
          {/* Add button? Or trigger on change? */} 
       </div>

      {/* Loading indicator can be shown subtly if needed during search updates */}
      {loading && <p><small>Updating list...</small></p>}

      {error && <p style={{ color: 'red' }}>Error loading data: {error}</p>}
      
      {/* Research List Section (Show all fetched items) */} 
      <h3 style={{ marginTop: '30px' }}>Research Items</h3>
      {(researchItems.length === 0 && !loading) ? (
        <p>No research items found{searchTerm ? ` for "${searchTerm}"` : ''}. Use "Create New" or check the "Review AI Discoveries" section in the navigation.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Application Name</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Map directly over researchItems */}
            {researchItems.map((item) => (
              <tr key={item.id}>
                <td>{item.applicationName}</td>
                <td>{item.status}</td>
                <td>{new Date(item.updatedAt).toLocaleString()}</td>
                <td>
                  <Link to={`/research/${item.id}`}>View</Link>
                  <Link to={`/research/${item.id}/edit`} style={{ marginLeft: '10px' }}>Edit</Link>
                  <button onClick={() => handleDelete(item.id)} style={{ marginLeft: '10px', color:'red', background:'none', border:'none', cursor:'pointer' }}>
                      Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* TODO: Add pagination */}
    </div>
  );
}

export default ResearchList;