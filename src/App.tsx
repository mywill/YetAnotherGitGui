import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { Sidebar } from "./components/sidebar/Sidebar";
import { HistoryView } from "./components/views/HistoryView";
import { StatusView } from "./components/views/StatusView";
import { WelcomeScreen } from "./components/views/WelcomeScreen";
import { ConfirmDialog } from "./components/common/ConfirmDialog";
import { SettingsMenu } from "./components/common/SettingsMenu";
import { NotificationToast } from "./components/common/NotificationToast";
import { FileStatusCounts } from "./components/layout/FileStatusCounts";
import { useNotificationStore } from "./stores/notificationStore";
import { useRepositoryStore } from "./stores/repositoryStore";
import { useSelectionStore } from "./stores/selectionStore";
import { useDialogStore } from "./stores/dialogStore";
import { useCliArgs } from "./hooks/useCliArgs";
import "./styles/index.css";

export function App() {
  const { repoPath, loading: cliLoading } = useCliArgs();

  const repositoryInfo = useRepositoryStore((s) => s.repositoryInfo);
  const isLoading = useRepositoryStore((s) => s.isLoading);
  const openRepository = useRepositoryStore((s) => s.openRepository);
  const refreshRepository = useRepositoryStore((s) => s.refreshRepository);
  const loadBranchesAndTags = useRepositoryStore((s) => s.loadBranchesAndTags);

  const activeView = useSelectionStore((s) => s.activeView);

  const dialogIsOpen = useDialogStore((s) => s.isOpen);
  const dialogTitle = useDialogStore((s) => s.title);
  const dialogMessage = useDialogStore((s) => s.message);
  const dialogConfirmLabel = useDialogStore((s) => s.confirmLabel);
  const dialogCancelLabel = useDialogStore((s) => s.cancelLabel);
  const dialogOnConfirm = useDialogStore((s) => s.onConfirm);
  const closeDialog = useDialogStore((s) => s.closeDialog);

  useEffect(() => {
    if (repoPath && !cliLoading) {
      openRepository(repoPath);
    }
  }, [repoPath, cliLoading, openRepository]);

  // Load branches and tags when repository is loaded
  useEffect(() => {
    if (repositoryInfo) {
      loadBranchesAndTags();
    }
  }, [repositoryInfo, loadBranchesAndTags]);

  // Keyboard shortcut for refresh (F5 or Ctrl+R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5" || (e.ctrlKey && e.key === "r")) {
        e.preventDefault();
        if (!isLoading && repositoryInfo) {
          refreshRepository();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, repositoryInfo, refreshRepository]);

  if (cliLoading || isLoading) {
    return (
      <div className="app-loading text-text-secondary flex h-full flex-col items-center justify-center gap-3">
        <div className="loading-spinner" />
        <div>Loading repository...</div>
      </div>
    );
  }

  if (!repositoryInfo && !isLoading && !cliLoading) {
    return (
      <div className="app flex h-full w-full flex-col">
        <header className="app-header app-region-drag border-border bg-bg-tertiary flex h-9 shrink-0 items-center justify-between border-b px-3 text-xs leading-none">
          <div className="header-left flex h-full min-w-0 shrink items-center gap-3 overflow-hidden">
            <span className="app-title text-sm leading-none font-semibold">
              Yet Another Git Gui
            </span>
          </div>
          <div className="header-right app-region-no-drag flex h-full shrink-0 items-center gap-2">
            <SettingsMenu />
          </div>
        </header>
        <main className="app-main flex-1 overflow-hidden">
          <WelcomeScreen failedPath={repoPath} />
        </main>
        <NotificationToast />
      </div>
    );
  }

  return (
    <div className="app flex h-full w-full flex-col">
      <header className="app-header app-region-drag border-border bg-bg-tertiary flex h-9 shrink-0 items-center justify-between border-b px-3 text-xs leading-none">
        <div className="header-left flex h-full min-w-0 shrink items-center gap-3 overflow-hidden">
          <span className="app-title text-sm leading-none font-semibold">Yet Another Git Gui</span>
          {repositoryInfo && (
            <>
              <span className="repo-path text-text-secondary max-w-75 truncate text-xs leading-none">
                {repositoryInfo.path}
              </span>
              <span className="branch-indicator app-region-no-drag bg-bg-selected rounded px-2 py-0.5 text-xs leading-none">
                {repositoryInfo.is_detached
                  ? "HEAD detached"
                  : repositoryInfo.current_branch || "No branch"}
              </span>
            </>
          )}
        </div>
        {repositoryInfo && (
          <div className="header-center flex h-full shrink-0 items-center">
            <FileStatusCounts />
          </div>
        )}
        <div className="header-right app-region-no-drag flex h-full shrink-0 items-center gap-2">
          {/* DEBUG: Remove after stacking validation */}
          <button
            className="h-6.5 px-2 leading-none text-green-400"
            onClick={() => useNotificationStore.getState().showSuccess("Success " + Date.now())}
          >
            Test Success
          </button>
          <button
            className="h-6.5 px-2 leading-none text-red-400"
            onClick={() => useNotificationStore.getState().showError("Error " + Date.now())}
          >
            Test Error
          </button>
          <button
            className="h-6.5 px-2 leading-none"
            onClick={refreshRepository}
            disabled={isLoading}
            title="Refresh (F5 or Ctrl+R)"
          >
            Refresh
          </button>
          <SettingsMenu />
        </div>
      </header>

      <main className="app-main flex-1 overflow-hidden">
        <AppLayout sidebar={<Sidebar />}>
          {activeView === "history" ? <HistoryView /> : <StatusView />}
        </AppLayout>
      </main>

      <NotificationToast />

      {dialogIsOpen && (
        <ConfirmDialog
          title={dialogTitle}
          message={dialogMessage}
          confirmLabel={dialogConfirmLabel}
          cancelLabel={dialogCancelLabel}
          onConfirm={() => dialogOnConfirm?.()}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
