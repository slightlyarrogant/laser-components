import React, { useState } from 'react';
// Import API services
import { addResearchAttachment, removeResearchAttachment } from '../../services/api/researchService';
// TODO: Import user context for uploadedByUserId
// import { useAuth } from '../../contexts/AuthContext'; // Example

const ATTACHMENT_TYPES = ['LINK', 'DOCUMENT']; // DOCUMENT type needs file upload handling later

function AttachmentManager({ researchId, currentAttachments = [], onAttachmentsUpdate }) {
  // const { user } = useAuth(); // Example: Get user context
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [attachmentType, setAttachmentType] = useState(ATTACHMENT_TYPES[0]); // Default to LINK
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAddAttachment = async (e) => {
    e.preventDefault();
    if (!attachmentUrl) {
      setError('Attachment URL is required.');
      return;
    }
    // TODO: Add validation for URL format
    // TODO: For 'DOCUMENT' type, handle file input instead of URL

    setLoading(true);
    setError(null);

    // TODO: Get actual user ID from context
    const currentUserId = 1; // Placeholder: Replace with user.id

    try {
      const payload = {
        url: attachmentUrl,
        attachmentType,
        description: attachmentDescription,
        uploadedByUserId: currentUserId 
      };
      const response = await addResearchAttachment(researchId, payload);
      const newAttachmentData = response.data;

      // Update parent state with the data returned by the API
      onAttachmentsUpdate([...currentAttachments, newAttachmentData]);

      // Reset form
      setAttachmentUrl('');
      setAttachmentDescription('');
      // setAttachmentType(ATTACHMENT_TYPES[0]); // Already LINK

    } catch (err) {
      console.error("Error adding attachment:", err);
      setError(err.response?.data?.message || 'Failed to add attachment.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAttachment = async (attachmentIdToRemove) => {
    setLoading(true); // Indicate loading state for removal
    setError(null);
    try {
      await removeResearchAttachment(researchId, attachmentIdToRemove);
      
      onAttachmentsUpdate(currentAttachments.filter(a => a.id !== attachmentIdToRemove));

    } catch (err) {
      console.error("Error removing attachment:", err);
      setError(err.response?.data?.message || 'Failed to remove attachment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="attachment-manager">
      <h4>Manage Attachments</h4>
      
      {/* List Current Attachments */}
      <ul>
        {currentAttachments.map(attach => (
          <li key={attach.id}>
            <a href={attach.url} target="_blank" rel="noopener noreferrer">
              {attach.description || attach.url}
            </a> 
            ({attach.attachmentType}) - Added by {attach.uploadedByUser?.email || 'N/A'} on {new Date(attach.uploadedAt).toLocaleDateString()}
            <button 
              onClick={() => handleRemoveAttachment(attach.id)} 
              disabled={loading} 
              style={{ marginLeft: '10px' }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {/* Add New Attachment Form */}
      <h5>Add Attachment</h5>
      <form onSubmit={handleAddAttachment}>
        {/* Conditional input based on type - simple URL for now */}
        <div className="form-group">
           <label htmlFor="attachmentUrl">URL *</label>
           <input
            type="text" // Change to 'file' for DOCUMENT type later
            id="attachmentUrl"
            value={attachmentUrl}
            onChange={(e) => setAttachmentUrl(e.target.value)}
            placeholder="https://example.com/document.pdf"
            required
            disabled={loading}
          />
        </div>
       
         <div className="form-group">
          <label htmlFor="attachmentDescription">Description</label>
          <input
            type="text"
            id="attachmentDescription"
            value={attachmentDescription}
            onChange={(e) => setAttachmentDescription(e.target.value)}
            placeholder="Optional description of the attachment"
            disabled={loading}
          />
        </div>

        {/* Hidden for now - Type is defaulted to LINK */}
        {/* <select 
            value={attachmentType} 
            onChange={(e) => setAttachmentType(e.target.value)}
            disabled={loading}
        > 
            {ATTACHMENT_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
        </select> */}
        
        <button type="submit" disabled={loading || !attachmentUrl}>
          {loading ? 'Adding...' : 'Add Attachment Link'}
        </button>
      </form>
      {error && <p style={{ color: 'red', marginTop: '10px' }}>Error: {error}</p>}
    </div>
  );
}

export default AttachmentManager; 