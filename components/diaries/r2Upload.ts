export async function uploadEncryptedObject(key: string, blob: Blob): Promise<void> {
  const presignRes = await fetch("/api/diaries/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, purpose: "put" }),
  })
  if (!presignRes.ok) {
    const data = (await presignRes.json()) as { error?: string; detail?: string }
    throw new Error(data.detail ?? data.error ?? "Failed to start upload")
  }
  const { url } = (await presignRes.json()) as { url: string }

  try {
    const put = await fetch(url, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": "application/octet-stream" },
    })
    if (put.ok) return
  } catch {
    // CORS or network — fall through to authenticated proxy
  }

  const proxy = await fetch(`/api/diaries/media?key=${encodeURIComponent(key)}`, {
    method: "PUT",
    body: blob,
  })
  if (!proxy.ok) {
    const data = (await proxy.json().catch(() => ({}))) as { error?: string; detail?: string }
    throw new Error(data.detail ?? data.error ?? "Failed to upload encrypted file")
  }
}

export async function fetchEncryptedObject(key: string): Promise<Uint8Array> {
  const presignRes = await fetch("/api/diaries/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, purpose: "get" }),
  })
  if (!presignRes.ok) {
    const data = (await presignRes.json()) as { error?: string; detail?: string }
    throw new Error(data.detail ?? data.error ?? "Failed to fetch file")
  }
  const { url } = (await presignRes.json()) as { url: string }

  let res: Response
  try {
    res = await fetch(url)
    if (!res.ok) throw new Error("presign get failed")
  } catch {
    res = await fetch(`/api/diaries/media?key=${encodeURIComponent(key)}`)
  }
  if (!res.ok) {
    throw new Error("Failed to download encrypted file")
  }
  return new Uint8Array(await res.arrayBuffer())
}
