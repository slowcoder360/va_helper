/**
 * useVeteranProfile Hook
 * 
 * Custom hook for fetching and managing veteran profile data.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { VeteranProfile, VeteranDisability, VeteranServicePeriod } from "@/lib/types";

interface UseVeteranProfileOptions {
  userId: string;
  enabled?: boolean;
}

interface ProfileResponse {
  success: boolean;
  data?: {
    name: string;
    email: string;
    veteranStatus?: string;
    combinedRating?: number;
    serviceHistory: VeteranServicePeriod[];
    disabilities: VeteranDisability[];
  };
  error?: string;
}

interface DisabilityRatingsResponse {
  success: boolean;
  data?: {
    combinedRating: number;
    individualRatings: VeteranDisability[];
  };
}

interface ClaimsResponse {
  success: boolean;
  data?: Array<{
    claimId: number;
    claimType: string;
    status: string;
    dateSubmitted: string;
    decision?: string;
    lastUpdate: string;
  }>;
}

export function useVeteranProfile({ userId, enabled = true }: UseVeteranProfileOptions) {
  const queryClient = useQueryClient();

  // Fetch profile data
  const profileQuery = useQuery({
    queryKey: ["veteranProfile", userId],
    queryFn: async () => {
      const response = await axios.get<ProfileResponse>(
        `/api/get-profile?userId=${userId}`
      );
      return response.data;
    },
    enabled: !!userId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch disability ratings
  const disabilityQuery = useQuery({
    queryKey: ["disabilityRatings", userId],
    queryFn: async () => {
      const response = await axios.get<DisabilityRatingsResponse>(
        `/api/(va)/disability-ratings/get?userId=${userId}`
      );
      return response.data;
    },
    enabled: !!userId && enabled,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch claims
  const claimsQuery = useQuery({
    queryKey: ["claims", userId],
    queryFn: async () => {
      const response = await axios.get<ClaimsResponse>(
        `/api/(va)/claims/get?userId=${userId}`
      );
      return response.data;
    },
    enabled: !!userId && enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Sync data from VA
  const syncVAData = useMutation({
    mutationFn: async () => {
      // Sync all VA data in parallel
      const [disabilityRes, claimsRes] = await Promise.all([
        axios.get(`/api/(va)/disability-ratings/fetch?userId=${userId}`),
        axios.get(`/api/(va)/claims/fetch?userId=${userId}`),
      ]);
      return { disability: disabilityRes.data, claims: claimsRes.data };
    },
    onSuccess: () => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["disabilityRatings", userId] });
      queryClient.invalidateQueries({ queryKey: ["claims", userId] });
      queryClient.invalidateQueries({ queryKey: ["veteranProfile", userId] });
    },
  });

  // Combine data into a unified profile
  const profile: VeteranProfile | null = profileQuery.data?.success
    ? {
        userId,
        name: profileQuery.data.data?.name || "",
        email: profileQuery.data.data?.email || "",
        veteranStatus: profileQuery.data.data?.veteranStatus,
        combinedDisabilityRating:
          disabilityQuery.data?.data?.combinedRating ??
          profileQuery.data.data?.combinedRating,
        servicePeriods: profileQuery.data.data?.serviceHistory || [],
        disabilities:
          disabilityQuery.data?.data?.individualRatings ||
          profileQuery.data.data?.disabilities ||
          [],
      }
    : null;

  return {
    profile,
    claims: claimsQuery.data?.data || [],
    isLoading:
      profileQuery.isLoading ||
      disabilityQuery.isLoading ||
      claimsQuery.isLoading,
    isSyncing: syncVAData.isPending,
    error:
      profileQuery.error || disabilityQuery.error || claimsQuery.error,
    syncVAData: syncVAData.mutate,
    refetch: () => {
      profileQuery.refetch();
      disabilityQuery.refetch();
      claimsQuery.refetch();
    },
  };
}
