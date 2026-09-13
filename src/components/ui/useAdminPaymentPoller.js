import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const POLL_INTERVAL_MS = 10_000;

export function useAdminPaymentPoller({ enabled = true, onStatusChange } = {}) {
  const intervalRef = useRef(null);
  const busyRef = useRef(false);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const poll = useCallback(async () => {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session) {
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-poll-payment-status', {
        body: {},
      });

      if (error || !data?.success) {
        return;
      }

      const hasChanges =
        (data.confirmed?.length || 0) > 0 ||
        (data.cancelled?.length || 0) > 0 ||
        (data.updated?.length || 0) > 0;

      if (hasChanges && onStatusChangeRef.current) {
        onStatusChangeRef.current({
          confirmed: data.confirmed || [],
          cancelled: data.cancelled || [],
          updated: data.updated || [],
        });
      }
    } catch (error) {
      console.error('admin payment poll error:', error);
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    poll();

    intervalRef.current = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, poll]);

  return { poll };
}

