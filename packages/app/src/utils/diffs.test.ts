import { describe, expect, test } from "bun:test"
import type { FileDiffInfo } from "@opencode-ai/client/promise"
import type { Message } from "@/types"
import { canonicalDiffs, diffs, message } from "./diffs"

const item = {
  file: "src/app.ts",
  patch: "@@ -1 +1 @@\n-old\n+new\n",
  additions: 1,
  deletions: 1,
  status: "modified",
} satisfies FileDiffInfo

describe("diffs", () => {
  test("keeps valid arrays", () => {
    expect(diffs([item])).toEqual([item])
  })

  test("wraps a single diff object", () => {
    expect(diffs(item)).toEqual([item])
  })

  test("reads keyed diff objects", () => {
    expect(diffs({ a: item })).toEqual([item])
  })

  test("drops invalid entries", () => {
    expect(
      diffs([
        item,
        { file: "src/bad.ts", additions: 1, deletions: 1 },
        { patch: item.patch, additions: 1, deletions: 1 },
      ]),
    ).toEqual([item])
  })
})

describe("canonicalDiffs", () => {
  test("keeps canonical file metadata arrays", () => {
    expect(canonicalDiffs([item])).toEqual([item])
    expect(canonicalDiffs([])).toEqual([])
  })

  test("rejects non-array metadata", () => {
    expect(canonicalDiffs(item)).toBeUndefined()
    expect(canonicalDiffs({ file: item })).toBeUndefined()
    expect(canonicalDiffs(undefined)).toBeUndefined()
  })

  test("rejects an array when any entry is malformed", () => {
    expect(canonicalDiffs([item, { ...item, patch: undefined }])).toBeUndefined()
    expect(canonicalDiffs([item, null])).toBeUndefined()
  })

  test("requires canonical status and non-negative integer counts", () => {
    expect(canonicalDiffs([{ ...item, status: undefined }])).toBeUndefined()
    expect(canonicalDiffs([{ ...item, status: "renamed" }])).toBeUndefined()
    expect(canonicalDiffs([{ ...item, additions: -1 }])).toBeUndefined()
    expect(canonicalDiffs([{ ...item, additions: 0.5 }])).toBeUndefined()
    expect(canonicalDiffs([{ ...item, deletions: Number.NaN }])).toBeUndefined()
  })

  test("requires every canonical field to have its JSON wire type", () => {
    expect(canonicalDiffs([{ ...item, file: undefined }])).toBeUndefined()
    expect(canonicalDiffs([{ ...item, file: 1 }])).toBeUndefined()
    expect(canonicalDiffs([{ ...item, patch: null }])).toBeUndefined()
    expect(canonicalDiffs([{ ...item, additions: "1" }])).toBeUndefined()
    expect(canonicalDiffs([{ ...item, deletions: Number.POSITIVE_INFINITY }])).toBeUndefined()
    expect(canonicalDiffs([true])).toBeUndefined()
    expect(canonicalDiffs([[]])).toBeUndefined()
  })
})

describe("message", () => {
  test("normalizes user summaries with object diffs", () => {
    const input = {
      id: "msg_1",
      sessionID: "ses_1",
      role: "user",
      time: { created: 1 },
      agent: "build",
      model: { providerID: "openai", modelID: "gpt-5" },
      summary: {
        title: "Edit",
        diffs: { a: item },
      },
    } as unknown as Message

    expect(message(input)).toMatchObject({
      summary: {
        title: "Edit",
        diffs: [item],
      },
    })
  })

  test("drops invalid user summaries", () => {
    const input = {
      id: "msg_1",
      sessionID: "ses_1",
      role: "user",
      time: { created: 1 },
      agent: "build",
      model: { providerID: "openai", modelID: "gpt-5" },
      summary: true,
    } as unknown as Message

    expect(message(input)).toMatchObject({ summary: undefined })
  })
})
