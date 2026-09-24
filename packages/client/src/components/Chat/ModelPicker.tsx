import React from 'react';
import { Check, ChevronDown, Plug } from 'lucide-react';
import type { ProviderInfo } from '../../services/api.js';
import type { SessionState } from '../../stores/session.js';
import { useLanguage } from '../../i18n.js';
import { Menu } from '../Common/Menu.js';

interface ModelPickerProps {
  session: SessionState;
  providers: ProviderInfo[];
  onUpdateSession: (partial: Partial<SessionState>) => void;
  onManageConnections: () => void;
}

export function currentProviderOf(session: SessionState, providers: ProviderInfo[]) {
  return providers.find((item) => item.id === session.connectionId)
    || providers.find((item) => item.id === session.providerId)
    || providers[0];
}

/** ChatGPT-style model switcher: one menu, models grouped under their provider or connection. */
export function ModelPicker({ session, providers, onUpdateSession, onManageConnections }: ModelPickerProps) {
  const { t } = useLanguage();
  const provider = currentProviderOf(session, providers);
  const model = provider?.models.find((item) => item.id === session.modelId);

  function select(providerId: string, modelId: string) {
    const connection = session.connections.find((item) => item.id === providerId);
    onUpdateSession({ providerId: connection?.providerId || providerId, connectionId: providerId, modelId });
  }

  return (
    <Menu
      label={t('chat.model')}
      className="max-h-[min(28rem,70vh)] w-72 overflow-y-auto"
      trigger={(props, open) => (
        <button
          type="button"
          {...props}
          aria-label={`${t('chat.model')}: ${model?.name || session.modelId}`}
          className={`inline-flex h-9 max-w-[min(20rem,60vw)] items-center gap-1 rounded-lg px-2.5 text-[17px] font-medium text-fg transition-colors hover:bg-[var(--hover)] ${open ? 'bg-[var(--hover)]' : ''}`}
        >
          <span className="truncate">{model?.name || session.modelId}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-fg-3" />
        </button>
      )}
    >
      {(close) => (
        <>
          {providers.map((item, index) => (
            <div key={item.id} role="group" aria-label={item.name}>
              {index > 0 && <div className="menu-separator" />}
              <p className="menu-label truncate">{item.name}</p>
              {item.models.length === 0 && <p className="px-3 py-1.5 text-sm text-fg-3">{t('chat.noModels')}</p>}
              {item.models.map((option) => {
                const active = provider?.id === item.id && option.id === session.modelId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    className="menu-item"
                    onClick={() => { select(item.id, option.id); close(); }}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.name}</span>
                    {active && <Check className="!text-fg" />}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="menu-separator" />
          <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); onManageConnections(); }}>
            <Plug />
            {t('chat.manageConnections')}
          </button>
        </>
      )}
    </Menu>
  );
}
