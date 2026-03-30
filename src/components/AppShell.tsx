import type { CSSProperties, PropsWithChildren } from 'react';

type AppShellProps = PropsWithChildren<{
  style?: CSSProperties;
  appSignature?: string;
  appSignatureHref?: string;
}>;

export function AppShell({
  children,
  style,
  appSignature,
  appSignatureHref,
}: AppShellProps) {
  return (
    <div className="app-shell" style={style}>
      {children}
      {appSignature ? (
        appSignatureHref ? (
          <a
            className="app-signature"
            href={appSignatureHref}
            target="_blank"
            rel="noreferrer"
          >
            {appSignature}
          </a>
        ) : (
          <div className="app-signature">{appSignature}</div>
        )
      ) : null}
    </div>
  );
}
