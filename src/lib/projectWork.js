import { supabase } from './supabase';
import { runAdminOrderAction } from './admin';
import { toUserError } from './errors';

async function invokeClientAction(body) {
  const { data, error } = await supabase.functions.invoke(
    'client-project-action',
    { body },
  );

  if (error) {
    throw await toUserError(error, 'This action could not be completed.');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'This action could not be completed.');
  }

  return data;
}

/* ---------------- queries ---------------- */

export async function getAdminProjectWork(orderId, customerId = null) {
  if (!orderId) {
    return null;
  }

  const [
    milestones,
    tasks,
    scope,
    deliverables,
    versions,
    revisions,
    changes,
    internalCosts,
    feedback,
    postmortem,
    timeEntries,
  ] = await Promise.all([    supabase
      .from('project_milestones')
      .select('*')
      .eq('order_id', orderId)
      .order('sequence', { ascending: true }),
    supabase
      .from('project_tasks')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
    supabase
      .from('project_scope')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle(),
    supabase
      .from('project_deliverables')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
    supabase
      .from('deliverable_versions')
      .select('*, order_files(id,original_name,mime_type,size_bytes,storage_path,bucket_name)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
    supabase
      .from('revision_requests')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
    supabase
      .from('change_requests')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
    supabase
      .from('internal_costs')
      .select('*')
      .eq('order_id', orderId)
      .order('incurred_at', { ascending: false }),
    supabase
      .from('project_feedback')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle(),
    supabase
      .from('project_postmortems')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle()
      .then(
        (result) => result,
        () => ({ data: null, error: null }),
      ),
    supabase
      .from('time_entries')
      .select('id,minutes,billable,task_id')
      .eq('order_id', orderId)
      .then(
        (result) => result,
        () => ({ data: [], error: null }),
      ),
  ]);

  let annotations = { data: [], error: null };
  const versionIds = (versions.data || []).map((version) => version.id);

  if (versionIds.length > 0) {
    try {
      const result = await supabase
        .from('proof_annotations')
        .select('*')
        .in('version_id', versionIds)
        .order('created_at', { ascending: true });

      if (result.error) throw result.error;
      annotations = result;
    } catch (annotationError) {
      annotations = { data: [], error: annotationError };
    }
  }

  let notes = { data: [], error: null };

  if (customerId) {
    notes = await supabase
      .from('client_notes')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(30);
  }

  const errors = {};
  for (const [key, result] of Object.entries({
    milestones, tasks, scope, deliverables, versions, revisions,
    changes, internalCosts, feedback, postmortem, annotations, timeEntries, notes,
  })) {
    if (result?.error) {
       
      console.error(`Admin project work (${key}) failed:`, result.error);
      errors[key] = result.error.message;
    }
  }

  const versionsByDeliverable = {};
  for (const version of versions.data || []) {
    if (!versionsByDeliverable[version.deliverable_id]) {
      versionsByDeliverable[version.deliverable_id] = [];
    }
    versionsByDeliverable[version.deliverable_id].push(version);
  }

  return {
    milestones: milestones.data || [],
    tasks: tasks.data || [],
    scope: scope.data || null,
    deliverables: deliverables.data || [],
    versions: versions.data || [],
    versionsByDeliverable,
    revisions: revisions.data || [],
    changeRequests: changes.data || [],
    internalCosts: internalCosts.data || [],
    feedback: feedback.data || null,
    postmortem: postmortem.data || null,
    annotations: annotations.data || [],
    timeEntries: timeEntries.data || [],
    clientNotes: notes.data || [],
    loadErrors: errors,
  };
}

export async function getClientProjectWork(orderId) {
  if (!orderId) {
    return null;
  }

  const [
    milestones,
    tasks,
    scope,
    deliverables,
    versions,
    revisions,
    changes,
    feedback,
  ] = await Promise.all([
    supabase
      .from('project_milestones')
      .select('id,title,description,sequence,status,expected_date,completed_date,created_at')
      .eq('order_id', orderId)
      .order('sequence', { ascending: true }),
    supabase
      .from('project_tasks')
      .select('id,milestone_id,title,status,due_at,created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
    supabase
      .from('project_scope')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle(),
    supabase
      .from('project_deliverables')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
    supabase
      .from('deliverable_versions')
      .select('id,deliverable_id,version_number,original_name,notes,approval_state,client_feedback,decided_at,created_at,file_id,order_files(id,storage_path,bucket_name)')
      .eq('order_id', orderId)
      .order('version_number', { ascending: false }),
    supabase
      .from('revision_requests')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
    supabase
      .from('change_requests')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
    supabase
      .from('project_feedback')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle(),
  ]);

  const errors = {};
  for (const [key, result] of Object.entries({
    milestones, tasks, scope, deliverables, versions, revisions, changes, feedback,
  })) {
    if (result?.error) {
       
      console.error(`Client project work (${key}) failed:`, result.error);
      errors[key] = result.error.message;
    }
  }

  const versionsByDeliverable = {};
  for (const version of versions.data || []) {
    if (!versionsByDeliverable[version.deliverable_id]) {
      versionsByDeliverable[version.deliverable_id] = [];
    }
    versionsByDeliverable[version.deliverable_id].push(version);
  }

  return {
    milestones: milestones.data || [],
    tasks: tasks.data || [],
    scope: scope.data || null,
    deliverables: deliverables.data || [],
    versions: versions.data || [],
    versionsByDeliverable,
    revisions: revisions.data || [],
    changeRequests: changes.data || [],
    feedback: feedback.data || null,
    loadErrors: errors,
  };
}

export async function getQuoteItems(quoteIds) {
  const ids = (quoteIds || []).filter(Boolean);

  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('order_quote_items')
    .select('*')
    .in('quote_id', ids)
    .order('sort_order', { ascending: true });

  if (error) {
    if (String(error.code) === '42P01') {
      return [];
    }
    throw await toUserError(error, 'Quote details could not be loaded.');
  }

  return data || [];
}

/* ---------------- admin mutations ---------------- */

export async function saveProjectScope({ orderId, scope }) {
  return runAdminOrderAction({ orderId, action: 'save_project_scope', ...scope });
}

export async function saveMilestone({ orderId, milestone }) {
  return runAdminOrderAction({ orderId, action: 'save_milestone', ...milestone });
}

export async function deleteMilestone({ orderId, milestoneId }) {
  return runAdminOrderAction({ orderId, action: 'delete_milestone', milestoneId });
}

export async function saveTask({ orderId, task }) {
  return runAdminOrderAction({ orderId, action: 'save_task', ...task });
}

export async function deleteTask({ orderId, taskId }) {
  return runAdminOrderAction({ orderId, action: 'delete_task', taskId });
}

export async function prepareDeliverableFiles({ orderId, files }) {
  const { data, error } = await supabase.functions.invoke(
    'admin-order-action',
    { body: { orderId, action: 'prepare_deliverable_files', files } },
  );

  if (error) {
    throw await toUserError(error, 'Deliverable upload could not be prepared.');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'Deliverable upload could not be prepared.');
  }

  return data.uploads;
}

export async function uploadDeliverableFiles({ uploads, fileList, onStageChange }) {
  const results = [];

  for (let index = 0; index < uploads.length; index += 1) {
    const upload = uploads[index];
    const file = fileList[upload.clientIndex];

    if (!file) {
      throw new Error('A selected file is missing. Please try again.');
    }

    onStageChange?.(`Uploading deliverable ${index + 1} of ${uploads.length}…`);

    const { error: uploadError } = await supabase
      .storage
      .from('project-references')
      .uploadToSignedUrl(upload.path, upload.token, file, {
        contentType: file.type || undefined,
      });

    if (uploadError) {
      throw new Error(`"${file.name}" could not be uploaded. Please try again.`);
    }

    results.push(upload.fileId);
  }

  return results;
}

export async function publishDeliverable(payload) {
  return runAdminOrderAction({ action: 'publish_deliverable', ...payload });
}

export async function respondRevision({ orderId, revisionId, status, managementResponse }) {
  return runAdminOrderAction({
    orderId, action: 'respond_revision', revisionId, status, managementResponse,
  });
}

export async function createChangeRequest({ orderId, change }) {
  return runAdminOrderAction({ orderId, action: 'create_change_request', ...change });
}

export async function sendChangeRequest({ orderId, changeId }) {
  return runAdminOrderAction({ orderId, action: 'send_change_request', changeId });
}

export async function cancelChangeRequest({ orderId, changeId }) {
  return runAdminOrderAction({ orderId, action: 'cancel_change_request', changeId });
}

export async function implementChangeRequest({ orderId, changeId }) {
  return runAdminOrderAction({ orderId, action: 'implement_change_request', changeId });
}

export async function recordInternalCost({ orderId, cost }) {
  return runAdminOrderAction({ orderId, action: 'record_internal_cost', ...cost });
}

export async function deleteInternalCost({ orderId, costId }) {
  return runAdminOrderAction({ orderId, action: 'delete_internal_cost', costId });
}

export async function saveClientNote({ orderId, note }) {
  return runAdminOrderAction({ orderId, action: 'save_client_note', note });
}

export async function saveQuoteItems({ orderId, quoteId, items }) {
  return runAdminOrderAction({ orderId, action: 'save_quote_items', quoteId, items });
}

export async function markDelivered({ orderId, deliveryNote }) {
  return runAdminOrderAction({ orderId, action: 'mark_delivered', deliveryNote });
}

export async function completeProject({ orderId, overrideFinancial = false, confirmUndelivered = false }) {
  return runAdminOrderAction({
    orderId, action: 'complete_project', overrideFinancial, confirmUndelivered,
  });
}

/* ---------------- client mutations ---------------- */

export async function acceptQuote({ orderId, quoteId }) {
  return invokeClientAction({ orderId, action: 'accept_quote', quoteId });
}

export async function declineQuote({ orderId, quoteId }) {
  return invokeClientAction({ orderId, action: 'decline_quote', quoteId });
}

export async function approveDeliverable({ orderId, versionId }) {
  return invokeClientAction({ orderId, action: 'approve_deliverable', versionId });
}

export async function requestRevision({ orderId, deliverableId, versionId, description }) {
  return invokeClientAction({
    orderId, action: 'request_revision', deliverableId, versionId, description,
  });
}

export async function respondChangeRequest({ orderId, changeId, decision, message }) {
  return invokeClientAction({
    orderId, action: 'respond_change_request', changeId, decision, message,
  });
}

export async function submitFeedback({ orderId, rating, feedback, testimonialPermission }) {
  return invokeClientAction({
    orderId, action: 'submit_feedback', rating, feedback, testimonialPermission,
  });
}
