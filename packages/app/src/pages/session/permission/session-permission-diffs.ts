import type { PermissionRequest, Session, VcsFileDiff } from "@opencode-ai/sdk/v2/client"
import { sessionPermissionRequest } from "@/pages/session/composer/session-request-tree"
import type { PermissionDiff, PermissionDiffAction, PermissionDiffFileInput, PermissionMetadataInput } from "./session-permission-diff-types"

export type { PermissionDiff }
export type SessionPermissionDiffPreview = PermissionDiff

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined
}

function optionalNumber(value: unknown) {
  return typeof value === "number" ? value : undefined
}

function optionalAction(value: unknown): PermissionDiffAction | undefined {
  if (value === "add" || value === "delete" || value === "move" || value === "update" || value === "modified") {
    return value
  }
}

function parseFileDiffInput(value: unknown): PermissionDiffFileInput | undefined {
  if (!isRecord(value)) return

  return {
    file: optionalString(value.file),
    filePath: optionalString(value.filePath),
    relativePath: optionalString(value.relativePath),
    patch: optionalString(value.patch),
    diff: optionalString(value.diff),
    additions: optionalNumber(value.additions),
    deletions: optionalNumber(value.deletions),
    type: optionalAction(value.type),
  }
}

function parsePermissionMetadataInput(metadata: PermissionRequest["metadata"]): PermissionMetadataInput | undefined {
  if (!isRecord(metadata)) return

  if (Array.isArray(metadata.files)) {
    return {
      files: metadata.files.map(parseFileDiffInput).filter((value): value is PermissionDiffFileInput => !!value),
    }
  }

  const filediff = parseFileDiffInput(metadata.filediff)
  if (filediff) return { filediff }

  const filepath = optionalString(metadata.filepath)
  const diff = optionalString(metadata.diff)
  if (filepath && diff) return { filepath, diff }
}

function normalizeStatus(type?: PermissionDiffAction): VcsFileDiff["status"] {
  if (type === "add") return "added"
  if (type === "delete") return "deleted"
  return "modified"
}

function normalizeDiff(diff: PermissionDiffFileInput): PermissionDiff {
  return {
    file: diff.file || diff.filePath || diff.relativePath || "",
    patch: diff.patch || diff.diff || "",
    additions: diff.additions || 0,
    deletions: diff.deletions || 0,
    action: diff.type,
  }
}

function normalizePermissionMetadata(metadata: PermissionRequest["metadata"]): PermissionDiff[] {
  const value = parsePermissionMetadataInput(metadata)
  if (!value) return []

  if (value.files?.length) return value.files.map(normalizeDiff)
  if (value.filediff) return [normalizeDiff(value.filediff)]

  if (value.diff && value.filepath) {
    return [
      {
        file: value.filepath,
        patch: value.diff,
        additions: 0,
        deletions: 0,
      },
    ]
  }

  return []
}

export function permissionDiffPreview(request: Pick<PermissionRequest, "metadata">): SessionPermissionDiffPreview[] {
  return normalizePermissionMetadata(request.metadata)
}

export function permissionReviewDiffs(request: Pick<PermissionRequest, "metadata">): VcsFileDiff[] {
  return normalizePermissionMetadata(request.metadata).map((diff) => ({
    file: diff.file,
    patch: diff.patch,
    additions: diff.additions,
    deletions: diff.deletions,
    status: normalizeStatus(diff.action),
  }))
}

export function resolveSessionReviewDiffs(input: {
  completed: VcsFileDiff[]
  session: Session[]
  permission: Record<string, PermissionRequest[] | undefined>
  sessionID?: string
}): VcsFileDiff[] {
  if (input.completed.length > 0) return input.completed
  const request = sessionPermissionRequest(input.session, input.permission, input.sessionID)
  if (!request) return []
  return permissionReviewDiffs(request)
}
