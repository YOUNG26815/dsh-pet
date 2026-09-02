// dsh-pet —— Server 半端（Host 进程插件）
// 从 ~/.dsh/sessions 会话流感知主人的工作状态，供宠物渲染心情。
// 状态机：working / happy / sad / sleeping / idle（+ 夜间标记 night: true）
// 零依赖（仅 fzstd 用于解压会话文件）。
import { createSessionReader } from './sessions.js'

export const name = 'dsh-pet'
export const inject = ['webServer']

export function apply(ctx) {
  const webServer = ctx.webServer
  const reader = createSessionReader({ keepTexts: false })
  let scanning = false

  function decideState(summary) {
    const now = Date.now()
    const hour = new Date().getHours()
    const last = summary.newest.lastEventTs
    const agoSec = last ? Math.round((now - last) / 1000) : Infinity
    const lastEv = summary.newest.lastEvents[summary.newest.lastEvents.length - 1] || null
    const night = hour >= 23 || hour < 7

    let state = 'idle'
    if (agoSec < 50 && (lastEv && (lastEv.kind === 'tool-call' || lastEv.kind === 'tool-result' || lastEv.kind === 'turn-start'))) state = 'working'
    else if (summary.errorsRecent5m >= 2) state = 'sad'
    else if (lastEv && lastEv.kind === 'turn-end' && agoSec < 120) state = 'happy'
    else if (agoSec > 10 * 60 || night) state = 'sleeping'

    return { state, night, hour, agoSec: Number.isFinite(agoSec) ? agoSec : null }
  }

  function registerRoute(rpcName, handler) {
    if (!webServer) return
    webServer.register({
      kind: 'exact',
      path: '/pet/api/' + rpcName,
      handler: async (req, res) => {
        let body = ''
        try { for await (const chunk of req) body += chunk } catch { /* ignore */ }
        let result
        try {
          if (body) { try { body = JSON.parse(body) } catch { body = {} } }
          result = await handler(body || {})
        } catch (e) {
          result = { error: String((e && e.message) || e).slice(0, 500) }
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(result))
      },
    })
  }

  registerRoute('state', async () => {
    // 增量扫描（已读帧不重复解，通常 <5ms）
    if (!scanning) {
      scanning = true
      try { await reader.scanAll() } finally { scanning = false }
    }
    const summary = reader.getSummary()
    const mood = decideState(summary)
    return {
      state: mood.state,
      night: mood.night,
      hour: mood.hour,
      lastEventAgoSec: mood.agoSec,
      stats: summary.today,
      fileCount: summary.fileCount,
      ts: Date.now(),
    }
  })
}
