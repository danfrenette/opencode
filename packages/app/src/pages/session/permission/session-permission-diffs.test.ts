import { describe, expect, test } from "bun:test"
import type { PermissionRequest, Session, VcsFileDiff } from "@opencode-ai/sdk/v2/client"
import { permissionReviewDiffs, resolveSessionReviewDiffs } from "./session-permission-diffs"

function request(metadata?: PermissionRequest["metadata"], sessionID = "session-1") {
  return {
    id: `perm-${sessionID}`,
    sessionID,
    permission: "write",
    patterns: [],
    metadata: metadata ?? {},
    always: [],
  } satisfies PermissionRequest
}

describe("permissionReviewDiffs", () => {
  test("maps metadata.files to normalized diffs", () => {
    expect(
      permissionReviewDiffs(
        request({
          files: [
            {
              filePath: "src/a.ts",
              patch: "@@ -1 +1 @@",
              additions: 3,
              deletions: 1,
              type: "update",
            },
          ],
        }),
      ),
    ).toEqual([
      {
        file: "src/a.ts",
        patch: "@@ -1 +1 @@",
        additions: 3,
        deletions: 1,
        status: "modified",
      },
    ])
  })

  test("maps metadata.filediff to a single normalized diff", () => {
    expect(
      permissionReviewDiffs(
        request({
          filediff: {
            relativePath: "src/b.ts",
            diff: "patch",
            additions: 1,
            deletions: 0,
            type: "add",
          },
        }),
      ),
    ).toEqual([
      {
        file: "src/b.ts",
        patch: "patch",
        additions: 1,
        deletions: 0,
        status: "added",
      },
    ])
  })

  test("maps metadata.diff and metadata.filepath", () => {
    expect(
      permissionReviewDiffs(
        request({
          filepath: "src/c.ts",
          diff: "legacy patch",
        }),
      ),
    ).toEqual([
      {
        file: "src/c.ts",
        patch: "legacy patch",
        additions: 0,
        deletions: 0,
        status: "modified",
      },
    ])
  })

  test("maps add delete and update types to vcs statuses", () => {
    expect(
      permissionReviewDiffs(
        request({
          files: [
            { file: "a", patch: "", type: "add" },
            { file: "b", patch: "", type: "delete" },
            { file: "c", patch: "", type: "update" },
          ],
        }),
      ).map((item) => item.status),
    ).toEqual(["added", "deleted", "modified"])
  })

  test("returns empty results for missing or empty metadata", () => {
    expect(permissionReviewDiffs(request(undefined))).toEqual([])
    expect(permissionReviewDiffs(request({}))).toEqual([])
  })
})

describe("resolveSessionReviewDiffs", () => {
  const session: Session[] = [{ id: "session-1" } as Session]
  const completed: VcsFileDiff[] = [{ file: "done.ts", patch: "done", additions: 1, deletions: 0, status: "modified" }]
  const pending = request({ filepath: "pending.ts", diff: "pending" })

  test("prefers completed turn diffs", () => {
    expect(
      resolveSessionReviewDiffs({
        completed,
        session,
        permission: { "session-1": [pending] },
        sessionID: "session-1",
      }),
    ).toEqual(completed)
  })

  test("uses pending permission diffs when completed diffs are empty", () => {
    expect(
      resolveSessionReviewDiffs({
        completed: [],
        session,
        permission: { "session-1": [pending] },
        sessionID: "session-1",
      }),
    ).toEqual([{ file: "pending.ts", patch: "pending", additions: 0, deletions: 0, status: "modified" }])
  })
})
