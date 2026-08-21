import {
  flutterwaveRequest,
} from './flutterwave.ts';

const supportedMethods:
  Record<
    string,
    string
  > = {
    bank_transfer:
      'bank_transfer',

    opay:
      'opay',
  };

type FeeBreakdown = {
  type: string;
  amountKobo: number;
};

function moneyToKobo(
  value: unknown,
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {
    return null;
  }

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
    amount *
      100,
  );
}

function normaliseFeeRows(
  rows: unknown,
): FeeBreakdown[] {
  if (
    !Array.isArray(
      rows,
    )
  ) {
    return [];
  }

  return rows
    .map(
      (
        row: any,
      ) => {
        const amountKobo =
          moneyToKobo(
            row
              ?.amount,
          );

        if (
          amountKobo ===
          null
        ) {
          return null;
        }

        return {
          type:
            String(
              row
                ?.type ||
                row
                  ?.fee_type ||
                'provider_fee',
            ),

          amountKobo,
        };
      },
    )
    .filter(
      Boolean,
    ) as FeeBreakdown[];
}

function findFeeRows(
  response: any,
) {
  const data =
    response?.data ??
    response;

  const candidates =
    [
      data?.fee,
      data?.fees,
      response?.fee,
      response?.fees,
    ];

  for (
    const candidate of
    candidates
  ) {
    const rows =
      normaliseFeeRows(
        candidate,
      );

    if (
      rows.length >
      0
    ) {
      return rows;
    }
  }

  return [];
}

function findScalarFeeKobo(
  response: any,
) {
  const data =
    response?.data ??
    response;

  const candidates =
    [
      data?.fee,
      data
        ?.total_fee,
      data
        ?.total_fees,
      data
        ?.transaction_fee,
      data
        ?.flutterwave_fee,
      data
        ?.ravefee,
      response?.fee,
      response
        ?.total_fee,
      response
        ?.transaction_fee,
    ];

  for (
    const candidate of
    candidates
  ) {
    if (
      Array.isArray(
        candidate,
      )
    ) {
      continue;
    }

    const value =
      moneyToKobo(
        candidate,
      );

    if (
      value !==
      null
    ) {
      return value;
    }
  }

  return null;
}

function findChargeAmountKobo(
  response: any,
) {
  const data =
    response?.data ??
    response;

  const candidates =
    [
      data
        ?.charge_amount,
      data
        ?.charged_amount,
      data
        ?.customer_amount,
      data
        ?.total_amount,
      response
        ?.charge_amount,
      response
        ?.charged_amount,
    ];

  for (
    const candidate of
    candidates
  ) {
    const value =
      moneyToKobo(
        candidate,
      );

    if (
      value !==
      null
    ) {
      return value;
    }
  }

  return null;
}

function sumFeeRows(
  rows:
    FeeBreakdown[],
) {
  return rows.reduce(
    (
      total,
      row,
    ) =>
      total +
      row
        .amountKobo,
    0,
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
    safeAmount <=
      0
  ) {
    throw new Error(
      'A valid payment amount is required before fees can be calculated.',
    );
  }

  const safeCurrency =
    (
      currency ||
      'NGN'
    )
      .trim()
      .toUpperCase();

  const amount =
    Number(
      (
        safeAmount /
        100
      ).toFixed(
        2,
      ),
    );

  const params =
    new URLSearchParams({
      amount:
        String(
          amount,
        ),

      currency:
        safeCurrency,

      payment_method:
        providerMethod,
    });

  if (
    safeCurrency ===
    'NGN'
  ) {
    params.set(
      'country',
      'NG',
    );
  }

  const response =
    await flutterwaveRequest(
      `/fees?${params.toString()}`,
    );

  const breakdown =
    findFeeRows(
      response,
    );

  const rowFeeKobo =
    breakdown.length >
    0
      ? sumFeeRows(
          breakdown,
        )
      : null;

  const scalarFeeKobo =
    findScalarFeeKobo(
      response,
    );

  const chargeAmountKobo =
    findChargeAmountKobo(
      response,
    );

  let feeKobo =
    rowFeeKobo ??
    scalarFeeKobo;

  let totalKobo =
    chargeAmountKobo;

  /*
   * Flutterwave's charge_amount is the most
   * useful value when fees are passed to the
   * customer because it represents the total
   * customer charge.
   */
  if (
    totalKobo !==
      null &&
    totalKobo >=
      safeAmount
  ) {
    const difference =
      totalKobo -
      safeAmount;

    /*
     * The charge amount is authoritative for
     * the amount the customer is expected to pay.
     */
    feeKobo =
      difference;
  }

  if (
    feeKobo ===
    null
  ) {
    throw new Error(
      'Flutterwave returned a fee response that did not include a usable fee or customer charge amount.',
    );
  }

  if (
    totalKobo ===
      null ||
    totalKobo <
      safeAmount
  ) {
    totalKobo =
      safeAmount +
      feeKobo;
  }

  return {
    method,

    providerMethod,

    baseAmountKobo:
      safeAmount,

    feeKobo,

    totalKobo,

    currency:
      safeCurrency,

    breakdown,

    rawResponse:
      response,
  };
}