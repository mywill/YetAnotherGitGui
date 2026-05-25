import { ConfirmDialog } from "./ConfirmDialog";

interface CliInstallDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function CliInstallDialog({ onConfirm, onCancel }: CliInstallDialogProps) {
  return (
    <ConfirmDialog
      title="Install CLI Tool"
      message={
        <div className="cli-install-info">
          <p className="text-text-muted mb-2 text-xs leading-normal">
            This will add the <code className="bg-bg-well text-code rounded px-1 py-px">yagg</code>{" "}
            command to{" "}
            <code className="bg-bg-well text-code rounded px-1 py-px">/usr/local/bin</code>. You
            will be prompted for your administrator password.
          </p>
          <p className="text-text-muted mb-2 text-xs leading-normal">
            Any terminals that are already open will need to be restarted, or you can run{" "}
            <code className="bg-bg-well text-code rounded px-1 py-px">source ~/.zshrc</code> (or
            your shell&apos;s equivalent) to pick up the new command.
          </p>
          <p className="cli-install-usage-header text-text-muted mb-1 text-xs leading-normal font-semibold">
            Usage:
          </p>
          <ul className="cli-install-usage text-text-muted mb-2 pl-5 text-xs leading-relaxed">
            <li>
              <code className="bg-bg-well text-code rounded px-1 py-px">yagg</code> &mdash; open
              current directory
            </li>
            <li>
              <code className="bg-bg-well text-code rounded px-1 py-px">yagg /path</code> &mdash;
              open a specific repo
            </li>
          </ul>
          <p className="text-text-muted text-xs leading-normal">
            You can uninstall the CLI tool at any time from the settings gear menu.
          </p>
        </div>
      }
      confirmLabel="Install"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
