# Configuration Guide

Comprehensive configuration documentation for the Laser Components system.

## Table of Contents

1. [Environment Configuration](#environment-configuration)
2. [Database Configuration](#database-configuration)
3. [API Keys and External Services](#api-keys-and-external-services)
4. [Frontend Configuration](#frontend-configuration)
5. [Backend Configuration](#backend-configuration)
6. [Task Management Configuration](#task-management-configuration)
7. [Production Configuration](#production-configuration)
8. [Security Configuration](#security-configuration)

## Environment Configuration

### Environment Files

The system uses multiple environment files for different components:

```
laser_components/
├── .env                    # Root environment variables
├── frontend/.env          # Frontend-specific variables
├── backend/.env           # Backend-specific variables
└── .env.example           # Example environment file
```

### Root Environment (`.env`)

```bash
# Application Environment
NODE_ENV=development
DEBUG=false
LOG_LEVEL=info

# Task Management
ANTHROPIC_API_KEY=your_anthropic_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key
MODEL=claude-3-7-sonnet-20250219
PERPLEXITY_MODEL=sonar-medium-online
MAX_TOKENS=4000
TEMPERATURE=0.7
DEFAULT_SUBTASKS=3
DEFAULT_PRIORITY=medium
PROJECT_NAME=Laser Components
PROJECT_VERSION=1.0.0

# Development
DEBUG_TASKS=false
LOG_LEVEL=info
```

## Database Configuration

### Prisma Configuration

The database configuration is managed through Prisma. The main configuration file is `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-1.1.x"]
}

datasource db {
  provider = "postgresql"  // or "mysql", "sqlite", "sqlserver"
  url      = env("DATABASE_URL")
}
```

### Database URLs

#### PostgreSQL
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/laser_components"
```

#### MySQL
```bash
DATABASE_URL="mysql://username:password@localhost:3306/laser_components"
```

#### SQLite (Development)
```bash
DATABASE_URL="file:./dev.db"
```

#### SQL Server
```bash
DATABASE_URL="sqlserver://localhost:1433;database=laser_components;user=sa;password=YourPassword;encrypt=true;trustServerCertificate=true"
```

### Database Pool Configuration

```javascript
// backend/src/config/database.js
const databaseConfig = {
  pool: {
    min: 0,
    max: 10,
    createTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
  },
  log: ["query", "info", "warn", "error"],
};
```

### Migration Configuration

```bash
# Run migrations
npx prisma migrate dev --name init

# Reset database
npx prisma migrate reset

# Deploy migrations to production
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

## API Keys and External Services

### Anthropic Claude API

```bash
# Get API key from: https://console.anthropic.com/
ANTHROPIC_API_KEY=your_anthropic_api_key

# Model configuration
MODEL=claude-3-7-sonnet-20250219
MAX_TOKENS=4000
TEMPERATURE=0.7
```

### Perplexity AI API

```bash
# Get API key from: https://www.perplexity.ai/settings/api
PERPLEXITY_API_KEY=your_perplexity_api_key
PERPLEXITY_MODEL=sonar-medium-online
```

### Other External Services

```bash
# Email service (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379

# File storage (optional)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=your_bucket_name
AWS_REGION=us-east-1
```

## Frontend Configuration

### React Environment (`frontend/.env`)

```bash
# API Configuration
REACT_APP_API_URL=http://localhost:3001
REACT_APP_API_VERSION=v1

# Environment
REACT_APP_ENV=development
REACT_APP_DEBUG=false

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=false
REACT_APP_ENABLE_CHAT=false

# External Services
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_key

# Build Configuration
GENERATE_SOURCEMAP=true
SKIP_PREFLIGHT_CHECK=true
DISABLE_ESLINT_PLUGIN=false
```

### Webpack Configuration (Custom)

Create `frontend/webpack.config.js` for custom webpack configuration:

```javascript
const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@services': path.resolve(__dirname, 'src/services'),
    },
    configure: (webpackConfig, { env, paths }) => {
      // Custom webpack configuration
      return webpackConfig;
    }
  }
};
```

## Backend Configuration

### Express Server (`backend/.env`)

```bash
# Server Configuration
PORT=3001
HOST=localhost
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/laser_components

# Security
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRATION=24h
BCRYPT_SALT_ROUNDS=10

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=uploads/

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

## Task Management Configuration

### Task System Configuration

The task management system is configured through environment variables and the `scripts/config.json` file:

```json
{
  "taskSystem": {
    "defaultSubtasks": 3,
    "complexityThreshold": 5,
    "priorityLevels": ["low", "medium", "high"],
    "statusTypes": ["pending", "in-progress", "done", "deferred"],
    "outputDirectory": "tasks"
  },
  "ai": {
    "enableResearch": true,
    "fallbackToAnthropic": true,
    "retryAttempts": 3,
    "timeout": 30000
  },
  "logging": {
    "debugFile": "dev-debug.log",
    "logRotation": true,
    "maxLogSize": "10MB",
    "maxLogFiles": 5
  }
}
```

### Task Generation Settings

```bash
# Task-specific environment variables
DEFAULT_SUBTASKS=3
DEFAULT_PRIORITY=medium
COMPLEXITY_THRESHOLD=5
ENABLE_RESEARCH=true
TASK_OUTPUT_DIR=tasks
TASK_FILE_PREFIX=task_
```

## Production Configuration

### Environment Variables for Production

```bash
# Production environment
NODE_ENV=production
LOG_LEVEL=warn

# Security
JWT_SECRET=your_very_secure_jwt_secret
SESSION_SECRET=your_very_secure_session_secret

# SSL Configuration
SSL_CERT_PATH=/path/to/ssl/cert.pem
SSL_KEY_PATH=/path/to/ssl/private-key.pem

# Performance
CLUSTER_WORKERS=auto  # or specific number
ENABLE_COMPRESSION=true
CACHE_TTL=300  # 5 minutes

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_ENDPOINT=/health
```

### Docker Configuration

Create `docker-compose.yml` for production deployment:

```yaml
version: '3.8'
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    ports:
      - "80:80"
    environment:
      - REACT_APP_API_URL=${API_URL}
    
  backend:
    build:
      context: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - database
    
  database:
    image: postgres:15
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Security Configuration

### HTTPS Configuration

```javascript
// backend/src/config/https.js
import https from 'https';
import fs from 'fs';

const httpsOptions = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH)
};

const server = https.createServer(httpsOptions, app);
```

### Security Headers

```javascript
// backend/src/middleware/security.js
import helmet from 'helmet';

const securityConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

export default securityConfig;
```

### Environment Variable Validation

```javascript
// backend/src/config/validation.js
import Joi from 'joi';

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  ANTHROPIC_API_KEY: Joi.string().required(),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export default envVars;
```

## Monitoring and Observability

### Logging Configuration

```javascript
// backend/src/config/logger.js
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'laser-components' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### Health Check Configuration

```javascript
// backend/src/routes/health.js
import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        server: 'running'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

export default router;
```

## Troubleshooting Common Issues

### Database Connection Issues

```bash
# Test database connection
npx prisma db pull

# Reset database
npx prisma migrate reset

# Check database logs
docker logs <database_container_name>
```

### Environment Variable Issues

```bash
# Validate environment
npm run validate

# Check loaded environment variables
node -e "console.log(process.env)"
```

### Port Conflicts

```bash
# Check what's using port 3001
lsof -i :3001

# Kill process using port
kill -9 $(lsof -ti:3001)
```

### Memory Issues

```javascript
// Monitor memory usage
const used = process.memoryUsage();
console.log('Memory usage:');
for (let key in used) {
  console.log(`${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
}
```

## Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Use strong secrets for JWT
   - Validate environment variables on startup
   - Use different configurations per environment

2. **Database Configuration**
   - Use connection pooling in production
   - Set appropriate timeouts
   - Monitor database performance
   - Regular backups

3. **Security**
   - Use HTTPS in production
   - Implement rate limiting
   - Validate all inputs
   - Keep dependencies updated

4. **Performance**
   - Enable compression
   - Use caching strategies
   - Optimize database queries
   - Monitor application metrics

---

For more information:
- [System Setup Guide](./system-setup.md)
- [Development Guide](./development-guide.md)
- [Troubleshooting Guide](./troubleshooting.md)
