/**
 * Permission utilities for the frontend
 * Used to control access to UI elements based on user role
 */

// Permission definitions by role - should match backend permissions
const rolePermissions = {
  ADMIN: {
    users: ['read', 'create', 'update', 'delete'],
    products: ['read', 'create', 'update', 'delete'],
    categories: ['read', 'create', 'update', 'delete'],
    applications: ['read', 'create', 'update', 'delete'],
    leads: ['read', 'create', 'update', 'delete', 'export'],
    regions: ['read', 'create', 'update', 'delete'],
    enrichment: ['read', 'create', 'update', 'delete'],
    notes: ['read', 'create', 'update', 'delete'],
    tags: ['read', 'create', 'update', 'delete'],
  },
  RESEARCHER: {
    products: ['read', 'create', 'update'],
    categories: ['read', 'create', 'update'],
    applications: ['read', 'create', 'update'],
    leads: ['read', 'create'],
    regions: ['read'],
    enrichment: ['read', 'create'],
    notes: ['read', 'create', 'update', 'delete'],
    tags: ['read'],
  },
  SALES: {
    products: ['read'],
    categories: ['read'],
    applications: ['read'],
    leads: ['read', 'create', 'update', 'export'],
    regions: ['read'],
    enrichment: ['read', 'create'],
    notes: ['read', 'create', 'update', 'delete'],
    tags: ['read'],
  }
};

/**
 * Check if a user has permission to perform an action on a resource
 * @param {string} role - The user's role (ADMIN, RESEARCHER, SALES)
 * @param {string} resource - The resource being accessed (e.g., users, leads)
 * @param {string} action - The action being performed (read, create, update, delete)
 * @returns {boolean} - Whether the user has permission
 */
export const hasPermission = (role, resource, action) => {
  // If role is not defined, deny access
  if (!role) return false;
  
  // Check if the role exists in permissions
  if (!rolePermissions[role]) {
    return false;
  }
  
  // Check if the resource exists for this role
  if (!rolePermissions[role][resource]) {
    return false;
  }
  
  // Check if the action is allowed for this resource and role
  return rolePermissions[role][resource].includes(action);
};

/**
 * Higher-order component to conditionally render a component based on permissions
 * @param {React.Component} Component - The component to render
 * @param {Object} props - The component's props
 * @param {string} resource - The resource being accessed
 * @param {string} action - The action being performed
 * @param {Object} user - The current user object with role
 * @returns {React.Component|null} - The component if allowed, null otherwise
 */
export const PermissionGate = ({ component: Component, resource, action, user, ...props }) => {
  if (!user || !user.role) return null;
  
  return hasPermission(user.role, resource, action) ? 
    <Component {...props} /> : 
    null;
};

/**
 * Hook to check if the current user has a specific permission
 * @param {string} resource - The resource being accessed
 * @param {string} action - The action being performed
 * @param {Object} user - The current user object with role
 * @returns {boolean} - Whether the user has permission
 */
export const usePermission = (resource, action, user) => {
  if (!user || !user.role) return false;
  return hasPermission(user.role, resource, action);
};

const permissionUtils = {
  hasPermission,
  PermissionGate,
  usePermission
};

export default permissionUtils; 