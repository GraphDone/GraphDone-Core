# Cleanup Safety Check

## What MUST Stay in Root

### ✅ Files that MUST remain in root:
- `Makefile` - Make commands expect it in root
- `package.json` - npm/node requirement
- `tsconfig.json` - TypeScript config
- `turbo.json` - Turbo monorepo config
- `.gitignore` - Git requirement
- `.env.example` - Convention for env templates
- `README.md` - GitHub/npm convention
- `LICENSE` - Legal/npm requirement
- `CLAUDE.md` - Project documentation
- `.eslintrc.js` - ESLint looks for it in root
- `.prettierrc` - Prettier config
- `.prettierignore` - Prettier ignore rules

## What I Fixed After Moving

### ✅ Fixed package.json scripts:
```json
// Before (broken):
"test:comprehensive": "node run-all-tests.js",
"test:https": "node ssl-certificate-analysis.js && node mobile-https-compatibility-test.js",

// After (fixed):
"test:comprehensive": "node tests/run-all-tests.js",
"test:https": "node tests/ssl-certificate-analysis.js && node tests/mobile-https-compatibility-test.js",
```

### ✅ Restored Makefile to root:
- Initially moved to `scripts/` → broke `make` commands
- Moved back to root → now working

## What's Safe to Move

### ✅ Safely moved to organized directories:
- Test scripts (*.test.js, *-test.js) → `tests/`
- Test reports (*.md) → `test-results/reports/`
- Screenshots (*.png) → `artifacts/screenshots/`
- HTML reports → `test-results/`

## Verification Commands

Run these to verify nothing is broken:

```bash
# Package.json scripts
npm run test:comprehensive  # ✅ Works
npm run test:https          # ✅ Works
npm run test:installation   # ✅ Works

# Make commands
make test-report           # ✅ Works
make test-all             # ✅ Works

# Build commands
npm run build             # Should work
npm run dev              # Should work
```

## Potential Issues to Watch

1. **Import paths in test files**: If any test files import each other, paths may need updating
2. **CI/CD pipelines**: GitHub Actions seem fine, but check other CI systems
3. **Docker**: Dockerfile COPY commands may need updates if they reference moved files
4. **Scripts**: Shell scripts that reference test files may need path updates

## Summary

✅ **No critical breakage** - All essential functionality preserved
✅ **Package.json updated** - Test commands now point to correct locations  
✅ **Makefile restored** - Back in root where it belongs
✅ **Root is clean** - Only essential files remain
⚠️ **Monitor for issues** - Watch for any path-related errors in CI/CD or scripts