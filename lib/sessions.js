// dsh 会话流读取器（dsh-pet / dsh-weekly 共用）
// 读取 ~/.dsh/sessions/<workspace>/<session>/session.jsonl.zstd（多帧 zstd）。
// 特性：
//  - 按帧增量解压：已读过的帧不重复解，追加只解新帧，几乎零开销轮询
//  - zstd 魔数扫描 + 解压校验，容忍压缩流内的伪魔数
//  - 兼容未来的未压缩 *.jsonl（按字节偏移增量读）
//  - 聚合产出：按日统计（turns/toolCalls/userMsgs/errors/toolNames/userTexts）
//    + 最近事件环形队列（供宠物心情判断）
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import * as fzstd from 'fzstd'

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const ZSTD_MAGIC_RE = /28b52ffd/i

function localDay(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isZstd(buf) {
  return buf.length > 4 && ZSTD_MAGIC_RE.test(buf.slice(0, 4).toString('hex'))
}

// 在 buf 中从 from 起找下一个 zstd 魔数偏移
function nextMagic(buf, from) {
  for (let i = from; i <= buf.length - 4; i++) {
    if (buf[i] === MAGIC[0] && buf[i + 1] === MAGIC[1] && buf[i + 2] === MAGIC[2] && buf[i + 3] === MAGIC[3]) return i
  }
  return -1
}

function safeDecompress(buf, start, end) {
  try {
    return Buffer.from(fzstd.decompress(buf.subarray(start, end))).toString('utf8')
  } catch {
    return null
  }
}

export function createSessionReader({ keepTexts = true } = {}) {
  const sessionsRoot = path.join(os.homedir(), '.dsh', 'sessions')
  // files: absPath -> {mtimeMs, size, frames: [已验证帧起始偏移], readOffset(纯文本用), dayStats, lastEvents[], cwd, headerTs}
  const files = new Map()
  // 全局最近事件（跨文件按时间排序的滚动队列）
  const recent = []

  function dayBucket(st, ts) {
    const day = localDay(ts)
    if (!st.dayStats[day]) st.dayStats[day] = { turns: 0, toolCalls: 0, userMsgs: 0, errors: 0, toolNames: {}, userTexts: [], firstTs: ts, lastTs: ts }
    return st.dayStats[day]
  }

  function ingestEvent(st, e) {
    const type = e.type
    const ts = typeof e.time === 'number' ? e.time : (typeof e.time0 === 'number' ? e.time0 : null)
    if (!ts) return
    const day = dayBucket(st, ts)
    if (day.firstTs === ts || day.firstTs > ts) day.firstTs = Math.min(day.firstTs || ts, ts)
    day.lastTs = Math.max(day.lastTs || ts, ts)
    const rec = { ts, type }
    if (type === 'turn/start') { day.turns++; rec.kind = 'turn-start'; st.openTurn = true }
    else if (type === 'turn/end') { rec.kind = 'turn-end'; st.openTurn = false; st.lastTurnEndTs = ts }
    else if (type === 'user/message') {
      day.userMsgs++; rec.kind = 'user-msg'
      try {
        const c = e.data && e.data.content
        const text = Array.isArray(c) && c[0] && c[0].type === 'text' ? String(c[0].text || '') : ''
        if (text) {
          if (keepTexts && day.userTexts.length < 400) day.userTexts.push({ ts, text: text.slice(0, 500) })
          rec.preview = text.slice(0, 60)
        }
      } catch { /* 忽略畸形事件 */ }
    } else if (type === 'tool/call') {
      day.toolCalls++; rec.kind = 'tool-call'
      const name = (e.data && e.data.name) || 'tool'
      day.toolNames[name] = (day.toolNames[name] || 0) + 1
      rec.name = name
    } else if (type === 'tool/result') {
      rec.kind = 'tool-result'
      let isError = false
      try {
        const raw = JSON.stringify(e.data || {})
        if (raw.includes('"isError":true')) isError = true
        const c = e.data && e.data.message && e.data.message.content
        if (Array.isArray(c)) {
          for (const block of c) {
            if (block && block.type === 'tool-result' && block.isError) isError = true
          }
        }
      } catch { /* ignore */ }
      if (isError) { day.errors++; rec.isError = true }
    }
    if (rec.kind) {
      st.lastEvents.push(rec)
      if (st.lastEvents.length > 60) st.lastEvents.shift()
      recent.push(rec)
      if (recent.length > 200) recent.shift()
    }
  }

  function ingestLines(st, text) {
    for (const line of text.split('\n')) {
      const s = line.trim()
      if (!s) continue
      let e
      try { e = JSON.parse(s) } catch { continue }
      if (e.type === 'session') {
        st.cwd = e.cwd || st.cwd
        st.headerTs = e.createdAt || st.headerTs
        continue
      }
      ingestEvent(st, e)
    }
  }

  // 增量更新单个 .jsonl.zstd 文件
  async function updateZstd(st, abs) {
    const buf = fs.readFileSync(abs)
    if (buf.length === st.size && st.frames.length) return
    // 从上一帧末尾向后找新帧
    let scanFrom = st.frames.length ? st.frames[st.frames.length - 1] + 4 : 0
    if (buf.length < st.size) { // 文件被截断/轮转：重置
      st.frames = []; st.size = 0; scanFrom = 0
    }
    const newFrames = []
    let pos = scanFrom
    while (true) {
      const m = nextMagic(buf, pos)
      if (m < 0) break
      newFrames.push(m)
      pos = m + 4
    }
    // 逐帧解压（每个新帧都从「它到下一个已验证帧」尝试；伪魔数会被解压失败过滤）
    const validated = []
    for (let i = 0; i < newFrames.length; i++) {
      const start = newFrames[i]
      const nextReal = i + 1 < newFrames.length ? newFrames[i + 1] : buf.length
      const text = safeDecompress(buf, start, buf.length === nextReal ? buf.length : nextReal)
      if (text === null) continue // 伪魔数
      validated.push({ start, text })
      // 每 3 帧让出事件循环，避免大文件首次解码时阻塞 host
      if (validated.length % 3 === 0) await new Promise((r) => setImmediate(r))
    }
    for (const { start, text } of validated) {
      st.frames.push(start)
      ingestLines(st, text)
    }
    st.size = buf.length
    st.mtimeMs = fs.statSync(abs).mtimeMs
  }

  // 增量更新未压缩 .jsonl
  function updatePlain(st, abs) {
    const stat = fs.statSync(abs)
    if (stat.size === st.size && st.size > 0) return
    const fd = fs.openSync(abs, 'r')
    try {
      const start = st.size > stat.size ? 0 : st.size
      const len = stat.size - start
      if (len > 0) {
        const buf = Buffer.alloc(len)
        fs.readSync(fd, buf, 0, len, start)
        ingestLines(st, buf.toString('utf8'))
      }
      st.size = stat.size
      st.mtimeMs = stat.mtimeMs
    } finally {
      fs.closeSync(fd)
    }
  }

  function listSessionFiles() {
    const out = []
    let workspaces = []
    try { workspaces = fs.readdirSync(sessionsRoot) } catch { return out }
    for (const ws of workspaces) {
      const wsDir = path.join(sessionsRoot, ws)
      let sessions = []
      try { sessions = fs.readdirSync(wsDir) } catch { continue }
      for (const sess of sessions) {
        const sessDir = path.join(wsDir, sess)
        let entries = []
        try { entries = fs.readdirSync(sessDir) } catch { continue }
        for (const f of entries) {
          if (f.endsWith('.jsonl.zstd') || f.endsWith('.jsonl')) out.push(path.join(sessDir, f))
        }
      }
    }
    return out
  }

  return {
    /** 扫描全部会话文件并增量更新（await 后即可读取 summary） */
    async scanAll() {
      const seen = new Set()
      for (const abs of listSessionFiles()) {
        seen.add(abs)
        let st = files.get(abs)
        if (!st) {
          st = { frames: [], size: 0, mtimeMs: 0, dayStats: {}, lastEvents: [], openTurn: false, lastTurnEndTs: 0, cwd: null, headerTs: 0 }
          files.set(abs, st)
        }
        try {
          if (abs.endsWith('.zstd')) await updateZstd(st, abs)
          else updatePlain(st, abs)
        } catch { /* 单文件损坏不影响整体 */ }
      }
      // 清理已消失的文件
      for (const key of [...files.keys()]) if (!seen.has(key)) files.delete(key)
      recent.sort((a, b) => a.ts - b.ts)
    },

    /** 汇总：今天统计 + 心情素材 */
    getSummary() {
      const today = localDay(Date.now())
      const todayAgg = { turns: 0, toolCalls: 0, userMsgs: 0, errors: 0, toolNames: {} }
      let newest = null // 最近有活动的那份会话
      for (const st of files.values()) {
        const d = st.dayStats[today]
        if (d) {
          todayAgg.turns += d.turns
          todayAgg.toolCalls += d.toolCalls
          todayAgg.userMsgs += d.userMsgs
          todayAgg.errors += d.errors
          for (const [k, v] of Object.entries(d.toolNames)) todayAgg.toolNames[k] = (todayAgg.toolNames[k] || 0) + v
        }
        const stLast = st.lastEvents.length ? st.lastEvents[st.lastEvents.length - 1].ts : st.headerTs
        if (stLast && (!newest || stLast > newest.lastEventTs)) newest = { lastEventTs: stLast, lastEvents: st.lastEvents, openTurn: st.openTurn, lastTurnEndTs: st.lastTurnEndTs }
      }
      recent.sort((a, b) => a.ts - b.ts)
      const errorsRecent5m = recent.filter((r) => r.isError && Date.now() - r.ts < 5 * 60 * 1000).length
      return {
        today: todayAgg,
        newest: newest || { lastEventTs: 0, lastEvents: [], openTurn: false, lastTurnEndTs: 0 },
        errorsRecent5m,
        fileCount: files.size,
      }
    },

    /** 导出全部数据（dsh-weekly 用）：按文件给 dayStats + cwd */
    exportAll() {
      const out = []
      for (const [abs, st] of files.entries()) {
        out.push({ abs, cwd: st.cwd, headerTs: st.headerTs, dayStats: st.dayStats })
      }
      return out
    },
  }
}
