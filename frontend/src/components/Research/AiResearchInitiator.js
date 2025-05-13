import React, { useState } from 'react';
import { createResearchFromTopic } from '../../services/api/researchService';

// This component could be placed on the ResearchList page or elsewhere.
function AiResearchInitiator({ onDraftCreated }) {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError('Please enter a research topic.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage('');

    try {
      const response = await createResearchFromTopic(topic);
      setSuccessMessage(response.data.message || 'AI draft creation initiated successfully.');
      setTopic(''); // Clear input on success
      if (onDraftCreated) {
        onDraftCreated(response.data.researchItem); // Notify parent if needed
      }
    } catch (err) {
      console.error("Error initiating AI research draft:", err);
      setError(err.response?.data?.message || 'Failed to start AI research process.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-research-initiator" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
      <h4>Initiate AI Research Draft</h4>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="researchTopic">Research Topic:</label>
          <input
            type="text"
            id="researchTopic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Laser applications in semiconductor manufacturing"
            required
            disabled={loading}
            style={{ width: '100%', marginBottom: '10px' }}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Initiating AI Research...' : 'Generate Draft with AI'}
        </button>
      </form>
      {error && <p style={{ color: 'red', marginTop: '10px' }}>Error: {error}</p>}
      {successMessage && <p style={{ color: 'green', marginTop: '10px' }}>{successMessage}</p>}
    </div>
  );
}

export default AiResearchInitiator; 