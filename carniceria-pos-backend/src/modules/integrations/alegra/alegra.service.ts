/**
 * modules/integrations/alegra/alegra.service.ts
 * -----------------------------------------------------------------------------
 * Logica del modulo de integracion con Alegra.
 *
 * Bloque 7.3: `testConnection` — probar una conexion con credenciales
 * recibidas por parametro, nunca persistidas.
 *
 * Bloque 7.4: `saveConfig`/`getConfigStatus` — configuracion PERSISTENTE
 * (fila unica `AlegraConfig`, ver `alegra.repository.ts`), token siempre
 * cifrado con `alegra.crypto.ts`, nunca en texto plano fuera de una
 * llamada saliente real a Alegra.
 *
 * Bloque 7.5: `resolveGenericClient` — ID del contacto "Cliente General"
 * en Alegra, resuelto una sola vez y persistido en `AlegraConfig`.
 *
 * Bloque 7.6: `resolveProductAlegraId` — mismo patron que 7.5, pero por
 * `Product` (vinculacion permanente en `Product.alegraProductId`).
 *
 * Bloque 7.7: `emitInvoice` — primera emision real de una venta como
 * factura electronica en Alegra, reutilizando 7.5/7.6 para cliente y
 * productos; persiste el resultado en `Sale.alegraInvoice*`.
 *
 * Bloque 7.8: `checkInvoiceStatus` — releer una factura YA emitida
 * (`Sale.alegraInvoiceId`) para refrescar solo estado/clave/fecha, sin
 * volver a resolver cliente ni productos (eso ya quedo resuelto en 7.7).
 *
 * Bloque 7.9/7.10: `getInvoicePdf`/`getInvoiceXml` — descargan PDF/XML de
 * una factura YA emitida, siempre desde Alegra (nunca se persiste una
 * copia local); ambas son wrappers delgados sobre `downloadInvoiceFile`,
 * la logica compartida real.
 *
 * Cualquier operacion futura de negocio (Bloque 7.11+: sincronizar
 * impuestos, notas de credito) se agrega como una funcion mas en este
 * archivo o en un modulo hermano, siempre construyendo su cliente con
 * `buildClientFromConfig()`/`createAlegraClient()` — nunca instanciando
 * axios por su cuenta (ver `alegra.client.ts`).
 */
import axios, { type AxiosInstance } from 'axios';
import type { CustomerIdentificationType, PaymentMethod, UnitOfMeasure } from '@prisma/client';
import { ConflictError, ExternalServiceError, NotFoundError, ValidationError } from '@/shared/errors';
import { ALEGRA_GENERIC_CLIENT_NAME, createAlegraClient, toAppError } from './alegra.client';
import { decryptSecret, encryptSecret, maskSecret } from './alegra.crypto';
import * as alegraRepository from './alegra.repository';
import type {
  AlegraConfigStatus,
  AlegraConnectionTestResult,
  AlegraCredentials,
  AlegraCustomerLinkResult,
  AlegraGenericClientResult,
  AlegraInvoiceFileResult,
  AlegraInvoiceResult,
  AlegraInvoiceStatusResult,
  AlegraProductLinkResult,
  SaveAlegraConfigInput,
} from './alegra.types';

/** Endpoint elegido en el Bloque 7.2 (`GET /company`, confirmado contra
 * `developer.alegra.com/reference/get_company-1`): unica llamada de solo
 * lectura, sin efectos secundarios, que confirma que las credenciales son
 * validas — no emite ningun documento ni crea ningun recurso en Alegra. */
export async function testConnection(
  credentials: AlegraCredentials,
): Promise<AlegraConnectionTestResult> {
  const client = createAlegraClient(credentials);

  try {
    const response = await client.get('/company');

    return {
      connected: true,
      company: {
        name: response.data?.name ?? null,
        identification:
          response.data?.identificationObject?.number ?? response.data?.identification ?? null,
      },
    };
  } catch (error) {
    throw toAppError(error);
  }
}

/**
 * Guarda (crea o actualiza) la configuracion persistente de Alegra —
 * Bloque 7.4, punto 5. `token` es opcional: si llega vacio, se conserva el
 * token cifrado ya guardado (punto 6: el formulario nunca vuelve a mostrar
 * ni a pedir el token en texto plano en cada edicion). Si no hay
 * configuracion previa Y no llega token, es un dato realmente faltante —
 * se rechaza aca (no en el esquema Zod, que no tiene acceso a la base de
 * datos).
 *
 * No prueba la conexion: "Probar conexion" y "Guardar" son dos acciones
 * independientes, a proposito (mismo criterio que separa
 * `alegra.service.testConnection` de esta funcion — ninguna reutiliza
 * logica de la otra mas alla de `createAlegraClient`).
 */
export async function saveConfig(input: SaveAlegraConfigInput): Promise<AlegraConfigStatus> {
  const existing = await alegraRepository.getConfig();

  if (!input.token && !existing) {
    throw new ValidationError('El token de Alegra es obligatorio la primera vez que se configura.');
  }

  const token = input.token ? encryptSecret(input.token) : (existing?.token as string);

  const saved = await alegraRepository.upsertConfig({
    email: input.email,
    token,
    baseUrl: input.baseUrl,
  });

  return toConfigStatus(saved);
}

/**
 * Estado de la configuracion guardada — Bloque 7.4, punto 7. Lee
 * UNICAMENTE la base de datos local: nunca llama a Alegra ("sin realizar
 * consultas innecesarias a Alegra"). `configured: true` es lo que la
 * pantalla traduce a la insignia "Conectado"; `false`, a "Sin configurar".
 */
export async function getConfigStatus(): Promise<AlegraConfigStatus> {
  const existing = await alegraRepository.getConfig();

  if (!existing) {
    return { configured: false, email: null, baseUrl: null, maskedToken: null, updatedAt: null };
  }

  return toConfigStatus(existing);
}

/**
 * Resuelve el ID del contacto "Cliente General" en la cuenta de Alegra
 * configurada — Bloque 7.5, requisito de Alegra para poder emitir una
 * factura sin un cliente real identificado (ver analisis del Bloque 7.2,
 * punto 5).
 *
 * 1. Si ya esta persistido (`AlegraConfig.genericClientId`), lo devuelve
 *    directo — CERO llamadas a Alegra. Esto es lo que garantiza "nunca
 *    crear duplicados" en el caso normal (cada emision futura vuelve a
 *    pasar por aca, pero solo la primera vez toca la red).
 * 2. Si no, busca un contacto EXACTO llamado `ALEGRA_GENERIC_CLIENT_NAME`
 *    (`GET /contacts`, filtrando por nombre — Alegra hace match parcial,
 *    por eso se filtra el resultado por igualdad exacta antes de
 *    reutilizarlo, para no engancharse a un contacto homónimo distinto).
 * 3. Si no existe, lo crea (`POST /contacts`, `type: ['client']`).
 * En ambos casos 2/3, el ID resultante se persiste antes de devolverlo,
 * para que la proxima llamada entre por el camino 1.
 */
export async function resolveGenericClient(): Promise<AlegraGenericClientResult> {
  const config = await alegraRepository.getConfig();

  if (!config) {
    throw new ValidationError('Alegra no esta configurado todavia.');
  }

  if (config.genericClientId) {
    return { id: config.genericClientId, created: false };
  }

  const client = buildClientFromConfig(config);

  try {
    const existing = await findGenericClient(client);

    if (existing) {
      await alegraRepository.setGenericClientId(existing.id);
      return { id: existing.id, created: false };
    }

    const created = await createGenericClient(client);
    await alegraRepository.setGenericClientId(created.id);
    return { id: created.id, created: true };
  } catch (error) {
    throw toAppError(error);
  }
}

/** `type: 'client'` acota la busqueda a contactos-cliente (no proveedores);
 * el filtro por `name` de Alegra es "contiene", asi que el `.find` de
 * abajo exige coincidencia EXACTA antes de reutilizar un ID. */
async function findGenericClient(client: AxiosInstance): Promise<{ id: string } | null> {
  const response = await client.get('/contacts', {
    params: { name: ALEGRA_GENERIC_CLIENT_NAME, type: 'client' },
  });

  const contacts: Array<{ id: string; name: string }> = Array.isArray(response.data)
    ? response.data
    : [];

  const exactMatch = contacts.find((contact) => contact.name === ALEGRA_GENERIC_CLIENT_NAME);

  return exactMatch ? { id: exactMatch.id } : null;
}

/**
 * Fix (04/08/2026, depuracion de emision real): contra la cuenta real de
 * Alegra Costa Rica, `POST /contacts` con solo `{name, type}` rechaza con
 * `400`, codigo `2035` ("El tipo de identificacion es obligatorio") — la
 * cuenta CR exige `identificationObject` (mismo campo que ya devuelve
 * `GET /company`, ver `testConnection`/Bloque 7.2), no solo el `identification`
 * string plano del esquema generico. "Cliente General" no tiene una cedula
 * real: `CF` (cedula fisica) + un numero placeholder de 9 digitos es el
 * mismo criterio que ya usan sistemas de facturacion CR para un consumidor
 * final sin identificacion real.
 */
async function createGenericClient(client: AxiosInstance): Promise<{ id: string }> {
  const response = await client.post('/contacts', {
    name: ALEGRA_GENERIC_CLIENT_NAME,
    type: ['client'],
    identificationObject: { type: 'CF', number: '100000000' },
  });

  return { id: response.data.id };
}

/**
 * Bloque 8.4: resuelve el ID del contacto de Alegra correspondiente a un
 * CLIENTE REAL del ERP (modulo de Clientes, Bloque 8.2) — mismo patron
 * "resolver una vez, persistir para siempre" que `resolveGenericClient`
 * (arriba) y `resolveProductAlegraId` (abajo), adaptado al caso de un
 * cliente identificado en vez del contacto generico fijo:
 *
 * 1. Si el cliente YA tiene `alegraContactId`, lo devuelve directo — CERO
 *    llamadas a Alegra.
 * 2. Si no, busca por identificacion (`GET /contacts?identification=...`,
 *    confirmado como filtro real de Alegra — `developer.alegra.com/reference/listcontacts-1`).
 *    El filtro de Alegra es "contiene", asi que se exige coincidencia
 *    EXACTA (contra `identificationObject.number`) antes de reutilizar un
 *    ID — mismo criterio que `findGenericClient`/`findProductInAlegra`.
 * 3. Si no existe, lo crea (`POST /contacts`) con nombre, tipo/numero de
 *    identificacion real, correo y direccion del cliente (Bloque 8.2, sin
 *    duplicar ningun dato: se toma directo del registro de `Customer`).
 * En ambos casos 2/3, el ID se persiste en `Customer.alegraContactId` antes
 * de devolverlo, para que la proxima llamada entre por el camino 1.
 */
export async function resolveCustomerAlegraId(customerId: string): Promise<AlegraCustomerLinkResult> {
  const customer = await alegraRepository.findCustomerForAlegra(customerId);

  if (!customer) {
    throw new NotFoundError('Cliente');
  }

  if (customer.alegraContactId) {
    return { id: customer.alegraContactId, created: false };
  }

  const config = await alegraRepository.getConfig();

  if (!config) {
    throw new ValidationError('Alegra no esta configurado todavia.');
  }

  const client = buildClientFromConfig(config);

  try {
    const existing = await findCustomerInAlegra(client, customer.identificationNumber);

    if (existing) {
      await alegraRepository.setCustomerAlegraId(customer.id, existing.id);
      return { id: existing.id, created: false };
    }

    const created = await createCustomerInAlegra(client, {
      name: customer.name,
      identificationType: customer.identificationType,
      identificationNumber: customer.identificationNumber,
      email: customer.email,
      address: customer.address,
    });
    await alegraRepository.setCustomerAlegraId(customer.id, created.id);
    return { id: created.id, created: true };
  } catch (error) {
    throw toAppError(error);
  }
}

async function findCustomerInAlegra(
  client: AxiosInstance,
  identificationNumber: string,
): Promise<{ id: string } | null> {
  const response = await client.get('/contacts', {
    params: { identification: identificationNumber, type: 'client' },
  });

  const contacts: Array<{ id: string; identificationObject?: { number?: string } | null }> =
    Array.isArray(response.data) ? response.data : [];

  const exactMatch = contacts.find(
    (contact) => contact.identificationObject?.number === identificationNumber,
  );

  return exactMatch ? { id: exactMatch.id } : null;
}

/**
 * Bloque 8.4: `address` de Alegra es un objeto (confirmado contra la
 * respuesta real de `GET /contacts` — `Cliente General` ya lo devuelve
 * como `{ address, city, department, district, neighborhood }`), no un
 * string plano. `Customer.address` (Bloque 8.2) es un unico campo de
 * texto libre — se envia como `address.address`, dejando
 * ciudad/provincia/canton sin dato (el modelo de Clientes no los separa;
 * agregar esos campos esta fuera de alcance de este bloque). Solo se envia
 * el objeto completo cuando hay direccion real, nunca un objeto vacio.
 */
async function createCustomerInAlegra(
  client: AxiosInstance,
  data: {
    name: string;
    identificationType: CustomerIdentificationType;
    identificationNumber: string;
    email: string | null;
    address: string | null;
  },
): Promise<{ id: string }> {
  const response = await client.post('/contacts', {
    name: data.name,
    type: ['client'],
    identificationObject: { type: data.identificationType, number: data.identificationNumber },
    ...(data.email ? { email: data.email } : {}),
    ...(data.address ? { address: { address: data.address } } : {}),
  });

  return { id: response.data.id };
}

/**
 * Resuelve el ID del producto de Alegra correspondiente a un producto del
 * ERP — Bloque 7.6, para poder facturar sin buscar en cada emision.
 *
 * 1. Si el producto YA tiene `alegraProductId`, lo devuelve directo — CERO
 *    llamadas a Alegra (ni siquiera se carga la configuracion).
 * 2. Si no, busca por el criterio mas estable disponible: `sku` (mapeado
 *    al campo `reference` de Alegra, documentado como identificador
 *    externo — ver `developer.alegra.com/reference/post_items`) cuando el
 *    producto lo tiene; si no tiene `sku`, cae a buscar por `name` (unica
 *    opcion que ofrece la API para ese caso). El filtro de Alegra por
 *    `reference`/`name` es "contiene", asi que se exige coincidencia
 *    EXACTA antes de reutilizar un ID (mismo criterio que
 *    `resolveGenericClient`).
 * 3. Si no existe, lo crea (`POST /items`) con ese mismo `reference`/
 *    `name` y el precio de venta actual.
 * En ambos casos 2/3, el ID se persiste en `Product.alegraProductId` antes
 * de devolverlo, para que la proxima llamada entre por el camino 1.
 */
export async function resolveProductAlegraId(productId: string): Promise<AlegraProductLinkResult> {
  const product = await alegraRepository.findProductForAlegra(productId);

  if (!product) {
    throw new NotFoundError('Producto');
  }

  if (product.alegraProductId) {
    return { id: product.alegraProductId, created: false };
  }

  // Bloque 7.12: Alegra Costa Rica rechaza `POST /items` sin `productKey`
  // (codigo CABYS, `400` codigo `1093` "La clave de producto es
  // requerida", evidenciado con la cuenta real) — se valida ANTES de
  // llamar a Alegra, con un mensaje que apunta al dato faltante en el ERP
  // en vez de dejar que la API externa lo rechace.
  if (!product.cabysCode) {
    throw new ValidationError(
      'El producto no tiene código CABYS asignado — es obligatorio para emitir factura electrónica.',
    );
  }

  const config = await alegraRepository.getConfig();

  if (!config) {
    throw new ValidationError('Alegra no esta configurado todavia.');
  }

  const client = buildClientFromConfig(config);
  const criterion = product.sku
    ? { field: 'reference' as const, value: product.sku }
    : { field: 'name' as const, value: product.name };

  try {
    const existing = await findProductInAlegra(client, criterion);

    if (existing) {
      await alegraRepository.setProductAlegraId(product.id, existing.id);
      return { id: existing.id, created: false };
    }

    const created = await createProductInAlegra(client, {
      name: product.name,
      reference: product.sku,
      price: Number(product.salePrice),
      unitOfMeasure: product.unitOfMeasure,
      cabysCode: product.cabysCode,
    });
    await alegraRepository.setProductAlegraId(product.id, created.id);
    return { id: created.id, created: true };
  } catch (error) {
    throw toAppError(error);
  }
}

async function findProductInAlegra(
  client: AxiosInstance,
  criterion: { field: 'reference' | 'name'; value: string },
): Promise<{ id: string } | null> {
  const response = await client.get('/items', {
    params: { [criterion.field]: criterion.value },
  });

  const items: Array<{ id: string; name: string; reference?: string | null }> = Array.isArray(
    response.data,
  )
    ? response.data
    : [];

  const exactMatch = items.find((item) =>
    criterion.field === 'reference' ? item.reference === criterion.value : item.name === criterion.value,
  );

  return exactMatch ? { id: exactMatch.id } : null;
}

/** Traduce `Product.unitOfMeasure` (enum interno) al catalogo de unidades
 * que exige Alegra Costa Rica para `inventory.unit` (confirmado contra
 * `developer.alegra.com/reference/post_items`: incluye "kilogram"/"unit"
 * entre otras). */
const ALEGRA_UNIT_OF_MEASURE_MAP: Record<UnitOfMeasure, string> = {
  KILOGRAM: 'kilogram',
  UNIT: 'unit',
};

/**
 * Fix (04/08/2026, depuracion de emision real): dos correcciones contra la
 * cuenta real de Alegra Costa Rica, evidenciadas con `POST /items` real:
 *
 * 1. `reference` como string plano rechaza con `400`, codigo `1106`
 *    ("itemReferenceIsNotAValidObject") — la cuenta CR exige `reference`
 *    como objeto (`{reference, type}`), con un catalogo de `type` no
 *    documentado publicamente. Como `reference` es OPCIONAL para items en
 *    Costa Rica (confirmado en la documentacion oficial) y la vinculacion
 *    permanente real vive en `Product.alegraProductId` (no en este campo
 *    de Alegra), se deja de enviar en la creacion en vez de adivinar un
 *    `type` que podria volver a fallar — la busqueda por `reference`
 *    (`findProductInAlegra`) no se ve afectada, sigue intentandose igual.
 * 2. Alegra exige `inventory.unit` para items de Costa Rica — `400`,
 *    codigo `1039` ("Es necesario indicar la unidad de medida del item") —
 *    incluso probando `type: 'service'` (la documentacion dice que para
 *    servicios este atributo se omite, pero la cuenta real lo exige
 *    igual, verificado con una llamada real). Se envia unicamente `unit`
 *    (mapeado desde `Product.unitOfMeasure`, ya existente) — sin
 *    `unitCost`/`initialQuantity`/`warehouses`, que si serian
 *    sincronizacion de inventario real con Alegra, fuera de alcance
 *    explicito de este modulo.
 *
 * Bloque 7.12: `productKey` (codigo CABYS, `Product.cabysCode`) — tercer
 * requisito real de Alegra Costa Rica para `POST /items` (`400` codigo
 * `1093`, "La clave de producto es requerida"), confirmado contra
 * `developer.alegra.com/reference/post_items` (campo top-level de la forma
 * "Item Costa Rica", tipo string). `resolveProductAlegraId` ya valida que
 * `cabysCode` no sea `null` antes de llamar a esta funcion, asi que aca
 * llega siempre como string.
 */
async function createProductInAlegra(
  client: AxiosInstance,
  data: {
    name: string;
    reference: string | null;
    price: number;
    unitOfMeasure: UnitOfMeasure;
    cabysCode: string;
  },
): Promise<{ id: string }> {
  const response = await client.post('/items', {
    name: data.name,
    price: data.price,
    inventory: { unit: ALEGRA_UNIT_OF_MEASURE_MAP[data.unitOfMeasure] },
    productKey: data.cabysCode,
  });

  return { id: response.data.id };
}

/**
 * Bloque 7.15: resuelve el `id` de impuesto real de Alegra (`GET /taxes`,
 * catalogo de la cuenta) que coincide EXACTAMENTE (mismo criterio de
 * coincidencia exacta que `findProductInAlegra`/`findGenericClient`) con el
 * `taxRate` (porcentaje) de la linea de venta. Alegra exige `tax` en cada
 * item para timbrar (ver `emitInvoice`) — no existe forma de omitirlo.
 *
 * Sin persistencia (a diferencia de `resolveProductAlegraId`/
 * `resolveGenericClient`): el catalogo de impuestos de una cuenta es chico
 * y estable, y ya se cachea una sola vez por llamada a `emitInvoice` via
 * `cache` — no amerita una columna nueva en `Tax` para este bloque.
 */
async function resolveAlegraTaxId(
  client: AxiosInstance,
  taxRatePercent: number,
  cache: Map<number, string | null>,
): Promise<string | null> {
  if (cache.has(taxRatePercent)) {
    return cache.get(taxRatePercent) ?? null;
  }

  const response = await client.get('/taxes');
  const taxes: Array<{ id: string; percentage: string }> = Array.isArray(response.data)
    ? response.data
    : [];

  for (const tax of taxes) {
    cache.set(Number(tax.percentage), tax.id);
  }

  return cache.get(taxRatePercent) ?? null;
}

/** Traduce `Sale.paymentMethod` (enum interno) al catalogo de
 * `paymentMethod` que exige Alegra Costa Rica v4.4 (confirmado contra
 * `developer.alegra.com/reference/costa-rica`: CASH/CARD/CHECK/TRANSFER/
 * COLLECTION_BY_THIRD/OTHER). `SINPE_MOVIL` mapea a `TRANSFER` (es una
 * transferencia bancaria instantanea, no un metodo propio del catalogo de
 * Alegra); `MIXED` no tiene equivalente de un solo metodo, cae a `OTHER`. */
const ALEGRA_PAYMENT_METHOD_MAP: Record<PaymentMethod, string> = {
  CASH: 'CASH',
  CARD: 'CARD',
  SINPE_MOVIL: 'TRANSFER',
  TRANSFER: 'TRANSFER',
  MIXED: 'OTHER',
};

/** El ERP no modela "condicion de venta" (todas las ventas del POS son de
 * contado, ver analisis del Bloque 7.2) — Alegra Costa Rica lo exige en la
 * cabecera igual, asi que se envia fijo. Si en el futuro el ERP modela
 * ventas a credito, este valor deja de ser constante. */
const ALEGRA_SALE_CONDITION = 'CASH';

/**
 * Fix (07/08/2026, investigacion real de un 402/codigo 907 "Esta accion no
 * se puede realizar en tu plan actual"): el `id` de `numberTemplate`
 * estaba hardcodeado (confirmado a mano una sola vez contra la cuenta real
 * durante los Bloques 7.13/8.4) — evidencia real reunida durante esa
 * investigacion mostro que esos IDs quedaban desactualizados. Se reemplaza
 * por una resolucion dinamica contra `GET /number-templates` (mismo
 * endpoint, ya confirmado real y vigente contra la documentacion oficial),
 * buscando la plantilla de Factura Electronica (`documentType: 'invoice'`)
 * que ademas tenga `isElectronic: true` — sin persistencia (mismo criterio
 * que `resolveAlegraTaxId`: catalogo chico y estable, se resuelve una vez
 * por llamada a `emitInvoice`, no amerita cachear en la base de datos del
 * ERP).
 *
 * Fix (07/08/2026, decision de negocio): el ERP ya no soporta Tiquete
 * Electronico — esta funcion resuelve exclusivamente la plantilla de
 * Factura Electronica, sin parametro de tipo de comprobante.
 */
const ALEGRA_INVOICE_DOCUMENT_TYPE = 'invoice';

/**
 * Resuelve el `id` de la plantilla de numeracion ELECTRONICA real de la
 * cuenta (`GET /number-templates`) para Factura Electronica. Si la cuenta
 * no tiene ninguna plantilla que combine `documentType: 'invoice'` con
 * `isElectronic: true`, falla con un mensaje claro ANTES de construir el
 * `POST /invoices` — mismo criterio de "fallar rapido" que el resto de las
 * validaciones de `emitInvoice`. Si hay mas de una, tambien falla — tomar
 * la primera en silencio podria elegir la equivocada sin que nadie lo note.
 */
async function resolveElectronicNumberTemplateId(client: AxiosInstance): Promise<string> {
  const response = await client.get('/number-templates');
  const templates: Array<{
    id: string;
    documentType?: string;
    isElectronic?: boolean;
    status?: string;
    isDefault?: boolean;
    name?: string;
  }> = Array.isArray(response.data) ? response.data : [];

  // Fix (07/08/2026, confirmado por Alegra: GET /number-templates tambien
  // devuelve numeraciones desactivadas): `documentType`/`isElectronic` solos
  // no alcanzan para identificar la numeracion vigente — evidenciado con la
  // cuenta real, que tenia DOS plantillas de Factura Electronica
  // (`documentType: 'invoice'`, `isElectronic: true`): una vieja
  // (`status: 'inactive'`, `isDefault: false`) y la principal vigente
  // (`status: 'active'`, `isDefault: true`). Se exigen los 4 campos a la vez
  // para identificar exactamente la numeracion principal activa.
  const matches = templates.filter(
    (template) =>
      template.documentType === ALEGRA_INVOICE_DOCUMENT_TYPE &&
      template.isElectronic === true &&
      template.status === 'active' &&
      template.isDefault === true,
  );

  if (matches.length === 0) {
    throw new ValidationError(
      `La cuenta de Alegra no tiene configurada una numeración electrónica activa y principal para Factura Electrónica (se buscó documentType: "${ALEGRA_INVOICE_DOCUMENT_TYPE}" con isElectronic: true, status: "active", isDefault: true). Revisá la configuración de numeraciones en Alegra.`,
    );
  }

  if (matches.length > 1) {
    throw new ValidationError(
      `La cuenta de Alegra tiene múltiples numeraciones electrónicas activas y principales para Factura Electrónica (documentType: "${ALEGRA_INVOICE_DOCUMENT_TYPE}", isElectronic: true, status: "active", isDefault: true) — el administrador debe revisar la configuración de numeraciones en Alegra y dejar una sola como principal para este tipo de documento.`,
    );
  }

  return matches[0].id;
}

/**
 * Emite una venta del ERP como factura electronica en Alegra — Bloque 7.7.
 * Reutiliza obligatoriamente `resolveGenericClient`/`resolveProductAlegraId`
 * (ninguno vuelve a llamar a Alegra si ya estan vinculados) y
 * `buildClientFromConfig`/`createAlegraClient` para la llamada final.
 *
 * Antes de emitir: valida que haya al menos una linea (falla rapido, antes
 * de resolver nada), resuelve el cliente generico y CADA producto
 * involucrado. Solo entonces arma el payload y llama a `POST /invoices`.
 *
 * Fix (04/08/2026, incidente real durante QA.16A): esta funcion no tenia
 * NINGUNA proteccion contra re-emitir una venta que ya tiene
 * `Sale.alegraInvoiceId` — una llamada repetida (accidental o por doble
 * clic/reintento) volvia a timbrar un comprobante electronico real
 * DUPLICADO ante Hacienda, vía la cuenta real de Alegra en produccion.
 * Confirmado empiricamente: una venta con `alegraInvoiceId: "15"` ya
 * emitido paso a `"16"` tras una segunda llamada — un documento fiscal
 * real duplicado. Este chequeo es la PRIMERA validacion de la funcion,
 * antes de resolver cliente/productos o de cualquier llamada de red a
 * Alegra — ninguna otra logica de emision se modifica.
 *
 * Fix (07/08/2026, decision de negocio): el ERP ya no soporta Tiquete
 * Electronico — se elimino el parametro `documentType` (antes
 * `'TICKET' | 'INVOICE'`, eleccion explicita del usuario desde Version 1.1)
 * y la rama de Tiquete completa. Toda emision es Factura Electronica.
 */
export async function emitInvoice(saleId: string): Promise<AlegraInvoiceResult> {
  const sale = await alegraRepository.findSaleForAlegra(saleId);

  if (!sale) {
    throw new NotFoundError('Venta');
  }

  if (sale.alegraInvoiceId) {
    throw new ConflictError(
      'Esta venta ya tiene un comprobante electrónico emitido — no se puede volver a emitir.',
    );
  }

  if (sale.items.length === 0) {
    throw new ValidationError('La venta no tiene ninguna linea de detalle para facturar.');
  }

  // Una Factura Electronica exige un cliente identificado — "Cliente
  // General" no tiene una identificacion real que Hacienda pueda asociar
  // al comprobante. Se valida ANTES de resolver nada (mismo criterio que
  // el resto de las validaciones de esta funcion: fallar rapido, antes de
  // cualquier llamada de red a Alegra).
  if (!sale.customerId) {
    throw new ConflictError(
      'No se puede emitir una Factura Electrónica sin un cliente identificado — asigná un cliente a esta venta.',
    );
  }

  const config = await alegraRepository.getConfig();

  if (!config) {
    throw new ValidationError('Alegra no esta configurado todavia.');
  }

  const recipient = await resolveCustomerAlegraId(sale.customerId);
  const client = buildClientFromConfig(config);
  const numberTemplateId = await resolveElectronicNumberTemplateId(client);

  // Fix (05/08/2026): calculada una sola vez y reutilizada tanto por la
  // reconciliacion (chequeo de abajo y `catch` mas abajo) como por el
  // `POST /invoices` real — antes se recalculaba dentro del `try`.
  const saleDateForAlegra = formatDateForAlegra(sale.saleDate);

  // Fix (05/08/2026, timeout real de emision): un intento anterior quedo
  // sin poder confirmarse (timeout de red hacia Alegra, ver el `catch` de
  // mas abajo) — antes de construir un nuevo `POST /invoices` (que podria
  // duplicar un comprobante real ya creado del otro lado), se reconcilia
  // contra Alegra usando los mismos datos ya resueltos arriba. Ver
  // `reconcileEmission`/`findExistingInvoiceForSale` mas abajo.
  if (sale.alegraEmissionUncertainAt) {
    // Fix (05/08/2026, correccion del falso negativo real documentado en
    // ROADMAP.md): esta reconciliacion corre en una peticion NUEVA, separada
    // en el tiempo real de aquella que dejo la venta incierta (el usuario
    // volvio a intentar, o la app se reinicio) — a esta altura ya paso
    // tiempo real desde el timeout original, suficiente para que Alegra haya
    // terminado su certificacion asincrona. Si aca tampoco aparece, es la
    // confirmacion definitiva de que no se creo — se limpia la marca
    // (`clearIfNotFound: true`, comportamiento ya existente).
    const reconciled = await reconcileEmission(
      saleId,
      client,
      recipient.id,
      saleDateForAlegra,
      Number(sale.total),
      true,
    ).catch(() => {
      throw new ValidationError(
        'No se pudo confirmar si Alegra ya generó un comprobante en un intento anterior de esta venta — probá de nuevo en unos minutos.',
      );
    });

    if (reconciled) {
      return reconciled;
    }
    // No se encontro ninguna factura real en Alegra — `reconcileEmission`
    // ya limpio la marca de incertidumbre, es seguro continuar abajo con
    // una emision normal.
  }

  // Bloque 7.15: Alegra Costa Rica exige `tax` (impuestos) por linea al
  // timbrar de verdad (`400` codigo 3051, "itemDetails.0.taxes - Missing
  // required property"), evidenciado con la cuenta real recien-habilitada
  // para Tiquete Electronico. El cache evita pedir `/taxes` una vez por
  // linea cuando varias comparten el mismo `taxRate`.
  const alegraTaxIdCache = new Map<number, string | null>();

  const items = [];
  for (const item of sale.items) {
    const link = await resolveProductAlegraId(item.productId);
    const taxRatePercent = Number(item.taxRate);
    const alegraTaxId = await resolveAlegraTaxId(client, taxRatePercent, alegraTaxIdCache);

    if (!alegraTaxId) {
      throw new ValidationError(
        `No se encontro en Alegra un impuesto con ${taxRatePercent}% que coincida con la linea de venta.`,
      );
    }

    items.push({
      id: link.id,
      price: Number(item.unitPrice),
      quantity: Number(item.quantity),
      tax: [{ id: alegraTaxId }],
    });
  }

  try {
    // Fix (04/08/2026, Bloque 7.12, continuacion de la prueba real): Alegra
    // exige `dueDate` en la cabecera (`400` codigo `3007`, "La fecha de
    // vencimiento de la factura es obligatoria", evidenciado con la cuenta
    // real). El ERP no modela ventas a credito (ver `ALEGRA_SALE_CONDITION`
    // arriba, siempre `'CASH'`) — se envia la misma fecha que `date`, unico
    // valor coherente con una venta de contado (vence el mismo dia).
    // Fix (04/08/2026, Bloque 7.12, continuacion de la prueba real):
    // confirmado contra `developer.alegra.com/reference/post_invoices` —
    // sin `stamp.generateStamp`, Alegra crea la factura en estado
    // `draft`/`open` pero NUNCA la envia a Hacienda para timbrado
    // electronico (paso separado, no automatico). El objetivo explicito de
    // este modulo es la factura electronica real (Bloque 7.1: "Alegra es
    // el motor de facturacion electronica"), asi que se pide el timbrado
    // en la misma llamada de creacion.
    const response = await client.post('/invoices', {
      date: saleDateForAlegra,
      dueDate: saleDateForAlegra,
      client: { id: recipient.id },
      items,
      paymentMethod: ALEGRA_PAYMENT_METHOD_MAP[sale.paymentMethod],
      saleCondition: ALEGRA_SALE_CONDITION,
      numberTemplate: { id: numberTemplateId },
      // Fix (07/08/2026, confirmado por soporte de Alegra): el plan "Solo
      // Facturación Pro" no incluye el modulo de Bancos — enviar
      // `payments` (que exige `account.id`, una cuenta bancaria/de caja de
      // ese modulo) provoca el rechazo `402`/codigo `907` ("Esta accion no
      // se puede realizar en tu plan actual"). Se omite el campo por
      // completo; la factura queda "Por cobrar" en Alegra en vez de
      // pagada, consecuencia aceptada de este plan.
      stamp: { generateStamp: true },
    });

    const result = toInvoiceResult(response.data);
    await alegraRepository.setSaleInvoiceInfo(sale.id, result);
    return result;
  } catch (error) {
    // Fix (05/08/2026, timeout real de emision — la respuesta de Alegra
    // tardo 14.5s contra un limite de cliente de 10s): un timeout de RED no
    // confirma que Alegra no haya creado la factura (el timbrado es
    // asincrono, ver comentario de mas arriba) — a diferencia de cualquier
    // otro error (Alegra ya respondio explicitamente que rechazo la
    // solicitud), aca no sabemos que paso del otro lado. Se marca la venta
    // como incierta y se reconcilia de inmediato, en la misma peticion,
    // antes de decirle al usuario "no se emitio".
    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      await alegraRepository.markEmissionUncertain(sale.id);

      // Fix (05/08/2026, correccion de falso negativo real — evidenciado con
      // la venta VTA-000053: Alegra certifico la factura real varios
      // segundos DESPUES de esta reconciliacion inmediata, que no la
      // encontro y —con el codigo anterior— borraba la marca de
      // incertidumbre, dejando la venta sin `alegraInvoiceId` y sin ninguna
      // forma de reconciliar mas tarde, con riesgo real de doble emision).
      // Esta reconciliacion ocurre milisegundos despues del timeout, sin
      // margen real para que la certificacion asincrona de Alegra haya
      // terminado — un "no encontrado" aca NO es una confirmacion valida de
      // que la factura no existe. `clearIfNotFound: false`: si no la
      // encuentra, la marca queda intacta a proposito; solo se limpia mas
      // arriba, en el chequeo proactivo de una peticion posterior, cuando ya
      // paso tiempo real y un "no encontrado" si es una confirmacion
      // definitiva.
      const reconciled = await reconcileEmission(
        sale.id,
        client,
        recipient.id,
        saleDateForAlegra,
        Number(sale.total),
        false,
      ).catch(() => null);

      if (reconciled) {
        return reconciled;
      }
      // No se encontro nada todavia (la marca sigue activa a proposito) o la
      // propia reconciliacion fallo (mismo resultado: la marca queda
      // activa). En ambos casos la proxima emision reconcilia de nuevo antes
      // de crear (ver el chequeo al inicio de esta funcion) — se informa el
      // timeout original, mismo comportamiento visible que antes de este fix.
    }

    throw toAppError(error);
  }
}

/** `yyyy-MM-dd` en la zona horaria de Costa Rica (mismo patron
 * `Intl.DateTimeFormat('en-CA', ...)` ya usado en `shared/utils/date.ts`
 * para fechas-calendario locales, sin exportar una funcion nueva ahi ya
 * que este formato es especifico del payload de Alegra). */
function formatDateForAlegra(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(date);
}

/**
 * Traduce la respuesta de `POST /invoices` a los 5 campos que este bloque
 * persiste — ni uno mas. La documentacion oficial de Alegra NO confirma un
 * campo "clave"/"stamp" estable en la respuesta (verificado contra
 * `developer.alegra.com/reference/get_invoices-id`); se intentan las
 * ubicaciones mas plausibles y, si ninguna aparece, queda `null` — el
 * bloque pide explicitamente guardarla "si Alegra ya la devuelve en la
 * respuesta", no inventarla.
 */
function toInvoiceResult(data: AlegraInvoiceApiResponse): AlegraInvoiceResult {
  return {
    alegraInvoiceId: String(data.id),
    alegraInvoiceNumber:
      data.numberTemplate?.fullNumber ?? (data.numberTemplate?.number ? String(data.numberTemplate.number) : null),
    alegraElectronicKey: extractElectronicKey(data),
    alegraInvoiceStatus: data.status ?? null,
    alegraIssuedAt: data.date ? new Date(data.date) : new Date(),
  };
}

type AlegraInvoiceApiResponse = {
  id: string;
  status?: string;
  date?: string;
  numberTemplate?: { fullNumber?: string; number?: string | number };
  stamp?: { uuid?: string; legend?: string; number?: string };
  // Fix (05/08/2026): solo se usa para reconciliar una emision incierta
  // (`findExistingInvoiceForSale` mas abajo) — confirmado en el esquema de
  // respuesta real de `GET /invoices` (developer.alegra.com/reference/get_invoices).
  total?: number;
};

/** Unico lugar que interpreta donde podria venir la clave electronica en
 * una respuesta de factura de Alegra — compartido por `toInvoiceResult`
 * (Bloque 7.7) y `checkInvoiceStatus` (Bloque 7.8) para no repetir la
 * misma cadena de fallbacks en dos lugares. */
function extractElectronicKey(data: AlegraInvoiceApiResponse): string | null {
  return data.stamp?.uuid ?? data.stamp?.legend ?? data.stamp?.number ?? null;
}

/**
 * Fix (05/08/2026, timeout real de emision — la respuesta de Alegra tardo
 * 14.5s contra un limite de cliente de 10s, dejando la venta sin
 * `alegraInvoiceId` pese a que Alegra pudo haber creado la factura del otro
 * lado): busca si ya existe una factura real para esta venta, usando SOLO
 * filtros que `GET /invoices` soporta de verdad (confirmado contra
 * developer.alegra.com/reference/get_invoices — Alegra no expone ninguna
 * referencia externa propia ni un mecanismo de idempotencia). Mismo patron
 * "buscar antes de crear" que `findGenericClient`/`findProductInAlegra`
 * (Bloques 7.5/7.6): se acota por cliente + fecha (ambos filtros reales) y
 * se confirma la coincidencia exacta comparando `total` del lado del ERP —
 * el resultado para un cliente y un dia puntuales es siempre chico.
 */
async function findExistingInvoiceForSale(
  client: AxiosInstance,
  clientId: string,
  saleDateForAlegra: string,
  total: number,
): Promise<AlegraInvoiceApiResponse | null> {
  const response = await client.get('/invoices', {
    params: { date: saleDateForAlegra, client_id: clientId, status: 'draft,open,closed' },
  });

  const invoices: AlegraInvoiceApiResponse[] = Array.isArray(response.data) ? response.data : [];

  return invoices.find((invoice) => Math.abs(Number(invoice.total ?? NaN) - total) < 0.01) ?? null;
}

/**
 * Fix (05/08/2026): orquesta la reconciliacion de una emision incierta —
 * unico punto que la implementa, invocado desde los dos lugares de
 * `emitInvoice` que la necesitan (antes de crear, si ya venia incierta de un
 * intento anterior; y despues de un timeout nuevo), sin duplicar logica.
 * Reutiliza `toInvoiceResult` (mismo mapeo que una emision exitosa normal) y
 * `alegraRepository.setSaleInvoiceInfo` (ya limpia la marca de incertidumbre,
 * ver `alegra.repository.ts`).
 *
 * Fix (05/08/2026, correccion de falso negativo real — venta VTA-000053, ver
 * ROADMAP.md): "no encontrado" YA NO limpia la marca incondicionalmente —
 * Alegra certifica de forma asincrona, y una reconciliacion que corre
 * milisegundos despues del timeout puede no encontrar todavia una factura
 * que Alegra termina de crear segundos mas tarde. `clearIfNotFound` decide
 * si ese "no encontrado" es una confirmacion valida:
 *  - `false` (reconciliacion inmediata, mismo request que el timeout): la
 *    marca queda intacta, para que una peticion posterior la reintente con
 *    mas margen real de tiempo.
 *  - `true` (chequeo proactivo al inicio de `emitInvoice`, en una peticion
 *    nueva y separada en el tiempo de aquella que dejo la venta incierta):
 *    ya paso tiempo real desde el timeout original, asi que "no encontrado"
 *    aca si es la confirmacion definitiva de que Alegra no creo la factura.
 */
async function reconcileEmission(
  saleId: string,
  client: AxiosInstance,
  clientId: string,
  saleDateForAlegra: string,
  total: number,
  clearIfNotFound: boolean,
): Promise<AlegraInvoiceResult | null> {
  const found = await findExistingInvoiceForSale(client, clientId, saleDateForAlegra, total);

  if (!found) {
    if (clearIfNotFound) {
      await alegraRepository.clearEmissionUncertain(saleId);
    }
    return null;
  }

  const result = toInvoiceResult(found);
  await alegraRepository.setSaleInvoiceInfo(saleId, result);
  return result;
}

/**
 * Consulta el estado ACTUAL de una factura YA emitida en Alegra
 * (`Sale.alegraInvoiceId`) — Bloque 7.8. No resuelve cliente ni productos
 * (eso ya quedo resuelto al emitir, Bloque 7.7) y no emite nada nuevo:
 * es una lectura (`GET /invoices/{id}`, confirmado contra
 * `developer.alegra.com/reference/get_invoices-id`) que solo actualiza,
 * cuando corresponde, los 3 campos consultables:
 *  - `alegraInvoiceStatus`: se actualiza si Alegra devuelve un status
 *    distinto al guardado.
 *  - `alegraElectronicKey`: SOLO se completa si todavia era `null` y
 *    Alegra ya la devuelve — una vez seteada, nunca se vuelve a tocar
 *    (punto 4 del bloque: "si aun no estaba disponible").
 *  - `alegraIssuedAt`: se actualiza si Alegra devuelve una fecha distinta
 *    a la guardada.
 * Si ninguno de los 3 cambio, no se ejecuta ningun `UPDATE` (punto "no
 * realizar consultas innecesarias" — aca aplicado tambien a la escritura,
 * no solo a la lectura).
 */
export async function checkInvoiceStatus(saleId: string): Promise<AlegraInvoiceStatusResult> {
  const sale = await alegraRepository.findSaleInvoiceStatus(saleId);

  if (!sale) {
    throw new NotFoundError('Venta');
  }

  if (!sale.alegraInvoiceId) {
    throw new ValidationError('Esta venta todavia no tiene una factura emitida en Alegra.');
  }

  const config = await alegraRepository.getConfig();

  if (!config) {
    throw new ValidationError('Alegra no esta configurado todavia.');
  }

  const client = buildClientFromConfig(config);

  try {
    const response = await client.get(`/invoices/${sale.alegraInvoiceId}`);
    const data = response.data as AlegraInvoiceApiResponse;

    const nextStatus = data.status ?? sale.alegraInvoiceStatus;
    const nextElectronicKey = sale.alegraElectronicKey ?? extractElectronicKey(data);
    const nextIssuedAt = data.date ? new Date(data.date) : sale.alegraIssuedAt;

    const changes: Partial<{ alegraInvoiceStatus: string; alegraElectronicKey: string; alegraIssuedAt: Date }> = {};

    if (nextStatus !== null && nextStatus !== sale.alegraInvoiceStatus) {
      changes.alegraInvoiceStatus = nextStatus;
    }
    if (nextElectronicKey !== null && nextElectronicKey !== sale.alegraElectronicKey) {
      changes.alegraElectronicKey = nextElectronicKey;
    }
    if (nextIssuedAt !== null && nextIssuedAt.getTime() !== (sale.alegraIssuedAt?.getTime() ?? null)) {
      changes.alegraIssuedAt = nextIssuedAt;
    }

    if (Object.keys(changes).length > 0) {
      await alegraRepository.updateSaleInvoiceStatus(sale.id, changes);
    }

    return {
      alegraInvoiceStatus: nextStatus,
      alegraElectronicKey: nextElectronicKey,
      alegraIssuedAt: nextIssuedAt,
    };
  } catch (error) {
    throw toAppError(error);
  }
}

/**
 * Reenvia por correo una factura YA emitida — Bloque 7.20. Confirmado
 * contra la documentacion oficial (`developer.alegra.com/reference/post_invoices-id-email`,
 * investigacion previa a este bloque): `POST /invoices/{id}/email` opera
 * sobre el comprobante YA EXISTENTE (`Sale.alegraInvoiceId`), sin
 * recrearlo ni volver a timbrarlo — no hay ninguna comunicacion nueva con
 * Hacienda en este paso. Mismo criterio de validacion que
 * `downloadInvoiceFile` (venta existe, ya tiene factura, Alegra
 * configurado) — el ERP no persiste el correo del destinatario (sin
 * modulo de clientes, Bloque 7.2/7.20), solo lo reenvia en la peticion.
 */
export async function sendInvoiceEmail(saleId: string, emails: string[]): Promise<{ message: string }> {
  const sale = await alegraRepository.findSaleForInvoiceFile(saleId);

  if (!sale) {
    throw new NotFoundError('Venta');
  }

  if (!sale.alegraInvoiceId) {
    throw new ValidationError('Esta venta todavia no tiene una factura emitida en Alegra.');
  }

  const config = await alegraRepository.getConfig();

  if (!config) {
    throw new ValidationError('Alegra no esta configurado todavia.');
  }

  const client = buildClientFromConfig(config);

  try {
    const response = await client.post(`/invoices/${sale.alegraInvoiceId}/email`, { emails });
    return { message: response.data?.message ?? 'El comprobante fue reenviado correctamente.' };
  } catch (error) {
    throw toAppError(error);
  }
}

/** Descarga el PDF de una factura YA emitida — Bloque 7.9. Delgado a
 * proposito: toda la logica real vive en `downloadInvoiceFile` (compartida
 * con `getInvoiceXml`, Bloque 7.10). */
export async function getInvoicePdf(saleId: string): Promise<AlegraInvoiceFileResult> {
  return downloadInvoiceFile(saleId, 'pdf');
}

/** Descarga el XML timbrado de una factura YA emitida — Bloque 7.10.
 * Mismo patron exacto que `getInvoicePdf` (punto 7 del bloque: "mismo
 * repositorio, misma validacion, mismo manejo de errores..."), solo
 * cambia el campo (`fields=xml`) y la extension del archivo. */
export async function getInvoiceXml(saleId: string): Promise<AlegraInvoiceFileResult> {
  return downloadInvoiceFile(saleId, 'xml');
}

/**
 * Logica compartida por PDF (Bloque 7.9) y XML (Bloque 7.10) — ningun otro
 * archivo repite estos pasos. Ambos formatos se piden a Alegra de la misma
 * forma (confirmado contra `developer.alegra.com/reference/get_invoices-id`,
 * el parametro `fields` documenta `pdf` y `xml` de forma identica: "para
 * obtener la url del archivo pdf/xml de la factura de venta"):
 *
 * 1. `GET /invoices/{id}?fields=<field>` — Alegra no expone el binario
 *    directo, solo una URL a el.
 * 2. Descargar esa URL (`responseType: 'arraybuffer'`) — Bloque 8.5: SIN
 *    las credenciales de Alegra (ver comentario dentro de la funcion,
 *    causa raiz del bug real de descarga del XML).
 * Nunca se persiste una copia local (punto 6 de ambos bloques): cada
 * solicitud vuelve a pedirselo a Alegra.
 */
/** Bloque 8.5: timeout para la descarga del archivo en si (paso 2 de
 * `downloadInvoiceFile`) — mismo valor conservador que
 * `ALEGRA_REQUEST_TIMEOUT_MS` (`alegra.client.ts`), pero declarado aca
 * porque ese archivo no lo exporta y esta descarga ya no pasa por
 * `createAlegraClient()`. */
const ALEGRA_FILE_DOWNLOAD_TIMEOUT_MS = 10_000;

async function downloadInvoiceFile(
  saleId: string,
  field: 'pdf' | 'xml',
): Promise<AlegraInvoiceFileResult> {
  const sale = await alegraRepository.findSaleForInvoiceFile(saleId);

  if (!sale) {
    throw new NotFoundError('Venta');
  }

  if (!sale.alegraInvoiceId) {
    throw new ValidationError('Esta venta todavia no tiene una factura emitida en Alegra.');
  }

  const config = await alegraRepository.getConfig();

  if (!config) {
    throw new ValidationError('Alegra no esta configurado todavia.');
  }

  const client = buildClientFromConfig(config);
  let fileUrl: string | null;

  try {
    const invoiceResponse = await client.get(`/invoices/${sale.alegraInvoiceId}`, {
      params: { fields: field },
    });
    fileUrl = extractFileUrl(invoiceResponse.data, field);
  } catch (error) {
    throw toAppError(error);
  }

  if (!fileUrl) {
    throw new ExternalServiceError(`Alegra no devolvio la URL del ${field.toUpperCase()} de esta factura.`);
  }

  try {
    // Bloque 8.5 (fix, causa raiz confirmada en el Bloque 8.4): `fileUrl`
    // no es un endpoint de la API de Alegra — es una URL de archivo ya
    // resuelta (para el XML, una URL PREFIRMADA de S3, con su propio
    // mecanismo de autenticacion en la query string). `client` (arriba)
    // adjunta Basic Auth de Alegra a CUALQUIER request que haga, URLs
    // absolutas incluidas (`axios.create({ auth })` no se limita a
    // `baseURL`) — contra una URL prefirmada de S3, ese header extra
    // choca con la firma ya presente y S3 la rechaza (`400`,
    // "Only one auth mechanism allowed"). El PDF no mostraba el sintoma
    // solo porque su URL no siempre pasa por ese mismo mecanismo de
    // firma — no porque necesite el header de Alegra. Fix: se pide este
    // archivo con una instancia de Axios SIN credenciales (`fileClient`,
    // sin `auth`) — la URL que devuelve Alegra ya es autosuficiente, no
    // necesita ninguna autenticacion adicional.
    const fileResponse = await axios.get<ArrayBuffer>(fileUrl, {
      responseType: 'arraybuffer',
      timeout: ALEGRA_FILE_DOWNLOAD_TIMEOUT_MS,
    });

    return {
      buffer: Buffer.from(fileResponse.data),
      filename: `factura-${sale.alegraInvoiceNumber ?? sale.alegraInvoiceId}.${field}`,
    };
  } catch (error) {
    throw toAppError(error);
  }
}

/** La documentacion de Alegra no confirma el nombre exacto del campo que
 * trae la URL del archivo dentro de la respuesta (solo que `fields=pdf`/
 * `fields=xml` la incluyen, ver `developer.alegra.com/reference/get_invoices-id`)
 * — se prueban las formas mas plausibles (string directo u objeto `{ url }`),
 * mismo criterio para ambos formatos. */
function extractFileUrl(
  data: Record<'pdf' | 'xml', string | { url?: string } | undefined>,
  field: 'pdf' | 'xml',
): string | null {
  const value = data[field];

  if (!value) {
    return null;
  }

  return typeof value === 'string' ? value : (value.url ?? null);
}

/** Unico lugar que arma un `AlegraCredentials` a partir de una fila de
 * `AlegraConfig` (descifrando el token) — evita repetir esas 3 lineas en
 * cada operacion que necesita un cliente ya configurado (`resolveGenericClient`,
 * `resolveProductAlegraId`, y las que se agreguen despues). */
function buildClientFromConfig(config: { email: string; token: string; baseUrl: string }) {
  return createAlegraClient({
    email: config.email,
    token: decryptSecret(config.token),
    baseUrl: config.baseUrl,
  });
}

/** Traduce el registro de Prisma (con el token todavia cifrado) a la forma
 * publica — descifra solo para calcular la mascara (`maskSecret`), nunca
 * expone el texto plano completo fuera de este archivo. */
function toConfigStatus(config: {
  email: string;
  token: string;
  baseUrl: string;
  updatedAt: Date;
}): AlegraConfigStatus {
  return {
    configured: true,
    email: config.email,
    baseUrl: config.baseUrl,
    maskedToken: maskSecret(decryptSecret(config.token)),
    updatedAt: config.updatedAt,
  };
}
