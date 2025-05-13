# System Setup Guide

Comprehensive guide for setting up the Laser Components system.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [API Keys Configuration](#api-keys-configuration)
5. [Development Environment](#development-environment)
6. [Production Setup](#production-setup)
7. [Verification](#verification)

## Prerequisites

### System Requirements

- **Node.js**: Version 18.x or higher
- **npm**: Comes with Node.js
- **Git**: For version control
- **Database**: PostgreSQL, MySQL, SQLite, or SQL Server (via Prisma)

### Required Tools

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Install if missing
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

## Environment Setup

### 1. Project Structure

After cloning, your project should look like:

```
laser_components/
├── frontend/
├── backend/
├── scripts/
├── docs/
├── prisma/
├── tasks/
├── package.json
└── setup.sh
```

### 2. Root Configuration

Create or verify these files in the project root:

#### `.env`
```bash
# Root environment variables
NODE_ENV=development
DEBUG=false
LOG_LEVEL=info
```

#### `.gitignore`
```
# Dependencies
node_modules/
frontend/node_modules/
backend/node_modules/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
build/
dist/
frontend/build/

# Logs
*.log
logs/

# Database
*.db
*.sqlite

# Task files
tasks/task_*.txt
```

## Database Configuration

### 1. Prisma Setup

The system uses Prisma as the ORM. Configuration is in `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // or "mysql", "sqlite", "sqlserver"
  url      = env("DATABASE_URL")
}
```

### 2. Database URL Configuration

In `backend/.env`:

```bash
# PostgreSQL example
DATABASE_URL="postgresql://username:password@localhost:5432/laser_components"

# MySQL example
DATABASE_URL="mysql://username:password@localhost:3306/laser_components"

# SQLite example (for development)
DATABASE_URL="file:./dev.db"
```

### 3. Run Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (if seed file exists)
npx prisma db seed
```

## API Keys Configuration

### Backend Environment (`backend/.env`)

```bash
# Database
DATABASE_URL="your_database_url"

# AI Services
ANTHROPIC_API_KEY="your_anthropic_api_key"
PERPLEXITY_API_KEY="your_perplexity_api_key"

# Server Configuration
PORT=3001
HOST=localhost

# JWT Secret (generate a secure one)
JWT_SECRET="your_secure_jwt_secret"

# Logging
LOG_LEVEL=info
DEBUG=false

# AI Model Configuration
MODEL="claude-3-7-sonnet-20250219"
MAX_TOKENS=4000
TEMPERATURE=0.7
PERPLEXITY_MODEL="sonar-medium-online"
```

### Frontend Environment (`frontend/.env`)

```bash
# API Configuration
REACT_APP_API_URL=http://localhost:3001
REACT_APP_API_VERSION=v1

# Feature Flags
REACT_APP_ENABLE_DEBUG=false
REACT_APP_ENVIRONMENT=development

# Additional Configuration
GENERATE_SOURCEMAP=false
SKIP_PREFLIGHT_CHECK=true
```

## Development Environment

### 1. Install Dependencies

```bash
# Root dependencies
npm install

# Frontend dependencies
cd frontend && npm install

# Backend dependencies
cd backend && npm install
```

### 2. Development Scripts

Available in root `package.json`:

```json
{
  "scripts": {
    "dev": "node scripts/dev.js",
    "start": "concurrently \"npm run start:backend\" \"npm run start:frontend\"",
    "start:backend": "node backend/src/server.js",
    "start:frontend": "cd frontend && npm start",
    "validate": "node scripts/validate-env.js",
    "setup": "./setup.sh"
  }
}
```

### 3. Task Management Setup

The system includes a CLI-based task management system:

```bash
# Initialize task system
npm run dev init

# Validate task configuration
npm run dev list --help
```

## Production Setup

### 1. Build Process

```bash
# Build frontend
cd frontend && npm run build

# The build will be available in frontend/build/
```

### 2. Environment Variables

For production, ensure all environment variables are properly set:

```bash
# Check required variables
npm run validate

# Set production environment
export NODE_ENV=production
```

### 3. Process Management

Consider using PM2 for production:

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
pm2 init

# Configure ecosystem.config.js
```

Example `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'laser-components-backend',
    script: 'backend/src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
```

## Verification

### 1. Environment Validation

Run the validation script:

```bash
npm run validate
```

Expected output:
```
=== Environment Validation ====
✓ Node.js v18.x.x (meets minimum requirement of v18)
✓ Found Frontend package configuration
✓ Found Frontend environment variables
✓ Found Script modules directory
...
✓ X checks passed
Environment setup looks good!
```

### 2. Health Checks

Test the application:

```bash
# Start the application
npm run start

# Check frontend (in another terminal)
curl http://localhost:3000

# Check backend API
curl http://localhost:3001/health
```

### 3. Task System Verification

```bash
# List available commands
npm run dev --help

# Test task listing
npm run dev list
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in package.json or kill processes
2. **Missing dependencies**: Run `npm install` in all directories
3. **Database connection**: Verify DATABASE_URL and database server status
4. **Environment variables**: Ensure all required .env files exist

### Debug Mode

Enable debug logging:

```bash
# Enable debug in .env
DEBUG=true
LOG_LEVEL=debug

# Run with debug
DEBUG=1 npm run start
```

## Next Steps

1. Read the [API Documentation](./api-documentation.md)
2. Explore the [Development Guide](./development-guide.md)
3. Review the [Task Management Guide](./task-management.md)

---

For more help, see the [Troubleshooting Guide](./troubleshooting.md).
