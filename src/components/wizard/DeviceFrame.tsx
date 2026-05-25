'use client';

interface DeviceFrameProps {
  children: React.ReactNode;
}

/**
 * Wraps the wizard in a fixed 720×1280 card on desktop,
 * collapses to full-bleed on the actual Pi viewport.
 */
export function DeviceFrame({ children }: DeviceFrameProps) {
  return (
    <div className="device-frame">
      {children}
    </div>
  );
}
