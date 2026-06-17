# Git Hooks Configuration

## Overview

GraphDone uses git hooks to maintain code quality and enforce project policies. These hooks run automatically during the commit process.

## Setup

Run the setup script after cloning the repository:

```bash
./scripts/setup-git-hooks.sh
```

This configures git to use the `.githooks/` directory for all hooks.

## Installed Hooks

### commit-msg

**Purpose**: Blocks commits with co-authorship attribution

**Policy**: GraphDone maintains single-author commits for:
- Clear accountability
- Clean git history  
- Accurate contribution tracking

**Blocked patterns**:
- `Co-Authored-By: <name> <email>`
- `Co-Author: ...`
- References to pair programming
- AI assistant attributions (e.g., Claude, GitHub Copilot)
- Bot/automation co-authors

### pre-commit

**Purpose**: Warns about Co-Authored-By text in staged files

**Behavior**: 
- Warns if files contain "Co-Authored-By" text
- Does not block (text might be in documentation)
- Helps prevent accidental co-author additions

## Policy Rationale

GraphDone does not use pair programming practices. Each commit should have a single, clearly identified author to:

1. **Maintain Accountability**: Every change can be traced to a specific developer
2. **Simplify History**: Git blame and history remain clean and readable
3. **Track Contributions**: Accurate metrics for individual contributions
4. **Reduce Complexity**: Avoid confusion about responsibility for changes

## Troubleshooting

### Hook not triggering

Ensure hooks are configured:
```bash
git config core.hooksPath
# Should output: .githooks
```

Re-run setup if needed:
```bash
./scripts/setup-git-hooks.sh
```

### Bypassing hooks (emergency only)

In exceptional cases, you can bypass hooks with:
```bash
git commit --no-verify -m "Emergency fix"
```

⚠️ **Use sparingly**: This should only be used for critical fixes where the hook is malfunctioning.

## Manual Testing

Test that hooks are working:
```bash
# This should fail
echo "test" > test.txt
git add test.txt
git commit -m "Test commit

Co-Authored-By: Test <test@example.com>"

# Clean up
git reset HEAD test.txt
rm test.txt
```

## Contributing

When contributing to GraphDone:
1. Ensure your commits have a single author
2. Do not add Co-Authored-By lines
3. If you used AI assistance, you remain the sole author
4. Review and take responsibility for all committed code