import React from "react";

interface AppLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function AppLayout({ sidebar, children }: AppLayoutProps) {
  return (
    <div className="app-layout flex h-full w-full overflow-hidden">
      <div className="app-sidebar border-border bg-bg-secondary flex w-55 shrink-0 flex-col overflow-hidden border-r">
        {sidebar}
      </div>
      <div className="app-content flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
