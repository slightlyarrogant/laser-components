# Development Guide

Guide for contributing to and developing the Laser Components system.

## Table of Contents

1. [Development Environment](#development-environment)
2. [Code Architecture](#code-architecture)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Testing](#testing)
6. [Contributing](#contributing)
7. [Debugging](#debugging)
8. [Performance Optimization](#performance-optimization)

## Development Environment

### Prerequisites

- Node.js 18+
- npm or yarn
- Git
- VS Code (recommended) or Cursor IDE
- Postman or similar API testing tool

### IDE Setup

#### VS Code Extensions

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "Prisma.prisma",
    "bradlc.vscode-tailwindcss"
  ]
}
```

#### Cursor IDE

The project is optimized for Cursor IDE with AI-driven development:

1. Enable AI autocomplete
2. Use the task management system with Cursor
3. Leverage AI for code reviews

### Local Development Setup

```bash
# Clone repository
git clone <repository-url>
cd laser_components

# Install dependencies
./setup.sh

# Start development servers
npm run start
```

## Code Architecture

### Project Structure

```
laser_components/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API services
│   │   ├── context/        # React context providers
│   │   └── utils/          # Utility functions
├── backend/                 # Express.js API
│   ├── src/
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Prisma models
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   └── routes/         # API routes
├── scripts/                # Task management CLI
└── docs/                   # Documentation
```

### Frontend Architecture

#### Technology Stack

- **React 18**: Component library
- **Material-UI**: UI components
- **React Router**: Navigation
- **Context API**: State management
- **Axios**: HTTP client

#### Component Structure

```jsx
// Component file structure
src/components/
├── common/           # Shared components
├── forms/           # Form components
├── layouts/         # Layout components
└── ui/              # Basic UI components

// Example component
import React from 'react';
import { Box, Typography } from '@mui/material';

const ExampleComponent = ({ title, children }) => {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4">{title}</Typography>
      {children}
    </Box>
  );
};

export default ExampleComponent;
```

### Backend Architecture

#### Technology Stack

- **Express.js**: Web framework
- **Prisma**: ORM and database toolkit
- **JWT**: Authentication
- **bcrypt**: Password hashing
- **Winston**: Logging

#### Service Layer Pattern

```javascript
// Controller
const ProductController = {
  async getProducts(req, res, next) {
    try {
      const products = await ProductService.getProducts(req.query);
      res.json(products);
    } catch (error) {
      next(error);
    }
  }
};

// Service
const ProductService = {
  async getProducts(filters) {
    return prisma.product.findMany({
      where: this.buildFilters(filters),
      include: { applications: true }
    });
  }
};
```

## Development Workflow

### Git Workflow

We use a feature branch workflow:

```bash
# Create feature branch
git checkout -b feature/product-search

# Make changes and commit
git add .
git commit -m "feat: implement product search functionality"

# Push and create PR
git push origin feature/product-search
```

### Commit Convention

Use conventional commits:

```
feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting, missing semicolons, etc.
refactor: code refactoring
test: adding tests
chore: updating build tasks, package manager configs, etc.
```

### Branch Naming

- `feature/description`: New features
- `fix/description`: Bug fixes
- `refactor/description`: Code refactoring
- `docs/description`: Documentation updates

### Task-Driven Development

Use the task management system:

```bash
# Get next task
npm run dev next

# Update task status
npm run dev set-status --id=1 --status=in-progress

# Complete task
npm run dev set-status --id=1 --status=done
```

## Coding Standards

### ESLint Configuration

```json
{
  "extends": [
    "react-app",
    "react-app/jest",
    "eslint:recommended"
  ],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error",
    "prefer-const": "error"
  }
}
```

### Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### Code Style Guidelines

#### React Components

```jsx
// Use functional components with hooks
const ProductList = ({ products, onProductSelect }) => {
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    // Effect logic
  }, [products]);

  return (
    <div>
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onSelect={() => onProductSelect(product)}
        />
      ))}
    </div>
  );
};
```

#### API Endpoints

```javascript
// Use async/await
router.get('/products', async (req, res, next) => {
  try {
    const products = await productService.getProducts(req.query);
    res.json({ products });
  } catch (error) {
    next(error);
  }
});
```

### Database Conventions

#### Prisma Schema

```prisma
model Product {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  price       Decimal
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  applications ApplicationProduct[]
  
  @@map("products")
}
```

## Testing

### Frontend Testing

#### Unit Tests with Jest

```javascript
// components/__tests__/ProductCard.test.js
import { render, screen } from '@testing-library/react';
import ProductCard from '../ProductCard';

describe('ProductCard', () => {
  const mockProduct = {
    id: 1,
    name: 'Test Product',
    price: 99.99
  };

  test('renders product information', () => {
    render(<ProductCard product={mockProduct} />);
    
    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('$99.99')).toBeInTheDocument();
  });
});
```

#### Integration Tests

```javascript
// services/__tests__/productService.test.js
import productService from '../productService';

describe('ProductService', () => {
  test('fetches products from API', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products: [] })
    });
    
    global.fetch = mockFetch;
    
    const result = await productService.getProducts();
    
    expect(mockFetch).toHaveBeenCalledWith('/api/products');
    expect(result).toEqual({ products: [] });
  });
});
```

### Backend Testing

#### Unit Tests

```javascript
// controllers/__tests__/productController.test.js
import request from 'supertest';
import app from '../../app';

describe('Product Controller', () => {
  test('GET /products returns products list', async () => {
    const response = await request(app)
      .get('/api/products')
      .expect(200);
    
    expect(response.body).toHaveProperty('products');
    expect(Array.isArray(response.body.products)).toBe(true);
  });
});
```

#### Database Testing

```javascript
// Use test database
process.env.DATABASE_URL = 'sqlite://test.db';

beforeEach(async () => {
  await prisma.$executeRawUnsafe('DELETE FROM products');
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### Running Tests

```bash
# Frontend tests
cd frontend && npm test

# Backend tests
npm run test:backend

# All tests
npm run test
```

## Contributing

### Pull Request Process

1. **Create Issue**: Describe the feature or bug
2. **Create Branch**: From the issue
3. **Implement Changes**: Follow coding standards
4. **Write Tests**: Ensure good coverage
5. **Update Documentation**: If necessary
6. **Create PR**: With detailed description
7. **Review Process**: Address feedback
8. **Merge**: After approval

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console.log statements
```

## Debugging

### Frontend Debugging

#### React DevTools

```javascript
// Debugging hooks
import { useEffect } from 'react';

const ProductList = ({ products }) => {
  useEffect(() => {
    console.log('Products changed:', products);
  }, [products]);
  
  // Component logic
};
```

#### Network Debugging

```javascript
// Interceptor for debugging API calls
import axios from 'axios';

axios.interceptors.request.use(request => {
  console.log('Starting Request', request);
  return request;
});

axios.interceptors.response.use(
  response => {
    console.log('Response:', response);
    return response;
  },
  error => {
    console.error('Error:', error);
    return Promise.reject(error);
  }
);
```

### Backend Debugging

#### Logging

```javascript
// winston logger setup
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Usage
logger.info('Processing products request', { userId, filters });
logger.error('Database error', error);
```

#### Debug Mode

```bash
# Enable debug mode
DEBUG=* npm run start:backend

# Specific debug namespace
DEBUG=app:* npm run start:backend
```

## Performance Optimization

### Frontend Optimization

#### React Performance

```jsx
// Use React.memo for expensive components
const ProductCard = React.memo(({ product }) => {
  return <div>{product.name}</div>;
});

// Use useMemo for expensive calculations
const ExpensiveComponent = ({ data }) => {
  const expensiveValue = useMemo(() => {
    return complexCalculation(data);
  }, [data]);
  
  return <div>{expensiveValue}</div>;
};

// Use useCallback for stable function references
const ProductList = ({ products, onProductSelect }) => {
  const handleSelect = useCallback((product) => {
    onProductSelect(product);
  }, [onProductSelect]);
  
  return (
    <div>
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onSelect={() => handleSelect(product)}
        />
      ))}
    </div>
  );
};
```

#### Code Splitting

```jsx
// Lazy loading components
import { lazy, Suspense } from 'react';

const ProductDetails = lazy(() => import('./ProductDetails'));

const App = () => {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <ProductDetails />
      </Suspense>
    </div>
  );
};
```

### Backend Optimization

#### Database Optimization

```javascript
// Efficient Prisma queries
const getProductsWithApplications = async () => {
  return prisma.product.findMany({
    select: {
      id: true,
      name: true,
      price: true,
      applications: {
        select: {
          application: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });
};

// Use transactions for related operations
const createProductWithApplications = async (productData, applicationIds) => {
  return prisma.$transaction(async (prisma) => {
    const product = await prisma.product.create({
      data: productData
    });
    
    await prisma.applicationProduct.createMany({
      data: applicationIds.map(appId => ({
        productId: product.id,
        applicationId: appId
      }))
    });
    
    return product;
  });
};
```

#### Caching

```javascript
// Redis caching example
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const getCachedProducts = async () => {
  const cached = await redis.get('products');
  if (cached) {
    return JSON.parse(cached);
  }
  
  const products = await prisma.product.findMany();
  await redis.setex('products', 300, JSON.stringify(products)); // Cache for 5 minutes
  
  return products;
};
```

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test
      - run: npm run lint
      - run: npm run build
```

### Environment Variables

Use environment-specific configurations:

```bash
# .env.development
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/dev_db

# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod_host:5432/prod_db
```

---

For more information:
- [API Documentation](./api-documentation.md)
- [Task Management Guide](./task-management.md)
- [Troubleshooting Guide](./troubleshooting.md)
