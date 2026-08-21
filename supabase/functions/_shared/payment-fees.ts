import {
  flutterwaveRequest,
} from './flutterwave.ts';

const supportedMethods:
  Record<string, string> = {
    bank_transfer:
      'bank_transfer',

    opay:
      'opay',
  };

function moneyToKobo(
  value: unknown,
) {
  const amount =
    Number(value);

  if (
    !Number.isFinite(
      amount,
    ) ||
    amount < 0
  ) {
    return null;
  }

  return Math.round(
    amount * 100,
  );
}

function sumFeeRows(
  rows: unknown,
) {
  if (
    !Array.isArray(
      rows,
    )
  ) {
    return null;
  }

  let total = 0;

  let found =
    false;

  for (
    const row of
    rows
  ) {
    const amount =
      moneyToKobo(
        row?.amount,
      );

    if (
      amount !==
      null
    ) {
      total +=
        amount;

      found =
        true;
    }
  }

  return found
    ? total
    : null;
}

function extractFeeKobo(
  response: any,
) {
  const data =
    response?.data ??
    response;

  if (
    typeof data ===
      'number' ||
    typeof data ===
      'string'
  ) {
    const direct =
      moneyToKobo(
        data,
      );

    if (
      direct !==
      null
    ) {
      return direct;
    }
  }

  const rowTotal =
    sumFeeRows(
      data,
    );

  if (
    rowTotal !==
    null
  ) {
    return rowTotal;
  }

  const nestedRows =
    sumFeeRows(
      data?.fees,
    );

  if (
    nestedRows !==
    null
  ) {
    return nestedRows;
  }

  const candidates = [
    data?.fee,
    data?.fees,
    data?.total_fee,
    data?.total_fees,
    data?.transaction_fee,
    data?.charge,
    data?.amount,
    response?.fee,
    response?.total_fee,
    response?.transaction_fee,
  ];

  for (
    const candidate of
    candidates
  ) {
    const parsed =
      moneyToKobo(
        candidate,
      );

    if (
      parsed !==
      null
    ) {
      return parsed;
    }
  }

  throw new Error(
    'Flutterwave returned a fee response that could not be interpreted.',
  );
}

export async function getPaymentFeeQuote({
  method,
  amountKobo,
  currency = 'NGN',
}: {
  method: string;
  amountKobo: number;
  currency?: string;
}) {
  const providerMethod =
    supportedMethods[
      method
    ];

  if (
    !providerMethod
  ) {
    throw new Error(
      'This payment method does not support fee quotations.',
    );
  }

  const safeAmount =
    Number(
      amountKobo,
    );

  if (
    !Number.isFinite(
      safeAmount,
    ) ||
    safeAmount <= 0
  ) {
    throw new Error(
      'A valid payment amount is required before fees can be calculated.',
    );
  }

  const amount =
    Number(
      (
        safeAmount /
        100
      ).toFixed(2),
    );

  const params =
    new URLSearchParams({
      amount:
        String(
          amount,
        ),

      currency:
        currency
          .toUpperCase(),

      payment_method:
        providerMethod,

      country:
        'NG',
    });

  const response =
    await flutterwaveRequest(
      `/fees?${params.toString()}`,
    );

  const feeKobo =
    extractFeeKobo(
      response,
    );

  return {
    method,

    providerMethod,

    baseAmountKobo:
      safeAmount,

    feeKobo,

    totalKobo:
      safeAmount +
      feeKobo,

    currency:
      currency
        .toUpperCase(),

    rawResponse:
      response,
  };
}