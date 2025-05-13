import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
// Import API services
import { 
    fetchResearchById, 
    createResearch, 
    updateResearch, 
    approveResearch as apiApproveResearch, 
    rejectResearch as apiRejectResearch
} from '../../services/api/researchService'; 
// TODO: Import services to fetch subcategories and products
// import { fetchSubcategories } from '../../services/api/productService'; // Example
// TODO: Import context or hook to get current user ID
// import { useAuth } from '../../contexts/AuthContext'; // Example

// Remove unused variable
// const RESEARCH_STATUS_OPTIONS = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED', 'PENDING_APPROVAL', 'AI_DISCOVERED', 'REVIEWED', 'REJECTED'];

function ResearchForm() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const location = useLocation(); // Get location object
  const isEditing = Boolean(id);
  // Combine checks: Reviewing if URL ends with /review or if status is AI_DISCOVERED
  const [isReviewMode, setIsReviewMode] = useState(false); 
  const [originalStatus, setOriginalStatus] = useState(null); // Store the status loaded initially
  // const { user } = useAuth(); // Example: Get user from context

  const [formData, setFormData] = useState({
    applicationName: '',
    industrySector: '',
    useCaseDescription: '',
    marketPotential: '',
    technicalRequirements: '',
    competitiveLandscape: '',
    status: 'DRAFT', 
    subcategoryId: '', 
    productId: '',     
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(false); // Separate state for initial fetch
  const [fetchError, setFetchError] = useState(null);

  // TODO: Replace placeholders with actual fetched data
  const [subcategories, setSubcategories] = useState([]); 
  const [products, setProducts] = useState([]); 

  useEffect(() => {
    // Function to fetch related data (categories, products)
    const loadRelatedData = async () => {
        // TODO: Implement actual fetching
        // try {
        //   const [subcatRes, prodRes] = await Promise.all([
        //      fetchSubcategories(), 
        //      fetchAllProductsSimple() // Need a service for this
        //   ]);
        //   setSubcategories(subcatRes.data || []);
        //   setProducts(prodRes.data || []);
        // } catch (err) {
        //    console.error("Error fetching related data:", err);
        //    // Handle error appropriately (e.g., show message)
        // }
        // Using placeholders for now
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate fetch
        setSubcategories([{ id: 5, name: 'PCB Manufacturing' }, { id: 6, name: 'Medical Devices' }]); 
        setProducts([{ id: 101, name: 'Laser Model XA-1' }, { id: 102, name: 'Laser Model XB-2' }]); 
    };

    loadRelatedData();

    if (isEditing) { // Covers both edit and review paths initially
      const loadExistingData = async () => {
        setFetchLoading(true);
        setFetchError(null);
        try {
          const response = await fetchResearchById(id);
          const existingData = response.data;
          
          // Determine if we are in review mode
          const reviewPath = location.pathname.endsWith('/review');
          const reviewStatus = ['PENDING_APPROVAL', 'AI_DISCOVERED'].includes(existingData.status);
          setIsReviewMode(reviewPath || reviewStatus);
          setOriginalStatus(existingData.status); // Store original status

          setFormData({
            applicationName: existingData.applicationName || '',
            industrySector: existingData.industrySector || '',
            useCaseDescription: existingData.useCaseDescription || '',
            marketPotential: existingData.marketPotential || '',
            technicalRequirements: existingData.technicalRequirements || '',
            competitiveLandscape: existingData.competitiveLandscape || '',
            status: existingData.status || 'DRAFT',
            subcategoryId: existingData.subcategoryId?.toString() || '',
            productId: existingData.productId?.toString() || '',
            // Store original discoveredFromProductId if available (not directly editable)
            _discoveredFromProductId: existingData.discoveredFromProductId 
          });
        } catch (err) {
          console.error("Error fetching research data for edit/review:", err);
          setFetchError(err.response?.data?.message || 'Failed to load research data.');
        } finally {
          setFetchLoading(false);
        }
      };
      loadExistingData();
    } else {
        setIsReviewMode(false); // Not review mode if creating
        setOriginalStatus(null);
    }
  }, [id, isEditing, location.pathname]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Generic save function, now primarily handles updates
  const handleSave = async (statusOverride = null) => {
    setLoading(true);
    setError(null);

    let payload = {
      ...formData,
      subcategoryId: formData.subcategoryId ? parseInt(formData.subcategoryId, 10) : null,
      productId: formData.productId ? parseInt(formData.productId, 10) : null,
    };

    // Determine the status to save
    // If an override is given (Approve/Reject), use it.
    // Otherwise, use the status from the form data.
    payload.status = statusOverride !== null ? statusOverride : formData.status;
    
    // Remove internal field before sending
    delete payload._discoveredFromProductId;

    try {
      if (!isEditing) {
         // Create logic (should not be reachable in review mode, but good practice)
         payload.createdByUserId = 1; // Placeholder
         const response = await createResearch(payload);
         navigate(`/research/${response.data.id}`); 
      } else {
        // Update Logic (for Save Changes, Approve, Reject)
        const response = await updateResearch(id, payload);
        // Navigate after successful update/approve/reject
        // If rejecting, maybe navigate back to review list?
        if (payload.status === 'REJECTED') {
            navigate('/research/review');
        } else {
            navigate(`/research/${response.data.id}`); 
        }
      }
    } catch (err) {
      console.error("Error saving research:", err);
      setError(err.response?.data?.message || 'Failed to save research item.');
    } finally {
       setLoading(false); // Keep user on form if error, unless navigation happens
    }
  };
  
  // Handler for the "Save Changes" button in review mode
  const handleSaveChangesKeepPending = (e) => {
    e.preventDefault();
    // Save changes but explicitly keep the original pending status
    handleSave(originalStatus); 
  };

  // Handler for the "Approve" button
  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
        // Call the dedicated approve endpoint
        await apiApproveResearch(id);
        // Navigate to the detail view after successful approval
        navigate(`/research/${id}`);
    } catch (err) {
        console.error("Error approving research:", err);
        setError(err.response?.data?.message || 'Failed to approve research item.');
        setLoading(false); // Stop loading on error
    }
    // No finally setLoading(false) because navigation occurs on success
  };

  // Handler for the "Reject" button
  const handleReject = async () => {
    // Reject action sets status to REJECTED
    // TODO: Consider confirmation dialog (already exists)
    if (window.confirm('Are you sure you want to reject this AI-discovered application?')) {
        setLoading(true);
        setError(null);
        try {
            // Call the dedicated reject endpoint
            await apiRejectResearch(id);
            // Navigate back to the main research list or a dedicated review list after rejection
            navigate('/research'); // Or perhaps a '/research/review' list?
        } catch (err) {
            console.error("Error rejecting research:", err);
            setError(err.response?.data?.message || 'Failed to reject research item.');
            setLoading(false); // Stop loading on error
        }
       // No finally setLoading(false) because navigation occurs on success
    }
  };

  const handleSimpleSubmit = (e) => {
      e.preventDefault();
      // Regular save keeps the current status (won't approve PENDING_APPROVAL)
      handleSave(); 
  };

  if (fetchLoading) {
     return <div>Loading research data...</div>; 
  }
  
  if (fetchError) {
     return <div style={{ color: 'red' }}>Error loading data: {fetchError}</div>;
  }

  return (
    <div className="research-form-container">
      <h2>{isReviewMode ? 'Review AI Research' : (isEditing ? 'Edit Research Item' : 'Create New Research Item')}</h2>
      {isReviewMode && (
        <p style={{ background: '#eef', padding: '10px', border: '1px solid #ccd', borderRadius: '4px'}}>
          Review the AI-generated content below. You can make edits and then Approve, Reject, or Save Changes.
        </p>
      )}
      <form onSubmit={isReviewMode ? handleSaveChangesKeepPending : handleSimpleSubmit}>
        <div className="form-group">
          <label htmlFor="applicationName">Application Name *</label>
          <input
            type="text"
            id="applicationName"
            name="applicationName"
            value={formData.applicationName}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="industrySector">Industry Sector</label>
          <input
            type="text"
            id="industrySector"
            name="industrySector"
            value={formData.industrySector}
            onChange={handleChange}
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="useCaseDescription">Use Case Description</label>
          <textarea 
            id="useCaseDescription"
            name="useCaseDescription" 
            value={formData.useCaseDescription}
            onChange={handleChange} 
            rows="4"
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="marketPotential">Market Potential</label>
          <textarea 
            id="marketPotential"
            name="marketPotential" 
            value={formData.marketPotential}
            onChange={handleChange} 
            rows="4"
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="technicalRequirements">Technical Requirements</label>
          <textarea 
            id="technicalRequirements"
            name="technicalRequirements" 
            value={formData.technicalRequirements}
            onChange={handleChange} 
            rows="4"
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="competitiveLandscape">Competitive Landscape</label>
          <textarea 
            id="competitiveLandscape"
            name="competitiveLandscape" 
            value={formData.competitiveLandscape}
            onChange={handleChange} 
            rows="4"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="status">Status</label>
          <input 
             type="text"
             id="status"
             name="status"
             value={formData.status} 
             readOnly // Make status read-only on this form
             style={{ background: '#eee' }} 
          />
        </div>
        <div className="form-group">
          <label htmlFor="subcategoryId">Subcategory</label>
          <select
            id="subcategoryId"
            name="subcategoryId"
            value={formData.subcategoryId}
            onChange={handleChange}
            disabled={loading || subcategories.length === 0}
          >
            <option value="">-- Select Subcategory --</option>
            {subcategories.map(sub => (
              <option key={sub.id} value={sub.id.toString()}>{sub.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="productId">Product</label>
          <select
            id="productId"
            name="productId"
            value={formData.productId}
            onChange={handleChange}
            disabled={loading || products.length === 0}
          >
            <option value="">-- Select Product --</option>
            {products.map(prod => (
              <option key={prod.id} value={prod.id.toString()}>{prod.name}</option>
            ))}
          </select>
        </div>

        {error && <p style={{ color: 'red' }}>Error: {error}</p>}

        {/* Conditional Buttons */} 
        {!isReviewMode && (
            <button type="submit" disabled={loading}>
                {loading ? 'Saving...' : (isEditing ? 'Update Research' : 'Create Research')}
            </button>
        )}
        {isReviewMode && (
            <> 
              <button type="submit" disabled={loading} style={{ marginRight: '10px'}}>
                  {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={handleApprove} disabled={loading} style={{ background: '#28a745', color: 'white', marginRight: '10px'}}>
                 {loading ? 'Approving...' : 'Approve'}
              </button>
              <button type="button" onClick={handleReject} disabled={loading} style={{ background: '#dc3545', color: 'white'}}>
                 {loading ? 'Rejecting...' : 'Reject'}
              </button>
            </>
        )}
        
        <button type="button" onClick={() => navigate(isReviewMode ? '/research/review' : (isEditing ? `/research/${id}` : '/research'))} disabled={loading} style={{ marginLeft: '10px' }}>
          Cancel
        </button>
      </form>
    </div>
  );
}

export default ResearchForm; 