"use client"

import { useState } from "react"
import {
  MIN_PASSPHRASE_LENGTH,
  base64ToBytes,
  bytesToBase64,
  createVerifier,
  decodeRecoveryKey,
  deriveMasterKey,
  encodeRecoveryKey,
  randomBytes,
  verifyMasterKey,
} from "@/lib/crypto/diary"

export interface CryptoConfig {
  configured: boolean
  kdfSalt?: string
  verifierIv?: string
  verifierCt?: string
}

interface DiaryUnlockProps {
  config: CryptoConfig
  onUnlocked: (masterKey: Uint8Array, config: CryptoConfig) => void
}

export function DiaryUnlock({ config, onUnlocked }: DiaryUnlockProps) {
  const [mode, setMode] = useState<"passphrase" | "recovery">(
    config.configured ? "passphrase" : "passphrase"
  )
  const [passphrase, setPassphrase] = useState("")
  const [confirm, setConfirm] = useState("")
  const [recovery, setRecovery] = useState("")
  const [recoveryKeyToSave, setRecoveryKeyToSave] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [pendingKey, setPendingKey] = useState<Uint8Array | null>(null)
  const [pendingConfig, setPendingConfig] = useState<CryptoConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isSetup = !config.configured

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      setError(`Use at least ${MIN_PASSPHRASE_LENGTH} characters`)
      return
    }
    if (passphrase !== confirm) {
      setError("Passphrases do not match")
      return
    }
    setBusy(true)
    try {
      const salt = randomBytes(16)
      const masterKey = await deriveMasterKey(passphrase, salt)
      const verifier = await createVerifier(masterKey)
      const payload = {
        kdfSalt: bytesToBase64(salt),
        verifierIv: bytesToBase64(verifier.iv),
        verifierCt: bytesToBase64(verifier.ciphertext),
      }
      const res = await fetch("/api/diaries/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string; detail?: string }
        throw new Error(data.detail ?? data.error ?? "Failed to save vault")
      }
      const saved = (await res.json()) as CryptoConfig
      setPendingKey(masterKey)
      setPendingConfig({ ...saved, configured: true })
      setRecoveryKeyToSave(encodeRecoveryKey(masterKey))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set up vault")
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!config.kdfSalt || !config.verifierIv || !config.verifierCt) {
      setError("Vault is not configured")
      return
    }
    setBusy(true)
    try {
      let masterKey: Uint8Array
      if (mode === "recovery") {
        masterKey = decodeRecoveryKey(recovery)
      } else {
        masterKey = await deriveMasterKey(passphrase, base64ToBytes(config.kdfSalt))
      }
      const ok = await verifyMasterKey(
        masterKey,
        base64ToBytes(config.verifierIv),
        base64ToBytes(config.verifierCt)
      )
      if (!ok) throw new Error("Wrong passphrase or recovery key")
      onUnlocked(masterKey, config)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock")
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
  const labelClass = "block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide"

  if (recoveryKeyToSave && pendingKey && pendingConfig) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-bg-card p-6">
        <h2 className="font-display text-2xl font-medium text-text">Save your recovery key</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          If you forget the passphrase, this key is the only way back in. The server never has it.
          Store it offline. Losing both means the videos are gone.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-bg-base p-3 font-mono text-xs text-text break-all whitespace-pre-wrap">
          {recoveryKeyToSave}
        </pre>
        <label className="mt-4 flex items-start gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1"
          />
          I have saved this recovery key somewhere I will not lose.
        </label>
        <button
          type="button"
          disabled={!acknowledged}
          onClick={() => onUnlocked(pendingKey, pendingConfig)}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm text-bg-base transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Unlock vault
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-bg-card p-6">
      <h1 className="font-display text-3xl font-medium tracking-tight text-text">Diaries</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {isSetup
          ? "Set a passphrase. Videos are encrypted in this browser before they leave the device. Cloudflare only stores ciphertext."
          : "Unlock to decrypt diaries on this device. The passphrase never leaves the browser."}
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </div>
      )}

      <form onSubmit={isSetup ? handleSetup : handleUnlock} className="mt-5 flex flex-col gap-4">
        {!isSetup && (
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode("passphrase")}
              className={mode === "passphrase" ? "text-accent" : "text-muted hover:text-text"}
            >
              Passphrase
            </button>
            <span className="text-border-strong">/</span>
            <button
              type="button"
              onClick={() => setMode("recovery")}
              className={mode === "recovery" ? "text-accent" : "text-muted hover:text-text"}
            >
              Recovery key
            </button>
          </div>
        )}

        {mode === "recovery" && !isSetup ? (
          <div>
            <label className={labelClass}>Recovery key</label>
            <textarea
              value={recovery}
              onChange={(e) => setRecovery(e.target.value)}
              rows={3}
              required
              className={inputClass + " resize-none font-mono text-xs"}
            />
          </div>
        ) : (
          <>
            <div>
              <label className={labelClass}>
                {isSetup ? "Passphrase" : "Passphrase"} *
              </label>
              <input
                type="password"
                autoComplete={isSetup ? "new-password" : "current-password"}
                required={mode !== "recovery"}
                minLength={isSetup ? MIN_PASSPHRASE_LENGTH : undefined}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className={inputClass}
              />
            </div>
            {isSetup && (
              <div>
                <label className={labelClass}>Confirm *</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}
          </>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm text-bg-base transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Working…" : isSetup ? "Create vault" : "Unlock"}
        </button>
      </form>
    </div>
  )
}
