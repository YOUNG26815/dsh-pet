// dsh-pet —— Client 半端（ModuleLoader 静态 bundle）
// 一只住在你输入框上方的工作鸭：Agent 干活它敲键盘，搞定它欢呼，你摸鱼它睡觉。
// 数据来自 Host RPC：POST /pet/api/state。纯 SVG + CSS 动画，无任何图片资源。
window.__ModuleLoader__.load({
  id: 'dsh-pet',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    var React = require('react');

    async function api(name) {
      const res = await fetch('/pet/api/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return await res.json()
    }

    function insertStyles(css) {
      try {
        const style = document.createElement('style')
        style.textContent = css
        document.head.appendChild(style)
        return () => { try { style.remove() } catch (e) { /* ignore */ } }
      } catch (e) { return function () {} }
    }

    const css = `
.pet-wrap{position:relative;display:inline-flex;align-items:flex-end;cursor:pointer;user-select:none;padding:0 2px;}
.pet-svg{width:64px;height:56px;overflow:visible;}
.pet-body{transform-origin:50% 90%;animation:pet-breathe 2.6s ease-in-out infinite;}
.pet-eye{transform-origin:center;animation:pet-blink 4.2s infinite;}
.pet-wing{transform-origin:60% 30%;}
.pet-zzz{font-size:11px;font-weight:700;fill:#8aa2c0;opacity:0;animation:pet-zzz 3.4s ease-out infinite;}
.pet-zzz.z2{animation-delay:1.1s;}
.pet-zzz.z3{animation-delay:2.2s;}
.pet-sweat{opacity:0;animation:pet-sweat 2s ease-in infinite;}
@keyframes pet-breathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.96)}}
@keyframes pet-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
@keyframes pet-zzz{0%{opacity:0;transform:translate(0,0)}25%{opacity:.9}100%{opacity:0;transform:translate(10px,-16px)}}
@keyframes pet-sweat{0%{opacity:0;transform:translateY(0)}30%{opacity:1}100%{opacity:0;transform:translateY(10px)}}
.pet-wrap[data-state=working] .pet-body{animation:pet-breathe 1.1s ease-in-out infinite;}
.pet-wrap[data-state=working] .pet-wing{animation:pet-type .28s ease-in-out infinite alternate;}
@keyframes pet-type{from{transform:rotate(-14deg)}to{transform:rotate(10deg)}}
.pet-wrap[data-state=happy] .pet-body{animation:pet-jump .5s ease-in-out 3;}
@keyframes pet-jump{0%,100%{transform:translateY(0)}40%{transform:translateY(-14px) rotate(-4deg)}70%{transform:translateY(-4px)}}
.pet-wrap[data-state=happy] .pet-star{animation:pet-star 1.6s ease-out 2;}
.pet-star{opacity:0;transform-origin:center;}
@keyframes pet-star{0%{opacity:0;transform:scale(.3)}30%{opacity:1}100%{opacity:0;transform:scale(1.5) translateY(-8px)}}
.pet-wrap[data-state=sad] .pet-body{animation:pet-droop 2.4s ease-in-out infinite;}
@keyframes pet-droop{0%,100%{transform:rotate(0)}50%{transform:rotate(5deg) translateY(2px)}}
.pet-wrap[data-state=sleeping] .pet-body{animation:pet-breathe 3.6s ease-in-out infinite;}
.pet-wrap[data-state=sleeping] .pet-eye{transform:scaleY(.08);animation:none;}
.pet-bubble{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:8px;background:#fff;color:#333;border-radius:12px;padding:8px 12px;font-size:12px;line-height:1.5;white-space:nowrap;box-shadow:0 6px 24px rgba(0,0,0,.18);z-index:60;animation:pet-in .18s ease-out;}
.pet-bubble:after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#fff;}
@keyframes pet-in{from{opacity:0;transform:translateX(-50%) translateY(4px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.pet-night-badge{position:absolute;top:-6px;right:-10px;font-size:13px;}
.pet-laptop{transform-origin:center;}
.pet-wrap[data-state=working] .pet-laptop{animation:pet-glow 1s ease-in-out infinite alternate;}
@keyframes pet-glow{from{opacity:.75}to{opacity:1}}
`

    // ===== 小鸭 SVG（纯手绘） =====
    function Duck({ state, night }) {
      const sleeping = state === 'sleeping'
      return React.createElement('svg', { className: 'pet-svg', viewBox: '0 0 100 88' },
        // 影子
        React.createElement('ellipse', { cx: 46, cy: 82, rx: 30, ry: 4, fill: 'rgba(0,0,0,.12)' }),
        React.createElement('g', { className: 'pet-body' },
          // 尾巴
          React.createElement('path', { d: 'M14 56 Q4 50 8 40 Q14 46 20 47 Z', fill: '#f2b90d' }),
          // 身体
          React.createElement('ellipse', { cx: 46, cy: 58, rx: 30, ry: 22, fill: '#ffd21f' }),
          React.createElement('ellipse', { cx: 46, cy: 62, rx: 22, ry: 14, fill: '#ffe173', opacity: .7 }),
          // 翅膀
          React.createElement('g', { className: 'pet-wing' },
            React.createElement('path', { d: 'M34 52 Q28 62 36 68 Q46 66 48 56 Q44 50 34 52 Z', fill: '#f2b90d' })),
          // 头
          React.createElement('g', null,
            React.createElement('circle', { cx: 62, cy: 30, r: 19, fill: '#ffd21f' }),
            // 嘴
            React.createElement('path', { d: 'M78 30 Q92 30 90 36 Q84 40 78 36 Z', fill: '#ff8c00' }),
            sleeping
              ? React.createElement('path', { d: 'M58 26 Q62 30 66 26', stroke: '#7a5b00', strokeWidth: 2, fill: 'none', strokeLinecap: 'round' })
              : React.createElement('circle', { className: 'pet-eye', cx: 64, cy: 25, r: 3.2, fill: '#3a2c00' }),
            sleeping ? null : React.createElement('circle', { cx: 65.2, cy: 24, r: 1.1, fill: '#fff' }),
            // 腮红
            React.createElement('ellipse', { cx: 70, cy: 33, rx: 3.5, ry: 2.2, fill: '#ff9d5c', opacity: .55 }),
          ),
          // 脚
          React.createElement('path', { d: 'M38 79 L38 72 M54 79 L54 72', stroke: '#ff8c00', strokeWidth: 3, strokeLinecap: 'round' }),
          React.createElement('path', { d: 'M32 80 L44 80 M48 80 L60 80', stroke: '#ff8c00', strokeWidth: 3, strokeLinecap: 'round' }),
        ),
        // 工作时的笔记本电脑
        state === 'working' ? React.createElement('g', { className: 'pet-laptop' },
          React.createElement('rect', { x: 8, y: 62, width: 26, height: 3.4, rx: 1.4, fill: '#5a6b8c' }),
          React.createElement('rect', { x: 11, y: 50, width: 20, height: 12.5, rx: 1.6, fill: '#31415f', transform: 'skewX(-8)' }),
          React.createElement('rect', { x: 12.5, y: 51.5, width: 17, height: 9.5, fill: '#7fd3ff', transform: 'skewX(-8)' }),
        ) : null,
        // 睡觉 Zzz
        sleeping ? React.createElement('text', { className: 'pet-zzz', x: 84, y: 16 }, 'Z') : null,
        sleeping ? React.createElement('text', { className: 'pet-zzz z2', x: 90, y: 10 }, 'z') : null,
        sleeping ? React.createElement('text', { className: 'pet-zzz z3', x: 78, y: 22 }, 'z') : null,
        // 难过汗滴
        state === 'sad' ? React.createElement('path', { className: 'pet-sweat', d: 'M84 16 Q88 22 84 25 Q80 22 84 16 Z', fill: '#7fd3ff' }) : null,
        // 开心星星
        state === 'happy' ? React.createElement('g', { className: 'pet-star' },
          React.createElement('text', { x: 82, y: 14, fontSize: 14 }, '✨'),
          React.createElement('text', { x: 16, y: 18, fontSize: 11 }, '⭐'),
        ) : null,
        night ? React.createElement('text', { className: 'pet-night-badge' }, '🌙') : null,
      )
    }

    const LINES = {
      idle: ['戳我干嘛~', '今天也要加油鸭!', '有事您吩咐。', '(歪头看你)'],
      working: ['冲冲冲,在敲了在敲了!', '别急,正在跑工具…', '敲键盘的手速就是生产力!'],
      happy: ['搞定收工!✨', '这波稳了!', '又完成一轮,夸我!'],
      sad: ['呜…刚才报错了两次', '别灰心,再试一次!'],
      sleeping: ['Zzz…(梦见自动写周报)', '(睡了睡了,有活叫我)', 'zzz…别卷了,休息吧'],
    }

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

    function App() {
      const [state, setState] = React.useState('idle')
      const [night, setNight] = React.useState(false)
      const [stats, setStats] = React.useState(null)
      const [bubble, setBubble] = React.useState(null)
      const bubbleTimer = React.useRef(null)

      React.useEffect(() => {
        let alive = true
        async function tick() {
          try {
            const s = await api('state')
            if (!alive) return
            setState(s.state)
            setNight(!!s.night)
            setStats(s.stats || null)
          } catch (e) { /* 静默,下轮再试 */ }
        }
        tick()
        const t = setInterval(tick, 8000)
        return () => { alive = false; clearInterval(t) }
      }, [])

      function poke() {
        const s = stats
        let line = pick(LINES[state] || LINES.idle)
        if (s && (s.turns || s.toolCalls)) {
          line = line + '\n今天: ' + (s.turns || 0) + ' 轮对话 · ' + (s.toolCalls || 0) + ' 次工具' + (s.errors ? ' · ' + s.errors + ' 次报错 😥' : ' ✅')
        }
        setBubble(line)
        if (bubbleTimer.current) clearTimeout(bubbleTimer.current)
        bubbleTimer.current = setTimeout(() => setBubble(null), 3200)
      }

      return React.createElement('div', { className: 'pet-wrap', 'data-state': state, onClick: poke, title: '工作鸭' },
        React.createElement(Duck, { state, night }),
        bubble ? React.createElement('div', { className: 'pet-bubble', style: { whiteSpace: 'pre-line' } }, bubble) : null,
      )
    }

    const inject = ['timer']

    function apply(ctx) {
      insertStyles(css)
      const slots = ctx.get('slots')
      if (slots === undefined) return
      slots.inject('conversation.composer.dock', () => slots.register(
        { name: 'conversation.composer.dock', id: 'pet-dock', order: 70, label: '工作鸭' },
        () => React.createElement(App),
      ))
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
