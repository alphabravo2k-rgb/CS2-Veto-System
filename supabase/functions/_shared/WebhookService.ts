export async function triggerWebhooks(supabase: any, org_id: string, event: string, payload: any) {
  try {
    const { data: webhooks } = await supabase
      .from('webhooks')
      .select('*')
      .eq('org_id', org_id)
      .eq('active', true);

    if (!webhooks || webhooks.length === 0) return;

    const promises = webhooks.map(async (wh: any) => {
      if (!wh.events.includes(event)) return;

      try {
        await fetch(wh.url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Veto-Event': event,
            'X-Veto-Signature': wh.secret // Simple signature for now
          },
          body: JSON.stringify({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            event,
            org_id,
            data: payload
          })
        });
      } catch (e) {
        console.error(`[WebhookService] Failed to ping ${wh.url}:`, e);
      }
    });

    await Promise.all(promises);
  } catch (e) {
    console.error('[WebhookService] Error:', e);
  }
}
