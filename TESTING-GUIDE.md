# Testing GitHub CLI Setup

## Quick Test

To test the GitHub CLI setup flow, run:

```bash
node test-gh-setup.js
```

This will:
1. Check if GitHub CLI is installed
2. If not, show the full installation flow
3. Check if authenticated
4. If not, show the full authentication flow
5. Display success summary

## Testing Different Scenarios

### Scenario 1: Fresh Install (No gh installed)

```bash
# If gh is installed, temporarily rename it
which gh  # Check if installed
sudo mv /usr/local/bin/gh /usr/local/bin/gh.backup

# Run test
node test-gh-setup.js

# You'll see:
# - Installation prompt
# - Full Homebrew output
# - Verification
# - Authentication prompt
# - Full auth flow
# - Success summary

# Restore gh
sudo mv /usr/local/bin/gh.backup /usr/local/bin/gh
```

### Scenario 2: Installed but Not Authenticated

```bash
# Logout from GitHub
gh auth logout

# Run test
node test-gh-setup.js

# You'll see:
# - Skip installation (already installed)
# - Authentication prompt
# - Full auth flow
# - Success summary

# You'll be authenticated after this
```

### Scenario 3: Already Set Up

```bash
# Run test
node test-gh-setup.js

# You'll see:
# - Message that everything is already set up
# - Instructions on how to test the flow
```

## Testing with Real Commands

Once you've tested the setup flow, try it with real GTA commands:

```bash
# This will trigger gh check before running
gta add

# You'll see the setup flow if gh is not ready
# Then the command will continue
```

## Expected Output

### Full Setup Flow:

```
🧪 Testing GitHub CLI Setup Flow

Checking current status...
GitHub CLI needs setup.

╔═══════════════════════════════════════════════════════════╗
║           GitHub CLI Setup & Configuration            ║
╚═══════════════════════════════════════════════════════════╝

Step 1/2: Checking GitHub CLI installation...
  ✗ GitHub CLI is not installed
  GitHub CLI is required for repository operations

❯ Would you like to install GitHub CLI now? › Yes

━━━ GitHub CLI Installation ━━━

System: macOS
Package Manager: Homebrew
Install Command: brew install gh

Checking for Homebrew...
✓ Homebrew found

Starting installation...

────────────────────────────────────────────────────────────
==> Downloading https://ghcr.io/v2/homebrew/core/gh/manifests/2.40.0
==> Fetching gh
==> Downloading https://ghcr.io/v2/homebrew/core/gh/blobs/sha256:...
==> Pouring gh--2.40.0.arm64_sonoma.bottle.tar.gz
🍺  /opt/homebrew/Cellar/gh/2.40.0: 123 files, 45.2MB
────────────────────────────────────────────────────────────

✓ GitHub CLI installed successfully!

Verifying installation...
✓ gh version 2.40.0 (2024-01-15)

Step 2/2: Checking GitHub authentication...
  ✗ Not authenticated with GitHub
  Authentication is required to create and manage repositories

❯ Would you like to authenticate with GitHub now? › Yes

━━━ GitHub Authentication ━━━

This will open your browser to authenticate with GitHub.
Please follow the instructions in your browser.

Starting authentication process...

────────────────────────────────────────────────────────────
! First copy your one-time code: ABCD-1234
Press Enter to open github.com in your browser...
✓ Authentication complete.
────────────────────────────────────────────────────────────

✓ Successfully authenticated with GitHub!

Verifying authentication...
✓ Authentication verified

  Logged in to github.com as username (keyring)

╔═══════════════════════════════════════════════════════════╗
║              ✓ Setup Complete!                         ║
╚═══════════════════════════════════════════════════════════╝

GitHub CLI is ready to use for repository operations.

🎉 Test completed successfully!
```

## Interactive Testing

The test script is fully interactive. You can:

- Answer "Yes" to proceed with installation/authentication
- Answer "No" to cancel at any step
- See real-time output from package managers
- See the full authentication flow in your browser

## Notes

- The script uses `stdio: 'inherit'` to show all output
- You'll see the actual Homebrew/apt/winget output
- The browser will open for GitHub authentication
- All steps are verified after completion

## Troubleshooting

### "Command not found: gh" after installation

```bash
# Reload your shell
exec $SHELL

# Or add to PATH
export PATH="/usr/local/bin:$PATH"
```

### Authentication fails

```bash
# Try manual authentication
gh auth login --web

# Check status
gh auth status
```

### Want to test again

```bash
# Logout to test auth flow
gh auth logout

# Uninstall to test full flow (macOS)
brew uninstall gh
```

## Clean Up

After testing, you can remove the test script:

```bash
rm test-gh-setup.js
```

Or keep it for future testing!
