import { z } from 'zod'

const usageSchema = z.object({
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
})

export const workerResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('succeeded'),
    rawText: z.string(),
    svg: z.string(),
    finishReason: z.string().nullable(),
    usage: usageSchema,
  }),
  z.object({
    kind: z.literal('failed'),
    code: z.enum(['invalid-input', 'invalid-svg', 'timeout', 'provider-error']),
    message: z.string().max(500),
    rawText: z.string().optional(),
    finishReason: z.string().nullable().optional(),
    usage: usageSchema.optional(),
  }),
])

export type WorkerResponse = z.infer<typeof workerResponseSchema>
