import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Checkbox,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import useTableSort from '../../hooks/useTableSort';

/**
 * A reusable sortable table component with pagination and row selection
 */
const SortableTable = ({
  columns,
  data,
  initialSort = { field: 'id', direction: 'asc' },
  onRowClick,
  selectedRows = [],
  onSelectRow,
  onSelectAll,
  loading = false,
  pagination = false,
  totalCount,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  emptyMessage = 'No data found',
  renderActions = null,
  serverSideSort = null,
  stickyHeader = false,
  maxHeight,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  // Default empty functions if not provided
  const handleRowClick = onRowClick || (() => {});
  const handleSelectRow = onSelectRow || (() => {});
  const handleSelectAll = onSelectAll || (() => {});
  
  // Use our custom hook for sorting
  const { sortBy, sortDir, handleRequestSort, sortedItems } = useTableSort(data, {
    defaultSortBy: initialSort.field,
    defaultSortDir: initialSort.direction,
    serverSideSort: serverSideSort
  });
  
  // Determine if a column is visible based on breakpoint
  const isColumnVisible = (column) => {
    if (!column.responsive) return true;
    if (column.responsive === 'desktop' && isMobile) return false;
    if (column.responsive === 'tablet' && isTablet) return false;
    return true;
  };
  
  // Visible columns
  const visibleColumns = columns.filter(isColumnVisible);
  
  // Generate table headers
  const renderTableHead = () => (
    <TableHead>
      <TableRow>
        {selectedRows !== null && (
          <TableCell padding="checkbox">
            <Checkbox
              indeterminate={selectedRows.length > 0 && selectedRows.length < data.length}
              checked={data.length > 0 && selectedRows.length === data.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
              inputProps={{ 'aria-label': 'select all' }}
            />
          </TableCell>
        )}
        
        {visibleColumns.map((column) => (
          <TableCell
            key={column.field}
            align={column.align || 'left'}
            padding={column.disablePadding ? 'none' : 'normal'}
            sortDirection={sortBy === column.field ? sortDir : false}
            sx={column.sx}
          >
            {column.sortable !== false ? (
              <TableSortLabel
                active={sortBy === column.field}
                direction={sortBy === column.field ? sortDir : 'asc'}
                onClick={() => handleRequestSort(column.field)}
              >
                {column.label}
              </TableSortLabel>
            ) : (
              column.label
            )}
          </TableCell>
        ))}
        
        {renderActions && <TableCell align="right">Actions</TableCell>}
      </TableRow>
    </TableHead>
  );
  
  // Generate table rows
  const renderTableBody = () => {
    if (loading) {
      return (
        <TableRow>
          <TableCell
            colSpan={
              (selectedRows !== null ? 1 : 0) +
              visibleColumns.length +
              (renderActions ? 1 : 0)
            }
            align="center"
          >
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          </TableCell>
        </TableRow>
      );
    }
    
    if (sortedItems.length === 0) {
      return (
        <TableRow>
          <TableCell
            colSpan={
              (selectedRows !== null ? 1 : 0) +
              visibleColumns.length +
              (renderActions ? 1 : 0)
            }
            align="center"
          >
            <Box sx={{ py: 3 }}>
              <Typography variant="body1" color="text.secondary">
                {emptyMessage}
              </Typography>
            </Box>
          </TableCell>
        </TableRow>
      );
    }
    
    return sortedItems.map((row) => {
      const isSelected = selectedRows ? selectedRows.includes(row.id) : false;
      
      return (
        <TableRow
          hover
          onClick={() => handleRowClick(row)}
          role="checkbox"
          aria-checked={isSelected}
          tabIndex={-1}
          key={row.id}
          selected={isSelected}
          sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
        >
          {selectedRows !== null && (
            <TableCell padding="checkbox">
              <Checkbox
                checked={isSelected}
                onChange={() => handleSelectRow(row.id)}
                onClick={(e) => e.stopPropagation()}
                inputProps={{ 'aria-labelledby': `enhanced-table-checkbox-${row.id}` }}
              />
            </TableCell>
          )}
          
          {visibleColumns.map((column) => (
            <TableCell
              key={`${row.id}-${column.field}`}
              align={column.align || 'left'}
              sx={column.sx}
            >
              {column.render ? column.render(row) : row[column.field]}
            </TableCell>
          ))}
          
          {renderActions && (
            <TableCell align="right" onClick={(e) => e.stopPropagation()}>
              {renderActions(row)}
            </TableCell>
          )}
        </TableRow>
      );
    });
  };
  
  return (
    <Paper>
      <TableContainer sx={{ maxHeight }}>
        <Table stickyHeader={stickyHeader}>
          {renderTableHead()}
          <TableBody>{renderTableBody()}</TableBody>
        </Table>
      </TableContainer>
      
      {pagination && (
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={totalCount || sortedItems.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={onPageChange}
          onRowsPerPageChange={onRowsPerPageChange}
        />
      )}
    </Paper>
  );
};

SortableTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      field: PropTypes.string.isRequired,
      label: PropTypes.node.isRequired,
      align: PropTypes.oneOf(['left', 'right', 'center']),
      sortable: PropTypes.bool,
      disablePadding: PropTypes.bool,
      render: PropTypes.func,
      responsive: PropTypes.oneOf(['desktop', 'tablet', 'mobile']),
      sx: PropTypes.object,
    })
  ).isRequired,
  data: PropTypes.array.isRequired,
  initialSort: PropTypes.shape({
    field: PropTypes.string,
    direction: PropTypes.oneOf(['asc', 'desc']),
  }),
  onRowClick: PropTypes.func,
  selectedRows: PropTypes.array,
  onSelectRow: PropTypes.func,
  onSelectAll: PropTypes.func,
  loading: PropTypes.bool,
  pagination: PropTypes.bool,
  totalCount: PropTypes.number,
  page: PropTypes.number,
  rowsPerPage: PropTypes.number,
  onPageChange: PropTypes.func,
  onRowsPerPageChange: PropTypes.func,
  emptyMessage: PropTypes.node,
  renderActions: PropTypes.func,
  serverSideSort: PropTypes.func,
  stickyHeader: PropTypes.bool,
  maxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

export default SortableTable; 