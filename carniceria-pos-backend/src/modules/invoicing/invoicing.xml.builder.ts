/**
 * modules/invoicing/invoicing.xml.builder.ts
 * -----------------------------------------------------------------------------
 * Construye el XML de un Tiquete Electronico (v4.4, Ministerio de Hacienda de
 * Costa Rica) a partir de datos ya calculados. Logica pura: no accede a
 * base de datos, no firma el documento (eso es responsabilidad de
 * `invoicing.hacienda.client.ts`, un bloque posterior), y no llama a
 * Hacienda. Recibe una estructura de datos plana (`TiqueteElectronicoData`),
 * no un modelo de Prisma — mantiene este archivo desacoplado de `Sale`
 * (mismo criterio ya usado en `invoicing.numbering.ts`).
 *
 * ALCANCE (documentado, no oculto): este builder cubre unicamente los
 * elementos obligatorios de un Tiquete Electronico simple, consistente con
 * la decision de alcance ya aprobada (solo TE, sin Factura Electronica ni
 * Nota de Credito todavia):
 *  - Una unica moneda (CRC), tipo de cambio 1.
 *  - Un unico impuesto por linea (IVA), sin exoneraciones.
 *  - Sin `OtrosCargos`, sin `InformacionReferencia` (esta ultima es
 *    exclusiva de Notas de Credito/Debito, fuera de alcance actual).
 *  - Sin elemento `Receptor` (el Tiquete Electronico no lo exige; Factura
 *    Electronica si, cuando se agregue en una fase futura).
 * Ampliar cualquiera de estos puntos es aditivo (agregar campos opcionales
 * y ramas nuevas), no requiere reescribir lo ya construido aqui.
 */

/** Identificacion del emisor. La cedula NO se valida en longitud aqui —
 * esa validacion ya la hace `invoicing.numbering.ts` (`buildClaveNumerica`)
 * antes de que estos datos lleguen a este archivo; este builder confia en
 * recibir datos ya validados, no repite la validacion. */
export interface EmisorData {
  nombre: string;
  tipoIdentificacion: 'FISICA' | 'JURIDICA';
  numeroIdentificacion: string;
  nombreComercial?: string;
  /** Codigos de ubicacion segun el catalogo de Hacienda (provincia 1 digito,
   * canton 2 digitos, distrito 2 digitos). */
  provincia: string;
  canton: string;
  distrito: string;
  barrio?: string;
  otrasSenas: string;
  telefonoCodigoPais?: string;
  telefonoNumero?: string;
  correoElectronico: string;
  /** Codigo de actividad economica (6 digitos), catalogo de Hacienda. */
  codigoActividad: string;
}

/** Una linea de detalle del tiquete (un producto vendido). */
export interface LineaDetalle {
  numeroLinea: number;
  /** Codigo CABYS (13 digitos), catalogo de bienes y servicios de Hacienda. */
  codigoCabys: string;
  cantidad: number;
  unidadMedida: string;
  detalle: string;
  precioUnitario: number;
  /** cantidad * precioUnitario, ya calculado por el llamador. */
  montoTotal: number;
  /** montoTotal menos descuentos de linea (0 si no aplica). */
  subTotal: number;
  /** Tarifa de IVA aplicada (porcentaje, ej. 13). `undefined` si la linea
   * esta exenta. */
  impuestoTarifa?: number;
  /** Monto de impuesto de la linea. `undefined` si la linea esta exenta. */
  impuestoMonto?: number;
  /** subTotal + impuestoMonto (0 si esta exento). */
  montoTotalLinea: number;
}

/** Datos completos necesarios para construir el XML de un Tiquete
 * Electronico. `clave` y `numeroConsecutivo` se generan previamente con
 * `invoicing.numbering.ts`; este builder no los calcula. */
export interface TiqueteElectronicoData {
  /** Clave numerica de 50 digitos (`buildClaveNumerica`). */
  clave: string;
  /** Consecutivo de 20 digitos (`buildConsecutivo`). */
  numeroConsecutivo: string;
  fechaEmision: Date;
  emisor: EmisorData;
  /** Condicion de venta (catalogo Hacienda: "01" = Contado, "02" = Credito, etc). */
  condicionVenta: string;
  /** Medio de pago (catalogo Hacienda: "01" = Efectivo, "02" = Tarjeta, etc). */
  medioPago: string;
  detalleServicio: LineaDetalle[];
  /** Suma de `montoTotalLinea` de las lineas gravadas. */
  totalGravado: number;
  /** Suma de `montoTotalLinea` de las lineas exentas. */
  totalExento: number;
  /** Suma de `montoTotal` de todas las lineas (antes de impuesto). */
  totalVenta: number;
  /** Descuentos totales aplicados (0 si no aplica). */
  totalDescuentos: number;
  /** totalVenta - totalDescuentos. */
  totalVentaNeta: number;
  /** Suma de todos los impuestos de todas las lineas. */
  totalImpuesto: number;
  /** totalVentaNeta + totalImpuesto. */
  totalComprobante: number;
}

/** Escapa los 5 caracteres especiales de XML. Nunca debe interpolarse texto
 * de usuario (nombres, detalle de producto, correo, etc.) sin pasar por
 * esta funcion. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Formatea un monto con 5 decimales, tal como exige Hacienda para los
 * campos monetarios y de cantidad del XML. Lanza un error si `value` no es
 * un numero finito, en vez de producir "NaN" o "Infinity" dentro del XML. */
function formatMonto(value: number, fieldName: string): string {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} debe ser un numero finito. Recibido: ${value}`);
  }

  return value.toFixed(5);
}

/** Formatea la fecha de emision en el formato exigido por Hacienda:
 * ISO 8601 con offset de zona horaria (`YYYY-MM-DDTHH:mm:ssXXX`), usando
 * la hora local de Costa Rica (UTC-6, sin horario de verano). */
function formatFechaEmision(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-06:00`;
}

const TIPO_IDENTIFICACION_CODIGOS: Record<EmisorData['tipoIdentificacion'], string> = {
  FISICA: '01',
  JURIDICA: '02',
};

function buildEmisorXml(emisor: EmisorData): string {
  const telefono =
    emisor.telefonoCodigoPais && emisor.telefonoNumero
      ? `<Telefono><CodigoPais>${escapeXml(emisor.telefonoCodigoPais)}</CodigoPais><NumTelefono>${escapeXml(emisor.telefonoNumero)}</NumTelefono></Telefono>`
      : '';

  const nombreComercial = emisor.nombreComercial
    ? `<NombreComercial>${escapeXml(emisor.nombreComercial)}</NombreComercial>`
    : '';

  const barrio = emisor.barrio ? `<Barrio>${escapeXml(emisor.barrio)}</Barrio>` : '';

  return (
    `<Emisor>` +
    `<Nombre>${escapeXml(emisor.nombre)}</Nombre>` +
    `<Identificacion>` +
    `<Tipo>${TIPO_IDENTIFICACION_CODIGOS[emisor.tipoIdentificacion]}</Tipo>` +
    `<Numero>${escapeXml(emisor.numeroIdentificacion)}</Numero>` +
    `</Identificacion>` +
    nombreComercial +
    `<Ubicacion>` +
    `<Provincia>${escapeXml(emisor.provincia)}</Provincia>` +
    `<Canton>${escapeXml(emisor.canton)}</Canton>` +
    `<Distrito>${escapeXml(emisor.distrito)}</Distrito>` +
    barrio +
    `<OtrasSenas>${escapeXml(emisor.otrasSenas)}</OtrasSenas>` +
    `</Ubicacion>` +
    telefono +
    `<CorreoElectronico>${escapeXml(emisor.correoElectronico)}</CorreoElectronico>` +
    `</Emisor>`
  );
}

function buildLineaDetalleXml(linea: LineaDetalle): string {
  const impuesto =
    linea.impuestoTarifa !== undefined && linea.impuestoMonto !== undefined
      ? `<Impuesto>` +
        `<Codigo>01</Codigo>` +
        `<Tarifa>${formatMonto(linea.impuestoTarifa, `detalleServicio[${linea.numeroLinea}].impuestoTarifa`)}</Tarifa>` +
        `<Monto>${formatMonto(linea.impuestoMonto, `detalleServicio[${linea.numeroLinea}].impuestoMonto`)}</Monto>` +
        `</Impuesto>`
      : '';

  return (
    `<LineaDetalle>` +
    `<NumeroLinea>${linea.numeroLinea}</NumeroLinea>` +
    `<CodigoCABYS>${escapeXml(linea.codigoCabys)}</CodigoCABYS>` +
    `<Cantidad>${formatMonto(linea.cantidad, `detalleServicio[${linea.numeroLinea}].cantidad`)}</Cantidad>` +
    `<UnidadMedida>${escapeXml(linea.unidadMedida)}</UnidadMedida>` +
    `<Detalle>${escapeXml(linea.detalle)}</Detalle>` +
    `<PrecioUnitario>${formatMonto(linea.precioUnitario, `detalleServicio[${linea.numeroLinea}].precioUnitario`)}</PrecioUnitario>` +
    `<MontoTotal>${formatMonto(linea.montoTotal, `detalleServicio[${linea.numeroLinea}].montoTotal`)}</MontoTotal>` +
    `<SubTotal>${formatMonto(linea.subTotal, `detalleServicio[${linea.numeroLinea}].subTotal`)}</SubTotal>` +
    impuesto +
    `<MontoTotalLinea>${formatMonto(linea.montoTotalLinea, `detalleServicio[${linea.numeroLinea}].montoTotalLinea`)}</MontoTotalLinea>` +
    `</LineaDetalle>`
  );
}

function buildResumenFacturaXml(data: TiqueteElectronicoData): string {
  return (
    `<ResumenFactura>` +
    `<CodigoTipoMoneda>` +
    `<CodigoMoneda>CRC</CodigoMoneda>` +
    `<TipoCambio>${formatMonto(1, 'tipoCambio')}</TipoCambio>` +
    `</CodigoTipoMoneda>` +
    `<TotalGravado>${formatMonto(data.totalGravado, 'totalGravado')}</TotalGravado>` +
    `<TotalExento>${formatMonto(data.totalExento, 'totalExento')}</TotalExento>` +
    `<TotalVenta>${formatMonto(data.totalVenta, 'totalVenta')}</TotalVenta>` +
    `<TotalDescuentos>${formatMonto(data.totalDescuentos, 'totalDescuentos')}</TotalDescuentos>` +
    `<TotalVentaNeta>${formatMonto(data.totalVentaNeta, 'totalVentaNeta')}</TotalVentaNeta>` +
    `<TotalImpuesto>${formatMonto(data.totalImpuesto, 'totalImpuesto')}</TotalImpuesto>` +
    `<TotalComprobante>${formatMonto(data.totalComprobante, 'totalComprobante')}</TotalComprobante>` +
    `</ResumenFactura>`
  );
}

/**
 * Construye el XML completo, sin firmar, de un Tiquete Electronico.
 * Funcion pura: el mismo `data` siempre produce el mismo XML.
 */
export function buildTiqueteElectronicoXml(data: TiqueteElectronicoData): string {
  if (data.detalleServicio.length === 0) {
    throw new Error('detalleServicio debe incluir al menos una linea.');
  }

  const detalleServicioXml = data.detalleServicio.map((linea) => buildLineaDetalleXml(linea)).join('');

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<TiqueteElectronico xmlns="https://tribunet.hacienda.go.cr/docs/esquemas/2016/v4.4/tiqueteElectronico" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<Clave>${escapeXml(data.clave)}</Clave>` +
    `<CodigoActividadEmisor>${escapeXml(data.emisor.codigoActividad)}</CodigoActividadEmisor>` +
    `<NumeroConsecutivo>${escapeXml(data.numeroConsecutivo)}</NumeroConsecutivo>` +
    `<FechaEmision>${formatFechaEmision(data.fechaEmision)}</FechaEmision>` +
    buildEmisorXml(data.emisor) +
    `<CondicionVenta>${escapeXml(data.condicionVenta)}</CondicionVenta>` +
    `<MedioPago>${escapeXml(data.medioPago)}</MedioPago>` +
    `<DetalleServicio>${detalleServicioXml}</DetalleServicio>` +
    buildResumenFacturaXml(data) +
    `</TiqueteElectronico>`;

  return xml;
}