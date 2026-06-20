# Math Streak Arena（数学连胜竞技场）

Math Streak Arena 是一个**游戏化数学答题平台**
的前端应用。用户通过持续答对题目积累连胜，连胜数越高题目难度越大，答错则损失生命值并中断连胜。项目通过排行榜、生命值、里程碑等机制营造竞技感，同时支持账号体系、AI
题目解析和实时多人同场数据同步。

## 核心玩法

* **连胜进阶** —— 题目难度随连对数自动提升，追求最长连胜记录。
* **生命机制** —— 答错扣减生命，生命归零连胜重置，模拟街机游戏的紧张节奏。
* **两种题型** —— 选择题（单选 A/B/C/D）与 LaTeX 公式填空题，覆盖从基础运算到高等数学。
* **AI 解析** —— 提交答案后可触发 AI（大模型驱动的后端服务）生成详细解题过程，以**打字机动画**逐字呈现。
* **实时协同** —— 通过 WebSocket 实时同步当前题目的在线答题人数、个人统计等动态数据。
* **账号体系** —— 支持注册 / 登录，记录等级、正确率、历史题目，追踪长期进步。

## 技术亮点

| 维度           | 实现                                                     |
|--------------|--------------------------------------------------------|
| **前端框架**     | Vue 3（Composition API + `<script setup>`）              |
| **构建工具**     | Vite 7                                                 |
| **数学渲染**     | KaTeX 渲染 LaTeX 公式；markdown-it-texmath 在 Markdown 中内嵌数学 |
| **公式输入**     | MathLive（`<math-field>` 自定义元素），提供可视化数学键盘               |
| **Markdown** | markdown-it 结合 texmath 插件，支持富文本 + 数学混合展示               |
| **数学预处理**    | 自研 `math-preprocessor.js`，将后端非标准格式统一转换为 KaTeX 兼容格式     |
| **实时通信**     | WebSocket 持续推送游戏统计数据                                   |
| **REST API** | 题目获取、答案提交、账号认证、AI 解析                                   |
| **动画效果**     | CSS 翻牌计数器、抖动提示、渐隐过渡、彩虹流光按钮、打字机逐字渲染                     |

## 数学内容处理管线

```
后端原始文本
    │
    ▼
preprocessMath()   ───  转义换行、Asymptote → 占位、自定义命令 → KaTeX 命令、松散块 → 标准定界符
    │
    ▼
markdown-it + texmath   ───  将 Markdown + $$...$$ / $...$ 定界符渲染为 HTML
    │
    ▼
KaTeX auto-render   ───  兜底渲染页面其余未处理的行内 / 块级公式
```

## 项目结构

```
math_streak_vite/
├── public/                      # 静态资源
├── src/
│   ├── api/
│   │   └── game.js              # REST API 封装 + WebSocket 地址
│   ├── components/
│   │   └── HelloWorld.vue       # 初始示例组件（未参与主流程）
│   ├── utils/
│   │   └── math-preprocessor.js # 数学文本预处理
│   ├── App.vue                  # 主页面（全部游戏逻辑 + 模板）
│   ├── main.js                  # 入口，挂载 KaTeX CSS
│   └── style.css                # 全局样式 + 动画关键帧
├── index.html                   # HTML 入口
├── vite.config.js               # Vite 配置（注册 math-field 自定义元素）
└── package.json
```

## 快速开始

```bash
npm install
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run preview  # 预览生产构建
```

## 后端依赖

项目依赖后端服务提供以下能力（默认指向 `https://lodsced.cloud`）：

* `GET  /api/game/current_question` — 获取当前题目
* `POST /api/game/submit` — 提交答案
* `POST /api/account/login` — 账号登录
* `POST /api/account/register` — 账号注册
* `POST /api/game/ai_answer/generate` — AI 解析生成
* `WS   /ws/game` — WebSocket 实时数据推送

## 设计理念

Math Streak Arena 旨在将枯燥的数学练习包装为**竞技街机式的体验**：通过连胜、生命值、难度递增和实时数据可视化，让用户保持「再答对一题」的动力。同时通过
AI 解析降低学习门槛，用流畅的动画与精致的 UI 提升整体品质感。
