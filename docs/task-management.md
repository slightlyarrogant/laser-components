# Task Management System Documentation

The Laser Components project includes a sophisticated AI-powered task management system designed for development workflows.

## Overview

The task management system (`scripts/dev.js`) provides a CLI interface for:
- Parsing PRD documents into manageable tasks
- Creating and organizing subtasks
- Managing task dependencies
- Tracking progress and status
- Analyzing task complexity
- Generating task documentation

## Architecture

### Core Components

1. **Main Entry Point**: `scripts/dev.js`
2. **Command Handlers**: `scripts/modules/commands.js`
3. **Configuration**: Environment variables and `.env` files
4. **Data Storage**: `tasks/tasks.json`
5. **Task Files**: Individual `task_*.txt` files

## Getting Started

### Installation

The task system is automatically set up with the main project:

```bash
./setup.sh
```

### Basic Usage

```bash
# Use npm scripts (recommended)
npm run dev [command] [options]

# Or run directly
node scripts/dev.js [command] [options]
```

## Available Commands

### 1. Initialize Project

```bash
npm run dev init
```

Sets up a new project with basic configuration.

### 2. Parse PRD Document

```bash
npm run dev parse-prd --input=path/to/prd.txt
```

Converts a Product Requirements Document into structured tasks.

### 3. List Tasks

```bash
# List all tasks
npm run dev list

# Filter by status
npm run dev list --status=pending

# Include subtasks
npm run dev list --with-subtasks

# Filter with subtasks
npm run dev list --status=pending --with-subtasks
```

### 4. Generate Task Files

```bash
npm run dev generate

# Custom output directory
npm run dev generate --output=custom/path
```

Creates individual task files from `tasks.json`.

### 5. Set Task Status

```bash
# Update single task
npm run dev set-status --id=3 --status=done

# Update multiple tasks
npm run dev set-status --id=1,2,3 --status=pending

# Update subtask
npm run dev set-status --id=3.1 --status=done
```

### 6. Show Task Details

```bash
# Show specific task
npm run dev show 1

# Alternative syntax
npm run dev show --id=1
```

### 7. Expand Tasks into Subtasks

```bash
# Expand specific task with default subtasks
npm run dev expand --id=3

# Specify number of subtasks
npm run dev expand --id=3 --num=5

# Add context for expansion
npm run dev expand --id=3 --prompt="Focus on security aspects"

# Expand all pending tasks
npm run dev expand --all

# Use AI research for better subtasks
npm run dev expand --id=3 --research
```

### 8. Analyze Task Complexity

```bash
# Analyze all tasks
npm run dev analyze-complexity

# Custom output file
npm run dev analyze-complexity --output=custom-report.json

# Set complexity threshold
npm run dev analyze-complexity --threshold=6

# Use research for analysis
npm run dev analyze-complexity --research
```

### 9. Find Next Task

```bash
npm run dev next
```

Determines the next task to work on based on dependencies and status.

### 10. Clear Subtasks

```bash
# Clear subtasks from specific task
npm run dev clear-subtasks --id=3

# Clear subtasks from multiple tasks
npm run dev clear-subtasks --id=1,2,3

# Clear all subtasks
npm run dev clear-subtasks --all
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required
ANTHROPIC_API_KEY="your_anthropic_api_key"

# Optional
MODEL="claude-3-7-sonnet-20250219"
MAX_TOKENS=4000
TEMPERATURE=0.7
PERPLEXITY_API_KEY="your_perplexity_api_key"
PERPLEXITY_MODEL="sonar-medium-online"
DEBUG=false
LOG_LEVEL=info
DEFAULT_SUBTASKS=3
DEFAULT_PRIORITY=medium
PROJECT_NAME="Your Project Name"
PROJECT_VERSION="1.0.0"
```

### Task Data Structure

The `tasks/tasks.json` file structure:

```json
{
  "meta": {
    "version": "1.0.0",
    "lastModified": "2023-06-15T10:30:00.000Z",
    "projectName": "Laser Components",
    "prdSource": "PRD.txt"
  },
  "tasks": [
    {
      "id": 1,
      "title": "Task Title",
      "description": "Detailed description",
      "status": "pending",
      "priority": "high",
      "dependencies": [2, 3],
      "subtasks": [
        {
          "id": "1.1",
          "title": "Subtask Title",
          "description": "Subtask description",
          "status": "pending"
        }
      ],
      "tags": ["api", "backend"],
      "estimatedHours": 8,
      "complexity": 7
    }
  ]
}
```

## Best Practices

### 1. Task Organization

- Keep task descriptions clear and actionable
- Use meaningful task titles
- Set appropriate priorities
- Define dependencies carefully

### 2. Status Management

- Mark tasks as 'done' when completed
- Use 'in-progress' for current work
- Leave 'pending' for future tasks
- Use 'deferred' for postponed tasks

### 3. Subtask Usage

- Break complex tasks into subtasks
- Keep subtasks focused and specific
- Aim for subtasks that can be completed in 2-4 hours
- Use the `--research` flag for better AI-generated subtasks

### 4. Dependency Management

- Define dependencies early
- Validate dependencies regularly
- Use `npm run dev next` to find ready tasks
- Fix dependencies with `npm run dev fix-dependencies`

## Advanced Features

### 1. Complexity Analysis

The system can analyze task complexity and recommend subtask counts:

```bash
npm run dev analyze-complexity
```

This generates a report showing:
- Complexity scores (1-10)
- Recommended subtask counts
- Expansion prompts
- Ready-to-use expansion commands

### 2. Research-Backed Generation

Use Perplexity AI for more informed task generation:

```bash
npm run dev expand --id=3 --research
npm run dev analyze-complexity --research
```

### 3. Batch Operations

Many commands support batch operations:

```bash
# Set multiple task statuses
npm run dev set-status --id=1,2,3,4 --status=done

# Clear subtasks from multiple tasks
npm run dev clear-subtasks --id=5,6,7
```

## Integration with Development Workflow

### 1. With Cursor IDE

The task system is designed to work well with Cursor:

1. Generate task files with `npm run dev generate`
2. Copy task descriptions to Cursor prompts
3. Update task status as you progress
4. Use complexity analysis to plan work

### 2. With Git Workflow

```bash
# Before starting work
npm run dev next

# After completing task
npm run dev set-status --id=X --status=done
git commit -m "Complete task X: [task title]"
```

### 3. Continuous Integration

Add validation to your CI/CD:

```bash
# In your CI script
npm run dev validate-dependencies
npm run dev list --status=pending
```

## Troubleshooting

### Common Issues

1. **Missing API Keys**
   ```bash
   # Check configuration
   npm run dev list --help
   
   # Verify .env file exists
   ls -la .env
   ```

2. **Command Not Found**
   ```bash
   # Use npm scripts
   npm run dev [command]
   
   # Not direct execution
   node scripts/dev.js [command]
   ```

3. **Task Dependencies Issues**
   ```bash
   # Validate dependencies
   npm run dev validate-dependencies
   
   # Fix automatically
   npm run dev fix-dependencies
   ```

### Debug Mode

Enable detailed logging:

```bash
# Set in .env
DEBUG=true
LOG_LEVEL=debug

# Or run with debug
DEBUG=1 npm run dev [command]
```

## Examples

### Complete Workflow Example

```bash
# 1. Parse a PRD
npm run dev parse-prd --input=requirements.txt

# 2. List generated tasks
npm run dev list

# 3. Expand complex tasks
npm run dev expand --all --research

# 4. Find next task to work on
npm run dev next

# 5. Start working on task 1
npm run dev set-status --id=1 --status=in-progress

# 6. Mark first subtask as done
npm run dev set-status --id=1.1 --status=done

# 7. Complete the task
npm run dev set-status --id=1 --status=done

# 8. Generate updated task files
npm run dev generate
```

## Extensions and Customization

The task system is modular and can be extended:

1. **Custom Commands**: Add new commands in `scripts/modules/commands.js`
2. **Custom Parsers**: Create specialized PRD parsers
3. **Integration Hooks**: Add webhooks for external systems
4. **Custom Reports**: Create specialized reporting functions

---

For more information, see:
- [API Documentation](./api-documentation.md)
- [Development Guide](./development-guide.md)
- [Configuration Guide](./configuration.md)
