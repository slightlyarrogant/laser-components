/**
 * Converts an array of objects to CSV format
 * @param {Array} data - Array of objects to convert
 * @param {Array} headers - Array of header objects { key, label }
 * @returns {string} - CSV string
 */
export const convertToCSV = (data, headers) => {
  if (!data || !data.length) {
    return '';
  }

  // Create header row
  const headerRow = headers.map(header => `"${header.label}"`).join(',');
  
  // Create data rows
  const rows = data.map(item => {
    return headers.map(header => {
      // Handle nested properties with dot notation (e.g., 'location.country')
      const value = header.key.split('.').reduce((obj, key) => {
        return obj && obj[key] !== undefined ? obj[key] : '';
      }, item);
      
      // Format value for CSV (wrap in quotes and escape internal quotes)
      return `"${value !== null && value !== undefined ? String(value).replace(/"/g, '""') : ''}"`;
    }).join(',');
  });
  
  // Join all rows
  return [headerRow, ...rows].join('\n');
};

/**
 * Exports data as a CSV file
 * @param {Array} data - Array of objects to export
 * @param {Array} headers - Array of header objects { key, label }
 * @param {string} filename - Name of the file to download
 */
export const exportToCSV = (data, headers, filename = 'export.csv') => {
  const csv = convertToCSV(data, headers);
  
  if (!csv) {
    console.error('No data to export');
    return;
  }
  
  // Create a Blob containing the CSV data
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  
  // Create a link element to trigger the download
  const link = document.createElement('a');
  
  // Create a URL for the Blob
  const url = URL.createObjectURL(blob);
  
  // Set link properties
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  // Add the link to the DOM
  document.body.appendChild(link);
  
  // Trigger the download
  link.click();
  
  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Exports organizations data to CSV
 * @param {Array} organizations - Array of organization objects
 * @param {string} filename - Optional filename
 */
export const exportOrganizationsToCSV = (organizations, filename = 'organizations.csv') => {
  // Define the headers for the organization CSV
  const headers = [
    { key: 'name', label: 'Organization Name' },
    { key: 'industry', label: 'Industry' },
    { key: 'description', label: 'Description' },
    { key: 'website', label: 'Website' },
    { key: 'location.city', label: 'City' },
    { key: 'location.state', label: 'State/Province' },
    { key: 'location.country', label: 'Country' },
    { key: 'employeeCount', label: 'Employees' },
    { key: 'foundedYear', label: 'Founded Year' },
    { key: 'revenueRange', label: 'Revenue Range' },
    { key: 'externalId', label: 'External ID' },
  ];
  
  exportToCSV(organizations, headers, filename);
}; 