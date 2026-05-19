import { useState, useEffect, useRef } from 'react';

export default function Header() {
  const [checking, setChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const statusTimerRef = useRef(null);

  // Clear pending timer on unmount to avoid state update on unmounted component
  useEffect(() => {
    return () => { if (statusTimerRef.current) clearTimeout(statusTimerRef.current); };
  }, []);

  const handleCheckUpdate = async () => {
    if (!window.nameforge || checking) return;
    setChecking(true);
    setUpdateStatus(null);

    const result = await window.nameforge.checkAppUpdate();
    setChecking(false);

    if (result.success && result.updateInfo) {
      setUpdateStatus({ type: 'available', version: result.updateInfo.version });
    } else if (!result.success) {
      // publish not configured or network error — show distinct message
      setUpdateStatus({ type: 'error', msg: result.error ?? result.message ?? 'Vérification impossible' });
    } else {
      setUpdateStatus({ type: 'latest' });
    }

    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setUpdateStatus(null), 4000);
  };

  return (
    <header className="flex items-center justify-between px-6 h-12 bg-surface-dark border-b border-app-border shrink-0">
      {/* Logo + nom */}
      <div className="flex items-center gap-3">
        {/* Corner-square décoration — signature NVIDIA design */}
        <div className="w-3 h-3 bg-primary shrink-0" />
        <span className="text-on-dark font-bold text-[18px] tracking-tight">
          Name<span className="text-primary">Forge</span>
        </span>
        <span className="text-stone text-[11px] font-bold uppercase tracking-wider ml-1">
          3D Parametric Generator
        </span>
      </div>

      {/* Droite */}
      <div className="flex items-center gap-3">
        {updateStatus && (
          <span
            className={`text-[12px] font-bold ${
              updateStatus.type === 'available' ? 'text-primary' :
              updateStatus.type === 'error'     ? 'text-red-400' : 'text-stone'
            }`}
          >
            {updateStatus.type === 'available'
              ? `v${updateStatus.version} disponible`
              : updateStatus.type === 'error'
              ? 'Vérification impossible'
              : 'Version à jour'}
          </span>
        )}

        <button
          className="btn-outline text-[13px] h-8 px-3 text-stone border-app-border hover:border-primary hover:text-on-dark"
          onClick={handleCheckUpdate}
          disabled={checking}
        >
          {checking ? 'Vérification…' : 'Mises à jour'}
        </button>
      </div>
    </header>
  );
}
