import { z } from 'zod'

export const runIdSchema = z.uuid()

export const promptSchema = z.string().trim().min(1, 'Prompt is required').max(100_000)

function safeBaseUrl(value: string): string {
  const url = new URL(value)
  const loopback = url.hostname === 'localhost' || url.hostname === '::1' || url.hostname.startsWith('127.')
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Base URL must use HTTP or HTTPS')
  if (url.protocol === 'http:' && !loopback) throw new Error('Remote providers must use HTTPS')
  if (url.username || url.password || url.search || url.hash) throw new Error('Base URL cannot contain credentials, query, or fragment')
  if (!url.hostname) throw new Error('Base URL must include a host')
  return value.replace(/\/+$/, '')
}

export const baseUrlSchema = z.string().trim().min(1).max(2_048).transform(safeBaseUrl)

export const profileInputSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, 'Profile name is required').max(80),
  baseUrl: baseUrlSchema,
  modelId: z.string().trim().min(1, 'Model ID is required').max(160),
  timeoutMs: z.number().int().min(1_000).max(900_000),
  maxOutputTokens: z.number().int().min(256).max(64_000),
  apiKey: z.string().max(4_096).optional(),
})

export const generationInputSchema = z.object({
  profileId: z.uuid(),
  prompt: promptSchema,
})
