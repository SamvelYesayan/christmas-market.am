import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';

/** The Christmas Calendar state for the current user. "Today" always comes from the server clock (Asia/Yerevan). */
export function useCalendar() {
  const { lang } = useI18n();
  const who = useSession((s) => s.user?.id ?? 'guest');
  return useQuery({ queryKey: ['calendar', lang, who], queryFn: ({ signal }) => api.calendar.get({ signal }) });
}
