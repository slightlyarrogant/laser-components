# Quick Start Guide

Get the Laser Components system up and running in minutes.

## Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- Git

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd laser_components
```

### 2. Run Setup Script

The setup script will handle most of the configuration automatically:

```bash
./setup.sh
```

This script will:
- Check Node.js version
- Install dependencies
- Set up environment files
- Run database migrations

### 3. Start the Development Server

```bash
# Start both frontend and backend
npm run start

# Or start them separately
npm run start:backend    # Starts backend on port 3001
npm run start:frontend   # Starts frontend on port 3000
```

## Validation

After installation, validate your environment:

```bash
npm run validate
```

This will check:
- Required files and directories
- Dependencies installation
- Configuration files

## First Steps

### 1. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### 2. Set Up Your Environment Files

Check these configuration files:
- `frontend/.env`
- `backend/.env`

### 3. Run Database Migrations

If not done automatically:

```bash
npx prisma migrate dev
```

## Task Management

The system includes a powerful task management CLI:

```bash
# List all tasks
npm run list

# Generate task files
npm run generate

# Parse a PRD document
npm run parse-prd --input=your-prd.txt
```

## Common Commands

```bash
# Development
npm run start           # Start full application
npm run dev            # Task management CLI
npm run validate       # Environment validation

# Code Quality
npm run lint           # Run ESLint
npm run format         # Format code with Prettier

# Database
npx prisma studio      # Open Prisma Studio
npx prisma db push     # Push schema changes
```

## Troubleshooting

### Port Already in Use
If ports 3000 or 3001 are in use:
1. Kill processes using those ports
2. Or modify the port configuration in package.json

### Missing Environment Variables
1. Copy `.env.example` to `.env` in both frontend and backend directories
2. Fill in the required values

### Node Version Issues
Ensure you're using Node.js 18 or higher:

```bash
node --version
```

## Next Steps

- Read the [System Setup Guide](./system-setup.md) for detailed configuration
- Explore the [Development Guide](./development-guide.md) for contribution guidelines
- Check the [API Documentation](./api-documentation.md) for integration details

## Support

For issues:
1. Check logs in console/terminal
2. Review the [Troubleshooting Guide](./troubleshooting.md)
3. Validate environment with `npm run validate`

---

Need help? Contact the development team.
