export interface VideoDiary {
  id: string
  title: string
  recordedAt: string
  youtubeVideoId: string
  notes: string | null
  r2ObjectKey: string | null
  thumbObjectKey: string | null
  wrappedFileKey: string | null
  wrapIv: string | null
  chunkSize: number | null
  ciphertextBytes: number | null
  mimeType: string | null
  createdAt: string
}
