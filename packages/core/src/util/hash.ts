import { createHash } from "crypto"

export namespace Hash {
  export function fast(input: string | Buffer): string {
    return createHash("sha1")
      .update(typeof input === "string" ? input : new Uint8Array(input))
      .digest("hex")
  }
}
