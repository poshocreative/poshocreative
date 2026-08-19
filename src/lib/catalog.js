import {
  supabase,
} from './supabase';

export async function getServiceCatalog() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'service_catalog',
      )
      .select(`
        id,
        service_slug,
        project_type,
        title,
        description,
        pricing_type,
        price_kobo,
        currency,
        active,
        sort_order
      `)
      .eq(
        'active',
        true,
      )
      .order(
        'sort_order',
        {
          ascending: true,
        },
      );

  if (error) {
    throw error;
  }

  return data || [];
}

export function createCatalogMap(
  catalog,
) {
  return new Map(
    catalog.map(
      (item) => [
        `${item.service_slug}:${item.project_type}`,
        item,
      ],
    ),
  );
}

export function formatCatalogPrice(
  item,
) {
  if (!item) {
    return '';
  }

  if (
    item.pricing_type ===
    'custom'
  ) {
    return 'Custom quote';
  }

  if (
    item.price_kobo ===
      null ||
    item.price_kobo ===
      undefined
  ) {
    return 'Quote required';
  }

  const price =
    new Intl.NumberFormat(
      'en-NG',
      {
        style:
          'currency',

        currency:
          item.currency ||
          'NGN',

        maximumFractionDigits:
          0,
      },
    ).format(
      Number(
        item.price_kobo,
      ) / 100,
    );

  if (
    item.pricing_type ===
    'starting_at'
  ) {
    return `From ${price}`;
  }

  if (
    item.pricing_type ===
    'monthly'
  ) {
    return `${price} / month`;
  }

  return price;
}