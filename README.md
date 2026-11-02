# dsh-ui-dock

把 DSH 主界面拆成一个个开关：**逐个隐藏或显示左栏、会话列表、标题栏、消息区、输入框、右栏**，支持"只看对话"和"一片空白"一键预设；角落的齿轮可以换图标、调大小、拖到任意位置，随时恢复界面；面板文案支持中英文切换（默认中文）。

Hide or show each DSH main-surface region independently, with conversation-only
and blank-canvas presets, a fully customizable always-reachable corner gear,
and a Chinese/English panel switch (Chinese by default).

## 功能 / Features

- **8 个区域独立开关**：左侧整栏、面板图标列、会话列表、会话标题栏、消息回复区、输入框、右侧栏、停靠条。
- **3 个一键预设**：全部显示 / 只看对话（只留消息区+输入框）/ 一片空白（全隐藏）。
- **齿轮完全自定义**：8 个内置图标或上传自己的图片、20–72px 大小、可拖到画面任意位置（位置按百分比保存，改窗口大小不跑偏）。
- **中英文切换**：面板文案中文/English 一键切换，默认中文。
- **左下角逐项开关**：侧栏底部每一项（费用条、插件市场、记忆、账号登录等）都能独立开关，关掉只影响该项，不影响其它功能。
- **面板去处**：每个面板入口可在「左侧 / 停靠 / 隐藏」之间切换，停靠项贴在齿轮旁边。
- **左侧栏排版**：面板字号/行高/行间距、会话字号/行高/行间距 + 额外行距，共 7 个步进器，另外含侧栏底部的设置区、插件市场、记忆、账号行。
- **持久化**：全部写进 `localStorage['dsh:ui-dock:v1']`，刷新不丢。

## 安装 / Install

本仓库根目录就是插件包目录（`package.json` 在根），**不需要构建、无依赖**。

**方式一：插件管理页（推荐，任何机器都能用）**

在「插件管理 → 添加插件 / Plugins → Install」的安装来源里填：

```
github:ou-tai/dsh-ui-dock
```

钉住 commit 以可复现安装：

```
github:ou-tai/dsh-ui-dock#<40位 commit SHA>
```

**方式二：dsh CLI（仅当机器上装了 dsh CLI）**

```bash
dsh plugin --profile web add github:ou-tai/dsh-ui-dock
```

**方式三：npm（发布到 npm 之后）**

```bash
dsh plugin --profile web add dsh-ui-dock
```

**方式四：dsh-m 市场（收录之后）**

```bash
dshm install --id dsh-ui-dock
```

> `dshm` CLI 只作用于 web profile；Desktop profile 请用官方插件管理页。

安装后按提示**重启 DSH** 生效（无 HMR 时 bundle 无法热替换）。

## 本插件的通用性 / Portability

**这是通用插件，不绑定某台机器。** 插件内不写任何绝对路径、profile 名、本机 id 或账号信息；
左栏底部条目（费用、插件市场、记忆、账号）是**运行期枚举宿主注册**得到的，不是写死的清单，
所以你的 profile 装了哪些插件，面板就出现哪些开关。

但它依赖 DSH 的**内部界面契约**（`data-slot` 语义锚点、`shell.overlay` 等槽位）而非公开 API，
因此与宿主版本相关：升级 DSH 大版本后若界面结构变化，个别功能可能失效。
`package.json` 的 `engines.dsh` 声明了已验证的下限。

## 卸载 / 升级

```bash
dsh plugin --profile web remove dsh-ui-dock
dsh plugin --profile web add github:ou-tai/dsh-ui-dock#<新commit>
```

市场通道：`dshm uninstall --pkg dsh-ui-dock --yes` / `dshm upgrade --pkg dsh-ui-dock --yes`。

## 用法 / Usage

1. 界面上出现齿轮（默认左下角），**直接拖动可移动到任意位置**，**点击**打开控制面板。
2. 「一键预设」三个按钮，快速在全部显示 / 只看对话 / 一片空白之间切换。
3. 「主界面区域」8 个开关，逐个控制显示或隐藏。
4. 「语言」中 / EN 切换面板文案。
5. 「齿轮外观」换图标、上传图片、调大小；「齿轮位置」四个角一键归位。
6. 「左侧栏排版」7 个步进器，实时生效。
7. 「左下角逐项开关」侧栏底部每一项一个开关——费用条、插件市场、记忆、账号登录等，列表按你实际装的插件**实时枚举**，不是写死的清单。
8. 「面板去处」给每个面板选 左侧 / 停靠 / 隐藏。

> **安全设计**：齿轮是唯一的恢复入口，因此**不允许被隐藏**。即使把 8 个区域全部关掉（一片空白），齿轮仍在，点开点「全部显示」即可恢复。

## 重要边界（请先读）/ Important limits

- **隐藏是纯视觉的，不是权限控制。** 区域开关只写 CSS `display:none`，任何人在开发者工具里都能撤销，也无法阻止他人在会话里操作。如果你需要真正的访问控制，这不是它。
- **宿主语言切换不保证成功。** 「语言」按钮会同时请求宿主切换整个界面语言；宿主不接受时，只有本插件面板会变，面板里会明确提示 `宿主未接受该语言，只切换了本插件面板`。
- **依赖宿主的稳定锚点，而非内部实现。** 所有选择器锚在 `[data-slot=...]`、`[data-shell-overlay]`、`[data-composer-seat]`、`nav`、`[role="treeitem"]` 这些宿主对外输出的表面，**不使用构建哈希类名**。宿主升级若改了槽位结构，区域隐藏/排版可能静默失效（只丑不崩），齿轮与预设不受影响。
- **侧栏排版覆盖了宿主的块级内边距。** 宿主面板行是 `padding:7px 8px` + `line-height:22px`，恰好等于它的 `min-height:36px`；不改内边距的话行高永远缩不动。本插件会覆盖这段内边距，因此行高设置是**真生效**的。

## 兼容性 / Compatibility

- 已在 **DSH 0.2.1-rc.4** 上验证（web / desktop 两套 profile 同构）。
- 无第三方运行时依赖，无构建步骤，无原生模块。

## 实现要点 / How it works

- **加载器契约（改这个仓库前必读）**：宿主把 `client.js` 当**普通脚本**在同一页面作用域里求值，所有 bundle 的 client 产物共享一套词法作用域。因此**任何顶层 `const`/`let` 都可能和别的包撞名**——本项目早期版本顶层写了 `const PACKAGE_ID`，页面直接报 `Identifier 'PACKAGE_ID' has already been declared`，整个 client 半边不执行、齿轮不出现。现在全部代码收在唯一的 `window.__ModuleLoader__.load({...})` 表达式内，顶层只有那一个调用。
- 齿轮注册进 `shell.overlay`：该槽是 `position:absolute; inset:0`、`pointer-events:none`、子元素 `pointer-events:auto`，所以它天然浮在所有可隐藏区域之外——这是"一片空白"仍可恢复的根本原因。
- 区域隐藏 = 注入 CSS，锚点是宿主稳定表面。左右两栏任一隐藏时，额外覆盖 `grid-template-columns`（宿主是行内样式，所以用独立 style 标签 + `!important`），否则中间列会留下空轨道。
- **面板移出左侧靠影子注册**：同 `id` 用远低于动态安装区间的私有优先级注册空标记，SlotCore 每个 cell 只取优先级最靠前的存活项，官方那条被遮蔽；标记属性 `data-uidock-id` 供样式表隐藏原行。
  - 影子等级必须低于动态安装分配区间：动态包运行期会给第三方包分配 `-1, -2, -3…`，若影子也用 `-1`，会与下一个市场安装撞号，也会让第三方行被误判成"自家影子"而消失。
  - 枚举开关**只能用宿主原始账本 `ctx.slots.entries()`**，不能用 `entriesOfSlot()`：后者只返回每个 cell 的胜出项，影子一旦胜出，原行就再也看不到，开关会从面板消失、无法恢复（这正是"隐藏后找不回"的根因）。
- **link 安装下每次保存都是发布**：插件以 `link:` 指向本目录时，宿主加载的就是磁盘上的 `client.js`。编辑中途的半成品语法错误会立刻被页面加载，表现为整块 UI 空白并报 `Unexpected token`。改完务必先 `node --check client.js` 再做任何手动刷新。
- **启动路径必须廉价（改这里最容易把宿主搞崩）**：本包按 `immediately: true` 在启动期加载，此时一个 profile 会注册几十个槽。任何"每次槽变化就全量重做"的写法都会让宿主在首帧之前卡住，且**不报任何 JS 错误**——宿主表现是 `Renderer recovery exhausted: timed out waiting for page load and UI mount`，进恢复模式。必须遵守：
  - 样式表按**序列化状态**去重，不要每趟重建；
  - 影子注册做**差分**（只增删目标与实际不一致的格子），不要每趟全销毁重建；
  - 调度用 `requestAnimationFrame` 而不是微任务，给首帧让路；
  - 禁止在启动路径做 `querySelector('*:has(...)')` 这种全文档扫描；用 `[data-shell-overlay]` 的 `parentElement` 直接定位；
  - 读 `getComputedStyle().gridTemplateColumns` 会强制同步重排，必须按隐藏列签名去重后再读。
  - `rebuild()` 整体包在 try/catch 里：在宿主的渲染周期中抛异常会让整页挂掉，失败必须降级而不是炸穿。
- **不能有自我激励的回路（改这里第二容易出事故）**：`ctx.slots.register()` **同步**通知订阅者。若在重建过程中注册影子，`capture` 会在本轮写完归属记录之前又跑一次；此时账本里影子和原行同时存在，任何**可变**的"这是不是我"判定都会在两次遍历间翻转——表现就是左栏底部条目和齿轮面板以帧级频率闪烁。必须遵守：
  - 归属判定只能用**不可变数据**（影子固定 `priority: SHADOW_PRIORITY`），**不要**用需要事后写入的 `Set`／Map；
  - 重建内部触发的 `capture` **不得**再请求新的重建（`if (!inSync) requestSync()`）；
  - 影子注册时**保留原 label**。空 `label` 会让宿主 `syncPanels` 的标题在 `""` 与真实值之间来回翻，即使归属判定正确也会抖。
- 左下角逐项开关走**同一套影子注册**，只是作用在 `sidebar.footer.action`（list，每 id 一格）与 `sidebar.settings`（single）上。列表来自运行期枚举原始账本 `ctx.slots.entries(...)`，所以别人装了什么就出现什么开关；已存在的历史 id 不会产生额外注册，也不会报错。
- 停靠项点击前会先确认该 id 在 `main` 有注册（`layout.selectPanel` 对未注册 id 会抛异常），不可用时按钮禁用。
- 齿轮位置存百分比而非像素，窗口缩放后仍在原位。
- `dsh.client.inject` 只声明 `@deepseek-ai/dsh-client-ui-slots`。这是 `ctx.slots` 服务来源包，与同类插件声明一致。注意：包级 `inject` 只影响 bundle 预加载顺序，声明一个没有 `dsh.client` 字段的包**不会**让 client 半边加载失败（早期版本文档此处说法有误，已更正）；真正的服务级顺序由 `client.js` 里的 `inject: ['slots','layout']` 保证。

## License

MIT，见 [LICENSE](./LICENSE)。
