import { supabase } from './supabase';
import { toUserError } from './errors';

export async function archiveProject({ orderId, reason }) {
  const cleanReason = String(reason || '').trim();

  if (cleanReason.length < 5) {
    throw new Error('Provide a reason before archiving this project.');
  }

  const { data, error } = await supabase.functions.invoke(
    'admin-order-action',
    {
      body: { action: 'archive_project', orderId, reason: cleanReason },
    },
  );

  if (error) {
    throw await toUserError(error, 'The project could not be archived.');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'The project could not be archived.');
  }

  return data.archive;
}

export async function restoreProject({ orderId }) {
  const { data, error } = await supabase.functions.invoke(
    'admin-order-action',
    {
      body: { action: 'restore_project', orderId },
    },
  );

  if (error) {
    throw await toUserError(error, 'The project could not be restored.');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'The project could not be restored.');
  }

  return data.restore;
}

export async function permanentDeleteProject({
  orderId,
  typedReference,
  reason,
}) {
  const cleanReason = String(reason || '').trim();

  if (cleanReason.length < 10) {
    throw new Error(
      'Provide a detailed reason (at least 10 characters) before permanent deletion.',
    );
  }

  const { data, error } = await supabase.functions.invoke(
    'admin-order-action',
    {
      body: {
        action: 'permanent_delete_project',
        orderId,
        typedReference: String(typedReference || '').trim(),
        reason: cleanReason,
      },
    },
  );

  if (error) {
    throw await toUserError(error, 'The project could not be deleted.');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'The project could not be deleted.');
  }

  return data;
}

export async function setProjectPrice({ orderId, amountNaira }) {
  const magnitude = Number(String(amountNaira).replaceAll(',', '').trim());

  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    throw new Error('Enter a valid project price greater than zero.');
  }

  const { data, error } = await supabase.functions.invoke(
    'admin-order-action',
    {
      body: {
        action: 'set_project_price',
        orderId,
        amountKobo: Math.round(magnitude * 100),
      },
    },
  );

  if (error) {
    throw await toUserError(error, 'The project price could not be saved.');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'The project price could not be saved.');
  }

  return data.finance;
}

export async function waiveProjectCost({ orderId, costId, reason }) {
  const cleanReason = String(reason || '').trim();

  if (cleanReason.length < 5) {
    throw new Error('Provide a clear reason before waiving this cost.');
  }

  const { data, error } = await supabase.functions.invoke(
    'admin-order-action',
    {
      body: {
        action: 'waive_project_cost',
        orderId,
        costId,
        reason: cleanReason,
      },
    },
  );

  if (error) {
    throw await toUserError(error, 'The cost could not be waived.');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'The cost could not be waived.');
  }

  return data.finance;
}
