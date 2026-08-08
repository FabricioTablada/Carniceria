/**
 * modules/integrations/alegra/alegra.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo base de integracion con Alegra (Bloque 7.3). Cubre
 * unicamente lo que este bloque implementa: credenciales transitorias (no
 * persistidas) y el resultado de probar la conexion.
 *
 * Bloque 7.4+ (fuera de alcance de este bloque): aqui se agregaran los
 * tipos de las operaciones futuras (clientes, productos, facturas, notas
 * de credito) — cada una como su propio mapper puro que consume
 * `createAlegraClient()` (`alegra.client.ts`), mismo criterio ya usado por
 * `modules/documents/documents.types.ts` (`DocumentBuilder<T>`) para
 * mantener cada operacion aislada y sin logica duplicada.
 */

/** Credenciales de Alegra tal como llegan en cada llamada — nunca se
 * guardan (ver "No implementar" del Bloque 7.3: persistencia definitiva de
 * credenciales queda para un bloque posterior). */
export interface AlegraCredentials {
  email: string;
  token: string;
  /** Opcional: solo para casos de prueba/override. Por defecto
   * `ALEGRA_DEFAULT_BASE_URL` (`alegra.client.ts`). */
  baseUrl?: string;
}

/** Resultado de `POST /integrations/alegra/test-connection` — reutilizado
 * tal cual desde el boton "Probar conexion" de Configuracion > Facturacion
 * Electronica > Alegra (Bloque 7.4), sin cambios respecto al Bloque 7.3. */
export interface AlegraConnectionTestResult {
  connected: true;
  company: {
    name: string | null;
    identification: string | null;
  };
}

/** Cuerpo de `POST /integrations/alegra/config` (Bloque 7.4). `token` es
 * opcional: si se omite (o llega vacio) y ya existe una configuracion
 * guardada, se conserva el token cifrado existente — es como el
 * formulario evita pedir la credencial de nuevo en cada edicion (punto 6
 * del bloque: "el token no debe mostrarse en texto plano al volver a
 * abrir la pantalla"). Si no existe configuracion previa, el token es
 * obligatorio (validado en `alegra.service.ts`, no en el esquema Zod, ya
 * que esa regla depende de datos ya guardados). */
export interface SaveAlegraConfigInput {
  email: string;
  token?: string;
  baseUrl: string;
}

/** Resultado de `GET /integrations/alegra/config` (Bloque 7.4, punto 7):
 * solo lo que ya esta guardado localmente — NUNCA dispara una llamada a
 * Alegra ("sin realizar consultas innecesarias a Alegra"). `token` nunca
 * viaja en texto plano: `maskedToken` es el resultado de
 * `maskSecret()` (`alegra.crypto.ts`), o `null` si no hay configuracion. */
export interface AlegraConfigStatus {
  configured: boolean;
  email: string | null;
  baseUrl: string | null;
  maskedToken: string | null;
  updatedAt: Date | null;
}

/** Resultado de `resolveGenericClient` (Bloque 7.5). `created` distingue
 * "ya existia en Alegra y se reutilizo" de "no existia y se acaba de
 * crear" — util para logging/validacion, sin afectar a quien solo
 * necesita el `id` para armar la factura (Bloque 7.6+). */
export interface AlegraGenericClientResult {
  id: string;
  created: boolean;
}

/** Resultado de `resolveProductAlegraId` (Bloque 7.6). Mismo criterio que
 * `AlegraGenericClientResult` (`created` para logging/validacion). */
export interface AlegraProductLinkResult {
  id: string;
  created: boolean;
}

/** Resultado de `resolveCustomerAlegraId` (Bloque 8.4). Mismo criterio
 * exacto que `AlegraProductLinkResult`. */
export interface AlegraCustomerLinkResult {
  id: string;
  created: boolean;
}

/** Resultado de `emitInvoice` (Bloque 7.7) — exactamente los 5 campos que
 * el bloque pide guardar en la venta local, ni uno mas (sin PDF/XML/
 * reenvio, fuera de alcance). `alegraElectronicKey` es `null` cuando
 * Alegra no la devuelve en la respuesta (la documentacion no confirma que
 * siempre venga — ver `alegra.service.ts`, `extractElectronicKey`). */
export interface AlegraInvoiceResult {
  alegraInvoiceId: string;
  alegraInvoiceNumber: string | null;
  alegraElectronicKey: string | null;
  alegraInvoiceStatus: string | null;
  alegraIssuedAt: Date;
}

/** Resultado de `checkInvoiceStatus` (Bloque 7.8) — el estado VIGENTE de
 * los 3 campos consultables (ya actualizados en `Sale` si cambiaron, o
 * intactos si Alegra no devolvio nada nuevo, ver punto 5 del bloque: "no
 * sobrescribir informacion existente si Alegra no devuelve esos campos"). */
export interface AlegraInvoiceStatusResult {
  alegraInvoiceStatus: string | null;
  alegraElectronicKey: string | null;
  alegraIssuedAt: Date | null;
}

/** Resultado de `getInvoicePdf` (Bloque 7.9) y `getInvoiceXml`
 * (Bloque 7.10) — mismo tipo para ambos (punto 7 del Bloque 7.10: "mismo
 * patron arquitectonico", sin duplicar). Ninguno de los dos se persiste
 * (punto 6: "no almacenar copias locales"), se descargan de Alegra en
 * cada solicitud y se entregan directo al frontend. */
export interface AlegraInvoiceFileResult {
  buffer: Buffer;
  filename: string;
}
