# Troubleshooting Guide

Common issues and solutions for the Laser Components system.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Development Server Issues](#development-server-issues)
3. [Database Issues](#database-issues)
4. [API and Network Issues](#api-and-network-issues)
5. [Task Management Issues](#task-management-issues)
6. [Build and Deployment Issues](#build-and-deployment-issues)
7. [Performance Issues](#performance-issues)
8. [Security Issues](#security-issues)

## Installation Issues

### Node.js Version Issues

**Problem**: Error about unsupported Node.js version
```
error @babel/core@7.17.9: The engine "node" is incompatible with this module.
```

**Solution**:
```bash
# Check current Node.js version
node --version

# Install Node.js 18+ using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### npm Install Failures

**Problem**: Package installation fails with permission errors
```
EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solution**:
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use nvm (recommended)
nvm install node
```

### Missing Dependencies

**Problem**: Module not found errors during startup
```
Cannot find module '@prisma/client'
```

**Solution**:
```bash
# Re-run setup script
./setup.sh

# Or install dependencies manually
npm install
cd frontend && npm install
cd ../backend && npm install

# Generate Prisma client
npx prisma generate
```

## Development Server Issues

### Port Already in Use

**Problem**: Error when starting development server
```
Error: listen EADDRINUSE :::3000
```

**Solution**:
```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or change port in package.json
PORT=3002 npm start
```

### Frontend Not Loading

**Problem**: Blank page or JavaScript errors in browser

**Solution**:
1. Check browser console for errors
2. Verify backend is running
3. Check proxy settings in `frontend/package.json`
```bash
# Check if backend is responding
curl http://localhost:3001/health

# Check frontend dev server logs
cd frontend && npm start
```

### Backend API Errors

**Problem**: 500 Internal Server Error on API calls

**Solution**:
```bash
# Check backend logs
npm run start:backend

# Verify environment variables
cat backend/.env

# Check database connection
npx prisma db pull
```

## Database Issues

### Connection Refused

**Problem**: Database connection errors
```
Can't reach database server at `localhost`:`5432`
```

**Solution**:
```bash
# Check if database is running
systemctl status postgresql  # Linux
brew services list postgres  # macOS

# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection manually
psql $DATABASE_URL
```

### Migration Issues

**Problem**: Migration fails or database out of sync
```
Database schema is not in sync with migrations
```

**Solution**:
```bash
# Reset database (development only)
npx prisma migrate reset

# Push schema changes
npx prisma db push

# Generate new migration
npx prisma migrate dev --name fix-schema
```

### Prisma Client Not Found

**Problem**: @prisma/client module not found
```
Cannot find module '@prisma/client'
```

**Solution**:
```bash
# Generate Prisma client
npx prisma generate

# Reinstall dependencies if needed
rm -rf node_modules
npm install
npx prisma generate
```

## API and Network Issues

### CORS Errors

**Problem**: Cross-origin request blocked
```
Access to fetch at 'http://localhost:3001/api/products' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution**:
```javascript
// backend/src/app.js
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

### Authentication Issues

**Problem**: JWT token invalid or expired

**Solution**:
```bash
# Check JWT secret in .env
grep JWT_SECRET backend/.env

# Clear localStorage (frontend)
localStorage.removeItem('token');

# Generate new JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### API Rate Limiting

**Problem**: Too many requests error
```
{"error": "Too many requests, please try again later"}
```

**Solution**:
1. Wait for rate limit to reset
2. Check rate limit configuration
```javascript
// backend/src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // increase if needed
});
```

## Task Management Issues

### AI API Key Issues

**Problem**: Task commands fail with authentication errors
```
Error: Authentication failed for Anthropic API
```

**Solution**:
```bash
# Verify API key is set
echo $ANTHROPIC_API_KEY

# Check .env file
grep ANTHROPIC_API_KEY .env

# Test API key
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
  https://api.anthropic.com/v1/messages \
  -X POST -d '{"max_tokens":10,"model":"claude-3-sonnet-20240229","messages":[{"role":"user","content":"test"}]}'
```

### Task Files Not Generating

**Problem**: `npm run dev generate` doesn't create task files

**Solution**:
```bash
# Check if tasks.json exists
ls -la tasks/tasks.json

# Verify permissions
chmod +x scripts/dev.js

# Check for errors
DEBUG=1 npm run dev generate
```

### Command Not Found

**Problem**: task-master command not recognized

**Solution**:
```bash
# Use npm scripts instead
npm run dev [command]

# Or run directly
node scripts/dev.js [command]

# Check if script is executable
chmod +x scripts/dev.js
```

## Build and Deployment Issues

### Frontend Build Fails

**Problem**: Build process errors
```
npm run build failed
```

**Solution**:
```bash
# Clear build cache
rm -rf frontend/build
rm -rf frontend/node_modules/.cache

# Check for TypeScript errors
cd frontend && npm run build

# Temporarily disable treat warnings as errors
CI=false npm run build
```

### Docker Issues

**Problem**: Docker container fails to start

**Solution**:
```bash
# Check Docker logs
docker logs [container-name]

# Rebuild without cache
docker-compose build --no-cache

# Verify environment variables
docker-compose config
```

### Environment Variables in Production

**Problem**: Environment variables not loaded in production

**Solution**:
```bash
# For Docker deployment
docker run -e NODE_ENV=production -e DATABASE_URL=... your-image

# For Heroku
heroku config:set NODE_ENV=production

# Verify variables are set
printenv | grep NODE_ENV
```

## Performance Issues

### Slow API Responses

**Problem**: API taking too long to respond

**Solutions**:
1. Add database indexing
```sql
CREATE INDEX products_category_idx ON products(category);
```

2. Implement pagination
```javascript
// backend/controllers/productController.js
const products = await prisma.product.findMany({
  skip: (page - 1) * limit,
  take: limit
});
```

3. Add caching
```javascript
// backend/middleware/cache.js
const redis = require('redis');
const client = redis.createClient();

const cache = (duration) => {
  return async (req, res, next) => {
    const key = req.originalUrl;
    const cached = await client.get(key);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    res.sendResponse = res.json;
    res.json = (body) => {
      client.setex(key, duration, JSON.stringify(body));
      res.sendResponse(body);
    };
    
    next();
  };
};
```

### Memory Leaks

**Problem**: Application memory usage growing over time

**Solution**:
```bash
# Monitor memory usage
node --inspect=9229 backend/src/server.js

# Use heap snapshots in Chrome DevTools
# chrome://inspect

# Check for common causes
# - Event listeners not being removed
# - Large objects not being garbage collected
# - Circular references
```

### Large Bundle Size

**Problem**: Frontend bundle too large

**Solution**:
```javascript
// frontend/webpack.config.js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin()
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          chunks: 'all',
        }
      }
    }
  }
};
```

## Security Issues

### SQL Injection Prevention

**Problem**: Potential SQL injection vulnerabilities

**Solution**:
```javascript
// Always use Prisma's type-safe queries
const user = await prisma.user.findFirst({
  where: {
    email: email // Automatically sanitized
  }
});

// Never do this:
// const user = await prisma.$queryRaw(`SELECT * FROM users WHERE email = ${email}`)
```

### XSS Prevention

**Problem**: Cross-site scripting vulnerabilities

**Solution**:
```javascript
// Use proper sanitization
import DOMPurify from 'dompurify';

const sanitizedHTML = DOMPurify.sanitize(userInput);

// React automatically escapes JSX
return <div>{userInput}</div>; // Safe

// Be careful with dangerouslySetInnerHTML
return <div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(html)}} />;
```

### HTTPS Configuration

**Problem**: Insecure HTTP in production

**Solution**:
```javascript
// backend/src/server.js
if (process.env.NODE_ENV === 'production') {
  // Redirect HTTP to HTTPS
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

## Common Error Messages and Solutions

### "Permission denied" errors

```bash
# Fix file permissions
sudo chown -R $(whoami):$(whoami) .
chmod -R 755 .

# Make scripts executable
chmod +x scripts/*.js
chmod +x setup.sh
```

### "Module not found" errors

```bash
# Check if module is installed
npm list package-name

# Reinstall specific package
npm uninstall package-name
npm install package-name

# Clear npm cache
npm cache clean --force
```

### "Command not found" errors

```bash
# Ensure you're in the correct directory
pwd

# Use npm scripts
npm run script-name

# Check package.json for available scripts
grep scripts package.json -A 10
```

## Getting Help

### Debug Information to Collect

When reporting issues, include:

1. **Environment information**:
```bash
node --version
npm --version
cat /etc/os-release  # Linux
sw_vers  # macOS
```

2. **Error logs**:
```bash
# Frontend console errors
# Browser DevTools → Console

# Backend logs
npm run start:backend 2>&1 | tee backend.log

# Task management logs
DEBUG=1 npm run dev [command] 2>&1 | tee task.log
```

3. **Configuration**:
```bash
# Environment variables (remove sensitive data)
env | grep -v SECRET | grep -v PASSWORD

# Package versions
npm list --depth=0
```

### Community Resources

- **GitHub Issues**: Check existing issues first
- **Documentation**: Review relevant guide sections
- **Stack Overflow**: Search using tags: `laser-components`, `react`, `express`, `prisma`

### Reporting Bugs

When creating a bug report:

1. **Title**: Clear, descriptive summary
2. **Steps to reproduce**: Exact steps that cause the issue
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Environment**: OS, Node version, browser, etc.
6. **Logs**: Relevant error messages and stack traces

### Feature Requests

For feature requests, include:

1. **Use case**: Why this feature is needed
2. **Proposed solution**: How you envision it working
3. **Alternatives**: Other solutions you've considered
4. **Impact**: Who would benefit from this feature

---

For more information:
- [System Setup Guide](./system-setup.md)
- [Development Guide](./development-guide.md)
- [Configuration Guide](./configuration.md)
