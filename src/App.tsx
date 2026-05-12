import { useEffect, useMemo } from "react";
import { WorkspaceShell } from "./components/shell/WorkspaceShell";
import { WelcomeScreen } from "./components/views/WelcomeScreen";
import { ConfirmDialog } from "./components/common/ConfirmDialog";
import { CommandPalette } from "./components/common/CommandPalette";
import { SettingsMenu } from "./components/common/SettingsMenu";
import { NotificationToast } from "./components/common/NotificationToast";
import { RepoStateBanner } from "./components/common/RepoStateBanner";
import { FileStatusCounts } from "./components/shell/FileStatusCounts";
import { StatusBar } from "./components/shell/StatusBar";
import { useRepositoryStore } from "./stores/repositoryStore";
import { useSelectionStore } from "./stores/selectionStore";
import { useDialogStore } from "./stores/dialogStore";
import { useCommandPaletteStore } from "./stores/commandPaletteStore";
import { useTerminalStore } from "./stores/terminalStore";
import { useSettingsStore } from "./stores/settingsStore";
import { TerminalPanel } from "./components/terminal/TerminalPanel";
import { useCliArgs } from "./hooks/useCliArgs";
import { usePlatform } from "./hooks/usePlatform";
import { useKeyboardShortcuts, type ShortcutHandler } from "./hooks/useKeyboardShortcuts";
import { YaggButton } from "./components/common/YaggButton";
import { IconSearch, IconRefresh } from "@tabler/icons-react";
import "./styles/index.css";

export function App() {
  const { repoPath, loading: cliLoading } = useCliArgs();

  const repositoryInfo = useRepositoryStore((s) => s.repositoryInfo);
  const isLoading = useRepositoryStore((s) => s.isLoading);
  const openRepository = useRepositoryStore((s) => s.openRepository);
  const refreshRepository = useRepositoryStore((s) => s.refreshRepository);
  const loadBranchesAndTags = useRepositoryStore((s) => s.loadBranchesAndTags);

  const openCommandPalette = useCommandPaletteStore((s) => s.open);

  const setActiveView = useSelectionStore((s) => s.setActiveView);

  const terminalIsOpen = useTerminalStore((s) => s.isOpen);
  const toggleTerminal = useTerminalStore((s) => s.toggleTerminal);

  const { modKey } = usePlatform();

  const dialogIsOpen = useDialogStore((s) => s.isOpen);
  const dialogTitle = useDialogStore((s) => s.title);
  const dialogMessage = useDialogStore((s) => s.message);
  const dialogConfirmLabel = useDialogStore((s) => s.confirmLabel);
  const dialogCancelLabel = useDialogStore((s) => s.cancelLabel);
  const dialogOnConfirm = useDialogStore((s) => s.onConfirm);
  const closeDialog = useDialogStore((s) => s.closeDialog);

  // Load persisted settings (density, theme, layout sizes) on mount
  useEffect(() => {
    useSettingsStore.getState().load();
  }, []);

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

  const shortcuts = useMemo<ShortcutHandler[]>(
    () => [
      {
        key: "F5",
        handler: () => {
          if (!isLoading && repositoryInfo) refreshRepository();
        },
      },
      {
        key: "r",
        mod: true,
        handler: () => {
          if (!isLoading && repositoryInfo) refreshRepository();
        },
      },
      {
        key: "k",
        mod: true,
        handler: () => {
          if (repositoryInfo) openCommandPalette();
        },
      },
      {
        key: "`",
        mod: true,
        // Toggle terminal even from inside the terminal so users can dismiss it.
        suppressInTerminal: false,
        handler: () => toggleTerminal(),
      },
      {
        key: "l",
        mod: true,
        handler: () => {
          if (repositoryInfo) setActiveView("history");
        },
      },
    ],
    [
      isLoading,
      repositoryInfo,
      refreshRepository,
      openCommandPalette,
      toggleTerminal,
      setActiveView,
    ]
  );
  useKeyboardShortcuts(shortcuts);

  if (cliLoading || isLoading) {
    return (
      <div className="app-loading text-text-muted flex h-full flex-col items-center justify-center gap-3">
        <div className="loading-spinner" />
        <div>Loading repository...</div>
      </div>
    );
  }

  if (!repositoryInfo && !isLoading && !cliLoading) {
    return (
      <div className="app flex h-full w-full flex-col">
        <header className="app-header app-region-drag border-border bg-bg-well flex h-9 shrink-0 items-center justify-between border-b px-3 text-xs">
          <div className="header-left flex h-full min-w-0 shrink items-center gap-3 overflow-hidden">
            <span className="app-title text-sm leading-normal font-semibold">
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
      <header className="app-header app-region-drag border-border bg-bg-well flex h-9 shrink-0 items-center justify-between border-b px-3 text-xs">
        <div className="header-left flex h-full min-w-0 shrink items-center gap-3 overflow-hidden">
          <span className="app-title text-sm leading-normal font-semibold">
            Yet Another Git Gui
          </span>
          {repositoryInfo && (
            <span className="repo-path text-text-muted max-w-75 truncate font-mono text-xs leading-normal">
              {repositoryInfo.path}
            </span>
          )}
        </div>
        {repositoryInfo && (
          <div className="header-center flex h-full shrink-0 items-center">
            <FileStatusCounts />
          </div>
        )}
        <div className="header-right app-region-no-drag flex h-full shrink-0 items-center gap-2">
          <YaggButton
            variant="icon"
            onClick={openCommandPalette}
            title={`Search (${modKey}+K)`}
            aria-label="Search"
          >
            <IconSearch size={14} stroke={1.75} aria-hidden />
          </YaggButton>
          <YaggButton
            variant="icon"
            onClick={refreshRepository}
            disabled={isLoading}
            title={`Refresh (F5 or ${modKey}+R)`}
            aria-label="Refresh"
          >
            <IconRefresh size={14} stroke={1.75} aria-hidden />
          </YaggButton>
          <SettingsMenu />
        </div>
      </header>

      <RepoStateBanner />

      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="app-main min-h-0 flex-1 overflow-hidden">
          <WorkspaceShell />
        </main>
        {terminalIsOpen && <TerminalPanel />}
      </div>

      <StatusBar />

      <NotificationToast />

      <CommandPalette />

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
