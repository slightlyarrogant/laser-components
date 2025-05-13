# API Documentation

Comprehensive documentation for the Laser Components API.

## Overview

The Laser Components API provides RESTful endpoints for managing laser component products, applications, leads, and analytics. The API is built with Express.js and uses Prisma for database operations.

## Base URL

```
Development: http://localhost:3001
Production: https://your-domain.com/api
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### Authentication Flow

1. **Login**: POST `/auth/login`
2. **Get Token**: Receive JWT token in response
3. **Use Token**: Include in Authorization header for subsequent requests

```bash
# Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "password"
}

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}

# Authenticated requests
Authorization: Bearer your-jwt-token
```

## Endpoints

### Authentication

#### POST `/auth/login`
Login user and receive JWT token.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "string",
  "user": {
    "id": "number",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "role": "string"
  }
}
```

#### POST `/auth/register`
Register new user.

**Request Body:**
```json
{
  "email": "string",
  "password": "string",
  "firstName": "string",
  "lastName": "string"
}
```

#### POST `/auth/logout`
Logout user (requires authentication).

### Products

#### GET `/products`
Retrieve all products with pagination and filtering.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `search`: Search term
- `category`: Filter by category
- `sortBy`: Sort field (name, price, createdAt)
- `sortOrder`: asc or desc

**Response:**
```json
{
  "products": [
    {
      "id": "number",
      "name": "string",
      "description": "string",
      "category": "string",
      "specifications": "object",
      "price": "number",
      "availability": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "pages": "number"
  }
}
```

#### GET `/products/:id`
Get specific product details.

**Response:**
```json
{
  "id": "number",
  "name": "string",
  "description": "string",
  "category": "string",
  "specifications": "object",
  "applications": ["application objects"],
  "relatedProducts": ["product objects"]
}
```

#### POST `/products`
Create new product (requires authentication).

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "category": "string",
  "specifications": "object",
  "price": "number",
  "availability": "string"
}
```

#### PUT `/products/:id`
Update product (requires authentication).

#### DELETE `/products/:id`
Delete product (requires authentication).

### Applications

#### GET `/applications`
Get all applications.

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `industry`: Filter by industry
- `search`: Search term

**Response:**
```json
{
  "applications": [
    {
      "id": "number",
      "name": "string",
      "description": "string",
      "industry": "string",
      "requirements": "object",
      "products": ["product objects"]
    }
  ],
  "pagination": "object"
}
```

#### POST `/applications`
Create new application (requires authentication).

#### GET `/applications/:id/products`
Get products for specific application.

### Leads

#### GET `/leads`
Get all leads with filtering.

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `status`: Filter by status
- `score`: Filter by score range
- `region`: Filter by region
- `search`: Search term

**Response:**
```json
{
  "leads": [
    {
      "id": "number",
      "companyName": "string",
      "contactName": "string",
      "email": "string",
      "phone": "string",
      "status": "string",
      "score": "number",
      "region": "string",
      "source": "string",
      "notes": "string",
      "activities": ["activity objects"],
      "createdAt": "string",
      "updatedAt": "string"
    }
  ],
  "pagination": "object"
}
```

#### POST `/leads`
Create new lead.

#### PUT `/leads/:id`
Update lead.

#### GET `/leads/:id/enrich`
Enrich lead data using external sources.

**Response:**
```json
{
  "enrichedData": {
    "socialMedia": "object",
    "companyInfo": "object",
    "technologies": "array",
    "financialData": "object"
  },
  "score": "number"
}
```

#### GET `/leads/export`
Export leads data.

**Query Parameters:**
- `format`: csv or xlsx
- `filters`: JSON string of filters

### Search

#### GET `/search`
Global search across all entities.

**Query Parameters:**
- `q`: Search query
- `type`: products, applications, leads
- `limit`: Number of results

**Response:**
```json
{
  "results": [
    {
      "type": "string",
      "id": "number",
      "title": "string",
      "description": "string",
      "score": "number"
    }
  ],
  "total": "number"
}
```

#### GET `/search/regions`
Search by region/location.

**Query Parameters:**
- `region`: Region name or code
- `radius`: Search radius (km)
- `products`: Include products
- `leads`: Include leads

### Analytics

#### GET `/analytics/dashboard`
Get dashboard analytics data.

**Response:**
```json
{
  "overview": {
    "totalProducts": "number",
    "totalLeads": "number",
    "conversionRate": "number",
    "revenue": "number"
  },
  "trends": "object",
  "recentActivity": "array"
}
```

#### GET `/analytics/products`
Product analytics.

#### GET `/analytics/leads`
Lead analytics and conversion metrics.

## Error Handling

The API uses standard HTTP status codes and returns errors in a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": "object (optional)"
  }
}
```

### Common Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

## Request Examples

### Using cURL

```bash
# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Get products
curl -X GET http://localhost:3001/products \
  -H "Authorization: Bearer your-jwt-token"

# Create product
curl -X POST http://localhost:3001/products \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"name":"Laser Diode","category":"Diodes","price":299.99}'
```

### Using JavaScript/Fetch

```javascript
// Login
const login = async () => {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'user@example.com',
      password: 'password'
    })
  });
  
  const data = await response.json();
  localStorage.setItem('token', data.token);
};

// Authenticated request
const getProducts = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch('/products', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authenticated users**: 1000 requests per hour
- **Unauthenticated users**: 100 requests per hour

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Webhooks

The API supports webhooks for real-time notifications:

### Webhook Events

- `lead.created`
- `lead.updated`
- `product.created`
- `product.updated`

### Webhook Configuration

```json
{
  "url": "https://your-app.com/webhooks",
  "events": ["lead.created", "lead.updated"],
  "secret": "your-secret-key"
}
```

## SDK and Libraries

### JavaScript SDK

```javascript
import { LaserComponentsAPI } from '@laser-components/sdk';

const api = new LaserComponentsAPI({
  baseURL: 'http://localhost:3001',
  apiKey: 'your-api-key'
});

// Usage
const products = await api.products.list();
const lead = await api.leads.create(leadData);
```

### Python SDK

```python
from laser_components import LaserComponentsAPI

api = LaserComponentsAPI(
    base_url='http://localhost:3001',
    api_key='your-api-key'
)

# Usage
products = api.products.list()
lead = api.leads.create(lead_data)
```

## Testing

### Test Data

The API includes test data endpoints (development only):

```bash
# Seed test data
POST /test/seed

# Clear test data
DELETE /test/clear
```

### Postman Collection

Import the Postman collection for easy API testing:
```json
{
  "info": {
    "name": "Laser Components API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [...]
}
```

## Versioning

API versioning is handled through URL path:
- Current version: `v1`
- Full URL: `http://localhost:3001/api/v1/products`

## CORS

CORS is configured to allow requests from:
- `http://localhost:3000` (development frontend)
- Your production domain

## Security Considerations

1. **Always use HTTPS in production**
2. **Store JWT tokens securely**
3. **Validate all input data**
4. **Implement proper error handling**
5. **Use environment variables for secrets**

## Migration

When updating the API:

1. **Backward Compatibility**: Maintain for at least one version
2. **Deprecation Notices**: Give 90 days notice before removing endpoints
3. **Version Headers**: Include API version in response headers

---

For more information:
- [Development Guide](./development-guide.md)
- [Configuration Guide](./configuration.md)
- [Troubleshooting Guide](./troubleshooting.md)
