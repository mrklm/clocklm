import type { CSSProperties, PropsWithChildren } from 'react';

type AppShellProps = PropsWithChildren<{
  style?: CSSProperties;
}>;

export function AppShell({ children, style }: AppShellProps) {
  return (
    <div className="app-shell" style={style}>
      {children}
    </div>
  );
}
