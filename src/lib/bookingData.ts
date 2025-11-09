import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Shared types
export type ResourceLite = Pick<Tables<"business_resources">, "id" | "name">;
export type SlotLite = Pick<
  Tables<"slots">,
  "id" | "start_time" | "end_time" | "slot_price" | "is_booked" | "resource_id"
>;
export type WeeklyRule = Pick<Tables<"business_schedules">, "day_of_week" | "is_open">;

// I. Data Fetching Functions (Foundation)

// 1) Fetch resources for a business
export async function fetchResources(businessId: string): Promise<ResourceLite[]> {
  const { data, error } = await supabase
    .from("business_resources")
    .select("id,name")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

// 2) Fetch all daily slots for a resource on a given date (YYYY-MM-DD)
export async function fetchDailySlots(
  resourceId: string,
  dateString: string
): Promise<SlotLite[]> {
  const [year, month, dayNum] = dateString.split('-').map(Number);
  const myanmarOffsetMs = 6.5 * 60 * 60 * 1000; // UTC+6:30
  const startUTC = new Date(Date.UTC(year, (month - 1), dayNum, 0, 0, 0) - myanmarOffsetMs);
  const endUTC = new Date(Date.UTC(year, (month - 1), dayNum + 1, 0, 0, 0) - myanmarOffsetMs);

  const { data, error } = await supabase
    .from("slots")
    .select("id, start_time, end_time, slot_price, is_booked, resource_id")
    .eq("resource_id", resourceId)
    .gte("start_time", startUTC.toISOString())
    .lt("start_time", endUTC.toISOString())
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data || [];
}

// 3) Fetch weekly schedule rules for a resource
export async function fetchWeeklySchedule(resourceId: string): Promise<WeeklyRule[]> {
  const { data, error } = await supabase
    .from("business_schedules")
    .select("day_of_week, is_open")
    .eq("resource_id", resourceId);
  if (error) throw error;
  return data || [];
}
