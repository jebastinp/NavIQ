import { ReactNode } from 'react';

export default function Topbar({ title, subtitle, actions }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 px-5 sm:px-8 py-5 sm:py-7">
      <div className="flex-1 min-w-0">
        <div className="title-page" style={{ color: 'var(--ink)' }}>{title}</div>
        {subtitle && (
          <div className="text-[13px] mt-1.5" style={{ color: 'var(--ink-3)' }}>{subtitle}</div>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
        </div>
      )}
    </header>
  );
}
