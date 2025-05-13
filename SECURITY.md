# Security Guide: Protecting Sensitive Data

This guide covers how to properly handle sensitive data in the Laser Components project.

## 🔐 Environment Variables

### DO NOT commit these files:
- `.env`
- `.env.local`
- `.env.production`
- `frontend/.env`
- `backend/.env`

### DO commit these files:
- `.env.example`
- `frontend/.env.example`
- `backend/.env.example`

## 🛡️ Setting up your local environment

### 1. Copy example files
```bash
# Root directory
cp .env.example .env

# Frontend
cp frontend/.env.example frontend/.env

# Backend
cp backend/.env.example backend/.env
```

### 2. Fill in your actual values
Edit each `.env` file and replace placeholder values with real ones:

```bash
# In .env
ANTHROPIC_API_KEY=sk-ant-api03-xxx  # Your actual API key

# In backend/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/laser_components
JWT_SECRET=your-super-secret-jwt-key
```

## 🔑 Managing API Keys

### Anthropic API Key
1. Go to https://console.anthropic.com/
2. Create an API key
3. Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-api03-...`

### Perplexity API Key
1. Go to https://www.perplexity.ai/settings/api
2. Create an API key
3. Add to `.env`: `PERPLEXITY_API_KEY=pplx-...`

### JWT Secret
Generate a secure secret:
```bash
# Generate a random secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 📋 Pre-commit checklist

Before committing, always check:

1. **No secrets in code**
   ```bash
   # Search for potential secrets
   grep -r "sk-ant-api" . --exclude-dir=node_modules
   grep -r "pplx-" . --exclude-dir=node_modules
   grep -r "postgresql://" . --exclude-dir=node_modules
   ```

2. **No .env files staged**
   ```bash
   git status
   # Ensure no .env files are listed
   ```

3. **Example files are updated**
   - If you add new environment variables, update the `.env.example` files

## 🚫 What NEVER to commit

- API keys
- Database passwords
- JWT secrets
- SSL certificates/private keys
- Any `.env` files
- Local database files (SQLite)
- Personal access tokens
- Email passwords

## ✅ Safe practices

1. **Use environment variables for all secrets**
   ```javascript
   // Good
   const apiKey = process.env.ANTHROPIC_API_KEY;
   
   // Bad
   const apiKey = 'sk-ant-api03-...';
   ```

2. **Check .env files are ignored**
   ```bash
   git check-ignore .env
   # Should output: .env
   ```

3. **Use different secrets for different environments**
   - Development secrets
   - Staging secrets
   - Production secrets

## 🔄 If you accidentally commit secrets

### If not pushed yet:
```bash
# Remove from last commit
git reset --soft HEAD~1
git reset HEAD .env
git commit -m "Your commit message"
```

### If already pushed:
```bash
# Remove file from history (dangerous!)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# Force push (coordinate with team first!)
git push origin --force --all
```

### Then:
1. Immediately revoke all exposed secrets
2. Generate new API keys
3. Update production environment

## 🔍 Scanning for secrets

### Using git-secrets (recommended)
```bash
# Install git-secrets
brew install git-secrets  # macOS
sudo apt install git-secrets  # Ubuntu

# Configure
git secrets --register-aws
git secrets --install-hooks

# Add custom patterns
git secrets --add 'sk-ant-api\d\d-[A-Za-z0-9]+'
git secrets --add 'pplx-[A-Za-z0-9]+'
```

### Manual check before commit
```bash
# Check for patterns
git diff --cached | grep -E "(sk-ant-api|pplx-|postgresql://|jwt_secret)"
```

## 🏭 Production deployment

### Environment variables in Docker
```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

### Using secrets management
- **Docker Swarm**: Docker secrets
- **Kubernetes**: Kubernetes secrets
- **Cloud**: AWS Parameter Store, Azure Key Vault, etc.

## 🚨 Emergency response

If secrets are exposed:

1. **Immediately revoke** all compromised credentials
2. **Generate new secrets**
3. **Update all environments**
4. **Audit access logs**
5. **Notify the team**
6. **Review and improve processes**

## 📝 Remember

- Secrets belong in environment variables, not code
- Always use `.env.example` files for documentation
- Never commit actual secrets
- Different environments need different secrets
- When in doubt, ask the team

---

For more information, see the [Configuration Guide](../docs/configuration.md).
