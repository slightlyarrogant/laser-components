import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
// Import API service
import { 
  fetchResearchById, 
  generateResearchSummary, 
  generateResearchRecommendations,
  fetchResearchHistory // Import history service
} from '../../services/api/researchService';
// Import Manager Components
import CollaboratorManager from './CollaboratorManager';
import AttachmentManager from './AttachmentManager';
import VersionSnapshotModal from './VersionSnapshotModal'; // Import the modal
// TODO: Import component for online research interaction (e.g., a modal)
// TODO: Import component to display JSON diff or snapshot

function ResearchDetail() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const [researchItem, setResearchItem] = useState(null);
  const [collaborators, setCollaborators] = useState([]); 
  const [attachments, setAttachments] = useState([]);
  const [history, setHistory] = useState([]); // State for version history
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [aiLoading, setAiLoading] = useState({ summary: false, recommendations: false });
  const [selectedSnapshot, setSelectedSnapshot] = useState(null); // State for modal

  // Define loadResearchDetail using useCallback to prevent re-creation
  const loadResearchDetail = useCallback(async () => {
    if (!id) return; 
    setLoading(true);
    setError(null); // Clear previous errors
    setHistoryError(null); // Clear history error too
    setHistory([]); // Clear old history
    try {
      const response = await fetchResearchById(id);
      const data = response.data;
      
      setResearchItem(data); 
      setCollaborators(data.collaborators || []); 
      setAttachments(data.attachments || []);   

      // Fetch history after main details are loaded
      setHistoryLoading(true);
      try {
          const historyResponse = await fetchResearchHistory(id);
          setHistory(historyResponse.data || []);
      } catch (histErr) {
          console.error("Error fetching research history:", histErr);
          setHistoryError(histErr.response?.data?.message || 'Failed to load history.')
      } finally {
          setHistoryLoading(false);
      }

    } catch (err) {
      console.error(`Error fetching research detail for ID ${id}:`, err);
      setError(err.response?.data?.message || 'Failed to load research details.');
      setResearchItem(null);
      setCollaborators([]);
      setAttachments([]);
      setLoading(false); // Ensure loading stops on main fetch error
      setHistoryLoading(false);
    }
    // setLoading(false) is handled within the main try/catch now
    // except when main fetch succeeds but history fails
     if (loading) setLoading(false); // Ensure loading is false if main fetch worked
  }, [id]); // Dependency: id

  useEffect(() => {
    loadResearchDetail();
  }, [loadResearchDetail]); // Dependency: the memoized load function

  const handleCollaboratorsUpdate = useCallback((updatedCollaborators) => {
    setCollaborators(updatedCollaborators);
    // Update the main item state as well for consistency
    setResearchItem(prev => prev ? { ...prev, collaborators: updatedCollaborators } : null);
  }, []);

  const handleAttachmentsUpdate = useCallback((updatedAttachments) => {
    setAttachments(updatedAttachments);
    setResearchItem(prev => prev ? { ...prev, attachments: updatedAttachments } : null);
  }, []);

  const handleGenerateSummary = async () => {
    setAiLoading(prev => ({ ...prev, summary: true }));
    setError(null);
    try {
      const response = await generateResearchSummary(researchItem.id);
      setResearchItem(prev => prev ? { ...prev, aiSummary: response.data.aiSummary } : null);
      alert(response.data.message);
    } catch (err) {
      console.error("Error generating AI summary:", err);
      setError(err.response?.data?.message || 'Failed to generate summary.');
    } finally {
      setAiLoading(prev => ({ ...prev, summary: false }));
    }
  };

  const handleGenerateRecommendations = async () => {
    setAiLoading(prev => ({ ...prev, recommendations: true }));
    setError(null);
    try {
      const response = await generateResearchRecommendations(researchItem.id);
      setResearchItem(prev => prev ? { ...prev, aiRecommendations: response.data.aiRecommendations } : null);
      alert(response.data.message);
    } catch (err) {
      console.error("Error generating AI recommendations:", err);
      setError(err.response?.data?.message || 'Failed to generate recommendations.');
    } finally {
      setAiLoading(prev => ({ ...prev, recommendations: false }));
    }
  };

  // TODO: Implement online research trigger/modal
  // const handleOnlineResearch = async () => { ... };

  // Function to open the modal
  const handleViewSnapshot = (snapshot) => {
    setSelectedSnapshot(snapshot);
  };

  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedSnapshot(null);
  };

  if (loading) {
    return <div>Loading research details...</div>;
  }

  // Show error state prominently
  if (error && !researchItem) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (!researchItem) {
    return <div>Research item not found.</div>;
  }

  return (
    <div className="research-detail-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{researchItem.applicationName} (ID: {researchItem.id})</h2>
        <div>
            {/* Link to Review page if applicable */} 
            {researchItem.status === 'PENDING_APPROVAL' && 
                <Link to={`/research/${researchItem.id}/review`} style={{ marginRight: '15px', fontWeight:'bold', color:'orange' }}>Review AI Draft</Link>}
            <Link to={`/research/${researchItem.id}/edit`}>Edit Research</Link>
        </div>
      </div>
      
      {/* Display general errors that might occur during AI generation etc. */}
      {error && <p style={{ color: 'red' }}>Action Error: {error}</p>}

      {/* ... other detail fields ... */}
      <p><strong>Status:</strong> {researchItem.status}</p>
      <p><strong>Industry Sector:</strong> {researchItem.industrySector || 'N/A'}</p>
      <p><strong>Subcategory:</strong> {researchItem.subcategory ? <Link to={`/subcategories/${researchItem.subcategory.id}`}>{researchItem.subcategory.name}</Link> : 'N/A'}</p>
      <p><strong>Product:</strong> {researchItem.product ? <Link to={`/products/${researchItem.product.id}`}>{researchItem.product.name}</Link> : 'N/A'}</p>
      <h3>Details</h3>
      <p><strong>Use Case:</strong> {researchItem.useCaseDescription || 'N/A'}</p>
      <p><strong>Market Potential:</strong> {researchItem.marketPotential || 'N/A'}</p>
      <p><strong>Technical Requirements:</strong> {researchItem.technicalRequirements || 'N/A'}</p>
      <p><strong>Competitive Landscape:</strong> {researchItem.competitiveLandscape || 'N/A'}</p>
      
      <h3>AI Insights</h3>
      {/* TODO: Check user permissions before showing AI buttons */}
      <div>
        <button onClick={handleGenerateSummary} disabled={aiLoading.summary || researchItem.status === 'PENDING_APPROVAL'}>
          {aiLoading.summary ? 'Generating...' : 'Generate AI Summary'}
        </button>
        <p><strong>AI Summary:</strong> {researchItem.aiSummary || 'N/A'}</p>
      </div>
      <div style={{ marginTop: '10px' }}>
        <button onClick={handleGenerateRecommendations} disabled={aiLoading.recommendations || researchItem.status === 'PENDING_APPROVAL'}>
          {aiLoading.recommendations ? 'Generating...' : 'Generate AI Recommendations'}
        </button>
        <p><strong>AI Recommendations:</strong></p>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f0f0f0', padding: '5px' }}>
          {researchItem.aiRecommendations || 'N/A'}
        </pre>
      </div>
      {/* TODO: Add button/modal for Online Research */}
      {/* <button onClick={handleOnlineResearch}>Perform Online Research</button> */}
      <p><strong>AI Confidence Score:</strong> {researchItem.aiConfidenceScore !== null ? `${(researchItem.aiConfidenceScore * 100).toFixed(1)}%` : 'N/A'}</p>
      
      {/* Managers */} 
      <CollaboratorManager 
        researchId={researchItem.id} 
        currentCollaborators={collaborators} 
        onCollaboratorsUpdate={handleCollaboratorsUpdate}
      />
      <AttachmentManager 
        researchId={researchItem.id} 
        currentAttachments={attachments} 
        onAttachmentsUpdate={handleAttachmentsUpdate}
      />

      {/* Version History Section */}
      <div className="version-history" style={{ marginTop: '20px'}}>
          <h3>Version History</h3>
          {historyLoading && <p>Loading history...</p>}
          {historyError && <p style={{ color: 'red' }}>{historyError}</p>}
          {!historyLoading && !historyError && history.length === 0 && <p>No version history found.</p>}
          {!historyLoading && !historyError && history.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                      <tr>
                          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Version</th>
                          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Timestamp</th>
                          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Changed By</th>
                          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Actions</th>
                      </tr>
                  </thead>
                  <tbody>
                      {history.map(version => (
                          <tr key={version.id}>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{version.versionNumber}</td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{new Date(version.createdAt).toLocaleString()}</td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{version.createdByUser?.email || 'N/A'}</td>
                              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                                  <button onClick={() => handleViewSnapshot(version.dataSnapshot)}>View Snapshot</button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          )}
      </div>

      {/* Metadata & Back Link */} 
      <hr style={{ marginTop: '20px' }} />
      <p><small>Created By: {researchItem.createdByUser?.email || 'N/A'} on {new Date(researchItem.createdAt).toLocaleString()}</small></p>
      <p><small>Last Updated: {new Date(researchItem.updatedAt).toLocaleString()}</small></p>
      <Link to="/research">Back to List</Link>

      {/* Render the modal conditionally */}
      {selectedSnapshot && (
        <VersionSnapshotModal 
          snapshotData={selectedSnapshot} 
          onClose={handleCloseModal} 
        />
      )}
    </div>
  );
}

export default ResearchDetail; 