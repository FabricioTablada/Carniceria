import { useState } from 'react'
import { toast } from 'sonner'
import { DatabaseBackup, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

/**
 * features/settings/pages/BackupsPage.tsx
 * -----------------------------------------------------------------------------
 * Configuración → Respaldos. Herramienta exclusiva de la aplicación de
 * escritorio (Electron) — reutiliza íntegramente `runBackup()`/`runRestore()`
 * (`carniceria-pos-desktop/electron/backup-manager.ts`) a través de las
 * mismas 4 funciones que `window.electronAPI` ya expone desde el Parche
 * 1.0.1 (`pickBackupDestination`/`createBackup`/`pickBackupFile`/
 * `restoreBackup`) — ningún IPC, handler ni lógica nueva del lado de
 * Electron; este archivo solo agrega un punto de entrada normal dentro del
 * ERP, complementario al ya existente en el Splash/Modo Mantenimiento
 * (ese sigue siendo la única vía cuando el ERP no llega a arrancar).
 *
 * `getElectronBackupApi()` usa un cast local (no `declare global`) a
 * propósito: `window.electronAPI` ya está tipado globalmente como
 * `ElectronUpdateAPI` por `UpdateReadyDialog.tsx` — declarar un segundo
 * tipo distinto para la misma propiedad global sería un conflicto de
 * fusión de interfaces de TypeScript. Mismo objeto real en tiempo de
 * ejecución (el `electronAPI` de `preload.ts`, compartido por el Splash y
 * la ventana principal), solo se tipa distinto según qué subconjunto de
 * métodos consume cada archivo.
 */
interface ElectronBackupAPI {
  pickBackupDestination: () => Promise<string | null>
  createBackup: (destinationDir: string) => Promise<{ ok: boolean; message: string; filePath?: string }>
  pickBackupFile: () => Promise<string | null>
  restoreBackup: (filePath: string) => Promise<{ ok: boolean; message: string }>
}

function getElectronBackupApi(): ElectronBackupAPI | null {
  if (typeof window === 'undefined') return null
  const api = window.electronAPI as unknown as ElectronBackupAPI | undefined
  return api ?? null
}

export function BackupsPage() {
  const [isCreating, setIsCreating] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [pendingRestoreFile, setPendingRestoreFile] = useState<string | null>(null)

  const electronAPI = getElectronBackupApi()

  const handleCreateBackup = async () => {
    if (!electronAPI) return
    const destinationDir = await electronAPI.pickBackupDestination()
    if (!destinationDir) return

    setIsCreating(true)
    try {
      const result = await electronAPI.createBackup(destinationDir)
      if (result.ok) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handlePickRestoreFile = async () => {
    if (!electronAPI) return
    const filePath = await electronAPI.pickBackupFile()
    if (!filePath) return
    setPendingRestoreFile(filePath)
  }

  const handleConfirmRestore = async () => {
    if (!electronAPI || !pendingRestoreFile) return
    setIsRestoring(true)
    try {
      // La aplicación se reinicia sola en cuanto el proceso principal de
      // Electron confirma el archivo (cierra esta ventana y vuelve a
      // abrirla al terminar) — si eso ocurre, esta promesa nunca resuelve
      // acá porque la ventana que la esperaba ya no existe; el único caso
      // en que sí resuelve es un error temprano (antes de tocar la base),
      // que sí se muestra abajo.
      const result = await electronAPI.restoreBackup(pendingRestoreFile)
      if (!result.ok) {
        toast.error(result.message)
      }
    } finally {
      setIsRestoring(false)
      setPendingRestoreFile(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Configuración', href: '/settings' }, { label: 'Respaldos' }]}
        title="Respaldos"
        description="Generar y restaurar respaldos de la base de datos de esta instalación."
      />

      {!electronAPI ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Esta función solo está disponible en la aplicación de escritorio (Carnicería POS para Windows).
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <DatabaseBackup className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Crear respaldo</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Genera un respaldo completo de la base de datos en la carpeta que elijas.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateBackup}
                disabled={isCreating || isRestoring}
                className="h-10 shrink-0 gap-2 self-start rounded-xl sm:self-center"
              >
                {isCreating ? 'Generando respaldo...' : 'Crear respaldo'}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <RotateCcw className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Restaurar respaldo</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Reemplaza la base de datos actual con un archivo de respaldo. La aplicación se reiniciará sola.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handlePickRestoreFile}
                disabled={isCreating || isRestoring}
                className="h-10 shrink-0 gap-2 self-start rounded-xl sm:self-center"
              >
                Restaurar respaldo
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingRestoreFile !== null}
        onOpenChange={(open) => {
          if (!open && !isRestoring) setPendingRestoreFile(null)
        }}
        title="Restaurar respaldo"
        description="Se generará primero un respaldo de seguridad del estado actual. Luego, la aplicación se reiniciará sola — no la cierre mientras dura la operación."
        confirmText={isRestoring ? 'Restaurando respaldo... No cierre la aplicación' : 'Restaurar'}
        cancelText="Cancelar"
        loading={isRestoring}
        onConfirm={handleConfirmRestore}
      />
    </div>
  )
}
