/**
 * Project Espera Core Domain Types
 * Completely independent of any third-party LLM Provider SDKs
 */

export interface User {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Persona {
  id: string;
  userId: string;
  name: string;
  version: number;
  instructions: string;
  toneAndManner: string;
  principles: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaRevision {
  id: string;
  personaId: string;
  version: number;
  instructions: string;
  toneAndManner: string;
  principles: string[];
  changeReason: string;
  createdAt: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  projectId?: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  providerId?: string;
  modelId?: string;
  tokenCount?: number;
  createdAt: string;
}

export type MemoryType =
  | 'fact'
  | 'preference'
  | 'constraint'
  | 'goal'
  | 'project'
  | 'relationship';

export type MemorySourceKind =
  | 'explicit_user_statement'
  | 'user_confirmed'
  | 'inferred_from_conversation'
  | 'imported'
  | 'system_generated';

export type MemorySensitivity = 'low' | 'medium' | 'high';

export type MemoryStatus =
  | 'pending'
  | 'active'
  | 'superseded'
  | 'retracted'
  | 'rejected'
  | 'expired'
  | 'deleted';

export interface Memory {
  id: string;
  userId: string;
  projectId: string | null;
  type: MemoryType;
  subject: string;
  predicate: string;
  valueJson: Record<string, unknown> | string | number | boolean;
  canonicalText: string;
  sourceKind: MemorySourceKind;
  confidence: number;
  importance: number; // 1 to 5
  sensitivity: MemorySensitivity;
  status: MemoryStatus;
  validFrom: string;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryEvidence {
  id: string;
  memoryId: string;
  messageId: string;
  snippet: string;
  conversationId?: string;
  createdAt: string;
}

export interface MemoryRevision {
  id: string;
  memoryId: string;
  previousStatus: MemoryStatus | null;
  newStatus: MemoryStatus;
  previousCanonicalText: string | null;
  newCanonicalText: string;
  changeReason: string;
  actor: 'user' | 'system';
  createdAt: string;
}

export interface ProviderConnection {
  id: string;
  userId: string;
  providerId: string;
  authMode: 'session' | 'encrypted';
  encryptedSecret?: string | null;
  encryptionVersion?: number | null;
  nonce?: string | null;
  status: 'active' | 'inactive' | 'error';
  lastTestedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelPreference {
  id: string;
  userId: string;
  providerId: string;
  modelId: string;
  temperature: number;
  isDefault: boolean;
  updatedAt: string;
}

export interface ContextRun {
  id: string;
  conversationId: string;
  messageId: string;
  providerId: string;
  modelId: string;
  personaVersion: number;
  selectedMemoryIds: string[];
  selectionReasons: Record<string, string>;
  assembledPrompt: string;
  tokenEstimate: number;
  createdAt: string;
}

// Provider Abstraction Data Types
export interface ModelDescriptor {
  id: string;
  name: string;
  contextWindow: number;
  supportsStreaming: boolean;
  pricingTier?: 'free' | 'low' | 'medium' | 'high';
}

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsToolCalling: boolean;
}

export interface ProviderCredential {
  apiKey?: string;
  endpointUrl?: string;
  extraHeaders?: Record<string, string>;
}

export interface InternalMessage {
  role: MessageRole;
  content: string;
}

export interface ProviderGenerateRequest {
  modelId: string;
  messages: InternalMessage[];
  temperature?: number;
  maxTokens?: number;
  credential?: ProviderCredential;
  signal?: AbortSignal;
}

export interface ProviderResponse {
  content: string;
  modelId: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ProviderStreamChunk {
  delta: string;
  isComplete: boolean;
  usage?: ProviderResponse['usage'];
}
