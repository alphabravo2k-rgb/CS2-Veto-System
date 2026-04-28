import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0"

export async function logAudit(supabase: any, { actor_id, action, target_id, meta }: { actor_id: string, action: string, target_id?: string, meta?: any }) {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert([{
        actor_id,
        action,
        target_id,
        meta
      }])
    
    if (error) console.error('[AuditService] Failed to log:', error)
  } catch (e) {
    console.error('[AuditService] Critical error:', e)
  }
}
