import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Phone numbers for people the signed-in user is allowed to contact: the
 * driver of their booking, the passengers on their trip, or anyone for an
 * admin. Others are simply left out. The rule lives in the database
 * (get_contact_phones in supabase/ridealong_privacy.sql), so phone numbers
 * can't be read any other way.
 */
export function useContactPhones(userIds: (string | null | undefined)[], enabled = true) {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))].sort()
  return useQuery({
    queryKey: ['contact-phones', ids],
    enabled: enabled && ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_contact_phones', { p_users: ids })
      if (error) throw error
      const map: Record<string, string> = {}
      for (const row of (data || []) as unknown as { id: string; phone: string | null }[]) {
        if (row.phone) map[row.id] = row.phone
      }
      return map
    },
  })
}
