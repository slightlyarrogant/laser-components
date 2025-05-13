# Deployment Guide

Comprehensive guide for deploying the Laser Components system to production environments.

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Preparation](#environment-preparation)
4. [Docker Deployment](#docker-deployment)
5. [Cloud Platform Deployments](#cloud-platform-deployments)
6. [Traditional Server Deployment](#traditional-server-deployment)
7. [Database Setup](#database-setup)
8. [SSL/HTTPS Configuration](#ssl-https-configuration)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Maintenance and Updates](#maintenance-and-updates)

## Deployment Overview

The Laser Components system consists of:
- **Frontend**: React application (static files)
- **Backend**: Node.js/Express API server
- **Database**: PostgreSQL (or supported alternative)
- **Task Management**: CLI tools for task processing

### Architecture Options

1. **Containerized Deployment** (Recommended)
   - Docker + Docker Compose
   - Kubernetes
   - Container orchestration platforms

2. **Platform as a Service (PaaS)**
   - Heroku
   - Vercel (frontend)
   - Railway
   - Render

3. **Traditional Server**
   - Ubuntu/CentOS VPS
   - Nginx reverse proxy
   - PM2 process manager

## Prerequisites

### System Requirements

- **CPU**: 2+ cores
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 50GB minimum
- **OS**: Ubuntu 20.04 LTS (recommended) or CentOS 8

### Software Requirements

```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker (if using containerization)
curl -sSL https://get.docker.com | sh

# Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Nginx (if using reverse proxy)
sudo apt-get install nginx

# PostgreSQL (if not using containerized DB)
sudo apt-get install postgresql postgresql-contrib
```

## Environment Preparation

### Production Environment Variables

Create a `.env.production` file:

```bash
# Application
NODE_ENV=production
LOG_LEVEL=warn

# Server
PORT=3001
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://username:password@database:5432/laser_components_prod

# Security
JWT_SECRET=your_secure_jwt_secret_here
JWT_EXPIRATION=24h
BCRYPT_SALT_ROUNDS=12

# APIs
ANTHROPIC_API_KEY=your_anthropic_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# External Services
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password

# Security
CORS_ORIGIN=https://yourdomain.com
SSL_CERT_PATH=/etc/ssl/certs/cert.pem
SSL_KEY_PATH=/etc/ssl/private/key.pem
```

### Frontend Environment

Create `frontend/.env.production`:

```bash
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_ENV=production
GENERATE_SOURCEMAP=false
```

## Docker Deployment

### Docker Compose Setup

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    ports:
      - "80:80"
      - "443:443"
    environment:
      - REACT_APP_API_URL=https://api.yourdomain.com
    volumes:
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend

  # Backend
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile.prod
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@database:5432/laser_components
      - JWT_SECRET=${JWT_SECRET}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - database
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs

  # Database
  database:
    image: postgres:15-alpine
    restart: always
    environment:
      - POSTGRES_DB=laser_components
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"

  # Redis (for caching)
  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Production Dockerfiles

#### Frontend Dockerfile (`frontend/Dockerfile.prod`)

```dockerfile
# Multi-stage build for React app
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY public ./public
COPY src ./src
COPY .env.production ./

RUN npm run build

# Production image with Nginx
FROM nginx:alpine

# Copy built app
COPY --from=builder /app/build /usr/share/nginx/html

# Copy Nginx configuration
COPY nginx.prod.conf /etc/nginx/conf.d/default.conf

# Copy SSL certificates (if using HTTPS)
COPY ssl/ /etc/nginx/ssl/

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
```

#### Backend Dockerfile (`backend/Dockerfile.prod`)

```dockerfile
FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force
RUN cd backend && npm ci --only=production && npm cache clean --force

# Copy application files
COPY backend ./backend
COPY prisma ./prisma
COPY scripts ./scripts

# Generate Prisma client
RUN npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:backend"]
```

### Nginx Configuration (`frontend/nginx.prod.conf`)

```nginx
upstream backend {
    server backend:3001;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS configuration
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static assets caching
    location /static {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Deployment Commands

```bash
# Create environment file with secrets
echo "DB_PASSWORD=your_secure_password" > .env
echo "JWT_SECRET=$(openssl rand -hex 64)" >> .env
echo "REDIS_PASSWORD=your_redis_password" >> .env

# Build and start containers
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Check if containers are running
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f backend
```

## Cloud Platform Deployments

### Heroku Deployment

#### Prepare for Heroku

1. Create `Procfile`:
```
web: npm run start:backend
release: npx prisma migrate deploy && npx prisma generate
```

2. Create `app.json`:
```json
{
  "name": "laser-components",
  "description": "Laser Components Management System",
  "repository": "https://github.com/yourusername/laser-components",
  "stack": "heroku-22",
  "env": {
    "NODE_ENV": "production",
    "JWT_SECRET": {
      "generator": "secret"
    },
    "ANTHROPIC_API_KEY": {
      "description": "Anthropic API key for AI functionality"
    }
  },
  "addons": [
    {
      "plan": "heroku-postgresql:mini"
    },
    {
      "plan": "heroku-redis:mini"
    }
  ],
  "buildpacks": [
    {
      "url": "heroku/nodejs"
    }
  ]
}
```

#### Deploy to Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -hex 64)
heroku config:set ANTHROPIC_API_KEY=your_api_key

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# Deploy
git push heroku main

# Run migrations
heroku run npx prisma migrate deploy
```

### Vercel Deployment (Frontend)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "build" }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "https://your-backend-url.com/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "REACT_APP_API_URL": "https://your-backend-url.com"
  }
}
```

3. Deploy:
```bash
cd frontend
vercel --prod
```

### AWS Deployment

#### Using AWS ECS

1. Create ECS cluster
2. Create task definitions for frontend and backend
3. Set up Application Load Balancer
4. Configure RDS for PostgreSQL

#### Using AWS Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize EB
eb init

# Create environment
eb create production

# Deploy
eb deploy
```

## Traditional Server Deployment

### Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Create application user
sudo adduser --disabled-password --gecos "" laser-components
sudo usermod -aG sudo laser-components

# Switch to app user
sudo su - laser-components

# Clone repository
git clone https://github.com/yourusername/laser-components.git
cd laser-components

# Install dependencies
./setup.sh
```

### Process Management with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'laser-backend',
      script: 'backend/src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      log_file: '/var/log/laser-components/combined.log',
      out_file: '/var/log/laser-components/out.log',
      error_file: '/var/log/laser-components/error.log',
      time: true
    }
  ]
};
EOF

# Start application
pm2 start ecosystem.config.js --env production

# Setup startup script
pm2 startup
pm2 save

# Monitor
pm2 monit
```

### Nginx Configuration

```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/laser-components << 'EOF'
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/laser-components /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Database Setup

### PostgreSQL Configuration

```bash
# Create database and user
sudo -u postgres psql << 'EOF'
CREATE DATABASE laser_components_prod;
CREATE USER laser_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE laser_components_prod TO laser_user;
ALTER USER laser_user CREATEDB;
\q
EOF

# Run migrations
cd /app/laser-components
DATABASE_URL="postgresql://laser_user:your_password@localhost:5432/laser_components_prod" npx prisma migrate deploy
```

### Database Backup

```bash
# Create backup script
sudo tee /usr/local/bin/backup-laser-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/laser-components"
mkdir -p $BACKUP_DIR

pg_dump -h localhost -U laser_user -d laser_components_prod | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
EOF

sudo chmod +x /usr/local/bin/backup-laser-db.sh

# Add to crontab (daily backup at 2 AM)
echo "0 2 * * * /usr/local/bin/backup-laser-db.sh" | sudo crontab -
```

## SSL/HTTPS Configuration

### Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (usually set up automatically)
echo "0 12 * * * certbot renew --quiet" | sudo crontab -
```

### Custom SSL Certificate

```bash
# Create SSL directory
sudo mkdir -p /etc/ssl/laser-components

# Copy your certificates
sudo cp your-cert.pem /etc/ssl/laser-components/cert.pem
sudo cp your-key.pem /etc/ssl/laser-components/key.pem

# Set proper permissions
sudo chmod 644 /etc/ssl/laser-components/cert.pem
sudo chmod 600 /etc/ssl/laser-components/key.pem
```

## Monitoring and Logging

### Centralized Logging

```bash
# Install rsyslog for log forwarding
sudo apt install rsyslog

# Configure log rotation
sudo tee /etc/logrotate.d/laser-components << 'EOF'
/var/log/laser-components/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 laser-components laser-components
    postrotate
        pm2 reload all
    endscript
}
EOF
```

### Health Monitoring

```bash
# Create health check script
sudo tee /usr/local/bin/health-check.sh << 'EOF'
#!/bin/bash
HEALTH_URL="http://localhost:3001/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -ne 200 ]; then
    echo "Health check failed: $RESPONSE"
    # Restart PM2 process
    pm2 restart laser-backend
    # Send alert (email, Slack, etc.)
fi
EOF

sudo chmod +x /usr/local/bin/health-check.sh

# Run every 5 minutes
echo "*/5 * * * * /usr/local/bin/health-check.sh" | crontab -
```

### Monitoring with Prometheus

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=your_password

volumes:
  prometheus_data:
  grafana_data:
```

## Maintenance and Updates

### Update Procedure

1. **Create backup**:
```bash
./scripts/backup.sh
```

2. **Deploy new version**:
```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Run database migrations
npx prisma migrate deploy

# Rebuild and restart
pm2 reload all
```

3. **Zero-downtime deployment**:
```bash
# Using PM2 cluster mode
pm2 reload laser-backend --update-env
```

### Rollback Procedure

```bash
# Revert to previous version
git revert HEAD
pm2 reload all

# Or rollback database if needed
psql $DATABASE_URL < /backups/latest.sql
```

### Security Updates

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update system packages
sudo apt update && sudo apt upgrade
```

## Performance Optimization

### Application-Level Optimization

```javascript
// Enable compression
const compression = require('compression');
app.use(compression());

// Optimize database queries
const products = await prisma.product.findMany({
  select: {
    id: true,
    name: true,
    price: true,
    // Only select needed fields
  },
  include: {
    applications: {
      select: {
        id: true,
        name: true
      }
    }
  }
});
```

### Server-Level Optimization

```bash
# Increase file descriptor limits
echo "laser-components soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "laser-components hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimize PostgreSQL
sudo tee -a /etc/postgresql/13/main/postgresql.conf << 'EOF'
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
EOF

sudo systemctl restart postgresql
```

## Security Checklist

- [ ] Regular security updates
- [ ] Strong passwords/secrets
- [ ] HTTPS/SSL enabled
- [ ] Firewall configured
- [ ] Database access restricted
- [ ] Regular backups
- [ ] Monitoring in place
- [ ] Log analysis setup
- [ ] Rate limiting configured
- [ ] Input validation enabled

---

For more information:
- [Configuration Guide](./configuration.md)
- [Development Guide](./development-guide.md)
- [Troubleshooting Guide](./troubleshooting.md)
