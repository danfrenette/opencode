export type PermissionDiffAction = "add" | "delete" | "move" | "update" | "modified"

export type PermissionDiffFileInput = {
  file?: string
  filePath?: string
  relativePath?: string
  patch?: string
  diff?: string
  additions?: number
  deletions?: number
  type?: PermissionDiffAction
}

export type PermissionMetadataInput =
  | {
      files: PermissionDiffFileInput[]
      filediff?: never
      filepath?: never
      diff?: never
    }
  | {
      filediff: PermissionDiffFileInput
      files?: never
      filepath?: never
      diff?: never
    }
  | {
      filepath: string
      diff: string
      files?: never
      filediff?: never
    }

export type PermissionDiff = {
  file: string
  patch: string
  additions: number
  deletions: number
  action?: PermissionDiffAction
}
