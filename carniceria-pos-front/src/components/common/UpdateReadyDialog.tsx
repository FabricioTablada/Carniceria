import { useEffect, useRef, useState } from 'react'
import { Check, Cog, Download, RefreshCw, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * components/common/UpdateReadyDialog.tsx
 * -----------------------------------------------------------------------------
 * Bloque 7.25: ventana de actualizacion propia del ERP — reemplaza al
 * dialogo nativo que antes disparaba `carniceria-pos-desktop/electron/main.ts`
 * (`dialog.showMessageBox`). Exclusivamente visual: la logica de
 * `electron-updater` (descarga automatica, verificacion de checksum,
 * `allowDowngrade=false`, rollback) no cambia — este componente solo
 * relee datos que ya emite o que ahora relee de forma minima (ver
 * `updater.ts`/ROADMAP.md, Bloque 7.25).
 *
 * No renderiza nada si `window.electronAPI` no existe (build web normal,
 * o `vite dev` sin Electron) — mismo criterio de guard ya usado para
 * `window.__DESKTOP_API_BASE_URL__`/`window.__DESKTOP_IS_COLD_BOOT__`
 * (`client.ts`/`App.tsx`).
 *
 * Identidad visual (Decision 3 del bloque, ROADMAP.md): superficie propia
 * de UN SOLO TEMA (oscuro premium) — no sigue el ThemeProvider del ERP,
 * mismo criterio ya usado para `.pos-surface` del POS (que si lo sigue;
 * esta pantalla elige deliberadamente no hacerlo). Tokens en
 * `src/index.css`, clase `.update-ready-surface`.
 */

interface UpdateReadyEventPayload {
  version: string
  releaseNotes: string | null
}

interface UpdateProgressEventPayload {
  percent: number
  transferredBytes: number
  totalBytes: number
}

interface ElectronUpdateAPI {
  getAppInfo: () => Promise<{ version: string; platform: string }>
  onUpdateReady: (callback: (event: UpdateReadyEventPayload) => void) => () => void
  onUpdateProgress: (callback: (event: UpdateProgressEventPayload) => void) => () => void
  getPendingUpdate: () => Promise<UpdateReadyEventPayload | null>
  installUpdateNow: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI?: ElectronUpdateAPI
  }
}

type UpdatePhase = 'idle' | 'downloading' | 'verifying' | 'ready' | 'installing' | 'restarting'

const RESTARTING_DELAY_MS = 1200

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UpdateReadyDialog() {
  const [installedVersion, setInstalledVersion] = useState<string | null>(null)
  const [nextVersion, setNextVersion] = useState<string | null>(null)
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null)
  const [progress, setProgress] = useState<UpdateProgressEventPayload | null>(null)
  const [phase, setPhase] = useState<UpdatePhase>('idle')
  const [dismissed, setDismissed] = useState(false)
  const restartTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => {
    // Limpieza defensiva del timeout local de "Reiniciando" (ver
    // `handleInstallNow`) — en el uso real la app cierra sola segundos
    // despues de `installUpdateNow()`, pero si el componente se
    // desmontara antes por cualquier otro motivo, evita un `setState`
    // sobre un componente ya desmontado.
    return () => {
      if (restartTimeoutRef.current) {
        window.clearTimeout(restartTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    api.getAppInfo().then((info) => setInstalledVersion(info.version)).catch(() => {})

    // Consulta "pull" de una sola vez — cubre el caso real en que la
    // actualizacion ya habia terminado de descargarse/verificarse antes de
    // que esta ventana montara (ver ROADMAP.md, Bloque 7.25, Decision 2).
    api
      .getPendingUpdate()
      .then((pending) => {
        if (!pending) return
        setNextVersion(pending.version)
        setReleaseNotes(pending.releaseNotes)
        setPhase('ready')
      })
      .catch(() => {})

    const unsubscribeProgress = api.onUpdateProgress((event) => {
      setProgress(event)
      setPhase((current) => {
        if (current === 'ready' || current === 'installing' || current === 'restarting') return current
        return event.percent >= 100 ? 'verifying' : 'downloading'
      })
    })

    const unsubscribeReady = api.onUpdateReady((event) => {
      setNextVersion(event.version)
      setReleaseNotes(event.releaseNotes)
      setPhase('ready')
    })

    return () => {
      unsubscribeProgress()
      unsubscribeReady()
    }
  }, [])

  const handleInstallNow = () => {
    setPhase('installing')
    window.electronAPI?.installUpdateNow().catch(() => {})
    // Transicion local, puramente visual (secuencia "Instalando" ->
    // "Reiniciando" antes de que el proceso real cierre la app) — no
    // representa ningun dato nuevo del actualizador, solo ordena dos
    // pasos que van a pasar de todos modos tras `installUpdateNow()`.
    restartTimeoutRef.current = window.setTimeout(() => setPhase('restarting'), RESTARTING_DELAY_MS)
  }

  if (!window.electronAPI || phase === 'idle' || dismissed) {
    return null
  }

  const percent = phase === 'ready' || phase === 'installing' || phase === 'restarting'
    ? 100
    : Math.round(progress?.percent ?? 0)

  const stepState = (step: 'download' | 'verify' | 'install' | 'restart'): 'done' | 'active' | 'pending' => {
    const order: UpdatePhase[] = ['downloading', 'verifying', 'ready', 'installing', 'restarting']
    const stepIndexByPhase: Record<typeof step, number> = { download: 0, verify: 1, install: 3, restart: 4 }
    const currentIndex = order.indexOf(phase)
    const stepIndex = stepIndexByPhase[step]
    if (step === 'verify' && phase === 'ready') return 'done'
    if (step === 'download' && (phase === 'verifying' || phase === 'ready' || phase === 'installing' || phase === 'restarting')) return 'done'
    if (step === 'install' && phase === 'restarting') return 'done'
    if (currentIndex === stepIndex) return 'active'
    return 'pending'
  }

  const statusLabel: Record<UpdatePhase, string> = {
    idle: '',
    downloading: 'Descargando actualización',
    verifying: 'Verificando actualización',
    ready: 'Lista para instalar',
    installing: 'Instalando actualización',
    restarting: 'Reiniciando la aplicación',
  }

  const checklistItems = releaseNotes
    ? releaseNotes.split('\n').map((line) => line.trim()).filter(Boolean)
    : []

  const timelineSteps = [
    { key: 'download' as const, label: 'Descargando', icon: Download },
    { key: 'verify' as const, label: 'Verificando', icon: ShieldCheck },
    { key: 'install' as const, label: 'Instalando', icon: Cog },
    { key: 'restart' as const, label: 'Reiniciando', icon: RefreshCw },
  ]

  const canInstallNow = phase === 'ready'

  return (
    <div className="update-ready-surface fixed inset-0 z-[998] flex items-center justify-center p-6">
      {/* Fondo — placeholder a proposito (sin IA, asset real pendiente,
          ROADMAP.md item 5): degradado + overlay que ya deja la tarjeta
          legible sobre cualquier foto que se agregue despues. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(140% 100% at 15% 0%, oklch(0.32 0.09 24 / 55%), transparent 55%), ' +
            'radial-gradient(120% 90% at 100% 100%, oklch(0.22 0.07 23 / 60%), transparent 60%), ' +
            'linear-gradient(165deg, oklch(0.15 0.01 24) 0%, oklch(0.05 0.006 24) 100%)',
        }}
      />
      <div className="absolute inset-0 backdrop-blur-xl bg-black/40" />
      <p className="absolute bottom-4 left-5 z-[1] max-w-[55%] text-[0.6875rem] leading-relaxed text-white/50">
        Fondo: placeholder — foto real de carnes premium desenfocada (asset pendiente, ROADMAP.md ítem 5)
      </p>

      <div
        className="relative z-[2] flex w-full max-w-[492px] flex-col gap-6 rounded-[1.25rem] p-9 pb-8 shadow-2xl"
        style={{
          background: 'linear-gradient(175deg, var(--ur-card-2), var(--ur-card))',
          border: '1px solid var(--ur-border)',
          color: 'var(--ur-fg)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-[34px] shrink-0 items-center justify-center rounded-[0.55rem] font-mono text-sm font-bold text-brand-foreground shadow-lg"
            style={{ background: 'linear-gradient(155deg, var(--brand-accent), var(--brand-active))' }}
          >
            C
          </div>
          <div className="text-[0.8125rem] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--ur-muted)' }}>
            Carnicería <strong className="tracking-[0.02em]" style={{ color: 'var(--ur-fg)' }}>POS</strong>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            Tu ERP tiene una <span style={{ color: 'var(--brand-accent)' }}>actualización</span> lista
          </h1>
          {installedVersion && nextVersion && (
            <div className="flex items-baseline gap-2 font-mono text-[0.9375rem] tabular-nums">
              <span className="line-through" style={{ color: 'var(--ur-muted)', textDecorationColor: 'oklch(1 0 0 / 25%)' }}>
                {installedVersion}
              </span>
              <span className="text-[0.8rem]" style={{ color: 'var(--ur-muted)' }}>→</span>
              <span className="text-[1.0625rem] font-bold" style={{ color: 'var(--ur-fg)' }}>{nextVersion}</span>
            </div>
          )}
        </div>

        <hr className="m-0 h-px border-0" style={{ background: 'var(--ur-border)' }} />

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="flex items-center gap-2 text-[0.9375rem] font-semibold">
              {(phase === 'downloading' || phase === 'verifying') && (
                <span
                  className="size-2 rounded-full motion-reduce:animate-none animate-pulse"
                  style={{ background: 'var(--brand-accent)', boxShadow: '0 0 0 4px color-mix(in oklch, var(--brand-accent) 25%, transparent)' }}
                />
              )}
              {statusLabel[phase]}
            </span>
            <span className="font-mono text-[1.375rem] font-bold tabular-nums" style={{ color: 'var(--brand-accent)' }}>
              {percent}%
            </span>
          </div>
          <div className="h-3.5 overflow-hidden rounded-full" style={{ background: 'oklch(1 0 0 / 8%)' }}>
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${percent}%`, background: 'linear-gradient(90deg, var(--brand-active), var(--brand-accent))' }}
            />
          </div>
          {progress && phase === 'downloading' && (
            <div className="flex justify-between font-mono text-xs tabular-nums" style={{ color: 'var(--ur-muted)' }}>
              <span>{formatMb(progress.transferredBytes)} de {formatMb(progress.totalBytes)}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-0">
          {timelineSteps.map((step, index) => {
            const state = stepState(step.key)
            const Icon = step.icon
            return (
              <div key={step.key} className="relative flex flex-col items-center gap-2.5 pt-1 text-center">
                {index > 0 && (
                  <span
                    className={cn('absolute top-5 right-1/2 left-[-50%] h-[3px] rounded transition-colors duration-300')}
                    style={{ background: state === 'done' || (state === 'active' && index > 0) ? 'var(--brand-accent)' : 'oklch(1 0 0 / 10%)' }}
                  />
                )}
                <span
                  className="z-[1] flex size-10 items-center justify-center rounded-full border-[2.5px] transition-colors duration-300"
                  style={
                    state === 'done'
                      ? { background: 'linear-gradient(155deg, var(--brand-accent), var(--brand-active))', borderColor: 'transparent', color: 'var(--brand-foreground)', boxShadow: '0 6px 14px -4px color-mix(in oklch, var(--brand) 65%, transparent)' }
                      : state === 'active'
                        ? { borderColor: 'var(--brand-accent)', color: 'var(--brand-accent)', background: 'color-mix(in oklch, var(--brand-accent) 14%, transparent)' }
                        : { borderColor: 'oklch(1 0 0 / 12%)', color: 'var(--ur-muted)', background: 'oklch(1 0 0 / 4%)' }
                  }
                >
                  <Icon className="size-[18px]" />
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: state === 'pending' ? 'var(--ur-muted)' : 'var(--ur-fg)' }}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        <hr className="m-0 h-px border-0" style={{ background: 'var(--ur-border)' }} />

        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.05em] uppercase" style={{ color: 'var(--ur-muted)' }}>
            Novedades{nextVersion ? ` de la versión ${nextVersion}` : ''}
          </p>
          {checklistItems.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {checklistItems.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[0.875rem] font-medium">
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'color-mix(in oklch, var(--success) 18%, transparent)', color: 'var(--success)' }}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            // Sin releaseNotes reales publicadas por el feed — mensaje
            // generico, nunca contenido inventado (ver updater.ts).
            <p className="text-[0.875rem]" style={{ color: 'var(--ur-muted)' }}>
              Esta actualización incluye mejoras y correcciones.
            </p>
          )}
        </div>

        <div
          className="flex items-start gap-2.5 rounded-lg border px-3.5 py-3"
          style={{ borderColor: 'color-mix(in oklch, var(--accent-teal) 40%, transparent)', background: 'color-mix(in oklch, var(--accent-teal) 12%, transparent)' }}
        >
          <ShieldCheck className="mt-0.5 size-[17px] shrink-0" style={{ color: 'var(--accent-teal)' }} />
          <p className="text-[0.8125rem] leading-relaxed" style={{ color: 'oklch(0.92 0.01 165)' }}>
            <strong style={{ color: 'oklch(0.97 0.005 165)' }}>Tu información está segura.</strong> Esta actualización no afecta tu base de datos ni la información del negocio — solo actualiza la aplicación.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setDismissed(true)}
              disabled={phase === 'installing' || phase === 'restarting'}
              className="flex-1 rounded-lg border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: 'oklch(1 0 0 / 12%)', background: 'oklch(1 0 0 / 5%)', color: 'var(--ur-fg)' }}
            >
              Más tarde
            </button>
            <button
              type="button"
              onClick={handleInstallNow}
              disabled={!canInstallNow}
              className="flex-1 rounded-lg px-4 py-3 text-sm font-semibold shadow-lg disabled:cursor-not-allowed disabled:shadow-none"
              style={
                canInstallNow
                  ? { background: 'linear-gradient(155deg, var(--brand-accent), var(--brand-active))', color: 'var(--brand-foreground)' }
                  : { background: 'oklch(1 0 0 / 8%)', color: 'var(--ur-muted)' }
              }
            >
              Actualizar ahora
            </button>
          </div>
          {!canInstallNow && phase !== 'installing' && phase !== 'restarting' && (
            <p className="text-right text-[0.6875rem]" style={{ color: 'var(--ur-muted)' }}>
              Se habilita cuando termina la descarga
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
