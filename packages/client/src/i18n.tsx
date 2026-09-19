import React, { createContext, useContext, useMemo, useState } from 'react';

export type Language = 'ko' | 'en';
type Dictionary = Record<string, string>;

const dictionaries: Record<Language, Dictionary> = {
  ko: {
    'brand.tagline': '모든 모델에서 이어지는 나의 맥락',
    'nav.chat': '채팅', 'nav.memory': '기억', 'nav.persona': '페르소나', 'nav.projects': '프로젝트', 'nav.settings': '설정', 'nav.inspector': '컨텍스트 검사',
    'chat.conversations': '대화', 'chat.emptyConversations': '아직 대화가 없습니다.', 'chat.new': '새 대화', 'chat.global': '전체 맥락', 'chat.conversation': '대화', 'chat.empty.title': '무엇을 함께 정리해볼까요?',
    'chat.empty.body': 'Espera는 중요한 프로젝트와 선호를 기억 후보로 제안합니다. 승인한 기억은 다른 AI 모델로 바꿔도 계속 이어집니다.',
    'chat.prompt.memory': '내 기억을 확인해줘', 'chat.prompt.plan': '이번 주 계획을 정리해줘', 'chat.prompt.project': 'Project Espera를 설명해줘',
    'chat.placeholder': '메시지를 입력하세요...', 'chat.disclaimer': 'Espera도 실수할 수 있습니다. 중요한 기억은 승인하기 전에 확인하세요.', 'chat.streaming': '답변 생성 중...', 'chat.retry': '다시 시도',
    'memory.title': '기억 보관소', 'memory.subtitle': 'Espera가 제안한 기억을 검토하고, 승인한 정보만 장기 맥락으로 사용합니다.', 'memory.add': '기억 추가', 'memory.pending': '검토 대기', 'memory.active': '활성 기억', 'memory.history': '기록', 'memory.search': '기억 검색...',
    'persona.title': '페르소나', 'persona.subtitle': 'AI가 나를 대하는 방식과 응답 원칙을 직접 정의합니다.', 'persona.edit': '편집',
    'projects.title': '프로젝트', 'projects.subtitle': '장기 작업을 분리해 프로젝트별 기억과 맥락을 유지합니다.', 'projects.create': '프로젝트 만들기', 'projects.name': '프로젝트 이름', 'projects.description': '이 프로젝트에 포함할 내용', 'projects.empty': '아직 프로젝트가 없습니다.',
    'settings.title': '설정', 'settings.language': '언어', 'settings.language.help': 'Espera 화면에 사용할 언어를 선택하세요.', 'settings.korean': '한국어', 'settings.english': 'English',
    'settings.providers': 'Provider 연결', 'settings.providers.help': 'API Key는 이 브라우저 탭에서만 사용되며 저장되지 않습니다.', 'settings.addConnection': '연결 추가', 'settings.provider': 'Provider', 'settings.connectionName': '연결 이름', 'settings.baseUrl': 'API Base URL', 'settings.apiKey': 'API Key', 'settings.discover': '모델 검색', 'settings.save': '연결 저장', 'settings.saved': '저장된 연결', 'settings.none': '저장된 연결이 없습니다.',
    'auth.welcome': 'Espera에 오신 것을 환영합니다', 'auth.body': '대화, 기억, 개인 AI 맥락을 하나의 비공개 workspace에서 관리하세요.', 'auth.github': 'GitHub로 계속하기', 'auth.notConfigured': 'GitHub 로그인이 아직 설정되지 않았습니다.',
  },
  en: {
    'brand.tagline': 'Your context, across every model',
    'nav.chat': 'Chat', 'nav.memory': 'Memory', 'nav.persona': 'Persona', 'nav.projects': 'Projects', 'nav.settings': 'Settings', 'nav.inspector': 'Context inspector',
    'chat.conversations': 'Conversations', 'chat.emptyConversations': 'No conversations yet.', 'chat.new': 'New chat', 'chat.global': 'Global context', 'chat.conversation': 'Conversation', 'chat.empty.title': 'What shall we work on?',
    'chat.empty.body': 'Espera proposes important projects and preferences as memories. Approved memories continue across every AI model.',
    'chat.prompt.memory': 'Show me what you remember', 'chat.prompt.plan': 'Help me plan this week', 'chat.prompt.project': 'Explain Project Espera',
    'chat.placeholder': 'Message Espera...', 'chat.disclaimer': 'Espera can make mistakes. Review important memories before approving them.', 'chat.streaming': 'Generating response...', 'chat.retry': 'Retry',
    'memory.title': 'Memory', 'memory.subtitle': 'Review proposed memories and choose what becomes part of your long-term context.', 'memory.add': 'Add memory', 'memory.pending': 'Review queue', 'memory.active': 'Active', 'memory.history': 'History', 'memory.search': 'Search memories...',
    'persona.title': 'Persona', 'persona.subtitle': 'Define how your AI should treat you and respond to you.', 'persona.edit': 'Edit persona',
    'projects.title': 'Projects', 'projects.subtitle': 'Keep long-running work separate with project-scoped memory and context.', 'projects.create': 'Create project', 'projects.name': 'Project name', 'projects.description': 'What belongs in this project?', 'projects.empty': 'No projects yet.',
    'settings.title': 'Settings', 'settings.language': 'Language', 'settings.language.help': 'Choose the language used throughout Espera.', 'settings.korean': '한국어', 'settings.english': 'English',
    'settings.providers': 'Provider connections', 'settings.providers.help': 'API keys are used only in this browser tab and are never stored.', 'settings.addConnection': 'Add connection', 'settings.provider': 'Provider', 'settings.connectionName': 'Connection name', 'settings.baseUrl': 'API base URL', 'settings.apiKey': 'API key', 'settings.discover': 'Discover models', 'settings.save': 'Save connection', 'settings.saved': 'Saved connections', 'settings.none': 'No saved connections yet.',
    'auth.welcome': 'Welcome to Espera', 'auth.body': 'Your conversations, memory, and personal AI context in one private workspace.', 'auth.github': 'Continue with GitHub', 'auth.notConfigured': 'GitHub sign-in is not configured yet.',
  },
};

interface LanguageContextValue { language: Language; setLanguage: (language: Language) => void; t: (key: string) => string; }
const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = 'espera_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ko'; } catch { return 'ko'; }
  });
  const setLanguage = (next: Language) => { setLanguageState(next); try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage may be unavailable */ } };
  const value = useMemo(() => ({ language, setLanguage, t: (key: string) => dictionaries[language][key] || dictionaries.en[key] || key }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
