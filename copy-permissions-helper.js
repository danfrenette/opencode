// Permission Copy Helper
// Run this in your browser console when OpenCode is open
// This copies auto-accept permissions from opencode repo to autodidact repo

;(function copyPermissions() {
  const OPENCODE_DIR = "/Users/dan/code/opencode"
  const AUTODIDACT_DIR = "/Users/dan/code/autodidact"

  // Get current permissions
  const permData = localStorage.getItem("permission.v3")
  if (!permData) {
    console.log("No permission data found in localStorage")
    return
  }

  const permissions = JSON.parse(permData)
  console.log("Current permissions:", permissions)

  // Find opencode permissions
  const opencodeKey = `dir:${OPENCODE_DIR}`
  const autodidactKey = `dir:${AUTODIDACT_DIR}`

  const opencodeValue = permissions.autoAccept?.[opencodeKey]

  if (opencodeValue === undefined) {
    console.log(`No permissions set for ${OPENCODE_DIR}`)
    console.log("Setting autodidact to FALSE by default")
    permissions.autoAccept = permissions.autoAccept || {}
    permissions.autoAccept[autodidactKey] = false
  } else {
    console.log(`Copying permission from opencode: ${opencodeValue}`)
    permissions.autoAccept = permissions.autoAccept || {}
    permissions.autoAccept[autodidactKey] = opencodeValue
    console.log(`Set autodidact auto-accept to: ${opencodeValue}`)
  }

  // Save back
  localStorage.setItem("permission.v3", JSON.stringify(permissions))
  console.log("✅ Permissions copied! Refresh the page to apply changes.")
})()

// Copy-paste the above function into your browser console while on https://app.opencode.ai
// Or save this bookmarklet:
// javascript:(function(){const a="/Users/dan/code/opencode",b="/Users/dan/code/autodidact",c=localStorage.getItem("permission.v3");if(!c){console.log("No permissions");return}const d=JSON.parse(c),e=`dir:${a}`,f=`dir:${b}`,g=d.autoAccept?.[e];d.autoAccept=d.autoAccept||{},d.autoAccept[f]=g!==undefined?g:false,localStorage.setItem("permission.v3",JSON.stringify(d)),console.log("✅ Copied!",g)}()
