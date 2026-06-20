/**
 * 数学文本预处理器 —— 将所有后端返回的非标准格式统一转换为
 * KaTeX + markdown-it-texmath 可直接渲染的标准格式。
 *
 * 处理的格式（按优先级顺序）：
 *  1. 转义换行符  \n → 实际换行
 *  2. Asymptote 图表  [asy]...[/asy] → 占位提示（浏览器无法渲染）
 *  3. 自定义下划线  ~\uline{...}~ → $\underline{...}$
 *  4. textcomp 命令  \textgreater / \textless / ... → KaTeX 等效命令
 *  5. 松散数学块    [...包含LaTeX命令...] → $$$$...$$$$（向后兼容旧格式）
 *
 * 注意：所有 replace 操作均为纯文本层面处理，不解析 AST。
 *       实际的 LaTeX 渲染由 KaTeX / markdown-it-texmath 在后续阶段完成。
 */

// ---------------------------------------------------------------------------
// textcomp → KaTeX 命令映射表
// ---------------------------------------------------------------------------
const TEXTCOMP_MAP = [
    ['\\textgreater', '\\gt'],
    ['\\textless', '\\lt'],
    ['\\textbar', '|'],
    ['\\textbackslash', '\\backslash'],
    ['\\textasciicircum', '\\^{}'],
    ['\\textasciitilde', '\\sim'],
    ['\\textunderscore', '\\_'],
    ['\\textbraceleft', '\\{'],
    ['\\textbraceright', '\\}'],
    ['\\textdollar', '\\$'],
    ['\\textpercent', '\\%'],
    ['\\textampersand', '\\&'],
]

// ---------------------------------------------------------------------------
// 主预处理函数
// ---------------------------------------------------------------------------

/**
 * 对后端返回的原始文本进行预处理，输出可直接交给 KaTeX / markdown-it 渲染的文本。
 * @param {string} raw - 后端原始文本
 * @returns {string} 预处理后的文本
 */
export function preprocessMath(raw) {
    if (!raw) return ''

    let text = raw

    // 1) 转义换行符
    text = text.replace(/\\n/g, '\n')

    // 2) Asymptote 图表块 → 文本占位（KaTeX 无法渲染 Asymptote）
    text = text.replace(/\[asy\][\s\S]*?\[\/asy\]/gi, '[图表]')

    // 3) 自定义下划线填空 ~\uline{...}~ → $\underline{...}$
    text = text.replace(/~\\uline\{([^}]*)\}~/g, '$\\underline{$1}$')

    // 4) LaTeX textcomp 命令 → KaTeX 等效命令
    for (const [from, to] of TEXTCOMP_MAP) {
        // 用 split+join 代替 replace 避免正则中特殊字符双重转义
        text = text.split(from).join(to)
    }

    // 5) 松散数学块 [...] → $$...$$（向后兼容旧后端格式）
    //    多行块：[ ... \n 内容 \n ... ]
    // 块公式 \[ ... \]
    text = text.replace(
        /\\\[\s*\n?([\s\S]*?)\n?\s*\\\]/g,
        (_, content) => `$$\n${content.trim()}\n$$`
    );

// 行内公式 \( ... \)
    text = text.replace(
        /\\\((.*?)\\\)/g,
        (_, content) => `$${content}$`
    );

    return text
}
