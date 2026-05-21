export const DEFAULT_IVA_PERCENT = 21;

const roundNumber = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const roundMoney = (value: number) => roundNumber(Number.isFinite(value) ? value : 0, 2);
export const roundPercent = (value: number) => roundNumber(Number.isFinite(value) ? value : 0, 2);

const sanitizeNonNegative = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
};

export interface PricingForwardInput {
  precioCosto: number;
  porcentajeGanancia: number;
  porcentajeIva: number;
}

export interface PricingBackwardInput {
  precioCosto: number;
  precioFinal: number;
  porcentajeIva: number;
}

export interface PricingComputed {
  precioSinIva: number;
  precioFinal: number;
  porcentajeGanancia: number;
}

export const computePricingForward = (input: PricingForwardInput): PricingComputed => {
  const precioCosto = sanitizeNonNegative(input.precioCosto);
  const porcentajeGanancia = sanitizeNonNegative(input.porcentajeGanancia);
  const porcentajeIva = sanitizeNonNegative(input.porcentajeIva);

  const gananciaValor = precioCosto * (porcentajeGanancia / 100);
  const precioSinIva = roundMoney(precioCosto + gananciaValor);
  const precioFinal = roundMoney(precioSinIva * (1 + porcentajeIva / 100));

  return {
    precioSinIva,
    precioFinal,
    porcentajeGanancia: roundPercent(porcentajeGanancia),
  };
};

export const computePricingBackward = (input: PricingBackwardInput): PricingComputed => {
  const precioCosto = sanitizeNonNegative(input.precioCosto);
  const precioFinalInput = sanitizeNonNegative(input.precioFinal);
  const porcentajeIva = sanitizeNonNegative(input.porcentajeIva);
  const ivaFactor = 1 + porcentajeIva / 100;

  const precioSinIva = roundMoney(ivaFactor > 0 ? precioFinalInput / ivaFactor : precioFinalInput);
  const gananciaValor = precioSinIva - precioCosto;
  const porcentajeGanancia =
    precioCosto > 0 ? roundPercent((gananciaValor / precioCosto) * 100) : 0;

  return {
    precioSinIva,
    precioFinal: roundMoney(precioFinalInput),
    porcentajeGanancia,
  };
};

export const derivePricingFromStoredProduct = (params: {
  precioCosto: number;
  precioFinal: number;
  porcentajeIva: number | null | undefined;
  porcentajeGanancia: number | null | undefined;
  precioSinIva: number | null | undefined;
}): PricingComputed & { porcentajeIva: number } => {
  const porcentajeIva =
    params.porcentajeIva != null ? sanitizeNonNegative(params.porcentajeIva) : DEFAULT_IVA_PERCENT;

  if (params.porcentajeGanancia != null && params.precioSinIva != null) {
    return {
      precioSinIva: roundMoney(params.precioSinIva),
      precioFinal: roundMoney(params.precioFinal),
      porcentajeGanancia: roundPercent(params.porcentajeGanancia),
      porcentajeIva: roundPercent(porcentajeIva),
    };
  }

  const backward = computePricingBackward({
    precioCosto: params.precioCosto,
    precioFinal: params.precioFinal,
    porcentajeIva,
  });

  return {
    ...backward,
    porcentajeIva: roundPercent(porcentajeIva),
  };
};
