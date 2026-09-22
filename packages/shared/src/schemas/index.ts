import { z } from 'zod';

export const MemoryTypeSchema = z.enum([
  'fact',
  'preference',
  'constraint',
  'goal',
  'project',
  'relationship',
]);

export const MemorySourceKindSchema = z.enum([
  'explicit_user_statement',
  'user_confirmed',
  'inferred_from_conversation',
  'imported',
  'system_generated',
]);

export const MemorySensitivitySchema = z.enum(['low', 'medium', 'high']);

export const MemoryStatusSchema = z.enum([
  'pending',
  'active',
  'superseded',
  'retracted',
  'rejected',
  'expired',
  'deleted',
]);

/**
 * Zod Schema for Structured Memory Extraction from Conversation
 * Used to parse and validate AI memory extraction outputs strictly.
 */
export const MemoryCandidateSchema = z.object({
  type: MemoryTypeSchema,
  subject: z.string().min(1).max(100),
  predicate: z.string().min(1).max(100),
  valueJson: z.union([
    z.record(z.unknown()),
    z.string(),
    z.number(),
    z.boolean(),
  ]),
  canonicalText: z.string().min(3).max(500),
  sourceKind: MemorySourceKindSchema.default('inferred_from_conversation'),
  confidence: z.number().min(0).max(1),
  importance: z.number().int().min(1).max(5),
  sensitivity: MemorySensitivitySchema.default('medium'),
  snippet: z.string().min(1).max(500),
});

export const MemoryCandidatesResponseSchema = z.object({
  candidates: z.array(MemoryCandidateSchema),
});

export type MemoryCandidate = z.infer<typeof MemoryCandidateSchema>;

// Memory Action Schemas
export const ApproveMemorySchema = z.object({
  action: z.literal('approve'),
  changeReason: z.string().default('Approved by user'),
});

export const EditAndApproveMemorySchema = z.object({
  action: z.literal('edit_and_approve'),
  canonicalText: z.string().min(3).max(500),
  importance: z.number().int().min(1).max(5).optional(),
  type: MemoryTypeSchema.optional(),
  changeReason: z.string().min(1),
});

export const RejectMemorySchema = z.object({
  action: z.literal('reject'),
  reason: z.string().default('Rejected by user'),
});

export const DeleteMemorySchema = z.object({
  mode: z.enum(['soft', 'hard']).default('soft'),
  reason: z.string().default('Deleted by user'),
});

export const CreateMemoryManualSchema = z.object({
  type: MemoryTypeSchema,
  subject: z.string().min(1),
  predicate: z.string().min(1),
  canonicalText: z.string().min(2),
  importance: z.number().int().min(1).max(5).default(3),
  sensitivity: MemorySensitivitySchema.default('low'),
  sourceKind: MemorySourceKindSchema.default('explicit_user_statement'),
});

// Chat Schemas
export const SendMessageSchema = z.object({
  conversationId: z.string().optional(),
  connectionId: z.string().optional(),
  content: z.string().min(1),
  providerId: z.string(),
  modelId: z.string(),
  projectId: z.string().nullable().optional(),
  regenerateFromMessageId: z.string().optional(),
  stream: z.boolean().default(true),
});

export const CreateConversationSchema = z.object({
  title: z.string().min(1).max(200).default('New Conversation'),
  projectId: z.string().nullable().optional(),
});

// Persona Schemas
export const UpdatePersonaSchema = z.object({
  name: z.string().min(1).max(100),
  instructions: z.string().min(1),
  toneAndManner: z.string().min(1),
  principles: z.array(z.string()),
  changeReason: z.string().min(1).default('User manual update'),
});

// Provider & Settings Schemas
export const ValidateProviderCredentialSchema = z.object({
  providerId: z.string(),
  credential: z.object({
    apiKey: z.string().min(1),
    endpointUrl: z.string().url().optional(),
  }),
});

export const UpdateModelPreferenceSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
  temperature: z.number().min(0).max(2).default(0.7),
  isDefault: z.boolean().default(true),
});
