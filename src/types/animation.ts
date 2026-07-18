// 动画数据类型定义

/** 精灵帧来源（单张 PNG） */
export interface SpriteSource {
  /** 原始文件路径/文件名，方便人工关联识别 */
  path: string;
  /** base64 data URL，引擎直接加载显示 */
  data: string;
  /** 图片宽度 */
  w: number;
  /** 图片高度 */
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

/** 图层显示控制 */
export interface ShowLayers {
  hurtbox: boolean;
  hitbox: boolean;
  jcbox: boolean;
  pushbox: boolean;
  spawnpoint: boolean;
  onionSkin: boolean;
  onionBoxes: boolean;
  grid: boolean;
}

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
  anchor: 'rgba(255, 255, 0, 1)',
  grid: 'rgba(128, 128, 128, 0.15)',
  origin: 'rgba(255, 0, 0, 0.5)',
  onionPrev: 'rgba(0, 150, 255, 0.2)',
  onionNext: 'rgba(255, 80, 80, 0.2)',
  onionPrevBorder: 'rgba(0, 150, 255, 0.9)',
  onionNextBorder: 'rgba(255, 80, 80, 0.9)',
} as const;
