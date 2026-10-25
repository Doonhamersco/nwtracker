import fs from "fs";
import path from "path";

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
  /**
   * STRAVA_REFRESH_TOKEN this file was derived from.
   * A rotated Strava refresh token stays in `refreshToken`; this field records
   * which env value produced it. When the env token changes, the file is ignored.
   */
  envRefreshToken?: string;
}

export function readTokenFile(filePath: string): TokenSet | null {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<TokenSet>;
    if (typeof raw.refreshToken !== "string" || typeof raw.accessToken !== "string") return null;
    return {
      accessToken: raw.accessToken,
      refreshToken: raw.refreshToken,
      expiresAt: typeof raw.expiresAt === "number" ? raw.expiresAt : 0,
      ...(typeof raw.envRefreshToken === "string" ? { envRefreshToken: raw.envRefreshToken } : {}),
    };
  } catch {
    return null;
  }
}

export function writeTokenFile(filePath: string, tokens: TokenSet): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(tokens), { mode: 0o600 });
  fs.renameSync(tmp, filePath);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Some volumes ignore chmod. The file still stays on the data volume, outside git.
  }
}
