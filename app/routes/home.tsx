import { useState, useCallback, useEffect } from 'react';
import { useStore } from '~/lib/store';
import { TopBar } from '~/components/TopBar';
import { RepoPanel } from '~/components/RepoPanel';
import { SitePanel } from '~/components/SitePanel';
import { PromptPanel } from '~/components/PromptPanel';
import { PromptModal } from '~/components/PromptModal';
import { TokenModal } from '~/components/TokenModal';
import type { Prompt } from '~/lib/types';

export default function Home() {
  const store = useStore();

  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);

  // Refresh statuses on mount and when token changes
  useEffect(() => {
    store.refreshAllStatuses();
  }, [store.ghToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Highlight linked items
  const highlightLinked = useCallback((type: 'repo' | 'site', id: string) => {
    document.querySelectorAll('.linked-highlight').forEach(el => el.classList.remove('linked-highlight'));
    if (type === 'repo') {
      const siteId = store.getLinkedSite(id);
      if (siteId) {
        document.querySelector(`[data-site-id="${siteId}"]`)?.classList.add('linked-highlight');
      }
    } else {
      const repoId = store.getLinkedRepo(id);
      if (repoId) {
        document.querySelector(`[data-repo-id="${repoId}"]`)?.classList.add('linked-highlight');
      }
    }
  }, [store.getLinkedSite, store.getLinkedRepo]);

  const clearHighlight = useCallback(() => {
    document.querySelectorAll('.linked-highlight').forEach(el => el.classList.remove('linked-highlight'));
  }, []);

  // Prompt modal handlers
  const handleNewPrompt = useCallback(() => {
    setEditingPrompt(null);
    setPromptModalOpen(true);
  }, []);

  const handleEditPrompt = useCallback((prompt: Prompt) => {
    setEditingPrompt(prompt);
    setPromptModalOpen(true);
  }, []);

  const handleSavePrompt = useCallback((name: string, text: string) => {
    if (editingPrompt) {
      store.updatePrompt(editingPrompt.id, name, text);
    } else {
      store.addPrompt(name, text);
    }
    setPromptModalOpen(false);
    setEditingPrompt(null);
  }, [editingPrompt, store.updatePrompt, store.addPrompt]);

  const handleClosePromptModal = useCallback(() => {
    setPromptModalOpen(false);
    setEditingPrompt(null);
  }, []);

  // Token modal handlers
  const handleOpenTokenModal = useCallback(() => {
    setTokenModalOpen(true);
  }, []);

  const handleSaveToken = useCallback((token: string) => {
    store.saveToken(token);
    setTokenModalOpen(false);
  }, [store.saveToken]);

  const handleDisconnectGitHub = useCallback(() => {
    store.disconnectGitHub();
  }, [store.disconnectGitHub]);

  return (
    <>
      <TopBar
        ghToken={store.ghToken}
        theme={store.theme}
        onToggleTheme={store.toggleTheme}
        onOpenTokenModal={handleOpenTokenModal}
      />

      <div className="layout">
        <RepoPanel
          repos={store.repos}
          actionStatuses={store.actionStatuses}
          repoLanguages={store.repoLanguages}
          linkingMode={store.linkingMode}
          ghToken={store.ghToken}
          onAdd={store.addRepo}
          onRemove={store.removeRepo}
          onSetup={store.setupRepo}
          onEnableActions={store.enableActionsRepo}
          onLink={store.startLink}
          onOpenTokenModal={handleOpenTokenModal}
          getLinkedSite={store.getLinkedSite}
          onHighlight={highlightLinked}
          onClearHighlight={clearHighlight}
        />

        <SitePanel
          sites={store.sites}
          linkingMode={store.linkingMode}
          onAdd={store.addSite}
          onRemove={store.removeSite}
          onBump={store.bumpSite}
          onLink={store.startLink}
          getLinkedRepo={store.getLinkedRepo}
          onHighlight={highlightLinked}
          onClearHighlight={clearHighlight}
        />

        <PromptPanel
          prompts={store.prompts}
          onRemove={store.removePrompt}
          onEdit={handleEditPrompt}
          onNew={handleNewPrompt}
        />
      </div>

      <PromptModal
        isOpen={promptModalOpen}
        editingPrompt={editingPrompt}
        onSave={handleSavePrompt}
        onClose={handleClosePromptModal}
      />

      <TokenModal
        isOpen={tokenModalOpen}
        hasToken={!!store.ghToken}
        onSave={handleSaveToken}
        onDisconnect={handleDisconnectGitHub}
        onClose={() => setTokenModalOpen(false)}
      />
    </>
  );
}
