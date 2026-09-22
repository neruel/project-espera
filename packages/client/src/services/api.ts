import type {
  Conversation,
  Memory,
  MemoryEvidence,
  MemoryRevision,
  Message,
  Persona,
  PersonaRevision,
  ContextRun,
  ModelDescriptor,
  ProviderCapabilities,
  Project,
} from '@espera/shared';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

async function request(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, { ...init, credentials: 'include' });
  if (response.status === 401) window.dispatchEvent(new CustomEvent('espera:auth-required'));
  return response;
}

export interface AuthState {
  authenticated: boolean;
  required: boolean;
  configured: boolean;
  user: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string | null;
  } | null;
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: ModelDescriptor[];
  capabilities: ProviderCapabilities;
  defaultBaseUrl?: string;
}

export interface PersistedProviderConnection {
  id: string;
  name: string;
  providerId: string;
  baseUrl?: string;
  status: 'active' | 'inactive' | 'error';
  lastTestedAt?: string | null;
  models: ModelDescriptor[];
  createdAt: string;
  updatedAt: string;
  credentialStored?: boolean;
}

export interface StreamChatParams {
  conversationId?: string;
  connectionId?: string;
  content: string;
  providerId: string;
  modelId: string;
  projectId?: string | null;
  regenerateFromMessageId?: string;
  credential?: { apiKey: string; endpointUrl?: string };
  onDelta: (delta: string) => void;
  onDone: (data: { conversationId: string; messageId: string; contextRunId: string; newPendingMemoriesCount: number }) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

export const api = {
  async getAuthState(): Promise<AuthState> {
    const res = await request(`${BASE_URL}/api/auth/me`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication status could not be loaded');
    return data;
  },

  loginWithGitHub(): void {
    window.location.assign(`${BASE_URL}/api/auth/github`);
  },

  async logout(): Promise<void> {
    const res = await request(`${BASE_URL}/api/auth/logout`, { method: 'POST' });
    if (!res.ok) throw new Error('Could not sign out');
  },

  async getProjects(): Promise<Project[]> {
    const res = await request(`${BASE_URL}/api/projects`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Projects could not be loaded');
    return data.projects || [];
  },

  async createProject(name: string, description: string): Promise<Project> {
    const res = await request(`${BASE_URL}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Project could not be created');
    return data.project;
  },

  async deleteProject(id: string): Promise<void> {
    const res = await request(`${BASE_URL}/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Project could not be deleted');
  },

  async updateProject(id: string, input: { name: string; description: string; status: Project['status'] }): Promise<Project> {
    const res = await request(`${BASE_URL}/api/projects/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Project could not be updated');
    return data.project;
  },

  async getProjectContents(id: string): Promise<{ conversations: Conversation[]; memories: Memory[] }> {
    const res = await request(`${BASE_URL}/api/projects/${encodeURIComponent(id)}/contents`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Project contents could not be loaded');
    return { conversations: data.conversations || [], memories: data.memories || [] };
  },
  // Conversations
  async getConversations(): Promise<Conversation[]> {
    const res = await request(`${BASE_URL}/api/conversations`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Conversations could not be loaded');
    return data.conversations || [];
  },

  async createConversation(title?: string, projectId?: string | null): Promise<Conversation> {
    const res = await request(`${BASE_URL}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || 'New Conversation', projectId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Conversation could not be created');
    return data.conversation;
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const result = await this.getMessagesPage(conversationId);
    return result.messages;
  },

  async getMessagesPage(conversationId: string, offset = 0, limit = 50): Promise<{ messages: Message[]; hasMore: boolean }> {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    const res = await request(`${BASE_URL}/api/conversations/${encodeURIComponent(conversationId)}/messages?${query}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Messages could not be loaded');
    return { messages: data.messages || [], hasMore: Boolean(data.hasMore) };
  },

  async updateConversationProject(conversationId: string, projectId: string | null): Promise<Conversation> {
    const res = await request(`${BASE_URL}/api/conversations/${encodeURIComponent(conversationId)}/project`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Conversation scope could not be updated');
    return data.conversation;
  },

  async updateConversationTitle(conversationId: string, title: string): Promise<Conversation> {
    const res = await request(`${BASE_URL}/api/conversations/${encodeURIComponent(conversationId)}/title`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Conversation title could not be updated');
    return data.conversation;
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const res = await request(`${BASE_URL}/api/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Conversation could not be deleted');
  },

  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    const res = await request(`${BASE_URL}/api/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Message could not be deleted');
  },

  // Streaming Chat
  async streamChat(params: StreamChatParams): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (params.credential && params.credential.apiKey) {
      headers['X-Espera-Credential'] = JSON.stringify(params.credential);
    }

    const res = await request(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        conversationId: params.conversationId,
        connectionId: params.connectionId,
        content: params.content,
        providerId: params.providerId,
        modelId: params.modelId,
        projectId: params.projectId,
        regenerateFromMessageId: params.regenerateFromMessageId,
        stream: true,
      }),
      signal: params.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`Chat request failed with status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const lines = trimmed.split('\n');
        let event = 'message';
        let data = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            event = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            data = line.slice(6).trim();
          }
        }

        if (!data) continue;

        try {
          const parsed = JSON.parse(data);
          if (event === 'message' && parsed.delta) {
            params.onDelta(parsed.delta);
          } else if (event === 'done') {
            params.onDone(parsed);
          } else if (event === 'error') {
            params.onError(parsed.error || 'Stream error occurred');
          }
        } catch {
          // ignore incomplete json
        }
      }
    }
  },

  // Memories
  async getMemories(status?: string, type?: string): Promise<Memory[]> {
    const page = await this.getMemoriesPage({ status, type });
    return page.memories;
  },

  async getMemoriesPage(options: { status?: string; type?: string; projectId?: string; query?: string; sort?: 'updated'|'importance'|'confidence'; view?: 'history'; offset?: number; limit?: number } = {}): Promise<{ memories: Memory[]; hasMore: boolean }> {
    const query = new URLSearchParams();
    if (options.status) query.set('status', options.status);
    if (options.type) query.set('type', options.type);
    if (options.projectId) query.set('projectId', options.projectId);
    if (options.query) query.set('q', options.query);
    if (options.sort) query.set('sort', options.sort);
    if (options.view) query.set('view', options.view);
    query.set('offset', String(options.offset || 0));
    query.set('limit', String(options.limit || 50));

    const res = await request(`${BASE_URL}/api/memories?${query.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Memories could not be loaded');
    return { memories: data.memories || [], hasMore: Boolean(data.hasMore) };
  },

  async getMemoryDetails(id: string): Promise<{ memory: Memory; revisions: MemoryRevision[]; evidence: MemoryEvidence[] }> {
    const res = await request(`${BASE_URL}/api/memories/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Memory details could not be loaded');
    return data;
  },

  async approveMemory(id: string, changeReason?: string): Promise<Memory> {
    const res = await request(`${BASE_URL}/api/memories/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', changeReason: changeReason || 'Approved by user' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Memory could not be approved');
    return data.memory;
  },

  async editAndApproveMemory(
    id: string,
    update: { canonicalText: string; importance?: number; type?: string; changeReason: string }
  ): Promise<Memory> {
    const res = await request(`${BASE_URL}/api/memories/${id}/edit-and-approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit_and_approve', ...update }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Memory could not be updated');
    return data.memory;
  },

  async rejectMemory(id: string, reason?: string): Promise<Memory> {
    const res = await request(`${BASE_URL}/api/memories/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason: reason || 'Rejected by user' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Memory could not be rejected');
    return data.memory;
  },

  async deleteMemory(id: string, mode: 'soft' | 'hard' = 'soft'): Promise<void> {
    const res = await request(`${BASE_URL}/api/memories/${id}?mode=${mode}`, {
      method: 'DELETE',
    });
    if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Memory could not be archived'); }
  },

  async createMemory(data: {
    type: string;
    subject: string;
    predicate: string;
    canonicalText: string;
    importance: number;
    sensitivity: string;
  }): Promise<Memory> {
    const res = await request(`${BASE_URL}/api/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Memory could not be created');
    return resData.memory;
  },

  // Persona
  async getPersona(): Promise<Persona> {
    const res = await request(`${BASE_URL}/api/persona`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Persona could not be loaded');
    return data.persona;
  },

  async getPersonaRevisions(): Promise<PersonaRevision[]> {
    const res = await request(`${BASE_URL}/api/persona/revisions`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Persona history could not be loaded');
    return data.revisions || [];
  },

  async updatePersona(payload: {
    name: string;
    instructions: string;
    toneAndManner: string;
    principles: string[];
    changeReason: string;
  }): Promise<Persona> {
    const res = await request(`${BASE_URL}/api/persona`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Persona could not be updated');
    return data.persona;
  },

  async restorePersonaRevision(version: number): Promise<Persona> {
    const res = await request(`${BASE_URL}/api/persona/revisions/${version}/restore`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Persona revision could not be restored');
    return data.persona;
  },

  // Providers
  async getProviders(): Promise<ProviderInfo[]> {
    const res = await request(`${BASE_URL}/api/providers`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Providers could not be loaded');
    return data.providers || [];
  },

  async listModels(providerId: string, apiKey: string, endpointUrl?: string): Promise<ModelDescriptor[]> {
    const res = await request(`${BASE_URL}/api/providers/models`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({providerId,credential:{apiKey,endpointUrl}}) });
    const data=await res.json(); if(!res.ok) throw new Error(data.error?.message || '모델 목록 조회 실패'); return data.models || [];
  },

  async validateCredential(providerId: string, apiKey: string, endpointUrl?: string): Promise<boolean> {
    const res = await request(`${BASE_URL}/api/providers/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId,
        credential: { apiKey, endpointUrl },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || data.error || 'Credential validation failed');
    return Boolean(data.isValid);
  },

  async getProviderConnections(): Promise<PersistedProviderConnection[]> {
    const res = await request(`${BASE_URL}/api/providers/connections`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Provider connections could not be loaded');
    return data.connections || [];
  },

  async saveProviderConnection(connection: {
    id?: string;
    name: string;
    providerId: string;
    baseUrl?: string;
    models: ModelDescriptor[];
    credential?: { apiKey: string; endpointUrl?: string };
    rememberCredential?: boolean;
  }): Promise<PersistedProviderConnection> {
    const res = await request(`${BASE_URL}/api/providers/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(connection),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Provider connection could not be saved');
    return data.connection;
  },

  async deleteProviderConnection(id: string): Promise<void> {
    const res = await request(`${BASE_URL}/api/providers/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Provider connection could not be deleted');
    }
  },

  async validateSavedProviderConnection(id: string): Promise<{ isValid: boolean; testedAt: string }> {
    const res = await request(`${BASE_URL}/api/providers/connections/${encodeURIComponent(id)}/validate`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Connection validation failed');
    return data;
  },

  // Developer Context Inspector
  async getContextRun(conversationId: string): Promise<ContextRun | null> {
    const res = await request(`${BASE_URL}/api/inspector/${conversationId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Context could not be loaded');
    return data.contextRun || null;
  },
};
