#!/usr/bin/env node

/**
 * Environment Validation Script
 * 
 * This script checks for common environment setup issues and reports them.
 * Run it with: node scripts/validate-env.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Paths to check
const requiredPaths = [
  { path: 'frontend/package.json', description: 'Frontend package configuration' },
  { path: 'frontend/.env', description: 'Frontend environment variables' },
  { path: 'scripts/modules', description: 'Script modules directory' },
  { path: 'scripts/modules/commands.js', description: 'Command modules for dev.js' },
  { path: 'tasks/tasks.json', description: 'Task configuration file' },
];

// Required dependencies
const requiredDependencies = [
  { name: 'react', type: 'frontend' },
  { name: '@mui/material', type: 'frontend' },
  { name: 'axios', type: 'frontend' },
  { name: 'express', type: 'backend' },
  { name: 'prisma', type: 'dev' },
];

// Required Node.js version
const requiredNodeVersion = 18;

console.log(`${colors.blue}=== Environment Validation ====${colors.reset}`);
console.log('Checking for common environment setup issues...\n');

// Validation results tracking
let issuesFound = 0;
let warningsFound = 0;
let passedChecks = 0;

/**
 * Check if a file or directory exists
 */
function checkPath(relativePath, description) {
  const fullPath = path.join(process.cwd(), relativePath);
  
  try {
    if (fs.existsSync(fullPath)) {
      console.log(`${colors.green}✓ Found ${description}${colors.reset}`);
      passedChecks++;
      return true;
    } else {
      console.log(`${colors.red}✗ Missing ${description} at ${relativePath}${colors.reset}`);
      issuesFound++;
      return false;
    }
  } catch (err) {
    console.log(`${colors.red}✗ Error checking ${description}: ${err.message}${colors.reset}`);
    issuesFound++;
    return false;
  }
}

/**
 * Check Node.js version
 */
function checkNodeVersion() {
  try {
    const nodeVersionOutput = execSync('node --version').toString().trim();
    const versionMatch = nodeVersionOutput.match(/v(\d+)\.\d+\.\d+/);
    
    if (versionMatch && versionMatch[1]) {
      const majorVersion = parseInt(versionMatch[1], 10);
      
      if (majorVersion >= requiredNodeVersion) {
        console.log(`${colors.green}✓ Node.js version ${nodeVersionOutput} (meets minimum requirement of v${requiredNodeVersion})${colors.reset}`);
        passedChecks++;
        return true;
      } else {
        console.log(`${colors.red}✗ Node.js version ${nodeVersionOutput} is below required v${requiredNodeVersion}${colors.reset}`);
        issuesFound++;
        return false;
      }
    } else {
      console.log(`${colors.red}✗ Could not determine Node.js version from output: ${nodeVersionOutput}${colors.reset}`);
      issuesFound++;
      return false;
    }
  } catch (err) {
    console.log(`${colors.red}✗ Error checking Node.js version: ${err.message}${colors.reset}`);
    issuesFound++;
    return false;
  }
}

/**
 * Check for required dependencies in package.json
 */
function checkDependencies() {
  const types = {
    frontend: {
      path: 'frontend/package.json',
      description: 'Frontend'
    },
    backend: {
      path: 'package.json',
      description: 'Backend'
    },
    dev: {
      path: 'package.json',
      description: 'Development'
    }
  };
  
  // Group dependencies by type
  const dependenciesByType = {};
  for (const type of Object.keys(types)) {
    dependenciesByType[type] = requiredDependencies.filter(d => d.type === type);
  }
  
  // Check each type
  for (const [type, deps] of Object.entries(dependenciesByType)) {
    if (deps.length === 0) continue;
    
    const filePath = types[type].path;
    const fullPath = path.join(process.cwd(), filePath);
    
    try {
      if (!fs.existsSync(fullPath)) {
        console.log(`${colors.yellow}⚠ Cannot check ${types[type].description} dependencies - ${filePath} not found${colors.reset}`);
        warningsFound++;
        continue;
      }
      
      const packageJson = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const allDeps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {})
      };
      
      for (const dep of deps) {
        if (allDeps[dep.name]) {
          console.log(`${colors.green}✓ Found ${dep.name} in ${filePath}${colors.reset}`);
          passedChecks++;
        } else {
          console.log(`${colors.red}✗ Missing ${dep.name} in ${filePath}${colors.reset}`);
          issuesFound++;
        }
      }
    } catch (err) {
      console.log(`${colors.red}✗ Error checking dependencies in ${filePath}: ${err.message}${colors.reset}`);
      issuesFound++;
    }
  }
}

/**
 * Run all validation checks
 */
function runValidation() {
  // Check Node.js version
  checkNodeVersion();
  console.log('');
  
  // Check for required paths
  console.log(`${colors.blue}Checking for required files and directories:${colors.reset}`);
  for (const { path, description } of requiredPaths) {
    checkPath(path, description);
  }
  console.log('');
  
  // Check dependencies
  console.log(`${colors.blue}Checking for required dependencies:${colors.reset}`);
  checkDependencies();
  console.log('');
  
  // Print summary
  console.log(`${colors.blue}=== Validation Summary ====${colors.reset}`);
  console.log(`${colors.green}✓ ${passedChecks} checks passed${colors.reset}`);
  
  if (warningsFound > 0) {
    console.log(`${colors.yellow}⚠ ${warningsFound} warnings found${colors.reset}`);
  }
  
  if (issuesFound > 0) {
    console.log(`${colors.red}✗ ${issuesFound} issues found${colors.reset}`);
    console.log('\nPlease fix these issues to ensure proper environment setup.');
    console.log('You can run the setup script with:');
    console.log('  ./setup.sh');
    process.exit(1);
  } else if (warningsFound > 0) {
    console.log('\nEnvironment setup has minor issues that might need attention.');
    process.exit(0);
  } else {
    console.log('\nEnvironment setup looks good!');
    process.exit(0);
  }
}

// Run the validation
runValidation(); 