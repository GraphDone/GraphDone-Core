import type { ReactNode } from 'react';

export function GraphStatusDock({ children }: { children: ReactNode }) {
  return (
    <div
      data-graph-status-dock="true"
      className="absolute bottom-3 left-16 right-3 z-20 flex max-h-[calc(100%-12rem)] flex-col items-start [&>*]:shrink-0 gap-2 overflow-y-auto pointer-events-auto sm:right-auto sm:max-w-96"
    >
      {children}
    </div>
  );
}
