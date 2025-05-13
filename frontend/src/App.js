import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container } from '@mui/material';
import Navigation from './components/common/Navigation';
import Dashboard from './pages/Dashboard';
import ProductList from './pages/product/ProductList';
import ProductDetail from './pages/product/ProductDetail';
import ProductCreate from './pages/product/ProductCreate';
import ProductEdit from './pages/product/ProductEdit';
import CategoryList from './pages/category/CategoryList';
import ApplicationList from './pages/application/ApplicationList';
import ApplicationDetail from './pages/application/ApplicationDetail';
import ApplicationCreate from './pages/application/ApplicationCreate';
import ApplicationEdit from './pages/application/ApplicationEdit';
import ApplicationMapping from './pages/application/ApplicationMapping';
import OrganizationSearch from './pages/organization/OrganizationSearch';
import OrganizationDetail from './pages/organization/OrganizationDetail';
import CacheManagement from './pages/admin/CacheManagement';
import UserListPage from './pages/admin/user/UserListPage';
import UserCreatePage from './pages/admin/user/UserCreatePage';
import UserEditPage from './pages/admin/user/UserEditPage';
import UserDetailPage from './pages/admin/user/UserDetailPage';
import ProfilePage from './pages/profile/ProfilePage';
import ForgotPasswordPage from './pages/profile/ForgotPasswordPage';
import ResetPasswordPage from './pages/profile/ResetPasswordPage';
import NotFound from './pages/NotFound';
import LeadList from './pages/lead/LeadList';
import LeadDetail from './pages/lead/LeadDetail';
import LeadCreate from './pages/lead/LeadCreate';
import LeadEdit from './pages/lead/LeadEdit';
import TagManagementPage from './pages/settings/TagManagementPage';
import AnalyticsDashboardPage from './pages/analytics/DashboardPage';
import ActivityLogPage from './pages/analytics/ActivityLogPage';
import LoginPage from './pages/auth/LoginPage';

// Import Research Components
import ResearchList from './components/Research/ResearchList';
import ResearchDetail from './components/Research/ResearchDetail';
import ResearchForm from './components/Research/ResearchForm';
import ResearchReviewPage from './pages/research/ResearchReviewPage';

function App() {
  return (
    <>
      <Navigation />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Product Routes */}
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/new" element={<ProductCreate />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/products/:id/edit" element={<ProductEdit />} />
          
          {/* Category Routes */}
          <Route path="/categories" element={<CategoryList />} />
          
          {/* Application Routes */}
          <Route path="/applications" element={<ApplicationList />} />
          <Route path="/applications/new" element={<ApplicationCreate />} />
          <Route path="/applications/:id" element={<ApplicationDetail />} />
          <Route path="/applications/:id/edit" element={<ApplicationEdit />} />
          <Route path="/applications/:id/mapping" element={<ApplicationMapping />} />
          
          {/* Organization Routes */}
          <Route path="/organizations/search" element={<OrganizationSearch />} />
          <Route path="/organizations/:id" element={<OrganizationDetail />} />
          
          {/* Lead Routes */}
          <Route path="/leads" element={<LeadList />} />
          <Route path="/leads/new" element={<LeadCreate />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/leads/:id/edit" element={<LeadEdit />} />
          
          {/* Admin Routes */}
          <Route path="/admin/cache" element={<CacheManagement />} />
          <Route path="/admin/users" element={<UserListPage />} />
          <Route path="/admin/users/new" element={<UserCreatePage />} />
          <Route path="/admin/users/:id" element={<UserDetailPage />} />
          <Route path="/admin/users/:id/edit" element={<UserEditPage />} />
          
          {/* Analytics Routes */}
          <Route path="/analytics/dashboard" element={<AnalyticsDashboardPage />} />
          <Route path="/analytics/activity" element={<ActivityLogPage />} />
          
          {/* Profile Routes */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          
          {/* Settings Routes */}
          <Route path="/settings/tags" element={<TagManagementPage />} />
          
          {/* Research Routes */}
          <Route path="/research" element={<ResearchList />} />
          <Route path="/research/review" element={<ResearchReviewPage />} />
          <Route path="/research/new" element={<ResearchForm />} />
          <Route path="/research/:id" element={<ResearchDetail />} />
          <Route path="/research/:id/edit" element={<ResearchForm />} />
          <Route path="/research/:id/review" element={<ResearchForm />} />

          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Container>
    </>
  );
}

export default App; 