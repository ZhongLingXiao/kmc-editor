// 动画数据类型定义

/** 精灵帧来源（工程目录内的相对路径） */
export interface SpriteSource {
  /** 相对工程根的路径，如 "sprites/stand/frame_0.png" */
  src: string;
  /** 在 sheet 内的 X 偏移（像素）；单帧/整图导入时为 0 */
  x: number;
  /** 在 sheet 内的 Y 偏移（像素）；单帧/整图导入时为 0 */
  y: number;
  /** 帧宽度（sheet 模式下为单帧宽，单帧模式为整图宽） */
  w: number;
  /** 帧高度（sheet 模式下为单帧高，单帧模式为整图高） */
  h: number;
}

/** 矩形框（碰撞箱、推挤框） */
export interface Box {
  /** 唯一 ID */
  id: string;
  /** 逻辑坐标 X（相对固定角色根点 Root，向右为正） */
  x: number;
  /** 逻辑坐标 Y（相对固定角色根点 Root，向上为正） */
  y: number;
  /** 宽度 */
  w: number;
  /** 高度 */
  h: number;
}

/** 命名发射点 */
export interface SpawnPoint {
  /** 唯一 ID */
  id: string;
  /** 发射点名称（如 sword_tip） */
  name: string;
  /** 逻辑坐标 X */
  x: number;
  /** 逻辑坐标 Y */
  y: number;
}

/** 一个动画元素（一帧画面） */
export interface AnimElement {
  /** 元素索引 */
  index: number;
  /** 精灵图来源 */
  sprite: SpriteSource;
  /** 停留时长（Tick 数） */
  duration: number;
  /** 精灵轴点 / Sprite Pivot：图片内对齐到固定角色根点 (0,0) 的像素坐标 */
  offset: { x: number; y: number };
  /** 受击框列表 */
  hurtboxes: Box[];
  /** 攻击框列表 */
  hitboxes: Box[];
  /** JC Box 列表（判定碰撞框，可用于弹反/精确判定等） */
  jcboxes: Box[];
  /** 命名发射点 */
  spawnPoints: SpawnPoint[];
}

/** 动画阶段名称：前摇、攻击判定、后摇 */
export type PhaseName = 'startup' | 'active' | 'recovery';

/**
 * 动画级阶段边界（Tick）。
 * 使用左闭右开区间：
 * startup=[0, activeStartTick)，active=[activeStartTick, activeEndTick)，
 * recovery=[activeEndTick, totalTicks)。
 */
export interface PhaseMarkers {
  /** 攻击判定开始 Tick（包含） */
  activeStartTick: number;
  /** 攻击判定结束 Tick（不包含） */
  activeEndTick: number;
}

/** 推挤框（按状态类型区分，不随帧变化） */
export interface PushboxSet {
  stand?: Box;
  crouch?: Box;
  air?: Box;
}

/** 编辑器元数据（随动画 JSON 保存，不影响引擎运行时） */
export interface EditorMetadata {
  /** 洋葱皮设置 */
  onionSkin: OnionSkinSettings;
  /** 图层显示开关 */
  showLayers: ShowLayers;
}

/** 完整动画数据 */
export interface AnimationData {
  /** 动画 ID */
  id: string;
  /** 动画名称 */
  name: string;
  /** 版本 */
  version: string;
  /** 总 Tick 数（自动计算） */
  totalTicks: number;
  /** 是否循环播放 */
  loop: boolean;
  /** 动画元素列表 */
  elements: AnimElement[];
  /** 前摇/攻击判定/后摇阶段边界（可选，未标定时省略） */
  phases?: PhaseMarkers;
  /** 推挤框 */
  pushbox: PushboxSet;
  /** 编辑器元数据（可选，旧文件可能没有） */
  editor?: EditorMetadata;
}

/** 编辑器工具 */
export type Tool =
  | 'select'
  | 'hurtbox'
  | 'hitbox'
  | 'jcbox'
  | 'pushbox'
  | 'spawnpoint'
  | 'anchor';

/** 图层显示控制 —— 字段列表的唯一数据源，新增/移除字段只改这里 */
export const SHOW_LAYER_KEYS = [
  'hurtbox',
  'hitbox',
  'jcbox',
  'pushbox',
  'spawnpoint',
  'onionSkin',
  'grid',
] as const
export type ShowLayerKey = (typeof SHOW_LAYER_KEYS)[number]
export type ShowLayers = Record<ShowLayerKey, boolean>

/** 洋葱皮设置 */
export interface OnionSkinSettings {
  /** 前帧数量 */
  prevFrames: number;
  /** 后帧数量 */
  nextFrames: number;
  /** 最近帧透明度 (0-1) */
  baseOpacity: number;
  /** 衰减率 (0-1)，每远一级乘以此值 */
  decayRate: number;
  /** 前帧颜色 */
  prevColor: string;
  /** 后帧颜色 */
  nextColor: string;
  /** 是否显示精灵图 */
  showSprite: boolean;
  /** 是否显示碰撞箱 */
  showBoxes: boolean;
}

/** 颜色配置 */
export const COLORS = {
  hurtbox: 'rgba(0, 120, 255, 0.3)',
  hurtboxBorder: 'rgba(0, 120, 255, 0.9)',
  hitbox: 'rgba(255, 40, 40, 0.3)',
  hitboxBorder: 'rgba(255, 40, 40, 0.9)',
  jcbox: 'rgba(255, 0, 255, 0.3)',
  jcboxBorder: 'rgba(255, 0, 255, 0.9)',
  pushbox: 'rgba(0, 200, 0, 0.2)',
  pushboxBorder: 'rgba(0, 200, 0, 0.7)',
  spawnpoint: 'rgba(255, 200, 0, 0.9)',
  anchor: 'rgba(180, 83, 9, 1)',
  grid: 'rgba(128, 128, 128, 0.15)',
  origin: 'rgba(255, 0, 0, 0.5)',
  onionPrev: 'rgba(0, 150, 255, 0.2)',
  onionNext: 'rgba(255, 80, 80, 0.2)',
  onionPrevBorder: 'rgba(0, 150, 255, 0.9)',
  onionNextBorder: 'rgba(255, 80, 80, 0.9)',
  phaseStartup: 'rgba(20, 184, 166, 0.55)',
  phaseStartupBorder: 'rgba(13, 148, 136, 0.95)',
  phaseActive: 'rgba(239, 68, 68, 0.62)',
  phaseActiveBorder: 'rgba(220, 38, 38, 0.95)',
  phaseRecovery: 'rgba(59, 130, 246, 0.55)',
  phaseRecoveryBorder: 'rgba(37, 99, 235, 0.95)',
} as const;
