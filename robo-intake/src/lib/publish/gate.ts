import { supabaseAdmin } from "@/lib/supabase/admin";

export async function canPublish(agentId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("agent_id", agentId)
    .eq("status", "paid")
    .limit(1)
    .single();

  if (error) return false;
  return !!data;
}
