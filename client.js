/**
 * dsh-ui-dock — client half.
 *
 * LOADER CONTRACT (critical):
 * The host evaluates this file as a classic script inside the page, and a
 * bundle's client artifacts share one lexical scope with the shipped ones.
 * Top-level `const`/`let` therefore collide with any other artifact declaring
 * the same identifier. The first version of this file declared
 * `const PACKAGE_ID` at top level and the page died with
 * "Identifier 'PACKAGE_ID' has already been declared" before anything could
 * register — the gear never appeared. Everything now lives inside this single
 * `window.__ModuleLoader__.load({...})` expression, so the only top-level
 * binding is that one call and this file cannot clash with any other bundle.
 *
 * Capabilities, all driven by one state object persisted in `localStorage`:
 *
 * 1. Region switches — left column, panel icon list, session list, conversation
 *    header, chat flow, composer, right column and the dock strip can each be
 *    hidden and shown, with "conversation only" and "blank canvas" presets.
 * 2. Panel placement — a `sidebar.panellist` entry can be docked or hidden by
 *    shadowing it with a far-lower-priority registration of the same id; SlotCore
 *    keeps the first live entry of each cell in priority order, and the shadow
 *    renders a marker attribute the stylesheet uses to hide the original row.
 *    The shadow's rank is deliberately far below zero rather than -1: the
 *    dynamic package runner hands out -1, -2, -3… to third-party installs, and
 *    a shadow at -1 would both collide with the next marketplace install and
 *    make every third-party row look like one of ours.
 * 3. Sidebar typography — the shipped row is `padding: 7px 8px` +
 *    `line-height: 22px`, exactly its `min-height: 36px`, so `min-height` alone
 *    never shrinks it. The block padding is neutralized and all three metrics
 *    are driven, including the sidebar foot (`sidebar.settings`,
 *    `sidebar.footer.action`) which is not inside `nav` at all.
 * 4. Gear — glyph presets or an uploaded image, 20–72px, draggable anywhere on
 *    the frame, stored as percentages so it survives a resize. It lives in
 *    `shell.overlay` (`position: absolute; inset: 0`, click-through layer, each
 *    child opts into pointer events), which is outside every region it can
 *    hide — that is why "hide everything" stays recoverable.
 * 5. Language — the panel copy switches between Chinese and English, Chinese by
 *    default; the host locale is an optional service and the panel reports
 *    honestly when the host refuses the switch.
 */

window.__ModuleLoader__.load({
  id: 'dsh-ui-dock',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useRef } = React

    const PACKAGE_ID = 'dsh-ui-dock'
    const NS = 'ui-dock'
    const STORAGE_KEY = 'dsh:ui-dock:v1'
    const STYLE_ID = `${PACKAGE_ID}/overrides.css`
    const GRID_STYLE_ID = `${PACKAGE_ID}/grid.css`
    const GEAR_ID = `${PACKAGE_ID}-gear`
    const MAX_IMAGE_BYTES = 400 * 1024

    /**
     * Stepper ranges. The floors are readable minimums rather than taste
     * limits, and every value is reachable because the stylesheet neutralizes
     * the host's block padding.
     */
    const LIMITS = {
      panelFont: { min: 10, max: 22, step: 1, fallback: 14 },
      panelLine: { min: 12, max: 34, step: 1, fallback: 22 },
      panelRow: { min: 18, max: 64, step: 1, fallback: 36 },
      sessionFont: { min: 10, max: 22, step: 1, fallback: 14 },
      sessionLine: { min: 12, max: 34, step: 1, fallback: 20 },
      sessionRow: { min: 18, max: 64, step: 1, fallback: 32 },
      rowGap: { min: 0, max: 20, step: 1, fallback: 0 },
      gearSize: { min: 20, max: 72, step: 2, fallback: 34 }
    }

    const FONT_KEYS = [
      'panelFont',
      'panelLine',
      'panelRow',
      'sessionFont',
      'sessionLine',
      'sessionRow'
    ]

    const FONT_LABEL_KEYS = {
      panelFont: 'font.panelSize',
      panelLine: 'font.panelLine',
      panelRow: 'font.panelRow',
      sessionFont: 'font.sessionSize',
      sessionLine: 'font.sessionLine',
      sessionRow: 'font.sessionRow'
    }

    /**
     * Compact top: the new-session button and the panel list are siblings of
     * each other inside the sidebar root, which stacks them vertically and
     * eats a tall block of the column. Their shared parent is the only element
     * that can put both on one row, so the root becomes a two-column grid: row
     * three is `button | nav`, every other child keeps a full-width row, and
     * the session area takes `minmax(0, 1fr)` — the grid counterpart of the
     * `flex: 1` it relies on today.
     *
     * The previous version of this stylesheet selected
     * `> :has(> button[aria-label])`, which matches the logo row and `nav`
     * (both own a direct `button[aria-label]`) instead of the root, so enabling
     * it would have flattened two sub-areas rather than joining the two
     * siblings. Anchors here are semantic only — the `nav` element, a direct
     * `button`, `data-window-drag`, and the two trailing plain divs (session
     * area, then foot). No hashed host class name is referenced.
     *
     * The rail (collapsed) column is 56px wide and cannot host a horizontal
     * row, so every rule is reverted once the frame reports
     * `data-sidebar-collapsed`.
     */
    const COMPACT_TOP_CSS = `
[data-slot="sidebar"] > div:has(> nav) {
  display: grid !important;
  grid-template-columns: min-content minmax(0, 1fr) !important;
  grid-template-rows: auto auto auto minmax(0, 1fr) auto !important;
  grid-template-areas: "strip strip" "new nav" "logo logo" "region region" "foot foot" !important;
  column-gap: 4px !important;
  row-gap: 0 !important;
  align-content: stretch !important;
}
[data-slot="sidebar"] > div:has(> nav) > div[data-window-drag] {
  grid-area: logo !important;
  margin-top: 0 !important;
}
[data-slot="sidebar"] > div:has(> nav) > div[data-window-drag]:has(+ div[data-window-drag]) {
  grid-area: strip !important;
}
[data-slot="sidebar"] > div:has(> nav) > button {
  grid-area: new !important;
  align-self: center !important;
  justify-self: start !important;
  margin: 0 !important;
  min-width: 0 !important;
  white-space: nowrap !important;
  -webkit-app-region: no-drag !important;
}
[data-slot="sidebar"] > div:has(> nav) > nav {
  -webkit-app-region: no-drag !important;
}
[data-slot="sidebar"] > div:has(> nav) > button:has(svg) {
  font-size: 0 !important;
  padding: 0 !important;
  width: 28px !important;
  height: 28px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
  border-radius: var(--dsw-radius-sm, 6px) !important;
}
[data-slot="sidebar"] > div:has(> nav) > button:has(svg) svg {
  flex: 0 0 auto !important;
  width: 16px !important;
  height: 16px !important;
}
/* On Windows the host itself parks the collapsed new-session control on the
   titlebar, in the exact band the screenshot's red box shows:
     [data-windows-titlebar] ... .newSession{position:fixed;left:48px;
       top:calc((var(--dsh-windows-titlebar-height) - 28px)/2);
       width:28px;height:28px;z-index:30}
   These offsets are copied from that rule, not invented: 12px inline inset +
   28px collapse toggle + 8px gap = 48px. Reusing the host's own coordinates is
   what makes the ＋ sit beside the ☰ on the application chrome; a grid row
   inside the column can never share that band. */
/* On Windows the host parks the sidebar toggle on the caption at left:12px
   (28px wide, so it occupies 12-40px) and starts the
   Desktop-owned app menus at "--dsh-windows-menu-start", which the host sets
   to 48px while the sidebar is expanded. Putting the ＋ at 48px would therefore
   sit ON TOP of the 「应用/编辑」menu — that is exactly what "没和编辑对齐"
   looked like.

   The eight pixels between the toggle (ends at 40px) and the menu (starts at
   48px) cannot hold a 28px control either, so the button cannot be squeezed
   between them without overlapping one side. It is placed immediately after
   the toggle and the menu is pushed right by the same amount, using the host's
   own variable. The host reads "--dsh-windows-menu-start" off the root and
   defaults it to 48px when expanded, so raising it there is the one supported
   way to make room — and it keeps the menu's own positioning logic intact. */
html[data-windows-titlebar] {
  --uidock-lead-width: 28px;
}
html[data-windows-titlebar]:not(:has([data-sidebar-collapsed])) {
  --dsh-windows-menu-start: calc(48px + 32px);
}
html[data-windows-titlebar] [data-slot="sidebar"] > div:has(> nav) > button:has(svg) {
  position: fixed !important;
  left: 48px !important;
  top: calc((var(--dsh-windows-titlebar-height, 40px) - 28px) / 2) !important;
  width: 28px !important;
  height: 28px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  z-index: 30 !important;
  border-radius: var(--dsw-radius-sm, 6px) !important;
  color: var(--dsw-alias-label-secondary) !important;
  -webkit-app-region: no-drag !important;
}
/* Collapse guard. The host parks its OWN new-session control at this exact
   spot once the sidebar collapses, so leaving ours fixed there stacks two ＋
   buttons on the same pixel. The collapsed flag lives on the frame div,
   one level ABOVE the sidebar slot anchor, so a descendant selector cannot
   test it with :not() — CSS has no parent walk here. The guard is therefore a
   second rule that puts the button back into flow whenever an ancestor frame
   reports the collapsed state. */
[data-sidebar-collapsed] [data-slot="sidebar"] > div:has(> nav) > button:has(svg) {
  position: static !important;
  width: auto !important;
  height: auto !important;
  z-index: auto !important;
}
[data-slot="sidebar"] > div:has(> nav) > nav {
  min-height: 28px !important;
}
[data-slot="sidebar"] > div:has(> nav) > div:has([data-slot="sidebar.workspaces"]) {
  grid-area: region !important;
  min-width: 0 !important;
}
[data-slot="sidebar"] > div:has(> nav) > div:nth-last-child(2):not(:has([data-slot="sidebar.settings"])):not(:has([data-slot="sidebar.footer.action"])) {
  grid-area: region !important;
  min-width: 0 !important;
}
[data-slot="sidebar"] > div:has(> nav) > div:has([data-slot="sidebar.settings"]) {
  grid-area: foot !important;
}
[data-slot="sidebar"] > div:has(> nav) > div:last-child:not(:has([data-slot="sidebar.workspaces"])) {
  grid-area: foot !important;
}
[data-sidebar-collapsed] [data-slot="sidebar"] > div:has(> nav) {
  display: flex !important;
  grid-template-columns: none !important;
  grid-template-rows: none !important;
  grid-template-areas: none !important;
}
[data-sidebar-collapsed] [data-slot="sidebar"] > div:has(> nav) > nav {
  flex-direction: column !important;
  flex-wrap: nowrap !important;
  gap: 12px !important;
  margin-bottom: 12px !important;
}
html:not([data-windows-titlebar]) [data-sidebar-collapsed] [data-slot="sidebar"] > div:has(> nav) > button {
  margin: 0 0 12px !important;
}`

    /** Hideable regions; only stable host surfaces, never hashed class names. */
    const REGIONS = [
      {
        key: 'sidebar',
        labelKey: 'region.sidebar',
        css: `/* left column */ [data-slot="sidebar"]{display:none!important}`
      },
      {
        key: 'panelList',
        labelKey: 'region.panelList',
        css: `/* panel icon list */ [data-slot="sidebar"] nav{display:none!important}`
      },
      {
        key: 'sessionList',
        labelKey: 'region.sessionList',
        css: `/* session and workspace tree */ [data-slot="sidebar.workspaces"]{display:none!important}`
      },
      {
        key: 'header',
        labelKey: 'region.header',
        css: `/* conversation header */ [data-slot="main"] header,[data-conversation-header-leading]{display:none!important}`
      },
      {
        key: 'chat',
        labelKey: 'region.chat',
        css: `/* message flow */ [data-slot="conversation.chat.flow"]{display:none!important}`
      },
      {
        key: 'composer',
        labelKey: 'region.composer',
        css: `/* input card */ [data-composer-seat],[data-conversation-region="composer"]{display:none!important}`
      },
      {
        key: 'rightbar',
        labelKey: 'region.rightbar',
        css: `/* right column */ [data-slot="rightbar"]{display:none!important}`
      },
      {
        key: 'dockBar',
        labelKey: 'region.dockBar',
        css: `/* this plugin's dock strip */ [data-uidock-bar]{display:none!important}`
      }
    ]

    const PRESETS = [
      { key: 'all', labelKey: 'preset.all', hidden: [] },
      {
        key: 'focus',
        labelKey: 'preset.focus',
        hidden: ['sidebar', 'rightbar', 'header', 'dockBar']
      },
      {
        key: 'blank',
        labelKey: 'preset.blank',
        hidden: REGIONS.map((region) => region.key)
      }
    ]

    /**
     * Shadow rank. `priority` is ignored below 0 by nothing, but a dynamically
     * installed package is handed `-1, -2, -3…` by its own runner
     * (`runner-client.js` `nextPriority`), so a shadow must not use -1: it would
     * collide with the next marketplace install on the same id. A rank far below
     * anything the runner hands out keeps both lanes collision-free.
     */
    const SHADOW_PRIORITY = -100000
    /** Raster formats the gear accepts. `svg+xml` is deliberately absent. */
    const IMAGE_MIME = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,/i

    const GEAR_GLYPHS = ['⚙', '🎛', '🛠', '⚡', '✳', '☰', '◎', '◉']
    const MODES = ['sidebar', 'dock', 'hidden']
    const CORNERS = [
      { key: 'bottom-left', x: 3, y: 95 },
      { key: 'bottom-right', x: 97, y: 95 },
      { key: 'top-left', x: 3, y: 5 },
      { key: 'top-right', x: 97, y: 5 }
    ]
    const LANGS = ['zh', 'en']

    const zhDict = {
      'gear.open': '界面开关',
      'gear.close': '收起界面开关',
      'gear.collapse': '收起面板',
      'gear.hint': '齿轮是唯一的恢复入口，不会被隐藏。拖动可移动，点击打开面板。',
      'panel.title': '界面开关',
      'panel.note': '全部隐藏后仍可从这里恢复。',
      'group.preset': '一键预设',
      'group.region': '主界面区域',
      'group.gear': '齿轮外观',
      'group.position': '齿轮位置',
      'group.language': '语言',
      'group.typography': '左侧栏排版',
      'group.placement': '面板去处',
      'group.foot': '左下角逐项开关',
      'foot.empty': '左下角还没有可开关的条目。',
      'foot.note': '每一项独立控制，关掉只影响该项。',
      'compact.label': '顶部并排收纳',
      'compact.note': '把新会话按钮与面板图标列并到一行，腾出的高度给会话列表；折叠态自动还原。',
      'region.sidebar': '左侧整栏',
      'region.panelList': '面板图标列',
      'region.sessionList': '会话列表',
      'region.header': '会话标题栏',
      'region.chat': '消息回复区',
      'region.composer': '输入框',
      'region.rightbar': '右侧栏',
      'region.dockBar': '停靠条',
      'preset.all': '全部显示',
      'preset.focus': '只看对话',
      'preset.blank': '一片空白',
      'corner.bottom-left': '左下角',
      'corner.bottom-right': '右下角',
      'corner.top-left': '左上角',
      'corner.top-right': '右上角',
      'gear.glyph': '图标',
      'gear.size': '大小',
      'gear.imagePick': '选择图片',
      'gear.imageClear': '清除图片',
      'gear.imageBad': '这张图片无法使用：需要图片文件且不超过 400KB。',
      'gear.draggable': '可直接拖动齿轮到任意位置。',
      'lang.zh': '中文',
      'lang.en': 'English',
      'lang.hostOk': '已同步切换整个界面语言。',
      'lang.hostFail': '宿主未接受该语言，只切换了本插件面板。',
      'font.panelSize': '面板字号',
      'font.panelLine': '面板行高',
      'font.panelRow': '面板行间距',
      'font.sessionSize': '会话字号',
      'font.sessionLine': '会话行高',
      'font.sessionRow': '会话行间距',
      'font.rowGap': '额外行距',
      'placement.sidebar': '左侧',
      'placement.dock': '停靠',
      'placement.hidden': '隐藏',
      'placement.empty': '还没有可调整的面板入口。',
      'action.reset': '恢复默认',
      'action.failed': '有开关没能生效（宿主拒绝了隐藏注册）。点「恢复默认」可让所有条目重新出现。'
    }

    const enDict = {
      'gear.open': 'Interface switches',
      'gear.close': 'Collapse interface switches',
      'gear.collapse': 'Collapse panel',
      'gear.hint': 'The gear is the only way back and can never be hidden. Drag to move, click to open.',
      'panel.title': 'Interface switches',
      'panel.note': 'You can always get the UI back from here.',
      'group.preset': 'Presets',
      'group.region': 'Main regions',
      'group.gear': 'Gear appearance',
      'group.position': 'Gear position',
      'group.language': 'Language',
      'group.typography': 'Sidebar typography',
      'group.placement': 'Panel placement',
      'group.foot': 'Sidebar foot switches',
      'foot.empty': 'No switchable foot entries yet.',
      'foot.note': 'Each entry is independent; turning one off affects only it.',
      'compact.label': 'Compact top row',
      'compact.note': 'Puts the new-session button beside the panel list and hands the freed height to the session list; the collapsed rail restores itself.',
      'region.sidebar': 'Whole left column',
      'region.panelList': 'Panel icon list',
      'region.sessionList': 'Session list',
      'region.header': 'Conversation header',
      'region.chat': 'Message flow',
      'region.composer': 'Input box',
      'region.rightbar': 'Right column',
      'region.dockBar': 'Dock strip',
      'preset.all': 'Show everything',
      'preset.focus': 'Conversation only',
      'preset.blank': 'Blank canvas',
      'corner.bottom-left': 'Bottom left',
      'corner.bottom-right': 'Bottom right',
      'corner.top-left': 'Top left',
      'corner.top-right': 'Top right',
      'gear.glyph': 'Glyph',
      'gear.size': 'Size',
      'gear.imagePick': 'Choose image',
      'gear.imageClear': 'Clear image',
      'gear.imageBad': 'That image cannot be used: pick an image file under 400KB.',
      'gear.draggable': 'Drag the gear anywhere on the frame.',
      'lang.zh': '中文',
      'lang.en': 'English',
      'lang.hostOk': 'The whole interface language was switched too.',
      'lang.hostFail': 'The host refused that language; only this panel changed.',
      'font.panelSize': 'Panel font size',
      'font.panelLine': 'Panel line height',
      'font.panelRow': 'Panel row height',
      'font.sessionSize': 'Session font size',
      'font.sessionLine': 'Session line height',
      'font.sessionRow': 'Session row height',
      'font.rowGap': 'Extra row gap',
      'placement.sidebar': 'Left',
      'placement.dock': 'Dock',
      'placement.hidden': 'Hide',
      'placement.empty': 'No panel entries to arrange yet.',
      'action.reset': 'Reset',
      'action.failed': 'Some switches could not take effect (the host refused the hide registration). Use Reset to bring every entry back.'
    }

    const DICTS = { zh: zhDict, en: enDict }

    const makeT = (lang) => {
      const dict = DICTS[lang] === undefined ? zhDict : DICTS[lang]
      return (key) => (dict[key] === undefined ? zhDict[key] ?? key : dict[key])
    }

    /** Theme tokens only; the two shadows are the sole literal colors. */
    const styles = {
      gear: {
        position: 'absolute',
        zIndex: 40,
        borderRadius: '999px',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-overlay)',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'grab',
        padding: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,.16)',
        pointerEvents: 'auto',
        userSelect: 'none',
        touchAction: 'none',
        transform: 'translate(-50%, -50%)'
      },
      gearImg: { width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' },
      overlay: { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: 40 },
      card: {
        position: 'absolute',
        maxHeight: 'min(70vh, 580px)',
        width: 'min(440px, 94vw)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
        padding: '12px',
        borderRadius: 'var(--dsw-radius-lg)',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-overlay)',
        color: 'var(--dsw-alias-label-primary)',
        boxShadow: '0 8px 32px rgba(0,0,0,.24)',
        fontSize: '13px',
        pointerEvents: 'auto'
      },
      head: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' },
      note: { color: 'var(--dsw-alias-label-tertiary)', fontSize: '11px', lineHeight: '16px' },
      groupTitle: {
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: '11px',
        lineHeight: '16px',
        marginTop: '2px'
      },
      toggleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minHeight: '26px',
        cursor: 'pointer',
        userSelect: 'none'
      },
      toggleLabel: { flex: '1 1 auto', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' },
      switch: {
        flex: 'none',
        width: '34px',
        height: '18px',
        borderRadius: '999px',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-layer-2)',
        position: 'relative',
        cursor: 'pointer',
        padding: '0'
      },
      switchOn: { background: 'var(--dsw-alias-brand-primary)', borderColor: 'transparent' },
      knob: {
        position: 'absolute',
        top: '1px',
        left: '1px',
        width: '14px',
        height: '14px',
        borderRadius: '999px',
        background: 'var(--dsw-alias-bg-overlay)',
        transition: 'transform .12s'
      },
      knobOn: { transform: 'translateX(15px)' },
      smallBtn: {
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 'var(--dsw-radius-sm)',
        background: 'var(--dsw-alias-button-elevated-fill)',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        fontSize: '12px',
        padding: '4px 9px'
      },
      smallBtnOn: {
        background: 'var(--dsw-alias-interactive-bg-hover)',
        borderColor: 'var(--dsw-alias-state-business-primary)'
      },
      btnRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' },
      stepper: { display: 'flex', alignItems: 'center', gap: '6px', minHeight: '24px' },
      stepperLabel: {
        flex: '1 1 auto',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '12px'
      },
      stepperValue: { minWidth: '24px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' },
      stepButton: {
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 'var(--dsw-radius-sm)',
        background: 'var(--dsw-alias-button-elevated-fill)',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        width: '22px',
        height: '22px',
        lineHeight: '16px',
        padding: '0',
        flex: 'none'
      },
      stepButtonOff: { opacity: '0.4', cursor: 'default' },
      placeRow: { display: 'flex', alignItems: 'center', gap: '8px', minHeight: '26px' },
      placeLabel: {
        flex: '1 1 auto',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '12px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      },
      segmented: { display: 'flex', gap: '2px', flex: 'none' },
      segment: {
        // No permanent border: a border on every option reads as "still
        // unselected" after a click, which is exactly the leftover outline the
        // user kept pointing at. The box is kept at the same size so the row
        // does not reflow when the selection moves.
        border: '0.5px solid transparent',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        fontSize: '11px',
        padding: '3px 6px',
        cursor: 'pointer',
        borderRadius: 'var(--dsw-radius-xs)',
        // A mouse click leaves the button focused; the host's focus ring is for
        // keyboard users, so only focus-visible may draw it.
        outline: 'none'
      },
      segmentActive: {
        background: 'var(--dsw-alias-interactive-bg-hover)',
        color: 'var(--dsw-alias-label-primary)',
        borderColor: 'var(--dsw-alias-state-business-primary)'
      },
      dockBar: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 10px',
        minHeight: '28px',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 'var(--dsw-radius-md)',
        background: 'var(--dsw-alias-bg-overlay)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: '12px',
        overflowX: 'auto',
        pointerEvents: 'auto',
        position: 'absolute',
        maxWidth: 'min(62vw, 560px)'
      },
      pill: {
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 'var(--dsw-radius-md)',
        background: 'var(--dsw-alias-button-elevated-fill)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        padding: '4px 9px',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      },
      pillOff: { opacity: '0.5', cursor: 'default' }
    }

    // -----------------------------------------------------------------
    // State
    // -----------------------------------------------------------------

    const clampNumber = (key, value) => {
      const spec = LIMITS[key]
      if (spec === undefined) return Number(value)
      const next = Number(value)
      if (!Number.isFinite(next)) return spec.fallback
      const stepped = Math.round((next - spec.min) / spec.step) * spec.step + spec.min
      return Math.min(spec.max, Math.max(spec.min, stepped))
    }

    const clampPercent = (value, fallback) => {
      const next = Number(value)
      if (!Number.isFinite(next)) return fallback
      return Math.min(98, Math.max(2, Math.round(next * 10) / 10))
    }

    const emptyState = () => ({
      font: {},
      rowGap: LIMITS.rowGap.fallback,
      place: {},
      hidden: [],
      foot: {},
      // Off by default: it changes the host's sidebar flow, so it must be an
      // explicit opt-in rather than a surprise after an upgrade.
      compactTop: false,
      gear: { glyph: '⚙', image: null, size: LIMITS.gearSize.fallback, x: 3, y: 95 },
      lang: 'zh'
    })

    /**
     * Coerce any stored value into the shape this plugin understands. Unknown
     * keys are dropped, numbers are clamped, and only a `data:image/` URL is
     * accepted as a gear image so nothing else can ever reach `src`.
     */
    const normalizeState = (raw) => {
      const state = emptyState()
      if (raw === null || typeof raw !== 'object') return state

      if (raw.font !== null && typeof raw.font === 'object') {
        for (const key of FONT_KEYS) {
          if (raw.font[key] !== undefined) state.font[key] = clampNumber(key, raw.font[key])
        }
      }
      if (raw.rowGap !== undefined) state.rowGap = clampNumber('rowGap', raw.rowGap)

      if (raw.place !== null && typeof raw.place === 'object' && !Array.isArray(raw.place)) {
        for (const [id, mode] of Object.entries(raw.place)) {
          // Same id discipline as the foot map: bounded key length and a
          // bounded number of entries, so a hand-edited value cannot grow the
          // blob without limit (localStorage is shared with the host).
          if (typeof id !== 'string' || id.length === 0 || id.length > 120) continue
          if (Object.keys(state.place).length >= 64) break
          if (mode !== 'dock' && mode !== 'hidden') continue
          state.place[id] = mode
        }
      }

      if (Array.isArray(raw.hidden)) {
        const known = new Set(REGIONS.map((region) => region.key))
        state.hidden = [
          ...new Set(raw.hidden.filter((key) => typeof key === 'string' && known.has(key)))
        ]
      }

      // Foot toggles are keyed by the host registration id, which differs on
      // every profile. Only string ids with a boolean value are kept; ids that
      // no longer exist are pruned against the live registry at render time.
      if (raw.foot !== null && typeof raw.foot === 'object' && !Array.isArray(raw.foot)) {
        for (const [id, off] of Object.entries(raw.foot)) {
          if (typeof id !== 'string' || id.length === 0 || id.length > 120) continue
          if (Object.keys(state.foot).length >= 64) break
          if (off === true) state.foot[id] = true
        }
      }

      if (raw.gear !== null && typeof raw.gear === 'object') {
        if (
          typeof raw.gear.glyph === 'string' &&
          raw.gear.glyph !== '' &&
          raw.gear.glyph.length <= 8
        ) {
          state.gear.glyph = raw.gear.glyph
        }
        // Accept only a raster data URL whose payload fits the byte budget.
        // Comparing base64 character count against bytes (as this used to do)
        // let a 1.4x oversized blob through; the decoder expands 4 chars to 3
        // bytes, so the payload is measured here and the format is a fixed
        // allow-list instead of any `data:image/*` (svg+xml included).
        if (typeof raw.gear.image === 'string' && IMAGE_MIME.test(raw.gear.image)) {
          const body = raw.gear.image.length - raw.gear.image.indexOf(',') - 1
          const decoded = Math.floor((body * 3) / 4)
          if (decoded <= MAX_IMAGE_BYTES) state.gear.image = raw.gear.image
        }
        if (raw.gear.size !== undefined) state.gear.size = clampNumber('gearSize', raw.gear.size)
        state.gear.x = clampPercent(raw.gear.x, state.gear.x)
        state.gear.y = clampPercent(raw.gear.y, state.gear.y)
      }

      if (typeof raw.lang === 'string' && LANGS.includes(raw.lang)) state.lang = raw.lang
      // Strict boolean: a stored "true"/1/"yes" is distrusted rather than
      // coerced, so a hand-edited storage value can never switch the layout on.
      if (raw.compactTop === true) state.compactTop = true
      return state
    }

    const loadState = () => {
      try {
        const text = window.localStorage.getItem(STORAGE_KEY)
        if (text === null) return emptyState()
        return normalizeState(JSON.parse(text))
      } catch {
        return emptyState()
      }
    }

    const saveState = (state) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        /* storage unavailable: keep the in-memory value, the UI still applies */
      }
    }

    const createStore = (initial, persist) => {
      let snapshot = initial
      const listeners = new Set()
      return {
        get: () => snapshot,
        set(next) {
          snapshot = next
          if (persist !== null) persist(next)
          for (const listener of [...listeners]) listener()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        }
      }
    }

    const resolveLabel = (label, fallback) => {
      try {
        const value = typeof label === 'function' ? label() : label
        if (typeof value === 'string' && value.trim() !== '') return value
      } catch {
        /* a throwing label must not break the dock strip */
      }
      return fallback
    }

    const placementOf = (state, id) => {
      const mode = state.place[id]
      return mode === 'dock' || mode === 'hidden' ? mode : 'sidebar'
    }

    const isHidden = (state, key) => state.hidden.includes(key)

    // -----------------------------------------------------------------
    // Stylesheet
    // -----------------------------------------------------------------

    const buildCss = (state, panels) => {
      /**
       * Every number that reaches the stylesheet passes through here.
       *
       * The clamps live in `normalizeState`, but this function is the single
       * place a value is interpolated into CSS text; re-checking the range here
       * means a field added later without a clamp degrades to the fallback
       * instead of appending arbitrary text to the page stylesheet.
       */
      const px = (key) => {
        const spec = LIMITS[key]
        const raw = state.font[key] === undefined ? spec.fallback : state.font[key]
        const value = Number(raw)
        if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
          return `${spec.fallback}px`
        }
        return `${value}px`
      }
      const gap = Number(state.rowGap)
      const gapPx = Number.isFinite(gap)
        ? `${Math.min(LIMITS.rowGap.max, Math.max(LIMITS.rowGap.min, gap))}px`
        : `${LIMITS.rowGap.fallback}px`

      const typography = `
:root {
  --uidock-panel-fs: ${px('panelFont')};
  --uidock-panel-lh: ${px('panelLine')};
  --uidock-panel-row: ${px('panelRow')};
  --uidock-session-fs: ${px('sessionFont')};
  --uidock-session-lh: ${px('sessionLine')};
  --uidock-session-row: ${px('sessionRow')};
  --uidock-row-gap: ${gapPx};
}

/* Panel list rows. The host row is padding-block 7px + line-height 22px, which
   equals its min-height 36px, so neutralizing the block padding is what makes
   the row-height setting reachable at all. */
[data-slot="sidebar"] nav button {
  font-size: var(--uidock-panel-fs) !important;
  line-height: var(--uidock-panel-lh) !important;
  min-height: var(--uidock-panel-row) !important;
  height: var(--uidock-panel-row) !important;
  padding-block: 0 !important;
  padding-inline: 8px !important;
  box-sizing: border-box !important;
}
[data-slot="sidebar"] nav > * {
  margin-block: calc(var(--uidock-row-gap) / 2);
}

/* Sidebar foot: settings trigger, plugin-market row, memory, account row and
   footer actions. These sit in sidebar.settings and sidebar.footer.action,
   which are NOT inside nav — the reason they used to ignore every stepper. */
[data-slot="sidebar.settings"] button,
[data-slot="sidebar.settings"] [role="button"],
[data-slot="sidebar.footer.action"] button,
[data-slot="sidebar.panellist.actions"] button {
  font-size: var(--uidock-panel-fs) !important;
  line-height: var(--uidock-panel-lh) !important;
  min-height: var(--uidock-panel-row) !important;
  padding-block: 0 !important;
  box-sizing: border-box !important;
}
[data-slot="sidebar.settings"] button,
[data-slot="sidebar.settings"] [role="button"] {
  height: var(--uidock-panel-row) !important;
}

/* Session and workspace rows: height on the row, text metrics on its text. */
[data-slot="sidebar"] [role="treeitem"] {
  height: var(--uidock-session-row) !important;
  min-height: var(--uidock-session-row) !important;
}
[data-slot="sidebar"] [role="treeitem"] * {
  font-size: var(--uidock-session-fs) !important;
  line-height: var(--uidock-session-lh) !important;
}
[data-slot="sidebar"] [role="treeitem"] + [role="treeitem"] {
  margin-top: calc(var(--uidock-row-gap) / 2);
}

/* The placement segmented control draws no resting outline (see styles.segment);
   the selection is carried by fill + accent border only. Keyboard users still
   need a visible focus indicator, so the ring is restored strictly for
   :focus-visible — a mouse click never leaves a box behind. */
[data-uidock-card] button:focus {
  outline: none !important;
}
[data-uidock-card] button:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid
    var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)) !important;
  outline-offset: 1px !important;
}

/* Rows moved out of the left column. The marker attribute is written by our
   own shadow registration for that panel, and the rule built in buildCss
   selects exactly the row that contains it. Matching the registration id this
   way is the only key that survives both hazards found on a real profile: the
   host resolves the aria-label attribute through its locale dictionaries (so a rule
   built from the raw options.label never matches), and it drops the rows of
   unpinned panels while keeping their registrations (so a positional rule
   hides the wrong row). */

/* Sidebar-foot entries switched off from this panel. Same mechanism: our own
   shadow registration inside the foot slot writes the marker, and only that
   cell disappears — the settings trigger and every other foot entry stay. */
[data-slot="sidebar.settings"] [data-uidock-id],
[data-slot="sidebar.footer.action"] [data-uidock-id] {
  display: none !important;
}
${state.compactTop === true ? COMPACT_TOP_CSS : ''}`

      const regionRules = REGIONS.filter((region) => isHidden(state, region.key)).map(
        (region) => region.css
      )

      /**
       * Panels removed from the left column.
       *
       * The rule matches our own shadow marker, which carries the host
       * registration id. This is the mechanism that was verified on a real
       * profile, and two later rewrites both failed exactly the way the user
       * reported: the host resolves `aria-label` through its locale
       * dictionaries (so a rule built from the raw `options.label` never
       * matches), and it drops the rows of unpinned panels while keeping their
       * registrations (so a positional rule hides the wrong row). The id is the
       * only key both sides agree on, and the marker carries it.
       */
      const hiddenPanelRules = [...panels.values()]
        .filter((panel) => placementOf(state, panel.id) !== 'sidebar')
        .map((panel) => `[data-slot="sidebar"] nav button:has([data-uidock-id="${panel.id}"])`)
      const hiddenPanelBlock =
        hiddenPanelRules.length === 0
          ? ''
          : `${hiddenPanelRules.join(',\n')}{display:none!important}`

      return [typography, hiddenPanelBlock, regionRules.join('\n')]
        .filter((part) => part !== '')
        .join('\n\n')
        .trim()
    }

    /**
     * How many panel rows the sidebar actually renders right now.
     *
     * The host drops rows for panels that are unpinned, so the registry size is
     * NOT the row count. Reading the live count is the only way to know whether
     * a position-based rule still addresses the intended row. Returns `null`
     * when the sidebar is not in the document yet, which makes callers emit no
     * position rule at all instead of guessing.
     *
     * Deliberately scoped to one known subtree with a plain child selector:
     * this runs on the reconcile path, so it must stay cheap and must never
     * become a document-wide `:has()` scan.
     */
    const installStyleTag = (id) => {
      let tag = document.querySelector(`style[data-plugin-css="${id}"]`)
      if (tag === null) {
        tag = document.createElement('style')
        tag.dataset.plugin = PACKAGE_ID
        tag.dataset.pluginCss = id
        document.head.appendChild(tag)
      }
      return tag
    }

    // -----------------------------------------------------------------
    // The one exported module
    // -----------------------------------------------------------------

    return {
      // `slots` and `layout` are required; `locale` is read as an optional
      // service so a profile without it still gets the whole UI.
      inject: ['slots', 'layout'],
      apply(ctx) {
        const stateStore = createStore(loadState(), saveState)
        const panelsStore = createStore(new Map(), null)

        const styleTag = installStyleTag(STYLE_ID)
        const gridTag = installStyleTag(GRID_STYLE_ID)

        ctx.effect(
          () => {
            const locale = ctx.get('locale')
            if (locale === undefined || locale === null) return () => {}
            const offDictionary = locale.register(NS, { zh: zhDict, en: enDict })
            /**
             * Re-capture when the interface language changes.
             *
             * The host re-resolves panel labels on a locale switch (the sidebar
             * subscribes to `locale` and re-runs its panel snapshot), so the
             * labels this plugin stored at apply() time go stale. The hide rules
             * are keyed on those labels, so without this subscription a
             * language switch would leave every stored hide matched against an
             * aria-label the host no longer renders — the row reappears while
             * the stored choice still says "hidden".
             */
            let offLocale = () => {}
            if (typeof locale.subscribe === 'function') {
              offLocale = locale.subscribe(() => {
                requestSync()
              })
            }
            return () => {
              offDictionary()
              offLocale()
            }
          },
          `${PACKAGE_ID}: dictionaries`
        )

        ctx.effect(
          () => () => {
            styleTag.remove()
            gridTag.remove()
          },
          `${PACKAGE_ID}: stylesheets`
        )

        /**
         * Read the RAW ledger of one slot — every registration, including our
         * own shadows.
         *
         * This must be `entries`, never `entriesOfSlot`: the latter projects
         * only the winning entry of each cell, so once a shadow wins the cell
         * the original row is invisible to this plugin, the switch for it
         * disappears from the panel, and nothing can ever restore it. `entries`
         * is the documented inspection surface and keeps both sides visible.
         * When the host exposes no raw view the feature is disabled with a
         * notice rather than silently built on the lossy projection.
         */
        const readRawEntries = (slotKey) => {
          try {
            if (typeof ctx.slots.entries === 'function') {
              const rows = ctx.slots.entries(slotKey)
              return Array.isArray(rows) ? rows : []
            }
            return null
          } catch {
            return null
          }
        }

        /** True when the host offers the raw ledger this plugin depends on. */
        const hasRawLedger = () =>
          typeof ctx.slots.entries === 'function'

        /**
         * Which ids this plugin currently shadows, kept on our own side.
         *
         * Ownership must never be inferred from a negative priority. A
         * dynamically installed package receives `-1, -2, -3…` from its own
         * runner, so "priority < 0" also describes a real marketplace panel
         * icon. Filtering on it hides that icon from the placement list, where
         * the user could otherwise bring it back. The set below is written only
         * by this plugin, so it is the one honest ownership signal.
         */
        const shadowedCells = new Set()

        /**
         * Whether an entry is this plugin's own shadow marker.
         *
         * Identified by the exact private rank, never by the sign of the
         * priority and never by a mutable Set:
         * - Sign: the dynamic package runner hands third-party installs
         *   `-1, -2, -3…`, so "priority < 0" also describes a real marketplace
         *   row, which would then vanish from the placement list.
         * - Set: `register()` synchronously notifies subscribers, so the lookup
         *   runs again BEFORE the owning Set has been updated. The fresh shadow
         *   sorts ahead of the real row (lowest priority renders first) and its
         *   empty label lands in the store; the next pass restores the real
         *   label, each pass queues another reconcile, and the sidebar foot
         *   flickers every frame. The rank is immutable data, so it cannot
         *   race with registration order.
         */
        const isOwnShadow = (options) =>
          options !== undefined && options !== null && options.priority === SHADOW_PRIORITY

        const capturePanels = () => {
          const rows = readRawEntries('sidebar.panellist')
          if (rows === null) return
          const next = new Map()
          for (const entry of rows) {
            const options = entry === null || entry === undefined ? undefined : entry.options
            const id = options === undefined ? undefined : options.id
            if (typeof id !== 'string') continue
            // Only this plugin's own marker is skipped; a third-party row is
            // kept no matter which priority the host handed it.
            if (isOwnShadow(options)) continue
            if (next.has(id)) continue
            next.set(id, {
              id,
              order: Number(options.order) || 0,
              label: resolveLabel(options.label, id)
            })
          }
          const previous = panelsStore.get()
          const sameContent =
            previous.size === next.size &&
            [...next.values()].every((panel) => {
              const before = previous.get(panel.id)
              return (
                before !== undefined && before.label === panel.label && before.order === panel.order
              )
            })
          if (!sameContent) {
            panelsStore.set(next)
            // Only a capture triggered from outside a rebuild may schedule
            // another pass. A capture running inside `rebuild()` describes the
            // ledger this pass just changed; scheduling from there would feed
            // the loop the user sees as flicker.
            if (!inSync) requestSync()
          }
        }

        /**
         * The sidebar foot is two slots: `sidebar.footer.action` (a list, one
         * cell per registered id — the cost meter, the plugin market, memory,
         * …) and `sidebar.settings` (a single cell — the account row). Both are
         * enumerated live so the switches describe what this profile actually
         * has, never a hardcoded list from the author's machine.
         */
        const footStore = createStore(new Map(), null)

        const captureFoot = () => {
          const next = new Map()
          for (const slotKey of ['sidebar.footer.action', 'sidebar.settings']) {
            const rows = readRawEntries(slotKey)
            if (rows === null) continue
            for (const entry of rows) {
              const options = entry === null || entry === undefined ? undefined : entry.options
              const id = options === undefined ? undefined : options.id
              if (typeof id !== 'string') continue
              // See capturePanels: ownership is the immutable private rank,
              // never a mutable Set and never the sign of the priority.
              if (isOwnShadow(options)) continue
              const cell = `${slotKey}#${id}`
              if (next.has(cell)) continue
              next.set(cell, {
                cell,
                slotKey,
                id,
                order: Number(options.order) || 0,
                label: resolveLabel(options.label, id)
              })
            }
          }
          const previous = footStore.get()
          const sameContent =
            previous.size === next.size &&
            [...next.values()].every((item) => {
              const before = previous.get(item.cell)
              return before !== undefined && before.label === item.label && before.order === item.order
            })
          if (!sameContent) {
            footStore.set(next)
            // See capturePanels: never re-feed the loop from inside a rebuild.
            if (!inSync) requestSync()
          }
        }

        /**
         * `layout.selectPanel` throws for an id with no `main` registration, so
         * the click is guarded and a pill is disabled when the id is known to be
         * unselectable. An unreadable registry allows the click and lets the
         * guarded call decide.
         */
        const canSelectPanel = (id) => {
          try {
            const entries =
              typeof ctx.slots.entries === 'function' ? ctx.slots.entries('main') ?? [] : []
            if (entries.length === 0) return true
            return entries.some((entry) => {
              const options = entry === null || entry === undefined ? undefined : entry.options
              return options !== undefined && options.key === id
            })
          } catch {
            return true
          }
        }

        const selectPanel = (id) => {
          try {
            ctx.layout.selectPanel(id)
          } catch {
            /* an id without a main panel: never throw out of a click handler */
          }
        }

        /** cell -> { dispose, slotKey, id } for the shadows owned right now. */
        const shadowHandles = new Map()
        /** Serialized state whose stylesheet was last written. */
        let lastStyleKey = null
        /** Shadows the host refused; the panel reports them instead of lying. */
        let failedCells = []

        const ShadowMark = ({ id }) =>
          h('span', { 'data-uidock-id': id, 'data-uidock-marker': id, 'aria-hidden': 'true', style: { display: 'none' } })

        /**
         * Reconcile the frame's grid tracks with the hidden columns.
         *
         * The frame's `grid-template-columns` is an inline style, so hiding a
         * column with `display:none` alone leaves its track reserved. The
         * override goes into its own style tag, cleared first so the measured
         * values are the host's own ones.
         */
        let gridFrame = null
        let gridApplied = null
        const findFrame = () => {
          if (gridFrame !== null && gridFrame.isConnected !== false) return gridFrame
          const overlay = document.querySelector('[data-shell-overlay]')
          gridFrame = overlay === null ? null : overlay.parentElement
          return gridFrame
        }

        const syncGridTracks = () => {
          try {
            const state = stateStore.get()
            const hideSide = isHidden(state, 'sidebar')
            const hideRight = isHidden(state, 'rightbar')
            const signature = `${hideSide ? 1 : 0}${hideRight ? 1 : 0}`
            if (signature === gridApplied) return
            gridApplied = signature
            if (!hideSide && !hideRight) {
              gridTag.textContent = ''
              return
            }
            const frame = findFrame()
            if (frame === null) {
              gridApplied = null
              gridTag.textContent = ''
              return
            }
            gridTag.textContent = ''
            const parts = String(window.getComputedStyle(frame).gridTemplateColumns)
              .trim()
              .split(/\s+/)
            if (parts.length !== 3) {
              gridApplied = null
              gridTag.textContent = ''
              return
            }
            const left = hideSide ? '0px' : parts[0]
            const right = hideRight ? '0px' : parts[2]
            // Written once per signature change, never re-evaluated per rebuild.
            gridTag.textContent =
              `*:has(> [data-shell-overlay]){grid-template-columns:${left} minmax(0px, 1fr) ${right}!important}`
          } catch {
            gridApplied = null
            gridTag.textContent = ''
          }
        }

        /**
         * Schedule one reconciliation, deferred to the next animation frame.
         *
         * Two different concerns meet here:
         *
         * 1. Correctness — the sidebar declares its slots *after* this plugin
         *    applies. Without a link from "registry changed" to "apply my
         *    stored choices", a refreshed page shows the row again while the
         *    panel still claims it is hidden. Captures therefore request a
         *    reconcile.
         *
         * 2. First paint — this bundle is loaded with `immediately: true`, i.e.
         *    during startup. A profile registers dozens of slots and every one
         *    of them fires a capture. Reconciling synchronously in a microtask
         *    meant dozens of stylesheet rebuilds plus layout-forcing reads
         *    before the shell could mount; the host then reported
         *    "timed out waiting for page load and UI mount" with no JS error.
         *    Deferring to `requestAnimationFrame` lets the page paint first and
         *    collapses the burst into a single pass.
         */
        let syncQueued = false
        let inSync = false
        let disposed = false
        const canAnimate = typeof window.requestAnimationFrame === 'function'

        const requestSync = () => {
          if (inSync || syncQueued || disposed) return
          syncQueued = true
          const run = () => {
            syncQueued = false
            if (disposed) return
            sync()
          }
          if (canAnimate) window.requestAnimationFrame(run)
          else queueMicrotask(run)
        }

        const sync = () => {
          inSync = true
          try {
            rebuild()
          } catch {
            /* a reconcile must never escape into the host's render cycle */
          } finally {
            inSync = false
          }
        }

        /**
         * Reconcile in place: apply the stylesheet, then adjust shadows to the
         * set that should be hidden right now.
         *
         * The previous version disposed every shadow and re-registered all of
         * them on each pass. Each register/dispose pair mutates the host
         * ledger and fires its subscribers, so one unrelated change cost dozens
         * of host round-trips during boot. Reconcile only the difference.
         */
        const rebuild = () => {
          // Capture BEFORE the stylesheet is built: the hide rules are keyed on
          // the labels the host resolved for each panel, so a pass that builds
          // the stylesheet from a stale (or still empty) capture emits no rules
          // at all — which is exactly how a stored hide looked like "the click
          // does nothing" on the very first pass after apply().
          capturePanels()
          captureFoot()

          const state = stateStore.get()
          // The stylesheet depends on state AND the observed panel labels, so
          // it is rebuilt when either actually differs — not on every registry
          // pass. `panels` is part of the key because a panel that appears later
          // must get its rule without a second unrelated change.
          const stateKey = `${JSON.stringify(state)}|${[...panelsStore.get().values()].map((panel) => panel.label).join('\u0000')}`
          if (stateKey !== lastStyleKey) {
            lastStyleKey = stateKey
            styleTag.textContent = buildCss(state, panelsStore.get())
          }

          /** cell -> disposer for shadows this plugin owns right now */
          const wanted = new Map()
          for (const panel of panelsStore.get().values()) {
            if (placementOf(state, panel.id) === 'sidebar') continue
            wanted.set(`sidebar.panellist#${panel.id}`, {
              slotKey: 'sidebar.panellist',
              id: panel.id,
              order: panel.order,
              label: panel.label,
              marker: panel.id
            })
          }
          for (const item of footStore.get().values()) {
            if (state.foot[item.cell] !== true) continue
            wanted.set(item.cell, {
              slotKey: item.slotKey,
              id: item.id,
              order: item.order,
              label: item.label,
              marker: `foot:${item.id}`
            })
          }

          failedCells = []

          // Drop shadows that are no longer wanted (user restored the row).
          //
          // Keep this simple and unconditional. An earlier revision tried to
          // verify the release against the ledger and retry on a bounded
          // budget; it left the handle attached to a registration it could not
          // confirm, and the retry loop starved the card it lives in —「左侧」
          // and「隐藏」stopped working entirely. A disposer that throws is
          // still a disposer that was called: dispose() removes the
          // registration from the host ledger before it can throw.
          for (const [cell, handle] of [...shadowHandles]) {
            if (wanted.has(cell)) continue
            try {
              handle.dispose()
            } catch {
              /* the owning declaration already collapsed */
            }
            shadowHandles.delete(cell)
            shadowedCells.delete(cell)
          }

          // Add only the shadows that are missing.
          for (const [cell, spec] of wanted) {
            if (shadowHandles.has(cell)) continue
            try {
              const dispose = ctx.slots.inject(spec.slotKey, () =>
                ctx.slots.register(
                  {
                    name: spec.slotKey,
                    id: spec.id,
                    priority: SHADOW_PRIORITY,
                    order: spec.order,
                    // The host's own panel list resolves labels through
                    // `resolveSlotLabel` and sorts them; an empty string there
                    // makes the entry's title flip between "" and the real
                    // label as the winner changes. Reuse the original label so
                    // the ledger stays stable, and hide the row by our own
                    // marker attribute instead of by blanking its name.
                    label: spec.label
                  },
                  () => h(ShadowMark, { id: spec.marker })
                )
              )
              shadowHandles.set(cell, { dispose, slotKey: spec.slotKey, id: spec.id })
              shadowedCells.add(cell)
            } catch (error) {
              // Refused when the cell is occupied at this exact priority, or
              // while the slot is collapsing. Surface it instead of leaving a
              // switch that silently does nothing.
              failedCells.push({ cell, slotKey: spec.slotKey, id: spec.id, reason: String(error && error.message) })
            }
          }

          syncGridTracks()
        }

        ctx.effect(() => {
          const offState = stateStore.subscribe(requestSync)
          const offRegistry = ctx.slots.subscribe('sidebar.panellist', capturePanels)
          const offFootList = ctx.slots.subscribe('sidebar.footer.action', captureFoot)
          const offFootSettings = ctx.slots.subscribe('sidebar.settings', captureFoot)
          const onResize = () => syncGridTracks()
          window.addEventListener('resize', onResize)
          sync()
          return () => {
            disposed = true
            offState()
            offRegistry()
            offFootList()
            offFootSettings()
            window.removeEventListener('resize', onResize)
            for (const handle of shadowHandles.values()) {
              try {
                handle.dispose()
              } catch {
                /* ignore */
              }
            }
            shadowHandles.clear()
            shadowedCells.clear()
            gridTag.textContent = ''
          }
        }, `${PACKAGE_ID}: shadowed rows`)

        // --- Shared controls -------------------------------------------

        const useDockState = () => {
          const [state, setState] = useState(stateStore.get())
          useEffect(() => stateStore.subscribe(() => setState(stateStore.get())), [])
          return state
        }

        const usePanels = () => {
          const [panels, setPanels] = useState(panelsStore.get())
          useEffect(() => panelsStore.subscribe(() => setPanels(panelsStore.get())), [])
          return panels
        }

        const useFoot = () => {
          const [foot, setFoot] = useState(footStore.get())
          useEffect(() => footStore.subscribe(() => setFoot(footStore.get())), [])
          return foot
        }

        const patch = (mutate) => {
          const next = JSON.parse(JSON.stringify(stateStore.get()))
          mutate(next)
          stateStore.set(next)
        }

        /**
         * Silently update the stored gear position without a state broadcast.
         *
         * Dragging runs at pointer speed and every broadcast re-renders the
         * overlay, rebuilds the stylesheet and rewrites localStorage — the
         * reason the gear used to jump only after the pointer stopped. Here the
         * live position is written straight onto the element and only the
         * final coordinate is committed, once, on pointer-up.
         */
        const commitGearPosition = (x, y) => {
          const current = stateStore.get()
          if (current.gear.x === x && current.gear.y === y) return
          const next = JSON.parse(JSON.stringify(current))
          next.gear.x = x
          next.gear.y = y
          stateStore.set(next)
        }

        const toggleRegion = (key) => {
          patch((next) => {
            const hidden = new Set(next.hidden)
            if (hidden.has(key)) hidden.delete(key)
            else hidden.add(key)
            next.hidden = [...hidden]
          })
        }

        const applyPreset = (hidden) => {
          patch((next) => {
            next.hidden = [...hidden]
          })
        }

        const applyNumber = (key, value) => {
          patch((next) => {
            if (key === 'rowGap') next.rowGap = clampNumber('rowGap', value)
            else if (key === 'gearSize') next.gear.size = clampNumber('gearSize', value)
            else next.font[key] = clampNumber(key, value)
          })
        }

        const setPlace = (id, mode) => {
          patch((next) => {
            if (mode === 'sidebar') delete next.place[id]
            else next.place[id] = mode
          })
        }

        const setLanguage = (lang) => {
          let hostAccepted = false
          try {
            const locale = ctx.get('locale')
            if (locale === undefined || locale === null) throw new Error('no locale service')
            locale.setLocale(lang)
            hostAccepted = true
          } catch {
            hostAccepted = false
          }
          patch((next) => {
            next.lang = lang
          })
          return hostAccepted
        }

        /** Flip one sidebar-foot cell; everything else keeps its state. */
        const toggleFoot = (cell) => {
          patch((next) => {
            const foot = { ...next.foot }
            if (foot[cell] === true) delete foot[cell]
            else foot[cell] = true
            next.foot = foot
          })
        }

        /** Toggle the compact top row; the stylesheet rebuild carries it. */
        const toggleCompactTop = () => {
          patch((next) => {
            next.compactTop = next.compactTop !== true
          })
        }

        const Switch = ({ on, onToggle, label }) =>
          h(
            'button',
            {
              type: 'button',
              style: on ? { ...styles.switch, ...styles.switchOn } : styles.switch,
              role: 'switch',
              'aria-checked': on ? 'true' : 'false',
              'aria-label': label,
              onClick: onToggle
            },
            h('span', { style: on ? { ...styles.knob, ...styles.knobOn } : styles.knob })
          )

        const RegionToggle = ({ region, state, onToggle, t }) =>
          h(
            'div',
            {
              style: styles.toggleRow,
              role: 'button',
              tabIndex: 0,
              onClick: onToggle,
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onToggle()
                }
              }
            },
            h('span', { style: styles.toggleLabel }, t(region.labelKey)),
            h(Switch, {
              on: !isHidden(state, region.key),
              onToggle: (event) => {
                if (event !== undefined && event.stopPropagation) event.stopPropagation()
                onToggle()
              },
              label: t(region.labelKey)
            })
          )

        const Stepper = ({ label, value, step, min, max, onChange }) =>
          h(
            'div',
            { style: styles.stepper },
            h('span', { style: styles.stepperLabel }, label),
            h(
              'button',
              {
                type: 'button',
                style: value <= min ? { ...styles.stepButton, ...styles.stepButtonOff } : styles.stepButton,
                disabled: value <= min,
                'aria-label': `${label} -`,
                onClick: () => onChange(value - step)
              },
              '−'
            ),
            h('span', { style: styles.stepperValue }, String(value)),
            h(
              'button',
              {
                type: 'button',
                style: value >= max ? { ...styles.stepButton, ...styles.stepButtonOff } : styles.stepButton,
                disabled: value >= max,
                'aria-label': `${label} +`,
                onClick: () => onChange(value + step)
              },
              '+'
            )
          )

        // --- Overlay gear + control card -------------------------------

        function DockGear() {
          const state = useDockState()
          const panels = usePanels()
          const footItems = useFoot()
          const [open, setOpen] = useState(false)
          const [notice, setNotice] = useState(null)
          const t = makeT(state.lang)

          const overlayRef = useRef(null)
          const dragRef = useRef(null)
          const gearRef = useRef(null)

          // Drag the gear anywhere on the frame. The position is applied to the
          // element directly on every pointer move (no state round-trip, no
          // localStorage write, no stylesheet rebuild), and committed once on
          // pointer-up — so the gear tracks the pointer instead of snapping to
          // the target after release. A gesture under the threshold is a click
          // and toggles the panel.
          useEffect(() => {
            let raf = 0
            const flush = () => {
              raf = 0
              const drag = dragRef.current
              if (drag === null) return
              const node = gearRef.current
              if (node !== null) {
                node.style.left = `${drag.x}%`
                node.style.top = `${drag.y}%`
              }
            }
            const onMove = (event) => {
              const drag = dragRef.current
              if (drag === null) return
              const dx = event.clientX - drag.startX
              const dy = event.clientY - drag.startY
              if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return
              drag.moved = true
              if (drag.rect.width === 0 || drag.rect.height === 0) return
              drag.x = clampPercent(drag.originX + (dx / drag.rect.width) * 100, drag.originX)
              drag.y = clampPercent(drag.originY + (dy / drag.rect.height) * 100, drag.originY)
              if (raf === 0) raf = window.requestAnimationFrame(flush)
            }
            const finish = () => {
              const drag = dragRef.current
              if (drag === null) return
              dragRef.current = null
              if (raf !== 0) {
                window.cancelAnimationFrame(raf)
                raf = 0
              }
              if (!drag.moved) {
                setOpen((value) => !value)
                return
              }
              commitGearPosition(drag.x, drag.y)
            }
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', finish)
            window.addEventListener('pointercancel', finish)
            return () => {
              if (raf !== 0) window.cancelAnimationFrame(raf)
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', finish)
              window.removeEventListener('pointercancel', finish)
            }
          }, [])

          const onGearDown = (event) => {
            if (event.button !== undefined && event.button !== 0) return
            const element = overlayRef.current
            if (element === null) return
            const rect = element.getBoundingClientRect()
            if (rect.width === 0 || rect.height === 0) return
            try {
              if (event.currentTarget !== null && event.currentTarget.setPointerCapture) {
                event.currentTarget.setPointerCapture(event.pointerId)
              }
            } catch {
              /* pointer capture is a nicety; the window listeners still work */
            }
            dragRef.current = {
              startX: event.clientX,
              startY: event.clientY,
              originX: state.gear.x,
              originY: state.gear.y,
              x: state.gear.x,
              y: state.gear.y,
              rect,
              moved: false
            }
          }

          const docked = useMemo(() => {
            const rows = []
            for (const panel of panels.values()) {
              if (placementOf(state, panel.id) !== 'dock') continue
              rows.push(panel)
            }
            return rows.sort((a, b) => a.order - b.order)
          }, [state, panels])

          const pickImage = (event) => {
            const file = event.target.files === null ? null : event.target.files[0]
            if (file === undefined || file === null) return
            if (!String(file.type).startsWith('image/') || file.size > MAX_IMAGE_BYTES) {
              setNotice(t('gear.imageBad'))
              return
            }
            const reader = new FileReader()
            reader.onload = () => {
              const result = typeof reader.result === 'string' ? reader.result : ''
              // Same allow-list as the storage path: a raster format under the
              // byte budget. `file.type` alone is not enough — it is inferred
              // from the extension, so a renamed .svg would pass it.
              if (!IMAGE_MIME.test(result)) {
                setNotice(t('gear.imageBad'))
                return
              }
              const body = result.length - result.indexOf(',') - 1
              if (Math.floor((body * 3) / 4) > MAX_IMAGE_BYTES) {
                setNotice(t('gear.imageBad'))
                return
              }
              patch((next) => {
                next.gear.image = result
              })
              setNotice(null)
            }
            reader.onerror = () => setNotice(t('gear.imageBad'))
            reader.readAsDataURL(file)
            // Reset the input so picking the same file twice fires `change` again.
            event.target.value = ''
          }

          const cardSide = state.gear.x < 50 ? { left: '14px' } : { right: '14px' }
          const cardVertical = state.gear.y > 45 ? { bottom: '14px' } : { top: '14px' }

          // While a pointer gesture is running the live position exists only on
          // the element's inline style (see the drag effect). Any unrelated
          // re-render — a registry change, a notice, a font step — would write
          // the stale stored coordinates back through this style object and the
          // gear would jump home mid-drag until the next move corrected it.
          // During a drag the renderer therefore pins the value the DOM already
          // holds instead of the stored one.
          const drag = dragRef.current
          const liveX = drag === null ? state.gear.x : drag.x
          const liveY = drag === null ? state.gear.y : drag.y

          const gearStyle = {
            ...styles.gear,
            left: `${liveX}%`,
            top: `${liveY}%`,
            width: `${state.gear.size}px`,
            height: `${state.gear.size}px`,
            fontSize: `${Math.round(state.gear.size * 0.5)}px`,
            lineHeight: `${state.gear.size}px`
          }

          const dockOffset =
            state.gear.y > 45
              ? { bottom: `${Math.max(6, 100 - state.gear.y - 2)}%` }
              : { top: `${state.gear.y + 3}%` }

          const card =
            open === true
              ? h(
                  'div',
                  {
                    style: { ...styles.card, ...cardSide, ...cardVertical },
                    'data-uidock-card': 'card'
                  },
                  h(
                    'div',
                    { style: styles.head },
                    h('span', null, t('panel.title')),
                    h(
                      'button',
                      {
                        type: 'button',
                        style: { ...styles.stepButton, marginLeft: 'auto' },
                        'aria-label': t('gear.close'),
                        onClick: () => setOpen(false)
                      },
                      '×'
                    )
                  ),
                  h('span', { style: styles.note }, t('panel.note')),

                  h('span', { style: styles.groupTitle }, t('group.preset')),
                  h(
                    'div',
                    { style: styles.btnRow },
                    PRESETS.map((preset) =>
                      h(
                        'button',
                        {
                          key: preset.key,
                          type: 'button',
                          style: styles.smallBtn,
                          onClick: () => applyPreset(preset.hidden)
                        },
                        t(preset.labelKey)
                      )
                    )
                  ),

                  h('span', { style: styles.groupTitle }, t('group.region')),
                  REGIONS.map((region) =>
                    h(RegionToggle, {
                      key: region.key,
                      region,
                      state,
                      t,
                      onToggle: () => toggleRegion(region.key)
                    })
                  ),

                  h('span', { style: styles.groupTitle }, t('group.language')),
                  h(
                    'div',
                    { style: styles.btnRow },
                    LANGS.map((lang) =>
                      h(
                        'button',
                        {
                          key: lang,
                          type: 'button',
                          'data-uidock-lang': lang,
                          style:
                            state.lang === lang
                              ? { ...styles.smallBtn, ...styles.smallBtnOn }
                              : styles.smallBtn,
                          onClick: () => {
                            const accepted = setLanguage(lang)
                            setNotice(accepted ? t('lang.hostOk') : t('lang.hostFail'))
                          }
                        },
                        t(`lang.${lang}`)
                      )
                    )
                  ),
                  notice === null ? null : h('span', { style: styles.note }, notice),
                  failedCells.length === 0
                    ? null
                    : h(
                        'span',
                        { style: styles.note, 'data-uidock-failed': String(failedCells.length) },
                        t('action.failed')
                      ),

                  h('span', { style: styles.groupTitle }, t('group.gear')),
                  h(
                    'div',
                    { style: styles.btnRow },
                    state.gear.image === null
                      ? GEAR_GLYPHS.map((glyph) =>
                          h(
                            'button',
                            {
                              key: glyph,
                              type: 'button',
                              style:
                                state.gear.glyph === glyph
                                  ? { ...styles.smallBtn, ...styles.smallBtnOn }
                                  : styles.smallBtn,
                              onClick: () =>
                                patch((next) => {
                                  next.gear.glyph = glyph
                                  next.gear.image = null
                                })
                            },
                            glyph
                          )
                        )
                      : h(
                          'button',
                          {
                            type: 'button',
                            style: styles.smallBtn,
                            onClick: () =>
                              patch((next) => {
                                next.gear.image = null
                              })
                          },
                          t('gear.imageClear')
                        ),
                    h(
                      'label',
                      {
                        style: {
                          ...styles.smallBtn,
                          display: 'inline-flex',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }
                      },
                      t('gear.imagePick'),
                      h('input', {
                        type: 'file',
                        accept: 'image/*',
                        style: { display: 'none' },
                        onChange: pickImage
                      })
                    )
                  ),
                  h(Stepper, {
                    label: t('gear.size'),
                    value: state.gear.size,
                    step: LIMITS.gearSize.step,
                    min: LIMITS.gearSize.min,
                    max: LIMITS.gearSize.max,
                    onChange: (value) => applyNumber('gearSize', value)
                  }),
                  h('span', { style: styles.note }, t('gear.draggable')),

                  h('span', { style: styles.groupTitle }, t('group.position')),
                  h(
                    'div',
                    { style: styles.btnRow },
                    CORNERS.map((corner) =>
                      h(
                        'button',
                        {
                          key: corner.key,
                          type: 'button',
                          style: styles.smallBtn,
                          onClick: () =>
                            patch((next) => {
                              next.gear.x = corner.x
                              next.gear.y = corner.y
                            })
                        },
                        t(`corner.${corner.key}`)
                      )
                    )
                  ),

                  h('span', { style: styles.groupTitle }, t('group.foot')),
                  h('span', { style: styles.note }, t('foot.note')),
                  footItems.size === 0
                    ? h('span', { style: styles.note }, t('foot.empty'))
                    : [...footItems.values()]
                        .sort((a, b) => {
                          if (a.slotKey !== b.slotKey) {
                            return a.slotKey === 'sidebar.settings' ? -1 : 1
                          }
                          if (a.order !== b.order) return a.order - b.order
                          return a.label.localeCompare(b.label)
                        })
                        .map((item) =>
                          h(
                            'div',
                            {
                              key: item.cell,
                              style: styles.toggleRow,
                              'data-uidock-foot-row': item.cell
                            },
                            h('span', { style: styles.toggleLabel }, item.label),
                            h(Switch, {
                              on: state.foot[item.cell] !== true,
                              onToggle: () => toggleFoot(item.cell),
                              label: item.label
                            })
                          )
                        ),

                  h('span', { style: styles.groupTitle }, t('group.typography')),
                  h(
                    'div',
                    {
                      style: styles.toggleRow,
                      'data-uidock-compact': state.compactTop === true ? 'on' : 'off'
                    },
                    h(
                      'span',
                      { style: styles.toggleLabel },
                      t('compact.label')
                    ),
                    h(Switch, {
                      on: state.compactTop === true,
                      onToggle: toggleCompactTop,
                      label: t('compact.label')
                    })
                  ),
                  h('span', { style: styles.note }, t('compact.note')),
                  FONT_KEYS.map((key) =>
                    h(Stepper, {
                      key,
                      label: t(FONT_LABEL_KEYS[key]),
                      value: state.font[key] === undefined ? LIMITS[key].fallback : state.font[key],
                      step: LIMITS[key].step,
                      min: LIMITS[key].min,
                      max: LIMITS[key].max,
                      onChange: (value) => applyNumber(key, value)
                    })
                  ),
                  h(Stepper, {
                    label: t('font.rowGap'),
                    value: state.rowGap,
                    step: LIMITS.rowGap.step,
                    min: LIMITS.rowGap.min,
                    max: LIMITS.rowGap.max,
                    onChange: (value) => applyNumber('rowGap', value)
                  }),

                  h('span', { style: styles.groupTitle }, t('group.placement')),
                  panels.size === 0
                    ? h('span', { style: styles.note }, t('placement.empty'))
                    : [...panels.values()]
                        .sort((a, b) => a.order - b.order)
                        .map((panel) =>
                          h(
                            'div',
                            { key: panel.id, style: styles.placeRow },
                            h('span', { style: styles.placeLabel }, panel.label),
                            h(
                              'div',
                              { style: styles.segmented },
                              MODES.map((mode) =>
                                h(
                                  'button',
                                  {
                                    key: mode,
                                    type: 'button',
                                    style:
                                      placementOf(state, panel.id) === mode
                                        ? { ...styles.segment, ...styles.segmentActive }
                                        : styles.segment,
                                    onClick: () => setPlace(panel.id, mode)
                                  },
                                  t(`placement.${mode}`)
                                )
                              )
                            )
                          )
                        ),

                  h(
                    'div',
                    { style: styles.btnRow },
                    h(
                      'button',
                      {
                        type: 'button',
                        style: styles.smallBtn,
                        onClick: () => {
                          stateStore.set(normalizeState(null))
                          setNotice(null)
                        }
                      },
                      t('action.reset')
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        style: styles.smallBtn,
                        title: t('gear.hint'),
                        onClick: () => setOpen(false)
                      },
                      t('gear.collapse')
                    )
                  )
                )
              : null

          return h(
            'div',
            { style: styles.overlay, 'data-uidock-overlay': 'overlay', ref: overlayRef },
            h(
              'button',
              {
                type: 'button',
                style: gearStyle,
                'aria-label': t('gear.open'),
                'aria-expanded': open ? 'true' : 'false',
                'data-uidock-gear': 'gear',
                ref: gearRef,
                onPointerDown: onGearDown,
                // Pointer is the primary path, but a keyboard user cannot
                // dispatch pointerdown; without this the only recovery entry
                // in the product is unreachable by Enter/Space.
                onKeyDown: (event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  setOpen((value) => !value)
                }
              },
              state.gear.image === null
                ? state.gear.glyph
                : h('img', { src: state.gear.image, alt: '', style: styles.gearImg })
            ),
            card,
            docked.length > 0 && open !== true
              ? h(
                  'div',
                  {
                    style: {
                      ...styles.dockBar,
                      left: state.gear.x < 50 ? '50%' : 'auto',
                      right: state.gear.x < 50 ? 'auto' : '50%',
                      ...dockOffset
                    },
                    'data-uidock-bar': 'bar'
                  },
                  docked.map((panel) =>
                    h(
                      'button',
                      {
                        key: panel.id,
                        type: 'button',
                        style: canSelectPanel(panel.id)
                          ? styles.pill
                          : { ...styles.pill, ...styles.pillOff },
                        disabled: !canSelectPanel(panel.id),
                        onClick: () => selectPanel(panel.id)
                      },
                      panel.label
                    )
                  )
                )
              : null
          )
        }

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register({ name: 'shell.overlay', id: GEAR_ID, order: 999 }, DockGear)
        )
      }
    }
  }
})
