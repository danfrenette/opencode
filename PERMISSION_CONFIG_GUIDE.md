# Permission Configuration Guide

## How to Make Agents Ask Before Editing Files

The permission settings are controlled by `.opencode/opencode.jsonc` file in each project.

### File Location

```
~/code/autodidact/.opencode/opencode.jsonc
```

### Configuration Format

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    // Tool-level permissions
    "edit": "ask", // Ask before editing files
    "write": "ask", // Ask before writing files
    "apply_patch": "ask", // Ask before applying patches

    // Or use rule-based permissions:
    // "edit": [
    //   { "pattern": "*.md", "action": "allow" },    // Auto-allow markdown edits
    //   { "pattern": "*.ts", "action": "ask" },      // Ask before TypeScript edits
    //   { "pattern": "*.secret", "action": "deny" }, // Never allow secret file edits
    // ]
  },
}
```

### Permission Actions

- `"allow"` - Automatically approve without asking
- `"ask"` - Show permission prompt for user approval
- `"deny"` - Never allow, reject automatically

### Rule-Based Permissions

For more control, use an array of rules:

```jsonc
{
  "permission": {
    "edit": [
      { "pattern": "docs/**", "action": "allow" },
      { "pattern": "src/**/*.test.ts", "action": "ask" },
      { "pattern": "*.config.ts", "action": "deny" },
    ],
  },
}
```

### Available Permission Types

- `edit` - Edit existing files
- `write` - Create new files
- `apply_patch` - Apply code patches
- `bash` - Run shell commands
- `file_read` - Read file contents
- `file_search` - Search through files

## Current Settings

The autodidact repo now has:

- ✅ `edit`: ask (prompt before editing)
- ✅ `write`: ask (prompt before writing)
- ✅ `apply_patch`: ask (prompt before applying patches)

## Testing

To test permissions:

1. Open autodidact project in OpenCode
2. Ask the agent to edit a file
3. You should see a permission prompt
4. Approve or deny the request
5. Check that the setting persists

## ⚠️ Known Issue: Preview Not Showing

**Problem:** In some projects, permission prompts appear but without the diff preview showing what will change.

**Root Cause:** Config-based permissions (`"edit": "ask"` in opencode.jsonc) create path-based rules that don't include the actual file diff metadata. Tool-based permissions (when the tool itself asks) DO include rich previews.

**What's Happening:**

1. **Config check** runs first - matches your path pattern, asks permission WITHOUT preview
2. **Tool execution** runs second - actual tool asks WITH preview showing exact changes

**Why opencode project shows previews:**

- Might have cached permissions allowing the tool to execute immediately
- Could be different file types or operations being performed
- Possibly different backend state

**To fix for autodidact:**

1. Clear permission cache: `localStorage.removeItem('permission.v3')`
2. Refresh and try again
3. Approve BOTH prompts - first (config), second (tool with preview)

**To Test Current Behavior:**

```javascript
// Run in browser console on https://app.opencode.ai
const perm = JSON.parse(localStorage.getItem("permission.v3") || "{}")
console.log("Current permissions:", perm)

// Check if autodidact has any cached rules
console.log("Autodidact perms:", perm.autoAccept?.["dir:/Users/dan/code/autodidact"])
```

## Copying Settings Between Projects

To copy permission settings from opencode to autodidact:

```bash
mkdir -p ~/code/autodidact/.opencode
cp ~/code/opencode/.opencode/opencode.jsonc ~/code/autodidact/.opencode/
```

Or manually edit the file in each project.

---

_Created: Permission configuration documentation_
