import { useState, useCallback, useMemo } from 'react';

/**
 * Custom hook for handling table sorting
 * @param {Array} items - Array of items to sort
 * @param {Object} options - Sort options
 * @param {string} options.defaultSortBy - Default sort field
 * @param {string} options.defaultSortDir - Default sort direction ('asc' or 'desc')
 * @param {function} options.serverSideSort - Function to call for server-side sorting
 * @returns {Object} Sorting state and handlers
 */
const useTableSort = (items = [], options = {}) => {
  const {
    defaultSortBy = 'id',
    defaultSortDir = 'asc',
    serverSideSort = null
  } = options;

  // State for sort configuration
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortDir, setSortDir] = useState(defaultSortDir);

  // Handle sort request
  const handleRequestSort = useCallback((property) => {
    const isAsc = sortBy === property && sortDir === 'asc';
    const newSortDir = isAsc ? 'desc' : 'asc';
    
    setSortDir(newSortDir);
    setSortBy(property);
    
    // If server-side sorting is provided, call it
    if (serverSideSort) {
      serverSideSort(property, newSortDir);
    }
  }, [sortBy, sortDir, serverSideSort]);

  // Client-side sorting function for immediate feedback
  const sortedItems = useMemo(() => {
    // If we're using server-side sorting, return items as is
    if (serverSideSort || !items.length) {
      return items;
    }
    
    // Create a copy to avoid mutating the original array
    const itemsCopy = [...items];
    
    return itemsCopy.sort((a, b) => {
      // Handle nested properties (e.g. 'user.name')
      const getNestedValue = (obj, path) => {
        const keys = path.split('.');
        return keys.reduce((o, key) => (o && o[key] !== undefined ? o[key] : null), obj);
      };
      
      let aValue = getNestedValue(a, sortBy);
      let bValue = getNestedValue(b, sortBy);
      
      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return sortDir === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortDir === 'asc' ? 1 : -1;
      
      // Handle different data types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDir === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDir === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }
      
      // Handle string dates
      if (typeof aValue === 'string' && aValue.match(/^\d{4}-\d{2}-\d{2}/) &&
          typeof bValue === 'string' && bValue.match(/^\d{4}-\d{2}-\d{2}/)) {
        return sortDir === 'asc' 
          ? new Date(aValue).getTime() - new Date(bValue).getTime()
          : new Date(bValue).getTime() - new Date(aValue).getTime();
      }
      
      // Default numeric comparison
      return sortDir === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [items, sortBy, sortDir, serverSideSort]);
  
  return {
    sortBy,
    sortDir,
    handleRequestSort,
    sortedItems
  };
};

export default useTableSort; 