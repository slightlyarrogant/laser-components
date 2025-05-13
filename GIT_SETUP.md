# Git Setup Checklist

Follow these steps to safely initialize Git while protecting your sensitive data:

## ✅ Pre-Git Setup Checklist

### 1. Verify .gitignore is properly configured
```bash
# Check if .gitignore exists and contains .env files
cat .gitignore | grep -E "\.env"
```

### 2. Confirm your .env files are NOT staged
```bash
# This should show your .env files in "Untracked files"
git status
```

### 3. Test ignore patterns
```bash
# These should all return the file names (meaning they're ignored)
git check-ignore .env
git check-ignore frontend/.env
git check-ignore backend/.env
```

## 🚀 Initialize Git Repository

### 1. Initialize Git
```bash
git init
```

### 2. Add .gitignore first (most important!)
```bash
git add .gitignore
git commit -m "chore: add .gitignore to protect sensitive files"
```

### 3. Add example files (safe to commit)
```bash
git add .env.example frontend/.env.example backend/.env.example
git commit -m "docs: add environment variable examples"
```

### 4. Add documentation
```bash
git add docs/ SECURITY.md
git commit -m "docs: add comprehensive documentation and security guide"
```

### 5. Add application code (excluding secrets)
```bash
# Add package files
git add package*.json frontend/package*.json backend/package*.json

# Add source code (no secrets here)
git add frontend/src/ frontend/public/
git add backend/src/
git add scripts/
git add prisma/

# Add configuration files (no secrets)
git add *.md setup.sh

# Commit everything
git commit -m "feat: initial commit with laser components system"
```

## 🔍 Verify Nothing Sensitive is Committed

### 1. Check git history for secrets
```bash
# This should return empty (no matches)
git log --patch | grep -E "(sk-ant-api|pplx-|postgresql://.*@.*:|jwt.*secret)"
```

### 2. Verify .env files are not tracked
```bash
# Should show "false" for all
git ls-files | grep -q "\.env$" && echo "true" || echo "false"
git ls-files | grep -q "frontend/\.env$" && echo "true" || echo "false"
git ls-files | grep -q "backend/\.env$" && echo "true" || echo "false"
```

## 🌐 Connect to Remote Repository

### 1. Create repository on GitHub/GitLab
- Go to GitHub/GitLab
- Create new repository
- Don't initialize with README (you already have one)

### 2. Add remote origin
```bash
git remote add origin https://github.com/yourusername/laser-components.git
```

### 3. Push to remote
```bash
# For first push
git push -u origin main

# Or if your default branch is master
git push -u origin master
```

## 🚨 Emergency: If You Accidentally Commit Secrets

### If you haven't pushed yet:
```bash
# Remove from last commit
git reset --soft HEAD~1
git reset HEAD .env
git commit --amend
```

### If you already pushed:
1. **IMMEDIATELY** revoke all exposed API keys
2. Change all passwords
3. Generate new secrets
4. Consider rewriting git history (risky, coordinate with team)

## 🔐 Ongoing Security Practices

### Before each commit:
1. Run `git status` and verify no .env files
2. Check `git diff --cached` for any secrets
3. Use descriptive commit messages

### Regular maintenance:
1. Keep .gitignore up to date
2. Audit commits for accidentally included secrets
3. Use tools like `git-secrets` for automated checking

## ✅ Success Indicators

You've set up Git correctly when:
- [ ] .env files are ignored (not appearing in `git status`)
- [ ] .env.example files are committed
- [ ] Documentation is committed
- [ ] Application code is committed
- [ ] No secrets in git history
- [ ] Remote repository is connected

## 📞 Need Help?

If you're unsure about any step, check the [SECURITY.md](./SECURITY.md) file for detailed security practices.

---

Remember: It's better to be overly cautious with secrets than to accidentally expose them!
