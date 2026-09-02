# dsh-pet · 工作鸭 🐤

一只住在你 DeepSeek Harness 输入框上方的小鸭子——**它会感知你在干嘛**。

**English**: Work Duck — a desktop pet living in your DeepSeek Harness that reacts to what you and your agent are doing. Pure SVG + CSS, zero images.

## ✨ 它会什么

| 你的状态 | 它的反应 |
|---------|---------|
| Agent 正在跑工具/干活 | 🐤 **扑到小键盘前疯狂敲代码**（呼吸加速、翅膀狂敲） |
| 一轮任务刚完成 | ✨ **开心跳两下 + 撒星星** |
| 最近报错频发 | 😢 蔫了，流汗滴 |
| 你 10 分钟没动静 / 深夜 23 点后 | 😴 **睡着，头顶飘 Zzz**（深夜还有 🌙 小 badge） |
| 平时 | 晃悠、眨眼、盯着你 |

点它一下会冒泡泡说话（带今日工作统计：*"冲冲冲,在敲了在敲了! 今天: 8 轮对话 · 42 次工具 ✅"*）。

## 🧠 它怎么知道你在干嘛

读 `~/.dsh/sessions/` 下的会话事件流（多帧 zstd 增量解压，几乎零开销）：

- 最近的 `turn/start` / `tool/call` → 工作中
- 刚出现的 `turn/end` → 欢呼
- 5 分钟内 ≥2 次工具报错 → 难过
- 没动静超过 10 分钟 / 深夜 → 睡觉

**所有数据只在本地流转，不上传任何东西。**

## 📦 安装

```bash
dsh plugin --profile web add github:YOUNG26815/dsh-pet
```

## 🧩 技术细节

- 纯 SVG 手绘小鸭 + CSS keyframes，**无任何图片/字体资源**
- 服务端增量解析会话流（帧级缓存），轮询一次 < 5ms
- 唯一依赖：[fzstd](https://github.com/101arrowz/fzstd)（纯 JS 的 zstd 解压器，30KB，MIT）——用于解压 DSH 的会话归档

## License

MIT
