  /**
   * modules/invoicing/invoicing.numbering.ts
   * -----------------------------------------------------------------------------
   * Construccion de la Clave Numerica (50 digitos) y el Consecutivo (20 digitos)
   * exigidos por el Ministerio de Hacienda de Costa Rica para comprobantes
   * electronicos (Factura Electronica v4.4).
   *
   * Este archivo contiene UNICAMENTE logica pura: funciones deterministicas
   * (mismo input -> mismo output), sin acceso a base de datos, sin llamadas a
   * Hacienda, sin generacion de XML, y sin aleatoriedad oculta dentro de las
   * funciones principales (el codigo de seguridad se genera con su propia
   * funcion, separada, para que `buildClaveNumerica` siga siendo pura y
   * facilmente testeable con valores fijos).
   *
   * Formato del Consecutivo (20 digitos), segun especificacion de Hacienda:
   *   Sucursal (3) + Terminal (5) + Tipo de documento (2) + Numero secuencial (10)
   *
   * Formato de la Clave Numerica (50 digitos):
   *   Codigo pais "506" (3) + Dia (2) + Mes (2) + Anio, 2 ultimos digitos (2)
   *   + Cedula del emisor (12) + Consecutivo (20) + Situacion del comprobante (1)
   *   + Codigo de seguridad (8)
   *
   * NOTA DE ALCANCE: el modelo de datos del comprobante (que va a usar estas
   * funciones) todavia no existe en `schema.prisma` — se agrega en un bloque
   * posterior del roadmap, una vez que esta numeracion y la construccion del
   * XML esten resueltas. Este archivo no depende de ningun modelo de Prisma.
   */

  import { randomInt } from 'node:crypto';

  /**
   * Tipos de documento electronico soportados por Hacienda (catalogo oficial).
   * El alcance actual del proyecto solo emite `TIQUETE_ELECTRONICO`, pero el
   * tipo se modela completo para que Factura Electronica y Nota de Credito
   * puedan reutilizar estas mismas funciones sin cambios, cuando se agreguen.
   */
  export const TIPO_DOCUMENTO_CODIGOS = {
    FACTURA_ELECTRONICA: '01',
    NOTA_DEBITO_ELECTRONICA: '02',
    NOTA_CREDITO_ELECTRONICA: '03',
    TIQUETE_ELECTRONICO: '04',
    CONFIRMACION_ACEPTACION: '05',
    CONFIRMACION_ACEPTACION_PARCIAL: '06',
    CONFIRMACION_RECHAZO: '07',
    FACTURA_ELECTRONICA_COMPRA: '08',
    FACTURA_ELECTRONICA_EXPORTACION: '09',
    RECIBO_ELECTRONICO_PAGO: '10',
  } as const;

  export type TipoDocumento = keyof typeof TIPO_DOCUMENTO_CODIGOS;

  /** Situacion del comprobante ante Hacienda: Normal, Contingencia, o Sin
   * conexion a internet al momento de emitir. */
  export type SituacionComprobante = 'NORMAL' | 'CONTINGENCIA' | 'SIN_INTERNET';

  const SITUACION_CODIGOS: Record<SituacionComprobante, string> = {
    NORMAL: '1',
    CONTINGENCIA: '2',
    SIN_INTERNET: '3',
  };

  /**
   * Tipo de identificacion del emisor, segun el catalogo de Hacienda. El
   * alcance actual del proyecto (una sola carniceria emisora) solo necesita
   * distinguir entre persona fisica y persona juridica; DIMEX y NITE quedan
   * fuera de este alcance hasta que exista un caso real que los requiera.
   * Cada tipo tiene una longitud de digitos fija y verificable — no se acepta
   * ninguna otra longitud "por si acaso".
   */
  export type TipoCedulaEmisor = 'FISICA' | 'JURIDICA';

  const LONGITUD_CEDULA_EMISOR: Record<TipoCedulaEmisor, number> = {
    FISICA: 9,
    JURIDICA: 10,
  };

  /** Rellena `value` con ceros a la izquierda hasta `length` digitos. Lanza un
   * error si `value` no es un entero no negativo o si excede `length` digitos
   * (nunca trunca en silencio un numero que no entra en el formato exigido). */
  function padDigits(value: number, length: number, fieldName: string): string {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${fieldName} debe ser un numero entero no negativo. Recibido: ${value}`);
    }

    const asString = String(value);

    if (asString.length > length) {
      throw new Error(
        `${fieldName} no puede tener mas de ${length} digitos. Recibido: ${asString} (${asString.length} digitos)`,
      );
    }

    return asString.padStart(length, '0');
  }

  /** Valida que `value` sea una cadena compuesta unicamente por digitos, con
   * exactamente `length` caracteres tras el relleno. */
  function assertExactDigits(value: string, length: number, fieldName: string): void {
    if (!/^\d+$/.test(value)) {
      throw new Error(`${fieldName} debe contener unicamente digitos. Recibido: "${value}"`);
    }

    if (value.length !== length) {
      throw new Error(
        `${fieldName} debe tener exactamente ${length} digitos. Recibido: "${value}" (${value.length} digitos)`,
      );
    }
  }

  /** Parametros para construir el Consecutivo de 20 digitos. */
  export interface ConsecutivoParams {
    /** Numero de sucursal ante Hacienda (1-999). */
    sucursal: number;
    /** Numero de terminal/punto de venta (1-99999). */
    terminal: number;
    /** Tipo de documento a emitir. */
    tipoDocumento: TipoDocumento;
    /** Numero secuencial propio de ese tipo de documento (1-9999999999). */
    numeroSecuencial: number;
  }

  /**
   * Construye el Consecutivo de 20 digitos:
   * Sucursal (3) + Terminal (5) + Tipo de documento (2) + Numero secuencial (10).
   */
  export function buildConsecutivo(params: ConsecutivoParams): string {
    const sucursal = padDigits(params.sucursal, 3, 'sucursal');
    const terminal = padDigits(params.terminal, 5, 'terminal');
    const tipoDocumento = TIPO_DOCUMENTO_CODIGOS[params.tipoDocumento];
    const numeroSecuencial = padDigits(params.numeroSecuencial, 10, 'numeroSecuencial');

    const consecutivo = `${sucursal}${terminal}${tipoDocumento}${numeroSecuencial}`;

    assertExactDigits(consecutivo, 20, 'consecutivo');

    return consecutivo;
  }

  /**
   * Genera un codigo de seguridad de 8 digitos aleatorios, tal como lo exige
   * Hacienda dentro de la Clave Numerica. Usa `crypto.randomInt` (Node.js,
   * criptograficamente seguro) en vez de `Math.random()`, que no ofrece
   * garantias de aleatoriedad criptografica. Separado de `buildClaveNumerica`
   * a proposito: esta es la unica funcion de este archivo con aleatoriedad,
   * para que el resto de la logica de numeracion siga siendo pura y
   * facilmente testeable con valores fijos.
   */
  export function generateCodigoSeguridad(): string {
    let codigo = '';

    for (let i = 0; i < 8; i += 1) {
      codigo += String(randomInt(0, 10));
    }

    return codigo;
  }

  /** Parametros para construir la Clave Numerica de 50 digitos. */
  export interface ClaveNumericaParams {
    /** Fecha de emision del comprobante (se usan dia/mes/anio en hora local). */
    fechaEmision: Date;
    /** Cedula del emisor, solo digitos, sin guiones. Su longitud debe
     * coincidir exactamente con la que exige `tipoCedulaEmisor` — no se
     * rellena automaticamente ninguna longitud arbitraria. */
    cedulaEmisor: string;
    /** Tipo de identificacion del emisor (fisica: 9 digitos, juridica: 10
     * digitos). Obligatorio: sin esto no hay forma de validar que
     * `cedulaEmisor` tenga el formato correcto en vez de aceptarlo a ciegas. */
    tipoCedulaEmisor: TipoCedulaEmisor;
    /** Consecutivo de 20 digitos, generado con `buildConsecutivo`. */
    consecutivo: string;
    /** Situacion del comprobante. Por defecto `NORMAL`. */
    situacion?: SituacionComprobante;
    /** Codigo de seguridad de 8 digitos. Generar con `generateCodigoSeguridad()`
     * antes de llamar a esta funcion — no se genera aqui adentro, para que
     * esta funcion sea pura (mismo input siempre produce el mismo output). */
    codigoSeguridad: string;
  }

  /**
   * Construye la Clave Numerica de 50 digitos:
   * "506" (3) + Dia (2) + Mes (2) + Anio-2digitos (2) + Cedula emisor (12)
   * + Consecutivo (20) + Situacion (1) + Codigo de seguridad (8).
   */
  export function buildClaveNumerica(params: ClaveNumericaParams): string {
    const codigoPais = '506';

    const dia = padDigits(params.fechaEmision.getDate(), 2, 'dia');
    const mes = padDigits(params.fechaEmision.getMonth() + 1, 2, 'mes');
    const anio = padDigits(params.fechaEmision.getFullYear() % 100, 2, 'anio');

    // La longitud real de `cedulaEmisor` se valida contra la que exige su
    // `tipoCedulaEmisor` declarado (fisica: 9, juridica: 10) — no se acepta
    // ninguna otra longitud rellenandola en silencio. Recien despues de esa
    // validacion se completa a los 12 digitos que exige el formato de la
    // Clave Numerica (relleno de ceros a la izquierda, requisito real de
    // Hacienda, no una suposicion).
    const longitudEsperada = LONGITUD_CEDULA_EMISOR[params.tipoCedulaEmisor];
    assertExactDigits(params.cedulaEmisor, longitudEsperada, `cedulaEmisor (${params.tipoCedulaEmisor})`);
    const cedulaEmisor = params.cedulaEmisor.padStart(12, '0');

    assertExactDigits(params.consecutivo, 20, 'consecutivo');

    const situacion = SITUACION_CODIGOS[params.situacion ?? 'NORMAL'];

    assertExactDigits(params.codigoSeguridad, 8, 'codigoSeguridad');

    const claveNumerica = `${codigoPais}${dia}${mes}${anio}${cedulaEmisor}${params.consecutivo}${situacion}${params.codigoSeguridad}`;

    assertExactDigits(claveNumerica, 50, 'claveNumerica');

    return claveNumerica;
  }