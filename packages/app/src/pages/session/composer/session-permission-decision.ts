import type { PermissionReply } from "@opencode-ai/client/promise"

export type PermissionDecision =
  | { reply: Exclude<PermissionReply, "reject">; message?: never }
  | { reply: Extract<PermissionReply, "reject">; message?: string }
