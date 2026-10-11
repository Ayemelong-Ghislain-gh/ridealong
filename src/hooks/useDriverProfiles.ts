import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { DriverProfileInfo } from '../types/rows'

/** Vehicle, rating and verification for a set of drivers, keyed by driver id. */
export function useDriverProfiles(driverIds: string[]) {
  const ids = [...new Set(driverIds)].sort()
  return useQuery({
    queryKey: ['driver-profiles', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('id, is_verified_driver, rating, total_trips, vehicle_make, vehicle_model, vehicle_color')
        .in('id', ids)
      if (error) throw error
      const map: Record<string, DriverProfileInfo> = {}
      for (const row of (data || []) as unknown as DriverProfileInfo[]) map[row.id] = row
      return map
    },
  })
}
