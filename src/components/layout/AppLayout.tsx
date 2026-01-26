import React from "react";
import "./AppLayout.css";

interface AppLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function AppLayout({ sidebar, children }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <div className="app-sidebar">{sidebar}</div>
      <div className="app-content">{children}</div>
    </div>
  );
}
