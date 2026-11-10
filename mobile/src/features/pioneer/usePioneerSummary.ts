import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { useSession } from '@/state/session';

/** Pioneer summary; refresh() asks the server to read Magical again (no cache). */
export function usePioneerSummary(enabled: boolean) {
  const who = useSession((s) => s.user?.id);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pioneerSummary', who], queryFn: ({ signal }) => api.pioneer.summary(false, { signal }), enabled });
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      qc.setQueryData(['pioneerSummary', who], await api.pioneer.summary(true));
    } catch {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  };
  return { ...q, refresh, refreshing };
}
