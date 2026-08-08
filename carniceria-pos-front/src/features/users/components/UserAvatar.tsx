import { getCategoryColor } from '@/lib/categoryColor'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  /** Id del usuario — semilla del color determinístico (`getCategoryColor`,
   * ya existente y reutilizable ERP-wide, ver su propio comentario). El
   * mismo usuario siempre resuelve al mismo color, sin persistir nada. */
  userId: string
  fullName: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Bloque Usuarios (Canvas Workspace, aprobado, "preparar la estructura
   * para soportar fotografía en el futuro sin cambiar la UI"): `User` NO
   * tiene ningún campo de foto hoy (`user.types.ts`, sin cambios) — nadie
   * pasa esta prop todavía, así que el comportamiento actual (siempre
   * iniciales) no cambia. Cuando el backend agregue ese campo, el único
   * cambio necesario será pasarlo aquí. */
  avatarUrl?: string | null
}

const SIZE_CLASSNAMES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  sm: 'size-8 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-16 text-xl',
}

/** Primera letra de las primeras dos "palabras" del nombre completo,
 * mayuscula — mismo criterio que cualquier avatar de iniciales (Gmail,
 * Slack, etc.). Sin apellido/segundo nombre, usa solo la primera letra. */
function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return '?'
  }

  const first = words[0]?.[0] ?? ''
  const second = words.length > 1 ? (words[1]?.[0] ?? '') : ''

  return `${first}${second}`.toUpperCase()
}

/**
 * features/users/components/UserAvatar.tsx
 * -----------------------------------------------------------------------------
 * Bloque Usuarios (aprobado, "avatar inteligente"): `User` no tiene ningún
 * campo de fotografía en el backend (`user.types.ts`, sin adaptaciones) —
 * este componente SIEMPRE muestra un avatar de iniciales con un color
 * determinístico por `userId` (`getCategoryColor`, el mismo hash ya usado
 * para categorías/badges en el resto del ERP, sin inventar un color
 * nuevo). Si en el futuro el backend agrega una foto real, este es el
 * único lugar que necesitaría un branch adicional — hoy no existe ese
 * campo, así que no se simula uno.
 *
 * Reutilizado tal cual en `UsersTable.tsx`, `UserDrawer.tsx` y
 * `UserForm.tsx` — un solo lugar que decide iniciales/color.
 */
export function UserAvatar({ userId, fullName, size = 'md', className, avatarUrl }: UserAvatarProps) {
  const color = getCategoryColor(userId)

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={fullName}
        className={cn('shrink-0 rounded-full object-cover', SIZE_CLASSNAMES[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        color.dot,
        SIZE_CLASSNAMES[size],
        className,
      )}
      aria-hidden
    >
      {getInitials(fullName)}
    </div>
  )
}
