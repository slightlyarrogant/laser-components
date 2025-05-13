# Laser Components System Documentation

Welcome to the Laser Components system documentation. This intelligent database application specializes in laser component products with deep research capabilities and prospect identification.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start Guide](./quick-start.md)
4. [System Setup](./system-setup.md)
5. [API Documentation](./api-documentation.md)
6. [Task Management System](./task-management.md)
7. [Development Guide](./development-guide.md)
8. [Configuration](./configuration.md)
9. [Deployment](./deployment.md)
10. [Troubleshooting](./troubleshooting.md)

## Overview

The Laser Components system is a full-stack application designed to:

- **Manage Product Catalogs**: Store and organize laser component products with detailed specifications
- **Application Mapping**: Create relationships between products and their industrial applications
- **Lead Discovery**: Identify potential prospects through intelligent research
- **Lead Enrichment**: Enhance lead data with external sources and scoring systems
- **Region-Based Search**: Provide location-specific search capabilities
- **Analytics Dashboard**: Track system usage and performance metrics

## Architecture

### Frontend
- **Framework**: React 18
- **UI Library**: Material-UI (MUI)
- **State Management**: React Context API
- **Build Tool**: React Scripts (Create React App)

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Prisma ORM (supports multiple databases)
- **AI Integration**: 
  - Anthropic Claude API
  - Perplexity AI (for research)

### Task Management
- **CLI Tool**: Node.js-based task management system
- **Features**: Task parsing, subtask generation, dependency management
- **AI-Powered**: Uses Claude for task analysis and generation

## Key Features

### 1. Product Management
- Bulk import/export capabilities
- Advanced search and filtering
- Detailed product specifications
- Support for custom fields

### 2. Application Mapping
- Many-to-many relationships between products and applications
- Industry-specific categorization
- Custom mapping rules

### 3. Lead Management
- Automated lead discovery
- Duplicate detection and prevention
- Lead scoring and enrichment
- Export functionality

### 4. User Management
- Role-based access control
- User permissions system
- Authentication and authorization

### 5. Analytics
- Usage tracking
- Performance metrics
- Customizable dashboards

## Getting Started

1. **Setup**: Run `./setup.sh` to initialize the project
2. **Validation**: Use `npm run validate` to check environment
3. **Development**: Start with `npm run start`
4. **Task Management**: Use `npm run dev` for task operations

## Documentation Structure

This documentation is organized into several sections:

- **[Quick Start Guide](./quick-start.md)**: Get up and running quickly
- **[System Setup](./system-setup.md)**: Detailed installation and configuration
- **[API Documentation](./api-documentation.md)**: Complete API reference
- **[Task Management](./task-management.md)**: Using the task management system
- **[Development Guide](./development-guide.md)**: Contributing and development workflows

## Support

For issues and questions:
1. Check the [Troubleshooting Guide](./troubleshooting.md)
2. Review the FAQ section
3. Contact the development team

---

Last Updated: May 2025
