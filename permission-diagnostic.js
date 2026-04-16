// Permission Preview Diagnostic Tool
// Run this in browser console on https://app.opencode.ai

;(function diagnosePermissions() {
  const permData = localStorage.getItem("permission.v3")
  console.log("=== Permission Storage ===")
  console.log(permData ? JSON.parse(permData) : "No permission data")

  const settingsData = localStorage.getItem("settings.v3")
  console.log("\n=== Settings Storage ===")
  console.log(settingsData ? JSON.parse(settingsData) : "No settings data")

  // Check if there are any pending permission requests in the current session
  // This requires the app to be running
  console.log("\n=== Debug Steps ===")
  console.log("1. Try to edit a file in opencode project - does it show preview?")
  console.log("2. Try to edit the same file type in autodidact - does it show preview?")
  console.log("3. Check if .env.local is treated differently (security sensitive file)")
  console.log("4. Check console for any errors when permission dialog opens")

  // Clear autodidact permissions to test fresh
  console.log("\n=== To test fresh permissions ===")
  console.log("Run: localStorage.removeItem('permission.v3')")
  console.log("Then refresh and try editing again")
})()

// Paste this in browser console to diagnose
