import axiosClient from './axiosClient';

const API_URL = '';

/**
 * Service for handling product-related API calls
 */
const productService = {
  // Product endpoints
  getProducts: async (params = {}) => {
    const response = await axiosClient.get(`/products`, { params });
    return response.data;
  },

  getProductById: async (id) => {
    const response = await axiosClient.get(`/products/${id}`);
    return response.data;
  },

  createProduct: async (productData) => {
    const response = await axiosClient.post(`/products`, productData);
    return response.data;
  },

  updateProduct: async (id, productData) => {
    const response = await axiosClient.put(`/products/${id}`, productData);
    return response.data;
  },

  deleteProduct: async (id) => {
    const response = await axiosClient.delete(`/products/${id}`);
    return response.data;
  },

  // Category endpoints
  getCategories: async () => {
    const response = await axiosClient.get(`/categories`);
    return response.data;
  },

  getCategoryById: async (id) => {
    const response = await axiosClient.get(`/categories/${id}`);
    return response.data;
  },

  createCategory: async (categoryData) => {
    const response = await axiosClient.post(`/categories`, categoryData);
    return response.data;
  },

  updateCategory: async (id, categoryData) => {
    const response = await axiosClient.put(`/categories/${id}`, categoryData);
    return response.data;
  },

  deleteCategory: async (id) => {
    const response = await axiosClient.delete(`/categories/${id}`);
    return response.data;
  },

  // Subcategory endpoints
  getSubcategories: async (categoryId = null) => {
    const url = categoryId
      ? `/categories/${categoryId}/subcategories`
      : `/subcategories`;
    const response = await axiosClient.get(url);
    return response.data;
  },

  getSubcategoryById: async (id) => {
    const response = await axiosClient.get(`/subcategories/${id}`);
    return response.data;
  },

  createSubcategory: async (subcategoryData) => {
    const response = await axiosClient.post(`/subcategories`, subcategoryData);
    return response.data;
  },

  updateSubcategory: async (id, subcategoryData) => {
    const response = await axiosClient.put(`/subcategories/${id}`, subcategoryData);
    return response.data;
  },

  deleteSubcategory: async (id) => {
    const response = await axiosClient.delete(`/subcategories/${id}`);
    return response.data;
  }
};

export default productService; 