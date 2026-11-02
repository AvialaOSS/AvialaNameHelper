# AvialaNameHelper

一个 Figma 插件，帮设计师用单一、可预期的约定来命名 **Figma 变量（design
token）**。它提供两种模式——**Builder** 用来拼出一个名字并在指定集合里把它创建为
新变量，**Validator** 用来审计并批量重命名已有变量。

插件当前执行的命名约定是：

```
--aviala-{category}-{property}-{variant}-{state}
```

> **已被取代 —— 见 [`NAMING.md`](./NAMING.md)。** 那份文档才是权威契约，是对着
> Figma _Components_ 文件的一次真实 dump（167 个本地变量、5 个集合，外加
> _Aviala Design Colors_ 库的 42 个）定下来的。Figma 下游的任何东西都没有被当作
> 证据。它用五个命名空间取代了下面这套扁平形状——`palette`、`semantic`、`scale`、
> `component`、`effect`——每个都有自己的槽位列表和封闭词表；它另外还定了集合布局、
> 每个集合承载的 mode 轴，以及每个类别必需的 Figma 作用域。`src/grammar/` 仍然实现
> 这里描述的形状；迁移它是已登记的待办工作，两者冲突时以 `NAMING.md` 为准。

- `category` —— token 的领域，例如 `color`、`interaction`、`size`、`gap`、
  `padding`、`line-height`、`font-size`、`font-weight`、`border-radius`、
  `transparency`、`shadow`、`typography`。
- `property` —— 在该领域内被描述的是什么，例如 `primary`、`neutral`、
  `lightbackground`、`filled`、`middle`。
- `variant` —— 可选的细化，例如颜色家族的某一档或某个色调。
- `state` —— 可选的交互状态，例如 `hover`、`active`、`disabled`、`checked`、
  `in-progress`。

只有 `category` 和 `property` 是始终必填的；`variant` 和 `state` 只在 grammar
允许它们的位置出现。

## 「选中的变量」指什么

Figma **不会**暴露变量编辑面板里哪些行被高亮——`figma.currentPage.selection`
返回的是**节点**，不是变量。所以在 Validator 里，「选中范围」被定义为：

> **绑定到当前选中节点**的本地变量（同时扫描 `node.boundVariables` 和每个 paint
> 的 `paint.boundVariables`），加上你在插件自己的结果列表里勾中的那些。

远端（库）变量以只读方式呈现，重命名时会被跳过。

## 模式

### Builder

四个级联选择器——category → property → variant → state——驱动一个实时名字预览。
改动靠前的段会重置靠后的段；当 grammar 不允许 variant/state 时，这两个选择器会被
禁用并清空。Builder **创建一个新变量**，且从不碰画布上的选区：选一个目标
**Collection** 和一个 **Type**（从 category 自动推断——颜色 → Color，标量 →
Number，枚举 → String——并且可以覆盖），然后按 **Create variable**。变量创建时带
拼好的名字、不带值，所以实际的 token 值要之后在 Figma 里填。**Refresh
collections** 会在你于插件打开期间新增集合后重新读取列表。预览也支持把名字复制到
剪贴板。

### Validator

选一个范围（「绑定到选区」或「全部本地变量」），扫描，得到一张名字 / 状态 / 建议
修复 / 操作的表格。每个问题都带一个具体的错误码报出（`missing-prefix`、
`unknown-category`、`case-violation`、`group-separator`……）。建议修复会规范化前缀、
分隔符、大小写、同义词和段顺序，兜底方案是有界的编辑距离修复。可以单行内联重命名，
也可以选中多行批量重命名；结果汇总为「N 个成功，M 个失败」。

## 开发

需要 Node >= 20 和 pnpm。

```bash
pnpm install
```

### 本地插件工作流

```bash
pnpm dev        # watch 构建 dist/main.js 与 dist/ui.html
```

然后在 **Figma 桌面端**：Plugins → Development → Import plugin from manifest… →
选择本仓库的 `manifest.json`。每次重新构建后重跑插件即可；只有 `manifest.json`
本身变化时才需要重新导入。

UI 被打包成单个完全内联的 `dist/ui.html`（不发任何远端请求），sandbox 是一个自包含
的 `dist/main.js` IIFE，不访问 DOM。

### 脚本

| 脚本                | 说明                                       |
| ------------------- | ------------------------------------------ |
| `pnpm dev`          | 同时 watch 构建 sandbox 和 UI              |
| `pnpm build`        | 清理并产出 `dist/main.js` + `dist/ui.html` |
| `pnpm typecheck`    | 对 main / ui / node 三个子工程跑 `tsc -b`  |
| `pnpm test`         | 跑 grammar 单元测试（vitest，node 环境）   |
| `pnpm lint`         | ESLint（flat config）                      |
| `pnpm format`       | Prettier 写入                              |
| `pnpm format:check` | Prettier 检查                              |
| `pnpm verify`       | lint + typecheck + test + build            |

## 架构

```
src/
├── grammar/     # 纯逻辑、无 DOM 依赖的命名逻辑：词表、grammar 表、
│                # compose / parse / validate / suggest（含单元测试）
├── protocol/    # main 与 UI 共用的带类型 postMessage 契约
├── main/        # Figma sandbox 线程：只做变量的读写 IO
└── ui/          # React + Spiral（@aviala-design/spiral）iframe 应用
```

所有命名逻辑都作为纯函数住在 `src/grammar` 里，这样它能在 Node 里做单元测试、也能被
打包进 UI，从而让 `main.js` 保持最小——sandbox 只负责搬运原始变量数据和最终的重命名
字符串。

## 许可

MIT © AvialaOSS
