import React from 'react';

function VersionSnapshotModal({ snapshotData, onClose }) {
  if (!snapshotData) return null;

  // Basic modal styling
  const modalStyle = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'white',
    padding: '20px 40px',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    zIndex: 1000,
    maxHeight: '80vh',
    maxWidth: '80vw',
    overflow: 'auto',
    border: '1px solid #ccc'
  };

  const backdropStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  };

  return (
    <>
      <div style={backdropStyle} onClick={onClose}></div>
      <div style={modalStyle}>
        <h3>Version Snapshot Data</h3>
        <pre style={{ 
            background: '#f4f4f4', 
            border: '1px solid #ddd', 
            padding: '10px', 
            borderRadius: '4px', 
            maxHeight: '60vh',
            overflow: 'auto'
         }}>
          {JSON.stringify(snapshotData, null, 2)}
        </pre>
        <button onClick={onClose} style={{ marginTop: '15px' }}>Close</button>
      </div>
    </>
  );
}

export default VersionSnapshotModal; 