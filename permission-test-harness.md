# Permission Test Harness

This file is for testing permission settings functionality.

## Understanding Permission Storage

Permissions in OpenCode are **directory-specific** (per project/repo). They're stored in:

- **Storage**: `localStorage` key `permission.v3`
- **Format**: `{ "autoAccept": { "dir:/path/to/project": true/false } }`

## Copy Permissions from OpenCode to Autodidact

### Method 1: Browser Console (Quick)

1. Open OpenCode web app (https://app.opencode.ai)
2. Open browser DevTools → Console
3. Run the script in `copy-permissions-helper.js`
4. Refresh the page

### Method 2: Manual localStorage Edit

```javascript
// Get current permissions
const perm = JSON.parse(localStorage.getItem("permission.v3"))

// Copy from opencode to autodidact
perm.autoAccept["dir:/Users/dan/code/autodidact"] = perm.autoAccept["dir:/Users/dan/code/opencode"]

// Save back
localStorage.setItem("permission.v3", JSON.stringify(perm))
```

### Method 3: Settings UI

1. Open autodidact project in OpenCode
2. Go to Settings → General
3. Toggle "Auto-accept permissions" manually

## Test Cases

### Auto-accept Permissions

- [ ] Toggle auto-accept in settings
- [ ] Verify it persists after refresh
- [ ] Test with actual permission request
- [ ] Copy permissions to another repo (autodidact)

### Permission Notifications

- [ ] Enable permission notifications
- [ ] Disable permission notifications
- [ ] Sound alerts for permissions

### Manual Permission Flow

- [ ] Request permission manually
- [ ] Approve permission
- [ ] Deny permission
- [ ] Check permission state persists

## Debug Notes

- Permissions are stored per-directory, not globally
- Each project has its own auto-accept setting
- Settings → General shows the toggle for the CURRENT project only
- Use the helper script above to copy settings between projects

---

_Created: Testing session_
