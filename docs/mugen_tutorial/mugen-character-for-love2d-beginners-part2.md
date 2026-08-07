# 给新人：从 MUGEN 角色系统到 Love2D 2D 横版鬼泣（Part 2）

> 这篇文档承接 `mugen-character-for-love2d-beginners.md`（Part 1）。
>
> Part 1 讲了：角色文件结构（第一章）、状态系统（第二章）、SCTRL（第三章）、Trigger（第四章）、动画系统（第五章）。
>
> Part 2 从第六章开始，讲物理系统、碰撞检测、命中系统、特效系统、高级系统、鬼泣特色系统。

---

## 第六章：物理系统

前五章角色有状态、有动画了，但移动还是"按方向直接设速度"。这一章讲物理系统——速度怎么更新、重力怎么作用、摩擦力怎么减速、locomotion 怎么做得丝滑。

### 6.1 物理系统做什么

物理系统每帧更新角色的位置和速度：

```
每帧 update：
  1. 根据 Physics 类型更新速度
     ├─ Physics=S（地面）：摩擦力减速
     ├─ Physics=A（空中）：重力下落
     └─ Physics=N（无物理）：不自动更新
  2. 速度更新位置：x += vx, y += vy
  3. 地面检测：空中落地时切状态
  4. 边界限制：不能出屏幕
```

### 6.2 速度和位置更新

第二章的 `updatePhysics` 是简化版，这里完善：

```lua
function Player:updatePhysics(dt)
    local phys = self.state.physics

    -- 1. 根据 Physics 类型更新速度
    if phys == "S" then
        -- 地面物理：y 固定在地面，x 加摩擦力
        self.y = self.groundY
        self:applyFriction()

    elseif phys == "A" then
        -- 空中物理：重力
        self.vy = self.vy + self.config.gravity
        -- 可选：终端速度（vy 不超过某值）
        if self.vy > 20 then self.vy = 20 end

    elseif phys == "N" then
        -- 无物理：不自动更新速度
        -- 由状态自己用 VelSet/VelAdd 控制
    end

    -- 2. 速度更新位置
    self.x = self.x + self.vx
    self.y = self.y + self.vy

    -- 3. 地面检测
    if self.y >= self.groundY then
        self.y = self.groundY
        self:onLand()
    end

    -- 4. 边界限制
    self:applyScreenBound()
end
```

### 6.3 摩擦力：按 moveType 区分

计划文档里确认了：摩擦力主要是给 locomotion（移动）和被击击退用的，攻击中不用。

```lua
function Player:applyFriction()
    -- 只在地面物理 + 非攻击状态加摩擦力
    local mt = self.state.moveType

    if mt == "I" then
        -- 空闲（locomotion）：摩擦力减速
        self.vx = self.vx * 0.8
        if math.abs(self.vx) < 0.1 then self.vx = 0 end

    elseif mt == "H" then
        -- 被击（击退减速）：摩擦力更大，快速停下
        self.vx = self.vx * 0.7
        if math.abs(self.vx) < 0.1 then self.vx = 0 end

    elseif mt == "A" then
        -- 攻击中：不加摩擦力，速度由 SCTRL 精确控制
        -- 比如 VelSet(2.0, 0) 让角色匀速前冲，不会被摩擦力减速
    end
end
```

| moveType | 加摩擦力？ | 场景 |
|---|---|---|
| I（空闲） | ✅ 0.8 系数 | locomotion 松开方向后减速 |
| H（被击） | ✅ 0.7 系数 | 击退后快速停下 |
| A（攻击） | ❌ | 攻击速度由 VelSet 精确控制 |

#### 摩擦力的完整应用场景

摩擦力不只是 locomotion 用。从 MUGEN 源码（Vergil.cns）看，摩擦力/减速用在很多地方：

| 场景 | MUGEN 做法 | 例子（Vergil.cns 行号） | 我们的做法 |
|---|---|---|---|
| **locomotion 停步** | Physics=S 摩擦力 | `stand.friction=.85` | ~~摩擦力~~ 改用 move_x（§6.6） |
| **被击击退减速** | 每帧 VelMul x=.8 | `11754: VelMul x=.8` | Physics=S + moveType=H，摩擦力 0.7 |
| **攻击前冲减速** | 特定帧 VelMul x=.15 | `5719: VelMul x=.15` | onUpdate 里调 velMul(0.15, 1) |
| **空中攻击水平减速** | VelMul x=.6 | `6239: VelMul x=.6` | onUpdate 里调 velMul（状态主动调，不是摩擦力） |
| **落地后水平减速** | Physics=S 摩擦力 | `stand.friction=.85` | Physics=S + moveType=I，摩擦力 0.8 |

MUGEN 的摩擦力常量（Vergil.cns:57-60）：
```ini
stand.friction = .85         ; 站立时每帧 vx *= 0.85
stand.friction.threshold = 2 ; vx < 2 时直接停
```

**总结**：locomotion 现在用 move_x 不用摩擦力了。摩擦力主要用于：
1. **被击击退**：被打后击退速度逐渐减速（不瞬间停，有惯性）
2. **落地后**：空中落地后水平速度减速
3. **任何 Physics=S + moveType=I/H 的状态**：自动减速

空中减速不是摩擦力——是状态主动调 VelMul（§6.14 惯性系统详讲）。

### 6.4 地面检测和落地处理

```lua
function Player:onLand()
    -- 只在从空中落地时触发
    if self.state.stateType == "A" then
        self:setState(50)  -- 切到落地状态（§2.9 定义）
    end
end
```

落地状态（50）处理：

```lua
-- states/50.lua：落地恢复
local State = {}
State.stateNo   = 50
State.stateType = "S"
State.physics   = "S"
State.moveType  = "I"
State.anim      = "land"
State.ctrl      = false
State.total_frames = 4  -- 落地硬直 4 帧

function State:onEnter(player)
    player:velSet(0, 0)
end

function State:onUpdate(player, dt)
    if player.state_time >= State.total_frames then
        player:setState(0)  -- 回站立
    end
end

return State
```

### 6.5 locomotion 状态机

第二章的 locomotion 是简化版（站立↔行走）。真实的鬼泣 locomotion 更复杂：

#### 完整状态转换图

```
                         ┌──────────────────────────────────────────┐
                         │                                          │
                         ▼                                          │
  ┌──────┐  按方向  ┌──────┐  动画播完  ┌──────┐  松开方向  ┌──────┐│
  │ 站立  │────────→│ 起步  │──────────→│ 行走  │──────────→│ 停步  ││
  │  (0)  │         │  (5)  │           │ (20)  │           │ (22) ││
  │ctrl=✓ │         │ctrl=✗ │           │ctrl=✓ │           │ctrl=✗││
  └──────┘         └──────┘           └──────┘           └──────┘│
     │                  │                  │                  │    │
     │ 按跳              │ 松开方向          │ 按跳/攻击         │播完  │
     │                  │ (直接进停步)      │                  │     │
     ▼                  ▼                  ▼                  ▼     │
  ┌──────┐         ┌──────┐          ┌──────┐              ┌──────┐│
  │ 跳跃  │         │ 停步  │          │ 跳跃  │              │ 站立  ││
  │ (40)  │         │ (22) │          │ (40) │              │ (0)  ││
  └──┬───┘         └──────┘          └──┬───┘              └──────┘│
     │                                 │                           │
     │            重推摇杆/Shift        │                           │
     │            (从行走切)            │                           │
     │                 ▼                │                           │
     │            ┌──────┐  松开方向  ┌──────┐                     │
     │            │ 跑步  │──────────→│ 停步  │                     │
     │            │ (21)  │           │ (22) │                     │
     │            │ctrl=✓ │           └──────┘                     │
     │            └──┬───┘                                         │
     │               │ 按跳/攻击                                    │
     │               ▼                                             │
     │           ┌──────┐                                          │
     │           │ 跳跃  │                                          │
     │           │ (40) │                                          │
     │           └──┬───┘                                          │
     │              │                                               │
     ▼              ▼                                               │
  ┌──────────────────────────────────────────┐                     │
  │           落地 (50) ctrl=✗               │────播完──────────────┘
  │  Physics=S, 4帧硬直                      │
  └──────────────────────────────────────────┘
```

#### 关键转换说明

| 从 | 到 | 条件 | 说明 |
|---|---|---|---|
| 站立(0) | 起步(5) | 按方向 | 起步过渡动画 |
| 起步(5) | 行走(20) | 动画播完 + 不在跑 | 正常进入行走 |
| 起步(5) | 跑步(21) | 动画播完 + 在跑 | 直接进入跑步 |
| 起步(5) | 停步(22) | 松开方向 | 起步中松开，直接进停步 |
| 行走(20) | 跑步(21) | 重推摇杆/Shift | 加速到跑 |
| 跑步(21) | 行走(20) | 松开 Shift/摇杆变轻 | 减速到走 |
| 行走/跑步 | 停步(22) | 松开方向 | 刹车动画 |
| 停步(22) | 站立(0) | 动画播完 | 停住 |
| 站立/行走/跑步 | 跳跃(40) | 按跳 | 起跳 |
| 站立/行走/跑步 | 攻击(200+) | 按攻击 | 出招 |
| 跳跃(40) | 落地(50) | y >= groundY | 系统自动检测落地 |
| 落地(50) | 站立(0) | 4帧硬直结束 | 恢复 |

#### 落地检测：系统自动处理

用户可能问：**"当前速度 > 距地面高度，预判下一帧落地"——需要预判吗？**

**不需要预判**。系统每帧自动检测：

```lua
-- updatePhysics 里自动检测（§6.12）
if self.y >= self.groundY and self.state.stateType == "A" then
    self.y = self.groundY
    self:onLand()  -- 自动调，切到状态 50
end
```

```
帧30: y = -50, vy = 8    → 还在空中
帧31: y = -42, vy = 8.4  → 还在空中
...
帧36: y = -3, vy = 10    → 还在空中
帧37: y = 7, vy = 10.4   → y >= groundY(0) → 自动落地！
```

状态代码不用关心"什么时候落地"——只要 Physics=A + stateType=A，系统自动处理。

**特殊情况：攻击中落地**。如果空中攻击落地需要切到"攻击落地"而不是普通落地（50），状态自己检测：

```lua
-- 空中攻击状态：覆盖落地行为
function State:onUpdate(player, dt)
    if player.y >= player.groundY then
        player:setState(450)  -- 攻击落地状态（不是普通 50）
    end
end
```

#### 状态定义

| 状态号 | 名称 | 作用 | ctrl |
|---|---|---|---|
| 0 | 站立 idle | 静止，循环动画 | ✅ |
| 5 | 起步 start | 过渡动画（1-3帧），不可取消 | ❌ |
| 20 | 行走 walk | 匀速移动，循环动画 | ✅ |
| 21 | 跑步 run | 高速移动，循环动画 | ✅ |
| 22 | 停步 stop | 刹车动画（1-3帧），不可取消 | ❌ |

#### 起步状态

```lua
-- states/5.lua：起步
local State = {}
State.stateNo   = 5
State.stateType = "S"
State.physics   = "N"   -- ★ 用 N，位移由 move_x 驱动
State.moveType  = "I"
State.anim      = "start_walk"
State.ctrl      = false  -- 起步中不可取消

function State:onEnter(player)
    -- 根据输入决定是走还是跑的起步
    if player:isRunning() then
        player:changeAnim("start_run")
        player.start_is_run = true
    else
        player:changeAnim("start_walk")
        player.start_is_run = false
    end
end

function State:onUpdate(player, dt)
    -- move_x 驱动位移（起步动画的 move_x 从小到大，自然加速）
    local frame = player.anim.elements[player.anim_frame]
    if frame.move_x ~= nil then
        player.x = player.x + frame.move_x * player.facing
    end

    -- 起步动画播完 → 切行走/跑步
    if player.anim_finished then
        if player.start_is_run then
            player:setState(21)  -- 跑步
        else
            player:setState(20)  -- 行走
        end
    end
end

return State
```

return State
```

#### 行走状态

```lua
-- states/20.lua：行走
local State = {}
State.stateNo   = 20
State.stateType = "S"
State.physics   = "N"   -- ★ 用 N（无物理），位移由 move_x 驱动
State.moveType  = "I"
State.anim      = "walk"
State.ctrl      = true

function State:onFrame(player, frame, buf)
    local dir = 0
    if buf:held("fwd") then dir = dir + 1 end
    if buf:held("back") then dir = dir - 1 end

    -- 松开方向 → 停步
    if dir == 0 then
        player:setState(22)
        return
    end

    -- 切跑步：重推摇杆 或 Shift 键
    if player:isRunning() then
        player:setState(21)
        return
    end

    -- 设朝向
    if dir > 0 then player.facing = 1
    else player.facing = -1 end

    -- 跳跃/攻击等
    if buf:justPressed("jump") then player:setState(40) return end
end

function State:onUpdate(player, dt)
    -- move_x 驱动位移（防滑步，详见 §6.6）
    local frame = player.anim.elements[player.anim_frame]
    if frame.move_x ~= nil then
        player.x = player.x + frame.move_x * player.facing
    else
        -- 回退：动画没设 move_x，用固定速度
        player.x = player.x + player.config.walk_fwd * player.facing
    end
end

return State
```

#### 跑步状态

```lua
-- states/21.lua：跑步
local State = {}
State.stateNo   = 21
State.stateType = "S"
State.physics   = "N"   -- ★ 用 N，位移由 move_x 驱动
State.moveType  = "I"
State.anim      = "run"
State.ctrl      = true

function State:onFrame(player, frame, buf)
    local dir = 0
    if buf:held("fwd") then dir = dir + 1 end
    if buf:held("back") then dir = dir - 1 end

    -- 松开方向 → 停步
    if dir == 0 then
        player:setState(22)
        return
    end

    -- 切行走：不再跑（松开 Shift 或摇杆变轻）
    if not player:isRunning() then
        player:setState(20)
        return
    end

    -- 设朝向
    if dir > 0 then player.facing = 1
    else player.facing = -1 end
end

function State:onUpdate(player, dt)
    -- move_x 驱动位移
    local frame = player.anim.elements[player.anim_frame]
    if frame.move_x ~= nil then
        player.x = player.x + frame.move_x * player.facing
    else
        player.x = player.x + player.config.run_fwd * player.facing
    end
end

return State
```

#### 停步状态

```lua
-- states/22.lua：停步
local State = {}
State.stateNo   = 22
State.stateType = "S"
State.physics   = "N"   -- ★ 用 N，位移由 move_x 驱动
State.moveType  = "I"
State.anim      = "stop_walk"
State.ctrl      = false  -- 停步中不可取消

function State:onEnter(player)
    -- 根据之前速度决定停步动画
    -- 判断方式：看之前是跑步还是行走
    if player.prevStateNo == 21 then
        player:changeAnim("stop_run")  -- 跑步刹车动画
    end
end

function State:onUpdate(player, dt)
    -- move_x 驱动位移（停步动画的 move_x 从大到小，自然减速到 0）
    local frame = player.anim.elements[player.anim_frame]
    if frame.move_x ~= nil then
        player.x = player.x + frame.move_x * player.facing
    end

    -- 停步动画播完 → 回站立
    if player.anim_finished then
        player:setState(0)
    end
end

return State
```

### 6.6 move_x 与防滑步

上面四个 locomotion 状态都用 `frame.move_x` 驱动位移。这一节详细讲 move_x 是什么、怎么用、为什么能防滑步。

#### 滑步问题

如果动画脚步和实际位移不匹配，角色会"滑步"（像在冰上走）：

```
正常（不滑步）：              滑步（速度太快）：
  帧0: 脚在A → 帧1: 脚在B      帧0: 脚在A → 帧1: 脚在B
       位移 = A→B（匹配）           位移 = A→C（超出B，滑了）

起步滑步：动画还在起手姿态，速度已经是全速
  动画：角色还在准备迈步
  速度：已经是 5.0（全速）
  → 角色滑着走，脚没动但人在移动
```

#### move_x 是位移，不是速度

**move_x 是这一帧的位移（像素数），等价于 MUGEN 的 PosAdd x，不是 VelSet x。**

| | 速度 | 位移 |
|---|---|---|
| MUGEN | `VelSet x=2.5`（设速度，之后每帧移动 2.5） | `PosAdd x=3.0`（这一帧移动 3，只此一次） |
| 我们 | `player:velSet(2.5, 0)` | `move_x = 3.0`（动画帧字段） |
| 持续性 | 持续移动，要手动停 | 每帧由动画数据控制 |

```lua
-- ❌ 错误：把 move_x 当速度
player.vx = frame.move_x * player.facing

-- ✅ 正确：move_x 是位移，直接加位置
player.x = player.x + frame.move_x * player.facing
```

#### move_x 和 PosAdd 的关系

move_x 就是 PosAdd 的数据驱动版：

```lua
-- MUGEN 的 PosAdd（代码驱动，每帧写 trigger）
[State 20, 第1帧位移]
type = PosAdd
trigger1 = animelem = 1
x = 3.0

-- 我们的 move_x（数据驱动，动画 JSON 里设字段）
{ "index": 0, "move_x": 3.0, ... }

-- 运行时自动应用
player.x = player.x + frame.move_x * player.facing
```

用 move_x 就不用再写 PosAdd。两者完全等价，move_x 只是更方便（数据驱动，不用写 trigger）。

#### 动画 JSON 加 move_x 字段

在动画帧里加可选的 `move_x` 字段：

```json
{
  "id": "walk",
  "loop": true,
  "elements": [
    { "index": 0, "duration": 3, "move_x": 2.0, "sprite": {...} },
    { "index": 1, "duration": 3, "move_x": 2.5, "sprite": {...} },
    { "index": 2, "duration": 3, "move_x": 2.5, "sprite": {...} },
    { "index": 3, "duration": 3, "move_x": 2.0, "sprite": {...} }
  ]
}
```

起步动画 move_x 从小到大（加速）：

```json
{ "id": "start_walk", "elements": [
    { "move_x": 0.5, ... },
    { "move_x": 1.5, ... },
    { "move_x": 2.5, ... }
]}
```

停步动画 move_x 从大到小（减速到 0）：

```json
{ "id": "stop_walk", "elements": [
    { "move_x": 2.0, ... },
    { "move_x": 1.0, ... },
    { "move_x": 0.0, ... }
]}
```

**松开方向时怎么停？** 切停步状态，停步动画的 move_x 从大到小自然减速，不需要摩擦力。

#### localcoord 坐标系与缩放

move_x 是 **localcoord 坐标系下的像素数**，不用管渲染缩放：

```
精灵图 120x140（原始像素画）
localcoord = 320（角色在 320 宽坐标系下设计）
move_x = 2.5（localcoord 单位）

渲染时缩放：
  屏幕 1920 宽 → 缩放系数 = 1920/320 = 6
  角色显示 720x840
  实际屏幕移动 = 2.5 * 6 = 15 像素/帧
```

**所有运算在 localcoord 坐标系下做，渲染时统一乘 scale**：

```lua
-- 运算用 localcoord（不乘 scale）
player.x = player.x + frame.move_x * player.facing

-- 渲染时乘 scale
function Player:draw()
    local s = self.config.scale
    love.graphics.draw(image, self.x * s, self.y * s, 0, self.facing * s, s)
end
```

这样不管 scale 多大，角色的移动行为和身体大小的比例不变。

#### 回退逻辑

move_x 是可选字段。没设时回退到固定速度：

```lua
function State:onUpdate(player, dt)
    local frame = player.anim.elements[player.anim_frame]
    if frame.move_x ~= nil then
        -- 动画驱动位移（精确，不滑步）
        player.x = player.x + frame.move_x * player.facing
    else
        -- 回退：固定速度
        player.x = player.x + player.config.walk_fwd * player.facing
    end
end
```

#### 哪些状态用 move_x

| 状态 | 用 move_x？ | 原因 |
|---|---|---|
| 行走/跑步 | ✅ | 循环动画，步伐要匹配 |
| 起步/停步 | ✅ | 加速减速要匹配动画 |
| 跳跃 | ❌ | 用 VelSet + 重力（物理驱动） |
| 攻击 | ❌ | 用 VelSet 精确控制前冲 |
| 被击 | ❌ | 用 VelSet 设击退速度 |
| 站立 | ❌ | 不动 |

**原则**：locomotion 状态用 move_x（Physics=N，位移由动画驱动），非 locomotion 状态用 VelSet（Physics=S/A，位移由物理驱动）。

### 6.7 走 vs 跑的切换

#### 摇杆方案

```lua
function Player:isRunning()
    -- 摇杆推力 > 0.8 或 按住 Shift
    local lx, ly = love.joystick.getAxes(1)
    local push = math.abs(lx)  -- 摇杆 x 轴推力 0.0-1.0
    return push > 0.8 or love.keyboard.isDown("lshift")
end
```

摇杆推力映射：

```
推力 0.0 - 0.5  → 不走（静止）
推力 0.5 - 0.8  → 行走（速度 = walk_fwd）
推力 0.8 - 1.0  → 跑步（速度 = run_fwd）
```

也可以用推力直接控制速度（无级变速）：

```lua
function Player:getWalkSpeed()
    local lx = love.joystick.getAxis(1, 1)  -- x 轴
    local push = math.abs(lx)
    if push < 0.5 then return 0 end           -- 死区
    if push > 0.8 then return self.config.run_fwd end  -- 跑
    -- 0.5-0.8 线性映射到 walk_fwd
    return self.config.walk_fwd * ((push - 0.5) / 0.3)
end
```

#### 键盘方案

键盘没有推力，用 **Shift 键跑步**（推荐方案）：

```lua
function Player:isRunning()
    return love.keyboard.isDown("lshift")
end
```

键盘操作：
- 按方向键：行走
- 按方向键 + Shift：跑步
- 松开方向键：停步

简单直觉，不占用动作键。

### 6.8 加速度/减速度曲线

locomotion 不应该瞬间达到最大速度——有加速段和减速段。**用 move_x 自然实现**，不需要额外代码：

```
瞬间达到（不丝滑）：           有加速（丝滑，move_x 驱动）：
位移  ─────┐                   位移       ┌────── 匀速(move_x=2.5)
            └────── 匀速                 │
                                         ┌──┘  加速段
                                         │
                                         └ 起点(move_x=0.5)
```

起步动画的 move_x 从小到大，自然实现加速：

```json
{ "id": "start_walk", "elements": [
    { "move_x": 0.5, ... },   ← 帧0：慢，刚迈步
    { "move_x": 1.5, ... },   ← 帧1：加速中
    { "move_x": 2.5, ... }    ← 帧2：达到行走速度
]}
```

停步动画的 move_x 从大到小，自然实现减速：

```json
{ "id": "stop_walk", "elements": [
    { "move_x": 2.0, ... },   ← 帧0：还在走
    { "move_x": 1.0, ... },   ← 帧1：减速
    { "move_x": 0.0, ... }    ← 帧2：停住
]}
```

**不需要 approach 函数和摩擦力**——move_x 在动画数据里精确控制了每帧位移，加速减速曲线由动画师在编辑器里调。

`approach` 函数仍然有用，但用于**非 locomotion** 场景（如跳跃的空中水平微调，§6.10）：

```lua
-- 跳跃状态：空中水平微调用 approach（不是 locomotion，不用 move_x）
function State:onFrame(player, frame, buf)
    if buf:held("fwd") then
        player.vx = approach(player.vx, player.config.walk_fwd * 0.8, 0.3)
    end
end
```

### 6.9 边界限制（screenbound，可选）

鬼泣不是格斗游戏，**角色不需要硬限制在屏幕内**——相机跟随角色移动。screenbound 只在特定场景（如关卡边界、墙角）启用：

```lua
function Player:applyScreenBound()
    -- 鬼泣：相机跟随，默认不限制
    if not self.lock_screenbound then return end

    -- 只在特定场景限制（如关卡边界）
    local margin = 30
    if self.x < self.stage_left + margin then
        self.x = self.stage_left + margin
        self.vx = 0
    end
    if self.x > self.stage_right - margin then
        self.x = self.stage_right - margin
        self.vx = 0
    end
end
```

| 场景 | lock_screenbound | 效果 |
|---|---|---|
| 正常关卡 | false | 角色自由移动，相机跟随 |
| 关卡边界/墙角 | true | 角色不能越过边界 |
| 过场/菜单 | true | 角色锁在固定位置 |

相机系统后续章节讲，这里先做可选边界。

### 6.10 跳跃物理

```lua
-- states/40.lua：跳跃起跳
local State = {}
State.stateNo   = 40
State.stateType = "A"
State.physics   = "A"   -- 空中物理（重力）
State.moveType  = "I"
State.anim      = "jump"
State.ctrl      = true

function State:onEnter(player)
    player.vy = player.config.jump_y  -- 跳跃初速度（负=向上）
    player.airjump_count = 0          -- 重置空中跳跃次数
end

function State:onFrame(player, frame, buf)
    -- 空中可以左右微调
    if buf:held("fwd") then
        player.vx = approach(player.vx, player.config.walk_fwd * 0.8, 0.3)
    elseif buf:held("back") then
        player.vx = approach(player.vx, -player.config.walk_back * 0.8, 0.3)
    end

    -- 空中跳跃
    if buf:justPressed("jump")
       and player.airjump_count < player.config.airjump_num
       and player.y < player.groundY - player.config.airjump_height then
        player.airjump_count = player.airjump_count + 1
        player.vy = player.config.jump_y  -- 重新给跳跃速度
        player:changeAnim("airjump")
    end
end

return State
```

跳跃的物理过程：

```
帧0: vy = -12（向上）  ─┐
帧1: vy = -11.6       │ 重力每帧 +0.4
帧2: vy = -11.2       │
...                    │
帧30: vy = 0（最高点） ─┘
帧31: vy = 0.4（开始下落）
...                    │
帧60: vy = 12（落地）  ─┘ → onLand() → setState(50)
```

#### 重力是 localcoord 单位

重力不是 9.8 m/s²，是 **localcoord/帧²**。所有物理量都在 localcoord 坐标系下：

```
player.y  = 100      （localcoord，世界位置）
player.vy = -12      （localcoord/帧，垂直速度）
gravity   = 0.4      （localcoord/帧²，重力加速度）

更新过程（全部 localcoord）：
  vy += gravity        （localcoord/帧 + localcoord/帧²）
  y += vy              （localcoord + localcoord/帧）

渲染时统一乘 scale：
  屏幕 y = player.y * scale
```

#### 调参公式

两个关键参数：

| 参数 | 含义 | 例子 |
|---|---|---|
| `jump_y` | 跳跃初速度（负=向上） | -12 |
| `gravity` | 重力加速度（正=向下） | 0.4 |

两个公式帮你调参：

```
跳跃高度 = jump_y² / (2 * gravity)
跳跃时间 = 2 * |jump_y| / gravity （帧）
```

用 jump_y=-12, gravity=0.4 验证：
```
跳跃高度 = 144 / 0.8 = 180 localcoord
跳跃时间 = 24 / 0.4 = 60 帧 = 1 秒（60fps）
```

#### 调参方法：先定目标，反推参数

**想要：跳跃高度 300 localcoord，跳跃时间 50 帧（约 0.8 秒）**

```
从公式：
  300 = jump_y² / (2 * gravity)
  50 = 2 * |jump_y| / gravity

解方程：
  gravity = 2 * |jump_y| / 50
  300 = jump_y² / (2 * 2 * |jump_y| / 50)
  300 = |jump_y| * 50 / 4
  |jump_y| = 24
  jump_y = -24

  gravity = 2 * 24 / 50 = 0.96
```

验证：
```
高度 = 24² / (2 * 0.96) = 576 / 1.92 = 300 ✓
时间 = 2 * 24 / 0.96 = 50 帧 ✓
```

#### 参考量级

| 角色身高(localcoord) | 建议跳跃高度 | 建议跳跃时间 | 参考参数 |
|---|---|---|---|
| 80（小角色） | 120-240 | 40-60 帧 | jump_y=-10, gravity=0.4 |
| 140（中角色） | 210-420 | 50-80 帧 | jump_y=-12, gravity=0.4 |
| 200（大角色） | 300-600 | 60-100 帧 | jump_y=-15, gravity=0.5 |

跳跃高度大约是身高的 **1.5-3 倍**。时间太短感觉僵硬，太长感觉飘。

#### 下落比上升快（可选，手感更利落）

鬼泣/马里奥的做法：**下落重力比上升大**，让跳跃感觉更利落：

```lua
function Player:updatePhysics(dt)
    if self.state.physics == "A" then
        if self.vy < 0 then
            -- 上升中：较小重力（跳得高、飘）
            self.vy = self.vy + self.config.gravity * 0.6
        else
            -- 下落中：较大重力（快速落地、利落）
            self.vy = self.vy + self.config.gravity * 1.5
        end
        -- 终端速度（防止下落过快）
        if self.vy > self.config.terminal_velocity then
            self.vy = self.config.terminal_velocity
        end
    end
end
```

马里奥更进一步：**按住跳跃键时重力小，松开时重力大**（可变跳跃高度）：

```lua
function State:onFrame(player, frame, buf)
    -- 松开跳跃键时上升快速减速（短跳）
    if player.vy < 0 and not buf:held("jump") then
        player.vy = player.vy + player.config.gravity * 1.5
    end
end
```

#### config.lua 参数

```lua
local config = {
    -- ... 其他 ...
    jump_y = -12.0,              -- 跳跃初速度（localcoord/帧）
    gravity = 0.4,               -- 基础重力（localcoord/帧²）
    terminal_velocity = 20,      -- 终端速度（下落最大速度）
    -- 可选：可变重力（下落比上升快）
    -- gravity_up = 0.24,        -- 上升重力（= gravity * 0.6）
    -- gravity_down = 0.6,       -- 下落重力（= gravity * 1.5）
}
```

### 6.11 坐标系

```
Love2D 屏幕坐标（y 向下为正）：
(0,0) ─────────────────────── (screenW, 0)
  │           屏幕                  │
  │                                 │
  │       地面 groundY ─────────────│
  │       │  角色 ●(x,y)           │
  │       │                        │
(0, screenH) ───────────────── (screenW, screenH)

角色根点 (x, y)：
  x = 屏幕水平位置
  y = 脚底位置（groundY = 地面 y 坐标）

速度：
  vx > 0 = 向右移动
  vy < 0 = 向上（跳跃初速度）
  vy > 0 = 向下（重力下落）

碰撞框坐标（相对角色根点）：
  box.x > 0 = 角色右侧
  box.x < 0 = 角色左侧
  box.y < 0 = 角色上方（头顶）
  box.y = 0 = 脚底
  box.y > 0 = 地面以下（通常不用）
```

### 6.12 完整的 updatePhysics

整合所有部分：

```lua
function Player:updatePhysics(dt)
    local phys = self.state.physics

    -- 1. 速度更新 + 位置更新（按 Physics 类型区分）
    if phys == "S" then
        -- 地面物理：y 固定，加摩擦力，用 vx 更新 x
        self.y = self.groundY
        self:applyFriction()
        self.x = self.x + self.vx

    elseif phys == "A" then
        -- 空中物理：重力，用 vx/vy 更新位置
        self.vy = self.vy + self.config.gravity
        if self.vy > 20 then self.vy = 20 end  -- 终端速度
        self.x = self.x + self.vx
        self.y = self.y + self.vy

    elseif phys == "N" then
        -- 无物理：y 固定地面，x 由 move_x 在状态 onUpdate 里更新
        self.y = self.groundY
        -- 不用 vx 更新位置（locomotion 用 move_x 驱动，§6.6）
    end

    -- 2. 地面检测
    if self.y >= self.groundY and self.state.stateType == "A" then
        self.y = self.groundY
        self:onLand()
    end

    -- 3. 边界限制
    self:applyScreenBound()
end

function Player:applyFriction()
    local mt = self.state.moveType
    if mt == "I" then
        self.vx = self.vx * 0.8
        if math.abs(self.vx) < 0.1 then self.vx = 0 end
    elseif mt == "H" then
        self.vx = self.vx * 0.7
        if math.abs(self.vx) < 0.1 then self.vx = 0 end
    end
    -- mt == "A": 不加摩擦力
end

function Player:onLand()
    self:setState(50)
end

function Player:applyScreenBound()
    local margin = 30
    if self.x < margin then self.x = margin; self.vx = 0 end
    local sw = love.graphics.getWidth()
    if self.x > sw - margin then self.x = sw - margin; self.vx = 0 end
end

function Player:isRunning()
    -- 摇杆方案
    local lj = love.joystick.getJoysticks()[1]
    if lj then
        local lx = lj:getAxis(1)
        if math.abs(lx) > 0.8 then return true end
    end
    -- 键盘方案：Shift 跑步
    return love.keyboard.isDown("lshift")
end
```

### 6.13 本章总结

| 概念 | 说明 |
|---|---|
| Physics=S | 地面物理：y 固定地面，加摩擦力（攻击/被击用） |
| Physics=A | 空中物理：重力下落，终端速度限制（跳跃用） |
| Physics=N | 无物理：位移由 move_x 驱动（locomotion 用） |
| 摩擦力按 moveType | I/H 加摩擦，A 不加（攻击速度精确控制） |
| move_x | 动画帧的位移字段（等价于 PosAdd），防滑步 |
| locomotion 状态机 | 站立→起步→行走/跑步→停步→站立，全用 Physics=N + move_x |
| 走 vs 跑 | 摇杆推力 >0.8 或 Shift 键 |
| 加减速曲线 | 起步 move_x 从小到大，停步从大到小，动画数据驱动 |
| 跳跃物理 | vy = jump_y 初速度，重力每帧 +gravity |
| 地面检测 | y >= groundY 时落地，切状态 50 |
| screenbound | 角色不能出屏幕边缘 |
| localcoord | 所有运算在 localcoord 坐标系，渲染时乘 scale |

**关键点**：

1. **locomotion 用 Physics=N + move_x**：位移由动画数据精确控制，防滑步。起步/停步的加减速由 move_x 自然实现
2. **非 locomotion 用 Physics=S/A**：攻击/被击用 VelSet + 摩擦力，跳跃用重力
3. **摩擦力按 moveType 区分**：I/H 加摩擦减速，A 不加（攻击速度精确控制）
4. **move_x 是位移不是速度**：等价于 PosAdd，直接加位置，不等价于 VelSet
5. **localcoord 坐标系**：所有运算在 localcoord 下做，渲染时统一乘 scale，move_x 不用管缩放

### 6.14 惯性系统

鬼泣的空中连段之所以丝滑，关键在于**惯性**——空中动作切换时保留残余速度，角色边做新动作边飘移。这一节讲惯性和摩擦力的区别，以及怎么实现。

#### 惯性 vs 摩擦力

这是两个完全不同的东西：

| | 摩擦力 | 惯性 |
|---|---|---|
| **本质** | 地面阻力，自动减速 | 状态切换时不清零速度，动量延续 |
| **在哪** | 地面（Physics=S）自动作用 | 任何状态切换（空中最明显） |
| **自动/手动** | 自动（引擎每帧减速） | 手动（状态进入时不清零 vx） |
| **效果** | 速度逐渐减小到 0 | 空中速度保持不变（无摩擦力），延续到下一个状态 |
| **鬼泣用途** | 被击击退减速、落地后减速 | 空中动作切换时的飘移效果 |

#### 为什么空中惯性比地面明显

```
地面（Physics=S，有摩擦力）：
  vx = 5.0 → 4.0 → 3.2 → 2.56 → ... → 0
  摩擦力每帧减速，惯性很快消失

空中（Physics=A，无摩擦力）：
  vx = 5.0 → 5.0 → 5.0 → ... → 5.0
  空中没有摩擦力！vx 保持不变，惯性一直延续
  只有 vy 受重力影响
```

**鬼泣的惯性主要在空中**——空中没有摩擦力，水平速度不会自动减小，状态切换时如果不清零 vx，角色就会边做新动作边飘移。

#### 鬼泣空中惯性的具体场景

```
场景1：瞬闪 → 接次元斩
  瞬闪（空中冲刺）：vx = 8.0（高速水平移动）
  取消到次元斩：不清零 vx
  效果：角色边释放次元斩边继续飘移（惯性视觉效果）

场景2：星落 → 接其他空中动作
  星落（空中下劈）：vy = 10.0（高速下落）
  取消到其他空中动作：不清零 vy
  效果：角色边做新动作边继续下落（惯性）

场景3：空中攻击 → JC
  空中攻击：vx = 3.0（水平微调速度）
  JC 后：vx 保留
  效果：角色边跳边飘移
```

#### 实现：空中状态不清零 vx

```lua
-- ❌ 错误：进入空中攻击时清零速度（丢失惯性）
function State:onEnter(player)
    player:velSet(0, 0)  -- 惯性没了！角色瞬间停住
end

-- ✅ 正确：保留 vx（水平惯性），只设 vy（如果需要）
function State:onEnter(player)
    -- 不清零 vx，让上一个状态的水平惯性延续
    -- 只改 vy（如果这个状态需要不同的垂直速度）
    -- player:velSet(nil, 0)  -- 只清 vy，保留 vx
end
```

#### MUGEN 的问题

MUGEN 角色大量使用 `velset = 0,0`（Vergil.cns 里有几十处），进入状态就清零速度，惯性全丢了：

```ini
[Statedef 200]    ; 攻击状态
velset = 0,0      ; ← 清零速度，惯性丢失
```

这对格斗游戏没问题（小场地、回合制、不需要空中飘移），但鬼泣需要空中惯性——这是动作游戏手感的关键。

#### 各状态清零策略

| 状态 | 进入时清零 vx？ | 原因 |
|---|---|---|
| locomotion（站立/行走/跑步） | ❌ 不清零 | 保留惯性，摩擦力减速 |
| 起步/停步 | ❌ 不清零 | move_x 控制位移 |
| 跳跃 | ❌ 不清零 | 保留水平惯性 |
| 空中攻击 | ❌ 不清零 | 保留惯性（鬼泣核心手感） |
| 地面攻击 | ❌ 不清零 | 保留前冲惯性 |
| 被击 | ✅ 清零 | 击退速度由 HitDef 设（第八章讲） |

#### 空中 VelMul 减速（可选）

空中没有摩擦力，但如果某个空中动作需要主动减速水平速度（比如收招时），状态自己用 VelMul：

```lua
-- 空中攻击：收招帧开始减速水平速度
function State:onUpdate(player, dt)
    if player.state_time >= 10 then
        player:velMul(0.85, 1)  -- vx *= 0.85（状态主动调，不是摩擦力）
    end
end
```

这和摩擦力的区别：

| | 摩擦力 | 空中 VelMul |
|---|---|---|
| 谁加的 | 引擎自动（Physics=S） | 状态主动调（onUpdate 里） |
| 在哪 | 地面 | 空中 |
| 触发 | 每帧自动 | 特定帧（如 time >= 10） |
| 目的 | 自然减速到停 | 控制空中减速节奏 |

MUGEN 也这么做（Vergil.cns:5719）：

```ini
; 空中攻击：第10帧开始水平减速
[State 610, VelMul]
type = VelMul
trigger1 = time = 10
x = .15               ; vx *= 0.15（快速减速，状态主动调的）
```

#### 惯性跨状态延续的完整例子

瞬闪 → 取消到次元斩 → 落地：

```
瞬闪状态（空中，Physics=A）：
  帧0: vx = 8.0（初始速度）
  帧1: vx = 8.0（空中无摩擦力，保持）
  帧2: vx = 8.0
  帧3: 玩家按攻击 → 取消到次元斩

次元斩状态（空中，Physics=A，不清零 vx）：
  帧0: vx = 8.0（从瞬闪带入的惯性）
  帧1: vx = 8.0（保持）
  ...
  帧10: vx = 8.0（还在飘移）
  落地检测：y >= groundY → 切落地状态(50)

落地状态（地面，Physics=S，不清零 vx）：
  帧0: vx = 8.0（从空中带入）
  帧1: vx = 6.4（摩擦力 0.8 开始减速）
  帧2: vx = 5.12
  ...
  帧5: vx ≈ 0（地面摩擦力让惯性消失）
```

**空中惯性保持 → 地面摩擦力减速到停**，自然过渡。

#### 总结

| 问题 | 答案 |
|---|---|
| 惯性和摩擦力是两个东西吗 | **是**。摩擦力是地面自动减速，惯性是状态切换不清零速度 |
| 鬼泣惯性主要在哪 | **空中**。空中无摩擦力，水平速度保持不变，状态切换时延续 |
| 瞬闪→次元斩的惯性怎么实现 | 空中状态切换时不清零 vx，角色边释放边飘移 |
| 空中需要减速怎么办 | 状态主动调 VelMul（不是摩擦力，是状态自己控制的） |
| MUGEN 为什么没这个 | MUGEN 大量 velset=0,0 清零速度，格斗游戏不需要空中惯性 |

**核心**：鬼泣的空中惯性 = 空中状态切换时不清零 vx。空中无摩擦力让惯性自然延续。地面有摩擦力让惯性逐渐消失。两者是不同的机制。

### 6.15 冲刺与减速

冲刺技能（瞬闪、冲刺斩、重击位移）的减速和 locomotion 不同。这一节讲冲刺怎么设计减速。

#### 冲刺受摩擦力影响吗

取决于 **moveType**：

| moveType | 摩擦力？ | 场景 |
|---|---|---|
| A（攻击） | ❌ 不受 | 冲刺斩、瞬闪——速度精确控制 |
| I（空闲） | ✅ 受 | 如果冲刺是移动技能（如瞬闪），Physics=S + moveType=I 会自动减速 |
| H（被击） | ✅ 受 | 击退减速 |

**大部分冲刺技能用 moveType=A**——不想要摩擦力干扰，速度由状态自己用 VelMul 控制。

#### 三种冲刺减速设计

**设计 1：匀速冲刺（最常见）**

整个冲刺速度不变，结束时切状态（带惯性，§6.14）：

```lua
State.moveType = "A"  -- 不受摩擦力
function State:onEnter(player)
    player:velSet(8.0 * player.facing, 0)
end
-- onUpdate 不减速，速度保持 8.0
-- 动画播完 → 切下一个状态（vx 带入，惯性延续）
```

```
速度
 8.0 ────────────────┐
                     └── 切状态，惯性带入下一个状态
 帧0  5  10  15  20
```

**设计 2：匀速 → 减速（冲锋然后逐渐减速）**

前 N 帧匀速，之后开始减速：

```lua
State.moveType = "A"
function State:onEnter(player)
    player:velSet(8.0 * player.facing, 0)
end

function State:onUpdate(player, dt)
    -- 前 10 帧不做任何操作，速度保持 8.0
    if player.state_time >= 10 then
        player:velMul(0.85, 1)  -- 第10帧开始减速
    end
end
```

```
速度
 8.0 ────────────────╲
                      ╲  减速段（VelMul 0.85）
                       ╲___
 帧0  5  10  15  20  25
```

对应 MUGEN Vergil.cns:5714-5721 的做法：

```ini
[State 610, VelSet]       ; 第8帧设速度
trigger1 = time = 8
x = 6

[State 610, VelMul]       ; 第10帧开始减速
trigger1 = time = 10
x = .15                   ; 快速减速
```

**设计 3：持续减速（从开始就减速）**

进入时设高速，每帧减速（惯性逐渐消失）：

```lua
function State:onEnter(player)
    player:velSet(10.0 * player.facing, 0)
end

function State:onUpdate(player, dt)
    player:velMul(0.9, 1)  -- 从第0帧开始每帧减速 10%
end
```

**设计 4：加速 → 匀速 → 减速（完整曲线）**

```lua
function State:onUpdate(player, dt)
    if player.state_time < 5 then
        player:velAdd(1.0 * player.facing, 0)    -- 加速段
    elseif player.state_time < 20 then
        -- 匀速段（不做任何操作）
    else
        player:velMul(0.85, 1)                    -- 减速段
    end
end
```

```
速度
           ┌────────┐
          /          ╲
         /            ╲___
        /
 帧0  5  10  15  20  25  30
      加速    匀速    减速
```

#### "多少帧后开始减速"怎么实现

用户问的核心：**前 N 帧匀速，之后开始减速**。两种方式：

**方式 1：VelMul 手动控制（推荐，精确）**

```lua
function State:onUpdate(player, dt)
    if player.state_time >= 10 then
        player:velMul(0.85, 1)  -- 第10帧后手动减速
    end
    -- 前 10 帧不做操作，速度保持
end
```

不依赖摩擦力系统，精确控制哪一帧开始减速、减多快。

**方式 2：切换 moveType（让摩擦力接管）**

```lua
State.moveType = "A"  -- 前10帧不受摩擦力

function State:onUpdate(player, dt)
    if player.state_time == 10 then
        player.state.moveType = "I"  -- 切 moveType，摩擦力开始作用
    end
end
```

这种方式让摩擦力"接管"减速，但不如 VelMul 精确（摩擦力系数是全局的，不能按技能调）。

**推荐方式 1**：每个冲刺技能自己调 VelMul，不依赖全局摩擦力。因为不同技能减速节奏不同：

| 技能 | 减速设计 | 代码 |
|---|---|---|
| 瞬闪 | 不减速（匀速到底） | onUpdate 不做操作 |
| 冲刺斩 | 第10帧快速减速 | `if t>=10 then velMul(0.15,1) end` |
| 重击位移 | 第5帧缓慢减速 | `if t>=5 then velMul(0.85,1) end` |

#### 冲刺减速辅助函数

```lua
--- 延迟减速：前 delay 帧匀速，之后每帧 velMul
---@param delay integer 匀速帧数
---@param mul number 减速系数（如 0.85）
function Player:delayedDecel(delay, mul)
    if self.state_time >= delay then
        self:velMul(mul, 1)
    end
end

-- 用法
function State:onUpdate(player, dt)
    player:delayedDecel(10, 0.85)  -- 前10帧匀速，之后每帧 *0.85
end
```

#### 冲刺和惯性的关系

冲刺结束切状态时，如果不清零 vx，残余速度带入下一个状态（§6.14 惯性系统）：

```
瞬闪帧0-10: vx = 8.0（匀速）
瞬闪帧11: 玩家按攻击 → 取消到冲刺斩
冲刺斩帧0: vx = 8.0（从瞬闪带入的惯性）
冲刺斩帧5: vx = 8.0 * 0.85^5 ≈ 3.55（VelMul 减速）
...
冲刺斩结束: vx ≈ 1.0 → 切下一个状态，惯性继续
```

**冲刺 + 惯性 = 鬼泣连段的核心手感**：技能之间切换有速度延续，不瞬间停。

### 6.16 物理参数配置

前面几节多次提到 jump_y、gravity、friction 等参数。这一节讲怎么配置这些参数，让用户不用手算公式。

#### 设计：基础参数 + advanced 子表

```lua
-- config.lua
local config = {
    -- ===== 基础参数（推荐填写）=====
    -- 写目标，引擎自动算出原始参数
    jump_height = 300,          -- 跳跃高度（localcoord）
    jump_duration = 50,         -- 跳跃总时间（帧）

    friction_stop_frames = 10,  -- 多少帧后停
    friction_stop_speed = 2.5,  -- 从什么速度开始减速（通常 = walk_fwd）

    -- ===== 高级覆盖（通常不用填）=====
    -- 只有需要精确控制时才填，覆盖上面的自动计算
    advanced = {
        -- jump_y = -24,         -- 跳跃初速度（覆盖 jump_height 的计算）
        -- gravity = 0.96,       -- 重力（覆盖 jump_duration 的计算）
        -- friction = 0.72,      -- 摩擦系数（覆盖 friction_stop_frames 的计算）
        -- friction_threshold = 0.1,
        -- gravity_up = 0.58,    -- 可变重力：上升（= gravity * 0.6）
        -- gravity_down = 1.44,  -- 可变重力：下落（= gravity * 1.5）
        -- terminal_velocity = 20,
    },
}
```

#### 规则：advanced 优先，没写才用基础参数算

```
advanced 里有 → 用 advanced（高级覆盖）
advanced 里没有 → 用基础参数自动算
```

- 新手：只填基础参数（jump_height/jump_duration），引擎自动算
- 高级用户：填 advanced（jump_y/gravity），精确控制
- 两个都填：advanced 优先，打印日志告诉你用了哪个

#### 加载逻辑

```lua
function CharacterLoader.loadConfig(config)
    -- 跳跃
    if config.advanced and config.advanced.jump_y then
        config.jump_y = config.advanced.jump_y
        config.gravity = config.advanced.gravity or 0.4
        print("[config] 使用高级参数 jump_y=" .. config.jump_y)
    elseif config.jump_height then
        config.jump_y, config.gravity = Physics.calcJump(config.jump_height, config.jump_duration)
        print("[config] 从 jump_height 自动算出 jump_y=" .. config.jump_y
              .. " gravity=" .. config.gravity)
    end

    -- 摩擦力
    if config.advanced and config.advanced.friction then
        config.friction = config.advanced.friction
        config.friction_threshold = config.advanced.friction_threshold or 0.1
    elseif config.friction_stop_frames then
        config.friction = Physics.calcFriction(config.friction_stop_frames, config.friction_stop_speed)
        config.friction_threshold = 0.1
    end

    -- 可变重力
    if config.advanced then
        config.gravity_up = config.advanced.gravity_up
        config.gravity_down = config.advanced.gravity_down
        config.terminal_velocity = config.advanced.terminal_velocity or 20
    end
end
```

#### 辅助函数

```lua
local Physics = {}

--- 从跳跃高度和时间反推 jump_y 和 gravity
---@param height number  跳跃高度（localcoord）
---@param duration integer 跳跃总时间（帧，上升+下落）
---@return number jump_y, number gravity
function Physics.calcJump(height, duration)
    local jump_y = -height * 4 / duration   -- 负数（向上）
    local gravity = -jump_y * 2 / duration
    return jump_y, gravity
end

--- 从"N 帧后停"反推乘法摩擦系数
---@param stop_frames integer 大约多少帧后停
---@param initial_speed number 初始速度（典型值，如 walk_fwd）
---@param threshold number 停止阈值（默认 0.1）
---@return number friction 系数（如 0.72）
function Physics.calcFriction(stop_frames, initial_speed, threshold)
    threshold = threshold or 0.1
    return math.pow(threshold / initial_speed, 1 / stop_frames)
end

return Physics
```

#### 用户不困惑的设计

| 用户类型 | 填什么 | 效果 |
|---|---|---|
| 新手 | 只填 jump_height/jump_duration | 自动算 jump_y/gravity |
| 高级 | 只填 advanced.jump_y/gravity | 直接用原始参数 |
| 都填 | advanced 优先 | 打印日志，告知用了 advanced |
| 都不填 | 用默认值 | gravity=0.4, jump_y=-12 |

**视觉分开**：基础参数在顶层（一眼看到），高级参数在 `advanced = {}` 子表里（默认全注释）。用户不会困惑该填哪个——基础参数先填，需要微调才动 advanced。

#### 摩擦力应用场景总结

从前几节的讨论汇总，摩擦力/减速用在以下场景：

| 场景 | 谁处理 | 机制 | 章节 |
|---|---|---|---|
| locomotion 停步 | ~~摩擦力~~ → move_x | 动画驱动位移 | §6.6 |
| 被击击退减速 | 摩擦力（Physics=S + moveType=H） | 引擎自动 0.7 系数 | §6.3 |
| 落地后水平减速 | 摩擦力（Physics=S + moveType=I） | 引擎自动 0.8 系数 | §6.3 |
| 冲刺减速 | 状态主动调 VelMul | 不依赖摩擦力，按技能定制 | §6.15 |
| 空中减速 | 状态主动调 VelMul | 空中无摩擦力 | §6.14 |

**关键区分**：
- **摩擦力**：引擎自动减速（Physics=S + moveType=I/H），用于被击击退、落地后
- **VelMul**：状态主动减速（onUpdate 里调），用于冲刺、空中攻击收招
- **move_x**：动画驱动位移（Physics=N），用于 locomotion

三种机制不冲突，各管各的场景。

### 6.17 击退与落地摩擦力

前面讲了摩擦力用于被击击退和落地减速。这一节详细讲击退怎么设计、落地摩擦力的具体过程。

#### 被击击退：给速度还是给位移

用户可能觉得"简单给一个速度敌人会滑步"——对，被击动画通常是原地的（没有 move_x），给速度后角色脚不动但人在滑。三种做法：

**方式 A：给速度 + 摩擦力减速（MUGEN 做法）**

```lua
-- 命中时：给被击者设击退速度
target.vx = hitdef.ground_velocity * -direction  -- 如 -5

-- 被击状态(5000)：Physics=S + moveType=H
-- 摩擦力每帧减速：vx *= 0.7
```

```
击退过程：
帧0: vx = -5（被击中，向后飞）
帧1: vx = -3.5（摩擦力减速）
帧2: vx = -2.45
帧3: vx = -1.72
...
帧8: vx ≈ 0（停住，但被击硬直还没结束）
帧9-20: 不动，被击硬直中
帧20: 恢复控制
```

**问题**：被击动画是原地的，角色会滑步——脚不动但人在移动。MUGEN 靠被击状态时间短（10-20帧）来掩盖滑步。

**方式 B：被击动画有 move_x（防滑步，推荐）**

和 locomotion 一样，被击动画里设 move_x，让击退位移和动画同步：

```json
{
  "id": "hit_heavy",
  "elements": [
    { "move_x": -3.0, "duration": 2, ... },
    { "move_x": -2.0, "duration": 2, ... },
    { "move_x": -1.0, "duration": 2, ... },
    { "move_x": 0.0, "duration": 4, ... }
  ]
}
```

```lua
-- 被击状态用 Physics=N + move_x（和 locomotion 一样防滑步）
State.physics = "N"
function State:onUpdate(player, dt)
    local frame = player.anim.elements[player.anim_frame]
    if frame.move_x then
        player.x = player.x + frame.move_x * player.facing
    end
end
```

**击退位移完全由被击动画的 move_x 控制**，不滑步、不依赖摩擦力。

**方式 C：MUGEN 的混合做法**

MUGEN 实际是 A + B 的混合：

```ini
[State 200, HitDef]
ground.velocity = -5, 0    ; 击退速度
ground.slidetime = 10      ; 滑动10帧（速度减速）
ground.hittime = 20        ; 总硬直20帧（滑动+不动）
```

```
MUGEN 击退过程：
帧0-10: 滑动（速度逐渐减速，slidetime）
帧10-20: 不动（硬直剩余，hittime - slidetime）
帧20: 恢复控制
```

**我们的推荐**：用方式 B（被击动画有 move_x），和 locomotion 统一机制。击退位移精确控制、不滑步。

#### 命中通知系统

用户提到"类似通知系统"——**就是命中系统（第八章 HitDef）的核心**。攻击方命中后通知被击方：

```
攻击方命中 → 通知被击方：
  "你被打中了"
  "击退位移/速度是多少"
  "伤害多少"
  "进入什么被击状态"
```

MUGEN 用 HitDef 做这个通知（引擎自动传递参数）。我们用事件系统（第五章 EventBus）实现更清晰：

```lua
-- 攻击方命中时发布事件
EventBus:emit("hit", {
    attacker = player,
    target = enemy,
    damage = 50,
    hit_velocity = { x = -5, y = 0 },  -- 击退速度（方式A）
    hit_state = 5000,                   -- 被击状态号
    hit_type = "light",                 -- 轻/重/特殊
})

-- 被击方订阅（命中系统初始化时注册）
EventBus:on("hit", function(event)
    local target = event.target
    -- 1. 扣血
    target.life = target.life - event.damage
    -- 2. 切被击状态（击退位移由被击动画的 move_x 驱动，方式B）
    target:setState(event.hit_state)
end)
```

攻击方的 HitDef 定义（第八章详讲）：

```lua
function State:onEnter(player)
    player.hitdef = {
        damage = 50,
        -- 方式 B：被击动画有 move_x，不用 velocity
        -- 方式 A：给击退速度
        ground_velocity = { x = -5, y = 0 },
        air_velocity = { x = -2, y = -4 },
        hit_state = 5000,        -- 被击站立
        air_hit_state = 5020,    -- 被击空中
        hit_type = "light",
        slidetime = 10,
        hittime = 20,
    }
end
```

第八章会详讲 HitDef 的完整参数和命中流程。

#### 攻击者和被击者的位移关系

用户问"攻击向前迈一步，被击者向后位移"——两者各自独立：

```
攻击者：攻击动画有 move_x（向前迈步）
  { "move_x": 2.0, ... }  ← 攻击者前冲

被击者：被击动画有 move_x（向后退）
  { "move_x": -3.0, ... }  ← 被击者后退

两者各自独立，由各自的动画 move_x 驱动。
攻击者不用"通知"被击者位移多少——被击者用自己的被击动画 move_x。
```

攻击者通知的只是"你被打中了"（事件 + 伤害 + 状态号），位移由被击者自己的动画控制。

#### 落地后摩擦力的具体过程

**默认情况：落地清零速度（无滑动）**

```lua
-- states/50.lua（落地状态）
function State:onEnter(player)
    player:velSet(0, 0)  -- 清零速度，落地瞬间停住
end
```

```
空中帧N: vx = 3.0, vy = 10（下落中）
落地: vx = 0, vy = 0（瞬间清零）
落地帧0-4: 不动（硬直）
落地帧5: 切站立
```

**没有滑动，瞬间停住**。这是 MUGEN 的默认做法（velset=0,0）。

**保留惯性：落地后滑动（有摩擦力减速）**

如果想要落地后有滑动感（保留空中水平惯性）：

```lua
-- states/50.lua（落地状态，保留水平惯性）
function State:onEnter(player)
    -- 不清零 vx！让空中水平惯性延续
    player.vy = 0  -- 只清垂直速度（落地不再下落）
end
-- Physics=S + moveType=I，摩擦力自动减速
```

```
空中帧N: vx = 3.0（水平移动中）
落地帧0: vx = 3.0（从空中带入，不清零）
落地帧1: vx = 2.4（摩擦力 0.8 减速）
落地帧2: vx = 1.92
落地帧3: vx = 1.54
落地帧4: vx = 1.23
落地帧5: vx ≈ 0.98 → < threshold → vx = 0（停）
→ 切站立
```

```
速度
 3.0 ╲
     ╲
      ╲
       ╲___
 落地帧0  1  2  3  4  5
          摩擦力减速到停
```

**用 move_x 驱动落地动画（防滑步）**

如果落地动画也有 move_x，用 Physics=N + move_x 驱动，不依赖摩擦力：

```json
{
  "id": "land",
  "elements": [
    { "move_x": 1.5, "duration": 2, ... },
    { "move_x": 0.5, "duration": 2, ... },
    { "move_x": 0.0, "duration": 1, ... }
  ]
}
```

这样落地位移和动画完全同步，不滑步。

#### 两种落地方式的选择

| 方式 | velset | 效果 | 适用场景 |
|---|---|---|---|
| 清零（默认） | `velSet(0,0)` | 瞬间停住 | 正常跳跃落地 |
| 保留惯性 | `vy=0, 不清vx` | 滑动减速 | 空中冲刺落地、空中攻击落地 |
| move_x 驱动 | Physics=N | 动画同步位移 | 精确控制（防滑步） |

鬼泣的空中连段落地通常保留惯性或用 move_x，让手感更连贯。

#### 总结

| 问题 | 答案 |
|---|---|
| 被击击退给速度还是位移 | 推荐给 move_x（被击动画驱动位移），不滑步。MUGEN 给速度+摩擦力，会滑步 |
| 命中通知系统 | 就是命中系统（第八章 HitDef），用 EventBus:emit("hit", ...) 实现 |
| 攻击者和被击者位移关系 | 各自独立，由各自动画的 move_x 驱动。攻击者只通知"被打中了" |
| 落地后摩擦力过程 | 从空中带入 vx → Physics=S + moveType=I → 摩擦力每帧减速到停 |
| 落地清零还是保留 | 正常跳跃清零（velSet(0,0)），空中连段落地保留惯性（只清 vy）或用 move_x |

**下一步**：第七章讲碰撞检测系统（hitbox 碰 hurtbox、pushbox 推挤、jcbox 踩怪判定），让角色能打中敌人、能被推挤。

---

*第六章完。物理系统让角色能丝滑移动，惯性让空中连段有飘移手感，冲刺减速让技能有节奏感，击退与落地让受击和落地有正确的物理反馈，第七章的碰撞检测让攻击能真正打中目标。*

---

## 第七章：碰撞检测系统

前六章角色能动了、能跳了、能有惯性了，但攻击还打不中敌人。这一章讲碰撞检测——怎么判断攻击框碰到了受击框、怎么推开、怎么触发命中事件。

### 7.1 碰撞检测做什么

每帧检测角色之间的碰撞框重叠，触发对应效果：

```
每帧 update：
  1. 动画推进（更新当前帧的碰撞框）
  2. 物理更新（更新位置）
  3. ★ 碰撞检测：
     ├─ hitbox vs hurtbox → 攻击命中 → 触发 hit 事件
     ├─ pushbox vs pushbox → 互相推开
     └─ jcbox vs jcbox → 踩怪判定
```

### 7.2 四种碰撞框回顾

第一章定义了四种碰撞框，第五章实现了获取方法，这里回顾：

```
┌─────────────────────────────────────────────────┐
│  角色                                            │
│       ┌─────────────────┐  ← hurtbox（受击框）   │
│       │      ┌──┐       │  ← hitbox（攻击框）    │
│       │      └──┘       │                        │
│       └─────────────────┘                        │
│         ┌───┐  ← pushbox（推挤框）                │
│              ●  ← jcbox（踩怪判定框）            │
└─────────────────────────────────────────────────┘
```

| 类型 | 作用 | 随帧变化 | 归属 | 获取方法 |
|---|---|---|---|---|
| hurtbox | 被攻击框打中时受伤 | ✅ 每帧不同 | 动画 JSON | `getCurrentHurtboxes()` |
| hitbox | 打中对手的判定区域 | ✅ 每帧不同 | 动画 JSON | `getCurrentHitboxes()` |
| jcbox | 踩怪判定框（脚底区域） | ✅ 每帧不同 | 动画 JSON | `getCurrentJcboxes()` |
| pushbox | 角色之间物理碰撞 | ❌ 按 statetype | config | `config.pushbox.stand` |

**关键**：hitbox 只在 `hitbox_active=true` 时生效（第五章 §5.8），由帧事件控制。

### 7.3 碰撞检测关系

谁的什么框碰谁的什么框，触发什么效果：

```
角色A 的 hitbox  ←碰撞?→  角色B 的 hurtbox   →  B 受伤（hit 事件）
角色A 的 jcbox   ←碰撞?→  角色B 的 jcbox    →  A 踩到 B（踩怪标记）
角色A 的 pushbox ←重叠?→  角色B 的 pushbox   →  互相推开
角色A 的 hitbox  ←碰撞?→  角色B 的 hitbox    →  无效果（攻击框之间不碰）
角色A 的 hurtbox ←碰撞?→  角色B 的 hurtbox   →  无效果（受击框之间不碰）
```

| 检测 | 触发条件 | 效果 |
|---|---|---|
| hitbox vs hurtbox | A 的 hitbox 碰 B 的 hurtbox | B 受伤，触发 hit 事件 |
| pushbox vs pushbox | A 和 B 的 pushbox 重叠 | 互相推开 |
| jcbox vs jcbox | A 的 jcbox 碰 B 的 jcbox | A 踩到 B（踩怪标记） |
| hitbox vs hitbox | — | 不检测 |
| hurtbox vs hurtbox | — | 不检测 |

### 7.4 AABB 矩形碰撞检测

所有碰撞框都是矩形（Box），用 AABB（Axis-Aligned Bounding Box）检测两个矩形是否重叠：

```
两个矩形重叠的条件：
  A.x < B.x + B.w  且  A.x + A.w > B.x
  A.y < B.y + B.h  且  A.y + A.h > B.y

  ┌──A──┐
  │     │
  └─────┘
       ┌──B──┐
       │     │
       └─────┘
  A 的右边 > B 的左边 且 A 的左边 < B 的右边 → x 方向重叠
  （y 方向同理）
  两个方向都重叠 → 碰撞！
```

```lua
--- AABB 碰撞检测：两个矩形是否重叠
---@param a Box 矩形A（世界坐标）
---@param b Box 矩形B（世界坐标）
---@return boolean
local function aabbOverlap(a, b)
    return a.x < b.x + b.w
       and a.x + a.w > b.x
       and a.y < b.y + b.h
       and a.y + a.h > b.y
end
```

### 7.5 坐标转换：本地坐标 → 世界坐标

碰撞框定义在动画 JSON 里，是**相对角色根点的本地坐标**。检测前要转成世界坐标：

```lua
--- 把角色的本地碰撞框转成世界坐标
---@param player Player
---@param box Box 本地坐标的碰撞框
---@return Box 世界坐标的碰撞框
local function toWorld(player, box)
    return {
        x = player.x + box.x * player.facing,  -- 朝向翻转 x
        y = player.y + box.y,                   -- y 不翻转
        w = box.w * player.facing,              -- 朝向翻转宽度
        h = box.h,
    }
end
```

**朝向翻转**：`facing=-1` 时 x 和 w 都乘 -1，矩形从角色右侧翻到左侧：

```
facing = 1（朝右）：          facing = -1（朝左）：
     ┌────┐                      ┌────┐
     │box │                      │box │
     └────┘                      └────┘
     ↑                           ↑
     x=40（角色右侧）             x=-40-w（角色左侧）
```

### 7.6 hitbox vs hurtbox 检测（攻击命中）

核心检测：攻击者的 hitbox 碰到被击者的 hurtbox → 触发 hit 事件。

```lua
--- 检测所有角色之间的 hitbox vs hurtbox
function CollisionSystem.checkHits(players)
    for _, attacker in ipairs(players) do
        -- 攻击者没有激活攻击框 → 跳过
        if not attacker.hitbox_active then goto continue end
        local hitboxes = attacker:getCurrentHitboxes()
        if #hitboxes == 0 then goto continue end

        for _, target in ipairs(players) do
            -- 不打自己
            if attacker == target then goto continue end
            -- 目标无敌（第十章讲）→ 跳过
            if target:isInvincible() then goto continue end

            local hurtboxes = target:getCurrentHurtboxes()

            -- 检测每个 hitbox 和每个 hurtbox
            for _, hb in ipairs(hitboxes) do
                local hbWorld = toWorld(attacker, hb)
                for _, hurt in ipairs(hurtboxes) do
                    local hurtWorld = toWorld(target, hurt)
                    if aabbOverlap(hbWorld, hurtWorld) then
                        -- 命中！触发 hit 事件
                        CollisionSystem.onHit(attacker, target, hb)
                        goto continue  -- 一对 hitbox/hurtbox 只触发一次
                    end
                end
            end
            ::continue::
        end
        ::continue::
    end
end
```

### 7.7 命中后的处理

命中后用 EventBus 通知（第五章 §5.7、第六章 §6.17 讲过）：

```lua
function CollisionSystem.onHit(attacker, target, hitbox)
    -- 防止重复命中（同一个攻击者对同一个目标只命中一次）
    if attacker.hit_targets and attacker.hit_targets[target.id] then
        return  -- 已经打过了，跳过
    end

    -- 记录已命中的目标（防止多帧重复命中）
    attacker.hit_targets = attacker.hit_targets or {}
    attacker.hit_targets[target.id] = true

    -- 标记攻击者已命中（用于取消条件 moveContact/moveHit）
    attacker.moveContact = true
    attacker.moveHit = true

    -- 发布 hit 事件（命中系统订阅处理）
    EventBus:emit("hit", {
        attacker = attacker,
        target = target,
        hitbox = hitbox,
        hitdef = attacker.hitdef,  -- 攻击定义（伤害、击退等，第八章讲）
    })
end
```

**防止重复命中**很重要：一个攻击动画可能持续多帧，hitbox 在多帧内都存在。如果不防止，同一帧或跨帧会重复命中同一个目标。

```
攻击动画 3 帧，hitbox 在帧1-2：
帧0: hitbox=[]（起手）
帧1: hitbox=[框A] → 碰到敌人 → 命中！记录 target.id
帧2: hitbox=[框A] → 又碰到同一敌人 → 跳过（已记录）
帧3: hitbox=[]（收招）

如果不防止：帧1和帧2各命中一次 → 伤害翻倍！
```

**重置命中记录**：每次进入新攻击状态时清空：

```lua
function State:onEnter(player)
    player.hit_targets = {}  -- 清空命中记录
    player.moveContact = false
    player.moveHit = false
end
```

### 7.8 pushbox 互相推开

两个角色的 pushbox 重叠时，互相推开，防止重叠：

```lua
--- 检测 pushbox 重叠并推开
function CollisionSystem.checkPush(players)
    for i = 1, #players do
        for j = i + 1, #players do
            local a = players[i]
            local b = players[j]

            -- 获取各自的 pushbox（按 statetype）
            local pbA = a.config.pushbox[a.state.stateType:lower()] or a.config.pushbox.stand
            local pbB = b.config.pushbox[b.state.stateType:lower()] or b.config.pushbox.stand

            if not pbA or not pbB then goto continue end

            local wa = toWorld(a, pbA)
            local wb = toWorld(b, pbB)

            if aabbOverlap(wa, wb) then
                -- 重叠 → 互相推开
                -- 计算重叠量
                local overlapX = math.min(wa.x + wa.w, wb.x + wb.w)
                              - math.max(wa.x, wb.x)

                -- 判断谁在左谁在右
                if a.x < b.x then
                    -- A 在左，B 在右
                    a.x = a.x - overlapX / 2
                    b.x = b.x + overlapX / 2
                else
                    -- B 在左，A 在右
                    a.x = a.x + overlapX / 2
                    b.x = b.x - overlapX / 2
                end
            end
            ::continue::
        end
    end
end
```

```
推开前：              推开后：
  ┌─A─┐┌─B─┐          ┌─A─┐  ┌─B─┐
  │   ││   │          │   │  │   │
  └───┘└───┘          └───┘  └───┘
  重叠 overlapX       各退 overlapX/2
```

**pushbox 只检测 x 方向**（横版游戏角色不上下重叠）。如果做 3D 或 2.5D 需要 y 方向推开。

**pushbox 只对地面角色生效**——空中角色不受 pushbox 约束，可以从小怪头顶穿过。踩怪用 jcbox 单独检测（§7.9）：

```lua
function CollisionSystem.checkPush(players)
    for i = 1, #players do
        for j = i + 1, #players do
            local a, b = players[i], players[j]
            -- ★ 只对地面角色推挤，空中角色不管
            if a.state.stateType ~= "S" or b.state.stateType ~= "S" then
                goto continue
            end
            -- ... 正常 pushbox 检测和推开 ...
            ::continue::
        end
    end
end
```

| 角色 A | 角色 B | pushbox？ | 原因 |
|---|---|---|---|
| 地面(S) | 地面(S) | ✅ 推开 | 正常推挤 |
| 空中(A) | 地面(S) | ❌ | 空中角色穿过 |
| 空中(A) | 空中(A) | ❌ | 空中不推 |

#### 落地后的推挤

角色从空中落地时，stateType 从 A 变 S，pushbox 突然生效。如果落地点旁边有小怪，pushbox 重叠会自动推开：

```
空中下落（pushbox不生效）：
     ●  ← 角色下落中
     │
  ┌─小怪─┐
  │      │
  └──────┘

落地瞬间（stateType=S，pushbox生效）：
  ┌─角色─┐┌─小怪─┐  ← 重叠 → 推开 overlapX/2
  │      ││      │
  └──────┘└──────┘
  角色被推到旁边
```

**保留水平惯性让推挤更自然**：落地状态不清零 vx，角色有水平速度时 x 位置偏向速度方向，pushbox 自然推到那一侧：

```lua
-- states/50.lua（落地状态）
function State:onEnter(player)
    -- 不清零 vx，保留空中水平惯性
    -- 角色落地时有水平速度 → x 偏向速度方向 → pushbox 推到那一侧
    player.vy = 0  -- 只清垂直速度
end
```

**极端情况**：角色垂直下落（vx=0）正好落在小怪头上 → pushbox 重叠量大 → 被推到一边。这不算 bug（角色被挤到旁边是合理的），且游戏里很少发生（玩家通常有水平移动）。如果需要改善，落地状态前几帧可以不推挤（缓冲）：

```lua
-- 可选：落地前2帧不推挤
if a.stateNo == 50 and a.state_time < 2 then goto continue end
```

### 7.9 jcbox 检测与踩怪（Enemy Step）

jcbox 用于踩怪（Enemy Step）判定。这一节讲 MUGEN 怎么做、我们怎么做。

#### MUGEN 有踩怪吗

**MUGEN 没有内置踩怪机制**。MUGEN 是格斗游戏（1v1 平面），不需要踩怪。Vergil.cmd:1233 的 Jump Cancel 是"攻击命中后按上取消到跳跃"，不是踩怪：

```mugen
; MUGEN Jump Cancel（Vergil.cmd:1233）
[State -1, Jump Cancel]
triggerall = command = "holdup"
trigger1 = stateno = 200 && movecontact    ; 攻击命中 + 按上 → 跳跃
```

踩怪是鬼泣/动作游戏特有的机制，需要我们自己设计。

#### 检测方式：jcbox vs jcbox

角色有 jcbox（脚底判定），**小怪也有 jcbox**（被踩判定）。两个 jcbox 碰撞 → 触发踩怪标记：

```
角色 jcbox（脚底）：          小怪 jcbox（被踩判定）：
     ┌──┐                      ┌──────────┐
     │脚 │                      │   头顶    │
     └──┘                      └──────────┘
     小框（精确）                大框（更容易踩）
```

**为什么用 jcbox vs jcbox 而不是 jcbox vs hurtbox**：
- 小怪的 jcbox 可以专门为"被踩"设计，比 hurtbox 更大（更容易踩）
- 小怪空中时 jcbox 可以更大（空中踩怪更容易）
- hurtbox 是"被打"的区域，踩怪不是"打"——职责分离

```
小怪的各种框：
     ┌────────────────┐  ← hurtbox（被打，正常大小）
     │                │
     │   ┌────────┐   │  ← jcbox（被踩，可以更大）
     │   │  头顶   │   │
     │   └────────┘   │
     │                │
     └────────────────┘
```

#### 碰撞检测：设 jcContact 标记

碰撞系统检测 jcbox vs jcbox，设 `jcContact = true`（类似 moveContact）：

```lua
--- 检测 jcbox vs jcbox，设 jcContact 标记
function CollisionSystem.checkJcContact(players)
    for _, a in ipairs(players) do
        local jcboxesA = a:getCurrentJcboxes()
        if #jcboxesA == 0 then goto continue end

        for _, b in ipairs(players) do
            if a == b then goto continue end
            local jcboxesB = b:getCurrentJcboxes()
            if #jcboxesB == 0 then goto continue end

            for _, jcA in ipairs(jcboxesA) do
                local wa = toWorld(a, jcA)
                for _, jcB in ipairs(jcboxesB) do
                    local wb = toWorld(b, jcB)
                    if aabbOverlap(wa, wb) then
                        -- jcbox 碰到 jcbox！双方都标记
                        a.jcContact = true
                        b.jcContact = true
                        EventBus:emit("jc_contact", { a = a, b = b })
                        goto nextA
                    end
                end
            end
            ::nextA::
        end
        ::continue::
    end
end
```

**和 moveContact 统一的模式**：

| 状态标记 | 含义 | 触发条件 |
|---|---|---|
| moveContact | 攻击框碰到过敌人 | hitbox vs hurtbox |
| jcContact | jcbox 碰到过敌人 | jcbox vs jcbox |

jcContact 在每次进入新状态时清空（和 hit_targets 一起清）：

```lua
function State:onEnter(player)
    player.hit_targets = {}
    player.moveContact = false
    player.moveHit = false
    player.jcContact = false  -- ★ 清空踩怪标记
end
```

#### 踩怪 JC：-1 state 的 trigger entry

踩怪不是自动弹起，是**玩家按跳 + jcContact** 触发 JC。和 MUGEN 的 Jump Cancel 同一模式：

```
MUGEN 攻击命中 JC：moveContact + 按跳 → ChangeState(45)
我们的踩怪 JC：    jcContact  + 按跳 → ChangeState(45)
```

trigger entry 实现：

```lua
-- 踩怪 JC（优先级最高）
{
    name = "enemy_step_jc",
    changeState = 45,               -- 空中跳跃
    priority = 95,                  -- 踩怪 JC 优先级最高
    triggerall = {
        cmd("holdup"),              -- 按跳跃
        T.inAir,                    -- 在空中
        function(p) return p.jcContact end,  -- 踩到了（jcbox vs jcbox）
    },
    triggers = {
        { T.ctrl },                                 -- trigger1: 有控制权
        { T.moveContact },                          -- trigger2: 攻击命中中
    },
}
```

空中跳跃状态(45)的 onEnter 处理弹起 + 重置：

```lua
-- states/45.lua：空中跳跃
function State:onEnter(player)
    player.vy = player.config.jump_y     -- 弹起
    player.air_skill_used = {}            -- 重置空中技能 CD
    player.airjump_count = 0              -- 重置空中跳跃次数
    player.jcContact = false              -- 清空标记
end
```

#### 踩怪不是状态

踩怪是一个**事件 + trigger entry**，不是专门的状态：
- 碰撞系统设 jcContact = true（事件标记）
- -1 state 检测 jcContact + 按跳 → ChangeState(45)（trigger entry）
- 不需要专门的"踩怪状态"

踩后角色进入空中跳跃(45)，玩家决定接什么（攻击/JC/空中跳）。

### 7.10 取消规则

踩怪 JC 只是取消的一种。这一节讲所有取消规则——MUGEN 怎么做、我们怎么表达。

#### MUGEN 的取消规则

从 Vergil.cmd:1245 的 Air Jump 可以看到 MUGEN 用多种条件控制取消：

```mugen
[State -1, Air Jump]
value = 45
triggerall = command = "holdup"
triggerall = statetype = A
triggerall = var(15) < 6                ; ★ 次数限制（最多6次）
triggerall = anim != 841                 ; ★ 某些动画不能取消

trigger1 = ctrl && vel y > 0             ; ★ 自由下落（不限帧）
trigger2 = (stateno = [600,611]) && movecontact && prevstateno != 220  ; ★ 命中+前状态限制
trigger3 = stateno = 850
trigger3 = animelemtime(6) >= 0          ; ★ 状态850：第6帧后才能取消
trigger4 = stateno = 1100
trigger4 = animelemtime(20) >= 0         ; ★ 状态1100：第20帧后才能取消
```

#### 不同技能的取消时机不同

| 技能 | MUGEN 条件 | 含义 |
|---|---|---|
| 空中攻击(600-611) | `movecontact` | 命中即可，不限帧 |
| 状态 850 | `animelemtime(6) >= 0` | 第6帧后才能取消 |
| 状态 1100 | `animelemtime(20) >= 0` | 第20帧后才能取消 |

```
空中攻击(600)：命中即可取消（全程可取消）
帧: 0  1  2  3  4  5  6  7  8
     ░  ░  ░  ✓  ✓  ✓  ✓  ░  ░
     起手  判定   全程可取消  收招

状态1100：第20帧后才能取消
帧: 0 ... 10 ... 19  20  21  22 ...
     ░  ░  ░  ░   ░   ✗   ✓   ✓   ✓
     前摇很长，第20帧后才开放取消
```

#### 防止取消链滥用：prevstateno 限制

MUGEN 用 `prevstateno != X` 限制取消链。220 是地面攻击状态：

```mugen
trigger2 = (stateno = [600,611]) && movecontact && prevstateno != 220
```

`prevstateno != 220`：前一个状态不能是 220（地面攻击）。防止从地面攻击 220 → 空中攻击 600 → 跳跃 45 → 空中攻击 600 的取消链。这是 MUGEN 格斗游戏的平衡性限制。

**鬼泣也需要 prevstateno 限制**，但限制的是 JC 连 JC：

```
允许：攻击(400) → JC(45) → 攻击(400) → JC(45) → ...（中间有攻击，鬼泣核心连段）
禁止：JC(45) → JC(45) → JC(45) → ...（直接弹跳不接攻击）

用 prevStateno ~= 45 实现：
  攻击(400) → JC(45)：prevStateNo=400 ≠ 45 ✅
  JC(45) → JC(45)：prevStateNo=45 = 45 ❌ 禁止
  JC(45) → 攻击(400) → JC(45)：prevStateNo=400 ≠ 45 ✅
```

**setState 里记录 prevStateNo**（Part 1 §2.10）：

```lua
function Player:setState(no)
    self.prevStateNo = self.stateNo  -- 记录前一个状态
    -- ... 其他逻辑 ...
end
```

#### JC 没有 CD，用条件组合控制

MUGEN 和鬼泣都**不用时间 CD**（如"取消后5帧内不能再取消"），用更精确的条件：

| 限制方式 | MUGEN 例子 | 鬼泣例子 | 作用 |
|---|---|---|---|
| 帧条件 | `animelemtime(6) >= 0` | `animElemTime(20) >= 0` | 第N帧后才能取消 |
| 前状态条件 | `prevstateno != 220` | `prevStateNo != 45` | 防止特定取消链 |
| 次数条件 | `var(15) < 6` | `airjump_count < N` | 最多取消N次 |
| 动画排除 | `anim != 841` | — | 某些动画不能取消 |
| 命中条件 | `movecontact` | `moveContact` | 必须命中才能取消 |
| 踩怪条件 | — | `jcContact` | 必须踩到才能 JC |

#### 我们的 trigger entry 表达

**MUGEN vs 鬼泣的空中取消区别**：

MUGEN 的 Jump Cancel 是"攻击命中直接跳"（格斗游戏逻辑，给取消机会）。鬼泣不同——**必须踩到敌人才能 JC**，攻击命中本身不直接给取消机会。

| | MUGEN Jump Cancel | 鬼泣 JC |
|---|---|---|
| 攻击命中 → 按跳 | ✅ 直接跳 | ❌ 不能直接跳 |
| 踩到敌人 → 按跳 | — | ✅ 弹起 + 重置CD |
| 没踩到敌人 → 按跳 | — | ❌ 只能二段跳（有次数限制） |

所以鬼泣的空中取消路径只有两条：

```lua
-- 踩怪 JC（优先级最高，必须踩到敌人，JC不能连JC）
{
    name = "enemy_step_jc",
    changeState = 45,
    priority = 95,
    triggerall = {
        cmd("holdup"),
        T.inAir,
        function(p) return p.jcContact end,              -- 必须踩到
        function(p) return p.prevStateNo ~= 45 end,       -- JC不能连JC
    },
    triggers = {
        { T.ctrl },
        { T.moveContact },   -- 攻击命中中也能触发（但前提是踩到了）
    },
}

-- 二段跳（普通空中跳跃，有次数限制，不重置CD）
-- 没踩到敌人时的后备选项：消耗一次空中跳跃次数
{
    name = "air_jump",
    changeState = 45,
    priority = 50,               -- 最低优先级
    triggerall = {
        cmd("holdup"),
        T.inAir,
        function(p) return (p.airjump_count or 0) < p.config.airjump_num end,  -- 次数限制
    },
    triggers = {
        { T.ctrl, function(p) return p.vy > 0 end },  -- 自由下落
    },
}
```

**踩怪JC 和 二段跳的区别**（都进状态45，但效果不同）：

| | 踩怪JC | 二段跳 |
|---|---|---|
| 触发条件 | jcContact=true（踩到敌人） | airjump_count < 上限 + 自由下落 |
| 重置空中技能CD | ✅ 重置（air_skill_used={}） | ❌ 不重置 |
| 重置airjump_count | ✅ 重置为0 | ❌ 不重置（count+1） |
| 可无限？ | ✅ 只要踩得到 | ❌ 次数用完就不能跳 |

#### 取消时机分类

| 类型 | 条件 | 例子 | 适用场景 |
|---|---|---|---|
| 踩怪取消 | `jcContact` | 踩到敌人 | JC（重置CD） |
| 特定帧后取消 | `animElemTime(N) >= 0` | 状态1100第20帧 | 前摇长的技能（可选） |
| 二段跳 | `ctrl + vy > 0 + 次数` | 自由下落 | 没踩到时的后备 |
| 前状态限制 | `prevStateNo != 45` | JC不能连JC | 防止无限弹跳 |
| 次数限制 | `airjump_count < N` | 最多N次 | 二段跳 |

#### JC 优先级

JC 取消优先级很高，用 trigger entry 的 priority 控制。高优先级先检查，匹配就 return：

```lua
-- 优先级排序（高→低）
{ name = "enemy_step_jc",  priority = 95 }  -- 踩怪 JC（最高，重置CD）
{ name = "air_jump",       priority = 50 }  -- 二段跳（最低，有次数限制）
```

踩怪 JC 优先级最高——踩到敌人按跳时，优先触发踩怪 JC（重置CD）而不是二段跳（不重置CD）。

#### 弹反不用 jcbox

弹反（精确格挡）**不应该用 jcbox**——jcbox 是踩怪判定（脚底区域），弹反的判定区域不一定是脚底（可能是武器、手臂、身体前方）。职责不同，不能混用。

弹反应该用**专门的弹反状态 + 格挡判定**（第十章 ReversalDef 详讲）：

```lua
-- 弹反状态：激活自己的 hitbox（格挡框，在武器/手臂位置）
State.hitbox_active = true
-- 弹反的 hitbox 在动画 JSON 里定义（武器/手臂位置，不是脚底）
-- 检测：自己的格挡 hitbox vs 对手 hitbox → 弹反成功
-- 或用 MUGEN 的 ReversalDef SCTRL（第十章讲）
```

#### jcbox 的唯一用途

修正后 jcbox 只用于踩怪：

| 用途 | 检测 | 效果 |
|---|---|---|
| 踩怪（Enemy Step） | jcbox vs jcbox | 设 jcContact，-1 state 检测按跳 → JC |

弹反用专门状态 + hitbox/ReversalDef（第十章），不用 jcbox。

### 7.11 碰撞检测的时机

碰撞检测在每帧的什么位置执行：

```lua
function love.update(dt)
    Input.update()
    local buf = Input.getBuffer()

    for _, player in ipairs(players) do
        player:update(dt, buf, in_hitstop)
        -- update 内部：
        --   1. 动画推进（更新当前帧的碰撞框）
        --   2. 物理更新（更新位置）
        --   3. 状态推进（onFrame/onUpdate）
    end

    -- ★ 碰撞检测（所有角色 update 完后）
    CollisionSystem.checkHits(players)    -- hitbox vs hurtbox
    CollisionSystem.checkPush(players)    -- pushbox 推开
    CollisionSystem.checkJc(players)      -- jcbox 判定

    -- hitstop 倒计时
    if in_hitstop then hitstop = hitstop - 1 end
end
```

**为什么在所有角色 update 完后才检测**：确保所有角色的位置和碰撞框都更新到最新状态，避免检测到旧位置。

**hitstop 时的处理**：hitstop 期间角色冻住，但碰撞检测照常跑（input 文档第五章讲过，hitstop 时命令匹配照常）。但通常 hitstop 时不会有新的命中（攻击框已经碰到了，重复命中被防止）。

### 7.12 多对多检测的性能

上面的检测是 O(n²)——每个角色检测其他所有角色。角色少时没问题，角色多时需要优化：

```
O(n²) 检测：
  2 个角色：1 对
  10 个角色：45 对
  50 个角色：1225 对
  100 个角色：4950 对

鬼泣通常同屏 < 10 个角色（玩家 + 几个杂兵），O(n²) 完全够用。
```

如果需要优化（50+ 角色），用**空间分割**：

```lua
-- 简单优化：只检测附近的角色
local function isNear(a, b, range)
    return math.abs(a.x - b.x) < range and math.abs(a.y - b.y) < range
end

-- 检测前先过滤
for _, target in ipairs(players) do
    if attacker == target then goto continue end
    if not isNear(attacker, target, 500) then goto continue end  -- 太远跳过
    -- ... 正常检测 ...
end
```

更高级的优化（四叉树/网格分割）在角色数量很大时才需要，鬼泣规模用距离过滤够了。

### 7.13 完整的 CollisionSystem 代码

```lua
-- collision_system.lua
local CollisionSystem = {}

-- AABB 碰撞检测
local function aabbOverlap(a, b)
    return a.x < b.x + b.w
       and a.x + a.w > b.x
       and a.y < b.y + b.h
       and a.y + a.h > b.y
end

-- 本地坐标 → 世界坐标
local function toWorld(player, box)
    return {
        x = player.x + box.x * player.facing,
        y = player.y + box.y,
        w = box.w * player.facing,
        h = box.h,
    }
end

-- hitbox vs hurtbox
function CollisionSystem.checkHits(players)
    for _, attacker in ipairs(players) do
        if not attacker.hitbox_active then goto continue end
        local hitboxes = attacker:getCurrentHitboxes()
        if #hitboxes == 0 then goto continue end

        for _, target in ipairs(players) do
            if attacker == target then goto continue end
            if target:isInvincible() then goto continue end
            -- 距离过滤（优化）
            if math.abs(attacker.x - target.x) > 500 then goto continue end

            local hurtboxes = target:getCurrentHurtboxes()
            for _, hb in ipairs(hitboxes) do
                local hbWorld = toWorld(attacker, hb)
                for _, hurt in ipairs(hurtboxes) do
                    local hurtWorld = toWorld(target, hurt)
                    if aabbOverlap(hbWorld, hurtWorld) then
                        CollisionSystem.onHit(attacker, target, hb)
                        goto nextTarget
                    end
                end
            end
            ::nextTarget::
        end
        ::continue::
    end
end

-- 命中处理
function CollisionSystem.onHit(attacker, target, hitbox)
    -- 防止重复命中
    attacker.hit_targets = attacker.hit_targets or {}
    if attacker.hit_targets[target.id] then return end
    attacker.hit_targets[target.id] = true

    -- 标记
    attacker.moveContact = true
    attacker.moveHit = true

    -- 发布事件
    EventBus:emit("hit", {
        attacker = attacker,
        target = target,
        hitbox = hitbox,
        hitdef = attacker.hitdef,
    })
end

-- pushbox 推开（只对地面角色）
function CollisionSystem.checkPush(players)
    for i = 1, #players do
        for j = i + 1, #players do
            local a, b = players[i], players[j]
            -- ★ 只对地面角色推挤
            if a.state.stateType ~= "S" or b.state.stateType ~= "S" then goto continue end

            local pbA = a.config.pushbox[a.state.stateType:lower()] or a.config.pushbox.stand
            local pbB = b.config.pushbox[b.state.stateType:lower()] or b.config.pushbox.stand
            if not pbA or not pbB then goto continue end

            local wa = toWorld(a, pbA)
            local wb = toWorld(b, pbB)
            if not aabbOverlap(wa, wb) then goto continue end

            local overlapX = math.min(wa.x + wa.w, wb.x + wb.w)
                          - math.max(wa.x, wb.x)
            if a.x < b.x then
                a.x = a.x - overlapX / 2
                b.x = b.x + overlapX / 2
            else
                a.x = a.x + overlapX / 2
                b.x = b.x - overlapX / 2
            end
            ::continue::
        end
    end
end

-- jcbox vs jcbox（踩怪标记）
function CollisionSystem.checkJcContact(players)
    for _, a in ipairs(players) do
        local jcboxesA = a:getCurrentJcboxes()
        if #jcboxesA == 0 then goto continue end

        for _, b in ipairs(players) do
            if a == b then goto continue end
            local jcboxesB = b:getCurrentJcboxes()
            if #jcboxesB == 0 then goto continue end

            for _, jcA in ipairs(jcboxesA) do
                local wa = toWorld(a, jcA)
                for _, jcB in ipairs(jcboxesB) do
                    local wb = toWorld(b, jcB)
                    if aabbOverlap(wa, wb) then
                        a.jcContact = true
                        b.jcContact = true
                        EventBus:emit("jc_contact", { a = a, b = b })
                        goto nextA
                    end
                end
            end
            ::nextA::
        end
        ::continue::
    end
end

-- 每帧调用（所有角色 update 完后）
function CollisionSystem.update(players)
    CollisionSystem.checkHits(players)       -- hitbox vs hurtbox
    CollisionSystem.checkPush(players)       -- pushbox（只对地面）
    CollisionSystem.checkJcContact(players)  -- jcbox vs jcbox（踩怪标记）
end

return CollisionSystem
```

### 7.14 main.lua 整合

```lua
local CollisionSystem = require("collision_system")

function love.update(dt)
    Input.update()
    local buf = Input.getBuffer()
    local in_hitstop = Game.hitstop > 0

    for _, player in ipairs(players) do
        player:update(dt, buf, in_hitstop)
    end

    -- 碰撞检测（所有角色 update 完后）
    if not in_hitstop then
        CollisionSystem.update(players)
    end

    -- hitstop 倒计时
    if in_hitstop then Game.hitstop = Game.hitstop - 1 end
end
```

### 7.15 调试渲染

开发时画出所有碰撞框，方便调试：

```lua
function CollisionSystem.drawDebug(players)
    for _, p in ipairs(players) do
        -- hurtbox（蓝）
        love.graphics.setColor(0, 0.5, 1, 0.3)
        for _, box in ipairs(p:getCurrentHurtboxes()) do
            local w = toWorld(p, box)
            love.graphics.rectangle("fill", w.x, w.y, w.w, w.h)
        end

        -- hitbox（红，只在 active 时）
        if p.hitbox_active then
            love.graphics.setColor(1, 0.2, 0.2, 0.3)
            for _, box in ipairs(p:getCurrentHitboxes()) do
                local w = toWorld(p, box)
                love.graphics.rectangle("fill", w.x, w.y, w.w, w.h)
            end
        end

        -- jcbox（紫）
        love.graphics.setColor(1, 0, 1, 0.3)
        for _, box in ipairs(p:getCurrentJcboxes()) do
            local w = toWorld(p, box)
            love.graphics.rectangle("fill", w.x, w.y, w.w, w.h)
        end

        -- pushbox（绿）
        love.graphics.setColor(0, 0.8, 0, 0.2)
        local pb = p.config.pushbox[p.state.stateType:lower()] or p.config.pushbox.stand
        if pb then
            local w = toWorld(p, pb)
            love.graphics.rectangle("fill", w.x, w.y, w.w, w.h)
        end
    end
    love.graphics.setColor(1, 1, 1, 1)
end
```

### 7.16 本章总结

| 概念 | 说明 |
|---|---|
| AABB 检测 | 两个矩形是否重叠，最简单够用的碰撞算法 |
| 坐标转换 | 本地坐标 → 世界坐标（乘 facing 翻转 x） |
| hitbox vs hurtbox | 攻击命中，触发 hit 事件 |
| 防止重复命中 | hit_targets 记录已命中目标，同一攻击不重复命中 |
| pushbox 推开 | 只对地面角色（stateType=S），各退 overlapX/2 |
| jcbox vs jcbox | 踩怪检测，设 jcContact 标记（和 moveContact 统一） |
| 踩怪 JC | jcContact + 按跳 → ChangeState(45)，-1 state trigger entry |
| 取消规则 | 帧条件/prevstateno/次数限制，不用时间 CD |
| JC 优先级 | 踩怪 JC 最高(95)，攻击 JC 次之(90)，空中跳跃最低(50) |
| 检测时机 | 所有角色 update 完后统一检测 |
| 性能 | O(n²) 够用，距离过滤优化 |

**关键点**：

1. **AABB 矩形碰撞**：四个条件判断两个矩形是否重叠，简单高效
2. **坐标转换必须乘 facing**：朝向左时 x 和 w 翻转
3. **防止重复命中**：hit_targets 记录，每次攻击状态进入时清空
4. **pushbox 只对地面角色**：空中角色不受 pushbox，可以穿过小怪头顶
5. **踩怪用 jcbox vs jcbox**：小怪也有 jcbox（被踩判定），比 hurtbox 更灵活
6. **jcContact 和 moveContact 统一**：都是碰撞标记，-1 state 用 trigger entry 检测
7. **取消不用时间 CD**：用帧条件(animelemtime) + prevstateno + 次数限制，更精确
8. **检测时机**：所有角色 update 完后统一检测，确保位置最新
9. **hitstop 时不检测**：角色冻住，不会有新碰撞

**下一步**：第八章讲命中系统（HitDef），把 hit 事件的完整处理讲清楚——伤害计算、被击状态、击退位移、空中技能 CD + JC 重置。

---

*第七章完。碰撞检测让攻击能打中目标，踩怪 JC 让空中连段有了核心机制，第八章的命中系统让命中后有完整的伤害和反馈。*

---

## 第八章：命中系统（HitDef）

第七章检测到 hitbox 碰 hurtbox 后发出 `emit("hit")` 事件，但事件怎么处理还没讲。这一章讲完整的命中系统——伤害计算、被击状态、击退位移、hitstop、命中火花、counter hit、空中技能 CD。

### 8.1 命中系统做什么

```
第七章碰撞检测 → emit("hit", { attacker, target, hitdef })
                         ↓
第八章命中系统订阅 hit 事件：
  1. 扣血（target.life -= damage）
  2. 切被击状态（target.setState(hit_state)）
  3. 设击退位移（被击动画的 move_x 或速度）
  4. 触发 hitstop（双方冻住几帧）
  5. 产生命中火花（spawn 特效）
  6. counter hit 判断（打中正在出招的对手 → 额外效果）
  7. 加魔人槽（attacker.devil_trigger += gain）
```

### 8.2 HitDef 参数

攻击状态进入时定义 HitDef（命中定义），描述"打中后怎样"：

```lua
-- states/200.lua：攻击1
function State:onEnter(player)
    player.hitdef = {
        -- 伤害
        damage = 50,
        -- 击退（方式B：被击动画有 move_x，不用 velocity）
        -- 击退（方式A：给速度，MUGEN 做法）
        ground_velocity = { x = -5, y = 0 },   -- 地面被击者击退速度
        air_velocity = { x = -2, y = -4 },     -- 空中被击者击退速度
        -- 硬直
        slidetime = 10,      -- 击退滑动帧数
        hittime = 20,        -- 总硬直帧数（滑动+不动）
        -- 冻结
        pausetime = 8,       -- hitstop 帧数（双方冻住）
        -- 被击状态
        ground_hit_state = 5000,    -- 地面被击 → 状态 5000
        air_hit_state = 5020,       -- 空中被击 → 状态 5020
        -- 判定类型
        hit_type = "light",         -- "light"/"heavy"/"trip"/"special"
        -- 资源
        power_add = 10,             -- 命中加魔人槽
        -- 多段命中
        hitonce = true,             -- 一帧只命中一次（防多段）
    }
end
```

MUGEN 对应（Vergil.cns:1096）：

```ini
[State 200, HitDef]
type = HitDef
attr = S, NA            ; 属性：地面普通攻击
hitflag = MAF           ; 能命中：地面/空中/飞行
guardflag = M           ; 防御标记（鬼泣不做防御）
animtype = Light        ; 动画类型
ground.type = Low       ; 地面判定类型
ground.velocity = -2    ; 地面击退速度
air.velocity = -1.4,-3  ; 空中击退速度
pausetime = 8, 8        ; 攻击方/被击方冻结帧
slidetime = 10          ; 滑动帧数
hittime = 20            ; 硬直帧数
```

### 8.3 HitDef 参数详解

| 参数 | 含义 | MUGEN | 例子 |
|---|---|---|---|
| `damage` | 伤害值 | `hitdamage` | 50 |
| `ground_velocity` | 地面被击者击退速度 {x, y} | `ground.velocity` | {-5, 0} |
| `air_velocity` | 空中被击者击退速度 {x, y} | `air.velocity` | {-2, -4} |
| `slidetime` | 击退滑动帧数 | `ground.slidetime` | 10 |
| `hittime` | 总硬直帧数（滑动+不动） | `ground.hittime` | 20 |
| `pausetime` | hitstop 帧数（双方冻住） | `pausetime` | 8 |
| `ground_hit_state` | 地面被击切到哪个状态 | `p2stateno` | 5000 |
| `air_hit_state` | 空中被击切到哪个状态 | — | 5020 |
| `hit_type` | 判定类型 | `ground.type` | "light"/"heavy"/"trip" |
| `hit_flag` | 能命中哪些状态的角色 | `hitflag` | "MAF"/"MAFL" |
| `power_add` | 命中加魔人槽 | `poweradd` | 10 |
| `spark_angle` | 火花旋转角度（0=横向，π/2=向下） | — | math.pi/2 |
| `spark_angle_random` | 火花角度随机范围（±弧度） | — | 0.2 |
| `spark_pos_random` | 火花位置随机偏移（像素） | — | 5 |
| `slash_angle` | 划痕旋转角度 | — | math.pi/2 |
| `slash_angle_random` | 划痕角度随机范围（±弧度） | — | 0.1 |

#### 火花和划痕的方向参数

**位置**不重要（hurtbox 中心 + 随机偏移即可），**方向**很重要——竖劈和横砍的火花/划痕方向不同。

方向用角度参数，一张精灵图 + 旋转就能表达任意方向：

```
角度 0 = 横向（→）    横砍：spark_angle = 0
角度 π/2 = 向下（↓）  竖劈：spark_angle = math.pi / 2
角度 -π/2 = 向上（↑） 挑空：spark_angle = -math.pi / 2
角度 π/4 = 斜下（↘）  斜砍：spark_angle = math.pi / 4
```

```lua
player.hitdef = {
    -- 竖劈攻击
    spark_angle = math.pi / 2,        -- 火花向下喷射
    spark_angle_random = 0.2,         -- ±0.2弧度随机（≈±11°）
    spark_pos_random = 5,             -- ±5像素位置随机
    slash_angle = math.pi / 2,        -- 竖划痕
    slash_angle_random = 0.1,         -- ±0.1弧度随机
}
```

**facing 乘到角度上**翻转左右（朝右 spark_angle=π/2 向下，朝左 = π/2 * -1 = -π/2 还是向下）。

#### hit_flag 参数

控制能命中哪些状态的角色：

| 标记 | 含义 | 例 |
|---|---|---|
| M | 地面（StateType=S） | 站立的敌人 |
| A | 空中（StateType=A） | 跳跃中的敌人 |
| F | 飞行 | 飞行道具/特殊敌人 |
| L | 躺倒（StateType=L） | 倒地的敌人（倒地追击） |

```lua
player.hitdef = {
    hit_flag = "MAF",    -- 默认：地面+空中+飞行（不能打躺倒）
    -- hit_flag = "MAFL", -- 倒地追击：也能打躺倒的敌人
}
```

碰撞检测时检查：

```lua
function CollisionSystem.canHit(target, hitdef)
    local flag = hitdef.hit_flag or "MAF"
    local t = target.state.stateType
    if t == "S" and not flag:find("M") then return false end
    if t == "A" and not flag:find("A") then return false end
    if t == "L" and not flag:find("L") then return false end
    return true
end
```

### 8.4 命中流程

从碰撞检测到处理完成的完整流程：

```lua
-- 1. 碰撞系统检测到 hitbox vs hurtbox（第七章 §7.6）
--    emit("hit", { attacker, target, hitdef })

-- 2. 命中系统订阅 hit 事件
EventBus:on("hit", function(event)
    local attacker = event.attacker
    local target = event.target
    local hd = event.hitdef or attacker.hitdef

    if not hd then return end

    -- 2a. 扣血
    target.life = target.life - hd.damage

    -- 2b. 加魔人槽
    attacker.devil_trigger = math.min(
        attacker.devil_trigger + (hd.power_add or 0), 1000)

    -- 2c. counter hit 判断
    local is_counter = (target.state.moveType == "A")
    if is_counter then
        -- counter hit：额外伤害 + 更长硬直
        target.life = target.life - math.floor(hd.damage * 0.5)
        hd.hittime = hd.hittime + 5
    end

    -- 2d. 触发 hitstop（双方冻住）
    Game.hitstop = hd.pausetime or 8
    attacker.hitPauseTime = hd.pausetime or 8
    target.hitPauseTime = hd.pausetime or 8

    -- 2e. 切被击状态
    local hitState = target.state.stateType == "A"
        and hd.air_hit_state    -- 空中被击
        or hd.ground_hit_state  -- 地面被击
    target:setState(hitState)

    -- 2f. 设击退（被击状态的 onEnter 里用 move_x 或 velocity）
    target.hit_velocity = target.state.stateType == "A"
        and hd.air_velocity
        or hd.ground_velocity

    -- 2g. 命中火花
    local sparkPos = { x = target.x, y = target.y - 60 }
    EntityManager.spawn("hit_spark_" .. hd.hit_type, sparkPos.x, sparkPos.y)

    -- 2h. 命中音效
    playSound("hit_" .. hd.hit_type)

    -- 2i. 标记攻击者已命中（用于取消条件）
    attacker.moveContact = true
    attacker.moveHit = true
end)
```

### 8.5 被击状态（5000 系列）

被击后进入 5000 系列状态。鬼泣需要的被击状态：

| 状态号 | 含义 | 鬼泣需要 |
|---|---|---|
| 5000 | 站立被击 | ✅ |
| 5010 | 蹲下被击 | ❌ 鬼泣不蹲 |
| 5020 | 空中被击 | ✅ |
| 5080 | 倒地（从空中被打到地上） | ✅ |
| 5110 | 躺倒 | ✅ |
| 5120 | 起身 | ✅ |

```lua
-- states/5000.lua：站立被击
local State = {}
State.stateNo   = 5000
State.stateType = "S"
State.physics   = "N"        -- 用 move_x 驱动击退位移（§6.17）
State.moveType  = "H"        -- 被击
State.anim      = "hit_light"
State.ctrl      = false

function State:onEnter(player)
    player.hit_targets = {}
    player.jcContact = false
    -- hit_velocity 在命中系统里设好了，这里不用管
end

function State:onUpdate(player, dt)
    -- move_x 驱动击退位移（被击动画的 move_x 从大到小）
    local frame = player.anim.elements[player.anim_frame]
    if frame.move_x then
        player.x = player.x + frame.move_x * player.facing
    end

    -- 硬直结束 → 回站立
    if player.state_time >= player.hittime then
        player:setState(0)
    end
end

return State
```

```lua
-- states/5020.lua：空中被击
local State = {}
State.stateNo   = 5020
State.stateType = "A"
State.physics   = "A"        -- 空中物理（重力）
State.moveType  = "H"
State.anim      = "air_hit"
State.ctrl      = false

function State:onEnter(player)
    -- 设击退速度（方式A：空中用速度+重力）
    local hv = player.hit_velocity or { x = -2, y = -4 }
    player:velSet(hv.x * -player.facing, hv.y)
end

function State:onUpdate(player, dt)
    -- 落地检测
    if player.y >= player.groundY then
        player:setState(5080)  -- 切到倒地状态
    end
end

return State
```

```lua
-- states/5110.lua：躺倒
local State = {}
State.stateNo   = 5110
State.stateType = "L"
State.physics   = "N"
State.moveType  = "H"
State.anim      = "liedown"
State.ctrl      = false

function State:onUpdate(player, dt)
    -- 躺倒硬直结束 → 起身
    if player.state_time >= player.config.liedown_time then
        player:setState(5120)  -- 起身
    end
end

return State
```

#### 倒地时的 hurtbox（横长方形）

2D 横版角色躺倒是**横着躺**，hurtbox 从竖长方形变成横长方形（矮而宽）。倒地动画的 hurtbox 在动画 JSON 里定义：

```json
{
  "id": "liedown",
  "elements": [
    {
      "hurtboxes": [
        { "id": "body", "x": -40, "y": -20, "w": 80, "h": 20 }
      ]
    }
  ]
}
```

对比站立的 hurtbox（竖长方形，有头/身体/腿三个）：

```
站立时：              倒地时（横躺在地上）：
┌────────┐
│  头    │           ┌──────────────────┐
│        │           │      body        │
│  身体  │           └──────────────────┘
│        │            横长方形，只有一个 body 框
│  腿    │
└────────┘           没有头/腿区分——躺着时都在同一水平线
```

#### 躺着受击

躺着被打时也有专门的受击动画（鬼泣有）。倒地追击的 HitDef 用 `hit_flag = "MAFL"`，打中躺着的敌人后切到"躺着受击"状态：

```lua
-- 倒地追击的 HitDef
player.hitdef = {
    damage = 30,
    hit_flag = "MAFL",           -- ★ 包含 L，能打躺倒
    ground_hit_state = 5110,     -- 打中后重新进入躺倒状态（播放躺着受击动画）
    -- 或专门的躺着受击状态：
    -- ground_hit_state = 5121,  -- 躺着受击状态（有专门的躺着被打动画）
    ground_velocity = { x = -3, y = 0 },
    pausetime = 6,
    hit_type = "heavy",
}
```

```lua
-- states/5121.lua：躺着受击（可选，也可直接用 5110 播不同动画）
local State = {}
State.stateNo   = 5121
State.stateType = "L"
State.physics   = "N"
State.moveType  = "H"
State.anim      = "liedown_hit"  -- ★ 躺着受击动画
State.ctrl      = false

function State:onUpdate(player, dt)
    -- 受击动画播完 → 回躺倒
    if player.anim_finished then
        player:setState(5110)
    end
end

return State
```

倒地追击流程：

```
敌人躺倒(5110) → 玩家倒地追击(hit_flag=MAFL) → 命中
  → 切到躺着受击(5121) → 播放着受击动画 → 动画播完
  → 回躺倒(5110) → 等起身

躺着受击时 hurtbox 还是横长方形（倒地动画的 hurtbox）
攻击的 hitbox 要足够低才能碰到横躺的 hurtbox
```

### 8.6 击退实现：两种方式

第六章 §6.17 讲过两种击退方式：

| 方式 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| A 速度+摩擦力 | 设 hit_velocity，被击状态 Physics=S+moveType=H 摩擦力减速 | 简单 | 会滑步 |
| B 被击动画 move_x | 被击动画有 move_x，Physics=N 驱动 | 防滑步 | 动画要设 move_x |

**地面被击用方式 B（防滑步）**，空中被击用方式 A（速度+重力）：

```lua
-- 地面被击(5000)：Physics=N + move_x
State.physics = "N"
function State:onUpdate(player, dt)
    local frame = player.anim.elements[player.anim_frame]
    if frame.move_x then
        player.x = player.x + frame.move_x * player.facing
    end
end

-- 空中被击(5020)：Physics=A + 速度
State.physics = "A"
function State:onEnter(player)
    local hv = player.hit_velocity
    player:velSet(hv.x * -player.facing, hv.y)
end
-- 重力自动作用，落地检测 → 5080
```

### 8.7 hitstop 触发

命中时双方冻住几帧（打击感），input 文档第五章详讲了 hitstop 机制：

```lua
-- 命中系统里设 hitstop
Game.hitstop = hd.pausetime or 8       -- 全局 hitstop
attacker.hitPauseTime = hd.pausetime or 8
target.hitPauseTime = hd.pausetime or 8
```

hitstop 期间（input 文档 §5）：
- 角色冻住（-3/-2/-1/当前状态的 sctrl 默认跳过）
- 命令匹配照常跑
- cur_buffer_time 不递减

### 8.8 命中火花和特效

#### 火花位置：hurtbox 中心 + 随机偏移

位置不重要（hurtbox 中心 + 随机偏移即可），**方向**才重要（§8.3 的 spark_angle）。位置用被打中的 hurtbox 中心：

```lua
-- 碰撞系统（§7.6）检测到碰撞时
function CollisionSystem.onHit(attacker, target, hitbox, hurtbox)
    -- ... hit_targets 检查 ...

    local hbWorld = toWorld(attacker, hitbox)
    local hurtWorld = toWorld(target, hurtbox)

    -- 火花位置：hurtbox 中心（一定在角色身上，不会空中爆炸）
    local hd = attacker.hitdef or {}
    local randMax = hd.spark_pos_random or 5
    local sparkX = hurtWorld.x + hurtWorld.w / 2 + math.random(-randMax, randMax)
    local sparkY = hurtWorld.y + hurtWorld.h / 2 + math.random(-randMax, randMax)

    EventBus:emit("hit", {
        attacker = attacker,
        target = target,
        hitdef = attacker.hitdef,
        hurtbox = hurtbox,
        spark_pos = { x = sparkX, y = sparkY },
    })
end
```

为什么用 hurtbox 中心而不是重叠中心：hurtbox 可能比精灵图大，重叠中心可能在角色身体外（空中爆炸）。hurtbox 中心一定在角色身上。

#### 火花方向：角度旋转

方向由攻击动作决定（竖劈/横砍/挑空），用 HitDef 的 `spark_angle` 控制。一张精灵图 + 旋转就能表达任意方向：

```
角度 0 = 横向（→）    横砍
角度 π/2 = 向下（↓）  竖劈
角度 -π/2 = 向上（↑） 挑空
角度 π/4 = 斜下（↘）  斜砍
```

```lua
-- 命中系统：用角度旋转渲染火花
function HitSystem.onHit(event)
    local hd = event.hitdef
    local pos = event.spark_pos
    local attacker = event.attacker

    -- 火花角度 = HitDef 定义 + 随机
    local angle = (hd.spark_angle or 0) * attacker.facing  -- facing 翻转左右
    local angleRand = hd.spark_angle_random or 0
    angle = angle + math.random(-angleRand, angleRand)

    -- 一张火花图 + 旋转（不需要多张图）
    EntityManager.spawnRotated("hit_spark", pos.x, pos.y, angle)
    playSound("hit_" .. (hd.hit_type or "light"))

    -- 划痕（§9.4）
    local target = event.target
    local offsetX = (pos.x - target.x) / target.facing
    local offsetY = pos.y - target.y
    local slashAngle = (hd.slash_angle or 0) * attacker.facing
    local slashAngleRand = hd.slash_angle_random or 0
    slashAngle = slashAngle + math.random(-slashAngleRand, slashAngleRand)
    target:addSlashMark(offsetX, offsetY, slashAngle)
end
```

#### 多 hurtbox：打中不同部位

角色可以有多个 hurtbox（头/身体/腿）。碰撞检测时记录**打中了哪个 hurtbox**，可用于选不同火花大小或音效：

```json
{ "hurtboxes": [
    { "id": "head", "x": -15, "y": -120, "w": 30, "h": 25 },
    { "id": "body", "x": -20, "y": -90,  "w": 40, "h": 50 },
    { "id": "legs", "x": -18, "y": -40,  "w": 36, "h": 40 }
]}
```

但火花**方向不变**——同一个攻击不管打中头还是身体，方向都一样（由攻击动作决定）。hurtbox.id 只影响位置（在哪个部位），不影响方向。

#### 多 hurtbox 防重复

同一帧 hitbox 可能同时碰到同一目标的多个 hurtbox。**hit_targets 按角色 ID 判断**（不是 hurtbox ID），只有第一个碰到的 hurtbox 触发命中：

```lua
-- 碰撞检测：命中后 break，不再检测同一目标的其他 hurtbox
for _, hurt in ipairs(hurtboxes) do
    if aabbOverlap(hbWorld, hurtWorld) then
        CollisionSystem.onHit(attacker, target, hb, hurt)
        break  -- ★ 命中后不再检测其他 hurtbox
    end
end
```

```
同一帧：
1. hitbox 碰到 hurtbox[0]（头）→ hit_targets[enemy.id]=true → emit("hit") → 火花在头部位置
2. hitbox 碰到 hurtbox[1]（身体）→ hit_targets 已存在 → 跳过（break 后不会检测到）

结果：只命中一次，火花在第一个碰到的 hurtbox 中心 ✅
```

#### 火花类型表

| hit_type | 火花大小 | 音效 |
|---|---|---|
| "light" | 小火花 | 轻击音 |
| "heavy" | 大爆炸 | 重击音 |
| "trip" | 扫地特效 | 绊倒音 |
| "special" | 特殊特效 | 特殊音 |

火花方向由 `spark_angle` 控制（和 hit_type 独立），火花大小由 `hit_type` 控制。

#### 气爆（冲击波特效）

鬼泣命中时除了火花/划痕，还有**白色气爆**——从碰撞点向外扩散的大范围冲击波，给玩家"力量感"。

气爆和火花的区别：

| | 命中火花 | 气爆 |
|---|---|---|
| 本质 | Explod（瞬间特效） | Explod（瞬间特效） |
| 大小 | 小（精确位置） | 大（覆盖半屏） |
| 持续 | 2-3帧 | 4-8帧 |
| 作用 | 视觉焦点 | 冲击波/力量感 |
| 渲染层级 | z=3 | z=4（画在火花上面） |

**气爆不需要专门的 spawn 函数**——就是 EffectDB 里的一种特效类型，用 `EntityManager.spawn` 产生：

```lua
-- EffectDB 里定义气爆（和火花平级）
EffectDB = {
    -- 火花
    hit_spark_light = { anim = ..., lifetime = 3, sprpriority = 3 },
    hit_spark_heavy = { anim = ..., lifetime = 4, sprpriority = 3 },
    -- ★ 气爆（大范围扩散）
    impact_burst_heavy = { anim = ..., lifetime = 6, sprpriority = 4 },  -- 重击气爆
    impact_burst_counter = { anim = ..., lifetime = 8, sprpriority = 4 }, -- counter气爆（更大）
    impact_burst_super = { anim = ..., lifetime = 10, sprpriority = 4 },  -- 大招气爆（全屏）
}
```

气爆动画（从中心扩散）：

```
帧0:  ★     小白点（刚命中，最亮）
帧1:  ○     小圆扩散
帧2:  ◎     中圆扩散 + 半透明
帧3:  ◯     大圆扩散 + 更透明
帧4:  ···   消散（碎片/雾气）
帧5:  消失
```

**命中时同时产生火花 + 气爆**（不同 hit_type 不同组合）：

```lua
function HitSystem.onHit(event)
    local hd = event.hitdef
    local pos = event.spark_pos

    -- 火花（小，精确位置）
    EntityManager.spawn("hit_spark_" .. (hd.hit_type or "light"),
        pos.x, pos.y, attacker.facing)

    -- ★ 气爆（大，扩散）——按 hit_type 选不同大小
    if hd.hit_type == "heavy" then
        EntityManager.spawn("impact_burst_heavy", pos.x, pos.y, attacker.facing)
    elseif event.is_counter then
        EntityManager.spawn("impact_burst_counter", pos.x, pos.y, attacker.facing)
    elseif hd.hit_type == "special" then
        EntityManager.spawn("impact_burst_super", pos.x, pos.y, attacker.facing)
    end
    -- light 不产生气爆（轻击只有火花，没有气爆）
end
```

不同攻击的气爆：

| 攻击 | 火花 | 气爆 | 说明 |
|---|---|---|---|
| 轻击 | ✅ 小 | ❌ 无 | 轻击只有火花 |
| 重击 | ✅ 大 | ✅ 气爆_heavy | 火花+气爆 |
| counter hit | ✅ 大 | ✅ 气爆_counter | counter 气爆更大 |
| 大招 | ✅ 特殊 | ✅ 气爆_super | 全屏气爆 |
| 魔人化攻击 | ✅ 红 | ✅ 红/紫 | 魔人化特色颜色 |

**气爆和 hitstop 的配合**：气爆在 hitstop 期间（2帧）保持最亮状态（不推进动画），hitstop 结束后继续扩散消散——视觉冲击最强。

#### 打击感层次总结

鬼泣的打击感 = 多个层次同时作用：

| 层次 | 效果 | 时长 | 章节 |
|---|---|---|---|
| hitstop | 时间冻住 | 2帧 | §8.4 |
| 命中微缩放 | 镜头瞬间放大 | 1-4帧 | §12.6 |
| 震屏 | 画面抖动 | 5-10帧 | §12.5 |
| 命中火花 | 小爆炸（精确位置） | 2-3帧 | 本节 |
| 划痕 | 在身上留痕 | 90帧 | §9.4 |
| 气爆 | 大范围冲击波 | 4-8帧 | 本节 |
| 慢动作 | 时间减慢（重击） | 15-30帧 | §12.7 |

每一层独立看不突出，但叠加在一起就是鬼泣的打击感。

第九章特效系统详讲 Explod/EntityManager。

### 8.9 Counter Hit

打中正在出招的对手（moveType=A）时触发 counter hit：

```lua
-- 命中系统里判断
local is_counter = (target.state.moveType == "A")
if is_counter then
    -- counter hit 效果：
    target.life = target.life - math.floor(hd.damage * 0.5)  -- 额外50%伤害
    hd.hittime = hd.hittime + 5                               -- 硬直+5帧
    -- 特殊 counter 音效/特效
    EntityManager.spawn("counter_spark", target.x, target.y - 60)
    playSound("counter_hit")
end
```

鬼泣的 counter hit 可以更丰富（如弹刀、破防），后续按需扩展。

### 8.10 多段命中与 hit_targets

#### hit_targets 是什么

`hit_targets` 是**"这次攻击状态实例"的命中记录**，不是"某个技能"的全局记录。记录这次攻击期间已经打过哪些敌人：

```lua
-- 每次进入攻击状态时清空（§7.7）
function State:onEnter(player)
    player.hit_targets = {}  -- ★ 新的空表，记录这次攻击打过谁
end
```

#### 三种场景

**场景1：同一攻击的多帧 hitbox 打同一个敌人**

```
攻击1(状态200) 的 hitbox 在第2-3帧都存在：

帧2: hitbox 碰到敌人A
  → hit_targets 里没有 A → hit_targets[A]=true → emit("hit") → A 受伤50
帧3: hitbox 又碰到敌人A
  → hit_targets 里有 A → 跳过（不重复命中！）
  → A 不会再受第二次伤害

结果：A 只受一次50伤害 ✅
```

**场景2：同一攻击打多个不同敌人（多段命中）**

```
攻击1(状态200) 的 hitbox 在第2帧同时碰到A和B：

帧2: hitbox 碰到敌人A
  → hit_targets 里没有 A → hit_targets[A]=true → emit("hit", A) → A 受伤50
帧2: hitbox 碰到敌人B
  → hit_targets 里没有 B → hit_targets[B]=true → emit("hit", B) → B 受伤50

结果：A 和 B 各受一次50伤害 ✅
```

**场景3：不同攻击打同一个敌人**

```
攻击1(200) 命中A：
  → hit_targets[A]=true → A 受伤50
  → 取消到攻击2(201)
  → 攻击2 的 onEnter：hit_targets = {} ← ★ 清空！全新的表

攻击2(201) 命中A：
  → hit_targets 里没有 A（新表）→ hit_targets[A]=true → emit("hit") → A 再受伤50

结果：A 受两次50伤害（两次不同攻击）✅
```

#### hit_targets 的生命周期

```
进入攻击1(200) → hit_targets = {}
  帧2: 打中A → hit_targets = {A: true}
  帧3: 打中A → 跳过（A 已在表里）
  帧3: 打中B → hit_targets = {A: true, B: true}

取消到攻击2(201) → hit_targets = {} ← 清空，全新开始
  帧2: 打中A → hit_targets = {A: true} ← A 可以再被打

攻击2结束 → hit_targets 随状态销毁
```

#### 代码

```lua
-- 第七章 §7.7 的防止重复命中
function CollisionSystem.onHit(attacker, target, hitbox)
    attacker.hit_targets = attacker.hit_targets or {}
    if attacker.hit_targets[target.id] then return end  -- 已命中过，跳过
    attacker.hit_targets[target.id] = true
    -- ... emit("hit") ...
end
```

| 问题 | 答案 |
|---|---|
| hit_targets 是"某个技能"的记录吗 | **不是**。是"这次攻击状态实例"的记录 |
| 什么时候清空 | 每次进入新攻击状态的 onEnter 时 `hit_targets = {}` |
| 同一攻击多帧 hitbox 打同一敌人 | 只命中一次（hit_targets 防重复） |
| 同一攻击打多个敌人 | 各命中一次（多段命中） |
| 不同攻击打同一敌人 | 各命中一次（hit_targets 每次进入状态时清空） |

### 8.11 空中技能 CD + JC 重置

鬼泣核心机制（第六章 §6.14、第七章 §7.9 讲过）：

**空中技能 CD**：每个空中技能一次滞空中只能用一次：

```lua
-- 空中攻击状态进入时检查 CD
function State:onEnter(player)
    -- 检查这个技能是否已用过（一次滞空中）
    if player.air_skill_used and player.air_skill_used[self.skill_id] then
        -- 已用过，不能再用 → 回站立或别的
        player:setState(0)
        return
    end
    -- 标记已用
    player.air_skill_used = player.air_skill_used or {}
    player.air_skill_used[self.skill_id] = true
end
```

**JC 重置 CD**：踩到敌人时清空所有空中技能 CD（第七章 §7.9）：

```lua
-- states/45.lua：空中跳跃（JC 后进入）
function State:onEnter(player)
    player.vy = player.config.jump_y     -- 弹起
    player.air_skill_used = {}            -- ★ 重置空中技能 CD
    player.airjump_count = 0              -- 重置空中跳跃次数
    player.jcContact = false
end
```

**落地时也重置**：

```lua
-- states/50.lua：落地
function State:onEnter(player)
    player.air_skill_used = {}  -- 落地重置
end
```

完整流程：

```
跳跃(40) → 空中攻击A(400) → skill_used[A]=true
         → 空中攻击A 不能再用（CD 未重置）
         → 空中攻击B(410) → skill_used[B]=true
         → 踩怪 JC(45) → air_skill_used={} ← 重置！
         → 空中攻击A(400) → skill_used[A]=true（可以再用）
         → 踩怪 JC(45) → air_skill_used={} ← 重置！
         → ...无限循环，只要踩得到
```

### 8.12 不做防御和 juggle

**鬼泣不做防御（guard）**：不需要 guardflag、guard.velocity、guard 状态(120-155)。

**不做 juggle 点数**：MUGEN 用 juggle 点数限制空中追打次数。鬼泣用"空中技能 CD + JC 重置"替代——不是限制攻击方，而是通过 JC 条件自然限制。

### 8.13 完整的命中系统代码

```lua
-- hit_system.lua：命中系统
local HitSystem = {}

function HitSystem.init()
    -- 订阅 hit 事件
    EventBus:on("hit", HitSystem.onHit)
end

function HitSystem.onHit(event)
    local attacker = event.attacker
    local target = event.target
    local hd = event.hitdef or attacker.hitdef
    if not hd then return end

    -- 1. 扣血
    target.life = target.life - hd.damage

    -- 2. 加魔人槽
    attacker.devil_trigger = math.min(
        attacker.devil_trigger + (hd.power_add or 0), 1000)

    -- 3. counter hit
    local is_counter = (target.state.moveType == "A")
    if is_counter then
        target.life = target.life - math.floor(hd.damage * 0.5)
        hd = setmetatable({hittime = hd.hittime + 5}, {__index = hd})
        EntityManager.spawn("counter_spark", target.x, target.y - 60)
        playSound("counter_hit")
    end

    -- 4. hitstop
    Game.hitstop = hd.pausetime or 8
    attacker.hitPauseTime = hd.pausetime or 8
    target.hitPauseTime = hd.pausetime or 8

    -- 5. 切被击状态
    local hitState = target.state.stateType == "A"
        and (hd.air_hit_state or 5020)
        or (hd.ground_hit_state or 5000)
    target:setState(hitState)

    -- 6. 击退信息
    target.hit_velocity = target.state.stateType == "A"
        and (hd.air_velocity or {x = -2, y = -4})
        or (hd.ground_velocity or {x = -5, y = 0})
    target.hittime = hd.hittime or 20

    -- 7. 命中火花
    EntityManager.spawn("hit_spark_" .. (hd.hit_type or "light"),
        target.x, target.y - 60)
    playSound("hit_" .. (hd.hit_type or "light"))

    -- 8. 标记攻击者
    attacker.moveContact = true
    attacker.moveHit = true
end

return HitSystem
```

### 8.14 main.lua 整合

```lua
local HitSystem = require("hit_system")

function love.load()
    -- ... 其他初始化 ...
    HitSystem.init()  -- 订阅 hit 事件
end

function love.update(dt)
    -- ... 输入、角色 update、碰撞检测 ...
    -- hitstop 倒计时
    if Game.hitstop > 0 then Game.hitstop = Game.hitstop - 1 end
end
```

### 8.15 本章总结

| 概念 | 说明 |
|---|---|
| HitDef | 攻击状态定义的"打中后怎样"参数（伤害/击退/硬直/hitstop/被击状态/hit_flag） |
| hit_flag | 能命中哪些状态的角色（M地面/A空中/F飞行/L躺倒），MAFL 可倒地追击 |
| 命中流程 | 碰撞检测 → emit("hit") → 订阅者处理（扣血/切状态/击退/hitstop/火花） |
| 被击状态 | 5000系列：站立(5000)/空中(5020)/倒地(5080)/躺倒(5110)/起身(5120)/躺着受击(5121) |
| 倒地 hurtbox | 横长方形（横躺在地上），没有头/腿区分 |
| 躺着受击 | 躺着被打有专门动画(5121)，hit_flag=MAFL 才能打躺倒 |
| 击退 | 地面用 move_x（防滑步），空中用速度+重力 |
| hitstop | 命中时双方冻住 pausetime 帧（Game.hitstop + hitPauseTime 同时设置） |
| 火花位置 | 精确碰撞点（hitbox 和 hurtbox 重叠中心）+ 可选随机偏移 |
| 多 hurtbox | 打中不同部位（头/身体/腿）不同火花，hit_targets 按角色ID防重复 |
| counter hit | 打中正在出招的对手 → 额外50%伤害 + 硬直+5 |
| 多段命中 | hit_targets 记录每个目标，同一攻击对同一目标只命中一次（不管几个 hurtbox） |
| 空中技能 CD | 每个空中技能一次滞空中只能用一次 |
| JC 重置 CD | 踩怪 JC 时 air_skill_used={} 清空，可以再用 |
| 不做防御 | 鬼泣不需要 guard |
| 不做 juggle | 用"空中技能 CD + JC 重置"替代 |

**关键点**：

1. **HitDef 是数据**：攻击状态定义 hitdef 表，描述打中后怎样
2. **EventBus 统一通知**：碰撞检测 emit("hit")，命中系统订阅处理
3. **hit_flag 控制能打谁**：默认 MAF（地面+空中+飞行），MAFL 可倒地追击
4. **火花在精确碰撞点**：hitbox 和 hurtbox 重叠中心，不是固定位置
5. **多 hurtbox 防重复**：hit_targets 按角色ID判断，命中后 break，同一目标只命中一次
6. **倒地是横躺**：hurtbox 变横长方形，攻击要足够低 + hit_flag 含 L 才能打
7. **地面被击用 move_x**：防滑步（§6.17），空中被击用速度+重力
8. **counter hit 判定**：target.moveType == "A"（打中正在出招的人）
9. **空中技能 CD 是鬼泣核心**：限制空中技能一次滞中用一次，JC 重置创造无限连段可能
10. **不做防御和 juggle**：鬼泣是动作游戏不需要

**下一步**：第九章讲特效系统（Explod/Helper/Projectile/AfterImage），让命中有完整的视觉反馈。

---

*第八章完。命中系统让攻击有伤害和反馈，空中技能 CD + JC 重置让鬼泣连段有了核心机制，第九章的特效系统让命中更有视觉冲击力。*

---

## 第九章：特效系统

第八章命中后 spawn 了命中火花，但 EntityManager 还没讲。这一章讲完整的特效系统——命中火花、划痕、飞行道具、残影、辅助角色。

### 9.1 特效系统做什么

```
游戏所有实体分两个系统管理：

players 列表（角色管理）           EntityManager（特效管理）
─────────────────────             ─────────────────────────
  ├── 玩家角色                       ├── effects（瞬间特效：火花/灰尘）
  └── 敌人角色                       ├── projectiles（飞行道具：子弹/幻影剑）
                                      └── helpers（辅助角色：剑阵/跟踪导弹）
角色有自己的：                      特效有自己的：
  ├── 状态机                          ├── 生命周期（自动移除）
  ├── 物理                            ├── 渲染排序
  ├── 碰撞框                          └── 动画
  └── 生命值

划痕是例外：Player 自己管（slash_marks），不在 EntityManager
```

EntityManager **不管角色**（玩家/敌人）——角色有自己的 update/draw 流程。EntityManager 只管"非角色的特效实体"。

特效分类：

```
├── 瞬间特效（命中火花/灰尘/闪光）   → Explod，播放完自动消失
├── 划痕（附着到角色身上）           → Player 自己管，跟着角色移动
├── 飞行道具（幻影剑/子弹/波动拳）   → Projectile，独立移动 + 碰撞
├── 残影（冲刺残影/攻击残影）        → AfterImage，记录历史帧渲染
└── 辅助角色（复杂的独立逻辑实体）   → Helper，有自己的状态机
```

### 9.2 EntityManager：特效管理

EntityManager 统一管理特效实体（不管角色）：

| 职责 | 说明 |
|---|---|
| **创建** | spawn/spawnProjectile/spawnHelper |
| **更新** | 每帧推进动画/移动/生命周期 |
| **渲染** | 按渲染顺序画特效 |
| **清理** | 自动移除完成的特效（lifetime 到或动画播完） |
| **碰撞** | Projectile 的 hitbox vs 角色 hurtbox |

```lua
-- entity_manager.lua
local EntityManager = {
    effects = {},       -- 瞬间特效（火花/灰尘）
    projectiles = {},   -- 飞行道具（幻影剑/子弹）
    slash_marks = {},   -- 划痕（附着到角色，但统一管理也可以）
}

--- spawn 一个特效
---@param id string  特效类型（如 "hit_spark_light"）
---@param x number   世界坐标 x
---@param y number   世界坐标 y
---@param facing integer 朝向（1右/-1左）
---@return table 特效实例
function EntityManager.spawn(id, x, y, facing)
    local data = EffectDB[id]  -- 特效数据库
    if not data then return nil end

    local effect = {
        id = id,
        x = x,
        y = y,
        facing = facing or 1,
        anim = data.anim,
        anim_frame = 1,
        anim_tick = 0,
        finished = false,
        bind_to = nil,      -- 绑定的角色（可选）
        bind_offset = nil,  -- 绑定偏移
        lifetime = data.lifetime or 999,  -- 生命周期
    }
    table.insert(EntityManager.effects, effect)
    return effect
end

--- 附着到角色
function EntityManager.bindTo(effect, target, offsetX, offsetY)
    effect.bind_to = target
    effect.bind_offset = { x = offsetX, y = offsetY }
end

--- 每帧更新所有特效
function EntityManager.update()
    for i = #EntityManager.effects, 1, -1 do
        local e = EntityManager.effects[i]

        -- 附着到角色 → 跟着移动
        if e.bind_to then
            e.x = e.bind_to.x + e.bind_offset.x * e.bind_to.facing
            e.y = e.bind_to.y + e.bind_offset.y
            e.facing = e.bind_to.facing
        end

        -- 动画推进
        e.anim_tick = e.anim_tick + 1
        local frame = e.anim.elements[e.anim_frame]
        if e.anim_tick >= frame.duration then
            e.anim_tick = 0
            e.anim_frame = e.anim_frame + 1
            if e.anim_frame > #e.anim.elements then
                if e.anim.loop then
                    e.anim_frame = 1
                else
                    e.finished = true
                end
            end
        end

        -- 生命周期
        e.lifetime = e.lifetime - 1
        if e.lifetime <= 0 then e.finished = true end

        -- 移除完成的
        if e.finished then
            table.remove(EntityManager.effects, i)
        end
    end
end

--- 渲染所有特效
function EntityManager.draw()
    for _, e in ipairs(EntityManager.effects) do
        local frame = e.anim.elements[e.anim_frame]
        love.graphics.draw(frame.sprite.image,
            e.x + frame.offset.x * e.facing,
            e.y + frame.offset.y,
            0, e.facing, 1)
    end
end

return EntityManager
```

### 9.3 Explod：瞬间特效

命中火花、灰尘、闪光等"播放完消失"的特效。MUGEN 的 Explod 也是这个：

```lua
-- 命中时产生火花（第八章 §8.8）
EntityManager.spawn("hit_spark_light", sparkX, sparkY, attacker.facing)

-- 挥刀产生灰尘
EntityManager.spawn("dust", player.x, player.y, player.facing)

-- 落地产生灰尘
EntityManager.spawn("land_dust", player.x, player.groundY, 1)
```

特效数据库（EffectDB）定义每种特效的动画和生命周期：

```lua
-- effect_db.lua：特效数据库
local EffectDB = {
    hit_spark_light = {
        anim = loadAnim("effects/hit_spark_light.json"),
        lifetime = 15,  -- 15帧后消失
    },
    hit_spark_heavy = {
        anim = loadAnim("effects/hit_spark_heavy.json"),
        lifetime = 20,
    },
    dust = {
        anim = loadAnim("effects/dust.json"),
        lifetime = 12,
    },
    land_dust = {
        anim = loadAnim("effects/land_dust.json"),
        lifetime = 10,
    },
    slash_mark = {
        anim = loadAnim("effects/slash_mark.json"),
        lifetime = 60,  -- 划痕持续60帧
    },
}
```

### 9.4 划痕系统

#### 划痕是什么

砍到敌人身上留下一道划痕，**跟着敌人移动和身体倾斜**，持续一段时间后消失。这是鬼泣的标志性视觉反馈。

划痕是"留在身体表面的痕迹"——身体后仰了划痕也跟着后仰，不是固定在空中。

#### 划痕是角色的一部分

划痕作为角色的一部分管理（Player 的 slash_marks 列表），不放进 EntityManager。渲染顺序可控（保证画在角色精灵上面），生命周期跟着角色走。

#### 附着点（AttachPoint）：划痕跟着动画走

划痕需要跟着角色的受击动画走——身体后仰时划痕跟着倾斜。但 hurtbox 是 AABB（不能旋转，碰撞检测需要），不能给 hurtbox 加角度。

**解决方案**：新建附着点（AttachPoint），有位置和角度，每帧独立定义，跟着动画走。碰撞检测不用它（还是 hurtbox AABB）：

```json
// 动画 JSON：每帧的 attachPoints
{
  "elements": [
    {
      "index": 0,
      "attachPoints": [
        { "id": "ap0", "name": "chest", "x": 0, "y": -80, "angle": 0 }
      ]
    },
    {
      "index": 1,
      "attachPoints": [
        { "id": "ap0", "name": "chest", "x": -5, "y": -78, "angle": 0.26 }
      ]
    },
    {
      "index": 2,
      "attachPoints": [
        { "id": "ap0", "name": "chest", "x": -10, "y": -75, "angle": 0.78 }
      ]
    }
  ]
}
```

帧0：直立（angle=0）→ 帧1：微后仰（angle≈15°）→ 帧2：后仰45°（angle=0.78）

和 spawnPoint 的区别：

| | spawnPoint | attachPoint |
|---|---|---|
| 用途 | 发射特效/飞行道具（一瞬间） | 划痕/持续特效附着（持续跟随） |
| 有角度？ | ❌ 只有 x/y | ✅ 有 angle |
| 例子 | 剑尖（spawn 幻影剑） | 胸口（划痕跟着身体倾斜） |

#### 编辑器里怎么操作

新增"附着点工具"，在画布上放置带方向箭头的点：

```
编辑器画布：

帧0（直立）：          帧3（后仰45°）：
  ┌────────┐           ┌────────┐
  │        │           │        │
  │   ●→   │           │   ●↗   │ ← 箭头方向变了（后仰）
  │        │           │        │
  └────────┘           └────────┘

  ● = 附着点位置（拖动改变）
  →/↗ = 角度方向（旋转手柄或属性面板输入）
```

- 选中附着点工具，在画布点击放置
- 拖动改位置，旋转手柄改角度
- 每帧独立设置（帧动画逐帧画，每帧设一个值）
- 属性面板显示 x/y/angle 输入框

#### 划痕方向：初始角度 + 附着点角度

划痕最终角度 = **初始角度**（攻击方向决定）+ **附着点角度**（身体倾斜决定）：

```
砍中瞬间（帧0，直立）：
  初始角度 = 0（横砍）
  附着点 angle = 0（身体直立）
  划痕角度 = 0 + 0 = 0° → ──（横划痕）

身体后仰（帧2，后仰45°）：
  初始角度 = 0（横砍，不变）
  附着点 angle = 0.78（身体后仰45°）
  划痕角度 = 0 + 0.78 = 45° → ╱（划痕跟着后仰）
```

不同攻击的初始角度：

| 攻击动作 | slash_angle（初始） | 效果 |
|---|---|---|
| 横砍 | 0 | 横划痕（—） |
| 竖劈 | π/2 | 竖划痕（│） |
| 斜砍 | π/4 | 斜划痕（╱） |
| 挑空 | -π/4 | 斜上划痕（╲） |

#### 实现

Player 类添加划痕管理 + 附着点查找：

```lua
-- 添加划痕：记录附着的 attachPoint name + 初始角度
function Player:addSlashMark(attachName, slashAngle)
    self.slash_marks = self.slash_marks or {}
    table.insert(self.slash_marks, {
        attach_name = attachName,   -- 附着点名称（如 "chest"）
        angle = slashAngle,         -- 初始角度（攻击方向决定）
        lifetime = 90,              -- 持续 90 帧（约 1.5 秒）
        max_lifetime = 90,
        last_x = nil,               -- 最后已知位置（找不到附着点时用）
        last_y = nil,
        last_angle = nil,
    })
end

-- 获取当前帧的附着点
function Player:getCurrentAttachPoint(name)
    if not self.anim then return nil end
    local frame = self.anim.elements[self.anim_frame]
    for _, ap in ipairs(frame.attachPoints or {}) do
        if ap.name == name then return ap end
    end
    return nil
end

function Player:updateSlashMarks()
    for i = #self.slash_marks, 1, -1 do
        local mark = self.slash_marks[i]
        mark.lifetime = mark.lifetime - 1
        if mark.lifetime <= 0 then
            table.remove(self.slash_marks, i)
        end
    end
end

function Player:drawSlashMarks()
    for _, mark in ipairs(self.slash_marks or {}) do
        local x, y, angle

        -- 找当前帧的附着点
        local ap = self:getCurrentAttachPoint(mark.attach_name)
        if ap then
            -- ★ 跟着附着点走（位置 + 角度都跟着动画帧变）
            x = self.x + ap.x * self.facing
            y = self.y + ap.y
            -- 划痕角度 = 初始角度(攻击) + 附着点角度(身体倾斜)
            angle = (mark.angle + ap.angle) * self.facing
            mark.last_x = x
            mark.last_y = y
            mark.last_angle = angle
        elseif mark.last_x then
            -- 找不到附着点（状态切换了）：用最后已知位置和角度
            x = mark.last_x
            y = mark.last_y
            angle = mark.last_angle
        else
            goto continue
        end

        local alpha = mark.lifetime / mark.max_lifetime
        love.graphics.setColor(1, 1, 1, alpha)
        love.graphics.draw(slashMarkImage, x, y, angle, 1, 1)
        ::continue::
    end
    love.graphics.setColor(1, 1, 1, 1)
end
```

#### 划痕生命周期（持续可见）

划痕不是闪一下就消失，而是 90 帧（1.5 秒）持续可见：

```
帧0-3:    白色闪光（刚命中，最亮，和火花同时）
帧4-10:   白色 → 红色渐变
帧11-60:  红色划痕（持续可见，稳定显示）
帧61-90:  红色逐渐淡出

火花只存在 2-3 帧，划痕持续 90 帧 → 火花消失后划痕完全可见
```

渲染顺序：

```
  1. 角色精灵图
  2. ★ 划痕（画在角色上面，持续可见）
  3. 火花（画在划痕上面，但 2-3 帧后消失）
  4. 调试碰撞框
```

#### 划痕精灵图设计

```
只需要一张划痕图（横向），通过旋转表达不同方向：

原图（角度0=横向）：    旋转 π/2（竖劈）：   旋转 π/4（斜砍）：
 ─────────────         │                    ╱
                       │                   ╱
                       │                  ╱

划痕动画（90帧生命周期）：
帧0-3:   白色闪光（刚命中，最亮）
帧4-10:  白色 → 红色渐变
帧11-60: 红色划痕（持续可见）
帧61-90: 红色逐渐淡出
```

#### 命中系统里调用

```lua
-- §8.8 命中系统里
function HitSystem.onHit(event)
    local hd = event.hitdef
    local attacker = event.attacker
    local target = event.target
    local hurtbox = event.hurtbox

    -- 划痕初始角度：HitDef 定义 + facing 翻转 + 随机
    local slashAngle = (hd.slash_angle or 0) * attacker.facing
    local slashAngleRand = hd.slash_angle_random or 0
    slashAngle = slashAngle + math.random(-slashAngleRand, slashAngleRand)

    -- 附着点名称：根据打中的 hurtbox.id 映射到 attachPoint name
    -- 如 hurtbox.id="body" → attachPoint name="chest"
    local attachName = hurtbox and hurtbox.id or "chest"

    -- 在角色身上添加划痕（记录附着点 + 初始角度）
    target:addSlashMark(attachName, slashAngle)
end
```

hurtbox.id 到 attachPoint name 的映射：

| 打中的 hurtbox | attachPoint name | 说明 |
|---|---|---|
| "head" | "head" | 头部附着点 |
| "body" | "chest" | 胸口附着点 |
| "legs" | "waist" | 腰部附着点 |

各受击动画需要定义对应的 attachPoint。如果找不到（如倒地状态只有 "body" 但划痕记的是 "head"），用最后已知位置——角色倒了划痕还在原位但逐渐淡出，可接受。

#### 多次命中叠加

每次命中不同位置和方向都记录一个划痕，可以叠加多个：

```
攻击1（横砍）打中 body → 划痕1（chest 附着点，横划痕，90帧）
攻击2（竖劈）打中 body → 划痕2（chest 附着点，竖划痕，90帧）
攻击3（斜砍）打中 head → 划痕3（head 附着点，斜划痕，90帧）

角色身上同时有3道不同方向、不同位置的划痕
各自独立跟着对应附着点走，各自独立淡出消失
```

#### 需要的改动

| 改动 | 说明 |
|---|---|
| **动画 JSON 格式** | AnimElement 加 `attachPoints` 数组（id/name/x/y/angle） |
| **编辑器新增工具** | "附着点工具"，画布上显示带方向箭头的点 |
| **编辑器属性面板** | 选中附着点时显示 x/y/angle 输入框 |
| **划痕系统** | addSlashMark 记录 attachPoint name，渲染时读 attachPoint 的 x/y/angle |
| **hurtbox 不变** | 碰撞检测还是 AABB，不受影响 |

### 9.5 Projectile：飞行道具

幻影剑、子弹、波动拳等独立飞行的实体。Projectile 有自己的移动 + 碰撞 + 生命周期：

```lua
--- spawn 飞行道具
---@param id string  类型（如 "phantom_sword"）
---@param x number   起始 x
---@param y number   起始 y
---@param facing integer  飞行方向
---@param owner Player  发射者（用于碰撞时判断阵营）
function EntityManager.spawnProjectile(id, x, y, facing, owner)
    local data = ProjectileDB[id]
    if not data then return nil end

    local proj = {
        id = id,
        x = x,
        y = y,
        vx = data.speed * facing,
        vy = data.vy or 0,
        facing = facing,
        owner = owner,           -- 发射者
        anim = data.anim,
        anim_frame = 1,
        anim_tick = 0,
        lifetime = data.lifetime or 120,  -- 120帧后消失
        hitdef = data.hitdef,    -- 飞行道具的 HitDef
        hit_targets = {},        -- 防重复命中
    }
    table.insert(EntityManager.projectiles, proj)
    return proj
end
```

使用：

```lua
-- 从剑尖发射幻影剑
local point = player:getSpawnPoint("sword_tip")
if point then
    EntityManager.spawnProjectile("phantom_sword", point.x, point.y, player.facing, player)
end

-- 开枪发射子弹
EntityManager.spawnProjectile("bullet", player.x + 30 * player.facing, player.y - 60, player.facing, player)
```

Projectile 的更新（移动 + 碰撞 + 生命周期）：

```lua
function EntityManager.updateProjectiles()
    for i = #EntityManager.projectiles, 1, -1 do
        local p = EntityManager.projectiles[i]

        -- 移动
        p.x = p.x + p.vx
        p.y = p.y + p.vy
        if p.gravity then p.vy = p.vy + p.gravity end

        -- 动画推进
        p.anim_tick = p.anim_tick + 1
        -- ... 同 EntityManager.update 的动画推进 ...

        -- 碰撞检测（和角色的 hurtbox）
        for _, target in ipairs(players) do
            if target ~= p.owner and not p.hit_targets[target.id] then
                -- 检测 projectile 的 hitbox vs target 的 hurtbox
                -- ... 命中 → emit("hit", { hitdef = p.hitdef }) ...
            end
        end

        -- 生命周期 / 出屏幕 → 移除
        p.lifetime = p.lifetime - 1
        if p.lifetime <= 0 or p.x < -100 or p.x > love.graphics.getWidth() + 100 then
            table.remove(EntityManager.projectiles, i)
        end
    end
end
```

### 9.6 AfterImage：残影

冲刺/攻击时的残影效果。记录角色历史帧，渲染时画半透明的旧帧：

```lua
--- 开启残影
---@param player Player
---@param length integer  记录多少帧的历史
---@param interval integer 每隔几帧记录一次
function EntityManager.startAfterImage(player, length, interval)
    player.afterimage = {
        history = {},       -- 历史帧列表
        max_length = length or 8,
        interval = interval or 2,
        tick = 0,
    }
end

--- 每帧更新残影（记录当前帧）
function EntityManager.updateAfterImage(player)
    local ai = player.afterimage
    if not ai then return end

    ai.tick = ai.tick + 1
    if ai.tick >= ai.interval then
        ai.tick = 0
        -- 记录当前帧的快照
        table.insert(ai.history, {
            x = player.x,
            y = player.y,
            facing = player.facing,
            anim_frame = player.anim_frame,
            anim = player.anim,
        })
        -- 超过最大长度 → 移除最旧的
        if #ai.history > ai.max_length then
            table.remove(ai.history, 1)
        end
    end
end

--- 渲染残影（在角色渲染之前画）
function EntityManager.drawAfterImage(player)
    local ai = player.afterimage
    if not ai then return end

    for i, snap in ipairs(ai.history) do
        local alpha = (i / #ai.history) * 0.5  -- 越旧越淡
        local frame = snap.anim.elements[snap.anim_frame]
        love.graphics.setColor(1, 1, 1, alpha)
        love.graphics.draw(frame.sprite.image,
            snap.x + frame.offset.x * snap.facing,
            snap.y + frame.offset.y,
            0, snap.facing, 1)
    end
    love.graphics.setColor(1, 1, 1, 1)
end

--- 关闭残影
function EntityManager.stopAfterImage(player)
    player.afterimage = nil
end
```

使用：

```lua
-- 瞬闪状态开启残影
function State:onEnter(player)
    EntityManager.startAfterImage(player, 8, 2)  -- 记录8帧历史，每2帧记一次
end

function State:onExit(player)
    EntityManager.stopAfterImage(player)
end
```

```
残影效果：
           ┌────┐
           │ 当前│ ← 最清晰（alpha=0.5）
    ┌────┐ └────┘
    │旧3 │      ← 较淡（alpha=0.19）
┌────┐
│旧2 │            ← 更淡
└────┘

角色向右冲刺，后面拖着几个半透明的旧帧
```

### 9.7 Helper：辅助角色

#### Helper 是什么

Helper 是**有自己状态机的独立实体**。比 Projectile 复杂——Projectile 只有移动+碰撞，Helper 有完整的状态机（onEnter/onFrame/onUpdate）、动画、碰撞框，能做复杂行为。

#### Helper vs Projectile 的区别

| | Projectile | Helper |
|---|---|---|
| 有状态机？ | ❌ 只有移动+碰撞 | ✅ 完整状态机 |
| 能变向？ | ❌ 直线/抛物线 | ✅ 可跟踪/变向/多阶段 |
| 有动画？ | 简单（一组帧） | 完整（可中途换动画） |
| 有碰撞框？ | hitbox（打人） | hitbox + hurtbox（也能被打） |
| 生命周期 | lifetime 到了消失 | 状态结束/destroySelf 消失 |
| 复杂度 | 低 | 高 |
| 例子 | 子弹/波动拳 | 幻影剑阵/跟踪导弹/召唤物 |

#### Helper 的用途

| 用途 | 例子 | 为什么用 Helper 不用 Projectile |
|---|---|---|
| 幻影剑阵 | 维吉尔 Spiral Swords：浮空旋转的剑持续一段时间 | 剑有多个状态（浮空/旋转/攻击/消失），Projectile 做不了 |
| 跟踪导弹 | 追踪敌人位置变向 | 需要每帧更新方向，Projectile 是直线 |
| 召唤物 | 有独立 AI 的辅助战斗角色 | 需要状态机做 AI 决策 |
| 持续判定区域 | 长按技能产生持续碰撞区域 | 区域有生命周期 + 可被打掉 |

#### Helper 的创建

```lua
--- spawn Helper
---@param id string  Helper 类型（如 "spiral_sword"）
---@param x number   起始 x
---@param y number   起始 y
---@param facing integer  朝向
---@param owner Player  创建者（用于碰撞时判断阵营）
---@return table helper 实例
function EntityManager.spawnHelper(id, x, y, facing, owner)
    local data = HelperDB[id]
    if not data then return nil end

    -- Helper 本质是一个简化版 Player
    local helper = {
        id = id,
        x = x,
        y = y,
        vx = 0,
        vy = 0,
        facing = facing,
        owner = owner,            -- 创建者
        is_helper = true,         -- 标记是 Helper（不是角色）
        state = data.states[data.initial_state or 0],
        stateNo = data.initial_state or 0,
        state_time = 0,
        anim = data.animations[data.states[data.initial_state or 0].anim],
        anim_frame = 1,
        anim_tick = 0,
        anim_finished = false,
        hitbox_active = false,
        hit_targets = {},
        lifetime = data.lifetime,  -- 生命周期（可选，到时间自动消失）
        states = data.states,
        animations = data.animations,
        -- Helper 专用
        target = nil,              -- 跟踪目标（可选）
    }
    table.insert(EntityManager.helpers, helper)
    if helper.state.onEnter then helper.state.onEnter(helper) end
    return helper
end
```

#### Helper 的状态机

Helper 有自己的状态定义（和角色一样用 onEnter/onFrame/onUpdate）：

```lua
-- HelperDB：幻影剑的定义
HelperDB = {
    spiral_sword = {
        lifetime = 300,            -- 300帧后自动消失
        initial_state = 0,         -- 初始状态
        animations = {
            idle = loadAnim("helpers/spiral_sword_idle.json"),
            attack = loadAnim("helpers/spiral_sword_attack.json"),
            disappear = loadAnim("helpers/spiral_sword_disappear.json"),
        },
        states = {
            -- 状态0：浮空旋转（动画驱动，不用 cos/sin）
            [0] = {
                anim = "idle",     -- 旋转动画：每帧画好剑在不同角度的位置和外观
                physics = "N",
                onEnter = function(h)
                    h.hitbox_active = false
                    h.follow_owner = true  -- 跟着主人移动
                end,
                onUpdate = function(h, dt)
                    -- 位置由动画帧的 offset 驱动（不用数学旋转）
                    -- 动画的每帧画好了剑围绕一圈的各个角度：
                    --   帧0: 正前方（sprite=sword_front, offset=前方）
                    --   帧2: 右侧（sprite=sword_side, offset=右侧）
                    --   帧4: 后方（sprite=sword_back, sprpriority=-2 被角色挡住）
                    --   帧6: 左侧（sprite=sword_side, offset=左侧）
                    --   循环回正前方
                    -- 剑跟着主人移动
                    h.x = h.owner.x
                    h.y = h.owner.y
                end,
                onFrame = function(h, frame, buf)
                    -- 主人攻击时 → 切攻击状态
                    if h.owner.hitbox_active then
                        h:setState(1)
                    end
                end,
            },
            -- 状态1：攻击（激活 hitbox）
            [1] = {
                anim = "attack",
                physics = "N",
                onEnter = function(h)
                    h.hitbox_active = true
                    h.hitdef = {
                        damage = 30,
                        hit_type = "special",
                        pausetime = 4,
                        ground_velocity = { x = -3, y = 0 },
                        ground_hit_state = 5000,
                    }
                end,
                onUpdate = function(h, dt)
                    h.x = h.owner.x
                    h.y = h.owner.y
                    if h.anim_finished then
                        h:setState(0)
                    end
                end,
            },
            -- 状态2：消失
            [2] = {
                anim = "disappear",
                physics = "N",
                onEnter = function(h)
                    h.hitbox_active = false
                end,
                onUpdate = function(h, dt)
                    if h.anim_finished then
                        h.finished = true
                    end
                end,
            },
        },
    },
}
```

**旋转动画 JSON**（每帧画好位置和外观，不用数学旋转）：

```json
{
  "id": "spiral_sword_idle",
  "loop": true,
  "elements": [
    { "index": 0, "duration": 4,
      "sprite": { "path": "sprites/sword_front.png" },
      "offset": { "x": 0, "y": -100 },
      "sprpriority": 2 },
    { "index": 1, "duration": 4,
      "sprite": { "path": "sprites/sword_side_r.png" },
      "offset": { "x": 50, "y": -80 },
      "sprpriority": 2 },
    { "index": 2, "duration": 4,
      "sprite": { "path": "sprites/sword_back.png" },
      "offset": { "x": 0, "y": -65 },
      "sprpriority": -2 },
    { "index": 3, "duration": 4,
      "sprite": { "path": "sprites/sword_side_l.png" },
      "offset": { "x": -50, "y": -80 },
      "sprpriority": 2 }
  ]
}
```

关键设计：
- 每帧用**不同精灵图**（正面/侧面/背面），模拟不同角度外观
- `offset` 画好每帧位置（不用 cos/sin 计算）
- `sprpriority`：正值=角色前面，负值=角色后面（绕到身后被遮挡）
- `loop=true`：循环播放产生旋转效果

**层级控制渲染**（分前后两层，角色在 love.draw 里统一画，不在 drawHelpers 里）：

```lua
-- 画在角色后面的 Helper（sprpriority < 0）
function EntityManager.drawHelpersBack()
    for _, h in ipairs(EntityManager.helpers) do
        local frame = h.anim.elements[h.anim_frame]
        if frame.sprpriority and frame.sprpriority < 0 then
            drawHelper(h)
        end
    end
end

-- 画在角色前面的 Helper（sprpriority >= 0）
function EntityManager.drawHelpersFront()
    for _, h in ipairs(EntityManager.helpers) do
        local frame = h.anim.elements[h.anim_frame]
        if not frame.sprpriority or frame.sprpriority >= 0 then
            drawHelper(h)
        end
    end
end
```

在 §9.9 的 love.draw 里分前后两层调用（角色夹在中间）。

#### 创建幻影剑阵

5把剑用**同一个旋转动画，错开起始帧**——不是数学旋转，是动画错帧：

```lua
-- 维吉尔 Spiral Swords：创建 5 把剑
function State:onEnter(player)
    local swordCount = 5
    local totalFrames = #(player.animations["spiral_sword_idle"].elements)

    for i = 1, swordCount do
        local sword = EntityManager.spawnHelper("spiral_sword",
            player.x, player.y, player.facing, player)

        -- ★ 错开起始帧（不是 math.cos/sin 旋转）
        sword.anim_frame = 1 + math.floor((i - 1) / swordCount * totalFrames)
        sword.anim_tick = 0
    end
end
```

```
幻影剑阵效果（动画错帧 + 层级控制）：

  5把剑各自在动画的不同帧 → 看起来在围绕旋转

  帧0时5把剑的位置（各自在动画的不同帧）：
         剑1（动画帧0：正前方，sprpriority=2 前面）
        /
  剑5（帧3：左侧）  主人  剑2（帧1：右侧）
        \
         剑3（帧2：后方，sprpriority=-2 被角色挡住）

  动画播放 → 5把剑各自推进 → 旋转效果
  帧0-1：剑在前面（sprpriority=2）
  帧2：剑绕到后面（sprpriority=-2，被角色挡住）
  → 产生3D旋转效果，不是平面画圆
```

为什么不用数学旋转（cos/sin）：

| | 数学旋转 | 动画错帧（鬼泣做法） |
|---|---|---|
| 剑的位置 | cos/sin 算椭圆轨道 | 动画每帧画好位置 |
| 剑的外观 | 不变（同一张图） | 每帧不同图（正面/侧面/背面） |
| 绕到身后 | ❌ 做不到 | ✅ sprpriority 切换 |
| 3D旋转感 | ❌ 平面画圆 | ✅ 有3D感 |

300帧后剑进入消失状态，播放消失动画后移除。

#### Helper 简化版 vs 完整版

上面的 Helper 是简化版（手动管理状态）。如果想更统一，可以让 Helper 也用 Player 类（`is_helper=true` 标记区分），共用状态机/动画/碰撞代码。但简化版够用，且职责清晰。

### 9.8 特效和 hitstop 的关系

hitstop 期间角色冻住，**特效怎么办**？

| 特效类型 | hitstop 时 | 原因 |
|---|---|---|
| 命中火花 | 冻住（不推进动画） | 火花和角色同步，角色冻住火花也冻 |
| 划痕 | 冻住（不淡出） | 划痕在角色身上，角色冻住划痕也冻 |
| 飞行道具 | **不冻**（继续飞） | 飞行道具独立于角色 |
| 残影 | 冻住（不记录新帧） | 残影跟着角色，角色冻住不记新帧 |
| Helper | 看情况 | 如果是角色相关则冻，独立则不冻 |

实现：

```lua
function EntityManager.update(in_hitstop)
    -- 特效：hitstop 时冻住
    if not in_hitstop then
        EntityManager.updateEffects()
    end

    -- 飞行道具：hitstop 时也继续
    EntityManager.updateProjectiles()

    -- 残影：hitstop 时不记录新帧
    if not in_hitstop then
        for _, player in ipairs(players) do
            EntityManager.updateAfterImage(player)
        end
    end
end
```

### 9.9 渲染顺序

#### 简化版：固定顺序分步调用（教学用，够用）

简单项目可以用固定顺序分步画，从底到顶：

```
渲染顺序（从底到顶）：
  1. 背景
  2. 地面特效（灰尘/落地特效）
  3. 后层飞行道具 + 后层 Helper（sprpriority < 0）
  4. 角色
  │   ├─ 残影（画在角色后面）
  │   ├─ 角色精灵图（Part 1 §5.12 的 Player:draw）
  │   └─ 划痕（画在角色上面，§9.4 的 drawSlashMarks）
  5. 前层飞行道具 + 前层 Helper（sprpriority >= 0）
  6. 命中火花/特效（最上层）
  7. UI
```

```lua
function love.draw()
    bg:draw()                              -- 1. 背景
    EntityManager.drawGroundEffects()       -- 2. 地面特效
    EntityManager.drawProjectilesBack()     -- 3. 后层飞行道具
    EntityManager.drawHelpersBack()         -- 3. 后层 Helper
    for _, player in ipairs(players) do     -- 4. 角色
        EntityManager.drawAfterImage(player)
        player:draw()
        player:drawSlashMarks()
    end
    EntityManager.drawProjectilesFront()    -- 5. 前层飞行道具
    EntityManager.drawHelpersFront()        -- 5. 前层 Helper
    EntityManager.drawEffects()             -- 6. 命中火花
    ui:draw()                               -- 7. UI
end
```

**局限**：对象多了之后不够灵活。比如两个角色谁在前面？攻击状态的角色要不要画在前面？飞行道具和特效谁先画？固定顺序解决不了这些问题。

#### 进阶版：z 值排序系统（现代引擎和 MUGEN 的做法）

**MUGEN 和现代引擎都用 z 值排序**：每个可渲染对象有一个 z（sprpriority）值，每帧排序后画。

| 引擎 | 层级参数 | 机制 |
|---|---|---|
| MUGEN | `sprpriority`（整数，默认0） | 正值在前面，负值在后面 |
| Unity | `sortingOrder`（int） | 越大越前 |
| Godot | `z_index`（int） | 越大越前 |

**实现**：所有可渲染对象收集到 renderList，按 z 排序后统一画：

```lua
function love.draw()
    local renderList = {}

    -- 收集所有可渲染对象，每个带 z 值
    table.insert(renderList, { z = -100, draw = function() bg:draw() end })

    -- 角色（整体一个 z，内部子顺序固定：残影→精灵→划痕）
    for _, p in ipairs(players) do
        table.insert(renderList, {
            z = p.sprpriority or 0,   -- ★ 角色 z 值（可动态改，如攻击时=2）
            draw = function()
                EntityManager.drawAfterImage(p)
                p:draw()
                p:drawSlashMarks()
            end
        })
    end

    -- 特效（z 在动画帧里定义）
    for _, e in ipairs(EntityManager.effects) do
        local frame = e.anim.elements[e.anim_frame]
        table.insert(renderList, {
            z = frame.sprpriority or 3,   -- 默认特效 z=3（角色前面）
            draw = function() drawEffect(e) end
        })
    end

    -- Helper（z 在动画帧里定义，如幻影剑绕到身后=-2）
    for _, h in ipairs(EntityManager.helpers) do
        local frame = h.anim.elements[h.anim_frame]
        table.insert(renderList, {
            z = frame.sprpriority or 0,
            draw = function() drawHelper(h) end
        })
    end

    -- 飞行道具
    for _, p in ipairs(EntityManager.projectiles) do
        table.insert(renderList, {
            z = p.sprpriority or 1,
            draw = function() drawProjectile(p) end
        })
    end

    -- UI
    table.insert(renderList, { z = 100, draw = function() ui:draw() end })

    -- 排序 + 渲染（z 从小到大 = 从后到前）
    table.sort(renderList, function(a, b) return a.z < b.z end)
    for _, item in ipairs(renderList) do
        item.draw()
    end
end
```

#### z 值参考

```
z = -100   背景
z = -10    远景特效
z =  -2    Helper 绕到身后（幻影剑背面）
z =  -1    后层飞行道具
z =   0    角色（默认）
z =   1    前层飞行道具
z =   2    Helper 在角色前面（幻影剑正面）/ 攻击状态角色
z =   3    命中火花
z = 100    UI
```

#### z 值可以动态改变

角色攻击时画在前面（对应 MUGEN 的 `sprpriority = 2`）：

```lua
-- states/200.lua：攻击状态
State.sprpriority = 2   -- 攻击时画在前面

-- 或在 onEnter 里动态设
function State:onEnter(player)
    player.sprpriority = 2
end

function State:onExit(player)
    player.sprpriority = 0  -- 回默认
end
```

Helper 的 z 在动画帧里定义（§9.7），正面帧 `sprpriority=2`，背面帧 `sprpriority=-2`——排序系统自动处理前后。

#### 简化版 vs 排序系统

| | 简化版（固定顺序） | 排序系统（z 值） |
|---|---|---|
| 实现 | 分步调用 | 收集→排序→画 |
| 灵活性 | ❌ 固定顺序 | ✅ 动态 z 值 |
| 对象多 | ❌ 难管理 | ✅ 统一排序 |
| 性能 | 快（无排序） | 略慢（每帧排序） |
| 适合 | 简单项目/教学 | 正式项目 |
| MUGEN | — | ✅ 用 sprpriority |
| Unity/Godot | — | ✅ 用 sortingOrder/z_index |

**建议**：教学/原型阶段用简化版（够用），正式项目升级到排序系统。排序系统的 `table.sort` 每帧执行一次，对象不多时性能可忽略。

    -- 7. UI
    ui:draw()
end
```

### 9.10 main.lua 整合

```lua
local EntityManager = require("entity_manager")

function love.update(dt)
    -- ... 输入、角色 update、碰撞检测 ...
    EntityManager.update(Game.hitstop > 0)  -- 传 in_hitstop
    -- ... hitstop 倒计时 ...
end

function love.draw()
    -- ... 渲染顺序（§9.9）...
end
```

### 9.11 本章总结

| 概念 | 说明 |
|---|---|
| EntityManager | 统一管理所有特效（spawn/update/draw） |
| Explod | 瞬间特效（命中火花/灰尘），播放完消失 |
| 划痕 | 附着到角色的特效，跟着移动，逐渐淡出。碰撞点决定位置 |
| Projectile | 飞行道具（幻影剑/子弹），独立移动 + 碰撞 + 生命周期 |
| AfterImage | 残影，记录历史帧，渲染半透明旧帧 |
| Helper | 辅助角色，有自己的状态机（幻影剑阵等复杂实体） |
| bindTo | 特效附着到角色，跟着移动和翻转 |
| hitstop 关系 | 命中火花/划痕/残影冻住，飞行道具继续 |
| 渲染顺序 | 背景→地面特效→后层飞行道具→角色(残影/精灵/划痕)→前层飞行道具→火花→UI |

**关键点**：

1. **EntityManager 统一管理**：所有特效通过 spawn 创建，update 推进，draw 渲染
2. **划痕附着到角色**：用碰撞点位置（§8.8）转成相对偏移，跟着角色移动和翻转
3. **划痕可以叠加**：每次命中不同位置记录一个划痕，各自独立淡出
4. **Projectile 独立于角色**：有自己的移动/碰撞/生命周期，hitstop 时继续飞
5. **AfterImage 记录历史帧**：每 N 帧记一次快照，渲染时画半透明旧帧
6. **hitstop 时特效冻住**（除飞行道具）：角色冻住，火花/划痕/残影同步冻住

**下一步**：第十章讲高级系统（HitBy/HitOverride/ReversalDef/SuperPause/persistent），完善战斗系统的无敌、当身、冻场等机制。

---

*第九章完。特效系统让命中有了视觉冲击力，划痕让攻击有"留在身上"的反馈，第十章的高级系统完善战斗的最后一块拼图。*

---

## 第十章：高级系统

前九章覆盖了基础战斗：移动、攻击、命中、特效。这一章讲高级机制——无敌帧、命中覆盖、当身（弹反）、冻场、SCTRL 持久化。这些是鬼泣深度战斗的最后一层。

### 10.1 HitBy / NotHitBy：无敌帧

#### 什么是无敌帧

某些状态（如闪避/起身后）角色暂时不能被打——叫无敌帧。MUGEN 用 `NotHitBy` 和 `HitBy` SCTRL 控制：

```ini
; MUGEN：2帧内无敌（不被任何攻击命中）
[State 160, 无敌]
type = NotHitBy
trigger1 = time = 0
value = 2           ; 2帧无敌

; MUGEN：只能被投技打（其他无敌）
[State 160, 部分无敌]
type = HitBy
trigger1 = time = 0
value = , NT         ; 只能被 NT（投技）打
```

#### 我们的实现

```lua
-- Player 类添加无敌帧管理
function Player:notHitBy(frames, types)
    -- frames: 无敌帧数
    -- types: 无敌的攻击类型（"all"=全部无敌，"throw"=只对投无敌）
    self.invincible = {
        frames = frames,
        types = types or "all",
    }
end

function Player:isInvincible()
    if not self.invincible then return false end
    if self.invincible.frames <= 0 then return false end
    return true
end

-- 每帧更新无敌帧倒计时
function Player:updateInvincible()
    if self.invincible and self.invincible.frames > 0 then
        self.invincible.frames = self.invincible.frames - 1
    end
end
```

碰撞检测时检查（§7.6 已有 `isInvincible` 调用）：

```lua
-- §7.6 碰撞检测
if target:isInvincible() then goto continue end  -- 无敌帧跳过
```

#### 使用场景

| 状态 | 无敌帧 | 原因 |
|---|---|---|
| 闪避/翻滚 | 整个闪避过程 | 闪避不能被打 |
| 起身(5120) | 起身后2-4帧 | 防止起身瞬间被打 |
| 大招起手 | 起手几帧 | 大招起手不能被打断 |
| 被击结束 | 无 | 被击结束恢复可控，可被打 |

```lua
-- states/160.lua：闪避
function State:onEnter(player)
    player:notHitBy(State.total_frames, "all")  -- 整个闪避过程无敌
end

-- states/5120.lua：起身
function State:onEnter(player)
    player:notHitBy(4, "all")  -- 起身后4帧无敌
end
```

### 10.2 HitOverride：命中覆盖

#### 什么是命中覆盖

正常被打后进入被击状态(5000)。HitOverride 让角色**被打后不进被击状态，而是进自定义状态**——比如鬼泣的皇家护卫格挡（被打但不受伤，进入格挡反击状态）。

```ini
; MUGEN：被打时进入状态 1300（格挡反击）
[State 0, HitOverride]
type = HitOverride
trigger1 = 1
attr = S, NA, SA     ; 被地面普通/特殊攻击打中时
stateno = 1300       ; 进入状态 1300（而不是 5000）
time = 30            ; 30帧内有效
```

#### 鬼泣皇家护卫（Royal Guard）

但丁的4种战斗风格之一，核心是**精确格挡 + 能量积累 + 释放反击**。不是普通防御：

| 操作 | 含义 | 效果 |
|---|---|---|
| **Block（格挡）** | 攻击即将命中时按风格键 | 不受伤、不后退、积累复仇能量 |
| **Release（释放）** | 积累能量后按风格键 | 强力反击，伤害随能量增加 |
| **Royal Block** | 精确时机格挡 | 积累更多能量 |
| **Royal Release** | 精确时机释放 | 伤害最高 |

和普通防御的区别：

```
普通防御（格斗游戏）：
  按住防御键 → 持续防御 → 减伤但掉血/后退 → 无反击

皇家护卫（鬼泣）：
  在攻击即将命中时按一下 → 精确格挡 → 不受伤不后退 + 积累能量
  → 积累够了再按 → 释放强力反击
  → 风险高（按早了/晚了就受伤）回报高（反击伤害爆炸）
```

能量系统：

```
格挡成功 → 积累复仇能量（Rage）
  格挡1次 → 能量+1
  皇家格挡（完美时机）→ 能量+2

释放 → 消耗能量做反击
  1格能量 → 小反击
  5格能量 → 中反击
  10格能量（满）→ 大反击（伤害爆炸）
  Royal Release（完美时机释放）→ 最大伤害
```

皇家护卫涉及三个系统的配合：

| 皇家护卫机制 | 我们的系统 | 章节 |
|---|---|---|
| 格挡（被打不受伤） | **HitOverride**：被打时不进被击，进格挡状态 | 本节 |
| 精确格挡（时机判定） | **ReversalDef**：格挡框 vs 攻击框，特定帧窗口 | §10.3 |
| 积累能量 | **命名字段**：`player.rage_count` | §3.10 |
| 释放反击 | **专门状态**：伤害 = rage_count * 系数 | 本节 |

#### 我们的实现

```lua
function Player:setHitOverride(stateNo, frames, attrTypes)
    -- stateNo: 被打时进入的状态（而不是默认被击状态）
    -- frames: 生效帧数
    -- attrTypes: 哪些攻击类型触发（"all"=全部，"light"=只轻击）
    self.hit_override = {
        state = stateNo,
        frames = frames or 999,
        attr = attrTypes or "all",
    }
end

function Player:clearHitOverride()
    self.hit_override = nil
end

-- 每帧更新
function Player:updateHitOverride()
    if self.hit_override then
        self.hit_override.frames = self.hit_override.frames - 1
        if self.hit_override.frames <= 0 then
            self.hit_override = nil
        end
    end
end
```

命中系统里检查（§8.4 修正）：

```lua
function HitSystem.onHit(event)
    local target = event.target
    local hd = event.hitdef

    -- ★ 检查 HitOverride
    if target.hit_override then
        local ho = target.hit_override
        local attrMatch = (ho.attr == "all") or (hd.hit_type == ho.attr)
        if attrMatch then
            -- 不进被击状态，进 HitOverride 定义的状态
            target:setState(ho.state)
            -- 不扣血（或按 HitOverride 配置扣血）
            -- 仍然触发 hitstop（打击感）
            Game.hitstop = hd.pausetime or 8
            return  -- 不走正常被击流程
        end
    end

    -- 正常被击流程（§8.4）
    target.life = target.life - hd.damage
    -- ...
end
```

#### 使用场景

| 场景 | HitOverride 状态 | 效果 |
|---|---|---|
| 皇家护卫格挡 | 1300（格挡反击） | 被打不扣血，进入格挡反击状态 |
| 魔人化霸体 | 1400（霸体） | 被打扣血但不进被击硬直，继续当前动作 |
| 超级护甲 | 1500（护甲） | 被打扣血但不后退，继续当前动作 |

#### 皇家护卫完整实现

**格挡状态**（按风格键进入，精确时机格挡）：

```lua
-- states/1300.lua：皇家护卫格挡
local State = {}
State.stateNo   = 1300
State.stateType = "S"
State.physics   = "N"
State.moveType  = "I"
State.anim      = "royal_guard_block"
State.ctrl      = false

function State:onEnter(player)
    -- 1. HitOverride：被打时进格挡反击状态(1300)，不进被击(5000)
    player:setHitOverride(1300, 999, "all")

    -- 2. 激活格挡框（ReversalDef：格挡框 vs 攻击框，§10.3 详讲）
    player.hitbox_active = true  -- 格挡框在动画里定义（手臂/武器位置）

    -- 3. 初始化（不重置 rage_count，跨格挡积累）
    player.parry_targets = {}
end

function State:onExit(player)
    player:clearHitOverride()
    player.hitbox_active = false
end

function State:onUpdate(player, dt)
    -- 动画播完 → 回站立
    if player.anim_finished then
        player:setState(0)
    end
end

return State
```

**格挡成功时**（ReversalDef 检测到，§10.3）：

```lua
EventBus:on("parry", function(event)
    local defender = event.defender

    -- 积累复仇能量
    defender.rage_count = (defender.rage_count or 0) + 1

    -- 弹反特效
    EntityManager.spawn("parry_spark", event.attacker.x, event.attacker.y - 60,
        defender.facing)
    playSound("royal_block")

    -- 加魔人槽
    defender.devil_trigger = math.min(
        defender.devil_trigger + 20, 1000)
end)
```

**释放状态**（按风格键 + 有能量时进入）：

```lua
-- states/1310.lua：皇家护卫释放
local State = {}
State.stateNo   = 1310
State.stateType = "S"
State.physics   = "N"
State.moveType  = "A"   -- 攻击
State.anim      = "royal_guard_release"
State.ctrl      = false

function State:onEnter(player)
    local rage = player.rage_count or 0
    if rage <= 0 then
        player:setState(0)  -- 没能量不能释放，回站立
        return
    end

    -- 释放伤害 = 基础 + 能量 * 系数
    player.hitdef = {
        damage = 50 + rage * 30,     -- 1格=80, 5格=200, 10格=350
        hit_type = "heavy",
        pausetime = 15,               -- 长hitstop（大招感）
        spark_angle = 0,              -- 水平喷射
        slash_angle = 0,              -- 横划痕
        ground_velocity = { x = -8, y = 0 },  -- 强击退
        ground_hit_state = 5000,
    }

    -- 消耗全部能量
    player.rage_count = 0
end

function State:onUpdate(player, dt)
    if player.anim_finished then
        player:setState(0)
    end
end

return State
```

**释放的 trigger entry**（-1 state 检测）：

```lua
{
    name = "royal_release",
    changeState = 1310,
    priority = 80,
    triggerall = {
        cmd("style"),                      -- 按风格键
        function(p) return (p.rage_count or 0) > 0 end,  -- 有能量
    },
    triggers = {
        { T.ctrl },                         -- 有控制权
    },
}
```

**完整流程**：

```
1. 按风格键 → 进入格挡状态(1300)
   → HitOverride 生效（被打不进被击，进1300）
   → 激活格挡框（特定帧窗口）

2. 敌人攻击命中格挡框 → ReversalDef 检测到 → emit("parry")
   → rage_count + 1（积累能量）
   → 弹反特效

3. 再次按风格键 + 有能量 → 进入释放状态(1310)
   → hitdef.damage = 50 + rage * 30（能量越多伤害越高）
   → rage_count = 0（消耗能量）
   → 强力反击

4. 高手流程：
   格挡 → 格挡 → 格挡 → ... → 积累10格能量
   → 释放 → 350伤害爆炸 → 秒杀
```

### 10.3 ReversalDef：当身/弹反

#### 什么是当身

当身（ReversalDef）是"用自己身体的某个部位精确格挡对手的攻击，然后反击"。和 HitDef（攻击命中）不同，ReversalDef 是"被攻击时触发反击"。

第七章 §7.9 讲过：**弹反不用 jcbox**，用专门的状态 + hitbox 或 ReversalDef。

#### 和 HitDef / HitOverride 的区别

| | HitDef | HitOverride | ReversalDef |
|---|---|---|---|
| 时机 | 主动攻击命中时 | 被打时 | 被攻击碰到时 |
| 检测 | 自己 hitbox vs 敌人 hurtbox | 敌人 hitbox 碰到自己 hurtbox | 自己 hitbox vs 敌人 hitbox |
| 效果 | 敌人受伤 | 自己不进被击状态 | 敌人的攻击被取消 + 敌人受伤 |
| 场景 | 普通攻击 | 霸体/格挡 | 弹反/当身 |

#### 实现

弹反状态激活自己的 hitbox（格挡框），检测碰对手的 hitbox（攻击框）：

```lua
-- states/1300.lua：弹反状态
local State = {}
State.stateNo   = 1300
State.stateType = "S"
State.physics   = "N"
State.moveType  = "I"
State.anim      = "parry"
State.ctrl      = false

function State:onEnter(player)
    player.hitbox_active = true   -- 激活格挡框（在动画 JSON 里定义，武器/手臂位置）
    player.parry_targets = {}     -- 已弹反的目标
end

function State:onUpdate(player, dt)
    -- 检测：自己的 hitbox（格挡框）vs 敌人的 hitbox（攻击框）
    for _, enemy in ipairs(players) do
        if enemy ~= player and enemy.hitbox_active then
            if not player.parry_targets[enemy.id] then
                local myHitboxes = player:getCurrentHitboxes()
                local enemyHitboxes = enemy:getCurrentHitboxes()
                for _, myHb in ipairs(myHitboxes) do
                    local myWorld = toWorld(player, myHb)
                    for _, enemyHb in ipairs(enemyHitboxes) do
                        local enemyWorld = toWorld(enemy, enemyHb)
                        if aabbOverlap(myWorld, enemyWorld) then
                            -- 弹反成功！
                            EventBus:emit("parry", {
                                defender = player,
                                attacker = enemy,
                            })
                            player.parry_targets[enemy.id] = true
                            goto nextEnemy
                        end
                    end
                end
            end
            ::nextEnemy::
        end
    end

    -- 动画播完 → 回站立
    if player.anim_finished then
        player:setState(0)
    end
end

return State
```

弹反事件处理：

```lua
EventBus:on("parry", function(event)
    local defender = event.defender  -- 弹反的人
    local attacker = event.attacker  -- 被弹反的人

    -- 1. 取消攻击者的攻击（强制进被击状态）
    attacker:setState(5000)

    -- 2. 攻击者受伤
    attacker.life = attacker.life - 20  -- 弹反反击伤害

    -- 3. 触发 hitstop（弹反的打击感）
    Game.hitstop = 10
    defender.hitPauseTime = 10
    attacker.hitPauseTime = 10

    -- 4. 弹反特效
    EntityManager.spawn("parry_spark", attacker.x, attacker.y - 60, defender.facing)
    playSound("parry")

    -- 5. 弹反者加魔人槽
    defender.devil_trigger = math.min(defender.devil_trigger + 50, 1000)
end)
```

#### 弹反的时机窗口

弹反不是全程可触发，只在特定帧（格挡框生效的帧）：

```json
{
  "id": "parry",
  "elements": [
    { "index": 0, "duration": 2, "hitboxes": [], ... },          // 起手，无格挡框
    { "index": 1, "duration": 4, "hitboxes": [格挡框], ... },    // ★ 判定帧，格挡框生效
    { "index": 2, "duration": 3, "hitboxes": [], ... },          // 收招，无格挡框
  ]
}
```

```
帧0-1: 起手（无格挡框，不能弹反）
帧2-5: 判定帧（格挡框生效，能弹反）← 4帧窗口
帧6-8: 收招（无格挡框，不能弹反）
```

鬼泣的皇家护卫格挡窗口很短（4-6帧），需要精确时机。

### 10.4 SuperPause / Pause：冻场

#### 什么是冻场

超必杀发动的瞬间，**整个游戏冻住几帧**（除了超必杀的角色），配合特效（屏幕变暗/闪光/时间减慢）——叫冻场。

MUGEN 的 SuperPause：

```ini
; MUGEN：超必杀冻场
[State 3000, SuperPause]
type = SuperPause
trigger1 = time = 0
time = 30           ; 冻场30帧
anim = 3000         ; 冻场期间的特效动画
sound = 30, 0       ; 冻场音效
poweradd = -1000    ; 消耗1000能量
```

#### 和 hitstop 的区别

| | hitstop | SuperPause |
|---|---|---|
| 谁冻住 | 攻击者 + 被击者 | 全场（除发动者） |
| 时长 | 短（2-8帧） | 长（30-60帧） |
| 时机 | 命中瞬间 | 超必杀发动 |
| 目的 | 打击感 | 表现力（强调大招） |

#### 我们的实现

```lua
function Game:superPause(frames, player, options)
    -- frames: 冻场帧数
    -- player: 发动者（不冻住）
    -- options: { darken=是否变暗, sound=音效 }
    self.super_pause = {
        frames = frames,
        player = player,         -- 发动者不冻
        darken = options and options.darken or true,
    }
end

-- 主循环里检查
function love.update(dt)
    local inSuperPause = Game.super_pause and Game.super_pause.frames > 0
    local inHitstop = Game.hitstop > 0
    local frozen = inSuperPause or inHitstop

    for _, player in ipairs(players) do
        if inSuperPause and player ~= Game.super_pause.player then
            -- 冻场：发动者以外的角色不更新
        else
            player:update(dt, buf, frozen)
        end
    end

    -- 冻场倒计时
    if Game.super_pause then
        Game.super_pause.frames = Game.super_pause.frames - 1
        if Game.super_pause.frames <= 0 then
            Game.super_pause = nil
        end
    end
end
```

渲染时冻场特效（屏幕变暗）：

```lua
function love.draw()
    -- ... 正常渲染 ...

    -- 冻场时屏幕变暗
    if Game.super_pause and Game.super_pause.darken then
        love.graphics.setColor(0, 0, 0.3, 0.5)  -- 蓝暗半透明
        love.graphics.rectangle("fill", 0, 0, love.graphics.getWidth(), love.graphics.getHeight())
        love.graphics.setColor(1, 1, 1, 1)
    end
end
```

#### 使用场景

```lua
-- 大招状态进入时冻场
function State:onEnter(player)
    Game:superPause(30, player, { darken = true, sound = "super_activate" })
    -- 30帧冻场，除了发动者全场冻住
    -- 屏幕变暗，播放音效
end
```

#### 大招演出系统（CutIn）

冻场只是基础。格斗游戏（如 MVMC3）和鬼泣的大招还有完整的**演出**——背景切换、角色头像弹出、招式名、闪光、震屏。2D 横版也能做，用**图层叠加 + 缓动动画**模拟。

```
MVMC3（3D格斗）的大招演出 vs 我们（2D横版）：

MVMC3：                          我们2D：
  3D相机拉近                       图层叠加（不用相机）
  换3D场景                         叠加专属背景图
  3D模型特写                       角色冻住 + 头像弹出
  3D动画序列                       2D帧序列或图层缓动
```

**演出系统的图层**：

| 图层 | 效果 | 实现 |
|---|---|---|
| 背景变暗 | 原画面变蓝暗 | 半透明矩形覆盖 |
| 专属背景 | 大招专属背景图 | 精灵图 + 渐变 |
| 角色头像 | 从侧面滑入 | 精灵图 + 缓动移动 |
| 招式名 | 从小变大弹出 | 文字 + 缩放缓动 |
| 全屏闪光 | 白闪1-3帧 | 白色矩形 + 快速淡出 |
| 震屏 | 画面抖动 | 渲染偏移随机 |

**演出配置**：

```lua
--- 启动大招演出
---@param player Player 发动者
---@param options table 演出配置
function Game:startCutIn(player, options)
    self.cutin = {
        player = player,
        time = 0,
        duration = options.duration or 45,  -- 演出总时长
        layers = {},                        -- 图层列表
        shake_offset = nil,                 -- 震屏偏移
    }
    local cutin = self.cutin

    -- 图层1：背景变暗（蓝暗渐变）
    table.insert(cutin.layers, {
        type = "darken",
        color = { 0, 0, 0.2 },
        alpha = 0,
        target_alpha = 0.6,
        fade_in = 5,       -- 5帧渐变到0.6
        fade_out = 5,       -- 最后5帧渐变回0
    })

    -- 图层2：专属背景图（可选）
    if options.bg_image then
        table.insert(cutin.layers, {
            type = "background",
            image = love.graphics.newImage(options.bg_image),
            alpha = 0,
            target_alpha = 0.8,
            fade_in = 10,
            fade_out = 10,
        })
    end

    -- 图层3：角色头像（从左侧滑入）
    if options.portrait then
        table.insert(cutin.layers, {
            type = "portrait",
            image = love.graphics.newImage(options.portrait),
            x = -200,              -- 从屏幕左侧外开始
            target_x = 50,
            start_time = 5,        -- 第5帧开始滑入
            slide_duration = 10,   -- 10帧滑到位
        })
    end

    -- 图层4：招式名（从小变大弹出）
    if options.skill_name then
        table.insert(cutin.layers, {
            type = "text",
            text = options.skill_name,
            scale = 0,
            target_scale = 1,
            start_time = 10,
            pop_duration = 8,     -- 8帧弹出
        })
    end

    -- 图层5：全屏闪光（1-3帧白闪）
    table.insert(cutin.layers, {
        type = "flash",
        alpha = 1,
        fade_out = 3,             -- 3帧快速消失
        start_time = 0,
    })

    -- 图层6：震屏
    if options.shake then
        table.insert(cutin.layers, {
            type = "shake",
            intensity = options.shake,
            duration = 15,
        })
    end

    -- 同时启动冻场（演出期间全场冻住，除发动者）
    Game:superPause(options.duration or 45, player, {})
end
```

**更新各图层**：

```lua
function Game:updateCutIn()
    if not self.cutin then return end
    local cutin = self.cutin
    cutin.time = cutin.time + 1

    for _, layer in ipairs(cutin.layers) do
        local t = cutin.time

        if layer.type == "darken" then
            -- 渐变：前 fade_in 帧渐入，最后 fade_out 帧渐出
            if t < layer.fade_in then
                layer.alpha = layer.target_alpha * (t / layer.fade_in)
            elseif t > cutin.duration - layer.fade_out then
                layer.alpha = layer.target_alpha * ((cutin.duration - t) / layer.fade_out)
            else
                layer.alpha = layer.target_alpha
            end

        elseif layer.type == "background" then
            -- 和 darken 同理的渐变
            if t < layer.fade_in then
                layer.alpha = layer.target_alpha * (t / layer.fade_in)
            elseif t > cutin.duration - layer.fade_out then
                layer.alpha = layer.target_alpha * ((cutin.duration - t) / layer.fade_out)
            else
                layer.alpha = layer.target_alpha
            end

        elseif layer.type == "portrait" then
            -- 从 -200 滑到 target_x
            if t >= layer.start_time then
                local progress = math.min(1, (t - layer.start_time) / layer.slide_duration)
                -- 缓动：ease out
                progress = 1 - (1 - progress) * (1 - progress)
                layer.x = -200 + (layer.target_x - (-200)) * progress
            end

        elseif layer.type == "text" then
            -- 从小变大
            if t >= layer.start_time then
                local progress = math.min(1, (t - layer.start_time) / layer.pop_duration)
                layer.scale = layer.target_scale * progress
            end

        elseif layer.type == "flash" then
            -- 快速消失
            if t >= layer.start_time then
                layer.alpha = math.max(0, 1 - (t - layer.start_time) / layer.fade_out)
            end

        elseif layer.type == "shake" then
            -- 震屏偏移
            if t < layer.duration then
                local decay = 1 - (t / layer.duration)  -- 逐渐减弱
                cutin.shake_offset = {
                    x = math.random(-layer.intensity, layer.intensity) * decay,
                    y = math.random(-layer.intensity, layer.intensity) * decay,
                }
            else
                cutin.shake_offset = nil
            end
        end
    end

    -- 演出结束
    if cutin.time >= cutin.duration then
        self.cutin = nil
    end
end
```

**渲染演出图层**：

```lua
function Game:drawCutIn()
    if not self.cutin then return end
    local cutin = self.cutin

    for _, layer in ipairs(cutin.layers) do
        if layer.type == "darken" then
            love.graphics.setColor(layer.color[1], layer.color[2], layer.color[3], layer.alpha)
            love.graphics.rectangle("fill", 0, 0,
                love.graphics.getWidth(), love.graphics.getHeight())

        elseif layer.type == "background" then
            love.graphics.setColor(1, 1, 1, layer.alpha)
            love.graphics.draw(layer.image, 0, 0)

        elseif layer.type == "portrait" then
            love.graphics.setColor(1, 1, 1, 1)
            love.graphics.draw(layer.image, layer.x, 50)

        elseif layer.type == "text" then
            love.graphics.setColor(1, 1, 0, 1)
            love.graphics.setFont(bigFont)
            love.graphics.printf(layer.text, 0, 200,
                love.graphics.getWidth(), "center", 0, layer.scale, layer.scale)

        elseif layer.type == "flash" then
            love.graphics.setColor(1, 1, 1, layer.alpha)
            love.graphics.rectangle("fill", 0, 0,
                love.graphics.getWidth(), love.graphics.getHeight())
        end
    end
    love.graphics.setColor(1, 1, 1, 1)
end
```

**震屏在 love.draw 开头加偏移**：

```lua
function love.draw()
    -- 震屏偏移（在最外层 translate）
    if Game.cutin and Game.cutin.shake_offset then
        love.graphics.push()
        love.graphics.translate(Game.cutin.shake_offset.x, Game.cutin.shake_offset.y)
    end

    -- ... 正常渲染（背景/角色/特效）...

    -- 演出图层（画在所有东西上面，不受震屏影响）
    -- 注意：pop 之前画游戏内容，pop 之后画演出 UI
    if Game.cutin and Game.cutin.shake_offset then
        love.graphics.pop()
    end

    Game:drawCutIn()  -- 演出图层在震屏之外
end
```

**演出时间线**：

```
帧0:   全屏闪光（白闪3帧）+ 震屏开始 + 背景渐暗
帧3:   闪光消失，背景继续渐暗
帧5:   头像从左侧滑入（10帧滑到位）
帧10:  招式名弹出（从小变大，8帧）
帧15:  震屏结束
帧18:  头像+招式名稳定显示
帧35:  开始淡出（头像滑出、背景渐亮）
帧45:  演出结束，恢复正常

帧:  0    5    10   15   20   30   35   40   45
     ████                              ░░░░
闪光 ──┘                               渐出
背景 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
头像      →→→→→                         ←←←←
文字           POP!                      消失
震屏 ███████████████
```

**使用**：

```lua
-- 大招状态进入时启动演出
function State:onEnter(player)
    Game:startCutIn(player, {
        duration = 45,                          -- 45帧演出
        bg_image = "cutin/vergil_dt_bg.png",    -- 专属背景
        portrait = "cutin/vergil_portrait.png", -- 头像
        skill_name = "JUDGEMENT CUT END",       -- 招式名
        shake = 8,                              -- 震屏幅度
    })
    player.devil_trigger = player.devil_trigger - 500  -- 消耗 DT
end
```

**渲染顺序（含演出）**：

```
1. 正常游戏画面（角色/特效/背景，冻住不动）
   ├─ 震屏偏移影响这一层
2. ★ 演出背景层（蓝暗覆盖 + 专属背景）
3. ★ 头像层
4. ★ 招式名文字层
5. ★ 闪光层（最上层，短暂）
6. UI（始终最上，不受演出影响）
```

### 10.5 persistent：SCTRL 持久化

#### 什么是 persistent

MUGEN 的 `persistent` 控制 SCTRL 多久触发一次。默认 `persistent = 1`（每帧触发），`persistent = 2` 表示每2帧触发一次：

```ini
; MUGEN：每5帧加一次血
[State 0, 回血]
type = LifeAdd
trigger1 = 1
value = 1
persistent = 5      ; 每5帧触发一次（不是每帧）
```

#### 我们的实现

Love2D 里不用 persistent 参数，直接在状态代码里用计时器控制：

```lua
-- MUGEN persistent = 5 的等价写法
function State:onUpdate(player, dt)
    -- 用计时器控制触发频率
    if (player.state_time % 5) == 0 then
        player.life = player.life + 1   -- 每5帧加1血
    end
end
```

或者用专门的计数器：

```lua
function State:onEnter(player)
    player.heal_counter = 0
end

function State:onUpdate(player, dt)
    player.heal_counter = player.heal_counter + 1
    if player.heal_counter >= 5 then
        player.heal_counter = 0
        player.life = player.life + 1   -- 每5帧加1血
    end
end
```

`state_time % N == 0` 更简洁，不需要专门计数器。

### 10.6 本章总结

| 概念 | 说明 |
|---|---|
| HitBy / NotHitBy | 无敌帧：某些帧内不被打 |
| HitOverride | 命中覆盖：被打时不进被击状态，进自定义状态（霸体/格挡） |
| ReversalDef | 当身/弹反：自己的格挡框碰对手攻击框 → 取消对手攻击 + 反击 |
| SuperPause | 冻场：超必杀发动时全场冻住（除发动者），配合变暗特效 |
| persistent | SCTRL 持久化：控制触发频率（我们用 state_time % N 替代） |

**关键点**：

1. **无敌帧**：NotHitBy 设 N 帧无敌，碰撞检测跳过无敌角色
2. **HitOverride**：被打时不进被击(5000)，进自定义状态（霸体/格挡），命中系统里检查
3. **弹反不用 jcbox**：用专门状态 + hitbox（格挡框）vs 敌人 hitbox（攻击框），检测到就取消敌人攻击 + 反击
4. **冻场 vs hitstop**：冻场全场冻住（超必杀），hitstop 只冻双方（命中打击感）
5. **persistent 用 state_time % N**：不需要专门的持久化参数，Lua 直接用取模

**下一步**：第十一章讲鬼泣特色系统（JC 完整实现/DT 取消/武器切换/连段评价/锁定），把前面所有系统整合成完整的鬼泣战斗框架。

---

*第十章完。高级系统完善了战斗的最后一块拼图——无敌帧保护、霸体抗压、弹反反击、超必杀冻场，第十一章把这些整合成鬼泣特色系统。*

---

## 第十一章：鬼泣特色系统

前十章讲了基础系统。这一章把这些整合成鬼泣特有的战斗机制——JC 完整实现、DT 取消、武器切换、连段评价、锁定系统。这是让游戏"有鬼泣手感"的最后一层。

### 11.1 JC（Jump Cancel）完整实现

JC 是鬼泣空中连段的核心。前面各章讲过 JC 的各个部分，这里整合成完整流程。

#### JC 的完整流程

```
1. 角色空中下落，有 jcbox（踩怪判定框）
2. jcbox 碰到敌人的 jcbox → 设 jcContact = true（§7.9）
3. -1 state 的 trigger entry 检测：
   - 按跳跃（cmd("holdup")）
   - 在空中（T.inAir）
   - jcContact = true
   - prevStateNo != 45（JC不能连JC，§7.10）
4. 满足 → ChangeState(45)（空中跳跃）
5. 空中跳跃状态(45)的 onEnter：
   - vy = jump_y（弹起）
   - air_skill_used = {}（重置空中技能CD，§8.11）
   - airjump_count = 0（重置空中跳跃）
   - jcContact = false（清空标记）
6. 弹起后玩家可以接：
   - 空中攻击（技能CD已重置，可以再用）
   - 空中跳跃（airjump_count已重置）
   → 无限循环，只要踩得到
```

#### 完整的 trigger entry

```lua
-- 踩怪 JC（优先级最高，JC不能连JC）
{
    name = "enemy_step_jc",
    changeState = 45,
    priority = 95,
    triggerall = {
        cmd("holdup"),                              -- 按跳跃
        T.inAir,                                    -- 在空中
        function(p) return p.jcContact end,         -- 踩到了
        function(p) return p.prevStateNo ~= 45 end, -- JC不能连JC
    },
    triggers = {
        { T.ctrl },                                  -- 有控制权
        { T.moveContact },                           -- 或攻击命中中
    },
}

-- 二段跳（普通空中跳跃，没踩到敌人时的后备，有次数限制）
-- 和踩怪JC进同一个状态45，但不重置CD
{
    name = "air_jump",
    changeState = 45,
    priority = 50,
    triggerall = {
        cmd("holdup"),
        T.inAir,
        function(p) return (p.airjump_count or 0) < p.config.airjump_num end,  -- 次数限制
    },
    triggers = {
        { T.ctrl, function(p) return p.vy > 0 end },  -- 自由下落
    },
}
```

踩怪JC 和 二段跳的区别（都进状态45，但 onEnter 的处理不同）：

| | 踩怪JC（priority=95） | 二段跳（priority=50） |
|---|---|---|
| 触发条件 | jcContact=true（踩到敌人） | airjump_count < 上限 + 自由下落 |
| 重置空中技能CD | ✅ air_skill_used={} | ❌ 不重置 |
| 重置airjump_count | ✅ 重置为0 | ❌ count+1 |
| 可无限？ | ✅ 只要踩得到 | ❌ 次数用完不能跳 |

#### 空中跳跃状态(45)

```lua
-- states/45.lua：空中跳跃（踩怪JC和二段跳都进这个状态）
local State = {}
State.stateNo   = 45
State.stateType = "A"
State.physics   = "A"
State.moveType  = "I"
State.anim      = "airjump"
State.ctrl      = true

function State:onEnter(player)
    player.vy = player.config.jump_y     -- 弹起

    -- ★ 区分踩怪JC和二段跳
    if player.jcContact then
        -- 踩怪JC：重置CD + 重置跳跃次数
        player.air_skill_used = {}            -- 重置空中技能CD
        player.airjump_count = 0              -- 重置空中跳跃次数
        player.jcContact = false              -- 清空踩怪标记
    else
        -- 二段跳：只加次数，不重置CD
        player.airjump_count = (player.airjump_count or 0) + 1
    end
end

function State:onFrame(player, frame, buf)
    -- 空中可以左右微调
    if buf:held("fwd") then
        player.vx = approach(player.vx, player.config.walk_fwd * 0.8, 0.3)
    elseif buf:held("back") then
        player.vx = approach(player.vx, -player.config.walk_back * 0.8, 0.3)
    end

    -- 落地检测
    if player.y >= player.groundY then
        player.y = player.groundY
        player:setState(50)
    end
end

return State
```

#### JC 连段示例

```
跳跃(40) → 空中攻击A(400) → 命中
  → 下落，jcbox碰到敌人 → jcContact=true
  → 按跳 → 踩怪JC(45) → air_skill_used={} 重置 + airjump_count=0
  → 空中攻击A(400) → 命中（CD已重置，可以再用）
  → 下落，jcbox碰到敌人 → jcContact=true
  → 按跳 → 踩怪JC(45) → 重置
  → 空中攻击B(410) → 命中
  → 下落，踩到 → 踩怪JC(45) → 重置
  → ...无限循环，只要踩得到

如果没踩到 → 按跳 → 二段跳(45) → airjump_count+1（不重置CD）
  → 二段跳次数用完 → 不能再跳 → 落地(50) → 连段结束
```

### 11.2 DT 取消/魔人化

#### 什么是 DT

DT（Devil Trigger）是鬼泣的变身系统：消耗资源变身为魔人，强化攻击力/速度/恢复。DT 取消是"在攻击中消耗 DT 取消当前动作"——高等级取消，能取消大部分攻击后摇。

魔人化不只是改数值——**是完全不同的技能集**。维吉尔普通态5连斩，魔人态7连斩；普通态瞬闪有限制，魔人态可连续冲刺。

#### 资源系统

```lua
-- config.lua
local config = {
    -- ... 其他 ...
    devil_trigger_max = 1000,       -- DT 槽上限
    devil_trigger_gain = 10,        -- 每次命中加多少
    devil_trigger_dt_cost = 500,    -- 进入魔人化消耗
    devil_trigger_cancel_cost = 200,-- DT取消消耗
    dt_time = 600,                  -- 魔人化持续帧数（10秒）
    dt_attack_mul = 1.5,            -- 魔人化攻击力倍率
    dt_speed_mul = 1.2,             -- 魔人化速度倍率
    dt_anim_speed = 1.3,            -- 魔人化动画播放速度（攻速+30%）
    dt_defence_mul = 0.8,           -- 魔人化受伤减少20%
}
```

```lua
-- 命中时加 DT 槽（§8.4 命中系统）
attacker.devil_trigger = math.min(
    attacker.devil_trigger + (hd.power_add or 10), 1000)

-- 被击时也加 DT 槽（挨打也能攒）
target.devil_trigger = math.min(
    target.devil_trigger + 5, 1000)
```

#### 魔人化：切换技能集

魔人化不只是改数值，是**完全不同的技能集**——不同状态号、不同动画、不同 hitdef、不同取消规则：

```
维吉尔普通态：              维吉尔魔人态：
  按攻击 → 200（5连斩）       按攻击 → 1200（7连斩）
  前前 → 100（瞬闪1段）       前前 → 1100（连续冲刺，可反复）
  站立 → 0                    站立 → 1000
  
同样按攻击键，普通态和魔人态出的是完全不同的技能
```

状态文件组织（完全独立的状态号）：

```
states/
├── 0.lua           -- 站立（普通态）
├── 200.lua         -- 攻击1（普通态5连斩第1段）
├── 201.lua         -- 攻击2
├── ...
├── 1000.lua        -- 站立（魔人态，不同动画）
├── 1200.lua        -- 攻击1（魔人态7连斩第1段）
├── 1201.lua        -- 攻击2
├── ...
├── 1100.lua        -- 连续冲刺（魔人态专用，冷却短可反复）
└── ...
```

#### trigger entry 按 dt_active 分流

同一个按键，根据 `dt_active` 走不同的 trigger entry：

```lua
-- 普通态攻击（5连斩）
{
    name = "normal_attack",
    changeState = 200,
    priority = 10,
    triggerall = {
        cmd("a"),
        function(p) return not p.dt_active end,  -- ★ 非魔人态
        T.onGround,
    },
    triggers = { { T.ctrl } },
}

-- 魔人态攻击（7连斩，不同状态号）
{
    name = "dt_attack",
    changeState = 1200,
    priority = 10,
    triggerall = {
        cmd("a"),
        function(p) return p.dt_active end,     -- ★ 魔人态
        T.onGround,
    },
    triggers = { { T.ctrl } },
}

-- 普通态瞬闪（有次数/冷却限制）
{
    name = "normal_trick",
    changeState = 100,
    priority = 60,
    triggerall = {
        cmd("ff"),
        function(p) return not p.dt_active end,
    },
    triggers = { { T.ctrl } },
}

-- 魔人态连续冲刺（冷却短，可反复连冲）
{
    name = "dt_trick",
    changeState = 1100,
    priority = 60,
    triggerall = {
        cmd("ff"),
        function(p) return p.dt_active end,
    },
    triggers = { { T.ctrl } },
}
```

普通态和魔人态的技能对比：

```
普通态 5连斩(200-204)：       魔人态 7连斩(1200-1206)：
  200 → 201 → 202 → 203 → 204    1200 → 1201 → ... → 1206
  每段3帧取消窗口                  每段2帧取消窗口（更快）
  damage=50/段                    damage=75/段（1.5倍）
  
普通态瞬闪(100)：            魔人态连续冲刺(1100)：
  冷却20帧                        冷却5帧（可反复）
  最多连续2次                      无次数限制
```

#### 魔人化进入/退出

```lua
function Player:enterDevilTrigger()
    if self.devil_trigger < self.config.devil_trigger_dt_cost then return false end
    self.devil_trigger = self.devil_trigger - self.config.devil_trigger_dt_cost
    self.dt_active = true
    self.dt_time = self.config.dt_time

    -- 数值强化
    self.attack_mul = self.config.dt_attack_mul
    self.speed_mul = self.config.dt_speed_mul
    self.anim_speed_mul = self.config.dt_anim_speed
    self.defence_mul = self.config.dt_defence_mul

    -- 切换当前状态（站立 → 魔人态站立）
    if self.stateNo == 0 then
        self:setState(1000)
    end

    return true
end

function Player:updateDevilTrigger()
    if not self.dt_active then return end
    self.dt_time = self.dt_time - 1
    if self.dt_time <= 0 then
        self:exitDevilTrigger()
    end
end

function Player:exitDevilTrigger()
    self.dt_active = false
    self.attack_mul = 1.0
    self.speed_mul = 1.0
    self.anim_speed_mul = 1.0
    self.defence_mul = 1.0

    -- 切回普通态
    if self.stateNo == 1000 then
        self:setState(0)
    end
end
```

#### 攻速 = 动画播放速度

"攻速"在 2D 帧动画里本质是**动画播放速度**——用 `anim_speed_mul` 控制每帧推进速度：

```lua
-- Player:updateAnim 修改（Part 1 §5.5）
function Player:updateAnim()
    if not self.anim then return end
    -- ★ 每帧推进 = 1.0 * anim_speed_mul
    -- 1.0 = 正常，1.5 = 快50%，0.5 = 慢50%
    self.anim_tick = self.anim_tick + (self.anim_speed_mul or 1.0)
    local frame = self.anim.elements[self.anim_frame]
    if self.anim_tick >= frame.duration then
        self.anim_tick = 0
        self.anim_frame = self.anim_frame + 1
        -- ... 循环/结束处理 ...
    end
end
```

```
正常（anim_speed_mul=1.0）：
  帧0(3tick) → 帧1(3tick) → 帧2(3tick) = 总共9tick

攻速+30%（anim_speed_mul=1.3，魔人化）：
  帧0(2.3tick) → 帧1(2.3tick) → 帧2(2.3tick) = 总共7tick（快22%）

攻速+50%（anim_speed_mul=1.5，狂暴buff）：
  帧0(2tick) → 帧1(2tick) → 帧2(2tick) = 总共6tick（快33%）
```

#### Buff 系统：通用的属性修改

魔人化只是 buff 的一种。通用的 buff 系统可以叠加多种效果（攻速/攻击力/防御/速度）：

```lua
--- 添加 buff
function Player:addBuff(id, name, duration, mods)
    self.buffs = self.buffs or {}
    -- 同 id 的 buff 刷新（不叠加）
    for _, b in ipairs(self.buffs) do
        if b.id == id then
            b.duration = duration
            return
        end
    end
    table.insert(self.buffs, {
        id = id, name = name, duration = duration, mods = mods,
    })
end

--- 更新所有 buff
function Player:updateBuffs()
    for i = #self.buffs, 1, -1 do
        local b = self.buffs[i]
        b.duration = b.duration - 1
        if b.duration <= 0 then
            table.remove(self.buffs, i)
        end
    end
end

--- 获取合并后的属性倍率（乘法叠加）
function Player:getMods()
    local mods = {
        attack_mul = 1.0,
        speed_mul = 1.0,
        anim_speed_mul = 1.0,
        defence_mul = 1.0,
    }
    for _, b in ipairs(self.buffs or {}) do
        for key, value in pairs(b.mods) do
            mods[key] = (mods[key] or 1.0) * value
        end
    end
    return mods
end
```

使用：

```lua
-- 魔人化（作为 buff）
player:addBuff("devil_trigger", "魔人化", 600, {
    attack_mul = 1.5,
    speed_mul = 1.2,
    anim_speed_mul = 1.3,
    defence_mul = 0.8,
})

-- 狂暴药水（临时 buff，可和魔人化叠加）
player:addBuff("berserk", "狂暴", 300, {
    attack_mul = 2.0,
    anim_speed_mul = 1.5,
    defence_mul = 1.5,  -- 副作用：受伤增加
})

-- 减速 debuff（敌人施加）
player:addBuff("slow", "减速", 120, {
    speed_mul = 0.5,
    anim_speed_mul = 0.5,
})
```

buff 叠加（乘法）：

```
魔人化 + 狂暴同时生效：
  attack_mul = 1.5 * 2.0 = 3.0（3倍攻击力）
  anim_speed_mul = 1.3 * 1.5 = 1.95（攻速+95%）
  defence_mul = 0.8 * 1.5 = 1.2（受伤增加20%，副作用）
```

读取 buff 属性：

```lua
-- 命中伤害
local mods = attacker:getMods()
local damage = hd.damage * mods.attack_mul

-- 动画播放
self.anim_tick = self.anim_tick + mods.anim_speed_mul

-- 移动速度
local speed = self.config.walk_fwd * mods.speed_mul

-- 受伤
local actualDamage = incomingDamage * (self.defence_mul or 1.0)
```

#### DT 取消

DT 取消是"消耗 DT 取消当前攻击后摇"——优先级比普通取消高：

```lua
-- DT 取消的 trigger entry（优先级最高）
{
    name = "dt_cancel",
    changeState = 0,           -- 回站立（或切到其他状态）
    priority = 100,            -- ★ 最高优先级
    triggerall = {
        cmd("dt"),             -- 按 DT 键
        function(p)
            return p.devil_trigger >= p.config.devil_trigger_cancel_cost
        end,                   -- DT 够
        T.attacking,           -- 必须在攻击中
        function(p) return p.state_time >= 5 end,  -- 至少第5帧后
    },
    triggers = {
        { T.ctrl },            -- 有控制权
        { T.moveContact },     -- 或命中中
        { function(p) return true end },  -- 或任何时候（DT取消最宽松）
    },
}
```

```lua
-- DT 取消处理
EventBus:on("dt_cancel", function(player)
    player.devil_trigger = player.devil_trigger - player.config.devil_trigger_cancel_cost
    -- DT取消可以触发魔人化或只取消动作
end)
```

#### 取消等级总表

```
DT取消(100) > 踩怪JC(95) > 取消窗口(50-80) > 二段跳(50)
```

DT 取消优先级最高——任何攻击都能用 DT 取消，但消耗资源。
踩怪JC 次之——必须踩到敌人才能触发。
二段跳最低——没踩到时的后备，有次数限制。

### 11.3 武器/风格切换

#### 什么是武器切换

鬼泣里同一按键在不同武器下出不同招。维吉尔切换武器（阎魔刀/贝欧武夫/幻影剑），但丁切换风格（骗术师/剑圣/枪神/皇家护卫）。

#### 实现：用 weapon 命名字段

```lua
-- 武器切换
function Player:switchWeapon(newWeapon)
    self.weapon = newWeapon
    -- 切换时清空命令进度（防止借用，§9.6）
    for name, cmd in pairs(commands) do
        Command.reset(cmd)
    end
end

-- trigger entry 里根据 weapon 分流
-- 同一个"按攻击键"，不同武器出不同招：
{
    name = "attack_sword",
    changeState = 200,
    priority = 10,
    triggerall = {
        cmd("a"),
        function(p) return p.weapon == "sword" end,  -- 阎魔刀
    },
    triggers = { { T.ctrl, T.onGround } },
}
{
    name = "attack_fist",
    changeState = 250,
    priority = 10,
    triggerall = {
        cmd("a"),
        function(p) return p.weapon == "fist" end,   -- 贝欧武夫（拳套）
    },
    triggers = { { T.ctrl, T.onGround } },
}
{
    name = "attack_gun",
    changeState = 300,
    priority = 10,
    triggerall = {
        cmd("a"),
        function(p) return p.weapon == "gun" end,    -- 幻影剑/枪
    },
    triggers = { { T.ctrl, T.onGround } },
}
```

#### 武器切换的 trigger entry

武器切换不是瞬间切——攻击中按切换键时，**等后摇结束才切**（预输入）。靠命令缓冲（input 文档 §4 的 buffer_time）实现：

```lua
-- commands.lua：切换命令带 buffer_time（预输入窗口）
local commands = {
    switch = {
        steps = { {keys = {{name = "switch"}}} },
        buffer_time = 10,  -- ★ 匹配后保留10帧
    },
}

-- trigger entry：优先级低，只在 ctrl + 非攻击时才切
{
    name = "switch_weapon",
    changeState = 100,    -- 切换状态
    priority = 5,         -- ★ 很低（不打断任何动作）
    triggerall = {
        cmd("switch"),    -- 命令在 buffer 里（10帧内按过都算）
        T.ctrl,           -- ★ 必须有控制权（攻击后摇结束才触发）
        T.onGround,
        function(p) return p.state.moveType ~= "A" end,  -- 非攻击中
    },
    triggers = {
        { function(p) return true end },
    },
}
```

**预输入流程**：

```
帧0-5:  Yamato 攻击前摇（ctrl=false）→ 按切换键 → 命令进 buffer
帧6-8:  攻击判定（ctrl=false）→ 命令在 buffer 里
帧9-15: 攻击后摇（ctrl=false）→ 命令在 buffer 里
帧16:   攻击结束 → ctrl=true → trigger entry 检查：
        cmd("switch")=true（buffer 还在）+ ctrl=true + 非攻击 → 触发！
        → ChangeState(100) 切换武器

玩家在帧0按了切换键，但到帧16才真正切换 → 预输入
如果 buffer_time < 16（比如 buffer_time=10）→ 命令过期 → 不切（按太早了）
```

**武器切换 vs 取消的区别**：

| | 取消 | 武器切换 |
|---|---|---|
| 时机 | 后摇中立刻打断 | 后摇结束才切 |
| 效果 | 瞬间切到新技能 | 等当前动作完成再切 |
| 优先级 | 高（50-100） | 低（5） |
| 机制 | trigger entry 即时检查 | buffer_time 预输入 + ctrl 恢复后才触发 |

#### 武器切换状态

```lua
-- states/100.lua：武器切换状态（短暂不可取消）
function State:onEnter(player)
    local weapons = {"sword", "fist", "gun"}
    local idx = 1
    for i, w in ipairs(weapons) do
        if w == player.weapon then idx = i break end
    end
    idx = idx % #weapons + 1  -- 下一个武器
    player:switchWeapon(weapons[idx])
end
```

#### 取消等级总表（含武器切换）

```
DT取消(100) > 踩怪JC(95) > 取消窗口(50-80) > 二段跳(50) > ... > 武器切换(5)
```

武器切换优先级最低——不打断任何动作，只靠 buffer_time 预输入 + ctrl 恢复后自然触发。

#### 风格切换（但丁）

但丁的风格切换和武器切换类似，但切的是"风格行为"而非攻击招式：

| 风格 | 按风格键的效果 | 对应系统 |
|---|---|---|
| 骗术师 | 闪避/瞬移 | 专门状态(160) |
| 剑圣 | 剑技强化 | 改变攻击状态 |
| 枪神 | 枪械强化 | 改变射击状态 |
| 皇家护卫 | 格挡/释放 | HitOverride + ReversalDef（§10.2） |

```lua
function State:onFrame(player, frame, buf)
    -- 风格键根据当前风格执行不同行为
    if buf:justPressed("style") then
        if player.style == "trickster" then
            player:setState(160)  -- 闪避
        elseif player.style == "royalguard" then
            player:setState(1300) -- 格挡（§10.2）
        elseif player.style == "swordmaster" then
            player:setState(210)  -- 剑技
        elseif player.style == "gunslinger" then
            player:setState(310)  -- 枪技
        end
    end
end
```

### 11.4 连段评价系统（Style 评分）

#### 什么是 Style 评分

鬼泣的核心特色：连续用不同招式打敌人会提高评价（D→C→B→A→S→SS→SSS），用重复招式评价下降。评价越高伤害越高/视觉越华丽。

#### 评分规则

```lua
local StyleSystem = {
    rank = "D",       -- 当前评价 D/C/B/A/S/SS/SSS
    score = 0,        -- 分数
    decay_timer = 0,  -- 衰减计时器
    decay_delay = 60, -- 60帧不命中开始衰减
    used_moves = {},  -- 本段连段用过的招式
}

-- 评分阈值
local RANK_THRESHOLDS = {
    D = 0,
    C = 500,
    B = 1500,
    A = 3000,
    S = 5000,
    SS = 8000,
    SSS = 12000,
}
```

#### 命中时加分

```lua
EventBus:on("hit", function(event)
    local hd = event.hitdef
    local attacker = event.attacker

    -- 基础分
    local baseScore = hd.damage * 10

    -- ★ 重复招式扣分（鬼泣核心：鼓励变化）
    local moveId = attacker.stateNo  -- 用状态号标识招式
    if StyleSystem.used_moves[moveId] then
        baseScore = baseScore * 0.3  -- 重复招式只给30%分
    end
    StyleSystem.used_moves[moveId] = true

    -- counter hit 加分
    if event.target.state.moveType == "A" then
        baseScore = baseScore * 1.5  -- counter 1.5倍
    end

    -- 空中连段加分
    if attacker.state.stateType == "A" then
        baseScore = baseScore * 1.3  -- 空中 1.3倍
    end

    StyleSystem.score = StyleSystem.score + baseScore
    StyleSystem.decay_timer = 0  -- 重置衰减

    -- 更新评价
    StyleSystem:updateRank()
end)
```

#### 衰减机制

```lua
function StyleSystem:update()
    self.decay_timer = self.decay_timer + 1
    if self.decay_timer >= self.decay_delay then
        -- 超过60帧没命中 → 分数衰减
        self.score = math.max(0, self.score - 50)
        self:updateRank()
    end
end

function StyleSystem:updateRank()
    local newRank = "D"
    for rank, threshold in pairs(RANK_THRESHOLDS) do
        if self.score >= threshold then
            -- 取最高的满足阈值
            if RANK_THRESHOLDS[newRank] and threshold > RANK_THRESHOLDS[newRank] then
                newRank = rank
            else
                newRank = rank
            end
        end
    end
    self.rank = newRank
end

-- 连段结束时清空 used_moves
function StyleSystem:resetCombo()
    self.used_moves = {}
end
```

#### 评价影响

```lua
-- 评价越高攻击力越高
function Player:getAttackMul()
    local rankMul = {
        D = 1.0, C = 1.0, B = 1.1, A = 1.2, S = 1.3, SS = 1.4, SSS = 1.5
    }
    local styleMul = rankMul[StyleSystem.rank] or 1.0
    local dtMul = self.dt_active and self.config.dt_attack_mul or 1.0
    return styleMul * dtMul
end

-- 命中伤害乘评价倍率
-- 在 HitSystem.onHit 里
target.life = target.life - hd.damage * attacker:getAttackMul()
```

#### 评价显示

```lua
function StyleSystem:draw()
    love.graphics.setColor(1, 1, 0)
    love.graphics.setFont(bigFont)
    love.graphics.print(self.rank, love.graphics.getWidth() - 100, 20)
    -- SSS 时变色/闪烁
    if self.rank == "SSS" then
        love.graphics.setColor(1, 0.3, 0.3)
        love.graphics.print("SSS!", love.graphics.getWidth() - 120, 20)
    end
    love.graphics.setColor(1, 1, 1, 1)
end
```

### 11.5 锁定系统

#### 什么是锁定

鬼泣有锁定系统：锁定一个敌人，攻击/移动都相对锁定目标。锁定时角色自动面向目标。

#### 实现

```lua
function Player:acquireLockTarget(enemies)
    -- 找最近的敌人
    local closest = nil
    local minDist = math.huge
    for _, enemy in ipairs(enemies) do
        if enemy ~= self and enemy:alive() then
            local dist = math.abs(enemy.x - self.x)
            if dist < minDist then
                minDist = dist
                closest = enemy
            end
        end
    end
    self.lock_target = closest
end

function Player:switchLockTarget(enemies)
    -- 切换到下一个敌人
    -- ...
end

function Player:clearLockTarget()
    self.lock_target = nil
end
```

#### 锁定的影响

```lua
-- 1. 自动面向锁定目标
function Player:updateLockFacing()
    if self.lock_target then
        self.facing = self.lock_target.x > self.x and 1 or -1
    end
end

-- 2. 相对方向（前后基于锁定目标，不是屏幕方向）
function Player:getRelativeDirection()
    if not self.lock_target then return 0 end
    return self.lock_target.x > self.x and 1 or -1
end

-- 3. 攻击自动修正方向
function State:onEnter(player)
    if player.lock_target then
        player.facing = player.lock_target.x > player.x and 1 or -1
    end
end
```

#### 锁定的 trigger entry

```lua
-- 按锁定键切换目标
{
    name = "lock_on",
    priority = 70,
    triggerall = {
        cmd("lock"),
        T.ctrl,
    },
    triggers = {
        { function(p)
            if p.lock_target then
                p:switchLockTarget(enemies)  -- 已锁定 → 切换
            else
                p:acquireLockTarget(enemies) -- 未锁定 → 锁定最近
            end
            return false  -- 不切状态，只操作锁定
        end },
    },
}
```

#### 锁定显示

```lua
function Player:drawLockOn()
    if not self.lock_target then return end
    -- 在锁定目标上画一个锁定标记
    love.graphics.setColor(1, 0, 0, 0.8)
    local t = self.lock_target
    love.graphics.rectangle("line", t.x - 25, t.y - 100, 50, 100)
    love.graphics.print("LOCK", t.x - 15, t.y - 120)
    love.graphics.setColor(1, 1, 1, 1)
end
```

### 11.6 整合：完整的鬼泣战斗框架

所有系统整合后的主循环：

```lua
function love.load()
    -- 初始化各系统
    HitSystem.init()           -- 命中系统（订阅 hit 事件）
    CollisionSystem.init()     -- 碰撞检测
    EntityManager.init()       -- 特效管理
    -- 加载角色
    for _, charData in ipairs(characters) do
        table.insert(players, Player.new(charData))
    end
end

function love.update(dt)
    Input.update()
    local buf = Input.getBuffer()
    local frozen = Game.hitstop > 0 or (Game.super_pause and Game.super_pause.frames > 0)

    -- 1. 角色更新
    for _, player in ipairs(players) do
        if not frozen or (Game.super_pause and player == Game.super_pause.player) then
            player:update(dt, buf, frozen)
            player:updateInvincible()      -- 无敌帧倒计时
            player:updateHitOverride()     -- HitOverride 倒计时
            player:updateDevilTrigger()    -- DT 倒计时
            player:updateSlashMarks()      -- 划痕淡出
        end
    end

    -- 2. 碰撞检测（§7）
    if not frozen then
        CollisionSystem.update(players)
    end

    -- 3. 特效更新（§9）
    EntityManager.update(frozen)

    -- 4. 连段评价衰减
    StyleSystem:update()

    -- 5. 冻场/hitstop 倒计时
    if Game.hitstop > 0 then Game.hitstop = Game.hitstop - 1 end
    if Game.super_pause then
        Game.super_pause.frames = Game.super_pause.frames - 1
        if Game.super_pause.frames <= 0 then Game.super_pause = nil end
    end
end

function love.draw()
    -- z 值排序渲染（§9.9）
    local renderList = {}
    -- ... 收集所有可渲染对象 ...
    table.sort(renderList, function(a, b) return a.z < b.z end)
    for _, item in ipairs(renderList) do item.draw() end

    -- UI
    StyleSystem:draw()       -- 评价显示
    for _, p in ipairs(players) do
        p:drawLockOn()       -- 锁定标记
    end
end
```

### 11.7 本章总结

| 特色系统 | 核心机制 | 涉及章节 |
|---|---|---|
| JC（Jump Cancel） | jcbox vs jcbox → jcContact → 按跳 → ChangeState(45) → 重置CD | §7.9 §7.10 §8.11 §11.1 |
| DT 取消/魔人化 | 消耗 DT 取消攻击 + 魔人化强化 | §11.2 |
| 武器/风格切换 | weapon 命名字段 + trigger entry 按武器分流 | §11.3 |
| 连段评价 | 重复招式扣分 + 衰减 + 评价影响攻击力 | §11.4 |
| 锁定系统 | 锁定最近敌人 + 自动面向 + 相对方向 | §11.5 |
| 皇家护卫 | HitOverride + ReversalDef + 能量积累 + 释放 | §10.2 §10.3 |

**关键点**：

1. **JC 是鬼泣空中连段核心**：jcbox检测→jcContact标记→-1 state trigger entry→ChangeState(45)→重置CD。JC不能连JC（prevStateNo!=45）
2. **DT 取消优先级最高**：任何攻击都能用 DT 取消，消耗资源
3. **武器切换靠 weapon 字段**：同一按键不同武器出不同招，trigger entry 按 weapon 分流
4. **连段评价鼓励变化**：重复招式只给30%分，不同招式给满分，评价越高攻击力越高
5. **锁定改变方向**：锁定后自动面向目标，攻击/移动相对目标
6. **所有系统通过 EventBus 统一**：hit/parry/jc_contact/enemy_step 事件，各系统订阅处理

**全文完**。从第一章到第十一章，覆盖了角色文件结构、状态系统、SCTRL、Trigger、动画、物理、碰撞检测、命中系统、特效系统、高级系统、鬼泣特色系统。读者能理解如何从零搭建一个 2D 横版鬼泣的战斗框架。

---

*第十一章完。鬼泣特色系统把前十章的基础整合成完整的战斗框架——JC 让空中连段无限可能，DT 取消让高资源玩家有更多选择，武器切换增加深度，连段评价鼓励变化，锁定系统提供精确控制。祝做出好游戏。*

---

## 第十二章：相机系统

前十一章的角色和战斗都讲完了，但镜头还没讲。相机系统是"玩家怎么看到游戏世界"的关键——好的相机让战斗更爽，差的相机会晕。这一章讲完整的 2D 相机系统。

### 12.1 MUGEN 的相机系统

MUGEN 有完整的相机参数（Ikemen-GO `camera.go`）：

| 参数 | 含义 | 默认值 | 例子 |
|---|---|---|---|
| `tension` | 水平张力：角色离中心多远相机才开始跟随 | 50 | 50 |
| `verticalfollow` | 垂直跟随系数（0=不跟，1=完全跟） | 0.2 | 0.3 |
| `tensionhigh` | 角色超过多高相机才上移 | — | 100 |
| `floortension` | 角色离地面多远相机才开始垂直跟随 | — | — |
| `zoomin` | 最大放大倍率 | 1.0 | 1.0 |
| `zoomout` | 最小缩小倍率（拉远） | 1.0 | 0.7 |
| `zoominspeed` | 放大速度（拉近） | 1.0 | 0.02 |
| `zoomoutspeed` | 缩小速度（拉远） | 1.0 | 0.05 |
| `zoomindelay` | 放大延迟（多少帧后开始拉近） | — | 5 |
| `boundleft/right` | 相机左右边界 | — | -500, 500 |
| `boundhigh` | 相机最高（y 负数） | — | -300 |
| `autocenter` | 两人居中（格斗用） | — | — |

MUGEN 的三种相机视图（Ikemen-GO `CameraView`）：

```go
const (
    Fighting_View = iota  // 格斗：两人居中 + 自动缩放
    Follow_View           // 跟随：跟一个角色
    Free_View             // 自由：手动控制
)
```

鬼泣横版用 **Follow_View**——跟随玩家角色。

### 12.2 鬼泣5的镜头设计（3D 参考）

鬼泣5是 3D 第三人称，但镜头设计理念可以参考：

**锁定时镜头分区**：

```
鬼泣5锁定时的镜头分区：

  ┌─────────────────────────┐
  │      缓冲区（远）         │  ← 缓慢跟随
  │  ┌───────────────────┐  │
  │  │  中心平移区（近）   │  │  ← 快速居中在玩家+敌人
  │  │   玩家 ←→ 敌人     │  │
  │  └───────────────────┘  │
  │      缓冲区（远）         │
  └─────────────────────────┘
```

**命中时的镜头反馈**：

| 效果 | 触发 | 时长 | 说明 |
|---|---|---|---|
| hitstop | 命中瞬间 | 2帧 | 画面冻住（§8.4） |
| 微缩放 | 命中瞬间 | 1-4帧 | 瞬间放大再缩回 |
| 震屏 | 命中 | 5-10帧 | 随机偏移，越重越震 |
| 慢动作 | 大招/SSS | 15-60帧 | 时间流速减慢 |

**空中镜头**：角色飞高时相机上移 + 拉远（看到地面），落地时缓慢拉近（不晕）。

### 12.3 2D 相机参数

```lua
local Camera = {
    -- 跟随目标
    target = nil,              -- 跟随的角色
    x = 0, y = 0,              -- 相机当前位置
    target_x = 0, target_y = 0, -- 目标位置（平滑过渡用）

    -- 水平跟随
    tension_x = 50,            -- 张力：角色离中心多远才跟随
    follow_speed = 0.1,       -- 跟随速度（0-1，越大越快）

    -- 垂直跟随
    verticalfollow = 0.3,     -- 垂直跟随系数（0=不跟，1=完全跟）
    tensionhigh = 100,        -- 角色超过多高相机才上移

    -- 缩放
    zoom = 1.0,               -- 当前缩放
    target_zoom = 1.0,        -- 目标缩放
    zoomin = 1.0,             -- 最大放大
    zoomout = 0.7,            -- 最小缩小（拉远）
    zoominspeed = 0.02,       -- 放大速度（慢，不晕）
    zoomoutspeed = 0.05,      -- 缩小速度（快，快速看到全局）
    zoomindelay = 5,          -- 放大延迟（帧）

    -- 边界
    boundleft = -500,
    boundright = 500,
    boundhigh = -300,         -- 相机最高（y 负数=向上）

    -- 地面
    ground_y = 400,           -- 地面在屏幕的 y 位置

    -- 震屏
    shake = nil,              -- {intensity, duration, current}

    -- 命中微缩放
    punch_zoom = nil,         -- {amount, duration, current}

    -- 慢动作
    time_scale = 1.0,         -- 1.0=正常, 0.3=慢动作
    slow_motion_duration = 0,

    -- 镜头锁定
    locked = false,           -- true=固定不动（演出时）
}
```

### 12.4 相机更新

#### 两种相机模式

相机根据是否锁定敌人切换模式：

| 模式 | 中心 | tension | 适用 |
|---|---|---|---|
| 自由模式（不锁定） | 跟角色 | 50（舒适区） | 自由移动/探索 |
| 锁定模式 | 角色和敌人中间 | 0（精确居中） | 锁定敌人战斗 |

```
不锁定（自由模式）：
  ┌──────────────────────┐
  │ 角色  ←50→  ←50→    │  ← tension 内相机不动
  └──────────────────────┘

锁定敌人后（锁定模式）：
  ┌──────────────────────┐
  │     角色 ←→ 敌人       │  ← 居中在两人中间
  └──────────────────────┘
  两人远了 → 拉远看全两人
```

#### 完整更新代码

```lua
function Camera:update(players)
    if self.locked then return end  -- 演出时不跟随

    local player = self.target or players[1]
    if not player then return end

    -- 1. 水平跟随（按锁定状态切换模式）
    if player.lock_target then
        -- ★ 锁定模式：居中在角色+敌人中间
        local enemy = player.lock_target
        self.target_x = (player.x + enemy.x) / 2

        -- 两人距离太远 → 拉远缩放（看到两人）
        local distance = math.abs(enemy.x - player.x)
        if distance > self.screen_width * 0.7 then
            self.target_zoom = self.zoomout  -- 拉远
        end
    else
        -- ★ 自由模式：跟角色 + tension 舒适区
        local dx = player.x - self.x
        if math.abs(dx) > self.tension_x then
            self.target_x = player.x
        end
    end
    self.x = self.x + (self.target_x - self.x) * self.follow_speed

    -- 2. 垂直跟随（角色飞高时相机上移，两种模式都要）
    local heightAboveGround = self.ground_y - player.y
    if heightAboveGround > self.tensionhigh then
        local vDelta = (heightAboveGround - self.tensionhigh) * self.verticalfollow
        self.target_y = self.ground_y - vDelta
    else
        self.target_y = self.ground_y
    end
    self.y = self.y + (self.target_y - self.y) * self.follow_speed

    -- 3. 缩放（飞高拉远，落地拉近；锁定远距也拉远）
    if heightAboveGround > self.tensionhigh then
        self.target_zoom = self.zoomout     -- 飞高 → 拉远
    elseif not player.lock_target then
        self.target_zoom = self.zoomin      -- 地面+不锁定 → 拉近
    end
    -- 锁定模式的缩放在上面第1步已设

    -- 缩放过渡（拉远快，拉近慢）
    if self.target_zoom < self.zoom then
        self.zoom = self.zoom + (self.target_zoom - self.zoom) * self.zoomoutspeed
    else
        self.zoom = self.zoom + (self.target_zoom - self.zoom) * self.zoominspeed
    end

    -- 4. 边界限制
    self.x = math.max(self.boundleft, math.min(self.boundright, self.x))
    self.y = math.max(self.boundhigh, math.min(0, self.y))

    -- 5. 更新震屏
    if self.shake then
        self.shake.current = self.shake.current + 1
        if self.shake.current >= self.shake.duration then
            self.shake = nil
        end
    end

    -- 6. 更新命中微缩放
    if self.punch_zoom then
        self.punch_zoom.current = self.punch_zoom.current + 1
        if self.punch_zoom.current >= self.punch_zoom.duration then
            self.punch_zoom = nil
        end
    end

    -- 7. 更新慢动作
    if self.time_scale ~= 1.0 then
        self.slow_motion_duration = self.slow_motion_duration - 1
        if self.slow_motion_duration <= 0 then
            self.time_scale = 1.0
        end
    end
end
```

#### tension 的作用

```
tension=0（锁定中间，相机一直在动）：
  角色走一点 → 相机动一点 → 一直在动 → 容易晕

tension=50（宽松，舒适区）：
  ┌──────────────────────┐
  │ 角色  ←50→  ←50→    │  ← 100像素宽的舒适区
  └──────────────────────┘
  角色走一点（<50像素）→ 相机不动 → 稳定
  角色走多（>50像素）→ 相机才跟着 → 不晕
```

**自由模式用 tension=50**（舒适区，不频繁动）。
**锁定模式用 tension=0**（精确居中在两人中间，对应 MUGEN 的 autocenter）。

#### 锁定时拉远

```
两人近 → 正常缩放（zoomin=1.0）
  ┌──────────────────────┐
  │     角色 ←→ 敌人       │
  └──────────────────────┘

两人远 → 拉远（zoomout=0.7）
  ┌──────────────────────┐
  │ 角色 ←──很远──→ 敌人    │  ← 缩小看全两人
  └──────────────────────┘

距离 > 屏幕宽度 * 0.7 → 切换到 zoomout
```

**为什么拉远快、拉近慢**：

```
拉远快（zoomoutspeed=0.05）：
  角色飞高/两人变远 → 快速拉远 → 1-2帧看到全局 → 不丢角色

拉近慢（zoominspeed=0.02）：
  角色落地/解除锁定 → 缓慢拉近 → 20-30帧恢复 → 不晕镜头

如果拉近也快：
  角色落地 → 瞬间拉近 → 画面跳变 → 晕
```

#### 缓动曲线

当前相机用线性插值（`x += (target - x) * speed`）——这是**指数缓动**，自然减速到目标。但有些场景需要更精确的曲线控制：

```lua
-- 当前：指数缓动（指数衰减，自然减速）
self.x = self.x + (self.target_x - self.x) * self.follow_speed
-- 特点：快到目标时减速，自然但不精确控制时长

-- 问题：锁定切换时，从"跟角色"切到"居中两人"
-- 位置可能跳变大 → 相机快速移动 → 不舒服
```

常用的缓动曲线：

```lua
local Easing = {}

-- 线性（匀速，生硬）
function Easing.linear(t) return t end

-- 二次缓入（开始慢，越来越快）
function Easing.inQuad(t) return t * t end

-- 二次缓出（开始快，越来越慢）
function Easing.outQuad(t) return 1 - (1 - t) * (1 - t) end

-- 二次缓入缓出（两头慢中间快，S形）
function Easing.inOutQuad(t)
    return t < 0.5 and 2 * t * t or 1 - (-2 * t + 2)^2 / 2
end

-- 三次缓出（比二次更柔和）
function Easing.outCubic(t) return 1 - (1 - t)^3 end

-- 指数缓出（快速接近后极慢，自然感）
function Easing.outExpo(t) return t == 1 and 1 or 1 - 2^(-10 * t) end
```

```
各种曲线对比（t=进度 0→1，y=输出 0→1）：

线性：     /          匀速，生硬
缓入：     ╱          慢启动
缓出：     ╲          快启动慢结束 ← 相机常用
缓入缓出：  S          两头慢中间快 ← 过渡常用
指数缓出：  ╲___       快速接近后极慢 ← 当前代码的效果
```

**相机各部分用的曲线**：

| 相机部分 | 推荐曲线 | 原因 |
|---|---|---|
| 水平跟随 | 指数缓出（当前代码） | 自然减速，不需要精确时长 |
| 垂直跟随 | 指数缓出 | 同上 |
| 缩放拉远 | 指数缓出（快） | 快速看到全局 |
| 缩放拉近 | 指数缓出（慢） | 缓慢恢复不晕 |
| 锁定切换过渡 | **缓入缓出（S形）** | 精确控制时长，两头柔和 |
| 震屏恢复 | 线性衰减 | 匀速减弱 |
| 命中微缩放 | 线性衰减 | 快速消失 |

#### 锁定切换的过渡效果

锁定/解除锁定时，相机从"跟角色"切到"居中两人"——位置可能跳变。需要**平滑过渡**，而不是瞬间跳：

```lua
-- Camera 添加过渡状态
Camera.transition = nil  -- {start_x, start_y, target_x, target_y, duration, current, easing}

--- 启动相机过渡（锁定切换时调用）
---@param targetX number 目标 x
---@param targetY number 目标 y
---@param duration integer 过渡帧数
---@param easing function 缓动函数
function Camera:startTransition(targetX, targetY, duration, easing)
    self.transition = {
        start_x = self.x,
        start_y = self.y,
        target_x = targetX,
        target_y = targetY,
        duration = duration or 15,
        current = 0,
        easing = easing or Easing.inOutQuad,  -- 默认S形
    }
end

-- 在 update 里检查过渡
function Camera:update(players)
    if self.locked then return end

    -- ★ 过渡中：用缓动曲线插值
    if self.transition then
        local t = self.transition
        t.current = t.current + 1
        local progress = math.min(1, t.current / t.duration)
        local eased = t.easing(progress)

        self.x = t.start_x + (t.target_x - t.start_x) * eased
        self.y = t.start_y + (t.target_y - t.start_y) * eased

        if t.current >= t.duration then
            self.transition = nil  -- 过渡结束
        end
        return  -- 过渡中不跑正常跟随
    end

    -- 正常跟随（自由/锁定模式）
    -- ...（上面的代码）
end
```

**锁定时触发过渡**：

```lua
-- §11.5 锁定系统的 acquireLockTarget
function Player:acquireLockTarget(enemies)
    -- ... 找最近敌人 ...
    self.lock_target = closest

    -- ★ 启动相机过渡（从当前位置 → 两人中间）
    if closest then
        local centerX = (self.x + closest.x) / 2
        Camera:startTransition(centerX, Camera.y, 15, Easing.inOutQuad)
        -- 15帧 S形过渡，不突兀
    end
end

-- 解除锁定时也过渡
function Player:clearLockTarget()
    self.lock_target = nil
    -- 过渡回跟角色模式
    Camera:startTransition(self.x, Camera.y, 15, Easing.inOutQuad)
end
```

**过渡效果**：

```
锁定瞬间（帧0）：           过渡中（帧8）：            过渡完成（帧15）：
  ┌────────────┐            ┌────────────┐            ┌────────────┐
  │角色        │            │  角色      │            │   角色     │
  │            │            │      →    │            │      敌人   │
  │            │            │   敌人    │            │            │
  └────────────┘            └────────────┘            └────────────┘
  相机在角色位置              相机在过渡中间              相机居中两人

帧0：相机在角色身上
帧1-14：S形缓动 → 从角色位置平滑移到两人中间
  开始慢（不突兀）→ 中间快（高效到达）→ 结束慢（柔和停下）
帧15：到达目标，切回正常跟随
```

#### 缩放过渡也用曲线

当前缩放用指数缓动（`zoom += (target - zoom) * speed`）。锁定切换时如果想精确控制缩放时长，也用过渡：

```lua
function Camera:startZoomTransition(targetZoom, duration, easing)
    self.zoom_transition = {
        start_zoom = self.zoom,
        target_zoom = targetZoom,
        duration = duration or 15,
        current = 0,
        easing = easing or Easing.inOutQuad,
    }
end

-- 在 update 里
if self.zoom_transition then
    local z = self.zoom_transition
    z.current = z.current + 1
    local progress = math.min(1, z.current / z.duration)
    local eased = z.easing(progress)
    self.zoom = z.start_zoom + (z.target_zoom - z.start_zoom) * eased
    if z.current >= z.duration then
        self.zoom_transition = nil
    end
    return
end
```

#### 通用 lerp + 缓动工具函数

```lua
--- 带缓动的插值
---@param current number 当前值
---@param target number 目标值
---@param t number 进度 0-1
---@param easing function 缓动函数
---@return number
local function lerpEased(current, target, t, easing)
    easing = easing or Easing.outQuad
    return current + (target - current) * easing(t)
end

--- 指数缓动（每帧调用，不需要时长）
---@param current number 当前值
---@param target number 目标值
---@param speed number 速度 0-1
---@return number
local function lerpExpo(current, target, speed)
    return current + (target - current) * speed
end
```

**两种插值的区别**：

| | 指数缓动（lerpExpo） | 带时长的缓动（lerpEased） |
|---|---|---|
| 调用方式 | 每帧调，传 speed | 在过渡系统里调，传 progress |
| 精确时长 | ❌ 无法控制几帧到 | ✅ duration=15 就是15帧到 |
| 适用 | 持续跟随（水平/垂直） | 一次性过渡（锁定切换/缩放切换） |
| 当前代码 | ✅ 用的这种 | 锁定切换用这种 |

### 12.5 震屏

命中/大招时画面抖动：

```lua
--- 添加震屏
---@param intensity number 震动幅度（像素）
---@param duration integer 持续帧数
function Camera:addShake(intensity, duration)
    self.shake = {
        intensity = intensity,
        duration = duration,
        current = 0,
    }
end

-- 获取震屏偏移
function Camera:getShakeOffset()
    if not self.shake then return 0, 0 end
    local s = self.shake
    local decay = 1 - (s.current / s.duration)  -- 逐渐减弱
    return math.random(-s.intensity, s.intensity) * decay,
           math.random(-s.intensity, s.intensity) * decay
end
```

### 12.6 命中微缩放

命中瞬间画面微微放大再缩回，强调冲击感：

```lua
--- 添加命中微缩放
---@param amount number 放大量（0.05=放大5%）
---@param duration integer 持续帧数（1-4帧）
function Camera:addPunchZoom(amount, duration)
    self.punch_zoom = {
        amount = amount,
        duration = duration,
        current = 0,
    }
end

-- 获取微缩放附加值
function Camera:getPunchZoomAmount()
    if not self.punch_zoom then return 0 end
    local pz = self.punch_zoom
    local progress = pz.current / pz.duration
    return pz.amount * (1 - progress)  -- 从 amount 衰减到 0
end
```

```
命中微缩放效果：
帧0: zoom = 1.0 + 0.05 = 1.05  ← 瞬间放大5%
帧1: zoom = 1.0 + 0.025 = 1.025 ← 衰减
帧2: zoom = 1.0 + 0 = 1.0       ← 恢复

只在 hitstop 期间（2帧）可见 → 强调冲击感但不干扰游戏
```

### 12.7 慢动作

大招/counter/SSS 评价时时间减慢：

```lua
--- 触发慢动作
---@param scale number 时间缩放（0.3=慢到30%）
---@param duration integer 持续帧数
function Camera:slowMotion(scale, duration)
    self.time_scale = scale
    self.slow_motion_duration = duration
end
```

主循环里应用慢动作：

```lua
function love.update(dt)
    -- 慢动作影响 dt
    dt = dt * Camera.time_scale

    -- ... 所有系统用调整后的 dt 更新 ...
    for _, player in ipairs(players) do
        player:update(dt, buf, frozen)
    end
end
```

使用场景：

| 触发 | time_scale | duration | 场景 |
|---|---|---|---|
| counter hit（重击） | 0.3 | 15帧 | counter 的冲击感 |
| SSS 评价达成 | 0.4 | 30帧 | 庆祝感 |
| 大招最后一击 | 0.2 | 20帧 | 终结感 |

### 12.8 镜头锁定（演出用）

大招演出时镜头固定不动（§10.4 CutIn 配合）：

```lua
function Camera:lock()
    self.locked = true
end

function Camera:unlock()
    self.locked = false
end
```

### 12.9 状态控制相机

某些状态可以临时改变相机参数：

```lua
-- 上挑状态：临时拉远
function State:onEnter(player)
    Camera.target_zoom = 0.6
end

function State:onExit(player)
    Camera.target_zoom = nil  -- 恢复默认
end

-- 大招演出：锁定相机
function State:onEnter(player)
    Camera:lock()
    Game:startCutIn(player, { ... })
end

function State:onExit(player)
    Camera:unlock()
end
```

### 12.10 命中系统里触发镜头反馈

```lua
-- HitSystem.onHit 里
function HitSystem.onHit(event)
    local hd = event.hitdef

    -- 镜头反馈：越重越强
    local intensity = 0.3
    if hd.hit_type == "heavy" then intensity = 0.6 end
    if hd.hit_type == "trip" then intensity = 0.4 end
    if event.is_counter then intensity = intensity + 0.3 end

    -- 震屏
    Camera:addShake(intensity * 8, 8)

    -- 命中微缩放
    Camera:addPunchZoom(0.05 * intensity, 4)

    -- counter hit 慢动作（重击才触发）
    if event.is_counter and intensity > 0.7 then
        Camera:slowMotion(0.3, 15)
    end

    -- ... 其他命中处理 ...
end
```

### 12.11 SSS 评价慢动作

```lua
function StyleSystem:onRankChange(newRank)
    if newRank == "SSS" then
        Camera:slowMotion(0.4, 30)  -- 40%速度，30帧
    end
end
```

### 12.12 渲染

```lua
function love.draw()
    love.graphics.push()

    -- 1. 移到屏幕中心
    love.graphics.translate(
        love.graphics.getWidth() / 2,
        love.graphics.getHeight() / 2)

    -- 2. 缩放（基础 zoom + 命中微缩放）
    local zoom = Camera.zoom + Camera:getPunchZoomAmount()
    love.graphics.scale(zoom)

    -- 3. 震屏偏移
    local shakeX, shakeY = Camera:getShakeOffset()
    love.graphics.translate(-Camera.x + shakeX, -Camera.y + shakeY)

    -- ... 正常渲染（背景/角色/特效）...

    love.graphics.pop()

    -- 演出图层（§10.4，不受相机影响）
    Game:drawCutIn()

    -- UI（不受相机影响）
    StyleSystem:draw()
end
```

渲染层级：

```
1. 游戏画面（受相机缩放/震屏影响）
   ├─ 背景
   ├─ 角色 + 特效
   └─ 地面
2. 演出图层（不受相机影响，§10.4）
   ├─ 蓝暗背景
   ├─ 头像
   └─ 招式名
3. UI（不受相机影响）
   ├─ 评价显示
   └─ 锁定标记
```

### 12.13 main.lua 整合

```lua
function love.load()
    -- ... 初始化各系统 ...
    Camera.target = players[1]  -- 相机跟随玩家
end

function love.update(dt)
    -- 慢动作
    dt = dt * Camera.time_scale

    Input.update()
    local buf = Input.getBuffer()
    local frozen = Game.hitstop > 0 or (Game.super_pause and Game.super_pause.frames > 0)

    for _, player in ipairs(players) do
        if not frozen or (Game.super_pause and player == Game.super_pause.player) then
            player:update(dt, buf, frozen)
        end
    end

    if not frozen then
        CollisionSystem.update(players)
    end

    EntityManager.update(frozen)

    -- 相机更新
    Camera:update(players)

    -- 倒计时
    if Game.hitstop > 0 then Game.hitstop = Game.hitstop - 1 end
    if Game.super_pause then
        Game.super_pause.frames = Game.super_pause.frames - 1
        if Game.super_pause.frames <= 0 then Game.super_pause = nil end
    end

    Game:updateCutIn()  -- 演出更新
    StyleSystem:update() -- 评价衰减
end
```

### 12.14 和其他引擎对比

| 功能 | MUGEN | 我们 | Pro Camera 2D（Unity） |
|---|---|---|---|
| 水平张力 | tension | tension_x | Camera Window |
| 垂直跟随 | verticalfollow | verticalfollow | — |
| 缩放 | zoomin/zoomout | zoom/zoomout | Pan And Zoom |
| 震屏 | EnvShake sctrl | addShake | Shake |
| 边界 | boundleft/right | bound* | Boundaries |
| 慢动作 | — | time_scale | — |
| 命中微缩放 | — | punch_zoom | — |
| 镜头锁定 | — | locked | Cinematics |
| 镜头过渡 | — | locked/unlocked | Transitions FX |

### 12.15 本章总结

| 概念 | 说明 |
|---|---|
| 水平张力 | 角色离中心 tension 像素内相机不动，超过才跟随 |
| 垂直跟随 | 角色飞高时相机部分跟随（verticalfollow=0.3，不完全跟，保证看到地面） |
| 飞高拉远 | tensionhigh + zoomout，角色飞高时快速拉远看到全局 |
| 落地拉近 | zoominspeed 慢，落地后缓慢恢复，不晕 |
| 震屏 | 命中/大招时随机偏移渲染，越重越震，逐渐衰减 |
| 命中微缩放 | 命中瞬间放大5%再缩回（1-4帧），强调冲击 |
| 慢动作 | time_scale < 1.0，大招/counter/SSS 触发 |
| 镜头锁定 | 演出时固定不动（配合 §10.4 CutIn） |
| 状态控制 | 状态可临时改 Camera 参数（上挑拉远/大招锁定） |

**关键点**：

1. **拉远快拉近慢**：zoomoutspeed > zoominspeed，飞高快速看全局，落地缓慢恢复不晕
2. **垂直跟随部分跟**：verticalfollow=0.3 而不是 1.0，保证地面可见
3. **震屏衰减**：越往后震幅越小，不是匀速震
4. **命中微缩放只在 hitstop 期间**：2帧内可见，强调冲击但不干扰游戏
5. **慢动作通过 time_scale**：影响整个 dt，所有系统自然减速
6. **演出时锁定相机**：CutIn 期间 camera.locked=true，不跟随

**全文完**。从第一章到第十二章，覆盖了角色文件结构、状态系统、SCTRL、Trigger、动画、物理、碰撞检测、命中系统、特效系统、高级系统、鬼泣特色系统、相机系统。读者能理解如何从零搭建一个完整的 2D 横版鬼泣战斗框架。

---

*第十二章完。相机系统让玩家看到舒适的游戏画面——飞高拉远、落地拉近、命中震屏、大招慢动作，每一层都提升游戏体验。祝做出好游戏。*

---

<!-- TODO: 待统一到文档目录中，和 input 文档的附录一起整理 -->

## 附录 A：时间概念速查表

> 本文档和 input 文档涉及大量时间概念，容易混淆。这里统一整理所有时间、含义、MUGEN 对应、所在章节。

### A.1 基础时间单位

| 时间 | 含义 | MUGEN | 章节 |
|---|---|---|---|
| **tick（帧）** | 游戏基本时间单位，1 tick = 1/60 秒 | MUGEN 全部以 tick 为单位 | input 文档 §2.2 |

### A.2 状态相关

| 时间 | 含义 | MUGEN | 章节 |
|---|---|---|---|
| **state_time** | 当前状态已持续多少帧 | `time` trigger（`time = 5`） | Part 1 §2.8、§4.6 |
| **prevStateNo** | 前一个状态号（用于取消链限制，如 JC不能连JC） | `prevstateno` | Part 1 §2.10、Part 2 §7.10 |

### A.3 动画相关

| 时间 | 含义 | MUGEN | 章节 |
|---|---|---|---|
| **anim_tick** | 当前动画帧已播放的 tick 数 | 引擎内部 | Part 1 §5.3-5.5 |
| **anim_frame** | 当前动画帧索引（1起） | `anim` + `animelemno` | Part 1 §5.3-5.5 |
| **duration** | 动画某一帧停留几个 tick | `.air` 文件每帧的时间 | Part 1 §1.5、§5.2 |
| **totalTicks** | 整个动画所有帧 duration 之和 | `.air` 动画总长 | Part 1 §1.5 |
| **animelemtime(N)** | 第 N 帧已播放多久（-1=没到，0=刚进入，999=已过） | `animelemtime(N)` trigger | Part 1 §4.8、§5.6 |
| **animtime** | 动画剩余时间（负数，0=播完） | `animtime` trigger | Part 1 §4.8、§5.6 |
| **anim_finished** | 动画是否播完（布尔，简化版 animtime） | `animtime = 0` | Part 1 §5.3-5.5 |

### A.4 命令/输入相关

| 时间 | 含义 | MUGEN | 章节 |
|---|---|---|---|
| **buffer_time** | 命令匹配后招式可用的帧数（定义值） | `command.buffer.time` | input 文档 §2、§4 |
| **cur_buffer_time** | 命令当前剩余可用帧数（每帧-1，hitstop 不减） | `curbuftime` | input 文档 §4.2-4.3、§5 |
| **cmd time** | 命令从开始匹配到现在的总时间（超时重置） | `command.time`（默认15帧） | input 文档 §4.3 |

### A.5 命中/被击相关

| 时间 | 含义 | MUGEN | 章节 |
|---|---|---|---|
| **hitstop** | 命中后双方冻住的帧数（全局） | `HitDef pausetime` | input 文档 §5 |
| **hitPauseTime** | 角色被冻住的剩余帧数（每帧-1） | `hitpause` trigger | input 文档 §5、Part 1 §3.9 |
| **slidetime** | 被击后击退滑动的帧数 | `ground.slidetime = 10` | Part 2 §6.17、第八章 |
| **hittime** | 被击后总硬直帧数（滑动+不动） | `ground.hittime = 20` | Part 2 §6.17、第八章 |
| **hitshaketime** | 被击后抖动的帧数（被击抖动期） | `gethitvar.hitshaketime` | 第八章（待写） |

### A.6 控制/暂停相关

| 时间 | 含义 | MUGEN | 章节 |
|---|---|---|---|
| **ctrl** | 是否有控制权（布尔，不是时间，但影响何时能操作） | `ctrl` trigger | Part 1 §3.9 |
| **pausetime** | Pause/SuperPause 冻场的帧数 | `Pause time = 30` | 第十章（待写） |
| **persistent** | SCTRL 多久触发一次（如 persistent=2 = 每2帧一次） | `persistent = N` | 第十章（待写） |

### A.7 容易混淆的时间对比

#### state_time vs anim_tick vs animelemtime

```
state_time：    状态从进入到现在多少帧（不管动画）
anim_tick：     当前动画帧播了几个 tick（帧内时间）
animelemtime(N)：第N帧从开始到现在多久（跨帧判断）

例子：状态进入第10帧，动画第3帧播了2个 tick
  state_time = 10
  anim_frame = 3
  anim_tick = 2
  animelemtime(1) = 999（第1帧早过了）
  animelemtime(2) = 999（第2帧也过了）
  animelemtime(3) = 2（第3帧正在播，已2 tick）
  animelemtime(4) = -1（第4帧还没到）
```

#### hitstop vs hitPauseTime vs slidetime vs hittime

```
hitstop：      命中瞬间设置的全局冻结帧数（如 8 帧）
hitPauseTime： 每个角色的冻结倒计时（每帧-1，到0解冻）
slidetime：    被击者击退滑动的帧数（如 10 帧）
hittime：      被击者总硬直帧数（如 20 帧 = 滑动10 + 不动10）

时间线：
帧0:   命中 → hitstop=8, hitPauseTime=8
帧1-8: 双方冻住（hitPauseTime 倒计时，hitstop 期间 cur_buffer_time 不减）
帧9:   解冻 → 被击者开始击退滑动（slidetime=10 开始）
帧9-18: 击退滑动（slidetime 倒计时，摩擦力减速）
帧19:  滑动结束，但硬直还在（hittime - slidetime = 10 帧不动）
帧29:  硬直结束（hittime=20 到了），恢复控制
```

#### buffer_time vs cur_buffer_time

```
buffer_time：    招式匹配后保留多少帧（定义值，如 5）
cur_buffer_time：当前剩余可用帧数（每帧-1，hitstop 期间不减）

帧0: 命令匹配 → cur_buffer_time = buffer_time = 5（hitstop 时 = 6）
帧1: cur_buffer_time = 4（如果不在 hitstop）
帧2: cur_buffer_time = 3
...
帧5: cur_buffer_time = 0 → 招式过期，不能触发了

如果在 hitstop 期间：
帧0: 命令匹配 → cur_buffer_time = 6（+1补偿）
帧1-5: hitstop 期间 cur_buffer_time 保持 6 不减
帧6: hitstop 结束 → cur_buffer_time = 5（开始减）
...
帧11: cur_buffer_time = 0 → 过期
```

#### Game.hitstop vs 角色 hitPauseTime

```
Game.hitstop：     全局计数器，管 buffer_time 不递减 + 主循环判断
角色 hitPauseTime：每个角色独立，管 sctrl 跳过（角色冻住）

命中时同时设置（不是谁设置谁）：
  Game.hitstop = 8
  attacker.hitPauseTime = 8
  target.hitPauseTime = 8

为什么需要两个：
  - Game.hitstop 管全局的 buffer_time（命令系统，和角色无关）
  - hitPauseTime 管角色级的 sctrl 跳过（能实现 ignorehitpause=1 的 sctrl 照跑）
  - 不能合并：职责不同

时间线：
帧0:   命中 → Game.hitstop=8, 双方 hitPauseTime=8
帧1-8: 双方冻住
  - Game.hitstop 倒计时（8→7→...→1）
  - 双方 hitPauseTime 倒计时
  - sctrl 跳过（角色不动）
  - cur_buffer_time 不减（玩家搓的招留住）
  - 命令匹配照常跑（能检测输入）
帧9:   Game.hitstop=0, hitPauseTime=0 → 解冻
  - sctrl 恢复执行
  - cur_buffer_time 开始递减
  - hitstop 期间搓的招 → 立即可以出
```

### A.8 各章节时间概念索引

| 章节 | 主要讲的时间 |
|---|---|
| input 文档 §2 | tick、buffer（按键缓冲计数器） |
| input 文档 §4 | cur_buffer_time、cmd time（命令计时） |
| input 文档 §5 | hitstop、hitPauseTime、cur_buffer_time 与 hitstop 的关系 |
| Part 1 §1.5 | duration、totalTicks（动画帧时间） |
| Part 1 §2.8 | state_time（状态时间） |
| Part 1 §3.9 | ctrl（控制权，和 hitpause 的关系） |
| Part 1 §4.6 | time trigger（state_time 的 trigger 用法） |
| Part 1 §4.8 | animelemtime、animtime（动画时间 trigger） |
| Part 1 §5.3-5.6 | anim_tick、anim_frame、anim_finished（动画播放时间） |
| Part 2 §6.10 | jump_y、gravity（跳跃物理时间） |
| Part 2 §6.14 | 惯性延续（跨状态的速度时间） |
| Part 2 §6.17 | slidetime、hittime（击退滑动和硬直时间） |
| Part 2 §7.10 | animelemtime 在取消规则里的用法（第N帧后才能取消） |
| Part 2 §8.4 | Game.hitstop、hitPauseTime 命中时同时设置 |
| Part 2 §8.7 | hitstop 触发（pausetime 参数） |
| 第十章（待写） | pausetime（Pause/SuperPause）、persistent |
