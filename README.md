# Laser Components - Lead Generation Platform

A comprehensive platform for managing laser component products, applications, and lead generation.

## Features

- Product catalog management with categories and subcategories
- Application mapping interface for associating products with applications
- Region-based search functionality for finding organizations
- Lead discovery, enrichment, and scoring
- Lead management interface with advanced filtering and sorting
- Lead export functionality with CSV and Excel support
- User management with role-based permissions

## Prerequisites

- Node.js v18 or higher
- PostgreSQL (recommended) or other supported database
- npm or yarn package manager

## Getting Started

### Quick Setup

The easiest way to set up your development environment is by using the setup script:

```bash
# Make the script executable (if needed)
chmod +x setup.sh

# Run the setup script
./setup.sh
```

This script will:
1. Check if your Node.js version is compatible
2. Install project dependencies
3. Set up environment files
4. Install frontend dependencies
5. Apply database migrations (if configured)

### Manual Setup

If you prefer to set up manually, follow these steps:

1. Install dependencies:
```bash
   npm install
   ```

2. Set up frontend:
```bash
   cd frontend
   npm install
   cp .env.example .env
   # Edit .env with your settings
   ```

3. Set up backend:
```bash
   cd backend
   cp .env.example .env
   # Edit .env with your database credentials and other settings
   npx prisma migrate dev
```

## Running the Application

You can run the application using npm scripts:

```bash
# Start both frontend and backend
npm run start

# Start only the frontend
npm run start:frontend

# Start only the backend
npm run start:backend
```

## Development

### Task Management

This project uses task-master for managing development tasks:

```bash
# List all tasks
task-master list

# Show task details
task-master show <task-id>

# Update task status
task-master set-status --id=<task-id> --status=<status>
```

### Project Structure

```
laser_components/
├── backend/            # Backend API server
│   ├── src/            # Source code
│   ├── prisma/         # Database schema and migrations
│   └── tests/          # Backend tests
├── frontend/           # React frontend application
│   ├── public/         # Static assets
│   ├── src/            # React components and logic
│   └── tests/          # Frontend tests
├── scripts/            # Development and utility scripts
├── tasks/              # Task definitions and documentation
└── docs/               # Documentation files
```

## Contributing

1. Create a new branch for your feature or bugfix
2. Use the task-master to track your progress
3. Submit a pull request with a clear description of your changes

## License

[MIT License](LICENSE)