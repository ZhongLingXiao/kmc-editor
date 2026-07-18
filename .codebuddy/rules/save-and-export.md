# 动画数据保存与导出规则

## 1. 数据分层

项目中的数据分两层，必须严格区分：

- **项目数据（`animation` 对象）**：导出到 JSON 文件，跨用户/会话共享。含 `id`/`name`/`version`/`totalTicks`/`loop`/`elements`/`pushbox`/`editor`。
- **编辑器态（store 顶层非 `animation` 字段）**：不导出，属于个人/会话状态。含偏好、UI、预览、画布视图、选中态等。

## 2. 编辑器态的三个边界

编辑器态字段必须明确**不进入**以下三处：

1. `animation` 对象 —— 不污染导出文件
2. zundo `partialize` —— 不进撤销历史
3. JSON 导出 —— 不写文件

例外：`editor.onionSkin` / `editor.showLayers` 通过 `syncMetadata()` 写入 `animation.editor`，随项目导出（视图偏好团队共享）。

## 3. 偏好持久化

- 个人偏好（如 `newFrameInheritBoxes`/`newFrameInheritOffset`、`frameListMode`、`previewLoop`、`playSpeed`）**不进项目文件**。
- 用 localStorage 跨会话持久化（zustand `persist` 中间件，独立于 `partialize`）。
- 会话态（`isPlaying`/`tool`/`selection`/画布视图）不持久化，每次重置。

## 4. 导出三出口统一

保存 / 另存为 / 导出下载三个出口必须统一通过 `buildExportData(animation, includeEditor)` 构建数据，确保：

- `totalTicks` 一致计算
- `saveEditorMetadata` 开关统一生效（关则剥离 `editor`）
- `showLayers` 规范化（剥离过期字段）

**禁止**任何出口直接 `JSON.stringify(animation)` 或 `{ ...animation, totalTicks }`，必须走 `buildExportData`。

## 5. 集合字段的单一数据源

集合型字段（如 `ShowLayers`）用常量数组作为字段列表的唯一来源：

```ts
export const SHOW_LAYER_KEYS = ['hurtbox', 'hitbox', ...] as const
export type ShowLayers = Record<(typeof SHOW_LAYER_KEYS)[number], boolean>
```

- 导入/导出用 `SHOW_LAYER_KEYS` 过滤（`normalizeShowLayers`），剥离过期字段、缺失补默认 `true`。
- **新增字段**：只加到常量数组 → 类型自动含、import/export 自动保留。
- **字段过期**：只从常量数组移除 → 类型自动不含、import 自动清理旧文件残留、export 自动不写。

不允许在 import/export 里硬编码字段名列表。

## 6. 不可变更新

所有 store action 必须构造全新对象/数组，**禁止就地修改**旧 state 引用，否则 zundo 撤销快照被污染导致 Ctrl+Z 失效。重点 action：

- `addBox` / `updateBox` / `removeBox`
- `addSpawnPoint` / `updateSpawnPoint` / `removeSpawnPoint`
- `duplicateFrame` / `moveFrame` / `insertFrame`

写法：每层 `map`/`filter`/展开创建新对象，不碰旧引用。

## 7. editor 元数据开关

偏好设置中「保存编辑器元数据」(`saveEditorMetadata`) 控制导出是否含 `editor` 字段：

- **开**（默认）：JSON 含 `editor`（洋葱皮/图层显示，团队共享视图设置）。
- **关**：JSON 为纯动画数据，引擎加载更干净。

该开关是编辑器态，本身不导出。

## 8. 新帧继承

两个独立偏好控制新帧继承行为（均在偏好设置弹窗，默认开）：

- `newFrameInheritOffset`：继承源帧轴点（序列帧视觉对齐）
- `newFrameInheritBoxes`：继承源帧碰撞箱与发射点

`loadSprite` 不覆盖现有 offset（首次载入 offset 为 0,0 时才设底部中心），避免覆盖继承或用户调整的轴点。
