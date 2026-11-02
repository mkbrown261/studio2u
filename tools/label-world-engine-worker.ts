// Always-on Studio2U Label World engine (Cloudflare Worker, cron-triggered).
// Deploy: npx wrangler deploy -c wrangler.label-world-engine.jsonc
// Needs the same D1 database and the LLM_KEY_ENCRYPTION_SECRET secret
// (only used to decrypt an owner's optional Claude scheduled-task wake hook).
import { runEngine } from '../src/label-world/autonomy/engine'

export default {
  async scheduled(_event: any, env: any, ctx: any) {
    ctx.waitUntil(runEngine(env).then(summary => console.log(JSON.stringify({ operation: 'label-world-engine', ...summary }))).catch(error => console.error(JSON.stringify({ operation: 'label-world-engine', error: String(error?.message ?? error) }))))
  },
  // Health check only; never runs the engine from an unauthenticated request.
  async fetch(_req: Request, env: any) {
    const last = await env.DB.prepare('SELECT started_at,finished_at,summary_json FROM lw_engine_runs ORDER BY id DESC LIMIT 1').first()
    return Response.json({ service: 'studio2u-label-world-engine', lastRun: last ?? null })
  }
}
