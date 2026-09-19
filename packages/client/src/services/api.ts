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
}

export interface StreamChatParams {
  conversationId?: string;
  content: string;
  providerId: string;
  modelId: string;
  projectId?: string | null;
  credential?: { apiKey: string; endpointUrl?: string };
  onDelta: (delta: string) => void;
  onDone: (data: { conversationId: string; messageId: string; contextRunId: string; newPendingMemoriesCount: number }) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

export const api = {
  async getProjects(): Promise<Project[]> {
    const res = await fetch(`${BASE_URL}/api/projects`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Projects could not be loaded');
    return data.projects || [];
  },

  async createProject(name: string, description: string): Promise<Project> {
    const res = await fetch(`${BASE_URL}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Project could not be created');
    return data.project;
  },

  async deleteProject(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Project could not be deleted');
  },
  // Conversations
  async getConversations(): Promise<Conversation[]> {
    const res = await fetch(`${BASE_URL}/api/conversations`);
    const data = await res.json();
    return data.conversations || [];
  },

  async createConversation(title?: string, projectId?: string | null): Promise<Conversation> {
    const res = await fetch(`${BASE_URL}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || 'New Conversation', projectId }),
    });
    const data = await res.json();
    return data.conversation;
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const res = await fetch(`${BASE_URL}/api/conversations/${conversationId}/messages`);
    const data = await res.json();
    return data.messages || [];
  },

  // Streaming Chat
  async streamChat(params: StreamChatParams): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (params.credential && params.credential.apiKey) {
      headers['X-Espera-Credential'] = JSON.stringify(params.credential);
    }

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        conversationId: params.conversationId,
        content: params.content,
        providerId: params.providerId,
        modelId: params.modelId,
        projectId: params.projectId,
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
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (type) query.set('type', type);

    const res = await fetch(`${BASE_URL}/api/memories?${query.toString()}`);
    const data = await res.json();
    return data.memories || [];
  },

  async getMemoryDetails(id: string): Promise<{ memory: Memory; revisions: MemoryRevision[]; evidence: MemoryEvidence[] }> {
    const res = await fetch(`${BASE_URL}/api/memories/${id}`);
    return await res.json();
  },

  async approveMemory(id: string, changeReason?: string): Promise<Memory> {
    const res = await fetch(`${BASE_URL}/api/memories/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changeReason: changeReason || 'Approved by user' }),
    });
    const data = await res.json();
    return data.memory;
  },

  async editAndApproveMemory(
    id: string,
    update: { canonicalText: string; importance?: number; type?: string; changeReason: string }
  ): Promise<Memory> {
    const res = await fetch(`${BASE_URL}/api/memories/${id}/edit-and-approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit_and_approve', ...update }),
    });
    const data = await res.json();
    return data.memory;
  },

  async rejectMemory(id: string, reason?: string): Promise<Memory> {
    const res = await fetch(`${BASE_URL}/api/memories/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'Rejected by user' }),
    });
    const data = await res.json();
    return data.memory;
  },

  async deleteMemory(id: string, mode: 'soft' | 'hard' = 'soft'): Promise<void> {
    await fetch(`${BASE_URL}/api/memories/${id}?mode=${mode}`, {
      method: 'DELETE',
    });
  },

  async createMemory(data: {
    type: string;
    subject: string;
    predicate: string;
    canonicalText: string;
    importance: number;
    sensitivity: string;
  }): Promise<Memory> {
    const res = await fetch(`${BASE_URL}/api/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const resData = await res.json();
    return resData.memory;
  },

  // Persona
  async getPersona(): Promise<Persona> {
    const res = await fetch(`${BASE_URL}/api/persona`);
    const data = await res.json();
    return data.persona;
  },

  async getPersonaRevisions(): Promise<PersonaRevision[]> {
    const res = await fetch(`${BASE_URL}/api/persona/revisions`);
    const data = await res.json();
    return data.revisions || [];
  },

  async updatePersona(payload: {
    name: string;
    instructions: string;
    toneAndManner: string;
    principles: string[];
    changeReason: string;
  }): Promise<Persona> {
    const res = await fetch(`${BASE_URL}/api/persona`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.persona;
  },

  // Providers
  async getProviders(): Promise<ProviderInfo[]> {
    const res = await fetch(`${BASE_URL}/api/providers`);
    const data = await res.json();
    return data.providers || [];
  },

  async listModels(providerId: string, apiKey: string, endpointUrl?: string): Promise<ModelDescriptor[]> {
    const res = await fetch(`${BASE_URL}/api/providers/models`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({providerId,credential:{apiKey,endpointUrl}}) });
    const data=await res.json(); if(!res.ok) throw new Error(data.error?.message || '모델 목록 조회 실패'); return data.models || [];
  },

  async validateCredential(providerId: string, apiKey: string, endpointUrl?: string): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/api/providers/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId,
        credential: { apiKey, endpointUrl },
      }),
    });
    const data = await res.json();
    return Boolean(data.isValid);
  },

  async getProviderConnections(): Promise<PersistedProviderConnection[]> {
    const res = await fetch(`${BASE_URL}/api/providers/connections`);
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
  }): Promise<PersistedProviderConnection> {
    const res = await fetch(`${BASE_URL}/api/providers/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(connection),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Provider connection could not be saved');
    return data.connection;
  },

  async deleteProviderConnection(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/providers/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Provider connection could not be deleted');
    }
  },

  // Developer Context Inspector
  async getContextRun(conversationId: string): Promise<ContextRun | null> {
    const res = await fetch(`${BASE_URL}/api/inspector/${conversationId}`);
    const data = await res.json();
    return data.contextRun || null;
  },
};
