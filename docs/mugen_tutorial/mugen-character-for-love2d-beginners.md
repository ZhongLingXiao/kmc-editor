# 给新人：从 MUGEN 角色系统到 Love2D 2D 横版鬼泣

> 这篇文档承接《mugen-input-for-love2d-beginners.md》，假设你已经读过输入系统文档。
>
> 输入文档讲了"玩家按了什么、怎么识别成招式"，这篇讲"角色本身长什么样、怎么动起来"。
>
> 阅读建议：从头到尾顺读，每一章都有图和代码。代码可以直接复制到 Love2D 里跑。

---

## 序章：这篇文档要解决什么问题

输入文档结束时，我们有了：
- 按键缓冲（记住玩家按了什么）
- 命令匹配（识别成波动拳、升龙拳等招式）
- 取消窗口（连段派生）
- trigger entry（完备的 -1 状态进入条件）

但有个问题：**角色本身从哪来？** `Player` 类的 `state`、`anim`、`x`/`y`、`hitbox` 这些东西怎么定义？存成什么文件？怎么加载？

MUGEN 经过 20 年发展，有一套成熟的角色文件格式。我们不全盘照搬——有些设计太老（如调色板），有些不适合鬼泣（如 SFF 打包）。但核心概念值得借鉴：

```
这篇文档讲三件事：
1. MUGEN 角色由哪些文件组成，各自干什么
2. 哪些值得借鉴，哪些要替代成更现代的格式
3. Love2D 怎么组织角色文件、怎么加载、怎么跑起来
```

---

## 第一章：角色文件结构

### 1.1 MUGEN 角色的 5 种文件

一个 MUGEN 角色是一个文件夹，里面 5 种文件各司其职：

```
characters/vergil/
├── Vergil.def     ← 入口文件：引用其他文件，声明角色基本信息
├── Vergil.cns     ← 常量+状态：角色数据(生命/速度) + 状态定义([Statedef])
├── Vergil.air     ← 动画：帧序列 + 碰撞框(Clsn)
├── Vergil.cmd     ← 命令：按键序列定义 + State -1(输入处理)
└── Vergil.sff     ← 精灵图：打包所有角色图片
```

各文件职责：

| 文件 | 扩展名 | 职责 | 对应概念 |
|---|---|---|---|
| 定义文件 | `.def` | 入口，引用其他文件，声明名字/作者 | 项目的 `main.lua` |
| 常量+状态 | `.cns` | 角色数值(生命/速度/尺寸) + 状态行为 | `config.lua` + `states/*.lua` |
| 动画 | `.air` | 帧序列 + 每帧的碰撞框 + 时间 | `animations/*.json` |
| 命令 | `.cmd` | 按键序列 + -1 状态 | `commands.lua` + `triggers_minus1.lua`（input 文档已讲） |
| 精灵图 | `.sff` | 打包所有图片 | `sprites/*.png` |

**关键点**：`.cmd` 文件的命令定义和 -1 状态部分，输入文档已经详细讲过。这篇文档专注剩下四个：`.def`、`.cns`、`.air`、`.sff`。

### 1.2 MUGEN 的 .def 文件

`.def` 是角色入口，声明角色基本信息并引用其他文件：

```ini
[Info]
name        = "Vergil"           ; 角色显示名
displayname = "Vergil"           ; 选择界面显示名
author      = "someone"          ; 作者
versiondate = 01,01,2020         ; 版本日期

[Files]
cmd      = Vergil.cmd            ; 命令文件
cns      = Vergil.cns            ; 常量+状态文件
sprite   = Vergil.sff            ; 精灵图文件
anim     = Vergil.air            ; 动画文件
sound    = Vergil.snd            ; 音效文件（本文不讲）

[Data]
life       = 1000                ; 生命值
attack     = 100                 ; 攻击力倍率
defence    = 100                 ; 防御力倍率
liedown.time = 60                ; 倒地恢复时间
```

`.def` 很简单，就是一个 INI 文件，列出角色信息和其他文件路径。

### 1.3 MUGEN 的 SFF 精灵系统（"组号"讲清楚）

用户提到 MUGEN 有"组号"，这是 SFF 文件的核心概念。

#### 什么是 SFF

SFF（Sprite File Format）是 MUGEN 的图片打包格式。把角色所有图片打包成一个 `.sff` 文件，用**组号(group)+图号(index)**二维索引：

```
SFF 文件内部：
┌──────────────────────────────────────┐
│  组号 0（站立动作）                    │
│    图号 0 → 站立第1帧                  │
│    图号 1 → 站立第2帧                  │
│    图号 2 → 站立第3帧                  │
│                                       │
│  组号 20（行走动作）                    │
│    图号 0 → 行走第1帧                  │
│    图号 1 → 行走第2帧                  │
│                                       │
│  组号 200（攻击1）                      │
│    图号 0 → 攻击第1帧                  │
│    图号 1 → 攻击第2帧                  │
└──────────────────────────────────────┘
```

动画文件 `.air` 通过组号图号引用图片：

```ini
; .air 文件里引用精灵图
[Begin Action 200]      ; 动画号 200（攻击1）
200,0, 0,0, 5           ; 组号200,图号0, 偏移x=0,y=0, 持续5帧
200,1, 0,0, 5           ; 组号200,图号1, 偏移0,0, 持续5帧
200,2, 0,0, 5           ; 组号200,图号2, ...
```

#### 为什么要组号图号

MUGEN 用组号图号有两个原因：

1. **图片复用**：同一张图可以被多个动画引用。比如站立动画的某帧和行走动画的某帧可能共用一张图，组号图号让它们指向同一张图，节省内存。
2. **打包管理**：20 年前磁盘空间宝贵，打包成一个文件比散落几十个 PNG 文件更省空间，加载也更快。

#### 调色板系统

SFF 还支持调色板（`.act` 文件）。一张图可以有多个调色板，实现"同一张图不同颜色"（比如玩家1红色 Vergil、玩家2蓝色 Vergil）：

```
精灵图（索引色）  +  调色板1（红）  →  红色 Vergil
                  +  调色板2（蓝）  →  蓝色 Vergil
                  +  调色板3（绿）  →  绿色 Vergil
```

#### 为什么鬼泣不需要这些

| SFF 特性 | 鬼泣需要吗 | 原因 |
|---|---|---|
| 组号图号索引 | ❌ | 用文件路径更直观，Love2D 自动缓存图片 |
| 打包成单文件 | ❌ | 散落 PNG 更利于版本管理（git diff 看得到改了哪张图） |
| 调色板 | ❌ | 鬼泣用真彩色 PNG，不需要索引色调色板。多颜色用着色器或独立图片 |
| 图片复用 | ✅ 但用路径实现 | 相同路径自动复用，不需要组号图号 |

**结论**：SFF 是 20 年前为节省内存设计的格式，现代游戏不需要。我们用外置 PNG + 路径引用替代。

### 1.4 MUGEN 的 .air 动画系统

`.air` 文件描述动画帧序列和碰撞框：

```ini
; 动画号 200（攻击1）
[Begin Action 200]
; 格式：组号,图号, 偏移X,偏移Y, 持续帧数, 翻转, 颜色
200,0, 0,0, 3, ,     ; 第1帧：组200图0，偏移(0,0)，持续3帧
200,1, 0,0, 4, ,     ; 第2帧：组200图1，偏移(0,0)，持续4帧
200,2, 0,0, 3, ,     ; 第3帧
Clsn2: 4              ; 受击框（Clsn2），4个矩形
  Clsn2[0] = -20,-90,20,0     ; 矩形(x1,y1,x2,y2)
  Clsn2[1] = -15,-100,15,-90
Clsn1: 1              ; 攻击框（Clsn1），1个矩形
  Clsn1[0] = 40,-80,80,-40
200,1, 0,0, 4, ,     ; 第2帧（带攻击框）
Clsn1Default: 1       ; 后续帧默认攻击框
  Clsn1[0] = 40,-80,80,-40
200,2, 0,0, 3, ,     ; 第3帧（继承默认攻击框）
```

关键概念：

| 概念 | 说明 |
|---|---|
| `Begin Action N` | 动画号 N，状态通过 `ChangeAnim` 切换到这个动画 |
| `组号,图号` | 引用 SFF 里的精灵图 |
| `偏移X,偏移Y` | 精灵图相对角色根点的偏移（轴点） |
| `持续帧数` | 这一帧停留几个 tick（-1 表示最后一帧停止） |
| `Clsn2` | 受击框（hurtbox），被攻击框打中时受伤 |
| `Clsn1` | 攻击框（hitbox），打中对手的判定区域 |
| `ClsnDefault` | 后续帧的默认碰撞框（不用每帧重复写） |

#### MUGEN 坐标系

```
        y 向下为正
        ▼
        ┌──────────────┐
        │              │
  x ←───┼──── 角色 ────┼───→ x 向右为正
        │      ●       │
        │     根点     │
        │     (0,0)    │
        └──────────────┘

  角色根点在脚底中心
  y 向下为正（和 Love2D 一致）
  偏移(0,0) = 图片轴点对齐到角色根点
  负 y = 向上（如 -90 表示头顶 90 像素处）
```

#### animelemtime 和 animtime

MUGEN 有两个时间触发器：

| 触发器 | 含义 | 例子 |
|---|---|---|
| `animelemtime(N)` | 当前动画第 N 帧已经播放了多久 | `animelemtime(3) >= 0` = 第3帧已开始 |
| `animtime` | 整个动画从开始到现在的时间 | `animtime = 10` = 动画播了10帧 |
| `animelemno(N)` | 第 N 帧时的动画元素号 | 用于检查当前是第几帧 |

这两个在 trigger entry（附录 F）里常用，比如"第3帧之后才能取消"。

### 1.5 我们的方案：JSON 动画格式

我们不用 `.air` + `.sff`，用 JSON + 外置 PNG。下面是推荐的数据格式。

#### 设计原则

1. **外置 PNG + 路径引用**：不打包，不 base64，散落 PNG 文件
2. **支持单张图和 sprite sheet**：一帧一文件 或 多帧打包一张大图
3. **JSON 描述帧序列**：比 .air 文本更结构化，易解析
4. **碰撞框随帧定义**：hitbox/hurtbox/jcbox 每帧可不同
5. **推挤框不放这里**：放角色 config（见 §1.6）
6. **坐标系 y 向下为正**：和 Love2D、MUGEN 一致

#### 动画 JSON 结构

```json
{
  "id": "attack_1",
  "name": "攻击1",
  "version": "1.0",
  "loop": false,
  "elements": [
    {
      "index": 0,
      "duration": 3,
      "sprite": {
        "type": "single",
        "path": "sprites/attack_1_00.png",
        "w": 120,
        "h": 140
      },
      "offset": { "x": -60, "y": -140 },
      "hurtboxes": [
        { "id": "h0", "x": -20, "y": -130, "w": 40, "h": 130 }
      ],
      "hitboxes": [],
      "jcboxes": [],
      "spawnPoints": []
    },
    {
      "index": 1,
      "duration": 4,
      "sprite": {
        "type": "single",
        "path": "sprites/attack_1_01.png",
        "w": 120,
        "h": 140
      },
      "offset": { "x": -60, "y": -140 },
      "hurtboxes": [
        { "id": "h0", "x": -20, "y": -130, "w": 40, "h": 130 }
      ],
      "hitboxes": [
        { "id": "a0", "x": 40, "y": -100, "w": 50, "h": 40 }
      ],
      "jcboxes": [],
      "spawnPoints": [
        { "id": "s0", "name": "sword_tip", "x": 80, "y": -80 }
      ]
    },
    {
      "index": 2,
      "duration": 3,
      "sprite": {
        "type": "single",
        "path": "sprites/attack_1_02.png",
        "w": 120,
        "h": 140
      },
      "offset": { "x": -60, "y": -140 },
      "hurtboxes": [
        { "id": "h0", "x": -20, "y": -130, "w": 40, "h": 130 }
      ],
      "hitboxes": [],
      "jcboxes": [],
      "spawnPoints": []
    }
  ]
}
```

#### 字段说明

**AnimationData（顶层）：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 动画唯一标识，状态通过 id 引用动画 |
| `name` | string | 人类可读的名字 |
| `version` | string | 版本号 |
| `loop` | bool | 是否循环播放（idle/walk 循环，攻击不循环） |
| `elements` | array | 帧序列 |

**AnimElement（每帧）：**

| 字段 | 类型 | 说明 |
|---|---|---|
| `index` | int | 帧索引（0 起） |
| `duration` | int | 停留 tick 数 |
| `sprite` | object | 精灵图来源 |
| `offset` | {x, y} | 图片轴点偏移（图片内对齐到角色根点的坐标） |
| `hurtboxes` | array | 受击框列表 |
| `hitboxes` | array | 攻击框列表 |
| `jcboxes` | array | 踩怪判定框列表 |
| `spawnPoints` | array | 命名发射点列表 |

**SpriteSource（精灵图来源，两种形式）：**

```json
// 形式1：单张 PNG
{
  "type": "single",
  "path": "sprites/attack_1_00.png",
  "w": 120,
  "h": 140
}

// 形式2：Sprite Sheet（多帧打包在一张大图里）
{
  "type": "sheet",
  "path": "sprites/vergil_atlas.png",
  "region": { "x": 0, "y": 0, "w": 120, "h": 140 },
  "w": 120,
  "h": 140
}
```

| 字段 | 说明 |
|---|---|
| `type` | `"single"` 单张图 或 `"sheet"` sprite sheet 截取 |
| `path` | 图片相对路径（相对角色文件夹） |
| `region` | sheet 模式下，在大图中的截取区域 {x, y, w, h} |
| `w`, `h` | 图片（或截取区域）的宽高 |

**两种形式的区别：**

```
形式1：单张 PNG（每帧一个文件）
  sprites/
  ├── idle_00.png      ← 帧0
  ├── idle_01.png      ← 帧1
  ├── idle_02.png      ← 帧2
  └── ...

  优点：git 友好（改一张图只 diff 一个文件），直观
  缺点：文件多，加载多次 IO

形式2：Sprite Sheet（多帧打包一张大图）
  sprites/
  └── vergil_atlas.png  ← 所有帧都在这张大图里
       ┌──┬──┬──┐
       │00│01│02│       region(0,0,120,140) → 帧0
       ├──┼──┼──┤       region(120,0,120,140) → 帧1
       │03│04│05│       region(240,0,120,140) → 帧2
       └──┴──┴──┘

  优点：一个文件，加载一次，GPU 友好（减少纹理切换）
  缺点：改一张图要重新打包，git diff 不直观
```

**推荐**：开发阶段用单张 PNG（git 友好），发布时用工具打包成 sprite sheet（性能优化）。JSON 格式两种都支持，运行时代码统一处理。

#### offset（轴点）详解

offset 是图片内对齐到角色根点的坐标：

```
角色根点 (0,0) 在脚底中心

图片（120x140）：
┌──────────────┐
│              │
│    精灵图    │  offset = {x: -60, y: -140}
│              │  含义：图片左上角放在 (-60, -140) 处
│              │  → 图片中心 x=0（对齐根点）
│              │  → 图片底部 y=0（对齐根点，脚踩地）
└──────────────┘
↑               ↑
图片左上角       角色根点(0,0)
在 (-60,-140)
```

#### Box（碰撞框/发射点）

```json
{ "id": "h0", "x": -20, "y": -130, "w": 40, "h": 130 }
```

| 字段 | 说明 |
|---|---|
| `id` | 唯一标识（编辑器用，运行时可选） |
| `x`, `y` | 矩形左上角坐标（相对角色根点，y 向下为正） |
| `w`, `h` | 宽高 |

```
角色根点 (0,0)
     │
     ▼
     ┌── x=-20 ──┐
     │           │
     │  hurtbox  │  y=-130（头顶上方）
     │           │  h=130（高度130，从-130到0）
     │           │
     └───────────┘  y=0（脚底）

     x=-20 到 x=20（w=40），角色身体宽度
```

#### SpawnPoint（命名发射点）

```json
{ "id": "s0", "name": "sword_tip", "x": 80, "y": -80 }
```

命名发射点是帧上的标记点，用于"从特定位置发射特效/飞行道具"。比如剑尖位置、枪口位置：

```
角色根点 (0,0)
     │
     ▼
     ┌──────────┐
     │          │
     │   角色   │────────── ● sword_tip (80, -80)
     │          │            ↑ 剑尖位置
     └──────────┘
```

运行时状态代码可以查这个点：

```lua
-- 从剑尖发射幻影剑
local point = player:getSpawnPoint("sword_tip")
EntityManager.spawn("phantom_sword", point.x, point.y)
```

MUGEN 没有命名发射点，角色作者靠硬编码坐标或 Explod 的 pos 参数。我们的方案更清晰。

#### 和 kmc-editor 的差异

kmc-editor（`types/animation.ts`）是我们的动画编辑器，当前格式和上面推荐的格式有以下差异（未来会修改编辑器适配）：

| 维度 | kmc-editor 当前 | 推荐格式 | 变化 |
|---|---|---|---|
| 图片存储 | base64 内嵌 JSON | 外置 PNG + 路径 | 改 |
| 坐标系 | y 向上为正 | y 向下为正 | 改 |
| 推挤框 | 放动画 JSON 里 | 放角色 config | 移走 |
| Sprite Sheet | 不支持 | 支持 region 截取 | 加 |
| 碰撞框类型 | hitbox/hurtbox/jcbox | 保持不变 | ✅ |
| 命名发射点 | spawnPoints | 保持不变 | ✅ |
| editor 元数据 | 有 | 保持（编辑器用，运行时忽略） | ✅ |

**方向**：修改 kmc-editor 适配这个格式，而不是格式迁就编辑器。编辑器的修改后续单独做。

### 1.6 碰撞框详解

四种碰撞框各自的作用：

```
┌─────────────────────────────────────────────────┐
│  角色（站立）                                     │
│                                                  │
│       ┌─────────────────┐  ← hurtbox（受击框）   │
│       │                 │    被打中时受伤         │
│       │      ┌──┐       │                        │
│       │      │  │       │  ← hitbox（攻击框）    │
│       │      │  │       │    打中对手的判定       │
│       │      └──┘       │                        │
│       │                 │                        │
│       └─────────────────┘                        │
│                                                  │
│         ┌───┐  ← pushbox（推挤框）                │
│         │   │    角色之间不能重叠                  │
│         └───┘                                    │
│                                                  │
│              ●  ← jcbox（踩怪判定框）            │
│              │    踩怪判定框（Enemy Step）          │
│                                                  │
└─────────────────────────────────────────────────┘
```

| 类型 | 对应 MUGEN | 作用 | 随帧变化 | 归属 |
|---|---|---|---|---|
| hurtbox | Clsn2 | 被攻击框打中时受伤 | ✅ 每帧不同 | 动画 JSON |
| hitbox | Clsn1 | 打中对手的判定区域 | ✅ 每帧不同 | 动画 JSON |
| jcbox | 无 | 踩怪判定框（Enemy Step） | ✅ 每帧不同 | 动画 JSON |
| pushbox | width/depth | 角色之间物理碰撞，不能重叠 | ❌ 按 statetype | 角色 config |

#### hurtbox（受击框）

角色"被打"的区域。只要对手的 hitbox 碰到你的 hurtbox，你就受伤。通常覆盖全身：

```
站立：       蹲下：        空中：
┌────┐      ┌────┐       ┌────┐
│    │      │    │       │    │
│    │      └────┘       │    │
│    │                   │    │
└────┘                   └────┘
```

每帧的 hurtbox 可以不同（比如攻击时前倾，hurtbox 前移）。

#### hitbox（攻击框）

角色"打人"的区域。只有攻击动作才有，而且只在特定帧激活：

```
攻击动画 5 帧：
帧0: 无 hitbox（起手）
帧1: 无 hitbox（挥刀中）
帧2: ┌────────┐ ← 有 hitbox（刀光判定区）
    │ hitbox │
    └────────┘
帧3: ┌────────┐ ← 有 hitbox（延续）
    │ hitbox │
    └────────┘
帧4: 无 hitbox（收招）
```

#### jcbox（踩怪判定框）

MUGEN 没有的概念，我们自创。用于踩怪（Enemy Step）判定：

- **踩怪（Enemy Step）**：角色脚底的 jcbox 碰到敌人的 jcbox → 设 jcContact 标记 → -1 state 检测按跳 → JC
- **弹反不用 jcbox**：弹反用专门的弹反状态 + hitbox/ReversalDef（第十章讲），不混用 jcbox

通常是一个小框（脚底区域），位置随帧变化：

```
帧0:          帧1:          帧2:
              ●             ●
              jcbox         jcbox
(无)          (剑尖)        (剑身)
```

#### pushbox（推挤框）

角色之间的物理碰撞框，决定两个角色能不能站在同一位置：

```
角色A          角色B
┌───┐         ┌───┐
│   │ ←推挤→  │   │
└───┘         └───┘
两个 pushbox 相交 → 互相推开，不能重叠
```

**pushbox 能不能移动？**

- **位置**：自动跟随角色。角色走到哪，pushbox 跟到哪，不需要每帧设置
- **大小/偏移**：按状态类型（stand/crouch/air/lie）给默认值，个别状态可临时覆盖

```
站立 pushbox：     蹲下 pushbox：     躺倒 pushbox：
┌──────┐          ┌──────┐          ┌──────────┐
│      │          │      │          │          │
│      │          └──────┘          └──────────┘
│      │          (矮)               (长，矮)
└──────┘
(正常)
```

**pushbox 放哪里？**

不放动画 JSON 里（因为不随帧变化），放角色 config 里，按 statetype 给默认值：

```lua
-- config.lua
local config = {
    pushbox = {
        stand   = { x = -25, y = -90, w = 50, h = 90 },    -- 站立
        crouch  = { x = -25, y = -60, w = 50, h = 60 },    -- 蹲下
        air     = { x = -25, y = -90, w = 50, h = 90 },    -- 空中
        lie     = { x = -40, y = -20, w = 80, h = 20 },    -- 躺倒
    },
}
```

个别状态需要特殊 pushbox（比如某招式推挤框前移），用 sctrl 临时覆盖（后续状态系统章节讲）。

#### 碰撞检测关系

```
角色A 的 hitbox  ←碰撞?→  角色B 的 hurtbox   →  B 受伤
角色A 的 jcbox   ←碰撞?→  角色B 的 jcbox    →  A 踩到 B（踩怪标记）
角色A 的 pushbox ←重叠?→  角色B 的 pushbox   →  互相推开
角色A 的 hitbox  ←碰撞?→  角色B 的 hitbox    →  无效果（攻击框之间不碰撞）
角色A 的 hurtbox ←碰撞?→  角色B 的 hurtbox   →  无效果（受击框之间不碰撞）
```

### 1.7 完整的角色文件组织

```
characters/vergil/
│
├── character.lua          ← 入口（对应 .def）：引用其他文件，声明角色信息
│
├── config.lua             ← 常量（对应 .cns [Data]/[Size]/[Velocity]）
│                            生命/速度/尺寸/推挤框
│
├── animations/            ← 动画（对应 .air + .sff）
│   ├── idle.json          -- 站立动画
│   ├── walk.json          -- 行走动画
│   ├── jump.json          -- 跳跃动画
│   ├── attack_1.json      -- 攻击1动画
│   └── ...
│
├── sprites/               ← 精灵图（对应 .sff 内的图片）
│   ├── idle_00.png        -- 单张图
│   ├── idle_01.png
│   ├── attack_1_00.png
│   ├── vergil_atlas.png   -- 或 sprite sheet（打包多帧）
│   └── ...
│
├── states/                ← 状态定义（对应 .cns [Statedef]）
│   ├── 0.lua              -- 站立状态
│   ├── 20.lua             -- 行走状态
│   ├── 40.lua             -- 跳跃状态
│   ├── 200.lua            -- 攻击1状态
│   └── ...
│
├── commands.lua           ← 命令定义（input 文档已讲）
│
└── triggers_minus1.lua    ← -1 trigger entry（附录 F 已讲）
```

对应 MUGEN：

```
MUGEN                          Love2D
────────────────────────       ─────────────────────────
Vergil.def                 →   character.lua
Vergil.cns                 →   config.lua + states/*.lua
  ├ [Data]/[Size]          →     config.lua
  └ [Statedef N]           →     states/N.lua
Vergil.air                 →   animations/*.json
Vergil.sff                 →   sprites/*.png
Vergil.cmd                 →   commands.lua + triggers_minus1.lua
  ├ [Command]              →     commands.lua
  └ [State -1]             →     triggers_minus1.lua
```

#### character.lua 入口

```lua
-- character.lua：角色入口，引用其他文件
local Character = {}

Character.info = {
    name = "Vergil",
    author = "your_name",
    version = "1.0",
}

-- 引用其他文件（路径相对此文件）
Character.files = {
    config    = "config.lua",
    commands  = "commands.lua",
    triggers  = "triggers_minus1.lua",
    animations = "animations/",       -- 目录，加载所有 .json
    states    = "states/",            -- 目录，加载所有 .lua
}

function Character.load()
    local config = require("characters.vergil.config")
    local animations = loadAnimations("characters/vergil/animations/")
    local states = loadStates("characters/vergil/states/")
    return {
        info = Character.info,
        config = config,
        animations = animations,
        states = states,
    }
end

return Character
```

#### config.lua 常量

```lua
-- config.lua：角色常量（对应 MUGEN .cns 的 [Data]/[Size]/[Velocity]）
local config = {
    -- [Data] 基本信息
    life = 1000,            -- 生命值
    attack = 100,           -- 攻击力倍率（%）
    defence = 100,          -- 防御力倍率（%）
    liedown_time = 60,      -- 倒地恢复帧数

    -- [Size] 尺寸
    localcoord = 320,       -- 角色本地坐标系分辨率
    scale = 1.0,            -- 渲染缩放

    -- [Velocity] 速度
    walk_fwd = 2.5,         -- 向前走速度
    walk_back = 2.0,        -- 向后退速度
    run_fwd = 5.0,          -- 向前跑速度
    jump_y = -12.0,         -- 跳跃 Y 初速度（负=向上）
    gravity = 0.4,          -- 重力加速度

    -- [Movement] 移动
    airjump_num = 1,        -- 空中跳跃次数
    airjump_height = 35,    -- 空中跳跃最低高度

    -- 推挤框（按 statetype，不放动画 JSON 里）
    pushbox = {
        stand   = { x = -25, y = -90, w = 50, h = 90 },
        crouch  = { x = -25, y = -60, w = 50, h = 60 },
        air     = { x = -25, y = -90, w = 50, h = 90 },
        lie     = { x = -40, y = -20, w = 80, h = 20 },
    },
}

return config
```

### 1.8 Love2D 加载一个最简角色

下面是一个可运行的最简例子：加载角色、播放 idle 动画、显示碰撞框。

```lua
-- main.lua：最简角色加载和显示
local CharacterLoader = require("character_loader")
local player

function love.load()
    -- 加载角色
    player = CharacterLoader.load("characters/vergil/")
    player.x = 200     -- 屏幕坐标
    player.y = 400     -- 脚底 y
    player.facing = 1  -- 1=右，-1=左
    player:playAnim("idle")
end

function love.update(dt)
    player:update(dt)
end

function love.draw()
    player:draw()
    player:drawDebug()  -- 画碰撞框（调试用）
end
```

```lua
-- character_loader.lua：角色加载器
local CharacterLoader = {}

function CharacterLoader.load(folder)
    -- 1. 加载入口文件
    local character = require(folder .. "character")
    local data = character.load()

    -- 2. 构建 Player 实例
    local player = {
        info = data.info,
        config = data.config,
        animations = data.animations,  -- {idle = {...}, walk = {...}, ...}
        states = data.states,          -- {0 = {...}, 20 = {...}, ...}

        -- 运行时状态
        x = 0, y = 0,
        facing = 1,
        anim = nil,                -- 当前播放的动画
        anim_frame = 1,            -- 当前帧索引
        anim_tick = 0,             -- 当前帧已播放的 tick
        stateNo = 0,               -- 当前状态号
        state_time = 0,            -- 当前状态时间
    }

    -- 3. 方法
    player.playAnim = function(self, animId)
        self.anim = self.animations[animId]
        self.anim_frame = 1
        self.anim_tick = 0
    end

    player.update = function(self, dt)
        if not self.anim then return end
        -- 推进动画帧
        self.anim_tick = self.anim_tick + 1
        local frame = self.anim.elements[self.anim_frame]
        if self.anim_tick >= frame.duration then
            self.anim_tick = 0
            self.anim_frame = self.anim_frame + 1
            if self.anim_frame > #self.anim.elements then
                if self.anim.loop then
                    self.anim_frame = 1
                else
                    self.anim_frame = #self.anim.elements  -- 停在最后一帧
                end
            end
        end
    end

    player.draw = function(self)
        if not self.anim then return end
        local frame = self.anim.elements[self.anim_frame]
        local sprite = frame.sprite

        -- 加载并绘制精灵图（实际项目应缓存）
        local image = loadImage(sprite)
        local sx = self.facing  -- 朝向翻转
        love.graphics.draw(image,
            self.x + frame.offset.x,    -- 屏幕x + 偏移
            self.y + frame.offset.y,    -- 屏幕y + 偏移
            0,                           -- 旋转
            sx, 1                        -- x缩放(朝向), y缩放
        )
    end

    player.drawDebug = function(self)
        if not self.anim then return end
        local frame = self.anim.elements[self.anim_frame]

        -- 画 hurtbox（蓝色）
        love.graphics.setColor(0, 0.5, 1, 0.3)
        for _, box in ipairs(frame.hurtboxes) do
            love.graphics.rectangle("fill",
                self.x + box.x, self.y + box.y, box.w, box.h)
        end

        -- 画 hitbox（红色）
        love.graphics.setColor(1, 0.2, 0.2, 0.3)
        for _, box in ipairs(frame.hitboxes) do
            love.graphics.rectangle("fill",
                self.x + box.x, self.y + box.y, box.w, box.h)
        end

        -- 画 jcbox（紫色）
        love.graphics.setColor(1, 0, 1, 0.3)
        for _, box in ipairs(frame.jcboxes) do
            love.graphics.rectangle("fill",
                self.x + box.x, self.y + box.y, box.w, box.h)
        end

        -- 画 pushbox（绿色，从 config 取）
        love.graphics.setColor(0, 0.8, 0, 0.2)
        local pb = self.config.pushbox.stand  -- 简化：实际应按 statetype
        love.graphics.rectangle("fill",
            self.x + pb.x, self.y + pb.y, pb.w, pb.h)

        -- 画根点
        love.graphics.setColor(1, 0, 0, 1)
        love.graphics.circle("fill", self.x, self.y, 3)

        love.graphics.setColor(1, 1, 1, 1)
    end

    return player
end

-- 简易图片加载缓存
local imageCache = {}
function loadImage(sprite)
    local key = sprite.path
    if not imageCache[key] then
        if sprite.type == "single" then
            imageCache[key] = love.graphics.newImage(sprite.path)
        elseif sprite.type == "sheet" then
            -- Sprite Sheet：加载大图，截取 region（用 Quad）
            local atlas = love.graphics.newImage(sprite.path)
            local quad = love.graphics.newQuad(
                sprite.region.x, sprite.region.y,
                sprite.region.w, sprite.region.h,
                atlas:getDimensions())
            imageCache[key] = {image = atlas, quad = quad}
        end
    end
    return imageCache[key]
end

return CharacterLoader
```

#### 运行效果

```
屏幕显示：
                                        按方向键翻转 facing

    ┌──────────────┐
    │              │
    │   idle 帧0   │  ← 精灵图
    │              │
    └──────────────┘
    ┌──────────────┐  ← 蓝色半透明：hurtbox
    │              │
    └──────────────┘
         ┌───┐                       ← 绿色半透明：pushbox
         └───┘
           ●                        ← 红点：根点 (0,0)

    动画自动播放：帧0 → 帧1 → 帧2 → 循环
```

#### CharData 类型注解

`CharacterLoader.load()` 返回的 `charData` 是角色的**静态数据**（不含运行时状态）。用 LuaCATS 注解定义完整类型，IDE 能补全和检查：

```lua
---types.lua：所有类型定义（配合 Lua Language Server 插件使用）

-- ===== 基础类型 =====

---@class Box 碰撞框/推挤框
---@field id string  唯一标识（编辑器用）
---@field x number   矩形左上角 x（相对角色根点，y 向下为正）
---@field y number   矩形左上角 y
---@field w number   宽度
---@field h number   高度

---@class SpawnPoint 命名发射点
---@field id string   唯一标识
---@field name string 名称（如 "sword_tip"）
---@field x number    逻辑坐标 x
---@field y number    逻辑坐标 y

---@class SpriteSource 精灵图来源
---@field type string  "single" 或 "sheet"
---@field path string  图片相对路径
---@field w number     图片宽
---@field h number     图片高
---@field region {x: integer, y: integer, w: integer, h: integer}?  sheet 模式的大图截取区域

---@class AnimElement 动画帧
---@field index integer        帧索引（0起）
---@field duration integer     停留 tick 数
---@field sprite SpriteSource  精灵图来源
---@field offset {x: number, y: number}  图片轴点偏移
---@field hurtboxes Box[]      受击框列表
---@field hitboxes Box[]       攻击框列表
---@field jcboxes Box[]        踩怪判定框列表
---@field spawnPoints SpawnPoint[]  命名发射点列表

---@class AnimationData 动画数据
---@field id string          动画唯一标识
---@field name string        人类可读名
---@field version string     版本号
---@field loop boolean       是否循环
---@field elements AnimElement[]  帧序列
---@field totalTicks integer  总 tick 数（自动计算）

-- ===== 角色数据类型 =====

---@class CharInfo 角色基本信息
---@field name string       角色名
---@field author string     作者
---@field version string    版本

---@class CharConfig 角色常量（对应 MUGEN .cns [Data]/[Size]/[Velocity]）
---@field life integer          生命值
---@field attack integer        攻击力倍率(%)
---@field defence integer       防御力倍率(%)
---@field liedown_time integer  倒地恢复帧数
---@field localcoord integer    本地坐标系分辨率
---@field scale number          渲染缩放
---@field walk_fwd number       向前走速度
---@field walk_back number      向后退速度
---@field run_fwd number        向前跑速度
---@field jump_y number         跳跃Y初速度(负=向上)
---@field gravity number        重力加速度
---@field airjump_num integer   空中跳跃次数
---@field airjump_height integer 空中跳跃最低高度
---@field pushbox {stand: Box, air: Box, lie: Box}  推挤框（按 statetype）

---@class State 状态定义
---@field stateNo integer      状态号
---@field stateType string     "S"/"A"/"L"（站立/空中/躺倒）
---@field physics string       "S"/"A"/"N"（地面/空中/无物理）
---@field moveType string      "I"/"A"/"H"（空闲/攻击/被击）
---@field anim string          播放的动画 id
---@field ctrl boolean?        进入时是否有控制权
---@field total_frames integer? 状态总帧数（可选，用于自动结束）
---@field events table[]?       帧事件表（可选）
---@field onEnter fun(player: Player)?    进入状态回调
---@field onExit fun(player: Player)?     退出状态回调
---@field onFrame fun(player: Player, frame: integer, buf: InputBuffer)?   输入响应（-1层）
---@field onUpdate fun(player: Player, dt: number)?  状态推进

---@class CharData 角色静态数据（CharacterLoader.load 返回）
---@field info CharInfo                           角色基本信息
---@field config CharConfig                       常量
---@field animations table<string, AnimationData> 动画表 {idle=, walk=, ...}
---@field states table<integer, State>            状态表 {[0]=, [20]=, ...}

-- ===== 运行时类型 =====

---@class InputBuffer 输入缓冲（input 文档定义）
---@field held fun(self, key: string): boolean
---@field justPressed fun(self, key: string): boolean
---@field justReleased fun(self, key: string): boolean

---@class Player 角色运行时实例
-- 静态数据（从 charData 引用，只读共享）
---@field info CharInfo
---@field config CharConfig
---@field animations table<string, AnimationData>
---@field states table<integer, State>
-- 运行时状态（每个实例独立）
---@field x number          屏幕 x
---@field y number          屏幕 y（脚底）
---@field groundY number    地面 y
---@field vx number         x 速度
---@field vy number         y 速度
---@field facing integer    朝向 1=右 -1=左
---@field ctrl boolean      是否自由可控
-- 状态
---@field stateNo integer   当前状态号
---@field prevStateNo integer  前一个状态号（用于取消链限制）
---@field state State       当前状态（= states[stateNo]）
---@field state_time integer 当前状态时间
---@field state_changed boolean  本帧是否切了状态
-- 动画
---@field anim AnimationData    当前动画
---@field anim_frame integer    当前帧索引(1起)
---@field anim_tick integer     当前帧已播放 tick
---@field anim_finished boolean 动画是否播完
---@field hitbox_active boolean 攻击框是否生效
-- 命中
---@field moveContact boolean   攻击是否接触过
---@field moveHit boolean       攻击是否命中
-- 变量（命名字段，第三章 §3.10）
---@field combo_count integer   连击数
---@field weapon string         当前武器
---@field jc_count integer      JC 次数
---@field devil_trigger integer 魔人槽
---@field attack_phase string   攻击阶段 "startup"/"active"/"recovery"
---@field vars table<string, any>  动态变量表（序列化用）
```

`charData` 和 `Player` 的关系：

```
charData（静态数据）              Player 实例（运行时）
─────────────────────           ──────────────────────
info: CharInfo         ──引用──→ info
config: CharConfig     ──引用──→ config
animations: table      ──引用──→ animations
states: table          ──引用──→ states
                                 x, y, vx, vy, facing    ← 各自独立
                                 stateNo, state_time      ← 各自独立
                                 anim, anim_frame, ...    ← 各自独立
```

**同一个 charData 可以创建多个 Player 实例**：

```lua
local charData = CharacterLoader.load("characters/vergil/")
local player1 = Player.new(charData)   -- 实例1，独立的 x/y/stateNo
local player2 = Player.new(charData)   -- 实例2，独立的 x/y/stateNo
-- 两个实例共享 charData 的 info/config/animations/states（只读引用）
-- 运行时状态各自独立
```

### 1.9 本章总结

| 概念 | MUGEN | 我们的方案 |
|---|---|---|
| 角色入口 | `.def` | `character.lua` |
| 角色常量 | `.cns` [Data]/[Size]/[Velocity] | `config.lua` |
| 状态定义 | `.cns` [Statedef] | `states/*.lua`（下章讲） |
| 动画 | `.air` | `animations/*.json` |
| 精灵图 | `.sff`（打包，组号图号） | `sprites/*.png`（外置，路径引用） |
| 命令 | `.cmd` [Command] | `commands.lua`（input 文档已讲） |
| -1 状态 | `.cmd` [State -1] | `triggers_minus1.lua`（附录 F 已讲） |

**关键设计决策：**

1. **精灵图外置 PNG + 路径引用**：不用 SFF 打包，不用组号图号，不用 base64
2. **支持单张图和 Sprite Sheet**：JSON 里 `type: "single"` 或 `"sheet"`
3. **JSON 描述动画**：比 `.air` 更结构化，支持 hurtbox/hitbox/jcbox/spawnPoints
4. **四种碰撞框**：hurtbox（受击）、hitbox（攻击）、jcbox（踩怪判定，自创）、pushbox（推挤）
5. **推挤框放 config**：不随帧变化，按 statetype 给默认值
6. **坐标系 y 向下为正**：和 Love2D、MUGEN 一致
7. **命名发射点 spawnPoints**：比 MUGEN 的硬编码坐标更清晰

**下一步**：第二章讲状态系统（StateNo/StateType/MoveType/Physics + 状态执行流程），让角色能动起来——走、跳、切状态。

---

*第一章完。如有疑问可以对照 MUGEN 角色文件（如 `Vergil.def`/`Vergil.cns`/`Vergil.air`）查阅实际例子。*

---

## 第二章：状态系统基础

第一章讲清楚了角色的文件结构，但角色还不会动。这一章讲状态系统——角色"当前在做什么"怎么表达，怎么切换。

### 2.1 为什么需要状态系统

先看不用状态系统会怎样：

```lua
-- 没有状态系统：所有逻辑堆在一起
function Player:update(dt, buf)
    if buf:held("right") then
        self.x = self.x + 2
        self:playAnim("walk")
    end
    if buf:justPressed("jump") then
        self.vy = -12
        self:playAnim("jump")
    end
    if buf:justPressed("attack") then
        self:playAnim("attack_1")
        -- 攻击中能不能走？能不能跳？能不能再攻击？
        -- 每个判断都要查"现在在不在攻击中"
        if self.attacking then
            if self.attack_frame > 8 and self.attack_frame < 15 then
                -- 第8-15帧可以取消
                ...
            end
        end
    end
    -- 越写越乱，每个招式都要 if-else 嵌套
end
```

问题：角色在不同情境下行为不同（站立能走能跳，攻击中不能走但能取消），不用状态系统就要写大量 if-else，而且很难维护。

**状态系统的思路**：把角色"当前在做什么"明确成一个状态号，每个状态有自己的逻辑。状态之间通过 ChangeState 切换：

```
站立(0) ──按右──→ 行走(20) ──松开──→ 站立(0)
  │                    │
  ├─按跳──→ 跳跃(40) ──落地──→ 站立(0)
  │
  └─按攻击──→ 攻击1(200) ──结束──→ 站立(0)
                  │
                  └─第8-15帧按攻击──→ 攻击2(201)
```

每个状态独立定义自己的逻辑，互不干扰。攻击状态里不用关心"能不能走"——攻击状态根本没有走的逻辑。

### 2.2 StateNo（状态号）

MUGEN 用整数标识状态，叫 StateNo。常见状态号有约定俗成的编号：

| 状态号 | 含义 | 鬼泣需要 |
|---|---|---|
| 0 | 站立（idle） | ✅ |
| 5 | 转身 | ✅ |
| 10-12 | 蹲下系列 | ❌ 鬼泣不需要 |
| 20 | 行走 | ✅ |
| 40 | 跳跃起跳 | ✅ |
| 45 | 空中跳跃 | ✅ |
| 47 | 空中冲刺 | ✅ 鬼泣有空中机动 |
| 50 | 落地 | ✅ |
| 52 | 落地恢复 | ✅ |
| 100 | 奔跑 | ✅ |
| 105 | 奔跑刹车 | ⚠️ 可选 |
| 120-155 | 防御系列 | ❌ 鬼泣不做防御 |
| 200-299 | 地面攻击系列 | ✅ |
| 300-399 | 特殊攻击/派生 | ✅ |
| 400-499 | 空中攻击系列 | ✅ 鬼泣核心 |
| 500-599 | 投技 | ⚠️ 可选 |
| 3000-3999 | 超必杀/大招 | ✅ |
| 5000-5150 | 被击系列 | ✅ |
| 5900 | 回合开始 | ⚠️ 鬼泣可能用不同结构 |

**鬼泣的状态号规划建议**：

```
0-99     基础移动（站立/行走/跳跃/落地/奔跑）
100-199  机动（冲刺/闪避/空中冲刺）
200-299  地面攻击（轻攻击/重攻击/派生）
300-399  特殊地面攻击（大招起手等）
400-499  空中攻击（核心连段）
500-599  空中特殊（JC 相关、空中大招）
3000-3999 大招/超必杀
5000-5150 被击/倒地/起身
```

状态号不需要严格按 MUGEN 的编号，但保持"基础移动小号、攻击大号、被击 5000+"的大致结构有助于和 MUGEN 资料对照。

### 2.3 StateType（状态类型）

StateType 描述角色的姿态类型，影响物理、碰撞框、可用招式：

| StateType | 含义 | 鬼泣需要 | 对应 pushbox |
|---|---|---|---|
| S | 站立 | ✅ | `pushbox.stand` |
| C | 蹲下 | ❌ 鬼泣不需要 | `pushbox.crouch`（不用） |
| A | 空中 | ✅ | `pushbox.air` |
| L | 躺倒 | ✅ | `pushbox.lie` |

**鬼泣只用 S / A / L 三种**。角色要么站着、要么在空中、要么被打倒躺地。没有蹲下姿态。

StateType 的作用：

1. **决定用哪个 pushbox**：stand 用 `config.pushbox.stand`，air 用 `config.pushbox.air`
2. **限制可用招式**：某些招式只能站立出（如地面重攻击），某些只能空中出（如空中连段）
3. **决定物理行为**：S 走地面物理（摩擦），A 走空中物理（重力）

### 2.4 MoveType（移动类型）

MoveType 描述角色"当前动作的性质"：

| MoveType | 含义 | 例子 |
|---|---|---|
| I | Idle，空闲 | 站立、行走、跳跃中（没在攻击也没被打） |
| A | Attack，攻击 | 挥刀、开枪、放招 |
| H | Hit，被击 | 被打中后的硬直 |

MoveType 的作用：

1. **决定能否被投**：投技通常只能抓 MoveType != A 的对手（不能抓正在攻击的人）
2. **决定 hitstop 行为**：攻击方和被击方都进入 hitstop
3. **状态切换限制**：被击状态（H）通常不能主动切状态，要等硬直结束

```
攻击流程的 MoveType 变化：
攻击者：I →（出招）→ A →（命中）→ A+hitstop → A →（收招）→ I
被击者：I →（被打）→ H →（硬直）→ I
```

### 2.5 Physics（物理类型）

Physics 决定角色每帧怎么更新物理（速度、位置）：

| Physics | 含义 | 行为 |
|---|---|---|
| S | 地面物理 | 摩擦力减速，y 固定在地面 |
| A | 空中物理 | 重力下落，x/y 都可变 |
| N | 无物理 | 不自动更新速度位置（手动控制） |

**Physics 和 StateType 的关系**：

通常 S 状态用 S 物理，A 状态用 A 物理，但不强制。比如：

- 跳跃起跳状态（40）：StateType=A（已经在空中），但 Physics 可能是 N（起跳瞬间手动设速度，不立刻受重力）
- 空中攻击（400）：StateType=A，Physics=A（受重力，但攻击中可能减小重力）
- 躺倒（5110）：StateType=L，Physics=N（不动）

```
状态切换时的 Physics 变化：
站立(0):    StateType=S, Physics=S  → 摩擦力，y 固定
跳跃(40):   StateType=A, Physics=A  → 重力下落
空中攻击(400): StateType=A, Physics=A → 重力（可调整）
落地(52):   StateType=S, Physics=S  → 摩擦力恢复
躺倒(5110): StateType=L, Physics=N  → 不动
```

### 2.6 状态执行流程

MUGEN 每帧按固定顺序执行 5 层状态，这个在 input 文档和附录 F 已经提过，这里完整展开：

```
每帧执行顺序：
┌──────────────────────────────────────────────────────────┐
│  -4 层（updateAlways）                                    │
│    极少用，hitpause 也跑。放全局必备逻辑                   │
│    （如 AssertSpecial 重置、计时器递减）                   │
├──────────────────────────────────────────────────────────┤
│  -3 层（updateGlobal）                                    │
│    全局前置，hitpause 时跳过                              │
│    （朝向更新、锁定目标、物理预备）                        │
├──────────────────────────────────────────────────────────┤
│  -2 层（updateFlags）                                     │
│    标志/变量更新，hitpause 时跳过                         │
│    （蓄力标志、红刀、计时器递减）                          │
├──────────────────────────────────────────────────────────┤
│  -1 层（updateControl）                                   │
│    输入处理 + ChangeState，hitpause 时跳过                │
│    （命令检测、cancel_windows、trigger entry）            │
│    ★ 详见 input 文档和附录 F                              │
├──────────────────────────────────────────────────────────┤
│  当前状态（updateState）                                  │
│    当前状态的逻辑，hitpause 时跳过                        │
│    （推进帧数、状态结束检测、帧事件）                      │
└──────────────────────────────────────────────────────────┘
```

**hitpause 时的处理**（复习）：

- -4 层照跑（全局必备逻辑）
- -3/-2/-1/当前状态：sctrl 默认跳过（除非 `ignorehitpause = 1`）
- 命令匹配照常跑，curbuftime 不递减（详见 input 文档 §5）

**Love2D 的实现**（input 文档已给代码，这里简化回顾）：

```lua
function Player:update(dt, buf, in_hitstop)
    -- -4：hitstop 也跑
    self:updateAlways(dt, buf)

    if in_hitstop then return end  -- hitstop 分界线

    -- -3：全局前置
    self:updateGlobal(dt, buf)
    -- -2：标志更新
    self:updateFlags(dt, buf)
    -- -1：输入处理（trigger entry 系统，附录 F）
    self:updateControl(dt, buf)
    -- 当前状态
    if not self.state_changed then
        self:updateState(dt, buf)
    end
end
```

### 2.7 MUGEN 的 [Statedef] 格式

MUGEN 在 `.cns` 文件里用 `[Statedef N]` 定义状态：

```ini
; 状态号 0：站立
[Statedef 0]
type          = S          ; StateType（S/A/C/L）
physics       = S          ; Physics（S/A/N）
movetype      = I          ; MoveType（I/A/H）
anim          = 0          ; 默认播放的动画号（对应 .air 的 [Begin Action 0]）
velset        = 0,0        ; 进入状态时设速度（可选）
ctrl          = 1          ; 进入状态时是否有控制权（0/1）
poweradd      = 0          ; 进入状态时加能量（可选）

; 状态里的 sctrl（状态控制器）
[State 0, 1]               ; 随便起的名字
type = VelSet               ; 设速度
trigger1 = command = "holdfwd"   ; 按住前
x = 2.5                     ; x 速度 = 2.5

[State 0, 2]
type = ChangeState          ; 切状态
trigger1 = command = "holdfwd"   ; 按住前
trigger1 = command != "holddown" ; 且没按住下
value = 20                  ; 切到行走状态
```

每个 `[Statedef N]` 包含：
1. **头部声明**：type/physics/movetype/anim/ctrl 等
2. **若干 [State N, Label] 块**：每个块是一个 sctrl，带 trigger 条件

### 2.8 Love2D 的 states/N.lua 格式

对应到 Love2D，每个状态一个文件：

```lua
-- states/0.lua：站立状态（对应 MUGEN [Statedef 0]）
local State = {}

-- 头部声明（对应 [Statedef] 头）
State.stateNo   = 0
State.stateType = "S"     -- S/A/L
State.physics   = "S"     -- S/A/N
State.moveType  = "I"     -- I/A/H
State.anim      = "idle"  -- 播放的动画 id（对应 animations/idle.json）
State.ctrl      = true    -- 进入时是否有控制权

-- 进入状态时调用（对应 velset/poweradd 等）
function State:onEnter(player)
    player.vx = 0           -- 站立时 x 速度清零
    player.vy = 0
end

-- 退出状态时调用
function State:onExit(player)
end

-- 当前状态的逻辑（对应 [State N, ...] sctrl 块）
-- 每帧调用，在 -1 层之后、updateState 里
function State:onFrame(player, frame, buf)
    -- 按住前：设速度 + 切行走状态
    if buf:held("fwd") then
        player.vx = player.config.walk_fwd
        player:setState(20)   -- 切到行走
        return
    end
    -- 按跳跃：切跳跃状态
    if buf:justPressed("jump") then
        player:setState(40)   -- 切到跳跃
        return
    end
    -- 按攻击：切攻击状态
    if buf:justPressed("attack") then
        player:setState(200)  -- 切到攻击1
        return
    end
end

-- 状态推进（每帧调用，推进帧数、检测结束）
function State:onUpdate(player, dt)
    -- 站立状态不会自动结束（循环 idle 动画）
    -- 攻击状态会在这里检测 total_frames 到了就切回站立
end

return State
```

### 2.9 完整的状态定义：站立 + 行走 + 跳跃

下面给三个最基础状态的完整定义，让角色能站、能走、能跳。

```lua
-- states/0.lua：站立
local State = {}
State.stateNo   = 0
State.stateType = "S"
State.physics   = "S"
State.moveType  = "I"
State.anim      = "idle"
State.ctrl      = true

function State:onEnter(player)
    player.vx = 0
    player.vy = 0
end

function State:onFrame(player, frame, buf)
    if buf:held("fwd") or buf:held("back") then
        player:setState(20)  -- 行走
        return
    end
    if buf:justPressed("jump") then
        player:setState(40)  -- 跳跃
        return
    end
    if buf:justPressed("attack") then
        player:setState(200) -- 攻击
        return
    end
end

return State
```

```lua
-- states/20.lua：行走
local State = {}
State.stateNo   = 20
State.stateType = "S"
State.physics   = "S"
State.moveType  = "I"
State.anim      = "walk"
State.ctrl      = true

function State:onEnter(player)
    -- 不清速度，onFrame 里根据方向设
end

function State:onFrame(player, frame, buf)
    local dir = 0
    if buf:held("fwd") then dir = dir + 1 end
    if buf:held("back") then dir = dir - 1 end

    if dir == 0 then
        player:setState(0)   -- 松开方向，回站立
        return
    end

    -- 设速度（注意朝向）
    if dir > 0 then
        player.vx = player.config.walk_fwd
    else
        player.vx = -player.config.walk_back
    end

    if buf:justPressed("jump") then
        player:setState(40)
        return
    end
    if buf:justPressed("attack") then
        player:setState(200)
        return
    end
end

return State
```

```lua
-- states/40.lua：跳跃起跳
local State = {}
State.stateNo   = 40
State.stateType = "A"       -- 空中
State.physics   = "A"       -- 空中物理（重力）
State.moveType  = "I"
State.anim      = "jump"
State.ctrl      = true

function State:onEnter(player)
    player.vy = player.config.jump_y   -- 跳跃初速度（负=向上）
end

function State:onFrame(player, frame, buf)
    -- 空中可以左右微调
    if buf:held("fwd") then
        player.vx = player.config.walk_fwd * 0.8
    elseif buf:held("back") then
        player.vx = -player.config.walk_back * 0.8
    end

    -- 落地检测（y >= 地面高度）
    if player.y >= player.groundY then
        player.y = player.groundY
        player:setState(50)  -- 落地状态
        return
    end
end

return State
```

```lua
-- states/50.lua：落地恢复
local State = {}
State.stateNo   = 50
State.stateType = "S"
State.physics   = "S"
State.moveType  = "I"
State.anim      = "land"
State.ctrl      = false        -- 落地瞬间没控制权
State.total_frames = 4         -- 落地硬直 4 帧

function State:onEnter(player)
    player.vx = 0
    player.vy = 0
end

function State:onFrame(player, frame, buf)
    -- 落地硬直结束后回站立
    if frame >= State.total_frames then
        player:setState(0)
        return
    end
end

return State
```

### 2.10 Player 类的状态管理

把状态文件加载和管理整合到 Player 类：

```lua
-- player.lua：Player 类的状态管理部分
local Player = {}
Player.__index = Player

function Player.new(charData)
    local self = setmetatable({}, Player)
    self.config = charData.config
    self.animations = charData.animations
    self.states = charData.states         -- {0 = State, 20 = State, ...}

    -- 运行时状态
    self.stateNo = 0
    self.state = self.states[0]
    self.state_time = 0
    self.state_changed = false

    -- 物理量
    self.x = 200
    self.y = 400
    self.groundY = 400
    self.vx = 0
    self.vy = 0
    self.facing = 1

    -- 进入初始状态
    self.state:onEnter(self)
    self:playAnim(self.state.anim)
    return self
end

-- 切换状态
function Player:setState(newNo)
    local newState = self.states[newNo]
    if not newState then
        error("状态不存在: " .. newNo)
    end
    -- 退出旧状态
    if self.state.onExit then self.state:onExit(self) end
    -- 切换
    self.stateNo = newNo
    self.state = newState
    self.state_time = 0
    self.state_changed = true
    -- 进入新状态
    if newState.onEnter then newState:onEnter(self) end
    -- 切换动画
    if newState.anim then self:playAnim(newState.anim) end
    -- ctrl
    if newState.ctrl ~= nil then self.ctrl = newState.ctrl end
end

-- 每帧更新
function Player:update(dt, buf, in_hitstop)
    self.state_changed = false

    -- -4: always
    -- （简化，暂不实现 updateAlways）

    if in_hitstop then return end

    -- -3/-2: 简化，暂不实现
    -- 物理
    self:updatePhysics(dt)

    -- -1: 输入处理（trigger entry，附录 F）
    -- onFrame 总是调用，ctrl 不是"开关输入"（§3.9 详讲）
    -- ctrl 只影响 trigger entry 里带 T.ctrl 条件的 entry
    self.state:onFrame(self, self.state_time, buf)

    if self.state_changed then return end

    -- 当前状态推进
    self.state_time = self.state_time + 1
    if self.state.onUpdate then
        self.state:onUpdate(self, dt)
    end

    -- 动画推进
    self:updateAnim()
end

-- 物理更新
function Player:updatePhysics(dt)
    local phys = self.state.physics
    if phys == "S" then
        -- 地面物理：摩擦力
        self.vx = self.vx * 0.8
        if math.abs(self.vx) < 0.1 then self.vx = 0 end
        self.y = self.groundY
    elseif phys == "A" then
        -- 空中物理：重力
        self.vy = self.vy + self.config.gravity
        self.y = self.y + self.vy
    end
    self.x = self.x + self.vx
end

return Player
```

### 2.11 可运行的最小例子

把以上整合，加一个 `main.lua` 让角色能走能跳：

```lua
-- main.lua
local Player = require("player")
local CharacterLoader = require("character_loader")
local Input = require("input")       -- input 文档的输入系统
local player

function love.load()
    local charData = CharacterLoader.load("characters/vergil/")
    player = Player.new(charData)
    Input.init()
end

function love.update(dt)
    Input.update()
    local buf = Input.getBuffer()
    player:update(dt, buf, false)
end

function love.draw()
    player:draw()
    player:drawDebug()
    -- 状态信息
    love.graphics.print(string.format("state: %d  stateType: %s  physics: %s",
        player.stateNo, player.state.stateType, player.state.physics), 10, 10)
    love.graphics.print(string.format("x: %.0f  y: %.0f  vx: %.1f  vy: %.1f",
        player.x, player.y, player.vx, player.vy), 10, 30)
end

function love.keypressed(key)
    if key == "escape" then love.event.quit() end
end
```

运行效果：

```
启动：角色站立，播放 idle 动画
按右：角色切换到 state 20（行走），向右移动
松开：切回 state 0（站立）
按跳：切到 state 40（跳跃），y 上升，重力下落
落地：切到 state 50（落地恢复），4 帧后回 state 0

屏幕左上角显示：
  state: 0  stateType: S  physics: S
  x: 200  y: 400  vx: 0.0  vy: 0.0
```

### 2.12 本章总结

| 概念 | MUGEN | Love2D |
|---|---|---|
| 状态号 | StateNo（整数） | `stateNo`（整数） |
| 状态类型 | StateType（S/C/A/L） | `stateType`（S/A/L，无 C） |
| 移动类型 | MoveType（I/A/H） | `moveType`（I/A/H） |
| 物理类型 | Physics（S/A/N） | `physics`（S/A/N） |
| 状态定义 | `.cns` 的 `[Statedef N]` | `states/N.lua` |
| 状态切换 | ChangeState sctrl | `player:setState(N)` |
| 执行流程 | -4/-3/-2/-1/当前 | `updateAlways/Global/Flags/Control/State` |

**鬼泣的简化**：
- 不用 C（蹲下）状态类型
- 不做防御系列状态（120-155）
- 不做 juggle 点数（用"空中技能 CD + JC 重置"替代，第八章讲）

**下一步**：第三章讲 SCTRL（状态控制器），把 ChangeState/VelSet/PosSet/ChangeAnim 等做成可复用的工具，不再每个状态里手写 `player.vx = ...`。

---

*第二章完。状态系统是角色能动起来的基础，后续章节的 SCTRL 和 Trigger 都是在状态里用的。*

---

## 第三章：SCTRL 基础（状态控制器）

第二章的状态能切了，但状态里"做什么"还是直接写 `player.vx = 2.5` 这种裸代码。这一章讲 SCTRL（State Controller，状态控制器）——MUGEN 把常用操作封装成的标准工具。

### 3.1 什么是 SCTRL

SCTRL 是 MUGEN 对"状态里能做什么"的标准化封装。比如设速度、切动画、改变量，每个操作都是一个有名字的 SCTRL：

| SCTRL | 作用 | 例子 |
|---|---|---|
| `VelSet` | 设速度 | `VelSet x=2.5, y=0` |
| `ChangeAnim` | 切动画 | `ChangeAnim value=200` |
| `ChangeState` | 切状态 | `ChangeState value=40` |
| `CtrlSet` | 设控制权 | `CtrlSet value=0` |

**为什么要封装成 SCTRL**：

1. **统一接口**：所有操作都是 `type=名字 + 参数`，引擎统一处理
2. **trigger 控制**：每个 SCTRL 带 trigger，决定"什么时候执行"
3. **可序列化**：MUGEN 的 SCTRL 是声明式数据，可以存文件、网络同步

### 3.2 MUGEN 的 SCTRL 格式

MUGEN 在 `.cns` 里用声明式语法写 SCTRL：

```ini
; 状态 200（攻击1）里的 SCTRL
[State 200, 设速度]           ; 随便起的名字
type = VelSet                  ; SCTRL 类型
trigger1 = time = 0            ; 进入状态第 0 帧时执行
x = 3.0                        ; 参数：x 速度 = 3.0

[State 200, 切动画]
type = ChangeAnim
trigger1 = time = 0            ; 第 0 帧
value = 200                    ; 切到动画 200

[State 200, 关控制权]
type = CtrlSet
trigger1 = time = 0
value = 0                      ; 关控制权（攻击中不能操作）

[State 200, 攻击结束回站立]
type = ChangeState
trigger1 = animtime = 10       ; 动画播了 10 帧后
value = 0                      ; 切回站立
```

每个 SCTRL 块结构：
```
[State 状态号, 名字]
type = SCTRL类型
trigger1 = 条件1            ; 满足时执行
trigger2 = 条件2            ; 或满足这个
参数1 = 值1
参数2 = 值2
```

### 3.3 Love2D 的 SCTRL 方式：命令式方法调用

Love2D 不需要声明式语法。SCTRL 就是 Player 类的方法，状态代码里直接调用：

```lua
-- Love2D 里：SCTRL 是 Player 的方法
function State:onEnter(player)
    -- 对应 MUGEN 的 VelSet / ChangeAnim / CtrlSet
    player:velSet(3.0, 0)
    player:changeAnim("attack_1")
    player:ctrlSet(false)
end

function State:onUpdate(player, dt)
    -- 对应 MUGEN 的 ChangeState
    if player.anim_finished then
        player:setState(0)  -- 回站立
    end
end
```

**对比**：

| 维度 | MUGEN 声明式 | Love2D 命令式 |
|---|---|---|
| 语法 | `type=VelSet, trigger1=time=0, x=3` | `player:velSet(3, 0)` |
| trigger | 写在 SCTRL 里 | 写在 if 判断里 |
| 执行顺序 | 按 trigger 优先级 | 按代码顺序 |
| 灵活性 | 受限于 SCTRL 参数 | 任意 Lua 代码 |
| 类型检查 | 无 | 可用 LuaCATS（附录 F.9） |

**关键结论**：Love2D 里不需要 SCTRL 解析器。每个 SCTRL 对应 Player 类一个方法。状态代码直接调用方法，用 if 代替 trigger。

### 3.4 SCTRL 分类和最常用的 15 个

MUGEN 有 100+ 个 SCTRL，但常用的就 15 个左右。按功能分类：

```
SCTRL 分类：
├── 状态切换（2个）
│   ├── ChangeState    切状态（自己）
│   └── SelfState      切状态（强制，忽略 ctrl）
│
├── 速度位置（5个）
│   ├── VelSet         设速度（绝对）
│   ├── VelAdd         加速度（增量）
│   ├── VelMul         乘速度（比例）
│   ├── PosSet         设位置（绝对）
│   └── PosAdd         加位置（增量）
│
├── 动画控制（1个）
│   └── ChangeAnim     切换动画
│
├── 角色状态（2个）
│   ├── CtrlSet        设控制权
│   └── StateTypeSet   改状态类型(S/A/L)和物理
│
├── 变量系统（2个）
│   ├── VarSet         设变量
│   └── VarAdd         加变量
│
├── 角色属性（1个）
│   └── Turn           转身（翻转 facing）
│
└── 特殊标志（2个，简略）
    ├── AssertSpecial  声明特殊标志
    └── HitBy/NotHitBy 无敌帧（第十章详讲）
```

下面逐个讲，每个给 MUGEN 写法 + Love2D 方法。

### 3.5 状态切换类

#### ChangeState

切到另一个状态。第二章已经在用 `player:setState(no)`。

```ini
; MUGEN
[State 0, 走路]
type = ChangeState
trigger1 = command = "holdfwd"
value = 20
```

```lua
-- Love2D
function State:onFrame(player, frame, buf)
    if buf:held("fwd") then
        player:setState(20)   -- ChangeState
    end
end
```

**参数**：

| 参数 | MUGEN | Love2D | 说明 |
|---|---|---|---|
| value | `value = 20` | `setState(20)` | 目标状态号 |
| ctrl | `ctrl = 1`（可选） | 第二参数可选 | 进入时是否给控制权 |

```lua
-- 带控制权参数
player:setState(20, true)   -- 进入状态 20 并给控制权
```

#### SelfState

和 ChangeState 几乎一样，区别：

| | ChangeState | SelfState |
|---|---|---|
| 正常情况 | 用这个 | 不用 |
| 强制切换 | 受一些限制 | 忽略限制，强制切 |
| 被击状态里 | 可能受限 | 可以强制切出 |

**鬼泣里基本只用 ChangeState**，SelfState 极少用。Love2D 里提供但不用频繁：

```lua
function Player:selfState(no)
    -- 和 setState 一样，但忽略 ctrl 限制
    -- 用于被击状态强制切出等特殊场景
    self:setState(no, true)  -- 简化实现
end
```

### 3.6 速度类

#### VelSet（设绝对速度）

```ini
; MUGEN：设 x=3.0, y=0
[State 200, 设速度]
type = VelSet
trigger1 = time = 0
x = 3.0
y = 0
```

```lua
-- Love2D
player:velSet(3.0, 0)        -- 设 vx=3.0, vy=0
player:velSet(nil, -12)      -- 只设 vy，vx 不变（nil = 不改）
```

#### VelAdd（加速度，增量）

```ini
; MUGEN：每帧 y 加 0.4（重力）
[State -2, 重力]
type = VelAdd
trigger1 = 1                  ; 每帧
y = 0.4
```

```lua
-- Love2D
player:velAdd(0, 0.4)        -- vy += 0.4
player:velAdd(-0.5, 0)       -- vx -= 0.5（减速）
```

#### VelMul（乘速度，比例）

```ini
; MUGEN：每帧 x 乘 0.8（摩擦力）
[State -2, 摩擦]
type = VelMul
trigger1 = 1
x = 0.8
```

```lua
-- Love2D
player:velMul(0.8, 1)        -- vx *= 0.8, vy 不变
```

**三个速度 SCTRL 的区别**：

```
VelSet(3, 0)      → vx = 3        （设绝对值）
VelAdd(1, 0)      → vx = vx + 1   （加增量）
VelMul(0.8, 1)    → vx = vx * 0.8 （乘比例）

应用场景：
  VelSet  → 进入状态时设初速度（跳跃初速、击退初速）
  VelAdd  → 每帧加固定值（重力、风力）
  VelMul  → 每帧乘比例（摩擦力、空气阻力）
```

### 3.7 位置类

#### PosSet（设绝对位置）

```ini
; MUGEN：设 x=100, y=400
[State 200, 设位置]
type = PosSet
trigger1 = time = 0
x = 100
y = 400
```

```lua
-- Love2D
player:posSet(100, 400)      -- 设 x=100, y=400
player:posSet(nil, 0)        -- 只设 y=0（地面），x 不变
```

#### PosAdd（加位置，增量）

```ini
; MUGEN：x 加 5（瞬移）
[State 200, 前移]
type = PosAdd
trigger1 = time = 5
x = 5
```

```lua
-- Love2D
player:posAdd(5, 0)          -- x += 5
```

**注意**：PosSet/PosAdd 是**直接改位置**，不是通过速度。通常用于瞬移、绑定、重置位置。正常移动用 VelSet + 物理更新，不用 PosAdd。

### 3.8 动画类

#### ChangeAnim（切换动画）

```ini
; MUGEN：切到动画 200
[State 200, 切动画]
type = ChangeAnim
trigger1 = time = 0
value = 200
```

```lua
-- Love2D
player:changeAnim("attack_1")    -- 切到动画 id="attack_1"
```

**MUGEN 用动画号（整数），Love2D 用动画 id（字符串）**。这是格式差异（第一章讲过）。

`setState` 内部会自动调 `changeAnim`（根据状态的 `anim` 字段），所以大部分时候不用手动调。需要手动调的场景：同一状态中途换动画（比如攻击状态第 10 帧切到收招动画）。

```lua
-- 同一状态中途换动画
function State:onUpdate(player, dt)
    if player.state_time == 10 then
        player:changeAnim("attack_1_recovery")  -- 切收招动画
    end
end
```

### 3.9 控制权类

#### CtrlSet（设控制权）

```ini
; MUGEN：关控制权
[State 200, 关控制]
type = CtrlSet
trigger1 = time = 0
value = 0
```

```lua
-- Love2D
player:ctrlSet(false)        -- 关控制权
player:ctrlSet(true)         -- 开控制权
```

**ctrl 的真实含义**（重要，容易误解）：

ctrl 不是"是否响应输入"的开关，而是**"角色是否自由可控"**的标志：

```
ctrl = true：角色自由（站立、行走、落地恢复后）
  - trigger entry 里带 T.ctrl 条件的能触发（从站立按攻击出招）
  - 可以出"基础招式"（需要自由状态的招）

ctrl = false：角色受限（攻击中、被击中、硬直中）
  - trigger entry 里带 T.ctrl 条件的不触发（不能从攻击中按方向走路）
  - 但 trigger entry 仍然会检查！不带 ctrl 条件的能触发：
    ✅ 攻击取消（只看 stateno + movecontact，不看 ctrl）
    ✅ Roman Cancel（甚至要求 !ctrl 才能用）
    ✅ 被击状态切换（由系统强制，不看 ctrl）
  - onFrame 照常调用，状态自己可以检测输入
```

**关键**：ctrl=false **不是**"关闭输入"。输入系统照常读、命令匹配照常跑、trigger entry 照常检查。ctrl 只是 trigger 里的一个条件，决定"需要自由状态才能出的招"能不能出。

看 MUGEN 实际例子（Vergil.cmd）：

```mugen
; 普通攻击：需要 ctrl（从站立出招）
[State -1, 5A]
triggerall = command = "a"
trigger1 = ctrl                    ; ★ 需要 ctrl
trigger1 = statetype != A

; Roman Cancel：明确要求 !ctrl（在攻击中才能 RC）
[State -1, Roman Cancel]
triggerall = command = "x" && power >= 1000
triggerall = !ctrl                 ; ★ 要求没有 ctrl
trigger1 = movecontact

; 攻击取消：不看 ctrl（只看 stateno + movecontact）
[State -1, 5AA]
triggerall = command = "a"
trigger1 = stateno = 200           ; 只看当前状态
trigger1 = movecontact             ; 和命中
```

典型用法：攻击状态进入时关控制权，可取消窗口时不需要开回来（取消不需要 ctrl）：

```lua
function State:onEnter(player)
    player:ctrlSet(false)    -- 攻击中关控制权（不能从这状态按方向走路）
end

function State:onFrame(player, frame, buf)
    -- 第 8-15 帧是取消窗口
    -- 注意：不需要 ctrlSet(true)，取消不看 ctrl
    if frame >= 8 and frame <= 15 then
        -- trigger entry 里不带 T.ctrl 的取消能触发
        -- 比如 5AA 的 trigger: {state(200), T.moveContact}
        -- 这会正常工作，即使 ctrl=false
    end
end

function State:onUpdate(player, dt)
    if player.anim_finished then
        player:setState(0)   -- 动画结束回站立（setState 内部会设 ctrl=true）
    end
end
```

**什么时候开 ctrl**：回到自由状态（站立 0、行走 20、跳跃 40）时，状态的 `ctrl = true` 字段会自动开。不需要手动开。

### 3.10 变量类

MUGEN 用 `var(N)` 存角色变量（N 是整数索引，0-59）。这是因为 MUGEN 变量是固定大小数组。

**Love2D 不需要这个限制，推荐用命名变量**——直接用 Player 的字段，不用索引：

#### 命名变量（推荐）

```lua
-- 直接用命名字段（最直观，IDE 能补全）
player.combo_count = 0            -- 连击数
player.combo_count = player.combo_count + 1

player.weapon = "sword"           -- 当前武器
player.jc_count = 0               -- JC 次数
player.devil_trigger = 100        -- 魔人槽
```

对比 MUGEN 的 `var(0)`：
- `player.combo_count` 一眼看懂，`player.vars[0]` 要查注释
- 命名字段 IDE 能补全，`vars[0]` 不能
- 不用记索引，不会搞混

#### VarSet / VarAdd（辅助方法，用于动态访问）

大部分时候直接用命名字段。需要动态访问（遍历、序列化）时用辅助方法：

```lua
-- 辅助方法：用字符串 key
player:setVar("combo_count", 0)       -- 设
player:addVar("combo_count", 1)       -- 加
player:getVar("combo_count")          -- 读

-- 内部实现就是操作 player.vars 表
-- player.vars = { combo_count = 0, weapon = "sword", ... }
```

#### 对应 MUGEN 的 VarSet / VarAdd

```ini
; MUGEN：设 var(0) = 1
[State 200, 设连击数]
type = VarSet
trigger1 = time = 0
v = 0
value = 1
```

```lua
-- Love2D：直接用字段（推荐）
player.combo_count = 1

-- 或用辅助方法
player:setVar("combo_count", 1)
```

```ini
; MUGEN：var(0) 加 1
[State 200, 连击+1]
type = VarAdd
trigger1 = time = 0
v = 0
value = 1
```

```lua
-- Love2D：直接用字段
player.combo_count = player.combo_count + 1

-- 或用辅助方法
player:addVar("combo_count", 1)
```

#### 变量用途举例

| MUGEN 写法 | Love2D 命名字段 | 含义 |
|---|---|---|
| `var(0)` | `player.combo_count` | 连击数，每次命中 +1，连段结束清零 |
| `var(1)` | `player.weapon` | 当前武器（"sword"/"fist"/"gun"） |
| `var(2)` | `player.jc_count` | 空中 JC 计数，落地清零 |
| `var(3)` | `player.devil_trigger` | 魔人槽，命中加，大招消耗 |

**关键**：命名字段想加就加，不用预声明。`player.xxx = 0` 就创建了。不需要像 MUGEN 那样受 60 个变量的限制。

#### 实际例子

**例子 1：连击计数**

```lua
-- 攻击状态进入时连击 +1
function State:onEnter(player)
    player.combo_count = (player.combo_count or 0) + 1
    -- 根据连击数切不同动画
    if player.combo_count == 1 then
        -- 用状态定义的 anim（attack_1）
    elseif player.combo_count == 2 then
        player:changeAnim("attack_2")
    elseif player.combo_count >= 3 then
        player:changeAnim("attack_3")
    end
end

-- 连段结束（回站立/被击）时清零
function State:onEnter(player)  -- 站立状态
    player.combo_count = 0
end
```

**例子 2：武器切换**

```lua
-- 武器是字符串，比 MUGEN 的 var(1)=0/1/2 更可读
player.weapon = "sword"    -- 剑
player.weapon = "fist"     -- 拳套
player.weapon = "gun"      -- 枪

-- 在 trigger entry 里根据武器分流
{
    name = "attack",
    changeState = 200,
    triggerall = {
        cmd("a"),
        function(p) return p.weapon == "sword" end,  -- 剑时出 slash
    },
    triggers = { { T.ctrl } },
}
-- 另一个 entry：拳套时出拳
{
    name = "attack_fist",
    changeState = 250,
    triggerall = {
        cmd("a"),
        function(p) return p.weapon == "fist" end,   -- 拳套时出拳
    },
    triggers = { { T.ctrl } },
}
```

**例子 3：JC 计数与重置**

JC 的检测条件（踩怪+跳跃）需要碰撞系统（第七章讲），这里只展示**变量怎么存和改**，不展开检测逻辑：

```lua
-- states/40.lua（跳跃）：起跳时清零 JC 计数
function State:onEnter(player)
    player.jc_count = 0
end

-- states/40.lua（跳跃）：在 onFrame 里检测 JC 条件
function State:onFrame(player, frame, buf)
    -- JC 检测：脚下有敌人 + 按跳跃
    -- enemyBelow() 的实现在第七章碰撞检测讲
    if player:enemyBelow() and buf:justPressed("jump") then
        player.jc_count = player.jc_count + 1
        player:setState(40)  -- 重新进入跳跃（刷新滞空，鬼泣核心机制）
    end
end

-- states/50.lua（落地）：清零空中相关变量
function State:onEnter(player)
    player.jc_count = 0
end
```

**例子 4：魔人槽（资源管理）**

命中时加魔人槽需要命中系统（第八章讲），这里只展示**大招消耗**和**trigger 检查资源**：

```lua
-- states/3900.lua（大招）：进入时消耗魔人槽
function State:onEnter(player)
    player.devil_trigger = player.devil_trigger - 500  -- 消耗 500
end

-- trigger entry 里检查资源够不够
{
    name = "judgement_cut_end",
    changeState = 3900,
    triggerall = {
        cmd("DDD_ab"),
        function(p) return p.devil_trigger >= 500 end,  -- 资源够才能出
    },
    triggers = { { T.ctrl } },
}

-- 命中时加魔人槽的逻辑在第八章命中系统讲（命中回调里 player.devil_trigger += 10）
```

**例子 5：蓄力计时**

```lua
-- 蓄力状态：每帧加蓄力时间
function State:onUpdate(player, dt)
    player.charge_time = (player.charge_time or 0) + 1
    -- 蓄满 30 帧可以释放
    if player.charge_time >= 30 then
        player.charge_ready = true
    end
end

-- 释放时检查是否蓄满
function State:onFrame(player, frame, buf)
    if not buf:held("attack") then
        if player.charge_ready then
            player:setState(300)  -- 蓄力释放
        else
            player:setState(0)    -- 没蓄满直接回站立
        end
    end
end

-- 进入蓄力状态时重置
function State:onEnter(player)
    player.charge_time = 0
    player.charge_ready = false
end
```

**例子 6：攻击阶段标记**

不依赖命中回调（第八章讲），用状态自己能控制的"阶段标记"：

```lua
-- states/200.lua（攻击1）：用变量标记当前阶段
function State:onEnter(player)
    player.attack_phase = "startup"   -- 起手阶段
end

function State:onUpdate(player, dt)
    -- 根据状态时间标记阶段（判定帧在第5-10帧）
    if player.state_time == 5 then
        player.attack_phase = "active"    -- 判定帧开始（hitbox 生效）
    elseif player.state_time == 10 then
        player.attack_phase = "recovery"  -- 收招阶段（hitbox 消失）
    end
end

-- onFrame 里根据阶段决定能否取消
function State:onFrame(player, frame, buf)
    -- 收招阶段可以取消（取消窗口）
    if player.attack_phase == "recovery" and buf:justPressed("attack") then
        player:setState(201)  -- 切下一段攻击
    end
end
```

这种"阶段标记"完全在状态回调里控制，不依赖外部系统。后面第八章讲命中系统时，命中回调里也可以读 `player.attack_phase` 判断是哪一阶段打中的。

#### 辅助方法的使用场景

大部分变量操作直接用命名字段。`setVar/addVar/getVar` 辅助方法只在以下场景用：

```lua
-- 场景 1：动态 key（运行时才知道变量名）
local key = "weapon_" .. player.weapon_slot
player:setVar(key, true)

-- 场景 2：遍历所有变量（序列化/存档）
for key, val in pairs(player.vars) do
    saveData(key, val)
end

-- 场景 3：Lua 脚本动态加载的变量（mod 系统）
-- 比如玩家自制角色定义了自定义变量
```

#### 类型注解（配合附录 F.9）

用 LuaCATS 给变量加类型，IDE 能补全和检查：

```lua
---@class Player
---@field combo_count integer       -- 连击数
---@field weapon string             -- 当前武器 "sword"/"fist"/"gun"
---@field jc_count integer          -- JC 次数
---@field devil_trigger integer     -- 魔人槽（0-1000）
---@field charge_time integer       -- 蓄力帧数
---@field charge_ready boolean      -- 蓄力完成
---@field attack_phase string       -- 攻击阶段 "startup"/"active"/"recovery"
---@field vars table<string, any>   -- 动态变量表（序列化用）
```

### 3.11 状态类型类

#### StateTypeSet（改状态类型和物理）

```ini
; MUGEN：改为空中类型 + 空中物理
[State 200, 起跳]
type = StateTypeSet
trigger1 = time = 0
statetype = A
physics = A
```

```lua
-- Love2D
player:stateTypeSet("A", "A")    -- stateType=A, physics=A
player:stateTypeSet("S", nil)    -- 只改 stateType，physics 不变
```

**用途**：同一状态中途改类型。比如攻击状态起跳：地面攻击→中途起跳→变成空中攻击。

通常不需要用这个——直接 ChangeState 到新状态更清晰。StateTypeSet 用于"不想切状态但要改物理"的特殊场景（比如被击状态从站立被打到空中，不切状态只改 physics）。

### 3.12 转身类

#### Turn（转身）

```ini
; MUGEN：转身
[State 0, 转身]
type = Turn
trigger1 = command = "holdback"
trigger1 = p2bodydist X < 30    ; 对手在身后 30 像素内
```

```lua
-- Love2D
player:turn()                -- facing *= -1
```

Turn 就是翻转 facing（1↔-1）。通常在锁定目标转向、被越过时调用。鬼泣有锁定系统，Turn 由锁定逻辑自动处理，状态里少用。

### 3.13 特殊标志类（简略）

#### AssertSpecial（声明特殊标志）

```ini
; MUGEN：声明不可被投
[State 200, 不可投]
type = AssertSpecial
trigger1 = 1
flag = unthrowable
```

```lua
-- Love2D
player:assertSpecial("unthrowable")
player:clearSpecial("unthrowable")  -- 清除
```

常用标志：

| 标志 | 作用 |
|---|---|
| `unthrowable` | 不可被投 |
| `nodamage` | 不受伤害 |
| `noautoturn` | 不自动转身 |
| `invisible` | 不可见 |
| `noshadow` | 无阴影 |

AssertSpecial 每帧重置（第一章 hitpause 那节讲过），所以要在 -2 层持续声明：

```lua
function State:updateFlags(player)  -- -2 层
    player:assertSpecial("unthrowable")  -- 每帧声明
end
```

#### HitBy / NotHitBy（无敌帧，第十章详讲）

```ini
; MUGEN：5 帧内无敌
[State 200, 无敌]
type = NotHitBy
trigger1 = time = 0
value = 2           ; 2 帧无敌
```

```lua
-- Love2D（第十章实现）
player:notHitBy(2)           -- 2 帧无敌
```

第十章详细讲。

### 3.14 Player 类的 SCTRL 方法实现

把上面所有 SCTRL 整合到 Player 类：

```lua
-- player.lua：Player 类的 SCTRL 方法
local Player = {}
Player.__index = Player

-- ===== 状态切换 =====
function Player:setState(no, ctrl)
    local newState = self.states[no]
    if not newState then error("状态不存在: " .. no) end
    if self.state.onExit then self.state:onExit(self) end
    self.prevStateNo = self.stateNo  -- ★ 记录前一个状态号
    self.stateNo = no
    self.state = newState
    self.state_time = 0
    self.state_changed = true
    if newState.onEnter then newState:onEnter(self) end
    if newState.anim then self:changeAnim(newState.anim) end
    if ctrl ~= nil then self.ctrl = ctrl
    elseif newState.ctrl ~= nil then self.ctrl = newState.ctrl end
end

function Player:selfState(no)
    self:setState(no, true)  -- 简化：强制给控制权
end

-- ===== 速度 =====
function Player:velSet(x, y)
    if x ~= nil then self.vx = x end
    if y ~= nil then self.vy = y end
end

function Player:velAdd(x, y)
    if x ~= nil then self.vx = self.vx + x end
    if y ~= nil then self.vy = self.vy + y end
end

function Player:velMul(x, y)
    if x ~= nil then self.vx = self.vx * x end
    if y ~= nil then self.vy = self.vy * y end
end

-- ===== 位置 =====
function Player:posSet(x, y)
    if x ~= nil then self.x = x end
    if y ~= nil then self.y = y end
end

function Player:posAdd(x, y)
    if x ~= nil then self.x = self.x + x end
    if y ~= nil then self.y = self.y + y end
end

-- ===== 动画 =====
function Player:changeAnim(animId)
    self.anim = self.animations[animId]
    self.anim_frame = 1
    self.anim_tick = 0
    self.anim_finished = false
end

-- ===== 控制权 =====
function Player:ctrlSet(value)
    self.ctrl = value
end

-- ===== 变量（辅助方法，大部分时候直接用命名字段） =====
function Player:setVar(key, val)
    self.vars = self.vars or {}
    self.vars[key] = val
end

function Player:addVar(key, val)
    self.vars = self.vars or {}
    self.vars[key] = (self.vars[key] or 0) + val
end

function Player:getVar(key)
    return self.vars and self.vars[key]
end

-- ===== 状态类型 =====
function Player:stateTypeSet(stateType, physics)
    if stateType then self.state.stateType = stateType end
    if physics then self.state.physics = physics end
end

-- ===== 转身 =====
function Player:turn()
    self.facing = -self.facing
end

-- ===== 特殊标志 =====
function Player:assertSpecial(flag)
    self.specialFlags = self.specialFlags or {}
    self.specialFlags[flag] = true
end

function Player:hasSpecial(flag)
    return self.specialFlags and self.specialFlags[flag]
end

function Player:clearSpecialFlags()
    self.specialFlags = {}  -- 每帧重置（-2 层调）
end

return Player
```

### 3.15 完整例子：用 SCTRL 重写攻击状态

把第二章的裸代码换成 SCTRL 方法调用：

```lua
-- states/200.lua：攻击1（用 SCTRL 重写）
local State = {}
State.stateNo   = 200
State.stateType = "S"
State.physics   = "S"
State.moveType  = "A"        -- 攻击
State.anim      = "attack_1"
State.ctrl      = false      -- 进入时关控制权

function State:onEnter(player)
    -- 进入状态：设速度、改变量（用 SCTRL）
    player:velSet(0, 0)              -- VelSet：停下
    player.combo_count = player.combo_count + 1  -- 连击数 +1（直接用命名字段）
end

function State:onFrame(player, frame, buf)
    -- 第 8-15 帧是取消窗口
    -- 注意：不需要 ctrlSet(true)，取消不看 ctrl（§3.9 讲过）
    if frame >= 8 and frame <= 15 then
        -- trigger entry 里不带 T.ctrl 的取消能触发
        -- 这里可以检测取消（cancel_windows，input 文档讲过）
    end
end

function State:onUpdate(player, dt)
    -- 动画结束 → 切回站立
    if player.anim_finished then
        player:setState(0)           -- ChangeState：回站立（setState 内部设 ctrl=true）
        return
    end

    -- 第 20 帧产生向前位移（挥刀前冲）
    if player.state_time == 20 then
        player:velSet(2.0, 0)        -- VelSet：前冲速度
    end

    -- 第 25 帧停止
    if player.state_time == 25 then
        player:velSet(0, 0)          -- VelSet：停住
    end
end

return State
```

对比第二章的裸代码：

```lua
-- 第二章：裸代码（没有 SCTRL 封装）
function State:onEnter(player)
    player.vx = 0           -- 直接改字段
    player.combo_count = player.combo_count + 1
end

-- 第三章：用 SCTRL 方法
function State:onEnter(player)
    player:velSet(0, 0)     -- 有名字的操作
    player.combo_count = player.combo_count + 1  -- 命名变量
end
```

**SCTRL 封装的好处**：
1. **可读性**：`velSet(0,0)` 比 `player.vx = 0` 更明确"在设速度"
2. **一致性**：所有操作走统一接口，方便日志/调试/网络同步
3. **扩展性**：VelSet 里可以加额外逻辑（如记录速度变化历史）

### 3.16 SCTRL 速查表

| SCTRL | MUGEN 写法 | Love2D 方法 | 说明 |
|---|---|---|---|
| ChangeState | `type=ChangeState, value=20` | `player:setState(20)` | 切状态 |
| SelfState | `type=SelfState, value=20` | `player:selfState(20)` | 强制切状态 |
| VelSet | `type=VelSet, x=3, y=0` | `player:velSet(3, 0)` | 设绝对速度 |
| VelAdd | `type=VelAdd, y=0.4` | `player:velAdd(0, 0.4)` | 加速度（重力等） |
| VelMul | `type=VelMul, x=0.8` | `player:velMul(0.8, 1)` | 乘速度（摩擦力） |
| PosSet | `type=PosSet, x=100, y=400` | `player:posSet(100, 400)` | 设绝对位置 |
| PosAdd | `type=PosAdd, x=5` | `player:posAdd(5, 0)` | 加位置（瞬移） |
| ChangeAnim | `type=ChangeAnim, value=200` | `player:changeAnim("attack_1")` | 切动画 |
| CtrlSet | `type=CtrlSet, value=0` | `player:ctrlSet(false)` | 设控制权（角色是否自由可控） |
| VarSet | `type=VarSet, v=0, value=1` | `player.combo_count = 1` | 设变量（用命名字段） |
| VarAdd | `type=VarAdd, v=0, value=1` | `player.combo_count = player.combo_count + 1` | 加变量 |
| StateTypeSet | `type=StateTypeSet, statetype=A` | `player:stateTypeSet("A", "A")` | 改状态类型 |
| Turn | `type=Turn` | `player:turn()` | 转身 |
| AssertSpecial | `type=AssertSpecial, flag=noautoturn` | `player:assertSpecial("noautoturn")` | 特殊标志 |
| NotHitBy | `type=NotHitBy, value=2` | `player:notHitBy(2)` | 无敌帧（第十章） |

### 3.17 本章总结

| 概念 | MUGEN | Love2D |
|---|---|---|
| SCTRL 是什么 | 状态控制器的标准化封装 | Player 类的方法 |
| 语法 | 声明式（`type=X, trigger1=Y`） | 命令式（`player:x(params)`） |
| trigger | 写在 SCTRL 里 | 写在 if 判断里 |
| 常用数量 | 100+ | 15 个够用 |
| 执行 | 引擎解析执行 | 直接方法调用 |

**关键点**：
1. **Love2D 里 SCTRL = Player 方法**，不需要解析器
2. **15 个 SCTRL 够用**：状态切换(2) + 速度位置(5) + 动画(1) + 控制(2) + 变量(2) + 转身(1) + 标志(2)
3. **VelSet/VelAdd/VelMul 区分**：绝对/增量/比例，分别用于初速度/重力/摩擦力
4. **CtrlSet 控制输入响应**：攻击中关、可取消窗口开
5. **变量用命名字段**：`player.combo_count` 比 `player.vars[0]` 清晰，IDE 能补全

**下一步**：第四章讲 Trigger（触发器），把"什么时候执行 SCTRL"的条件系统化。第二章和第三章的 if 判断对应 MUGEN 的 trigger，第四章把它整理成完整的速查表。

---

*第三章完。SCTRL 是状态里"做什么"的工具箱，第四章的 Trigger 决定"什么时候做"。*

---

## 第四章：Trigger 基础（触发器）

第三章的 SCTRL 决定"做什么"（设速度、切动画），这一章的 Trigger 决定"什么时候做"（第几帧、什么状态、命中了没）。

### 4.1 什么是 Trigger

Trigger 是 SCTRL 的执行条件。MUGEN 里每个 SCTRL 都带 trigger，满足才执行：

```ini
; MUGEN：trigger1 满足时才执行 VelSet
[State 0, 设速度]
type = VelSet
trigger1 = command = "holdfwd"    ; ← 这就是 trigger：按住前时执行
x = 2.5
```

对应 Love2D 就是 if 判断：

```lua
-- Love2D：if 条件满足时才执行
if buf:held("fwd") then        -- ← 对应 trigger1 = command = "holdfwd"
    player:velSet(2.5, 0)       -- ← 对应 type = VelSet, x = 2.5
end
```

**Trigger 本质就是 if 条件**。Love2D 不需要特殊的 trigger 语法，用 Lua 的 if 就行。但 MUGEN 有 50+ 个 trigger 关键字，值得整理成速查表，方便对照。

### 4.2 MUGEN 的 Trigger 语法

#### triggerall 和 triggerN

MUGEN 用 `triggerall` 和 `trigger1/2/3...` 组织条件：

```ini
[State -1, 大招]
type = ChangeState
value = 3900
triggerall = command = "DDD_ab"       ; 全局条件1（所有 trigger 组都要满足）
triggerall = power >= 2000            ; 全局条件2
triggerall = statetype != A           ; 全局条件3
trigger1 = ctrl                       ; 途径1：有控制权直接出
trigger2 = stateno = 200 && movecontact  ; 途径2：攻击命中取消
trigger3 = stateno = 400 && movecontact  ; 途径3：空中攻击命中取消
```

逻辑结构：

```
if triggerall_1 && triggerall_2 && triggerall_3 then
    if trigger1_1 then          → 执行 SCTRL
    elseif trigger2_1 && trigger2_2 then  → 执行 SCTRL
    elseif trigger3_1 && trigger3_2 then  → 执行 SCTRL
    end
end
```

- `triggerall`：所有组都要满足（AND）
- `triggerN`：第 N 组，组间 OR，组内 AND
- 任一 triggerN 组满足 → 执行 SCTRL

#### 逻辑运算符

| MUGEN | 含义 | Love2D |
|---|---|---|
| `&&` | 与 | `and` |
| `\|\|` | 或 | `or` |
| `!` | 非 | `not` |

```ini
; MUGEN
trigger1 = stateno = 200 && movecontact && time >= 8
trigger2 = !ctrl && power >= 1000
```

```lua
-- Love2D
if player.stateNo == 200 and player:moveContact() and player.state_time >= 8 then ... end
if not player.ctrl and player.devil_trigger >= 1000 then ... end
```

### 4.3 和附录 F trigger entry 的关系

附录 F 讲了 trigger entry 的**结构**（triggerall 数组 + triggers 数组），第四章讲每个 trigger 的**内容**（每个条件怎么判断）。

对应关系：

```
附录 F 的 trigger entry 结构：
{
    triggerall = { ... },     ← 第四章的 trigger 填这里
    triggers = { { ... }, { ... } },  ← 第四章的 trigger 填这里
}

第四章的每个 trigger 是一个函数：
function(p) return p.stateNo == 200 end   ← 这就是 trigger1 = stateno = 200
```

第四章结束后，你能把附录 F 里的辅助函数（`T.ctrl`、`cmd()`、`state()` 等）全部用起来。

### 4.4 常用 Trigger 分类

按功能分 8 类：

```
Trigger 分类：
├── 输入类     command / command != / holdxxx
├── 状态类     stateno / statetype / movetype / ctrl / time
├── 命中类     movecontact / movehit / moveguarded
├── 动画类     animelemtime / animtime / animelemno
├── 资源类     power / life / p2life / devil_trigger
├── 位置类     pos x / pos y / p2bodydist x / p2dist y
├── 变量类     var / fvar（第三章讲过，用命名字段）
└── 系统类     roundstate / hitpause / numhelper / numtarget
```

下面逐类讲，每个给 MUGEN 写法 + Love2D 对应 + 辅助函数。

### 4.5 设计原则：混合方式

在逐类讲之前，先明确 trigger 辅助函数的设计原则：

**常用简单布尔用辅助函数，比较运算用内联函数**：

| 场景 | 用什么 | 例子 |
|---|---|---|
| 常用布尔（无参数） | 辅助函数 `T.xxx` | `T.ctrl`、`T.onGround`、`T.moveContact` |
| 常用输入 | 辅助函数 `cmd()` | `cmd("a")` |
| 比较运算（>=, <=, ==） | 内联函数 | `function(p) return p.devil_trigger >= 2000 end` |
| 否定 | 内联 `not` | `function(p) return not p:command("holddown") end` |
| 嵌套 | 内联 `and`/`or` | `function(p) return p.ctrl and p.stateNo == 200 end` |

**不为每个比较运算符定义版本**（避免 `powerGte`/`powerLt`/`p2distLte`/`p2distGt` 爆炸），否定和嵌套直接用 Lua 原生 `not`/`and`/`or`（比 `notT`/`andT`/`orT` 组合器直观）。

### 4.6 输入类

#### command（命令匹配）

```ini
; MUGEN
trigger1 = command = "QCF_a"        ; 搓出了波动拳
trigger1 = command != "holddown"    ; 没按住下
```

```lua
-- 辅助函数（只定义肯定版本）
local function cmd(name) return function(p) return p:command(name) end end

-- 用法
triggerall = {
    cmd("QCF_a"),                                           -- command = "QCF_a"（辅助函数）
    function(p) return not p:command("holddown") end,       -- command != "holddown"（内联否定）
}
```

#### holdxxx（按住方向）

```lua
-- 用 cmd() 或直接读 buffer
triggerall = {
    cmd("holdfwd"),                             -- 按住前（走命令系统）
    function(p) return p:held("fwd") end,       -- 按住前（直接读 buffer）
}
```

### 4.7 状态类

#### stateno（当前状态号）

```ini
; MUGEN
trigger1 = stateno = 200           ; 当前在状态 200
trigger2 = stateno = [200, 202]    ; 当前在 200-202 范围
```

```lua
-- 内联：任意比较运算符直接用
triggers = {
    { function(p) return p.stateNo == 200 end, T.moveContact },                    -- stateno = 200
    { function(p) return p.stateNo >= 200 and p.stateNo <= 202 end, T.moveContact }, -- stateno = [200,202]
}
```

#### statetype / movetype（状态类型和移动类型）

```lua
-- 辅助函数（简单布尔）
local T = {
    onGround  = function(p) return p.state.stateType ~= "A" end,  -- statetype != A
    inAir     = function(p) return p.state.stateType == "A" end,  -- statetype = A
    standing  = function(p) return p.state.stateType == "S" end,  -- statetype = S
    lying     = function(p) return p.state.stateType == "L" end,  -- statetype = L
    attacking = function(p) return p.state.moveType == "A" end,   -- movetype = A
    hit       = function(p) return p.state.moveType == "H" end,   -- movetype = H
    idle      = function(p) return p.state.moveType == "I" end,   -- movetype = I
}

-- 否定用内联 not
triggerall = {
    T.onGround,                                  -- statetype != A
    function(p) return p.state.moveType ~= "H" end,  -- movetype != H（内联否定）
}
```

#### ctrl（控制权）

```lua
-- 辅助函数
local T = {
    ctrl = function(p) return p.ctrl end,  -- ctrl
}

-- !ctrl 用内联
triggerall = {
    T.ctrl,                              -- ctrl
    function(p) return not p.ctrl end,   -- !ctrl
}
```

#### time（状态时间）

```lua
-- 内联：直接用 state_time 或 onFrame 的 frame 参数
function State:onFrame(player, frame, buf)
    if frame >= 8 and frame <= 15 then  -- time = [8, 15]
        -- 可取消窗口
    end
end

-- trigger entry 里用内联
triggers = {
    { function(p) return p.state_time >= 8 and p.state_time <= 15 end, T.moveContact },
}
```

### 4.8 命中类

```lua
-- 辅助函数（简单布尔）
local T = {
    moveContact = function(p) return p.moveContact end,  -- movecontact
    moveHit     = function(p) return p.moveHit end,      -- movehit
}

-- 鬼泣不做防御，不用 moveguarded
```

`moveContact`/`moveHit` 是布尔字段，由命中系统（第七章）每帧更新。

### 4.9 动画类

#### animelemtime（动画元素时间）

```ini
; MUGEN
trigger1 = animelemtime(3) >= 0     ; 第3帧已经开始
```

```lua
-- 需要 Player 类实现 animElemTime 方法（第五章详讲）
function Player:animElemTime(n)
    if n < 1 or n > #self.anim.elements then return -1 end
    if self.anim_frame < n then return -1 end
    if self.anim_frame > n then return 999 end
    return self.anim_tick
end

-- trigger entry 里用内联
triggers = {
    { function(p) return p:animElemTime(3) >= 0 end, T.moveContact },  -- animelemtime(3) >= 0
}
```

#### animtime（动画总时间）

```lua
-- 直接用 anim_finished 字段（内联）
triggers = {
    { function(p) return p.anim_finished end },  -- animtime = 0
}
```

### 4.10 资源类

```ini
; MUGEN
trigger1 = power >= 2000            ; 魔人槽够
trigger1 = life > 0                 ; 还活着
trigger1 = p2life <= lifemax * 0.25 ; 对手残血
```

```lua
-- 常用布尔用辅助函数
local T = {
    alive = function(p) return p.life > 0 end,  -- life > 0
}

-- 比较运算用内联
triggerall = {
    function(p) return p.devil_trigger >= 2000 end,                  -- power >= 2000
    function(p) return p.p2life <= p:enemyMaxLife() * 0.25 end,     -- p2life <= lifemax * 0.25
}
```

### 4.11 位置类

```ini
; MUGEN
trigger1 = pos y >= 0               ; 在地面
trigger1 = p2bodydist x <= 30       ; 对手在30像素内
```

```lua
-- 内联：任意比较运算符
triggerall = {
    function(p) return p.y >= p.groundY end,        -- pos y >= 0
    function(p) return p:p2bodyDistX() <= 30 end,   -- p2bodydist x <= 30
    function(p) return p:p2bodyDistX() > 100 end,   -- p2bodydist x > 100（不用定义新函数）
}
```

### 4.12 变量类

第三章讲过了，用命名字段。在 trigger entry 里直接读：

```lua
triggerall = {
    function(p) return p.weapon == "sword" end,      -- 武器是剑
    function(p) return p.combo_count >= 3 end,        -- 连击数 >= 3
    function(p) return p.charge_ready end,            -- 蓄力完成
}
```

### 4.13 系统类

```lua
-- 辅助函数
local T = {
    roundState2 = function(p) return p.roundState == 2 end,  -- roundstate = 2
    hitpause     = function(p) return p.in_hitstop end,      -- hitpause
}

-- 否定用内联
triggerall = {
    function(p) return not p.in_hitstop end,  -- !hitpause
}

-- 实体查询用内联
triggerall = {
    function(p) return p:numHelper(3051) == 0 end,  -- numhelper(3051) = 0
    function(p) return p:numTarget() > 0 end,       -- numtarget > 0
}
```

### 4.14 完整的辅助函数库

方案 C 的辅助函数库非常精简——只保留常用简单布尔和输入，比较运算全用内联：

```lua
-- triggers_lib.lua：trigger 辅助函数库（精简版）
local Lib = {}

-- ===== 无参数布尔条件 =====
Lib.T = {
    -- 状态类
    ctrl        = function(p) return p.ctrl end,
    onGround    = function(p) return p.state.stateType ~= "A" end,
    inAir       = function(p) return p.state.stateType == "A" end,
    standing    = function(p) return p.state.stateType == "S" end,
    lying       = function(p) return p.state.stateType == "L" end,
    attacking   = function(p) return p.state.moveType == "A" end,
    hit         = function(p) return p.state.moveType == "H" end,
    idle        = function(p) return p.state.moveType == "I" end,

    -- 命中类
    moveContact = function(p) return p.moveContact end,
    moveHit     = function(p) return p.moveHit end,

    -- 系统类
    roundState2 = function(p) return p.roundState == 2 end,
    hitpause    = function(p) return p.in_hitstop end,
    alive       = function(p) return p.life > 0 end,
}

-- ===== 带参数的 trigger（只保留输入类）=====
function Lib.cmd(name) return function(p) return p:command(name) end end
function Lib.held(key) return function(p) return p:held(key) end end

return Lib
```

**就这些**。不需要：
- ~~`notT`/`andT`/`orT` 组合器~~ → 用 `not`/`and`/`or`
- ~~`state`/`stateRange`~~ → 用 `p.stateNo == 200`
- ~~`timeGte`/`timeRange`~~ → 用 `p.state_time >= 8`
- ~~`powerGte`~~ → 用 `p.devil_trigger >= 2000`
- ~~`p2distLte`~~ → 用 `p:p2bodyDistX() <= 30`
- ~~`animElemGte`/`animDone`~~ → 用 `p:animElemTime(3) >= 0` / `p.anim_finished`

#### 完整使用例子

```lua
local Lib = require("triggers_lib")
local T = Lib.T
local cmd = Lib.cmd

M.entries = {
    -- 5A：普通攻击
    {
        name = "5A",
        changeState = 200,
        priority = 10,
        triggerall = {
            T.roundState2,                                      -- roundstate = 2
            cmd("a"),                                           -- command = "a"
            function(p) return not p:command("holddown") end,   -- command != "holddown"
            T.onGround,                                         -- statetype != A
        },
        triggers = {
            { T.ctrl },                                                          -- trigger1: ctrl
            { function(p) return p.stateNo == 400 end, T.moveContact },          -- trigger2: 2A命中取消
            { function(p) return p.stateNo == 300 end,
              function(p) return p:animElemTime(13) >= 0 end, T.moveContact },   -- trigger3: 4A特定帧取消
        },
    },

    -- Roman Cancel
    {
        name = "roman_cancel",
        changeState = 6060,
        priority = 80,
        triggerall = {
            function(p) return not p.ctrl end,                   -- !ctrl
            function(p) return p.devil_trigger >= 1000 end,      -- power >= 1000
            function(p) return p.stateNo < 3000 or p.stateNo > 3999 end, -- stateno != [3000,3999]
        },
        triggers = {
            { T.moveContact },                                    -- trigger1: 命中
            { function(p) return p:numTarget() > 0 end },         -- trigger2: 有目标
        },
    },
}
```

#### 什么时候用辅助函数 vs 内联

| 场景 | 用辅助函数 | 用内联 |
|---|---|---|
| 简单布尔 `ctrl`、`movecontact` | ✅ `T.ctrl` | — |
| 输入匹配 `command = "a"` | ✅ `cmd("a")` | — |
| 比较运算 `power >= 2000` | — | ✅ `function(p) return p.devil_trigger >= 2000 end` |
| 否定 `!ctrl` | — | ✅ `function(p) return not p.ctrl end` |
| 嵌套 `A && (B \|\| C)` | — | ✅ `function(p) return A(p) and (B(p) or C(p)) end` |

原则：**能用辅助函数一行写完的用辅助函数，需要比较/否定/嵌套的用内联**。

### 4.15 Trigger 速查表

| 类别 | MUGEN trigger | 含义 | Love2D 写法 |
|---|---|---|---|
| **输入** | `command = "xxx"` | 命令匹配 | `cmd("xxx")` |
| | `command != "xxx"` | 命令不匹配 | `function(p) return not p:command("xxx") end` |
| | `command = "holdfwd"` | 按住前 | `cmd("holdfwd")` |
| **状态** | `stateno = N` | 当前状态号 | `function(p) return p.stateNo == N end` |
| | `stateno = [A,B]` | 状态号范围 | `function(p) return p.stateNo >= A and p.stateNo <= B end` |
| | `statetype != A` | 不在空中 | `T.onGround` |
| | `statetype = A` | 空中 | `T.inAir` |
| | `movetype = A` | 攻击中 | `T.attacking` |
| | `movetype != H` | 没被击 | `function(p) return p.state.moveType ~= "H" end` |
| | `ctrl` | 有控制权 | `T.ctrl` |
| | `!ctrl` | 没控制权 | `function(p) return not p.ctrl end` |
| | `time >= N` | 状态时间≥N | `function(p) return p.state_time >= N end` |
| | `time = [A,B]` | 时间范围 | `function(p) return p.state_time >= A and p.state_time <= B end` |
| **命中** | `movecontact` | 攻击接触过 | `T.moveContact` |
| | `movehit` | 攻击命中 | `T.moveHit` |
| **动画** | `animelemtime(N) >= 0` | 第N帧已开始 | `function(p) return p:animElemTime(N) >= 0 end` |
| | `animtime = 0` | 动画播完 | `function(p) return p.anim_finished end` |
| **资源** | `power >= N` | 魔人槽够 | `function(p) return p.devil_trigger >= N end` |
| | `life > 0` | 活着 | `T.alive` |
| | `p2life <= X` | 对手残血 | `function(p) return p.p2life <= X end` |
| **位置** | `pos y >= 0` | 在地面 | `function(p) return p.y >= p.groundY end` |
| | `p2bodydist x <= N` | 对手距离≤N | `function(p) return p:p2bodyDistX() <= N end` |
| | `p2bodydist x > N` | 对手距离>N | `function(p) return p:p2bodyDistX() > N end` |
| **系统** | `roundstate = 2` | 战斗中 | `T.roundState2` |
| | `hitpause` | 在hitstop | `T.hitpause` |
| | `!hitpause` | 不在hitstop | `function(p) return not p.in_hitstop end` |
| | `numhelper(N) = 0` | 无某helper | `function(p) return p:numHelper(N) == 0 end` |
| | `numtarget > 0` | 有命中目标 | `function(p) return p:numTarget() > 0 end` |
| **逻辑** | `!A` | 取反 | `function(p) return not A(p) end` |
| | `A && B` | 全满足 | 同组多函数 `{A, B}` |
| | `A \|\| B` | 任一满足 | 多组 `{{A}, {B}}` |
| | `A && (B \|\| C)` | 嵌套 | `function(p) return A(p) and (B(p) or C(p)) end` |

### 4.16 逻辑组合速查

| MUGEN | Love2D trigger entry | 含义 |
|---|---|---|
| `triggerall = A, B, C` | `{A, B, C}`（triggerall 数组） | 全局条件全满足 |
| `trigger1/2/3` 各一组 | `{{...}, {...}, {...}}`（triggers 数组） | 任一组满足 |
| `trigger1 = A && B` | 同组多函数 `{A, B}` | 两个都满足 |
| `trigger1 = A \|\| B` | 多组 `{{A}, {B}}` | 任一满足 |
| `trigger1 = !A` | `function(p) return not A(p) end` | 不满足 |
| `trigger1 = A && (B \|\| C)` | `function(p) return A(p) and (B(p) or C(p)) end` | 嵌套逻辑 |

### 4.17 本章总结

| 概念 | MUGEN | Love2D |
|---|---|---|
| Trigger 是什么 | SCTRL 的执行条件 | if 条件 |
| 语法 | `triggerall=X, trigger1=Y` | `{triggerall数组}, {triggers数组}` |
| 逻辑运算 | `&& \|\| !` | `and or not`（内联函数里） |
| 辅助函数 | 不适用 | 13 个 `T.xxx` + 2 个 `cmd()`/`held()` |
| 比较运算 | trigger 关键字 | 内联 `function(p) return ... >= ... end` |
| 组织方式 | 写在 SCTRL 里 | 附录 F 的 trigger entry |

**关键点**：

1. **Trigger 本质就是 if 条件**，Love2D 用 Lua 的 if/and/or/not 替代 MUGEN 的 trigger 语法
2. **混合方式**：常用简单布尔用辅助函数（`T.ctrl`、`cmd("a")`），比较运算用内联函数
3. **不为比较运算符定义版本**：`>=`/`<=`/`>`/`<`/`==` 直接在内联函数里写，避免 `powerGte`/`p2distLte` 爆炸
4. **否定和嵌套用 Lua 原生语法**：`not`/`and`/`or` 比 `notT`/`andT`/`orT` 组合器直观
5. **和附录 F 衔接**：辅助函数和内联函数填进附录 F 的 trigger entry 结构里
6. **鬼泣简化**：不做 `moveguarded`（无防御）、不做 `statetype = C`（无蹲下）

**下一步**：第五章讲动画系统，把 `animelemtime`/`animtime` 这些动画 trigger 的底层实现讲清楚，让动画能正确播放、能在特定帧触发逻辑。

---

*第四章完。Trigger 决定"什么时候做"，第五章的动画系统让"特定帧触发逻辑"有坚实基础。*

---

## 第五章：动画系统

前四章的状态能切了、SCTRL 能调了、trigger 能判断了，但角色还是一堆框框在动。这一章讲动画系统——怎么让角色有正确的画面、怎么在特定帧触发逻辑。

### 5.1 动画和状态的关系

先搞清楚动画（Animation）和状态（State）的关系：

```
状态（State）     动画（Animation）      关系
─────────────    ─────────────────     ──────────────
站立(0)          idle.json             一个状态播一个动画
行走(20)         walk.json             状态切换 → 动画跟着切
跳跃(40)         jump.json             动画播完 → 可能触发状态切
攻击1(200)       attack_1.json         攻击中途可换动画（收招动画）
落地(50)         land.json             动画和状态号不一定要相同
```

**关键设计**：
- 状态定义里有 `anim` 字段，`setState` 时自动切动画
- 动画和状态号**分离**——一个动画可被多个状态用，一个状态可中途换动画
- 动画播完可以触发状态切换（攻击结束→站立），但不是必须（idle 循环播放）

```
状态切换 → 自动切动画              动画播完 → 可触发状态切
─────────────────────             ─────────────────────
setState(200)                     anim_finished → setState(0)
  → changeAnim("attack_1")         → 回站立
  → 播放 attack_1 动画
                                  idle 动画循环 → 不切状态
```

### 5.2 动画数据结构回顾

第一章定义了动画 JSON 格式，这里回顾关键字段：

```json
{
  "id": "attack_1",
  "name": "攻击1",
  "loop": false,
  "elements": [
    {
      "index": 0,
      "duration": 3,
      "sprite": { "type": "single", "path": "sprites/attack_1_00.png", "w": 120, "h": 140 },
      "offset": { "x": -60, "y": -140 },
      "hurtboxes": [ { "id": "h0", "x": -20, "y": -130, "w": 40, "h": 130 } ],
      "hitboxes": [],
      "jcboxes": [],
      "spawnPoints": []
    },
    {
      "index": 1,
      "duration": 4,
      "sprite": { "type": "single", "path": "sprites/attack_1_01.png", "w": 120, "h": 140 },
      "offset": { "x": -60, "y": -140 },
      "hurtboxes": [ ... ],
      "hitboxes": [ { "id": "a0", "x": 40, "y": -100, "w": 50, "h": 40 } ],
      "spawnPoints": [ { "id": "s0", "name": "sword_tip", "x": 80, "y": -80 } ]
    },
    {
      "index": 2,
      "duration": 3,
      "sprite": { "type": "single", "path": "sprites/attack_1_02.png", "w": 120, "h": 140 },
      "offset": { "x": -60, "y": -140 },
      "hurtboxes": [ ... ],
      "hitboxes": [],
      "jcboxes": [],
      "spawnPoints": []
    }
  ]
}
```

关键字段：

| 字段 | 说明 |
|---|---|
| `id` | 动画唯一标识，状态通过 id 引用 |
| `loop` | 是否循环（idle/walk 循环，攻击不循环） |
| `elements` | 帧序列数组 |
| `element.duration` | 这一帧停留几个 tick |
| `element.sprite` | 精灵图来源（single 单张 / sheet 截取） |
| `element.offset` | 图片轴点偏移（图片内对齐到角色根点的坐标） |
| `element.hurtboxes/hitboxes/jcboxes` | 这一帧的碰撞框 |
| `element.spawnPoints` | 这一帧的命名发射点 |

### 5.3 动画播放状态

Player 类需要这些字段跟踪动画播放：

```lua
function Player.new(charData)
    local self = setmetatable({}, Player)
    -- ... 其他字段 ...

    -- 动画播放状态
    self.anim = nil            -- 当前动画数据（AnimationData）
    self.anim_frame = 1        -- 当前帧索引（1起）
    self.anim_tick = 0         -- 当前帧已播放的 tick 数
    self.anim_finished = false -- 动画是否播完（非循环动画最后一帧播完时 true）

    -- 图片缓存
    self.imageCache = {}       -- path → Image（避免重复加载）

    return self
end
```

### 5.4 切换动画：changeAnim

```lua
function Player:changeAnim(animId)
    self.anim = self.animations[animId]
    if not self.anim then
        error("动画不存在: " .. animId)
    end
    self.anim_frame = 1        -- 从第1帧开始
    self.anim_tick = 0         -- tick 清零
    self.anim_finished = false
end
```

`setState` 内部会调 `changeAnim`（根据状态的 `anim` 字段）：

```lua
function Player:setState(no)
    -- ... 退出旧状态、进入新状态 ...
    if newState.anim then
        self:changeAnim(newState.anim)  -- 自动切动画
    end
end
```

### 5.5 动画推进：updateAnim

每帧推进动画播放：

```lua
function Player:updateAnim()
    if not self.anim then return end

    self.anim_tick = self.anim_tick + 1
    local frame = self.anim.elements[self.anim_frame]

    if self.anim_tick >= frame.duration then
        -- 当前帧播完，切下一帧
        self.anim_tick = 0
        self.anim_frame = self.anim_frame + 1

        if self.anim_frame > #self.anim.elements then
            -- 动画播完
            if self.anim.loop then
                self.anim_frame = 1        -- 循环：回到第1帧
            else
                self.anim_frame = #self.anim.elements  -- 非循环：停在最后一帧
                self.anim_finished = true              -- 标记播完
            end
        end
    end
end
```

**循环 vs 非循环**：

```
循环动画（idle, walk）：
  帧1 → 帧2 → 帧3 → 帧1 → 帧2 → 帧3 → ...（永远循环，anim_finished 永远 false）

非循环动画（attack_1, jump）：
  帧1 → 帧2 → 帧3 → 停在帧3，anim_finished = true
  状态的 onUpdate 检查 anim_finished → 切回站立
```

### 5.6 animelemtime 和 animtime 的实现

第四章 trigger 用了 `animelemtime` 和 `animtime`，这里给底层实现。

#### animelemtime(N)

返回"第 N 帧已经播放了多久"。用于"第3帧之后才能取消"这种精确条件。

```lua
function Player:animElemTime(n)
    -- n 是帧索引（1起）
    if n < 1 or n > #self.anim.elements then return -1 end

    if self.anim_frame < n then
        return -1          -- 还没到第 n 帧
    elseif self.anim_frame > n then
        return 999          -- 已经过了第 n 帧（返回大数表示"早就开始了"）
    else
        return self.anim_tick  -- 正好在第 n 帧，返回已播放 tick
    end
end
```

图示：

```
动画 3 帧，每帧 duration=3：

帧:      1     1     1     2     2     2     3     3     3
tick:    0     1     2     0     1     2     0     1     2
                                                         ↑ anim_finished

animElemTime(1):  0    1     2    999   999   999   999   999   999
animElemTime(2): -1   -1    -1     0     1     2    999   999   999
animElemTime(3): -1   -1    -1    -1    -1    -1     0     1     2

trigger: animelemtime(2) >= 0  →  从第4个tick开始为 true（第2帧已开始）
```

#### animtime

返回动画的剩余时间（负数），0 表示播完：

```lua
function Player:animTime()
    if not self.anim then return 0 end

    local remaining = 0
    for i = self.anim_frame, #self.anim.elements do
        if i == self.anim_frame then
            -- 当前帧：剩余 = duration - 已播放
            remaining = remaining + self.anim.elements[i].duration - self.anim_tick
        else
            -- 后续帧：整个 duration
            remaining = remaining + self.anim.elements[i].duration
        end
    end
    return -remaining  -- 负数，和 MUGEN 一致（0 = 播完）
end
```

实际用 `anim_finished` 字段就够了，`animTime` 只在需要精确剩余时间时用（比如"还剩3帧时触发"）。

### 5.7 动画帧事件

**帧事件**：在动画的特定帧触发逻辑。比如：
- 第 2 帧：产生攻击框（hitbox 生效）
- 第 4 帧：播放挥刀音效
- 第 5 帧：从剑尖发射幻影剑
- 第 7 帧：攻击框消失

#### 方式 1：在状态的 onUpdate 里用 animElemTime 判断

```lua
-- states/200.lua：攻击1
function State:onUpdate(player, dt)
    local elem = player.anim_frame  -- 当前帧索引

    -- 第2帧：产生攻击框
    if player:animElemTime(2) == 0 then
        -- hitbox 已经在动画 JSON 里定义了，这里不需要手动产生
        -- 但可以触发音效、特效等
        playSound("slash_swing")
    end

    -- 第5帧：从剑尖发射幻影剑
    if player:animElemTime(5) == 0 then
        local point = player:getSpawnPoint("sword_tip")
        if point then
            EntityManager.spawn("phantom_sword", point.x, point.y)
        end
    end
end
```

`animElemTime(N) == 0` 表示"正好进入第 N 帧的那一 tick"，只触发一次。

#### 方式 2：用 state_time 判断

```lua
function State:onUpdate(player, dt)
    -- state_time 从 0 开始，每帧 +1
    if player.state_time == 4 then
        playSound("slash_swing")
    end
    if player.state_time == 7 then
        EntityManager.spawn("hit_spark", player.x, player.y)
    end
end
```

**方式 1 vs 方式 2**：

| | animElemTime | state_time |
|---|---|---|
| 依赖 | 动画帧 | 状态时间 |
| 动画换帧时 | 自动跟随 | 不跟随 |
| 适用 | 和动画同步的事件 | 和时间同步的事件 |

大部分情况用 `animElemTime`（和动画同步更准确）。如果动画中途换了（比如第5帧切收招动画），`animElemTime` 会跟着新动画走，`state_time` 不会。

#### 方式 3：帧事件表（数据驱动）

如果帧事件很多，可以在状态定义里用数据表：

```lua
-- states/200.lua：用帧事件表
local State = {}
State.stateNo = 200
State.anim = "attack_1"

-- 帧事件表
State.events = {
    { frame = 2, action = "sound",       params = { "slash_swing" } },
    { frame = 2, action = "hitbox_on" },  -- hitbox 生效（动画 JSON 已定义）
    { frame = 5, action = "spawn",       params = { "phantom_sword", "sword_tip" } },
    { frame = 7, action = "hitbox_off" }, -- hitbox 消失
}

function State:onUpdate(player, dt)
    for _, event in ipairs(State.events) do
        if player:animElemTime(event.frame) == 0 then
            State:fireEvent(player, event)
        end
    end
end

function State:fireEvent(player, event)
    if event.action == "sound" then
        playSound(event.params[1])
    elseif event.action == "spawn" then
        local point = player:getSpawnPoint(event.params[2])
        EntityManager.spawn(event.params[1], point.x, point.y)
    elseif event.action == "hitbox_on" then
        -- hitbox 在动画 JSON 里定义，这里标记生效
        player.hitbox_active = true
    elseif event.action == "hitbox_off" then
        player.hitbox_active = false
    end
end
```

数据驱动的好处：事件列表一目了然，不用在 onUpdate 里写一堆 if。

### 5.8 hitbox 的生效时机

hitbox 定义在动画 JSON 的每一帧里，但"生效"需要状态控制：

```
攻击动画 3 帧：
帧0: hitbox = []           ← 起手，没有攻击框
帧1: hitbox = [框A]        ← 判定帧，框A 生效
帧2: hitbox = []           ← 收招，攻击框消失
```

**碰撞检测系统（第七章）怎么用**：

```lua
-- 每帧检测时，取当前动画帧的 hitbox
function Player:getCurrentHitboxes()
    if not self.hitbox_active then return {} end  -- 状态标记：攻击框是否生效
    local frame = self.anim.elements[self.anim_frame]
    return frame.hitboxes or {}
end

function Player:getCurrentHurtboxes()
    -- hurtbox 始终生效（随时能被打）
    local frame = self.anim.elements[self.anim_frame]
    return frame.hurtboxes or {}
end
```

`hitbox_active` 由帧事件控制：判定帧开、收招帧关。这样即使动画 JSON 里某帧有 hitbox，状态也可以决定是否生效（比如攻击被取消了，hitbox 立刻关）。

### 5.9 获取命名发射点

```lua
function Player:getSpawnPoint(name)
    if not self.anim then return nil end
    local frame = self.anim.elements[self.anim_frame]
    for _, point in ipairs(frame.spawnPoints or {}) do
        if point.name == name then
            -- 返回世界坐标（角色位置 + 发射点偏移，考虑朝向）
            return {
                x = self.x + point.x * self.facing,
                y = self.y + point.y,
            }
        end
    end
    return nil
end
```

注意 `x * self.facing`：朝向左时发射点 x 翻转。

```lua
-- 用法：从剑尖发射幻影剑
local point = player:getSpawnPoint("sword_tip")
if point then
    EntityManager.spawn("phantom_sword", point.x, point.y, player.facing)
end
```

### 5.10 精灵图渲染

#### 单张 PNG

```lua
function Player:draw()
    if not self.anim then return end
    local frame = self.anim.elements[self.anim_frame]
    local sprite = frame.sprite

    -- 加载图片（带缓存）
    local image = self:getImage(sprite)
    if not image then return end

    -- 绘制
    love.graphics.draw(image,
        self.x + frame.offset.x,       -- 屏幕x + 偏移
        self.y + frame.offset.y,       -- 屏幕y + 偏移
        0,                              -- 旋转
        self.facing, 1                  -- x缩放(朝向), y缩放
    )
end

-- 带缓存的图片加载
function Player:getImage(sprite)
    local key = sprite.path
    if not self.imageCache[key] then
        if sprite.type == "single" then
            self.imageCache[key] = love.graphics.newImage(sprite.path)
        elseif sprite.type == "sheet" then
            -- Sprite Sheet：加载大图 + 创建 Quad
            local atlas = love.graphics.newImage(sprite.path)
            local quad = love.graphics.newQuad(
                sprite.region.x, sprite.region.y,
                sprite.region.w, sprite.region.h,
                atlas:getDimensions()
            )
            self.imageCache[key] = { image = atlas, quad = quad }
        end
    end
    return self.imageCache[key]
end
```

#### Sprite Sheet

Sprite Sheet 是多帧打包在一张大图里，用 Quad 截取：

```lua
function Player:draw()
    -- ...
    local spriteData = self:getImage(sprite)
    if sprite.type == "single" then
        -- 单张：直接 draw
        love.graphics.draw(spriteData,
            self.x + frame.offset.x, self.y + frame.offset.y,
            0, self.facing, 1)
    elseif sprite.type == "sheet" then
        -- Sheet：用 Quad 截取
        love.graphics.draw(spriteData.image, spriteData.quad,
            self.x + frame.offset.x, self.y + frame.offset.y,
            0, self.facing, 1)
    end
end
```

图示：

```
Sprite Sheet（vergil_atlas.png）：
┌──┬──┬──┐
│00│01│02│   帧0: region(0, 0, 120, 140)
├──┼──┼──┤   帧1: region(120, 0, 120, 140)
│03│04│05│   帧2: region(240, 0, 120, 140)
└──┴──┴──┘   ...

Quad 截取后渲染效果和单张 PNG 一样
```

#### 朝向翻转

`self.facing` 是 1（右）或 -1（左）。`love.graphics.draw` 的 x 缩放参数传 `self.facing`：

```lua
love.graphics.draw(image, x, y, 0, self.facing, 1)
-- facing=1: 正常绘制
-- facing=-1: 水平翻转
```

**注意 offset**：翻转时图片以 offset 点为轴翻转。offset 是图片左上角相对角色根点的位置，翻转后角色根点不变，图片镜像：

```
facing = 1（朝右）：          facing = -1（朝左）：
     ┌────────┐                   ┌────────┐
     │   角色  │                   │  角色   │
     │        │                   │        │
     └────────┘                   └────────┘
     ↑                             ↑
     根点(0,0)                     根点(0,0)
     图片在根点右侧                 图片镜像到左侧
```

### 5.11 动画中断与恢复

状态切换时动画怎么处理：

#### 场景 1：攻击取消（attack_1 → attack_2）

```
attack_1 播到第2帧 → 玩家按攻击 → 取消窗口打开 → setState(201)
→ changeAnim("attack_2") → attack_1 动画中断，从 attack_2 第1帧重新开始
```

**不需要特殊处理**：`changeAnim` 会重置 `anim_frame=1, anim_tick=0`，新动画从头播。旧动画的剩余帧丢弃。

#### 场景 2：攻击结束回站立

```
attack_1 播完 → anim_finished=true → onUpdate 检测到 → setState(0)
→ changeAnim("idle") → idle 从第1帧开始循环
```

#### 场景 3：跳跃落地中断

```
jump 动画播到第3帧（还在空中） → 落地 → setState(50)
→ changeAnim("land") → jump 动画中断，从 land 第1帧开始
```

**核心原则**：每次 `setState` 都会 `changeAnim`，动画从头开始。不需要"恢复"旧动画——新状态有新动画。

### 5.12 完整的 Player 动画相关代码

整合上面所有部分：

```lua
-- player.lua：动画相关部分
local Player = {}
Player.__index = Player

function Player.new(charData)
    local self = setmetatable({}, Player)
    self.animations = charData.animations
    -- ... 其他字段 ...

    -- 动画状态
    self.anim = nil
    self.anim_frame = 1
    self.anim_tick = 0
    self.anim_finished = false
    self.hitbox_active = false
    self.imageCache = {}

    return self
end

-- 切换动画
function Player:changeAnim(animId)
    self.anim = self.animations[animId]
    self.anim_frame = 1
    self.anim_tick = 0
    self.anim_finished = false
    self.hitbox_active = false  -- 切动画时关攻击框
end

-- 每帧推进动画
function Player:updateAnim()
    if not self.anim then return end
    self.anim_tick = self.anim_tick + 1
    local frame = self.anim.elements[self.anim_frame]
    if self.anim_tick >= frame.duration then
        self.anim_tick = 0
        self.anim_frame = self.anim_frame + 1
        if self.anim_frame > #self.anim.elements then
            if self.anim.loop then
                self.anim_frame = 1
            else
                self.anim_frame = #self.anim.elements
                self.anim_finished = true
            end
        end
    end
end

-- animelemtime 实现
function Player:animElemTime(n)
    if n < 1 or n > #self.anim.elements then return -1 end
    if self.anim_frame < n then return -1 end
    if self.anim_frame > n then return 999 end
    return self.anim_tick
end

-- animtime 实现
function Player:animTime()
    if not self.anim then return 0 end
    local remaining = 0
    for i = self.anim_frame, #self.anim.elements do
        if i == self.anim_frame then
            remaining = remaining + self.anim.elements[i].duration - self.anim_tick
        else
            remaining = remaining + self.anim.elements[i].duration
        end
    end
    return -remaining
end

-- 获取当前帧的碰撞框
function Player:getCurrentHitboxes()
    if not self.hitbox_active then return {} end
    local frame = self.anim.elements[self.anim_frame]
    return frame.hitboxes or {}
end

function Player:getCurrentHurtboxes()
    if not self.anim then return {} end
    local frame = self.anim.elements[self.anim_frame]
    return frame.hurtboxes or {}
end

function Player:getCurrentJcboxes()
    if not self.anim then return {} end
    local frame = self.anim.elements[self.anim_frame]
    return frame.jcboxes or {}
end

-- 获取命名发射点（世界坐标）
function Player:getSpawnPoint(name)
    if not self.anim then return nil end
    local frame = self.anim.elements[self.anim_frame]
    for _, point in ipairs(frame.spawnPoints or {}) do
        if point.name == name then
            return {
                x = self.x + point.x * self.facing,
                y = self.y + point.y,
            }
        end
    end
    return nil
end

-- 图片加载（带缓存）
function Player:getImage(sprite)
    local key = sprite.path
    if not self.imageCache[key] then
        if sprite.type == "single" then
            self.imageCache[key] = love.graphics.newImage(sprite.path)
        elseif sprite.type == "sheet" then
            local atlas = love.graphics.newImage(sprite.path)
            local quad = love.graphics.newQuad(
                sprite.region.x, sprite.region.y,
                sprite.region.w, sprite.region.h,
                atlas:getDimensions()
            )
            self.imageCache[key] = { image = atlas, quad = quad }
        end
    end
    return self.imageCache[key]
end

-- 渲染
function Player:draw()
    if not self.anim then return end
    local frame = self.anim.elements[self.anim_frame]
    local sprite = frame.sprite
    local spriteData = self:getImage(sprite)

    if sprite.type == "single" then
        love.graphics.draw(spriteData,
            self.x + frame.offset.x, self.y + frame.offset.y,
            0, self.facing, 1)
    elseif sprite.type == "sheet" then
        love.graphics.draw(spriteData.image, spriteData.quad,
            self.x + frame.offset.x, self.y + frame.offset.y,
            0, self.facing, 1)
    end
end

-- 调试渲染（画碰撞框）
function Player:drawDebug()
    if not self.anim then return end
    local frame = self.anim.elements[self.anim_frame]

    -- hurtbox（蓝）
    love.graphics.setColor(0, 0.5, 1, 0.3)
    for _, box in ipairs(frame.hurtboxes or {}) do
        love.graphics.rectangle("fill",
            self.x + box.x * self.facing, self.y + box.y,
            box.w * self.facing, box.h)
    end

    -- hitbox（红，只在 hitbox_active 时画）
    if self.hitbox_active then
        love.graphics.setColor(1, 0.2, 0.2, 0.3)
        for _, box in ipairs(frame.hitboxes or {}) do
            love.graphics.rectangle("fill",
                self.x + box.x * self.facing, self.y + box.y,
                box.w * self.facing, box.h)
        end
    end

    -- jcbox（紫）
    love.graphics.setColor(1, 0, 1, 0.3)
    for _, box in ipairs(frame.jcboxes or {}) do
        love.graphics.rectangle("fill",
            self.x + box.x * self.facing, self.y + box.y,
            box.w * self.facing, box.h)
    end

    -- spawnPoints（黄点）
    love.graphics.setColor(1, 0.8, 0, 1)
    for _, point in ipairs(frame.spawnPoints or {}) do
        love.graphics.circle("fill",
            self.x + point.x * self.facing, self.y + point.y, 3)
    end

    -- 根点（红点）
    love.graphics.setColor(1, 0, 0, 1)
    love.graphics.circle("fill", self.x, self.y, 3)

    love.graphics.setColor(1, 1, 1, 1)
end

return Player
```

### 5.13 完整的攻击状态例子

结合动画系统写一个完整的攻击状态：

```lua
-- states/200.lua：攻击1（完整版）
local State = {}
State.stateNo   = 200
State.stateType = "S"
State.physics   = "S"
State.moveType  = "A"
State.anim      = "attack_1"
State.ctrl      = false

-- 帧事件表
State.events = {
    { elem = 2, action = "sound",      params = { "slash_swing" } },
    { elem = 2, action = "hitbox_on" },
    { elem = 2, action = "spawn",      params = { "slash_effect", "sword_tip" } },
    { elem = 4, action = "hitbox_off" },
}

function State:onEnter(player)
    player:velSet(0, 0)
    player.hitbox_active = false
end

function State:onFrame(player, frame, buf)
    -- 第 3-5 帧是取消窗口（取消不看 ctrl，§3.9 讲过）
    if player:animElemTime(3) >= 0 and player:animElemTime(5) < 0 then
        -- trigger entry 里的取消条件会在这区间检查
        -- 比如 5AA: { function(p) return p.stateNo == 200 end, T.moveContact }
    end
end

function State:onUpdate(player, dt)
    -- 触发帧事件
    for _, event in ipairs(State.events) do
        if player:animElemTime(event.elem) == 0 then
            State:fireEvent(player, event)
        end
    end

    -- 动画播完 → 回站立
    if player.anim_finished then
        player:setState(0)
    end
end

function State:fireEvent(player, event)
    if event.action == "sound" then
        playSound(event.params[1])
    elseif event.action == "hitbox_on" then
        player.hitbox_active = true
    elseif event.action == "hitbox_off" then
        player.hitbox_active = false
    elseif event.action == "spawn" then
        local point = player:getSpawnPoint(event.params[2])
        if point then
            EntityManager.spawn(event.params[1], point.x, point.y, player.facing)
        end
    end
end

return State
```

### 5.14 本章总结

| 概念 | 说明 |
|---|---|
| 动画和状态关系 | 状态有 `anim` 字段，`setState` 自动 `changeAnim` |
| 动画播放 | `anim_frame` + `anim_tick` 推进，`anim_finished` 标记播完 |
| 循环 vs 非循环 | `loop=true` 循环回第1帧，`loop=false` 停在最后一帧 |
| animelemtime(N) | 第 N 帧已播放多久，用于"第N帧之后才能取消" |
| animtime | 剩余时间（负数），0 = 播完 |
| 帧事件 | 在特定帧触发逻辑（音效/特效/hitbox开关），用 `animElemTime(N) == 0` 检测 |
| hitbox 生效 | 动画 JSON 定义 hitbox，`hitbox_active` 标记是否生效 |
| spawnPoints | 命名发射点，`getSpawnPoint("sword_tip")` 获取世界坐标 |
| 精灵图渲染 | 单张 PNG 直接 draw，Sprite Sheet 用 Quad 截取 |
| 朝向翻转 | `love.graphics.draw` 的 x 缩放传 `self.facing` |
| 动画中断 | `changeAnim` 重置从头播，旧动画剩余帧丢弃 |

**关键点**：

1. **动画和状态分离**：状态定义 `anim` 字段，`setState` 自动切动画。一个动画可被多状态用，一个状态可中途 `changeAnim` 换动画
2. **animelemtime 是核心 trigger**：精确控制"第几帧做什么"，用于取消窗口、帧事件
3. **hitbox_active 控制生效**：动画 JSON 定义 hitbox 形状，状态用 `hitbox_active` 控制何时生效
4. **帧事件用 animElemTime(N)==0 检测**：只触发一次，精确到 tick
5. **Sprite Sheet 用 Quad**：多帧打包一张大图，截取渲染，和单张 PNG 效果一样

**下一步**：第六章讲物理系统（速度/重力/摩擦/落地），让角色能正确地走、跑、跳、落地。

---

*第五章完。动画系统让角色有画面、能在特定帧触发逻辑，第六章的物理系统让角色能动起来。*




