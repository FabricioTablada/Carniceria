/**
 * modules/integrations/alegra/alegra.validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) del modulo base de integracion con Alegra.
 * Bloque 7.3: unico esquema necesario es el de la peticion de prueba de
 * conexion — no valida nada de negocio (facturas, clientes, etc.), eso
 * queda para los bloques que implementen esas operaciones.
 */
import { z } from 'zod';

/** Cuerpo de `POST /integrations/alegra/test-connection`. Las credenciales
 * viajan en el cuerpo de la peticion y no se persisten (ver
 * `alegra.types.ts`) — este mismo esquema es el que reutilizara el futuro
 * boton "Probar conexion" de Configuracion > Facturacion Electronica. */
export const TestAlegraConnectionSchema = z.object({
  email: z
    .string({ required_error: 'El correo de Alegra es obligatorio.' })
    .email('El correo de Alegra no es valido.'),
  token: z
    .string({ required_error: 'El token de Alegra es obligatorio.' })
    .min(1, 'El token de Alegra no puede estar vacio.'),
  baseUrl: z.string().url('La URL base debe ser una URL valida.').optional(),
});

export type TestAlegraConnectionDto = z.infer<typeof TestAlegraConnectionSchema>;

/** Cuerpo de `POST /integrations/alegra/config` (Bloque 7.4). `token` es
 * opcional aca a proposito: dejarlo vacio significa "conservar el token ya
 * guardado" (ver `alegra.types.ts`, `SaveAlegraConfigInput`) — la regla de
 * "es obligatorio si nunca se guardo nada" depende de datos existentes en
 * base de datos, asi que se valida en `alegra.service.ts`, no aca. */
export const SaveAlegraConfigSchema = z.object({
  email: z
    .string({ required_error: 'El correo de Alegra es obligatorio.' })
    .email('El correo de Alegra no es valido.'),
  token: z.string().min(1, 'El token de Alegra no puede estar vacio.').optional(),
  baseUrl: z
    .string({ required_error: 'La URL base es obligatoria.' })
    .url('La URL base debe ser una URL valida.'),
});

export type SaveAlegraConfigDto = z.infer<typeof SaveAlegraConfigSchema>;

/** Parametro `:saleId` de `GET /integrations/alegra/sales/:saleId/invoice-pdf`
 * (Bloque 7.9). */
export const SaleIdParamSchema = z.object({
  saleId: z.string().uuid('El identificador de la venta no es valido.'),
});

/** Cuerpo de `POST /integrations/alegra/sales/:saleId/email` (Bloque 7.20).
 * El ERP no almacena correos de clientes (sin modulo de clientes, ver
 * Bloque 7.2) — el destinatario se recibe en cada peticion, nunca se
 * persiste. Un solo correo por reenvio (el dialogo del frontend pide uno
 * solo); se valida como array porque asi lo exige `POST /invoices/{id}/email`
 * de Alegra. */
export const SendInvoiceEmailSchema = z.object({
  emails: z
    .array(z.string().email('El correo electronico no es valido.'))
    .min(1, 'Debes indicar al menos un correo de destino.'),
});

export type SendInvoiceEmailDto = z.infer<typeof SendInvoiceEmailSchema>;

// Fix (07/08/2026, decision de negocio): el ERP ya no soporta Tiquete
// Electronico, solo Factura Electronica — `POST /integrations/alegra/sales/:saleId/emit`
// ya no recibe body (antes `EmitInvoiceSchema` exigia `documentType`, ahora
// no hay eleccion posible). `EmitInvoiceSchema`/`EmitInvoiceDto` eliminados
// por no tener ningun uso.
