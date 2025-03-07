// lib/services/vaServices.ts

import axios from "axios";

const VA_BASE_URL = process.env.VA_SERVICE_HISTORY_API_BASE_URL!;

// Function to get the service history of a veteran using access token
export async function getServiceHistory(accessToken: string) {
  try {
    const response = await axios.get(`${VA_BASE_URL}/service_histories`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("Error fetching service history:", error.response?.data || error.message);
    throw new Error("Failed to fetch service history from VA API.");
  }
}

// Function to get the disability ratings of a veteran using access token
export async function getDisabilityRatings(accessToken: string) {
  try {
    const response = await axios.get(`${VA_BASE_URL}/disability_ratings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return response.data?.data || [];
  } catch (error: any) {
    console.error("Error fetching disability ratings:", error.response?.data || error.message);
    throw new Error("Failed to fetch disability ratings from VA API.");
  }
}
