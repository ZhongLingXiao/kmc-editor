# 给新人：从 MUGEN 输入系统到 Love2D 横版鬼泣

> 这篇文档假设你：
> - 想用 Love2D 做一个横版动作游戏（鬼泣/猎天使魔女那种风格）
> - 不懂 MUGEN 也没关系
> - 不懂 Go 也没关系（MUGEN 的开源实现 Ikemen-GO 用 Go 写的，但我们只看思路，代码用 Lua）
> - 想搞清楚"输入系统"到底在做什么，能不能自己写一个
>
> 阅读建议：从头到尾顺读，每一章都有图和代码。代码可以直接复制到 Love2D 里跑。

---

## 序章：先聊聊"为什么需要输入系统"

你玩格斗游戏，按下 `↓ ↘ → + 拳`，角色就放了一个波动拳。

听起来很简单，但其实背后有个很难的问题：

```
玩家不可能精确到 1/60 秒。
你怎么知道他"真的搓了波动拳"，而不是"随便乱按了几下"？
```

举个具体例子。波动拳的"配方"是：

```
按下"下"  →  按下"斜下"  →  按下"右+拳"
```

但玩家实际按的时候，可能是这样的（每一格是一帧，60 帧 = 1 秒）：

```
帧:  1  2  3  4  5  6  7  8  9  10
下:  ▓  ▓  ▓  ▓  .  .  .  .  .  .
右:  .  .  .  ▓  ▓  ▓  ▓  ▓  .  .
拳:  .  .  .  .  .  .  .  ▓  .  .
```

玩家第 1 帧按下"下"，第 4 帧开始按"右"（这时候"下"还按着，所以是斜下），第 7 帧按"拳"。

游戏每一帧都要问自己：**"玩家刚才那一串输入，匹配上波动拳的配方了吗？"**

输入系统就是干这个的。它要做五件事：

1. **知道玩家现在按了什么**（按键状态）
2. **记住玩家过去几帧按了什么**（按键缓冲）
3. **把过去按的和招式配方对比**（命令匹配）
4. **匹配上了，让招式"可用"一段时间**（命令缓冲）
5. **画面冻住时（打中敌人）怎么处理以上所有**（hitstop 处理）

我们一章一章讲。

---

## 第零章：整体架构 —— 各层的关系

在深入细节前，先搞清楚整个输入系统的"地图"。系统分四层，每层只读相邻下层，不跨层：

```
┌──────────────────────────────────────────────────────────────┐
│ 主循环 love.update(dt)                                        │
│                                                               │
│  1. Input.update()          读硬件 → curr/prev bool           │
│         │                                                     │
│         ▼                                                     │
│  2. Player.updateFacing()   更新朝向（根据锁定目标）           │
│         │                                                     │
│         ▼                                                     │
│  3. 前后解析 + SOCD          left/right → back/fwd（相对方向） │
│         │                                                     │
│         ▼                                                     │
│  4. Buffer.update(buf, snapshot)  更新按键计数器                │
│         │                        buf.fwd = 1/-1/2/-2/...      │
│         ▼                                                     │
│  5. Command.step(cmd, buf)     匹配命令 → cur_buffer_time     │
│         │                                                     │
│         ▼                                                     │
│  6. updateInstantCommands()    即时命令 → spawn 发射物         │
│         │                                                     │
│         ▼                                                     │
│  7. Player.update(player, dt, buf)                            │
│       a. on_frame(player, frame, buf)  ← 状态内输入检测        │
│       b. cancel_windows 查 Command      ← 状态切换命令         │
│       c. 推进状态帧数                                         │
│         │                                                     │
│         ▼                                                     │
│  8. EntityManager.update()   全局实体更新（发射物、敌人、特效）│
└──────────────────────────────────────────────────────────────┘
```

### 每层的职责

| 层 | 职责 | 读谁 | 提供的查询接口 |
|---|---|---|---|
| **Input** | 读硬件 | SDL/Love2D | `held(name)` |
| **Buffer** | 按键历史 | Input | `justPressed` / `justReleased` / `held` / `heldFrames` |
| **Command** | 命令匹配 | Buffer | `isActive(cmd)` |
| **状态机（Player）** | 状态切换 | Buffer + Command | — |

### 关键规则

1. **每层只读相邻下层，不跨层。** 状态机不直接碰 Input，即时命令不直接碰 Buffer。
2. **`on_frame` 读 Buffer**（不是 Input）—— Buffer 提供边沿检测（`justReleased`），且经过 SOCD 解决。
3. **`cancel_windows` 读 Command**（不是 Buffer）—— 命令匹配是 Command 的事。
4. **即时命令读 Command** 的 `cur_buffer_time` 边沿。

### Player 的封装

#### 三层变量

变量分三层，搞混了会导致 bug：

```
Game（全局）           ← 整个游戏共享
  ├─ Player 1（角色级）  ← 每个角色实例独立
  ├─ Player 2
  └─ Enemy 1
       └─ states（状态定义）  ← 所有同类角色共享的数据
```

| 层级 | 例子 | MUGEN 对应 | 在哪更新 |
|---|---|---|---|
| **全局** | hitstop、帧数、回合状态 | `sys.*` | 主循环 |
| **角色级** | charging、exceeded、hp、facing | `var()`、`fvar()` | `Player.update` 的各层 |
| **状态定义** | total_frames、cancel_windows | statedef 参数 | 不更新（常量） |

**判断标准**：
- 和具体角色无关的、整个游戏共享的 → 全局（`Game.*`）
- 和具体角色绑定的、每个角色独立的 → 角色级（`self.*`，对应 MUGEN `var()`）
- 状态的配置数据、所有同类角色共用的 → 状态定义（`states.*`，常量不更新）

#### Player 变量定义（角色级）

```lua
local Player = {
    -- 状态机
    state = "stand",          -- 当前状态名（对应 MUGEN stateno）
    frame = 0,                -- 当前状态已播帧数（对应 MUGEN time）

    -- 位置/速度
    x = 0, y = 0,
    vx = 0, vy = 0,
    facing = 1,               -- 朝向 1=右 -1=左（对应 MUGEN facing）

    -- 属性
    hp = 100,                 -- 血量（对应 MUGEN life）

    -- ★ 标志（可以和任何状态同时存在，不影响角色动作）
    -- 对应 MUGEN 的 var()
    charging = false,           -- 蓄力标志（对应 var(50)）
    charge_frame = 0,           -- 蓄力计时（对应 var(51)）
    exceeded = false,           -- 红刀标志（对应 var(52)）
    last_attack_hit = false,    -- 上次攻击是否命中（对应 movecontact）
    invincible = false,         -- 无敌标志
    invincible_frames = 0,      -- 无敌剩余帧
    hitstun = 0,                -- 硬直剩余帧

    -- 锁定
    lock_target = nil,          -- 锁定的目标（另一个角色实例）

    -- 武器/风格
    current_weapon = "yamato",  -- 当前武器（对应 var(53)）
    current_style = "trickster",-- 当前风格
}
```

**关键**：`player1.charging` 和 `player2.charging` 完全独立——player1 蓄力不影响 player2。这和 MUGEN 的 `var(50)` 一样，每个角色有自己的 var。

#### 全局变量（Game 层）

```lua
local Game = {
    -- 系统
    frame_counter = 0,      -- 全局帧数
    hitstop_frames = 0,     -- hitstop 计时器
    round_state = 2,        -- 回合状态
}
```

全局变量在主循环里更新，不在 `Player.update` 里。每个角色的 `Player.update` 不碰 `Game.*`（除了读 `hitstop_frames` 判断是否跳过）。

#### 实体管理：发射物放全局还是 Player？

这是个关键架构问题。先区分三种东西：

| 类型 | 例子 | 特点 | 放哪 |
|---|---|---|---|
| **纯视觉属性** | 蓄力蓝光（剑上冒蓝光） | 只是角色的一个标志，没有独立逻辑 | **Player 的属性** |
| **有状态机的跟随实体** | 维吉尔的剑阵（幻影剑围绕身体） | 跟着角色走，但有旋转/攻击/消失等状态 | **`EntityManager.helpers`（Helper + `follow_owner`）** |
| **已发射的独立实体** | 飞出去的幻影剑、子弹 | 飞出去后独立飞行，角色死了它还在飞 | **全局实体管理（Projectile）** |

**剑阵**虽然跟着角色走，但它有多个状态（浮空旋转 / 攻击 / 消失），需要独立状态机，所以用 Helper 放 `EntityManager.helpers`，靠 `follow_owner` 跟随角色（详见角色教程 Part 2 §9.7，本节后面也会展开）。

**飞出去的幻影剑**是独立实体——飞出去后角色管不了它，它自己飞、自己碰撞、自己消失。放在全局实体管理（Projectile）里。

**为什么不放 Player**：发射物飞出去后是独立实体。跨角色碰撞需要统一管理（player1 的幻影剑打 enemy）。角色死了发射物应该继续飞。MUGEN、Unity、鬼泣都是全局管理 + owner 引用。

```lua
-- ★ 全局实体管理（独立于角色的实体）
local EntityManager = {
    projectiles = {},   -- 已发射的独立实体（幻影剑、子弹）
    enemies = {},       -- 敌人
    effects = {},       -- 特效（命中火花、文字）
}

function EntityManager.add(entity)
    table.insert(EntityManager.projectiles, entity)
end

function EntityManager.update(dt)
    for i = #EntityManager.projectiles, 1, -1 do
        local p = EntityManager.projectiles[i]
        p.x = p.x + p.vx
        p.y = p.y + p.vy
        p.life = p.life - 1
        if p.life <= 0 then
            table.remove(EntityManager.projectiles, i)
        end
    end
end

function EntityManager.draw()
    for _, p in ipairs(EntityManager.projectiles) do
        drawSprite(p.name, p.x, p.y)
    end
end

-- 发射时记录 owner，但实体独立管理
function spawnPhantomSword(owner)
    EntityManager.add({
        name = "phantom_sword",
        owner = owner,           -- ★ 引用发出者（但不"属于"它）
        x = owner.x + owner.facing * 30,
        y = owner.y - 40,
        vx = owner.facing * 12,
        vy = 0,
        life = 60,
        damage = 30,
    })
end
```

**owner 的用途**：
- 碰撞时忽略发出者（自己的幻影剑不打自己）
- 伤害归属（谁打的）
- 角色销毁时可选清理其发射物

> **注意**：下面只演示如何通过 `owner` 排除发射者。`math.abs(proj.x - target.x) < 20` 只是便于说明的 X 轴距离占位判断，并不是完整的碰撞检测；它没有判断 Y 轴，也没有考虑 hitbox / hurtbox 的尺寸。正式实现请使用角色教程 Part 2 第七章 §7.4 的二维 AABB 检测，并参考 §9.5 的 `projectile hitbox vs target hurtbox` 流程。

```lua
-- 简化示例：只演示碰撞检测时忽略发射者
function checkCollision(proj, target)
    if proj.owner == target then return false end  -- 不打自己
    return math.abs(proj.x - target.x) < 20        -- 仅为 X 轴占位判断，非正式碰撞检测
end
```

**剑阵（围绕角色的效果）用 Helper + `follow_owner`，不放 Player**：

剑阵（维吉尔 Spiral Swords）虽然跟着角色走，但它有多个状态（浮空旋转 / 攻击 / 消失），需要独立的状态机，所以不放 Player 属性，而是作为 Helper 放 `EntityManager.helpers`，用 `follow_owner` 标志跟随角色。完整实现见角色教程 Part 2 §9.7 Helper。

```lua
-- 剑阵是 Helper（有状态机的独立实体），不是 Player 属性
-- 创建时 follow_owner = true，onUpdate 里 h.x = h.owner.x 跟随角色
EntityManager.spawnHelper("spiral_sword", player.x, player.y, player.facing, player)
```

```lua
-- Helper 状态机（Part 2 §9.7）：
--   状态0 浮空旋转：follow_owner=true，位置=owner 位置，动画驱动旋转（不用 cos/sin）
--   状态1 攻击：激活 hitbox
--   状态2 消失：播完消失动画后 destroySelf
-- 详见 Part 2 §9.7，这里不重复
```

> ⚠ 不要把剑阵做成 `player.sword_circle` 属性 + 数学旋转（cos/sin）。那种写法只能画纯视觉，做不了攻击/消失等状态切换，也和 Part 2 §9.7 的正式实现冲突。Player 属性只留给"纯视觉属性"（如下面的蓄力蓝光）。

**完整分类**：

| 东西 | 例子 | 放哪 | 原因 |
|---|---|---|---|
| 剑阵 | 围绕角色的幻影剑（Spiral Swords） | `EntityManager.helpers`（Helper + `follow_owner`） | 有状态机（旋转/攻击/消失），跟随角色但需独立逻辑，详见 Part 2 §9.7 |
| 蓄力蓝光 | 剑上冒蓝光 | `player.charging` 标志 | 纯视觉属性，无独立逻辑 |
| 飞出的幻影剑 | 已发射的独立飞行 | `EntityManager.projectiles` | 独立实体，全局管理 |
| 子弹 | 开枪射出的 | `EntityManager.projectiles` | 独立实体 |
| 命中火花 | 打中时的特效 | `EntityManager.effects` | 独立特效，自己消失 |
| 敌人 | 杂兵 | `EntityManager.enemies` | 独立实体 |

**核心原则**：**纯视觉属性放 Player，有独立逻辑的实体（含跟随的剑阵）放 EntityManager。跟随角色用 Helper 的 `follow_owner`，独立飞行用 Projectile/Helper。**

#### 状态定义（所有同类角色共享）

```lua
-- 这是定义数据（常量），不是实例变量
-- 所有维吉尔实例共用同一份 states 表
local states = {
    attack_1 = {
        total_frames = 30,           -- 常量
        cancel_windows = {           -- 常量
            {start = 8, finish = 15, allowed = {"slash"}},
        },
        on_frame = function(player, frame, buf) ... end,  -- 逻辑
    },
}
-- player1 和 player2 都用 states.attack_1 的定义
-- 但各自的 player.frame 是独立的实例变量
```

#### Player.update 的分层（对应 MUGEN state -4/-3/-2/-1）

MUGEN 角色每帧按 `-4 → -3 → -2 → -1 → 当前状态` 顺序执行。对应到 Love2D：

| MUGEN state | Love2D 函数 | 职责 | hitstop 时 |
|---|---|---|---|
| **-4** | `updateAlways` | 极少用，hitstop 也跑 | ✅ 跑 |
| **-3** | `updateGlobal` | 全局前置（朝向、锁定目标、物理） | ❌ 跳过 |
| **-2** | `updateFlags` | 标志/变量更新（蓄力、红刀、计时器） | ❌ 跳过 |
| **-1** | `updateControl` | on_frame + cancel_windows + 即时命令 + ChangeState | ❌ 跳过 |
| **当前状态** | `updateState` | 推进帧数 + 状态结束 | ❌ 跳过 |

```lua
function Player.update(player, dt, buf, in_hitstop)
    -- 1. updateAlways（-4）：hitstop 也跑，极少用
    player:updateAlways(dt, buf)

    -- ★ hitstop 分界线：后面全部跳过
    -- ⚠ 教学简化！MUGEN 实际不是"整层跳过"，而是"层照样调用，
    --    里面每个 sctrl 单独判断 ignorehitpause"。详见后文
    --    「进阶补充：MUGEN 真实的 hitpause 机制」一节。
    if in_hitstop then return end

    -- 2. updateGlobal（-3）：全局前置，为后续步骤准备数据
    player:updateGlobal(dt, buf)

    -- 3. updateFlags（-2）：标志/变量更新，不管角色在什么状态都要做
    player:updateFlags(dt, buf)

    -- 4. updateControl（-1）：命令检测 + cancel_windows + 决定切什么状态
    player:updateControl(dt, buf)

    -- 5. updateState（当前状态）：只在没切状态时才推进
    if player.state_changed then
        player.state_changed = false
        return  -- updateControl 切了状态，本帧不推进
    end
    player:updateState(dt, buf)
end
```

每一层放什么：

```lua
-- -4：hitstop 也跑（极少用）
function Player:updateAlways(dt, buf)
    -- 全局帧计数器、调试逻辑
end

-- -3：全局前置（必须在命令检测之前）
function Player:updateGlobal(dt, buf)
    self:updateFacing()         -- 朝向（影响前后解析，必须在 control 之前）
    self:updateLockTarget()     -- 锁定目标
    self:updatePhysics(dt)      -- 物理（重力、地面检测）
end

-- -2：标志/变量更新（不管什么状态都要做）
function Player:updateFlags(dt, buf)
    -- 蓄力标志（任何状态都能蓄力）
    -- ★ -2 层只管标志（给视觉用：剑上冒蓝光），不在这里 setState。
    --    "蓄力满后松手 → 次元斩释放" 是一个普通招式触发，触发条件就是
    --    命令 ~15a（按住 attack 15 帧后松开，§3.3），和波动拳的 QCF_x 同类。
    --    由 -1 层 trigger entry 消费命令做 ChangeState（见后面 trigger entry 例表）。
    --    若在 -2 层 setState：① 越权做了 -1 层的事（§「MUGEN state -1 的真实流程」）；
    --    ② setState 不设 state_changed，-1 层照样跑，可能用新状态再切一次把 release 覆盖掉。
    if buf:held("attack") and not self.charging then
        self.charging = true
        self.charge_frame = 0
    end
    if self.charging then
        if buf:held("attack") then
            self.charge_frame = self.charge_frame + 1
        else
            self.charging = false        -- 松手清标志，蓝光消失
            self.charge_frame = 0
        end
    end

    -- 计时器递减
    if self.invincible_frames > 0 then
        self.invincible_frames = self.invincible_frames - 1
        if self.invincible_frames == 0 then self.invincible = false end
    end
    if self.hitstun > 0 then self.hitstun = self.hitstun - 1 end
end

-- -1：命令检测 + ChangeState
function Player:updateControl(dt, buf)
    local state = states[self.state]

    -- 先调 on_frame（状态内输入检测，如红刀）
    if state.on_frame then
        state.on_frame(self, self.frame, buf)
        if self.state ~= state.name then
            self.state_changed = true
            return
        end
    end

    -- 检查 cancel_windows（按 priority 找命令）
    for _, window in ipairs(state.cancel_windows or {}) do
        if self.frame >= window.start and self.frame <= window.finish then
            if Command.checkCondition(window, self) then
                local sorted = sortByPriority(window.allowed)
                for _, name in ipairs(sorted) do
                    if commands[name].cur_buffer_time > 0 then
                        self:setState(name)
                        self.state_changed = true
                        return
                    end
                end
            end
        end
    end

    -- 即时命令（幻影剑、开枪等不进状态机的）
    updateInstantCommands(self, buf)
end

-- 当前状态：推进帧数 + 状态结束
function Player:updateState(dt, buf)
    local state = states[self.state]
    self.frame = self.frame + 1
    if state.total_frames and self.frame >= state.total_frames then
        if state.on_exit then state.on_exit(self) end
        if self.state == state.name then self:setState("stand") end
    end
end

-- setState 辅助函数
function Player:setState(new_state)
    self.state = new_state
    self.frame = 0
    local s = states[new_state]
    if s.on_enter then s.on_enter(self) end
end
```

#### MUGEN state -1 的真实流程

上面 `updateControl` 那 30 行代码，对应 MUGEN state -1 这一整层。下面把 MUGEN -1 的真实流程拆开讲清楚。

**1. -1 在执行顺序中的位置**

每帧按 `-4 → -3 → -2 → -1 → 当前状态` 顺序执行。-1 在当前状态**之前**跑，所以 -1 里触发的 ChangeState 会先"排队"，等 -1 跑完才真正切到新状态。这一点的意义后面会讲。

**2. -1 不是"更新输入"，是"消费输入"**

这是最容易误解的地方。输入的"更新"（读硬件 + 命令匹配）在**所有 state 执行之前**就完成了，根本不在 -4/-3/-2/-1 任何一层里。看 Ikemen-GO 源码 `char.go:13092`：

```go
func (cl *CharList) action() {
    cl.updateRunOrder()
    cl.commandUpdate()        // ← 输入/命令更新最先跑（系统层，不是 state）
    for _, c := range cl.runOrder {
        c.actionPrepare()
    }
    for i := 0; i < len(cl.runOrder); i++ {
        c.actionRun()         // ← state -4/-3/-2/-1/当前 state 都在这里
    }
    ...
}
```

**这四个方法分别是干什么的**（源码都在 `src/char.go`）：

**① `cl.updateRunOrder()` — 给所有角色排执行顺序**

每帧先把所有角色（玩家 + helper）按优先级排序，决定谁先跑。优先级从高到低：

| 优先级 | 谁 | 为什么 |
|---|---|---|
| 100 | `runfirst` 标志的角色 | 显式要求最先跑 |
| 5 | 攻击中（moveType=A） | 攻击者先判定命中，被击者本帧就能处理被击，不拖一帧 |
| 4 | idle 玩家 | |
| 3 | 其他玩家 | |
| 2 | idle helper | |
| 1 | 其他 helper | |
| -100 | `runlast` 标志的角色 | 显式要求最后跑 |

同优先级按 ID 排（小 ID 先跑），保证顺序可预测。排完重置 `runfirst`/`runlast`——这俩是每帧临时标志。

**② `cl.commandUpdate()` — 输入和命令更新（系统层，所有角色一起做）**

这是**系统层**，在所有 state 之前跑，对每个角色（root + helper）做：

- **AI 作弊**：AI 控制时随机挑一个命令标记为"匹配上"，模拟人类输入
- **自动转身** `autoTurn()`：站立/行走/落地等状态下自动转向对手（这就是为什么你不写转身代码角色也会转）
- **前后翻转** `updateFBFlip()`：根据朝向把"按后"解释成"按前"还是"按后"（对应本文 §6 讲的相对方向）
- **输入更新** `InputUpdate()`：读硬件 → 写进 buffer
- **命令步进** `cmd[i].Step()`：每个命令推进一帧匹配，处理 hitpause/pause 时的缓冲

**关键**：这一步只**更新**命令匹配结果（让 `command = "QCF_x"` 变 true），**不消费**——消费是 -1 层的事。所以 -1 拿到的 `command` 是已经算好的结果。

**③ `c.actionPrepare()` — 角色动作准备（每个角色单独做）**

正式跑 state 之前的准备，核心两件事：

**a. 算 `pauseBool`**（是否被 Pause/SuperPause 冻住）。后面 `actionRun` 里 -3/-2/-1/当前状态都靠它决定跑不跑。

**b. 硬编码按键动作**——引擎内置的"不用玩家写也会动"的行为。这就是为什么 MUGEN 里你什么都不写，角色也能站、蹲、走、跳、防御：

```go
if c.ctrl() {
    if c.scf(SCF_guard) && c.inguarddist && !c.inGuardState() && ... {
        c.changeState(120, ...) // 防御
    } else if !c.asf(ASF_nojump) && c.ss.stateType == ST_S && ... {
        c.changeState(40, ...)  // 跳跃
    } else if !c.asf(ASF_noairjump) && ... {
        c.changeState(45, ...)  // 空中跳
    } else if !c.asf(ASF_nocrouch) && ... {
        c.changeState(10, ...)  // 站→蹲
    } else if !c.asf(ASF_nostand) && ... {
        c.changeState(12, ...)  // 蹲→站
    } else if !c.asf(ASF_nowalk) && ... {
        c.changeState(20, ...)  // 走路
    }
}
```

这些状态切换靠 `ASF_nojump`/`ASF_nocrouch` 等标志开关。对应本文 §"用法 A：通用取消"的引擎内置版——做鬼泣类游戏时这些靠 trigger entry 自己管，不用引擎硬编码。

**c. 重置标志和计时器**：`specialFlag`、`stagebound`、`screenbound`、`playerpush`、`hitby`/`hover` 计时器递减。每帧开头清零，state 里设了才生效。

**④ `c.actionRun()` — 跑状态层（核心，-4/-3/-2/-1/当前/+1 都在这）**

这就是本文 `Player.update` 五层分层对应的那段。依次跑：

| 步骤 | `c.minus` | 受 `pauseBool` 控制？ | 干啥 | 对应本文 |
|---|---|---|---|---|
| state -4 | -4 | ❌ 总是跑 | 极少用，hitpause 也跑 | `updateAlways` |
| state -3 | -3 | ✅ | 朝向、锁定等 | `updateGlobal` |
| state -2 | -2 | ✅ | 变量更新 | `updateFlags` |
| state -1 | -1 | ✅ | 命令消费 + ChangeState | `updateControl` |
| `stateChange2()` | — | ✅ | 把缓冲的状态切换真正生效 | `if state_changed then return` |
| 当前状态 | 0 | ✅ | 推进帧数、跑 sctrl | `updateState` |

**注意 `stateChange2()`**：-1 层 ChangeState 不是立即切的，是先缓冲，等 -1 跑完才在 `stateChange2()` 真正切。这就是本文说的"-1 里触发的 ChangeState 会先排队"。

之后还有：防御指令再查一次、state +1（收尾层，对应 `-10`）、物理更新（`posUpdate`、落地检测、`ss.time++`）。

**串起来的完整一帧**：

```
action():
  updateRunOrder()      ← 排序：攻击者先、玩家先、helper 后
  commandUpdate()       ← 系统层：读硬件、命令匹配、autoTurn、FB翻转
  for each char:
    actionPrepare()     ← 算 pauseBool、硬编码站蹲走跳防、重置标志
  for each char:
    actionRun()         ← -4 → -3 → -2 → -1 → stateChange2 → 当前状态 → +1 → 物理
  for each char:
    actionFinish()      ← 收尾
```

所以 -1 拿到的 `command = "QCF_x"` 是**已经匹配好的结果**，它的工作是拿着这些结果 + 当前状态 + 帧数，决定要不要 ChangeState。换句话讲：

| 层 | 职责 | 输入/输出 |
|---|---|---|
| Input 层 + Command 层（系统层） | 更新输入：读硬件 → 命令匹配 | 输出：`command="QCF_x"` 为 true |
| state -1 | 消费输入：拿命令结果 + 当前状态 + 帧数，决定 ChangeState | 输入：命令结果；输出：切状态 |

**3. -1 里 sctrl 的典型 trigger**

MUGEN -1 里的每个 sctrl（通常是 ChangeState）都带一组 trigger 条件：

| trigger | 含义 | 例子 |
|---|---|---|
| `command = "xxx"` | 命令是否匹配（消费输入） | `command = "QCF_x"` |
| `statetype = S/C/A/L` | 当前状态类型 | `statetype = S`（站立） |
| `ctrl` | 是否有控制权 | `ctrl = 1` |
| `stateno = N` | 当前状态号（状态内取消用） | `stateno = 200` |
| `time = [a, b]` | 当前状态的帧数窗口 | `time = [5, 10]` |
| `var(n) = X` | 变量条件 | `var(0) = 1` |

**4. -1 的两种典型用法**

```mugen
; === 用法 A：通用取消（任何状态都能搓）===
[State -1, 波动拳]
type = ChangeState
value = 200
trigger1 = command = "QCF_x"    ; 消费命令
trigger1 = statetype = S         ; 当前必须是站立
trigger1 = ctrl                  ; 必须有控制权

; === 用法 B：状态内取消（只在特定状态的特定帧窗口）===
[State -1, 红刀取消]
type = ChangeState
value = 250
trigger1 = command = "x"         ; 消费命令
trigger1 = stateno = 200         ; 当前必须在 200 状态
trigger1 = time = [5, 10]        ; 且在第 5-10 帧
trigger1 = var(0) = 1            ; 且满足某个变量条件
```

用法 B 就是"红刀取消"这类逻辑：在某个攻击状态的特定帧窗口内按下特定键，就切到派生状态。**它写在 -1 里，不是写在当前 state 200 里**——这是关键，原因见下一节。

**5. 对应到 Love2D 代码**

| MUGEN -1 里的东西 | Love2D 代码 | 说明 |
|---|---|---|
| 用法 A（通用取消：ChangeState + command + statetype + ctrl） | `updateInstantCommands` + 通用命令检测 | 任何状态都能触发的切状态/即时效果 |
| 用法 B（状态内取消：ChangeState + stateno + time） | `on_frame` + `cancel_windows` | 只在当前状态的特定帧窗口生效 |
| `trigger1` / `trigger2` 条件组合 | `if` 判断 + `cancel_windows` 数据 | MUGEN 用 trigger，Love2D 用 if |

`on_frame` 和 `cancel_windows` 都是"状态内取消"，都放在 `updateControl`（-1）里，只是表达方式不同：

- `cancel_windows`：数据驱动，`{start=8, finish=15, allowed={"slash"}}` 表示"第 8-15 帧按 slash 可以取消"。规整，适合简单帧窗口。
- `on_frame`：代码驱动，`function(player, frame, buf) ... end`。灵活，能写任意复杂逻辑（多段取消、按方向键不同取消、基于变量取消等）。

**6. 为什么 on_frame 必须在 -1 里，不能放在当前状态（updateState）里？**

因为 -1 在当前状态**之前**执行。看执行顺序：

```
-1 updateControl:  on_frame / cancel_windows 检测  →  可能 ChangeState
当前状态 updateState: 推进 frame、检查 total_frames、状态结束
```

如果在 `updateState` 里检测取消，会发生：
1. `frame = frame + 1`（推进帧数）
2. 检查 `frame >= total_frames` → 状态已结束 → 切回 stand
3. 这时才检测取消 → 取消窗口早关了，或者状态已经切走了

放在 -1 里则能**抢先**：在当前状态推进帧数/结束之前，先检测取消。如果触发了 ChangeState，`updateControl` 直接 `return`，`updateState` 本帧根本不跑（看 `Player.update` 里的 `if player.state_changed then return end`）。

这对应 MUGEN 的真实行为：-1 在当前 state 之前执行，所以 -1 里的 ChangeState 能"抢"在当前 state 的逻辑之前切状态。MUGEN 角色作者把红刀取消写在 -1 而不是当前 state，正是为此。

**7. Ikemen-GO 源码对应**

| 概念 | 源码位置 |
|---|---|
| -1 层在当前 state 之前执行 | `char.go:11714-11720`（`// Run state -1` 在 `// Run current state` 之前） |
| -1 只在 `keyctrl[0]` 且自己拥有状态时跑 | `char.go:11716` `if c.ss.sb.playerNo == c.playerNo && c.keyctrl[0]` |
| 输入更新在所有 state 之前 | `char.go:13098` `cl.commandUpdate()` 在 `actionRun()` 之前 |
| ChangeState 排队，等 -1 跑完才切 | `char.go:11722` `c.stateChange2()`（在 -1 之后、当前 state 之前提交） |

#### 为什么这样分层

| 分层原因 | 例子 |
|---|---|
| 朝向必须在命令检测之前更新 | `updateFacing` 在 -3，`cancel_windows` 在 -1 |
| 蓄力标志不管什么状态都要更新 | `updateFlags`（-2）独立于 `updateState`（当前状态） |
| 命令检测在状态推进之前 | `updateControl`（-1）在 `updateState` 之前，切了状态就不推进 |
| hitstop 时部分逻辑仍需跑 | `updateAlways`（-4）在 hitstop 分界线之前 |

**Player 不直接访问 Input**——通过 `buf` 参数接收 Buffer 数据，通过 `Command.isActive(cmd)` 查命令状态。`updateFlags` 里更新的变量都是角色级的（`self.*`），对应 MUGEN 的 `var()`。

#### 进阶补充：MUGEN 真实的 hitpause 机制（不整层跳过）

上面那个 `if in_hitstop then return end` 是**教学简化**。它对"角色被冻住、不动作、不响应输入"这个**效果**描述是对的，但 MUGEN 内部**不是**这样实现的。

**MUGEN 的真实机制：**

1. **state -4 / -3 / -2 / -1 / 当前 state 在 hitpause 时仍然会被"调用"**。控制它们是否调用的是 `pause`（Pause/SuperPause，超必杀冻场），**不是** `hitpause`。这两套是独立机制。
2. **真正的跳过发生在每个 sctrl（state controller，状态控制器）层面**。每个 sctrl 有一个 `ignorehitpause` 属性：
   - 默认 `ignorehitpause = 0`（false）：hitpause 时**跳过**这个 sctrl
   - 显式写 `ignorehitpause = 1`（true）：hitpause 时**照常执行**
3. 所以 hitpause 的效果是"层照样跑，但里面的 sctrl 默认都被跳过"——从外部看像"整层跳过"，但机制完全不同。

**MUGEN 代码示例（[State -2, ...]）：**

```mugen
; 默认 sctrl：hitpause 时跳过
[State -2, 推进位移]
type = VelSet
x = 5

; 显式声明 ignorehitpause：hitpause 时也跑
[State -2, 命中火花特效]
type = Explod
trigger1 = time = 0
anim = 100
ignorehitpause = 1
```

**为什么 MUGEN 要设计得这么细？**

因为有些 sctrl **必须**在 hitpause 里跑，整层跳过会出 bug：

| sctrl | 为什么不能跳过 |
|---|---|
| `HitBy` / `NotHitBy` 计时器 | 否则无敌帧在 hitpause 期间不递减，会出现"理论上无敌已结束但实际还在"的 bug |
| `AssertSpecial` 的 `animatehitpause` | 必须每帧重置，否则标志泄漏到下一帧 |
| `Explod`（视觉特效） | 作者可能想让命中火花/灰尘在 hitpause 期间继续显示和动画，强化打击感 |
| 角色自定义的"全局规则" | 某些计时器、变量更新必须任何时刻都跑 |

如果像 `if in_hitstop then return end` 那样整层跳过，这些就全废了。

**Love2D 例子：模拟 MUGEN 的细粒度 hitpause**

下面这个例子演示"每个 sctrl 单独判断 ignorehitpause"的真实机制。把它保存为 `main.lua` 用 Love2D 打开：

```lua
-- main.lua
-- 演示 MUGEN 真实的 hitpause 机制：每个 sctrl 单独判断 ignorehitpause
-- 而不是"整层跳过"

local player = {
    x = 200, y = 300,
    vx = 0,
    hitpause = 0,
    invincible = 0,      -- 无敌计时器（state -4 层，必须任何时候都跑）
    hitstun = 0,         -- 受击硬直（默认 sctrl，hitpause 时跳过）
    dust = 0,            -- 特效计时器（ignorehitpause=true，hitpause 时也跑）
    move_apply = 0,      -- 位移应用计数（默认 sctrl，hitpause 时跳过）
}

-- 模拟 MUGEN state -2 层里的 sctrl 列表
-- 每个 sctrl 有 ignorehitpause 属性，对应 MUGEN 的 [State -2, ...] 块
local sctrls_minus2 = {
    {
        name = "受击硬直递减",
        color = {1, 0.4, 0.4},
        ignorehitpause = false,  -- 默认：hitpause 时跳过
        run = function(p)
            if p.hitstun > 0 then p.hitstun = p.hitstun - 1 end
        end,
    },
    {
        name = "特效计时器递减",
        color = {0.4, 1, 0.4},
        ignorehitpause = true,   -- 显式声明：hitpause 时也跑
        run = function(p)
            if p.dust > 0 then p.dust = p.dust - 1 end
        end,
    },
    {
        name = "应用位移 (VelSet)",
        color = {0.4, 0.4, 1},
        ignorehitpause = false,  -- 默认：hitpause 时跳过
        run = function(p)
            p.x = p.x + p.vx
            p.vx = p.vx * 0.9
            p.move_apply = p.move_apply + 1
        end,
    },
}

-- state -4 层：无论 hitpause 都调用（极少用，但有些必备逻辑放这里）
local sctrls_always = {
    {
        name = "无敌计时器递减",
        color = {1, 1, 0.4},
        run = function(p)
            if p.invincible > 0 then p.invincible = p.invincible - 1 end
        end,
    },
}

-- 记录本帧每个 sctrl 是否执行了（用于可视化）
local ran_this_frame = {}

-- 关键函数：模拟 MUGEN 的 StateBlock.Run（Ikemen-GO bytecode.go:4542）
local function runSctrl(sctrl, p, key)
    ran_this_frame[key] = false
    -- ★ 关键：每个 sctrl 单独判断 hitpause，而不是整层判断
    if p.hitpause > 0 and not sctrl.ignorehitpause then
        return  -- 这个 sctrl 被跳过
    end
    sctrl.run(p)
    ran_this_frame[key] = true
end

function love.update(dt)
    -- state -4：始终调用（层不跳过）
    for i, s in ipairs(sctrls_always) do
        runSctrl(s, player, "always_"..i)
    end

    -- state -2：也调用（层不跳过！），但里面 sctrl 单独判断
    for i, s in ipairs(sctrls_minus2) do
        runSctrl(s, player, "minus2_"..i)
    end

    -- hitpause 倒计时
    if player.hitpause > 0 then
        player.hitpause = player.hitpause - 1
    end
end

function love.draw()
    -- 画角色（无敌时变黄）
    love.graphics.setColor(player.invincible > 0 and {1, 1, 0.4} or {0.8, 0.8, 0.8})
    love.graphics.rectangle("fill", player.x, player.y, 40, 40)

    -- 状态显示
    love.graphics.setColor(1, 1, 1)
    love.graphics.print(string.format("hitpause: %d", player.hitpause), 10, 10)
    love.graphics.print(string.format("invincible: %d   hitstun: %d   dust: %d   move_apply: %d",
        player.invincible, player.hitstun, player.dust, player.move_apply), 10, 30)

    local y = 70
    -- 显示 state -4 层
    love.graphics.setColor(1, 1, 1)
    love.graphics.print("state -4 (always, 层始终调用):", 10, y); y = y + 22
    for i, s in ipairs(sctrls_always) do
        local ran = ran_this_frame["always_"..i]
        love.graphics.setColor(s.color)
        love.graphics.print(string.format("  [%s] %s", ran and "X" or " ", s.name), 20, y)
        y = y + 22
    end

    -- 显示 state -2 层
    love.graphics.setColor(1, 1, 1)
    love.graphics.print("state -2 (层照样调用, sctrl 单独判断):", 10, y); y = y + 22
    for i, s in ipairs(sctrls_minus2) do
        local ran = ran_this_frame["minus2_"..i]
        love.graphics.setColor(s.color)
        local tag = s.ignorehitpause and " (ignorehitpause)" or ""
        local status = ran and "" or (player.hitpause > 0 and "  <- skipped" or "")
        love.graphics.print(string.format("  [%s] %s%s%s",
            ran and "X" or " ", s.name, tag, status), 20, y)
        y = y + 22
    end

    -- 操作提示
    love.graphics.setColor(1, 1, 1)
    love.graphics.print("H: hitpause(8)   J: hitstun(20)   K: dust(15)   L: invincible(30)   N: vx=5",
        10, y + 20)
end

function love.keypressed(key)
    if key == "h" then player.hitpause = 8 end
    if key == "j" then player.hitstun = 20 end
    if key == "k" then player.dust = 15 end
    if key == "l" then player.invincible = 30 end
    if key == "n" then player.vx = 5 end
    if key == "escape" then love.event.quit() end
end
```

**怎么玩这个例子：**

1. 先按 `J` `K` `L` 给三个计时器充能，再按 `N` 给角色一个速度。观察：所有 sctrl 都在跑（都显示 `[X]`），角色方块在移动。
2. 按 `H` 触发 hitpause（8 帧）。仔细看：
   - **state -4 的"无敌计时器"**：照常递减（`[X]`），因为 state -4 层始终调用
   - **state -2 的"受击硬直"**：被跳过（`[ ] <- skipped`），数值不动
   - **state -2 的"特效计时器"**：照常递减（`[X]`），因为它声明了 `ignorehitpause = true`
   - **state -2 的"应用位移"**：被跳过（`[ ] <- skipped`），角色方块冻住
3. hitpause 结束（`hitpause` 归 0）后，被跳过的 sctrl 立即恢复执行。

**对比教学简化版：**

如果用文档前面的 `if in_hitstop then return end` 写法，hitpause 时**所有** state -2 的 sctrl 都会被跳过——特效计时器也不动了、无敌计时器也不动了。这在简单游戏里没问题，但如果你的游戏需要"hitpause 期间特效继续播放"或"hitpause 期间无敌帧继续递减"，就得用这种细粒度判断。

**Ikemen-GO 源码对应：**

| 例子里的概念 | Ikemen-GO 源码位置 |
|---|---|
| `player.hitpause` 计数器 | `char.go:12364` `if c.hitPauseTime > 0 { c.hitPauseTime-- }` |
| `c.hitPause()` 判断 | `char.go:9111` `return c.hitPauseTime > 0` |
| `sctrl.ignorehitpause` 默认 false | `bytecode.go:4539` `ignorehitpause: -2`（-2 表示默认跳过） |
| 每个 sctrl 单独判断 | `bytecode.go:4553-4557` `if c.hitPause() { if b.ignorehitpause < -1 { return false } }` |
| state -4 层始终调用 | `char.go:11694-11698`（不在 `if !c.pauseBool` 块里） |
| state -2 层调用（不判断 hitpause） | `char.go:11707-11713`（在 `if !c.pauseBool` 块里，但 `pauseBool` 只管 Pause 不管 hitpause） |

### 主循环

```lua
local buf = Buffer.new()
local player = Player.new()
local Game = {hitstop_frames = 0, frame_counter = 0, projectiles = {}}

function love.update(dt)
    -- 全局变量更新
    Game.frame_counter = Game.frame_counter + 1

    -- 1. Input 层
    Input.update()

    -- 2. 前后解析 + SOCD（用上一帧的 player.facing，updateGlobal 里会更新朝向）
    local back, fwd = Input.resolveFacing(
        Input.held("left"), Input.held("right"), player.facing)
    back, fwd = SOCD.resolveH(back, fwd)

    -- 3. 组装输入快照 + 更新 Buffer
    local snapshot = buildInputSnapshot(Input, back, fwd)
    Buffer.update(buf, snapshot)

    -- 4. Command 层（命令匹配，hitstop 期间也跑）
    local in_hitstop = Game.hitstop_frames > 0
    for _, cmd in pairs(commands) do
        Command.step(cmd, buf, in_hitstop)
    end

    -- 5. 状态机（分层更新：updateAlways → updateGlobal → updateFlags → updateControl → updateState）
    --    朝向更新、标志更新、命令检测、即时命令、状态推进都在 Player.update 内部分层处理
    Player.update(player, dt, buf, in_hitstop)

    -- 6. 全局实体更新（发射物、敌人、特效，独立于角色）
    EntityManager.update(dt)

    -- 7. hitstop 倒计时
    if in_hitstop then Game.hitstop_frames = Game.hitstop_frames - 1 end
end

function love.draw()
    -- 画角色（含剑阵等围绕效果）
    Player.draw(player)
    -- 画全局实体（飞出的幻影剑、子弹、特效）
    EntityManager.draw()
end
```

数据流是单向的：`Input → 前后解析+SOCD → Buffer → Command → 状态机`。`Player.update` 内部分五层执行（-4/-3/-2/-1/当前状态），朝向、标志、命令检测、即时命令、状态推进各管各的。全局实体（EntityManager）独立于角色更新和渲染。搞清楚这个架构后，后面每一章都是在讲其中一层的细节。

---

## 第一章：按键状态 —— 现在按了什么

### 1.1 虚拟按键与物理映射

在写输入代码前，先搞清楚一个核心设计：**招式定义用虚拟按键，物理按键可配置映射**。

#### 为什么要虚拟按键

如果你在招式定义里直接写 `love.keyboard.isDown("j")`，那换个键位或换手柄就不能用了。正确做法是：

```
物理硬件（键盘/手柄）
    │
    ▼
物理映射表（keyMap / gamepadMap）
    │
    ▼
虚拟按键（attack / jump / lock ...）  ← 招式定义用这些
```

招式从头到尾只用虚拟按键名（`attack`、`jump`），不关心是键盘 J 还是手柄 A 键。换设备只改映射表，不改招式。这就是 MUGEN 的 `KeyConfig` 设计。

> **其他引擎的对应**：本文的"虚拟按键"就是 Unity Input System 的 **InputAction**、UE Enhanced Input 的 **UInputAction**、MUGEN 的逻辑按键——同一个抽象层，叫法不同。有引擎经验的读者看到"虚拟按键"可直接对应到 InputAction/UInputAction。
>
>| 引擎/框架 | 抽象输入叫什么 | 绑定到物理输入的东西 | 代码里查什么 |
>|---|---|---|---|
>| 本文 | 虚拟按键（`attack`/`jump`/`lock`...） | 物理映射表（`keyboardMap`/`gamepadMap`） | `buf:held("attack")` |
>| Unity Input System | InputAction（`Move`/`Jump`/`Fire`...） | Binding | `action.WasPressedThisFrame()` |
>| UE Enhanced Input | UInputAction（`IA_Jump`/`IA_Move`...） | InputMappingContext | `ActionValue` |
>| MUGEN | 逻辑按键（`a`/`b`/`c`/`x`/`y`/`z`/`up`...） | KeyConfig | `command = "QCF_x"` 里的 `x` |

#### DMC5 的按键设计（查证后）

参考 DMC5 的实际按键，维吉尔和尼禄的布局：

**维吉尔手柄布局**：

| 手柄 | Xbox | PS | 维吉尔功能 |
|---|---|---|---|
| A | A | × | Jump（跳跃） |
| B | B | ○ | **Trick（瞬移/闪避）** |
| X | X | □ | 幻影剑（枪/远距离） |
| Y | Y | △ | **近战攻击（居合/刀）** |
| RB | RB | R1 | Lock-On（锁定） |
| LB | LB | L1 | Doppelganger（分身） |
| LT | LT | L2 | **向左切换武器** |
| RT | RT | R2 | **向右切换武器** |

维吉尔的招式输入：
- **次元斩**：长按近战键（Y/△）然后松开
- **完美次元斩**：在收刀的精确时机松开近战键
- **闪避/瞬移**：B/○（Trick），无锁定时方向+B 是闪避
- **翻滚**：锁定 + 方向 + 跳跃
- **武器切换**：LT/L2 向左循环，RT/R2 向右循环（Yamato ↔ Mirage Edge ↔ Beowulf）

**尼禄手柄布局**：

| 手柄 | Xbox | PS | 尼禄功能 |
|---|---|---|---|
| A | A | × | Jump（跳跃） |
| B | B | ○ | **Devil Breaker（鬼手）** |
| X | X | □ | Blue Rose（枪） |
| Y | Y | △ | **Red Queen（近战）** |
| RB | RB | R1 | Lock-On（锁定） |
| LB | LB | L1 | Break Away（丢弃机械臂） |
| LT | LT | L2 | **Exceed（红刀充能）** |
| RT | RT | R2 | Devil Trigger（恶魔扳机） |

**关键差异**：同一个物理按键在不同角色下含义不同——
- B/○：维吉尔是 Trick（闪避），尼禄是 Devil Breaker（鬼手）
- LT/L2：维吉尔是向左切武器，尼禄是 Exceed（红刀充能）
- RT/R2：维吉尔是向右切武器，尼禄是 Devil Trigger

这是"同一个虚拟按键在不同角色下出不同招"，用状态联动处理（§9.3）。

#### 虚拟按键定义

```lua
local VirtualKeys = {
    -- 方向（绝对）
    "left", "right", "up", "down",

    -- 通用动作
    "attack",      -- 近战攻击（Y/△）
    "shoot",       -- 枪/远距离（X/□）
    "jump",        -- 跳跃（A/×）
    "lock",        -- 锁定（RB/R1）

    -- 角色特定（同一个键不同角色含义不同）
    "special",     -- B/○：维吉尔 Trick / 尼禄 Devil Breaker
    "trigger_l",   -- LT/L2：维吉尔向左切武器 / 尼禄 Exceed
    "trigger_r",   -- RT/R2：维吉尔向右切武器 / 尼禄 Devil Trigger
    "shoulder_l",  -- LB/L1：维吉尔分身 / 尼禄丢弃机械臂

    -- 系统
    "start",       -- 暂停
    "taunt",       -- 挑衅
}
```

**设计要点**：`special`/`trigger_l`/`trigger_r` 是"角色特定"的虚拟按键——名字是中性的，具体含义由角色状态机决定。维吉尔的 `trigger_l` 是"向左切武器"，尼禄的 `trigger_l` 是"红刀充能"。

#### 物理映射

```lua
-- 键盘映射
local keyboardMap = {
    left = "a",    right = "d",    up = "w",    down = "s",
    attack   = "j",    -- 近战
    shoot    = "l",    -- 枪
    jump     = "k",    -- 跳跃
    lock     = "o",    -- 锁定
    special  = "i",    -- Trick/鬼手（B/○）
    trigger_l = "u",   -- 向左切武器/红刀（LT/L2）
    trigger_r = "p",   -- 向右切武器/恶魔扳机（RT/R2）
    shoulder_l = "semicolon",  -- 分身/丢弃臂（LB/L1）
    start    = "escape",
    taunt    = "t",
}

-- 手柄按钮映射（Love2D gamepad 按钮名）
local gamepadMap = {
    left  = "dpleft",  right = "dpright",
    up    = "dpup",    down  = "dpdown",
    attack = "y",            -- Y/△
    shoot  = "x",            -- X/□
    jump   = "a",            -- A/×
    lock   = "rightshoulder",-- RB/R1
    special = "b",           -- B/○
    shoulder_l = "leftshoulder", -- LB/L1
    start  = "start",
    taunt  = "back",
    -- trigger_l / trigger_r 是扳机，需要单独处理（见下）
}
```

**扳机特殊处理**：LT/L2 和 RT/R2 是模拟轴（0.0~1.0），不是按钮。需要设死区转成 bool：

```lua
-- 读扳机（LT/L2、RT/R2）
function Input.readTriggers(joystick)
    if not joystick or not joystick:isGamepad() then
        return false, false
    end
    local lt = joystick:getGamepadAxis("triggerleft")   -- LT/L2
    local rt = joystick:getGamepadAxis("triggerright")  -- RT/R2
    local threshold = 0.5
    return lt > threshold, rt > threshold
end
```

**摇杆方向**：左摇杆是模拟轴，需要转成 4 个 bool 方向：

```lua
function Input.readStick(joystick)
    if not joystick or not joystick:isGamepad() then
        return false, false, false, false
    end
    local lx = joystick:getGamepadAxis("leftx")
    local ly = joystick:getGamepadAxis("lefty")
    local deadzone = 0.5
    return
        ly < -deadzone,   -- up（Love2D Y 轴向下为正）
        ly >  deadzone,   -- down
        lx < -deadzone,   -- left
        lx >  deadzone    -- right
end
```

### 1.2 最朴素的写法

Love2D 给我们最基础的 API：

```lua
function love.update(dt)
    if Input.held("attack") then
        -- 出拳
    end
end
```

注意这里用的是虚拟按键名 `"attack"`，不是物理键名 `"j"`。`Input.held` 内部查映射表，自动处理键盘和手柄。

但这里有个坑：**"按住"和"刚按下"是两件事**。

### 1.3 边沿检测：刚按下 vs 持续按住

想象你按按钮：

```
按住 attack attack attack attack attack
       ↑                      ↑
     刚按下                 一直按着
```

- "刚按下"那一帧才应该触发出拳（不然你按住攻击键角色就一直出拳）
- "按住"可以用来表示"蓄力"或"持续动作"（维吉尔长按近战蓄次元斩）

我们区分三种状态：

```
justPressed   = 之前没按，现在按了  → 边沿，触发招式用
held          = 之前按了，现在还按  → 持续，蓄力/持续动作用（次元斩蓄力）
justReleased  = 之前按了，现在没按  → 松开边沿，蓄力释放用（次元斩释放）
```

### 1.4 Love2D 实现

维护两份状态：上一帧的、这一帧的。Input 层根据映射表读硬件，合并键盘 + 手柄 + 摇杆：

```lua
local Input = {
    prev = {}, curr = {},
    keyboardMap = keyboardMap,
    gamepadMap = gamepadMap,
}

function Input.update()
    -- 保存上一帧
    for _, vkey in ipairs(VirtualKeys) do
        Input.prev[vkey] = Input.curr[vkey] or false
    end

    -- 重新采样：先查键盘，再查手柄（OR 合并）
    local joystick = love.joystick.getJoysticks()[1]
    for _, vkey in ipairs(VirtualKeys) do
        local held = false

        -- 键盘
        local kbKey = Input.keyboardMap[vkey]
        if kbKey and love.keyboard.isDown(kbKey) then
            held = true
        end

        -- 手柄按钮
        if not held and joystick then
            local gpKey = Input.gamepadMap[vkey]
            if gpKey and joystick:isGamepadDown(gpKey) then
                held = true
            end
        end

        Input.curr[vkey] = held
    end

    -- 扳机（LT/L2、RT/R2 单独处理）
    if joystick then
        local lt, rt = Input.readTriggers(joystick)
        Input.curr.trigger_l = Input.curr.trigger_l or lt
        Input.curr.trigger_r = Input.curr.trigger_r or rt

        -- 摇杆方向（和 DPAD OR 合并）
        local up, down, left, right = Input.readStick(joystick)
        Input.curr.up    = Input.curr.up    or up
        Input.curr.down  = Input.curr.down  or down
        Input.curr.left  = Input.curr.left  or left
        Input.curr.right = Input.curr.right or right
    end
end

function Input.held(vkey)         return Input.curr[vkey] end
function Input.justPressed(vkey)  return Input.curr[vkey] and not Input.prev[vkey] end
function Input.justReleased(vkey) return not Input.curr[vkey] and Input.prev[vkey] end
```

用法（用虚拟按键名，不关心物理硬件）：

```lua
function love.update(dt)
    Input.update()

    if Input.justPressed("attack") then
        player:attack()
    end
    -- 维吉尔长按近战蓄次元斩
    if Input.held("attack") and player.state == "judgement_cut_charge" then
        -- 继续蓄力
    end
    if Input.justReleased("attack") and player.state == "judgement_cut_charge" then
        -- 释放次元斩（完美释放看时机）
    end
end
```

### 1.5 图示

```
              帧1   帧2   帧3   帧4   帧5   帧6
按键实际状态:  松    按    按    按    松    松
─────────────────────────────────────────────────
justPressed:   .     ✓    .    .     .     .
held:          .     ✓    ✓    ✓     .     .
justReleased:  .     .    .    .     ✓     .
```

> **要点：** 大部分招式触发用 `justPressed`（边沿），持续动作（开枪连射、维吉尔长按近战蓄次元斩）用 `held`，蓄力释放（次元斩松开）用 `justReleased`。

---

## 第二章：按键缓冲 —— 记住过去几帧按了什么

### 2.1 为什么"刚按下"还不够

来看波动拳的配方：`↓ → ↘ + 拳`

玩家按"下"的那一帧，游戏根本不知道玩家接下来要按"右"。
你必须让"下"的信息**留住**，等"右"和"拳"来了，一起对比。

### 2.2 缓冲的核心思想：每个按键都有个"计数器"

MUGEN 的设计很巧妙。每个按键每帧都更新一个数字（叫 buffer 值）：

```
按住的第 1 帧   →  计数器 = 1
继续按住        →  计数器 = 2, 3, 4, ...
松开的那 1 帧   →  计数器 = -1
继续松开        →  计数器 = -2, -3, -4, ...
```

数字的含义：
- **正数 N** = 这键被按住了 N 帧。`1` 表示"本帧刚按下"。
- **负数 -N** = 这键被松开了 N 帧。`-1` 表示"本帧刚松开"。
- 数字永远不为 0（要么正在按，要么正在松）。

这一个数字就告诉你**全部状态**：

| 问题 | 怎么查 |
|---|---|
| 这键现在按着吗？ | `buffer > 0` |
| 这键本帧刚按下吗？ | `buffer == 1` |
| 这键本帧刚松开吗？ | `buffer == -1` |
| 这键按住多久了？ | `buffer` 本身 |
| 这键松开多久了？ | `-buffer` |

### 2.3 图示

```
帧号:          1    2    3    4    5    6    7    8
按键实际:      松   按   按   按   按   松   松   松
──────────────────────────────────────────────────────
buffer 值:    -1    1    2    3    4   -1   -2   -3

              ↑                       ↑
           刚松开                    刚按下
          (buffer=-1)              (buffer=1)
```

注意第 1 帧 buffer 是 -1（假设第 0 帧也是松开状态，第 1 帧还是松开，从"松"变"松"在 MUGEN 的实现里会持续递减）。这里简化了，重点是看边沿那两帧：`1` 和 `-1`。

### 2.4 Love2D 实现

```lua
local Buffer = {}
Buffer.keys = {
    "left", "right", "up", "down",   -- 绝对方向（走路用）
    "back", "fwd",                     -- 相对方向（命令用）
    "attack", "jump", "shoot", "lock", "special",
}

function Buffer.new()
    local self = {}
    for _, name in ipairs(Buffer.keys) do
        self[name] = 0   -- 初始 0（既没按也没松，特殊状态）
    end
    return self
end

function Buffer.update(self, snapshot)
    for _, name in ipairs(Buffer.keys) do
        local held = snapshot[name]          -- 从快照读按键状态
        local wasHeld = self[name] > 0

        if held ~= wasHeld then
            -- 状态翻转：刚按下写 1，刚松开写 -1
            self[name] = held and 1 or -1
        else
            -- 状态维持：按住就 +1，松开就 -1
            self[name] = self[name] + (held and 1 or -1)
        end
    end
end

-- 查询函数
function Buffer.isHeld(self, name)      return self[name] > 0  end
function Buffer.justPressed(self, name)  return self[name] == 1 end
function Buffer.justReleased(self, name) return self[name] == -1 end
function Buffer.heldFrames(self, name)   return math.max(0, self[name]) end
function Buffer.releasedFrames(self, name) return math.max(0, -self[name]) end
```

`Buffer.update` 接收一个 **snapshot**（输入快照）——一个 table，包含这一帧所有按键的 bool 状态。快照在主循环里组装（见第零章），把绝对方向（left/right）、相对方向（back/fwd，经过前后解析+SOCD）、按钮状态打包在一起。这样 Buffer 不直接访问 Input 层，只管"从快照更新计数器"。

组装快照的函数：

```lua
function buildInputSnapshot(input, back, fwd)
    return {
        -- 绝对方向（走路用）
        left    = input.held("left"),
        right   = input.held("right"),
        up      = input.held("up"),
        down    = input.held("down"),
        -- 相对方向（命令用，经过前后解析 + SOCD 解决）
        back    = back,
        fwd     = fwd,
        -- 按钮
        attack  = input.held("attack"),
        jump    = input.held("jump"),
        shoot   = input.held("shoot"),
        lock    = input.held("lock"),
        special = input.held("special"),
    }
end
```

每帧调用一次 `Buffer.update(buf, snapshot)`，buf 就持续记录所有按键的历史。

### 2.5 为什么这个设计这么好

你以后会看到，命令匹配里所有的判断，最终都归结为查 buffer 的值。一个数字代替了一堆 bool 和计时器，简洁又强大。

---

## 第三章：命令 —— 招式的"配方"

### 3.1 招式就是按顺序的按键序列

波动拳：`↓ → ↘ + 拳`，拆成三步：

```
步骤1: 按下"下"
步骤2: 同时按住"下"和"右"（这相当于"斜下"）
步骤3: 同时按住"右"和"拳"
```

每一步要么匹配，要么不匹配。三步按顺序都匹配了，招式就触发。

### 3.2 一个命令需要哪些字段

```lua
local hadouken = {
    name = "hadouken",
    time = 15,           -- 全局超时：整个招式必须在 15 帧内完成
    step_time = 15,      -- 单步超时：每步完成后 15 帧内必须接下一步（默认 = time，可单独设；对应 MUGEN steptime）
    buffer_time = 1,     -- 完成后保留 1 帧可触发
    steps = {
        -- 步骤 1: 按下"下"（边沿触发）
        {keys = {{name = "down"}}, hold = false, release = false},

        -- 步骤 2: 同时按住"下"和"右"
        -- 这里 down 用 hold=true 表示"还在按着"，right 用 hold=false 表示"刚按下"
        {keys = {{name = "down", hold = true},
                 {name = "right", hold = false}}, ...},

        -- 步骤 3: 同时按住"右"（hold）和"拳"（刚按下）
        {keys = {{name = "right", hold = true},
                 {name = "attack", hold = false}}, ...},
    },
}
```

### 3.3 修饰符：四种"按键方式"

MUGEN 用四个符号表示四种按键方式：

| 符号 | 名字 | 含义 | buffer 值检查 |
|---|---|---|---|
| 无 | 按下 | 这一帧刚按下 | `== 1` |
| `/` | 按住 | 正在被按住（多久都行） | `> 0` |
| `~` | 释放 | 这一帧刚松开 | `== -1` |
| `$` | 宽松 | 忽略对立方向冲突 | （后续讲） |

例子：

```
a        = 这一帧刚按下 a 键
/a       = a 键正在被按住（任意时长）
~a       = 这一帧刚松开 a 键
/30a     = a 键被按住至少 30 帧（蓄力）
~30a     = a 键按住 30 帧后松开（蓄力释放）
```

### 3.4 步骤之间的逻辑：AND / OR / 序列

- **逗号 `,`** = 序列（一帧一帧按顺序）
- **加号 `+`** = 同时（同一帧内同时满足）
- **竖线 `|`** = 或（任一满足即可）

```
D, F+a      = 先按 D，下一帧同时按 F 和 a（F+a 是一个 step）
a | b       = 按 a 或按 b 都行（一个 step，OR 逻辑）
```

### 3.5 `>` 跟随符：步骤之间不能乱按

`F, >F` 表示"按 F，然后**马上**再按 F，中间不能按别的"。

如果没有 `>`，玩家按 `F, F` 时，第一次按 F 可能同时满足两个步骤（这是 bug）。`>` 强制要求"两步之间没有其他按键翻转"。

### 3.6 完整命令定义例子

```lua
-- 波动拳：↓ ↘ → + 拳
local hadouken = {
    name = "hadouken",
    time = 20,           -- 20 帧内完成
    buffer_time = 1,
    steps = {
        {keys = {{name = "down"}}, hold = false, release = false},
        {keys = {{name = "down", hold = true},
                 {name = "right"}}, hold = false, release = false},
        {keys = {{name = "right", hold = true},
                 {name = "attack"}}, hold = false, release = false},
    },
}

-- 升龙拳：→ ↓ ↘ + 拳
local shoryuken = {
    name = "shoryuken",
    time = 20,
    buffer_time = 1,
    steps = {
        {keys = {{name = "right"}}, ...},
        {keys = {{name = "down"}}, ...},
        {keys = {{name = "down", hold = true},
                 {name = "right"}}, ...},
        {keys = {{name = "right", hold = true},
                 {name = "attack"}}, ...},
    },
}

-- 蓄力招：按住下 30 帧以上，然后松开下的同时按上 + 攻击
local flashKick = {
    name = "flash_kick",
    time = 60,
    buffer_time = 1,
    steps = {
        {keys = {{name = "down", hold = true, charge_time = 30}}, ...},
        {keys = {{name = "down", release = true},
                 {name = "up"}}, ...},
        {keys = {{name = "up", hold = true},
                 {name = "attack"}}, ...},
    },
}
```

---

## 第四章：命令匹配 —— 核心算法

### 4.1 每帧每个命令都要 step 一次

游戏每帧都对每个命令调用一次 `step()` 函数，更新它的"完成进度"。

```lua
function love.update(dt)
    Input.update()
    -- 组装输入快照（简化版，完整版见第零章主循环）
    local snapshot = buildInputSnapshot(Input, Input.held("left"), Input.held("right"))
    Buffer.update(buf, snapshot)

    for _, cmd in ipairs(commands) do
        Command.step(cmd, buf, hitstop_active)
    end

    -- 状态机查询哪些命令可用了
    if Command.isActive(hadouken) then
        player:hadouken()
    end
end
```

### 4.2 一个命令的字段

```lua
local cmd = {
    -- 配方（不变的）
    name = "hadouken",
    time = 15,           -- 全局超时：整条命令从第一个 step 完成到全部完成的总帧数上限
    step_time = 15,      -- 单步超时：每个 step 完成后多少帧内必须接下一步（默认 = time）
    buffer_time = 1,     -- 招式触发后能"留住"几帧
    steps = {...},

    -- 状态（每帧更新的）
    completed = {false, false, false},   -- 每个 step 是否完成
    step_timers = {0, 0, 0},             -- 每个 step 完成后过了几帧（和 completed 一一对应）
    cur_time = 0,         -- 第一个 step 完成后开始计时（全局超时用）
    cur_buffer_time = 0,  -- 招式触发后还剩多少帧可被触发
}
```

> **MUGEN 对应**：`time` = MUGEN 的 `command.time`（源码 `maxtime`），`step_time` = MUGEN 的 `steptime`（源码 `maxsteptime`）。MUGEN 里 `steptime` 可单独设，不设时默认等于 `time`（Ikemen-GO `compiler.go:8264`：`if cm.maxsteptime <= 0 { cm.maxsteptime = cm.maxtime }`）。`step_timers` 对应 MUGEN 的 `stepTimers[]` 数组。
>
> 区分两个超时：`time` 管"整条命令的总时长"，`step_time` 管"单步完成后多久必须接下一步"。大多数情况两者相等（用默认），但你可以让单步超时更短——比如全局 30 帧、单步 10 帧，要求每步之间不能停超过 10 帧但整条可以拖 30 帧。

### 4.3 step 函数的逻辑

```lua
function Command.step(cmd, buf, hitstop)
    -- 1. 递减 buffer_time（hitstop 时跳过递减，但后面 2-6 步照常执行！）
    --    hitstop 只影响"招式可用时间"的递减，不影响命令匹配本身
    if cmd.cur_buffer_time > 0 and not hitstop then
        cmd.cur_buffer_time = cmd.cur_buffer_time - 1
    end

    -- 2. 检查每个 step 是否过期
    local any_done = false
    for i, s in ipairs(cmd.steps) do
        if cmd.completed[i] then
            -- 已完成的 step，检查是否超时
            cmd.step_timers[i] = (cmd.step_timers[i] or 0) + 1
            if cmd.step_timers[i] > cmd.step_time then   -- 单步超时用 step_time（默认 = time，对应 MUGEN steptime）
                cmd.completed[i] = false
                cmd.step_timers[i] = 0
            else
                any_done = true
            end
        end
    end

    -- 3. 全局计时
    if any_done then
        cmd.cur_time = cmd.cur_time + 1
    elseif cmd.cur_time > 0 then
        -- 没有任何 step 完成，重置整个命令
        Command.reset(cmd)
    end

    -- 4. 匹配 step
    for i, s in ipairs(cmd.steps) do
        -- 前一个 step 必须先完成
        if i > 1 and not cmd.completed[i - 1] then
            -- skip
        else
            if Command.matchStep(s, buf) then
                cmd.completed[i] = true
                cmd.step_timers[i] = 0
                -- 清掉前一个 step（防止反向刷新）
                if i > 1 then
                    cmd.completed[i - 1] = false
                end
                -- 第一个 step 完成时启动全局计时
                if i == 1 then
                    cmd.cur_time = 0
                end
            end
        end
    end

    -- 5. 检查是否全部完成
    if cmd.completed[#cmd.steps] then
        -- 招式触发！设 buffer_time
        -- (hitstop and 1 or 0) 是 Lua 三元运算符（Lua 没有 ?: 语法）：
        --   hitstop 为 true  → 返回 1
        --   hitstop 为 false → 返回 0
        -- hitstop 时多给 1 帧，补偿 hitstop 结束瞬间被递减掉的那一帧，
        -- 否则玩家会因为 hitstop 反而少一帧缓冲时间
        cmd.cur_buffer_time = cmd.buffer_time + (hitstop and 1 or 0)
        Command.reset(cmd)  -- 清 completed 状态，准备下次
    end

    -- 6. 全局超时检查
    if cmd.cur_time >= cmd.time then
        Command.reset(cmd)
    end
end
```

**hitstop 期间各步骤的执行情况：**

上面 `Command.step` 有 6 步，hitstop 只影响第 1 步的递减，其余照常执行：

| 步骤 | hitstop 时是否执行 | 作用 |
|---|---|---|
| 1. 递减 cur_buffer_time | ⚠️ 跳过递减（但仍进入 if 判断，只是不 -1） | 控制"招式可用"的剩余时间 |
| 2. 检查 step 过期 | ✅ 跑 | 防止某个 step 完成后太久没接下一步 |
| 3. 全局计时 | ✅ 跑 | 命令整体超时控制 |
| 4. 匹配 step | ✅ 跑 | **核心**：检测玩家输入是否匹配命令配方 |
| 5. 触发招式 | ✅ 跑 | 全部 step 完成 → 设 cur_buffer_time |
| 6. 超时重置 | ✅ 跑 | 超时清掉命令进度 |

这就是第五章说的"hitstop 期间命令匹配照常跑，只是 cur_buffer_time 不递减"。为什么要这样设计？因为动作游戏需要**预输入**：你攻击 A 命中敌人触发 hitstop，角色冻住，但你的手继续搓招 B。如果 hitstop 时连命令匹配也停，B 全丢；如果匹配照跑但 cur_buffer_time 也照减，B 在 hitstop 期间就被减光过期了。正确做法是**匹配照跑 + cur_buffer_time 暂停递减**：B 在 hitstop 期间触发并被"留住"，等 hitstop 结束立即出招。

**为什么第 5 步 hitstop 时要多给 1 帧（`+1`）？**

因为 hitstop 期间 cur_buffer_time 不递减，但 hitstop 结束的**那一帧**会立刻递减 1。如果招式在 hitstop 期间触发，给 +1 是补偿 hitstop 结束瞬间被减掉的那帧，免得玩家因为 hitstop 反而少一帧缓冲。对应 Ikemen-GO 源码 `input.go:2598` 的 `c.curbuftime = Max(c.curbuftime, c.maxbuftime+extratime)`，`extratime` 就是那个 +1。

**帧序列图示：**

假设 `buffer_time = 5`，hitstop 持续 5 帧，命令在第 4 帧（hitstop 中）完成：

```
帧:           1    2    3    4    5    6    7    8    9   10
hitstop:      .    .    .    ▓    ▓    ▓    ▓    ▓    .    .
命令完成:     .    .    .    ✓    .    .    .    .    .    .
cur_buffer:   0    0    0    6    6    6    6    6    5    4
                                        ↑ hitstop 结束，开始递减
              ↑ 第4帧触发，设为 5+1=6（hitstop 时多 1 帧）
```

关键点：

- 第 4 帧（hitstop 中）命令完成 → `cur_buffer_time = 5 + 1 = 6`（匹配照跑，第 5 步照常触发）
- 第 4-8 帧（hitstop 期间）cur_buffer_time 一直是 6，**不递减**（第 1 步被 `not hitstop` 跳过）
- 第 9 帧（hitstop 结束）开始递减 → 6 变 5
- 如果当时没给 +1：cur_buffer_time 会是 5，hitstop 结束后立刻 -1 变 4，玩家"损失"一帧缓冲。+1 就是补偿这个

### 4.4 matchStep：一个 step 怎么算匹配

```lua
function Command.matchStep(step, buf)
    -- AND 逻辑：所有 key 都要满足
    for _, k in ipairs(step.keys) do
        if not Command.matchKey(k, buf) then
            return false
        end
    end
    return true
end

function Command.matchKey(k, buf)
    local v = buf[k.name]

    if k.release then
        -- ~ 释放：刚松开
        return v == -1
    elseif k.hold then
        -- / 按住：正在按（任意时长）
        if v <= 0 then return false end
        -- 检查蓄力时间
        if k.charge_time and v < k.charge_time then
            return false
        end
        return true
    else
        -- 按下：刚按下
        return v == 1
    end
end
```

### 4.5 同时按键：判断逻辑、容差与子集冲突

这一节专门讲"两个或多个键同时按"的识别逻辑——比如维吉尔的攻击+幻影剑一起按，或者大招"前+后+两个按键一起按"。这部分很重要，因为"同时按"的判断比序列按严格得多，而且会引发**子集冲突**问题。

#### 怎么判断"同时按"

`+` 把多个 key 放在**同一个 step**里，AND 逻辑：所有 key 必须同一帧都满足。回顾 §4.4 的 `matchKey`：

```lua
-- 无前缀的 key（如 a、b）：要求 buffer == 1（刚按下，边沿）
return v == 1

-- / 前缀的 key（如 /a）：要求 buffer > 0（按住，任意时长）
return v > 0
```

所以 `a+b` 的判断是：a 的 buffer == 1 **且** b 的 buffer == 1，两者同一帧都满足。

对应 Ikemen-GO 源码 `input.go:2528-2549`：

```go
// AND logic: all keys match
for _, k := range c.steps[i].keys {
    t := ibuf.State(k)
    if k.slash {
        keyOk = t > 0    // /前缀：按住即可
    } else {
        keyOk = t == 1   // 无前缀：必须刚按下（buffer==1）
    }
    if !keyOk {
        inputMatched = false
        break
    }
}
```

#### 容差是多少帧？答案：0 帧

Ikemen-GO/MUGEN 的 `a+b` 要求 a 和 b 在**同一帧**都处于 buffer==1（刚按下）状态，**没有容差**。

buffer 值的更新规则（`input.go:716-733`）：

```
帧 N（从未按→按）：  buffer = 1   ← 只有这一帧 t==1
帧 N+1（继续按）：    buffer = 2
帧 N+2（继续按）：    buffer = 3
...
```

所以如果 a 在帧 N 按下，b 在帧 N+1 按下：

```
帧:      N     N+1    N+2
a:       1     2      3      ← 帧 N 刚按下
b:       -     1      2      ← 帧 N+1 刚按下
a+b匹配:  ✗     ✗      ✗      ← 永远匹配不上！a 和 b 的 t==1 不在同一帧
```

**玩家物理上很难精确同一帧按两个键**（人手协调差异通常 20-50ms，一帧只有 16.67ms）。那怎么搓出 a+b？

#### 用 `/` 前缀放宽容差

MUGEN 的解法：用 `/`（按住）前缀放宽一个 key 的条件：

```
/a+b   =  a 按住（t>0） + b 刚按下（t==1）
```

玩家可以先按 a（按住），再按 b（刚按下），`/a+b` 就匹配。**容差无限**——只要 a 还在按住，b 随时按下都算：

```
帧:      N     N+1    N+2    N+3
a:       1     2      3      4     ← 帧 N 按下后持续按住
b:       -     -      1      2     ← 帧 N+2 刚按下
/a+b:    ✗     ✗      ✓      ✗     ← 帧 N+2 匹配！（a>0 且 b==1）
```

对应 MUGEN 命令字符串：

```mugen
[Command]
name = "a+b_relaxed"
command = /a+b        ; a 按住 + b 刚按下
```

**注意不对称性**：`/a+b` 是"a 先按，b 后按"；`a+/b` 是"b 先按，a 后按"。要支持两种顺序，定义两个命令：

```mugen
[Command]
name = "a_then_b"
command = /a+b

[Command]
name = "b_then_a"
command = a+/b
```

然后在 CNS 里两个命令都触发同一个 ChangeState。

**最宽松**的写法是 `/a+/b`（两个都按住即可，不限先后），但这就不要求"同时开始按"了——先按 a 等 30 帧再按 b 也匹配，通常不是想要的。

#### Love2D 实现：带自定义容差的同时按

如果你想要"两个键在 N 帧内都按下过"的有限容差（比 `/a+b` 严格，比 `a+b` 宽松），可以自己实现：

```lua
-- 自定义同时按判断：两个键在 tolerance 帧内都按下过
-- tolerance=0：严格同一帧（等同 a+b）
-- tolerance=N：两个键在 N 帧内都刚按下过
function Command.matchSimultaneous(keys, buf, tolerance)
    for _, k in ipairs(keys) do
        local v = buf[k.name]
        -- buffer 值：1=刚按下, 2=按下1帧前, 3=按下2帧前...
        -- buffer <= tolerance+1 表示在 tolerance 帧内按下过
        if v < 1 or v > tolerance + 1 then
            return false
        end
    end
    return true
end
```

但通常 MUGEN 风格的 `/a+b` 已经够用，不需要自定义容差。

#### 子集冲突问题

定义三个命令：

```
命令 attack        = a          priority=1  （单独按 a）
命令 summon_sword  = b          priority=1  （单独按 b）
命令 judgement_cut = a+b        priority=3  （同时按 a+b，大招）
```

玩家同一帧按下 a 和 b：

```
帧 N: a=1, b=1
  → attack 匹配 ✓        （a==1）
  → summon_sword 匹配 ✓  （b==1）
  → judgement_cut 匹配 ✓ （a==1 且 b==1）
```

**三个都匹配！** `a+b` 的输入是 `a` 和 `b` 的超集，所以 `a` 和 `b` 必然也匹配。如果不处理，玩家想放大招，结果普通攻击和幻影剑也触发了——完全乱套。

#### 解决方案 1：priority 字段（Love2D 推荐）

状态机按 priority 降序检查，匹配就 return：

```lua
local commands = {
    attack        = {priority = 1, ...},  -- 单独 a
    summon_sword  = {priority = 1, ...},  -- 单独 b
    judgement_cut = {priority = 3, ...},  -- a+b，priority 高
}

-- 状态机里按 priority 降序检查
for _, name in ipairs(sortedByPriority) do
    if Command.isActive(name) then
        self:setState(name)
        return  -- ★ 匹配就 return，不检查低 priority 命令
    end
end
```

同一帧三个命令都匹配（curbuftime 都 > 0），但状态机先查 judgement_cut（priority=3），匹配就 return，attack 和 summon_sword 没机会被检查。

**比 MUGEN 好的地方**：不用靠书写顺序，加新命令不用调整列表，priority 数字一眼看出谁优先。

#### 解决方案 2：MUGEN 的 trigger 顺序 + `command !=` 排除

MUGEN 靠 CNS 书写顺序和显式排除：

```mugen
; ★ a+b 必须写在 a 之前
[State -1, Judgement Cut]
type = ChangeState
value = 3000
trigger1 = command = "a+b"
trigger1 = ctrl

; ★ a 里排除 a+b
[State -1, Attack]
type = ChangeState
value = 200
trigger1 = command = "a"
trigger1 = command != "a+b"    ; 显式排除同时按
trigger1 = ctrl
```

缺点：靠作者记得调整顺序和加排除，忘了就出 bug（文档 §8.3 引用的 Vergil.cmd 注释就承认这个坑）。

#### 解决方案 3：完成时清理子集命令的 curbuftime

priority 解决了"当前帧谁触发"，但还有隐患：

```
帧 N:   a+b 匹配，judgement_cut curbuftime=5
        a 也匹配，attack curbuftime=5
        状态机查 judgement_cut（priority高）→ 切大招 → return
        attack 没被检查，但 curbuftime 还是 5

帧 N+1: 在大招状态里
        attack curbuftime=4（还 > 0）
        如果大招状态取消窗口允许 attack → 误触发！
```

所以命令完成时，要清掉低 priority 命令的 curbuftime。在 §9.6 的 `onComplete` 基础上加一行：

```lua
function Command.onComplete(cmd)
    cmd.cur_buffer_time = cmd.buffer_time
    Command.reset(cmd)

    for name, other in pairs(commands) do
        if name ~= cmd.name and other.type ~= "instant" then
            Command.reset(other)  -- 清 completed 进度（§9.6 已有）
            -- ★ 同时按键场景：清掉低 priority 命令的 curbuftime
            if other.priority < cmd.priority then
                other.cur_buffer_time = 0
            end
        end
    end
end
```

这样 a+b 完成后，attack（priority=1 < 3）的 curbuftime 被清成 0，下一帧不会误触发。而同级或高级命令的 curbuftime 保留，不影响预输入。

#### 大招场景：F+B+a+b

用户问的"前+后+两个按键一起按"：

```lua
local commands = {
    attack   = {priority = 1, steps = {{keys = {a}}}},           -- a
    f_a      = {priority = 2, steps = {{keys = {F, a}}}},        -- F+a
    fb_a     = {priority = 2, steps = {{keys = {F, B, a}}}},     -- F+B+a
    ultimate = {priority = 4, steps = {{keys = {F, B, a, b}}}},  -- F+B+a+b（大招）
}
```

玩家搓 F+B+a+b（同一帧四个键都按下）：

```
帧 N: F=1, B=1, a=1, b=1
  → attack 匹配 ✓     （a==1）
  → f_a 匹配 ✓        （F==1 且 a==1）
  → fb_a 匹配 ✓       （F==1 且 B==1 且 a==1）
  → ultimate 匹配 ✓   （F==1 且 B==1 且 a==1 且 b==1）
```

**四个都匹配**，但 priority 降序检查：先查 ultimate（priority=4）→ 匹配 → return。其他三个不会被检查。这就是"如何不被识别成前+后+第一个按键的技能"的答案：**给大招更高 priority，状态机先查大招，匹配就不查子集命令**。

注意：F+B+a+b 同一帧四个键都刚按下，物理上极难搓。实际可以用 `/F+/B+a+b` 放宽容差（F 和 B 按住，a 和 b 同时刚按下），或者拆成两步 `F+B, a+b`（先按 F+B，下一帧再按 a+b）。

#### 总结

| 问题 | 答案 |
|---|---|
| `a+b` 怎么判断 | 同一帧 a 和 b 都 buffer==1（都刚按下），AND 逻辑 |
| 容差几帧 | **0 帧**。必须同一帧都 t==1，没有容差 |
| 玩家搓不出来怎么办 | 用 `/a+b` 放宽：a 按住 + b 刚按下，容差无限 |
| `/a+b` 的不对称 | 只支持"a 先 b 后"。要双向各定义一个命令 |
| 子集冲突 | a+b 匹配时 a 和 b 也必然匹配 |
| Love2D 解决 | priority 字段，状态机降序检查，匹配就 return |
| MUGEN 解决 | trigger 书写顺序 + `command != "a+b"` 排除 |
| 完成时还要做什么 | 清掉低 priority 命令的 curbuftime，防下一帧误触发 |

### 4.6 完整流程图

```
每帧 love.update:
  │
  ├─ Input.update()         # 读硬件
  ├─ Buffer.update(buf, snapshot)  # 更新按键缓冲
  │
  ├─ for each cmd in commands:
  │    │
  │    ├─ 不在 hitstop → cur_buffer_time--
  │    │
  │    ├─ 清过期 step
  │    ├─ 全局计时 (cur_time)
  │    │
  │    ├─ for each step:
  │    │    └─ matchStep? → 标记 completed
  │    │
  │    ├─ 最后一个 step 完成?
  │    │    └─ 是 → cur_buffer_time = buffer_time
  │    │
  │    └─ cur_time >= time?
  │         └─ 是 → reset
  │
  └─ 状态机查 Command.isActive(cmd) → 角色行为
```

### 4.7 isActive 的实现

```lua
function Command.isActive(cmd)
    return cmd.cur_buffer_time > 0
end
```

就这么简单。招式触发后 `cur_buffer_time` 设为 `buffer_time`，然后每帧 -1（除非 hitstop），到 0 时触发器失效。

---

## 第五章：Hitstop —— 打中敌人时画面冻住

### 5.1 什么是 hitstop

打中敌人的瞬间，画面和角色都冻住几帧（通常 5-15 帧），增加打击感。这是动作游戏的灵魂。

```
帧:  1   2   3   4   5   6   7   8   9   10
状态: 正常 正常 命中 冻 冻 冻 冻 冻 正常 正常
                       └── hitstop ──┘
```

### 5.2 hitstop 期间输入怎么办？三个选择

| 方案 | 行为 | 问题 |
|---|---|---|
| A. 完全冻结输入 | 不读硬件，不更新缓冲 | 玩家连招中按的下一招丢了 |
| B. 完全不处理 | 一切照常，buffer_time 也递减 | 玩家想在 hitstop 中预输入下一招，但 hitstop 一结束招就过期了 |
| C. **读输入但不消耗 buffer_time**（MUGEN 的方案） | 输入照常进缓冲，命令匹配照常跑，但已完成命令的 buffer_time 不减 | 完美 |

### 5.3 为什么 MUGEN 方案好

格斗游戏和鬼泣都讲究"预输入"：你在出招 A 的时候，就已经在搓招 B 了。
hitstop 期间你的手不会停，但角色被冻住没法出招。
这时候你搓的招 B 应该**留住**，等 hitstop 一结束就马上出。

MUGEN 的实现：

```lua
function Command.step(cmd, buf, hitstop)
    -- 招式完成后保留的 buffer_time
    if cmd.cur_buffer_time > 0 and not hitstop then
        cmd.cur_buffer_time = cmd.cur_buffer_time - 1
    end
    -- ↑ 关键：hitstop 时不递减！

    -- 其余逻辑照常
    ...
end
```

### 5.4 图示：hitstop 期间命令的 buffer_time

假设命令 buffer_time = 5，hitstop 持续 5 帧，命令在 hitstop 前 1 帧完成：

```
帧:           1    2    3    4    5    6    7    8    9   10   11   12
hitstop:      .    .    .    ▓    ▓    ▓    ▓    ▓    .    .    .    .
cmd 完成:     .    .    ✓    .    .    .    .    .    .    .    .    .
cur_buffer:   0    0    5    5    5    5    5    5    4    3    2    1
                                                 ↑              ↑
                                            hitstop 结束    开始消耗
```

注意：hitstop 那 5 帧里 `cur_buffer` 一直是 5，没动。hitstop 结束后才开始 -1。

### 5.5 完整 Love2D hitstop 实现

```lua
local Game = {
    hitstop_frames = 0,  -- 剩余 hitstop 帧数
}

function Game.triggerHitstop(frames)
    Game.hitstop_frames = frames
end

function Game.update(dt)
    local in_hitstop = Game.hitstop_frames > 0

    -- 1. 输入总是更新（无论 hitstop）
    Input.update()
    local snapshot = buildInputSnapshot(Input, Input.held("left"), Input.held("right"))
    Buffer.update(buf, snapshot)

    -- 2. 命令总是 step（无论 hitstop）
    for _, cmd in ipairs(commands) do
        Command.step(cmd, buf, in_hitstop)
    end

    -- 3. 角色逻辑：hitstop 中不更新（冻住）
    if not in_hitstop then
        Player.update(player, dt)
    end

    -- 4. hitstop 倒计时
    if in_hitstop then
        Game.hitstop_frames = Game.hitstop_frames - 1
    end
end
```

### 5.6 攻击命中时触发 hitstop

```lua
function Player.attack(player)
    -- ... 攻击逻辑 ...
    -- 检测命中
    if hit_enemy then
        Game.triggerHitstop(8)  -- 冻 8 帧
    end
end
```

---

## 第六章：前后解析与 SOCD —— 同时按对立方向怎么办

### 6.1 前后解析：绝对方向 vs 相对方向

这是个容易被忽略但很重要的问题。键盘上的 `A` 键是"左"，`D` 键是"右"——这是**绝对方向**。但命令系统里的"前+前+攻击"用的是"前"——这是**相对方向**（相对于角色朝向）。

**为什么要区分**：

- **命令系统用相对方向（fwd/back）**：搓招"前+前+攻击"不管角色面朝哪边都应该触发。如果角色面向右，"前"=右；如果角色面向左，"前"=左。
- **走路用绝对方向（left/right）**：角色物理移动是绝对的。按 `D` 键角色向右走，不管角色面朝哪边。
- **SOCD 在相对方向上解决**：同时按"前"和"后"的冲突，是相对方向的冲突——玩家搓招时"前"和"后"短暂重叠。

**角色朝向由谁决定**：在鬼泣里，朝向通常由**锁定目标**决定——角色面向锁定的敌人。没锁定时保持当前朝向。

```lua
-- 每帧更新角色朝向（在输入解析之前）
function Player.updateFacing(player)
    if player.lock_target then
        -- 面向锁定的敌人
        if player.lock_target.x > player.x then
            player.facing = 1   -- 面向右
        else
            player.facing = -1  -- 面向左
        end
    end
    -- 没锁定时保持当前朝向
end
```

### 6.2 解析流程

```
Input 层（绝对方向）           Buffer 层（同时存绝对 + 相对）
  left / right                   left / right  ← 走路用
       │                         back / fwd    ← 命令用
       ▼                              ▲
  根据 player.facing 转换 ────────────┘
       │
       ▼
  back / fwd（相对方向）
       │
       ▼
  SOCD 在 back/fwd 上解决
```

1. Input 层读物理按键 → `left` / `right`（绝对）
2. 根据 `player.facing` 把 `left/right` 转成 `back/fwd`（相对）
3. SOCD 在 `back/fwd` 上解决
4. Buffer 同时存 `left/right`（绝对，走路用）和 `back/fwd`（相对，命令用）

### 6.3 代码实现

```lua
-- 把绝对方向转成相对方向
-- facing = 1 表示面向右，facing = -1 表示面向左
function Input.resolveFacing(left, right, facing)
    if facing > 0 then
        -- 面向右：右=前，左=后
        return left, right    -- back=left, fwd=right
    else
        -- 面向左：左=前，右=后
        return right, left    -- back=right, fwd=left
    end
end
```

Buffer 需要同时存绝对和相对方向：

```lua
local Buffer = {}
Buffer.keys = {
    "left", "right", "up", "down",   -- 绝对方向（走路用）
    "back", "fwd",                     -- 相对方向（命令用）
    "attack", "jump", "shoot", "lock", "special",
}
```

主循环的解析顺序：

```lua
function love.update(dt)
    -- 1. Input 层：读物理按键 → 绝对方向
    Input.update()

    -- 2. 更新角色朝向（根据锁定目标）—— 在输入解析之前
    Player.updateFacing(player)

    -- 3. 前后解析：绝对 → 相对
    local back, fwd = Input.resolveFacing(
        Input.held("left"), Input.held("right"), player.facing
    )

    -- 4. SOCD 在相对方向（fwd/back）上解决
    back, fwd = SOCD.resolveH(back, fwd)

    -- 5. 组装输入快照 + 更新 Buffer
    local snapshot = buildInputSnapshot(Input, back, fwd)
    Buffer.update(buf, snapshot)

    -- 6. 命令匹配（用 fwd/back）
    for _, cmd in pairs(commands) do
        Command.step(cmd, buf, hitstop > 0)
    end

    -- 7. 状态机（走路用 left/right，命令用 fwd/back）
    Player.update(player, dt, buf)
    ...
end
```

### 6.4 命令定义用 fwd/back

命令系统只用相对方向，不用绝对方向：

```lua
-- 前+前+攻击（不管角色面朝哪边都对）
local ff_slash = {
    steps = {
        {keys = {{name = "fwd"}}},
        {keys = {{name = "fwd"}}},
        {keys = {{name = "attack"}}},
    },
}

-- 蓄力招：按住后 30 帧，然后前+攻击（经典蓄力招）
-- 角色面向右时，后=左，前=右
-- 角色面向左时，后=右，前=左
local flash_kick = {
    steps = {
        {keys = {{name = "back", hold = true, charge_time = 30}}},
        {keys = {{name = "fwd"}}, {keys = {{name = "attack"}}}},
    },
}
```

### 6.5 走路用 left/right

走路是物理移动，用绝对方向：

```lua
function Player.update(player, dt, buf)
    -- 走路用绝对方向（left/right）
    if buf:held("left") then
        player.vx = -player.walkSpeed
    elseif buf:held("right") then
        player.vx = player.walkSpeed
    else
        player.vx = 0
    end

    -- 命令匹配用相对方向（fwd/back）—— 在 cancel_windows 里
    -- ... 见 §9.2 ...
end
```

### 6.6 SOCD 在相对方向上解决

现在 SOCD 改成在 `back/fwd` 上解决（不是 `left/right`）：

```lua
local SOCD = {mode = "last"}
SOCD.last_h = nil  -- "back" 或 "fwd"

function SOCD.resolveH(back, fwd)
    -- 跟踪最后按下的方向
    if back and not fwd then SOCD.last_h = "back"
    elseif fwd and not back then SOCD.last_h = "fwd"
    end

    -- 解决冲突
    if SOCD.mode == "last" and back and fwd then
        if SOCD.last_h == "back" then
            return true, false   -- 留 back
        else
            return false, true   -- 留 fwd
        end
    elseif SOCD.mode == "neutral" and back and fwd then
        return false, false
    end
    return back, fwd
end
```

**为什么在相对方向上解决**：同时按"前"和"后"是搓招时的冲突——玩家从"后"切换到"前"时短暂重叠。如果 SOCD 在绝对方向（left/right）上解决，角色转身后"前+后"对应的物理键变了，SOCD 的"后按优先"追踪会出错。

### 6.7 朝向变化时的行为

角色转身时（比如锁定目标移动到另一侧），`facing` 变了，`back/fwd` 的解析也变了：

```
角色面向右（facing=1）时，玩家按住 D 键（物理右）：
  → right = true, fwd = true（右=前）

角色转身面向左（facing=-1）：
  → right = true, back = true（右=后）
```

玩家按住同一个物理键，角色转身后"前/后"自动切换。这是对的——玩家按住"面向敌人的方向"始终是"前"。

### 6.8 MUGEN 的做法

MUGEN/Ikemen-GO 用 `fbFlip` 标志处理这个（`input.go:2801-2815`）：

```go
// 根据 fbFlip 把 L/R 转成 B/F
if char.fbFlip {
    B, F = R, L   // 朝向翻转：右=后，左=前
} else {
    B, F = L, R   // 正常朝向：左=后，右=前
}
// SOCD 在 B/F 上解决
U, D, B, F = cl.Buffer.InputReader.SocdResolution(U, D, B, F)
// 转回 L/R
if char.fbFlip {
    L, R = F, B
} else {
    L, R = B, F
}
```

`fbFlip` 由 `updateFBFlip` 每帧更新，根据角色朝向决定。和我们的 `player.facing` 一样的思路。

---

## 第七章：把所有东西串起来 —— 完整 Love2D 例子

下面是一个最小但完整的输入系统，可以直接跑。

```lua
-- ============================================
-- love2d_input_demo.lua
-- 一个完整的输入系统：缓冲 + 命令匹配 + hitstop
-- ============================================

-- ---------- 输入层 ----------
-- 虚拟按键定义
local VirtualKeys = {
    "left", "right", "up", "down",
    "attack", "jump", "shoot", "lock", "special",
}

-- 物理映射（简化版，完整版见 §1.1）
local keyboardMap = {
    left = "a", right = "d", up = "w", down = "s",
    attack = "j", jump = "k", shoot = "l",
    lock = "o", special = "i",
}

local Input = {prev = {}, curr = {}}

function Input.update()
    for _, vkey in ipairs(VirtualKeys) do
        Input.prev[vkey] = Input.curr[vkey] or false
        local kbKey = keyboardMap[vkey]
        Input.curr[vkey] = kbKey and love.keyboard.isDown(kbKey) or false
    end
    -- 手柄支持见 §1.4 完整实现
end

function Input.held(vkey)         return Input.curr[vkey] end
function Input.justPressed(vkey)  return Input.curr[vkey] and not Input.prev[vkey] end
function Input.justReleased(vkey) return not Input.curr[vkey] and Input.prev[vkey] end

-- ---------- 缓冲层 ----------
local Buffer = {}
Buffer.keys = {"left", "right", "up", "down",
                "attack", "jump", "shoot", "lock", "special"}

function Buffer.new()
    local b = {}
    for _, k in ipairs(Buffer.keys) do b[k] = 0 end
    return b
end

-- 组装输入快照（简化版，完整版见第零章 buildInputSnapshot）
local function buildSnapshot()
    local s = {}
    for _, name in ipairs(Buffer.keys) do
        s[name] = Input.held(name)
    end
    return s
end

function Buffer.update(b, snapshot)
    for _, name in ipairs(Buffer.keys) do
        local held = snapshot[name]
        local wasHeld = b[name] > 0
        if held ~= wasHeld then
            b[name] = held and 1 or -1
        else
            b[name] = b[name] + (held and 1 or -1)
        end
    end
end

-- ---------- 命令层 ----------
local Command = {}

function Command.new(def)
    local cmd = {
        name = def.name,
        time = def.time or 15,
        buffer_time = def.buffer_time or 1,
        steps = def.steps,
        completed = {},
        step_timers = {},
        cur_time = 0,
        cur_buffer_time = 0,
    }
    for i = 1, #cmd.steps do
        cmd.completed[i] = false
        cmd.step_timers[i] = 0
    end
    return cmd
end

function Command.reset(cmd)
    for i = 1, #cmd.steps do
        cmd.completed[i] = false
        cmd.step_timers[i] = 0
    end
    cmd.cur_time = 0
end

function Command.matchKey(k, b)
    local v = b[k.name]
    if k.release then
        return v == -1
    elseif k.hold then
        if v <= 0 then return false end
        if k.charge_time and v < k.charge_time then return false end
        return true
    else
        return v == 1
    end
end

function Command.matchStep(step, b)
    for _, k in ipairs(step.keys) do
        if not Command.matchKey(k, b) then return false end
    end
    return true
end

function Command.step(cmd, b, hitstop)
    -- 1. buffer_time 递减（hitstop 期间不递减！）
    if cmd.cur_buffer_time > 0 and not hitstop then
        cmd.cur_buffer_time = cmd.cur_buffer_time - 1
    end

    -- 2. step 过期检查
    local any_done = false
    for i = 1, #cmd.steps do
        if cmd.completed[i] then
            cmd.step_timers[i] = cmd.step_timers[i] + 1
            if cmd.step_timers[i] > cmd.time then
                cmd.completed[i] = false
                cmd.step_timers[i] = 0
            else
                any_done = true
            end
        end
    end

    -- 3. 全局计时
    if any_done then
        cmd.cur_time = cmd.cur_time + 1
    elseif cmd.cur_time > 0 then
        Command.reset(cmd)
    end

    -- 4. 匹配 step（从后往前，避免一次输入满足两步）
    for i = #cmd.steps, 1, -1 do
        if i == 1 or cmd.completed[i - 1] then
            if not cmd.completed[i] and Command.matchStep(cmd.steps[i], b) then
                cmd.completed[i] = true
                cmd.step_timers[i] = 0
                if i > 1 then cmd.completed[i - 1] = false end
                if i == 1 then cmd.cur_time = 0 end
            end
        end
    end

    -- 5. 完成判定
    if cmd.completed[#cmd.steps] then
        cmd.cur_buffer_time = cmd.buffer_time + (hitstop and 1 or 0)
        Command.reset(cmd)
    elseif cmd.cur_time >= cmd.time then
        Command.reset(cmd)
    end
end

function Command.isActive(cmd)
    return cmd.cur_buffer_time > 0
end

-- ---------- 游戏状态 ----------
local buf = Buffer.new()
local cmds = {
    -- 简单招：J J（按两次攻击）
    Command.new({
        name = "double_attack",
        time = 15, buffer_time = 2,
        steps = {
            {keys = {{name = "attack"}}},
            {keys = {{name = "attack"}}},
        },
    }),
    -- 波动拳：↓ → + J
    Command.new({
        name = "hadouken",
        time = 20, buffer_time = 2,
        steps = {
            {keys = {{name = "down"}}},
            {keys = {{name = "down", hold = true}, {name = "right"}}},
            {keys = {{name = "right", hold = true}, {name = "attack"}}},
        },
    }),
}
local hitstop = 0

function love.update(dt)
    Input.update()
    local snapshot = buildSnapshot()
    Buffer.update(buf, snapshot)

    local in_hitstop = hitstop > 0
    for _, cmd in ipairs(cmds) do
        Command.step(cmd, buf, in_hitstop)
    end

    -- 查询
    for _, cmd in ipairs(cmds) do
        if Command.isActive(cmd) then
            print("触发：" .. cmd.name)
            cmd.cur_buffer_time = 0  -- 消费掉
        end
    end

    -- hitstop 倒计时
    if in_hitstop then hitstop = hitstop - 1 end
end

function love.keypressed(key)
    if key == "escape" then love.event.quit() end
    -- 按 H 模拟命中触发 hitstop
    if key == "h" then hitstop = 8 end
end
```

把这段代码保存为 `main.lua`，用 Love2D 打开就能跑。按 `J J` 触发 double_attack，按 `↓ → J` 触发 hadouken，按 `H` 模拟 hitstop。

---

## 第八章：MUGEN 做横版鬼泣的限制

### 8.1 MUGEN 的核心假设

MUGEN 是为 1v1 平面格斗游戏设计的。它假设：

- 两个角色对打，左右站定
- 4 方向 + 4 对角 = 8 方向输入
- 6 个动作键（轻拳/重拳/轻脚/重脚 + Start + 等）
- 命令是"按键序列"
- 出招时间窗口短（15-30 帧）

### 8.2 鬼泣类游戏需要的输入

鬼泣/魔女/猎天使魔女这类游戏需要：

| 需求 | 例子 | MUGEN 能否满足 |
|---|---|---|
| 8 方向移动 | 推左摇杆走 | ✅（但 MUGEN 没有模拟轴） |
| 6-7 个动作键 | 攻击/跳/枪/特殊/锁定 | ✅（按键够用） |
| 长按蓄力 | 鬼泣的锁链拉拽 | ✅（用 `/30a` 这种） |
| 蓄力释放 | 蓄力后松开才发 | ✅（用 `~30a`） |
| 连段切换（同键多段） | 鬼泣连段三连击 | ✅ 靠 CNS state + trigger |
| 同时按键组合 | 锁定+攻击=挑空 | ✅ |
| 按住连射 | 鬼泣开枪连发 | ✅（用 held） |
| 模拟压力 | 推杆力度控制速度 | ❌ MUGEN 没有压力感应 |
| 长串复杂搓招 | 鬼泣高级连招十几步 | ⚠️ 能做但命令字符串会很长 |
| 缓冲下一招 | 出招中搓下一招 | ✅ MUGEN 自带（curbuftime） |
| 多招预输入队列 | 一次搓 3+ 招排队 | ❌ MUGEN 没有，需要自己加（高级特性） |
| 状态机切换连段风格 | 同样按键在不同状态下出不同招 | ✅ 靠取消窗口/trigger 实现 |

### 8.3 MUGEN 的具体限制（对你的实现有意义）

#### 限制 1：按键数量

MUGEN 只有 10 个逻辑按键：`a b c x y z s d w m`。鬼泣需要至少 6-7 个动作键（攻击/跳跃/枪/特殊/锁定/风格切换），勉强够用但很挤。

**Love2D 不限制**，你可以定义任意多按键。

#### 限制 2：连段切换（已解决）

鬼泣的连段切换（按攻击键 → 第1段 → 第2段 → 第3段）不需要单独的"节奏检测"。它本质就是 **cancel_windows 的应用**——每段攻击是一个 state，每个 state 有取消窗口，窗口内按攻击键就跳到下一段。

MUGEN 用 CNS 的 state + trigger 实现，Love2D 用 cancel_windows 数据表实现，思路完全一样。详见 §9.7。

#### 限制 3：没有"多招预输入队列"（但大多数情况不需要）

MUGEN 的 `command = "x"` 触发器只在 `curbuftime > 0` 时为真。`curbuftime` 默认 1 帧，所以 MUGEN 只支持"缓冲下一招"——你在当前招快出完时搓下一招，下一招的 curbuftime > 0，取消窗口打开时触发。

**这够用于格斗游戏和鬼泣的普通连段。** 只有一种情况不够：玩家想提前搓好 3+ 个招排队（比如鬼泣高端连招 A→B→C→D 一次搓完）。

如果真需要多招预输入，可以加意图队列。但这是高级特性，**建议先做 MUGEN 风格的 curbuftime 缓冲，不够用了再加**。详见 §9.2 和 §9.9。

#### 限制 4：命令优先级靠 trigger 顺序（容易出错）

MUGEN 里多个命令同时匹配时，靠 CNS trigger 的书写顺序处理（先写的先检查，第一个满足的赢）。Vergil.cmd 的注释自己承认这个坑（`Vergil.cmd:427-431`）：

```
; Note: The order of state entry is important.
;   State entry with a certain command must come before another state
;   entry with a command that is the subset of the first.
;   For example, command "fwd_a" must be listed before "a"
```

开发者忘了调整顺序就出 bug。Love2D 里**建议用显式 `priority` 字段**，比书写顺序更清晰：

```lua
local commands = {
    slash    = {priority = 1, ...},  -- 简单
    f_slash  = {priority = 2, ...},  -- 前+攻击
    ff_slash = {priority = 3, ...},  -- 前+前+攻击
}

-- 状态机里按 priority 降序检查
table.sort(allowed, function(a, b)
    return commands[a].priority > commands[b].priority
end)
```

加新命令不用调整列表顺序，一眼能看出谁优先。详见 §9.2。

#### 限制 5：没有模拟轴

MUGEN 把摇杆当成"4 个 bool"（上下左右），丢失了力度信息。鬼泣里推杆力度控制走路速度这种做不到。

**Love2D 直接读 `love.joystick.getAxis`**，可以拿到模拟值：

```lua
local lx, ly = love.joystick.getAxes(1)
-- lx, ly 是 [-1, 1] 的浮点数
local walkSpeed = math.abs(lx) * maxSpeed  -- 推得越多走得越快
```

#### 限制 6：命令字符串难以表达复杂逻辑

MUGEN 命令是字符串（`D, DF, F+x`）。一旦逻辑复杂（"如果按住锁定则命令A，否则命令B"）就要靠 state machine 拼接，可读性差。

**Love2D 用 Lua 表定义命令**，可以写函数、嵌套、条件，灵活得多。

---

## 第九章：如何扩展系统做鬼泣

### 9.1 我建议的扩展顺序

```
基础版（第七章代码）
    ↓
+ 命令优先级 + 取消窗口（MUGEN 风格，必备）
    ↓
+ 状态联动（不同状态允许不同命令，必备）
    ↓
+ 即时动作命令（幻影剑/开枪等不影响状态的技能，必备）
    ↓
+ 状态内输入检测（完美次元斩/红刀等状态内精确输入，必备）
    ↓
+ 长按蓄力 + 蓄力释放（charge_time + release）
    ↓
+ 模拟摇杆（love.joystick）
    ↓
+ 连段切换（就是 cancel_windows 的应用，§9.7）
    ↓
+ 风格/武器切换（鬼泣特色）
    ↓
（可选高级）输入意图队列：仅当真需要多招预输入时才加
```

**核心原则：先做 MUGEN 风格的简单版本，不要一上来就搞意图队列。** 大多数情况命令缓冲（curbuftime）就够用。

### 9.2 MUGEN 风格：命令缓冲 + 取消窗口 + 优先级字段

这是你应该**首先**实现的扩展，也是 MUGEN 自己用的机制。不需要意图队列、不需要冷却、不需要互斥组——靠三件事自然处理一切：

1. **每个命令有 `cur_buffer_time`**：匹配后保留几帧（你设的 `buffer_time`），每帧 -1，到 0 失效
2. **每个状态有"取消窗口"**：定义当前状态在哪几帧、什么条件下允许跳到哪些招
3. **每个命令有显式 `priority` 字段**：多个命令同时在 buffer 时，priority 高的赢。比 MUGEN 靠 trigger 书写顺序更清晰

#### 为什么需要显式 priority 字段

MUGEN 靠 CNS state entry 的书写顺序处理优先级——复杂命令写前面，简单命令写后面。Vergil.cmd 的注释自己承认这个坑（`Vergil.cmd:427-431`）：

```
; Note: The order of state entry is important.
;   State entry with a certain command must come before another state
;   entry with a command that is the subset of the first.
;   For example, command "fwd_a" must be listed before "a", and
;   "fwd_ab" should come before both of the others.
```

开发者忘了调整顺序就出 bug。用显式 `priority` 字段干净得多——加新命令不用调整列表，一眼能看出谁优先。

#### 为什么这样就能工作

先回答一个新手常问的问题：**"玩家搓了 `F+a`（slash），然后又按了一下 `a`（触发 double_slash 的第二步），slash 会不会重复触发？"**

会，但**根本不影响**。因为：

```
帧 3: slash 匹配，cur_buffer_time = 5
帧 4: 状态机检查取消窗口，发现 slash 可用 → ChangeState 到 attack_1
      状态变成 attack_1，不再是 stand
帧 5+: 即便 slash 又匹配了，cur_buffer_time 又是 5
      但当前状态是 attack_1，它的取消窗口只查 double_slash，不查 slash
      slash 的 cur_buffer_time 自然衰减到 0
      完全没影响
```

**状态机消费一次就走了，状态变了原命令就没人查。** 这就是 MUGEN 设计的优雅之处——不需要任何"冷却"或"互斥组"，靠状态变化自然处理。

#### 完整实现

```lua
-- ============================================
-- 命令定义：每个命令有 buffer_time 和 priority
-- 不同招式可以配不同 buffer_time（大招给更长）
-- priority：复杂命令高，简单命令低
-- ============================================
local commands = {
    slash = {
        priority = 1,     -- 简单：单按攻击
        buffer_time = 5,
        steps = {{{name = "attack"}}},
        cur_buffer_time = 0,
        -- ... 其他字段（completed, cur_time 等）
    },
    f_slash = {
        priority = 2,     -- 中等：前+攻击
        buffer_time = 5,
        steps = {{{name = "right", hold = true}, {name = "attack"}}},
        cur_buffer_time = 0,
    },
    ff_slash = {
        priority = 3,     -- 复杂：前+前+攻击
        buffer_time = 5,
        steps = {{{name = "right"}}, {{name = "right"}}, {{name = "attack"}}},
        cur_buffer_time = 0,
    },
    hadouken = {
        priority = 4,     -- 最复杂：搓招
        buffer_time = 8,  -- 必杀技给更长缓冲
        steps = {
            {{name = "down"}},
            {{name = "down", hold = true}, {name = "right"}},
            {{name = "right", hold = true}, {name = "attack"}},
        },
        cur_buffer_time = 0,
    },
}

-- ============================================
-- 状态定义：每个状态有取消窗口
-- allowed 列表顺序无所谓，priority 决定优先级
-- 这是状态机的职责，不是输入系统的
-- ============================================
local states = {
    stand = {
        cancel_windows = {
            -- stand 任何时候都能起手任何招
            {start = 0, finish = math.huge,
             allowed = {"hadouken", "ff_slash", "f_slash", "slash"}},
        },
    },
    attack_1 = {
        total_frames = 30,
        cancel_windows = {
            -- attack_1 第 8-15 帧允许取消到 double_slash 或 slash
            {start = 8, finish = 15,
             allowed = {"f_slash", "slash"}},
        },
    },
    attack_2 = {
        total_frames = 35,
        cancel_windows = {
            {start = 10, finish = 20, allowed = {"slash"}},
        },
    },
}

-- ============================================
-- 玩家更新：每帧检查取消窗口
-- ============================================
function Player.update(player, dt)
    local state = states[player.state]

    -- 1. 检查当前状态的所有取消窗口
    for _, window in ipairs(state.cancel_windows or {}) do
        if player.frame >= window.start and player.frame <= window.finish then
            -- 按 priority 降序排（高优先级先检查）
            local sorted = {}
            for _, name in ipairs(window.allowed) do
                table.insert(sorted, name)
            end
            table.sort(sorted, function(a, b)
                return commands[a].priority > commands[b].priority
            end)

            -- 检查 condition（见下一节）
            local cond_ok = Command.checkCondition(window, player)
            if cond_ok then
                for _, name in ipairs(sorted) do
                    if commands[name].cur_buffer_time > 0 then
                        player:setState(name)
                        return  -- 切了状态，本帧结束
                    end
                end
            end
        end
    end

    -- 2. 没取消，推进当前状态
    player.frame = player.frame + 1
    if state.total_frames and player.frame >= state.total_frames then
        player:setState("stand")
    end
end

function Player.setState(player, new_state)
    player.state = new_state
    player.frame = 0
end
```

**关键点：**

1. **`priority` 字段决定优先级**——复杂命令 priority 高，简单命令 priority 低。状态机按 priority 降序检查，第一个 `cur_buffer_time > 0` 的赢。`allowed` 列表顺序无所谓。
2. **`cur_buffer_time` 自然管理过期**——命令匹配后保留几帧，没人消费就衰减到 0。不需要意图队列，不需要冷却。
3. **状态变化解决重复匹配**——一旦切状态，原命令没人查，`cur_buffer_time` 自然过期。

#### 处理顺序

每帧的完整流程（这和 MUGEN 的 `commandUpdate → actionRun` 顺序一致）：

```
1. Input.update()              → 读硬件
2. Buffer.update()             → 更新按键缓冲（每按键的有符号计数器）
3. for each command:
     Command.step()            → 更新命令匹配，设 cur_buffer_time
                                （这一步只管"哪些命令当前为真"，
                                  完全不知道状态机的事）
4. Player.update()             → 状态机
   a. 查当前 state 的 cancel_windows
   b. 在窗口内，按 priority 找第一个 cur_buffer_time > 0 的命令
   c. 找到 → setState(命令名) → 进入新状态
   d. 没找到 → 推进当前状态帧数
```

**关键分离：第 3 步和第 4 步是解耦的。** 命令匹配只管"玩家搓了什么"，状态机只管"当前能不能用"。

#### 连段场景演示

玩家做 attack_1 → attack_2 → attack_3 三连段：

```
帧:     1   2   3   4   5   6   7   8   9  10  ...
玩家按:  A   .   .   .   .   .   .   A   .   .
                └ attack_1 取消窗口 [8-15] 在帧 8 打开

帧 1: 玩家按 A → slash 匹配，cur_buffer_time=5
      stand 状态的取消窗口检查到 slash → ChangeState 到 attack_1

帧 7: 玩家提前按 A（预输入）→ double_slash 的 step1 匹配
      但 double_slash 的 step2 还没匹配，cur_buffer_time 还是 0
      attack_1 取消窗口 [8-15] 还没开（当前帧 7），不消费

帧 8: attack_1 进入取消窗口
      检查 allowed = {"double_slash", "slash"}
      double_slash 的 cur_buffer_time 还是 0（step2 没匹配）
      slash 的 cur_buffer_time 已经衰减到 0 了
      没消费，attack_1 继续

帧 8+?: 玩家按第二个 A → double_slash 完成，cur_buffer_time=5
       attack_1 取消窗口还开着 → 消费 double_slash → ChangeState 到 attack_2
```

注意：这里玩家**必须等 attack_1 的取消窗口打开后再搓第二招**——这就是"缓冲下一招"。如果玩家想帧 1 就搓好三个招排队，那才需要意图队列（见 §9.9）。

#### 防止借用：命令完成时清掉其他命令的进度

这是命令匹配里一个很重要但容易踩坑的问题。先说清楚什么是"借用"。

##### 什么是"借用"问题

**比喻**：每个命令有自己的"进度条"（`completed` 数组），记录"第几个 step 已经匹配了"。所有命令读的是**同一份 InputBuffer**——同一份按键历史。所以命令A 用过的按键，命令C 也能读到，命令C 的进度条会"偷偷往前走"。

**具体场景**：

- 命令A = `F+B+a`（前+后+攻击，同时按，一个 step）
- 命令B = `F+a`（前+攻击，玩家想搓的）
- 命令C = `F, F, a`（前、前、攻击，三个 step 序列）

玩家先搓命令A，再搓命令B。输入序列是 `F, B, a, F, a`：

```
帧:    1    2    3    4    5    6    7
F:     1    2    3    4   -1    1    2    (帧1按, 帧5松, 帧6按)
B:    -1    1    2   -1   -2   -3   -4    (帧2按, 帧4松)
a:    -1   -2    1    2   -1    1    2    (帧3按, 帧5松, 帧6按)
```

看命令C（`F, F, a`）的进度条会怎么走：

```
帧1: F=1 → 命令C 的 step1(第一个F) 匹配 ✓  进度条: [✓, _, _]
       注意: 这个 F 是命令A 用的! 命令C "偷"了它
帧3: 命令A(F+B+a) 完成 ✓
帧6: F=1 → 命令C 的 step2(第二个F) 匹配 ✓  进度条: [_, ✓, _]
帧7: a=1 → 命令C 的 step3(a) 匹配 ✓       进度条: [_, _, ✓]
       命令C 完成! ← 误触发! 玩家根本没想搓命令C
```

**问题**：命令C 的 step1 偷了命令A 的 F（帧1）。命令A 完成后，命令C 的进度条还挂在 `[✓, _, _]`，等 step2。玩家搓命令B 时的 F 和 a 又满足了 step2 和 step3，命令C 误触发。

##### 解决方案：命令完成时清掉其他命令的进度条

**思路很简单**：命令A 完成时，把**其他所有命令**的进度条（`completed` 数组）清零。这样命令C 不能"继承"命令A 完成前的输入，必须从头开始匹配。

```lua
-- 命令完成时的处理
function Command.onComplete(cmd)
    -- 1. 设自己的 cur_buffer_time（让触发器为真）
    cmd.cur_buffer_time = cmd.buffer_time
    -- 2. 清自己的 step 进度（准备下次匹配）
    Command.reset(cmd)

    -- 3. ★ 关键：清掉其他命令的 step 进度（防止借用）
    for name, other in pairs(commands) do
        if name ~= cmd.name and other.type ~= "instant" then
            -- 清 completed 数组和 cur_time，但不清 cur_buffer_time
            -- (已完成的命令照常可用，只是未完成的要重新开始)
            Command.reset(other)
        end
    end
end

function Command.reset(cmd)
    for i = 1, #cmd.steps do
        cmd.completed[i] = false
        cmd.step_timers[i] = 0
    end
    cmd.cur_time = 0
    -- 注意：不清 cur_buffer_time
end
```

**关键点**：
- 清的是 `completed`（step 进度）和 `cur_time`（全局计时）
- **不清** `cur_buffer_time`（已完成的命令照常可用）
- **不清** `InputBuffer`（按键历史不动，只是命令要重新匹配）
- 即时命令（`type = "instant"`）不清（它们不走 step 匹配）

##### 清零后的效果

同样的场景，命令A 完成时清掉命令C 的进度条：

```
帧1: F=1 → 命令C step1 匹配 ✓  进度条: [✓, _, _]
帧3: 命令A 完成 ✓
     → 清掉命令C 的进度条!  进度条: [_, _, _]  ← 重置!
帧6: F=1 → 命令C step1 重新匹配 ✓  进度条: [✓, _, _]
帧7: a=1 → 命令C step2 需要第二个 F 边沿
     但 F 在帧6 按下后持续按住(buffer=2)，不是边沿
     → step2 不匹配 ✗
命令C 不完成 ✓ (没有误触发!)
```

**为什么 step2 不匹配**：命令C 从 step1 重新开始。帧6 的 F 满足 step1，但 step2 需要**另一个** F 边沿。玩家搓命令B 时只按了一次 F（帧6），没有第二个 F 边沿，命令C 的 step2 匹配不到。

##### 为什么这比 `>` 跟随符好

`>` 跟随符也能防止借用，但它**太严格**——会限制预输入和即时命令插入。对比：

**场景：搓命令A（`F, B, a`）过程中插入 jc（跳跃取消）**

| 方案 | 命令A 能完成吗 | 原因 |
|---|---|---|
| 不用 `>`，不用清零 | ✅ 能 | jc 不影响命令A（命令A 不查其他键） |
| 用 `>`（`F, >B, >a`） | ❌ 不能 | jc 按键的释放边沿让 `>B` 失败 |
| 不用 `>`，用清零 | ✅ 能 | jc 不影响命令A；命令A 完成后清其他命令进度 |

**场景：搓命令A 过程中插入幻影剑**

| 方案 | 命令A 能完成吗 | 幻影剑能 spawn 吗 |
|---|---|---|
| 不用 `>`，用清零 | ✅ 能 | ✅ 能（即时命令走边沿触发，不影响命令A） |
| 用 `>` | ❌ 不能 | ✅ 能（但命令A 失败了） |

**清零方案的最大好处**：不限制预输入，不影响即时命令。它只在命令**完成时**清其他命令的进度，是个"事后清理"动作，不影响搓招过程。

##### 完整的 Command.step 集成

```lua
function Command.step(cmd, buf, hitstop)
    -- 1. cur_buffer_time 递减（hitstop 期间不减）
    if cmd.cur_buffer_time > 0 and not hitstop then
        cmd.cur_buffer_time = cmd.cur_buffer_time - 1
    end

    -- 2. step 过期检查、全局计时（同 §9.2）
    -- ...

    -- 3. step 匹配（同 §9.2，不用 > 跟随符）
    -- ...

    -- 4. 完成判定
    if cmd.completed[#cmd.steps] then
        -- 完成！调 onComplete 处理借用
        Command.onComplete(cmd)
    elseif cmd.cur_time >= cmd.time then
        Command.reset(cmd)
    end
end

function Command.onComplete(cmd)
    cmd.cur_buffer_time = cmd.buffer_time + (hitstop and 1 or 0)
    Command.reset(cmd)

    -- ★ 清掉其他命令的 step 进度（防止借用）
    for name, other in pairs(commands) do
        if name ~= cmd.name and other.type ~= "instant" then
            Command.reset(other)
        end
    end
end
```

##### 什么时候不清

两种情况不清其他命令的进度：

1. **即时命令（`type = "instant"`）完成时不清**——即时命令（幻影剑、开枪）频繁触发，如果每次都清其他命令进度，会导致搓招中插入幻影剑时其他命令的进度被清。即时命令本身不"借用"其他命令的输入（它是边沿触发 + spawn），所以不需要清。

2. **被清的命令如果是即时命令，也不清它**——即时命令没有 step 进度，清了也没意义。

```lua
function Command.onComplete(cmd)
    -- 即时命令完成不清其他命令（频繁触发会干扰搓招）
    if cmd.type == "instant" then
        cmd.cur_buffer_time = 0  -- 即时命令的 cur_buffer_time 立刻清
        return
    end

    -- 状态切换命令完成，清其他状态切换命令的进度
    cmd.cur_buffer_time = cmd.buffer_time
    Command.reset(cmd)
    for name, other in pairs(commands) do
        if name ~= cmd.name and other.type ~= "instant" then
            Command.reset(other)
        end
    end
end
```

##### 再举一个例子：连段中插入幻影剑

维吉尔做 `attack_1 → attack_2` 连段，中间插入幻影剑：

```
帧:    1    2    3    4    5    6    7
attack: A    .    .    .    A    .    .     (帧1按A, 帧5按A)
special: .   .    S    .    .    .    .     (帧3按幻影剑)

命令:
  slash (attack)        = {type="state_change", ...}
  double_slash (A, A)   = {type="state_change", ...}
  phantom_sword (special) = {type="instant", ...}

帧1: attack 按下 → slash 完成
     → 清其他 state_change 命令的进度（double_slash 的 step1 被清）
     → 状态机 ChangeState 到 attack_1
帧3: special 按下 → phantom_sword 边沿触发 → spawn 幻影剑
     → phantom_sword 是即时命令，不清其他命令进度
     → attack_1 状态继续（幻影剑不影响角色状态）
帧5: attack 按下 → double_slash 完成（step1 和 step2 都匹配）
     → 清其他 state_change 命令的进度
     → 状态机 ChangeState 到 attack_2
```

**关键**：
- 帧3 幻影剑触发时**不清其他命令进度**（即时命令不清）
- 帧3 幻影剑不影响 attack_1 状态（即时命令不进状态机）
- 帧5 double_slash 的 step1 和 step2 都匹配（玩家按了两次 A）
- 连段正常进行，幻影剑和连段互不干扰

##### 总结

| 问题 | 解决方式 |
|---|---|
| 命令C 借用命令A 的输入 | 命令A 完成时清掉命令C 的 step 进度 |
| 清零会不会影响正常搓招 | 不会——只清 step 进度，不清 InputBuffer |
| 清零会不会影响即时命令 | 不会——即时命令不走 step 匹配 |
| 即时命令完成时要清吗 | 不清——即时命令频繁，清了会干扰搓招 |
| 已完成命令的 cur_buffer_time 要清吗 | 不清——已完成的命令照常可用 |

**一句话总结**：状态切换命令完成时，把其他状态切换命令的"进度条"清零，防止它们偷用刚完成命令的输入。即时命令和 InputBuffer 都不动。

#### 取消窗口的条件字段：condition

上面的 cancel_window 只有 `start/finish/allowed`，但真实游戏的取消窗口还需要**条件**——比如"仅命中时能取消"、"仅地面时能取消"。加一个 `condition` 字段处理。

| condition | 含义 | 对应 MUGEN |
|---|---|---|
| `"always"` | 任何情况都能取消 | 无 movecontact 条件 |
| `"on_hit"` | 仅命中时能取消 | `movecontact` 或 `movehit` |
| `"on_block"` | 仅被防御时能取消 | `moveguarded` |
| `"whiff"` | 仅未命中时能取消 | `!movecontact` |

鬼泣一般 `"always"` 就够（whiff cancel 是动作游戏手感的关键），但 `"on_hit"` 给特殊招用（比如"命中才派生"的招）。

还可以加 `extra_condition` 函数处理更复杂的条件（位置、状态等）。

#### Vergil.cmd 实例映射

看 Vergil.cmd 的实际写法（`Vergil.cmd:458-468`）：

```ini
; 某个必杀技的取消条件
trigger1 = ctrl                                          ; 站立时直接出
trigger2 = (stateno = [400,420]) && movecontact          ; 400-420 状态命中时
trigger3 = (stateno = [200,202]) && movecontact          ; 200-202 状态命中时
trigger4 = (stateno = [210,212]) && movecontact          ; 210-212 状态命中时
trigger5 = (stateno = [300,305]) && movecontact          ; 300-305 状态命中时
trigger6 = stateno = 350 && movehit                      ; 350 状态命中时
trigger9 = stateno = 620 && pos y >= 0 && movecontact    ; 620 空中攻击落地命中时
```

还有 `Vergil.cmd:748`：
```ini
trigger10 = stateno = 5120 && time >= 3                  ; 5120 状态第 3 帧后
```

这就是 MUGEN 的 cancel window。每个 trigger 是一条独立的取消条件：`stateno` 决定当前状态、`movecontact`/`movehit` 是命中条件、`time >= N` 是时间下限、`pos y >= 0` 是位置条件。

映射到 Love2D 的 cancel_windows：

```lua
-- 400-420 都是轻攻击系列，共享同一个 cancel window
light_attack = {
    total_frames = 25,
    cancel_windows = {
        {
            start = 5, finish = 20,
            allowed = {"medium_attack", "heavy_attack", "special"},
            condition = "on_hit",  -- 仅命中时能取消（对应 movecontact）
        },
    },
}

-- 5120 是受击恢复状态
hit_recovery = {
    total_frames = 30,
    cancel_windows = {
        {
            start = 3, finish = math.huge,  -- 第 3 帧后（对应 time >= 3）
            allowed = {"guard", "dash"},
            condition = "always",
        },
    },
}

-- 空中攻击
air_attack = {
    total_frames = 30,
    cancel_windows = {
        {
            start = 8, finish = 25,
            allowed = {"air_dash", "double_jump"},
            condition = "always",
            -- 额外条件：必须还在空中（对应 pos y >= 0）
            extra_condition = function(player)
                return player.y < 0
            end,
        },
    },
}
```

#### condition 的实现

```lua
function Command.checkCondition(window, player)
    if not window.condition or window.condition == "always" then
        return true
    elseif window.condition == "on_hit" then
        return player.last_attack_hit       -- 你需要维护这个标志
    elseif window.condition == "on_block" then
        return player.last_attack_blocked
    elseif window.condition == "whiff" then
        return not player.last_attack_hit and not player.last_attack_blocked
    end
    -- 额外条件
    if window.extra_condition then
        return window.extra_condition(player)
    end
    return true
end

-- 在 Player.update 里调用（前面完整实现里已经用了）
-- if cond_ok then
--     for _, name in ipairs(sorted) do ...
-- end
```

`player.last_attack_hit` 这种标志需要在攻击命中时设置、新状态进入时清零，你自己维护。

### 9.3 状态联动：用全局命令 + 取消窗口，不要每状态独立命令列表

鬼泣里"按攻击"在不同状态下出不同招（地面连段第 1 段 vs 第 2 段 vs 空中攻击 vs 锁定时挑空）。

**错误做法**（我之前写过）：每个状态有自己的命令列表。这样会导致命令缓冲在状态切换时丢失，玩家在 stand 状态搓的招切到 attack_1 状态后就没了。

**正确做法**：**命令全局共享，每个状态用"取消窗口"控制允许哪些命令**。

```lua
-- 命令是全局的，所有状态共享同一个 buffer
-- priority 字段同 9.2，复杂命令高、简单命令低
local commands = {
    slash       = {priority = 1, buffer_time = 5, ...},
    air_slash   = {priority = 1, buffer_time = 5, ...},
    launch      = {priority = 2, buffer_time = 5, ...},  -- 挑空
    jump        = {priority = 1, buffer_time = 2, ...},
}

-- 每个状态定义自己的取消窗口（允许哪些命令）
-- 不同状态的 allowed 互不相关，各管各的
local states = {
    stand = {
        cancel_windows = {
            {start = 0, finish = math.huge,
             allowed = {"slash", "jump", "launch"},
             condition = "always"},
        },
    },
    air = {
        cancel_windows = {
            {start = 0, finish = math.huge,
             allowed = {"air_slash"},
             condition = "always",
             -- 空中状态额外条件：必须还在空中
             extra_condition = function(p) return p.y < 0 end},
        },
    },
    locked_on = {
        cancel_windows = {
            -- 锁定时 launch 优先级高于 slash（通过 priority 字段）
            {start = 0, finish = math.huge,
             allowed = {"launch", "slash"},
             condition = "always"},
        },
    },
    attack_1 = {
        total_frames = 30,
        cancel_windows = {
            -- 连段取消：第 8-15 帧允许取消到 slash
            -- 鬼泣 whiff 也能 cancel，所以 condition = "always"
            -- 如果想要"命中才能取消"，改成 condition = "on_hit"
            {start = 8, finish = 15, allowed = {"slash"},
             condition = "always"},
        },
    },
}

-- Player.update 完全用 9.2 的实现（priority 排序 + condition 检查）
-- 不需要重复写
```

**关键：所有命令的 `cur_buffer_time` 是全局的，状态切换不清零。** 玩家在 stand 状态搓了 slash，切到 attack_1 状态后如果取消窗口允许 slash，照样能用。

这就是 MUGEN 的设计——命令系统是全局的，状态机通过 trigger 选择性查询。

### 9.4 即时动作命令：不影响状态的发射技能

前面讲的命令都走 cancel_windows，匹配后**进入新状态**。但鬼泣里有一类技能**不影响角色状态**——发射后角色继续当前动作，发射物自己飞出去。比如：

- **维吉尔的幻影剑**：按特殊键召唤幻影剑飞出，维吉尔自己继续挥刀
- **尼禄的蓝拳**：蓄力释放蓝色冲击波，尼禄自己继续当前动作
- **但丁的开枪**：按枪键开枪，但丁可以边走边射

这类技能**不走状态机**，走单独的"即时动作"路径。

#### 三种命令类型

先区分清楚命令有三种类型（走命令系统的）：

| 类型 | 例子 | 是否进状态机 | 处理方式 |
|---|---|---|---|
| **状态切换命令** | 攻击、跳跃、冲刺 | ✅ 进 | 走 cancel_windows（§9.2） |
| **即时动作命令** | 幻影剑、蓝拳、开枪 | ❌ 不进 | 边沿触发 + spawn 发射物 |
| **切换类命令** | 武器切换、风格切换 | 看情况 | 见 §9.8 |

**关键：不是所有命令都要走状态机。** 幻影剑这类"发射后不影响角色"的技能，走的是另一条路径。

**注意**：还有一种**不走命令系统**的输入处理方式——状态内输入检测（完美次元斩、红刀），见 §9.5。

#### 命令定义：加 type 字段

```lua
local commands = {
    -- 状态切换命令：走 cancel_windows，进入新状态
    slash = {
        type = "state_change",
        priority = 1,
        buffer_time = 5,
        steps = {{{name = "attack"}}},
        cur_buffer_time = 0,
    },

    -- 即时动作命令：边沿触发，不进状态，直接 spawn
    phantom_sword = {
        type = "instant",
        priority = 1,
        buffer_time = 3,
        cooldown = 20,  -- 20 帧冷却，防止连按 spam
        steps = {{{name = "special"}}},
        cur_buffer_time = 0,
    },
    blue_rose = {
        type = "instant",
        priority = 1,
        buffer_time = 3,
        cooldown = 10,  -- 开枪冷却短
        steps = {{{name = "shoot"}}},
        cur_buffer_time = 0,
    },
}
```

#### 即时命令的处理：边沿触发 + 冷却 + spawn

```lua
local instant_cooldowns = {}  -- 命令名 → 剩余冷却帧

function updateInstantCommands(player, hitstop)
    for name, cmd in pairs(commands) do
        if cmd.type == "instant" then
            -- 冷却倒计时（hitstop 期间不减，和 cur_buffer_time 一致）
            if instant_cooldowns[name] and instant_cooldowns[name] > 0 then
                if not hitstop then
                    instant_cooldowns[name] = instant_cooldowns[name] - 1
                end
            end

            -- 边沿触发：cur_buffer_time 从 0 变 > 0（命令刚完成那一帧）
            local prev_buf = cmd.prev_buffer_time or 0
            local curr_buf = cmd.cur_buffer_time
            cmd.prev_buffer_time = curr_buf

            if curr_buf > 0 and prev_buf == 0 then
                -- 冷却好了才 spawn
                local cd = instant_cooldowns[name] or 0
                if cd == 0 then
                    spawnProjectile(name, player)
                    instant_cooldowns[name] = cmd.cooldown
                end
                -- 无论是否 spawn，都消费命令（防止积压）
                cmd.cur_buffer_time = 0
            end
        end
    end
end

-- 发射物生成（通过 EntityManager.add，见第零章）
function spawnProjectile(name, player)
    if name == "phantom_sword" then
        EntityManager.add({
            x = player.x + player.facing * 30,
            y = player.y - 40,
            vx = player.facing * 12,
            vy = 0,
            life = 60,       -- 60 帧后消失
            anim = "phantom_sword",
            owner = player,
        })
    elseif name == "blue_rose" then
        EntityManager.add({
            x = player.x + player.facing * 20,
            y = player.y - 30,
            vx = player.facing * 20,  -- 子弹更快
            vy = 0,
            life = 30,
            anim = "bullet",
            owner = player,
        })
    end
end
```

#### 主循环：即时命令和状态机并行处理

```lua
function love.update(dt)
    -- 1-3. 标准输入管线
    Input.update()
    local snapshot = buildInputSnapshot(Input, back, fwd)
    Buffer.update(buf, snapshot)
    for _, cmd in pairs(commands) do
        Command.step(cmd, buf, hitstop > 0)
    end

    -- 4a. 即时动作命令：边沿触发，不进状态机
    --     幻影剑、蓝枪在这里处理
    updateInstantCommands(player, hitstop > 0)

    -- 4b. 状态切换命令：走 cancel_windows，进入新状态
    Player.update(player, dt)  -- 用 §9.2 的实现

    -- 5. 全局实体更新（发射物独立于角色，见第零章 EntityManager）
    EntityManager.update(dt)

    -- 6. hitstop 倒计时
    if hitstop > 0 then hitstop = hitstop - 1 end
end
```

#### 关键设计点

1. **命令分两类**：`state_change` 走 cancel_windows；`instant` 走边沿触发
2. **即时命令边沿触发**：只在"刚完成"那一帧 spawn（`curr_buf > 0 && prev_buf == 0`），不是每帧
3. **即时命令有冷却**：防止连按 spam（幻影剑 20 帧、开枪 10 帧）
4. **即时命令消费 cur_buffer_time**：spawn 后立即清零，防止重复触发
5. **角色不进新状态**：`Player.update` 继续当前状态，幻影剑和挥刀可以同时进行
6. **发射物是独立 entity**：自己更新位置、自己消失，和角色状态完全解耦

#### 维吉尔的实际场景：挥刀 + 幻影剑同时

```
帧:    1   2   3   4   5   6   7   8   9  10
挥刀:  ▓   ▓   ▓   ▓   ▓   ▓   ▓   ▓   ▓   ▓   (attack_1 状态持续)
幻影:  .   .   ▓   .   .   .   .   .   .   .   (帧3 spawn 幻影剑)
                                       幻影剑自己飞出去
```

- 帧 1：按攻击键 → 进入 attack_1 状态（走 cancel_windows）
- 帧 3：按特殊键 → 幻影剑命令完成 → 边沿触发 → spawn 幻影剑（**不走状态机**）
- 帧 3+：维吉尔继续挥刀（attack_1 状态没变），幻影剑独立飞行

这就是"不影响状态"的核心——**两条独立路径并行处理**。

#### 为什么不能用 cancel_windows 处理即时命令

如果你把幻影剑放进 cancel_windows，会发生：
- 玩家按特殊键 → 幻影剑命令完成 → cur_buffer_time = 3
- 当前状态（比如 attack_1）的取消窗口查到幻影剑 → ChangeState 到"幻影剑状态"
- **维吉尔停止挥刀，进入幻影剑状态** ← 这不对！

cancel_windows 的本质是"切换到新状态"，而即时命令要的是"不切换状态，直接 spawn"。所以必须分两条路径。

### 9.5 状态内输入检测：完美次元斩、红刀

前面讲了两种命令类型（`state_change` 和 `instant`），都走命令系统。但鬼泣里有些技能**不走命令系统**——它们是"在某个状态的特定时间窗口内按键"。比如：

- **完美次元斩**：维吉尔在次元斩蓄力状态的第 10-12 帧松开特殊键 → 触发完美版本
- **尼禄红刀（Exceed）**：尼禄在攻击状态的第 5-8 帧按 Exceed 键 → 下一击带火

这些不是"搓招"（多按键序列），而是"角色处于某个状态时，在精确时间窗口内按一个键"。它们**不走命令系统**，走状态机的 `on_frame` 函数。

#### 状态 vs 标志：蓄力为什么是标志

在讲完美次元斩之前，先搞清楚一个核心概念：**角色同时只能处于一个状态**。那"边跑边蓄力"怎么实现？答案是：**蓄力不是状态，是标志**。

| | 状态（State） | 标志（Flag） |
|---|---|---|
| 同时存在几个 | 只能 1 个 | 可以多个叠加 |
| 影响角色动作吗 | ✅ 影响（停止移动、播放动画） | ❌ 不影响（角色继续当前行为） |
| 例子 | 攻击、跳跃、次元斩释放 | 蓄力、红刀、无敌、锁定 |
| MUGEN 对应 | stateno | var() |

**判断标准**：如果这个行为**影响角色动作**（角色停下来做某事），用状态；如果**不影响角色动作**（角色还能移动，只是多了个属性），用标志。

DMC5 维吉尔次元斩的完整流程：

```
玩家按住 attack
    │
    ▼
player.charging = true  ← 标志！不是状态！
    │
    ├─ 角色状态仍然是 stand/run/jump（可以移动！）
    ├─ 视觉：角色动画 + 蓝光叠加
    ├─ charge_frame 每帧 +1
    │
    └─ 玩家松开 attack
        ├─ charge_frame >= 15 → 切到 judgement_cut_release 状态 ← 这才是状态！
        └─ charge_frame < 15  → 取消蓄力，继续当前状态
```

**蓄力期间角色可以跑**——因为蓄力是标志，角色状态还是 `run`。只有"释放次元斩"才是独立状态（角色停下来放次元斩）。

#### 完美次元斩的实现：蓄力是标志，释放是状态

```lua
local Player = {
    -- 状态机
    state = "stand",
    frame = 0,
    -- 标志（可以和任何状态同时存在）
    charging = false,       -- 蓄力中
    charge_frame = 0,       -- 蓄力帧数
}

-- 蓄力标志在 Player.update 里更新，不依赖具体状态
function Player.update(player, dt, buf)
    -- ★ 1. 更新蓄力标志（任何状态都能蓄力）
    if buf:held("attack") and not player.charging then
        player.charging = true
        player.charge_frame = 0
    end

    if player.charging then
        if buf:held("attack") then
            -- 继续蓄力（角色状态不变，可以继续跑）
            player.charge_frame = player.charge_frame + 1
        else
            -- ★ 松开了攻击键
            -- 用 not held 检测（和 MUGEN 的 command != "holda" 一致）
            -- 不用 justReleased（只在松开那帧 true，可能错过）
            if player.charge_frame >= 15 then
                -- 蓄力足够 → 切到次元斩释放状态（这才是状态！）
                player:setState("judgement_cut_release")
            end
            -- 无论是否释放，都清蓄力标志
            player.charging = false
        end
    end

    -- ★ 2. 正常的状态机逻辑（stand/run/jump/attack）
    -- 蓄力标志不影响状态切换，角色可以边跑边蓄力
    local state = states[player.state]
    if state.on_frame then
        state.on_frame(player, player.frame, buf)
    end
    -- ... cancel_windows 等 ...
end
```

释放状态根据 `charge_frame` 判断完美/普通：

```lua
local states = {
    -- 次元斩释放状态（这才是独立状态！）
    judgement_cut_release = {
        total_frames = 40,
        on_enter = function(player)
            -- 完美释放窗口：蓄力 10-12 帧内松开
            if player.charge_frame >= 10 and player.charge_frame <= 12 then
                player.damage_multiplier = 2.0  -- 完美版本伤害高
                player.anim = "judgement_cut_perfect"
            else
                player.damage_multiplier = 1.0  -- 普通版本
                player.anim = "judgement_cut_normal"
            end
        end,
    },
}
```

视觉渲染——蓄力标志只影响叠加效果，不影响角色动画：

```lua
function Player.draw(player)
    -- 画角色（根据当前状态 stand/run/jump 的动画）
    drawCharacterAnim(player)
    -- 如果在蓄力，叠加蓝光特效（不影响角色动画）
    if player.charging then
        drawChargeEffect(player, player.charge_frame)
    end
end
```

#### 蓄力释放的检测：not held vs justReleased

**为什么用 `not buf:held("attack")` 而不是 `buf:justReleased("attack")`**：

```lua
-- ❌ 用 justReleased：只在松开那一帧 true
if buf:justReleased("attack") then
    -- 如果这一帧 on_frame 没跑到（比如状态刚切换），就错过了
    -- 而且 justReleased 那一帧 buffer == -1，无法查 heldFrames
end

-- ✅ 用 not held：松开后每帧都 true（和 MUGEN 的 command != "holda" 一致）
if not buf:held("attack") then
    -- 不会错过，且可以用 charge_frame 查蓄力时长
end
```

**关键**：蓄力时长用 `player.charge_frame`（标志计时），不用 `buf:heldFrames("attack")`。因为松开那帧 buffer 变成 -1，`heldFrames` 返回 0，无法知道之前按住了多久。`charge_frame` 是独立计时的，不受 buffer 影响。

#### MUGEN CNS 的蓄力释放写法

MUGEN 角色也只能处于一个 state，但用 `var()` 记录标志。蓄力释放的 CNS 写法：

```ini
; state -2（每帧都跑，不管角色在什么状态）
[State -2, Set Charging]
type = VarSet
trigger1 = command = "holda"       ; 按住 a
trigger1 = statetype = S            ; 站立时（可扩展到其他状态）
var(50) = 1                         ; ★ 设蓄力标志

[State -2, Charge Timer]
type = VarAdd
trigger1 = var(50) = 1              ; 蓄力中
var(51) = 1                         ; ★ 蓄力计时

; 松开时检查蓄力时长，触发次元斩
[State -2, Release]
type = ChangeState
trigger1 = command != "holda"       ; ★ 松开了 a（not held，不是 justReleased）
trigger1 = var(50) = 1              ; 之前在蓄力
trigger1 = var(51) >= 15            ; 蓄力至少 15 帧
value = 1000                         ; 切到次元斩释放状态

; 蓄力不足就松开，取消
[State -2, Cancel]
type = VarSet
trigger1 = command != "holda"       ; 松开了 a
trigger1 = var(50) = 1              ; 之前在蓄力
trigger1 = var(51) < 15             ; 蓄力不足
var(50) = 0                         ; 清蓄力标志
```

MUGEN 用 `var(50)` 做蓄力标志，`var(51)` 做蓄力计时。`command != "holda"` 是**持续检测**"没按住 a"——松开后每帧都为 true。这和我们的 `not buf:held("attack")` + `player.charge_frame` 完全一致。

对应关系：

| MUGEN | Love2D |
|---|---|
| `var(50) = 1`（蓄力标志） | `player.charging = true` |
| `var(51)`（蓄力计时） | `player.charge_frame` |
| `command != "holda"`（没按住 a） | `not buf:held("attack")` |
| `var(51) >= 15`（蓄力足够） | `player.charge_frame >= 15` |
| `value = 1000`（切到释放状态） | `player:setState("judgement_cut_release")` |

#### 什么时候用状态，什么时候用标志

| 行为 | 状态 or 标志 | 原因 |
|---|---|---|
| 攻击 | 状态 | 角色停下来挥刀 |
| 跳跃 | 状态 | 角色离开地面 |
| 次元斩释放 | 状态 | 角色停下来放次元斩 |
| 蓄力 | **标志** | 角色还能移动 |
| 红刀 | **标志** | 角色继续攻击 |
| 无敌 | **标志** | 角色行为不变 |
| 锁定 | **标志** | 角色还能移动 |
| 武器切换 | **标志**（即时切换） | 只改 `current_weapon` |
| 风格切换 | **标志**（即时切换） | 只改 `current_style` |

**一句话判断**：**"角色还能不能移动？"** 能移动 → 标志；不能移动 → 状态。

#### 尼禄红刀的实现

红刀也是**标志不是状态**——在攻击状态的某几帧按 Exceed 键，设标志，不改状态：

```lua
local states = {
    attack_1 = {
        total_frames = 30,
        on_frame = function(player, frame, buf)
            -- Exceed 窗口：第 5-8 帧
            if frame >= 5 and frame <= 8 then
                -- 读 buf（Buffer 层），不读 Input
                if buf:justPressed("trigger_l") then  -- 尼禄的 LT/L2 = Exceed
                    player.exceeded = true  -- ★ 标志！不是状态！
                    -- 不改变状态！继续当前攻击
                    spawnEffect("exceed_spark", player.x, player.y)
                    playSound("exceed_ping")
                end
            end
        end,
        cancel_windows = {
            {start = 8, finish = 15,
             allowed = {"slash"}, condition = "always"},
        },
    },
    -- 下一击根据 exceeded 标志出不同效果
    attack_2 = {
        on_enter = function(player)
            if player.exceeded then
                player.damage_multiplier = 1.5  -- 带火伤害高
                player.anim = "attack_2_fire"
            else
                player.damage_multiplier = 1.0
                player.anim = "attack_2_normal"
            end
            player.exceeded = false  -- 消费标志
        end,
    },
}
```

红刀标志和蓄力标志都是"叠加在状态上的附加属性"：
- 蓄力标志：叠加在 stand/run/jump 上，角色能移动
- 红刀标志：叠加在 attack 上，下一击带火

#### 状态机需要加 on_frame 支持

`Player.update` 在检查 cancel_windows 之前先调 `on_frame`，让状态内检测能"抢先"触发。注意 `on_frame` 接收 `buf` 参数：

```lua
function Player.update(player, dt, buf)
    local state = states[player.state]

    -- 0. 调用状态的 on_frame（状态内输入检测）
    --    在 cancel_windows 之前，让状态内检测能抢先触发
    --    on_frame 读 buf（Buffer 层），不读 Input
    if state.on_frame then
        state.on_frame(player, player.frame, buf)
        -- on_frame 可能已经 setState，需要检查
        if player.state ~= states[player.state] then
            return  -- 切了状态，本帧结束
        end
    end

    -- 1. 检查 cancel_windows（同 §9.2，读 Command.isActive）
    for _, window in ipairs(state.cancel_windows or {}) do
        if player.frame >= window.start and player.frame <= window.finish then
            -- 按 priority 排序，检查 condition...
            -- 找到就 setState 并 return
        end
    end

    -- 2. 推进当前状态
    player.frame = player.frame + 1
    if state.total_frames and player.frame >= state.total_frames then
        if state.on_exit then state.on_exit(player) end
        if player.state == state then  -- on_exit 没切状态
            player:setState("stand")
        end
    end
end
```

#### 三种输入处理方式对比

现在完整了——输入处理有三种方式：

| 处理方式 | 例子 | 是否走命令系统 | 是否影响角色状态 | 处理位置 |
|---|---|---|---|---|
| **状态切换命令** | 攻击、跳跃、波动拳 | ✅ 走（type=state_change） | ✅ 进新状态 | 状态机（cancel_windows） |
| **即时动作命令** | 幻影剑、开枪 | ✅ 走（type=instant） | ❌ 不影响 | 状态机前面（updateInstantCommands） |
| **状态内输入检测** | 完美次元斩、红刀 | ❌ 不走命令系统 | ✅ 影响状态/属性 | 状态机内部（on_frame） |

**核心区分**：
- **状态切换命令**：玩家主动搓招，系统匹配 step 序列，匹配上就进新状态
- **即时命令**：玩家按一个键，spawn 发射物，角色状态不变
- **状态内输入检测**：角色已经在某个状态，在特定时间窗口内等玩家按键

#### 为什么完美次元斩和红刀不走命令系统

因为它们的核心是**"在某个状态的特定时间窗口内按键"**，不是"搓招"：

| 特性 | 搓招（命令系统） | 状态内输入检测 |
|---|---|---|
| 输入形式 | 多个按键的序列（D, DF, F+a） | 单个按键的边沿（松开/按下） |
| 匹配方式 | 跨多帧的 step 匹配 | 单帧的窗口检测 |
| 依赖状态 | 不依赖（任何状态都能搓） | **强依赖**（必须在特定状态） |
| 例子 | 波动拳、升龙拳 | 完美次元斩、红刀 |

用命令系统也能勉强实现（定义一个 `~special` 命令，在 cancel_windows 里查它），但很绕。`on_frame` 直接检测更清晰。

#### MUGEN CNS 里的对应写法（Vergil.cns 实例）

MUGEN CNS 没有 `on_frame` 函数，它用 **trigger 组合**实现同样的功能——在某个 state 的 State Controller 里，用 `command =` + `time =` 的 trigger 表达"在某个时间窗口内检测输入"。看两个 Vergil.cns 的实际例子：

**例子 1：状态内时间窗口 + 检测"没按某键"（`Vergil.cns:8261`）**

```ini
[State 900, ]
type = ChangeState
trigger1 = Animelemtime(14) >= 0                        ; 动画第 14 帧后（时间窗口）
triggerall = command != "b+c" && command != "holddown"  ; 没按 b+c 且没按下（输入检测）
value = 951
```

**含义**：在 state 900 里，动画第 14 帧之后，如果玩家**没有**按 `b+c` 且**没有**按 `holddown`，就 ChangeState 到 951。

`command != "holdxxx"` 是 MUGEN 的"否定检测"——检测"没按住某键"。这在鬼泣里很常见，比如"没按锁定键时出 A 招，按了锁定键时出 B 招"。

对应 Love2D：

```lua
on_frame = function(player, frame, buf)
    if frame >= 14 then  -- 动画第 14 帧后
        -- 没按 b+c 且没按下 → 切到 951
        if not (buf:held("b") and buf:held("c")) and not buf:held("down") then
            player:setState("state_951")
        end
    end
end
```

**例子 2：多 trigger AND + hold 检测（`Vergil.cns:19416`）**

```ini
[State 6060, ChangeAnim]
type = Changestate
trigger1 = command = "holdfwd"      ; 按住前（持续检测，不是边沿）
trigger1 = command != "holdup"      ; 且没按上
trigger1 = command != "holddown"    ; 且没按下
value = 100                          ; 切到前进状态
ignorehitpause = 1
```

**含义**：在 state 6060 里，如果玩家**按住前**且**没按上下**，ChangeState 到 100（前进）。

多个 `trigger1` 行是 **AND 关系**——所有条件都要满足。`command = "holdfwd"` 检测"正在按住前"（持续状态，不是边沿）。这和命令系统的 `command = "F"` 不同——`holdfwd` 是"正在按住"，`F` 是"刚按下"。

对应 Love2D：

```lua
on_frame = function(player, frame, buf)
    -- 按住前 且 没按上 且 没按下 → 前进
    if buf:held("right") and not buf:held("up") and not buf:held("down") then
        player:setState("walk_forward")
    end
end
```

#### MUGEN trigger 和 Love2D on_frame 的对应关系

| MUGEN trigger | 含义 | Love2D on_frame |
|---|---|---|
| `command = "holdxxx"` | 正在按住 xxx | `buf:held("xxx")` |
| `command != "holdxxx"` | 没按住 xxx | `not buf:held("xxx")` |
| `command = "~xxx"` | xxx 刚松开 | `buf:justReleased("xxx")` |
| `!time` | 状态第 0 帧 | `frame == 0` |
| `time = [N, M]` | 状态第 N-M 帧 | `frame >= N and frame <= M` |
| `Animelemtime(N) >= 0` | 动画第 N 帧后 | `frame >= N`（动画帧对齐时） |
| `movecontact` | 攻击命中过 | `player.last_attack_hit` |

**核心对应**：MUGEN 把"时间窗口 + 输入检测 + 状态条件"写在 trigger 行里（AND 关系），Love2D 用 if 嵌套表达。思路完全一样，只是表达方式不同。MUGEN 的 trigger 只能用预定义函数，Love2D 的 `on_frame` 可以写任意 Lua 代码，更灵活。

### 9.6 模拟摇杆 + 死区

```lua
local Gamepad = {
    deadzone = 0.2,  -- 死区，小于这个值视为 0
}

function Gamepad.read()
    local joysticks = love.joystick.getJoysticks()
    if #joysticks == 0 then return 0, 0 end
    local j = joysticks[1]
    if not j:isGamepad() then return 0, 0 end

    local lx = j:getGamepadAxis("leftx")
    local ly = j:getGamepadAxis("lefty")

    -- 死区
    if math.abs(lx) < Gamepad.deadzone then lx = 0 end
    if math.abs(ly) < Gamepad.deadzone then ly = 0 end

    return lx, ly
end

-- 把模拟摇杆转成 4 个 bool 喂给 buffer
function Gamepad.toDigital(lx, ly)
    local left  = lx < -0.5
    local right = lx >  0.5
    local up    = ly < -0.5   -- Love2D Y 轴向下为正
    local down  = ly >  0.5
    return left, right, up, down
end

-- 同时保留模拟值给走路速度用
function Player.update(player, dt)
    local lx, ly = Gamepad.read()
    player.walkSpeed = math.abs(lx) * player.maxSpeed
    -- 方向用数字量进 buffer
    local l, r, u, d = Gamepad.toDigital(lx, ly)
    -- 把 l/r/u/d 喂进 Input（覆盖键盘的话先合并）
    ...
end
```

### 9.7 连段切换：本质就是取消窗口

鬼泣的连段切换（按攻击键 → 第1段 → 第2段 → 第3段）**不需要单独的"节奏检测"模块**。它就是 §9.2 的 cancel_windows 的直接应用。

#### 连段切换的本质

每段攻击是一个 state，每个 state 有自己的取消窗口。在取消窗口内按攻击键，就跳到下一段：

```
attack_1 (第1段)
  ├─ 取消窗口 [8-15]：按攻击 → 跳到 attack_2
  └─ 窗口外或没按 → 状态自然结束，回到 stand

attack_2 (第2段)
  ├─ 取消窗口 [10-20]：按攻击 → 跳到 attack_3
  └─ 窗口外或没按 → 状态自然结束，回到 stand

attack_3 (第3段，终结技)
  └─ 没有取消窗口 → 必须播完
```

"节奏"就是取消窗口的时间范围。玩家在窗口内按攻击键 = "跟上节奏"，连段继续；没按 = "断节奏"，连段中断回到 stand。

#### 代码：就是 cancel_windows

```lua
local states = {
    attack_1 = {
        total_frames = 30,
        cancel_windows = {
            -- 第 8-15 帧内按攻击 → 取消到 attack_2
            {start = 8, finish = 15,
             allowed = {"slash"},
             condition = "always"},
        },
    },
    attack_2 = {
        total_frames = 35,
        cancel_windows = {
            -- 第 10-20 帧内按攻击 → 取消到 attack_3
            {start = 10, finish = 20,
             allowed = {"slash"},
             condition = "always"},
        },
    },
    attack_3 = {
        total_frames = 40,
        cancel_windows = {},  -- 终结技，不能取消
    },
}
```

Player.update 完全用 §9.2 的实现——检查当前状态的取消窗口，按 priority 找第一个 `cur_buffer_time > 0` 的命令，找到就 setState。

#### 逐帧推演

玩家做三连段：

```
帧:     1   2  ...  8  ...  12  ...  20  ...  25  ...  35
玩家按:  A   .  ...  .  ...   A   ...   .  ...   A   ...  .
              attack_1          attack_2           attack_3
              取消窗口[8-15]    取消窗口[10-20]    (无取消窗口)

帧 1:  按 A → slash 完成 → stand 取消窗口消费 → 进入 attack_1
帧 12: attack_1 在取消窗口 [8-15] 内
       玩家按 A → slash 完成 → attack_1 消费 → 进入 attack_2
帧 25: attack_2 在取消窗口 [10-20] 内（attack_2 第 13 帧 = 总帧 25）
       玩家按 A → slash 完成 → attack_2 消费 → 进入 attack_3
帧 35+: attack_3 无取消窗口，播完自然结束 → 回到 stand
```

如果玩家在帧 12 没按 A：

```
帧 12-15: attack_1 取消窗口开着，但 slash 的 cur_buffer_time = 0（没按）
帧 16-30: 窗口关闭，attack_1 继续播
帧 30:    attack_1 自然结束 → 回到 stand
连段中断
```

#### 为什么不需要单独的"节奏检测"模块

我之前写过用 `Rhythm.onTap()` 记录每次 tap 时间的方案，那是**过度设计**。原因：

1. **连段切换的"节奏"本质是"在某个时间窗口内按键"**——这正是 cancel_windows 做的事
2. **当前是第几段由 state 决定**——attack_1 状态按攻击就跳 attack_2，不需要数 tap 次数
3. **state 本身就记录了连段进度**——不需要额外的 Rhythm.sequence 数组

用 cancel_windows 做连段切换的好处：
- 和普通攻击取消用同一套机制（统一）
- 自带"时间窗口"概念（取消窗口就是节奏窗口）
- 自带"条件"支持（可以加 `condition = "on_hit"` 做"命中才能连段"）
- 不需要额外的模块

#### 什么时候才需要独立的节奏检测

很少。只有一种情况：**不在状态机控制下的节奏判定**。比如：

- 某些 mini game："按 X 三次，每次间隔 5-10 帧"
- 蓄力释放的"节奏"判定（不是鬼泣的连段）

鬼泣的连段切换完全不需要。如果你发现自己想写 Rhythm 模块，先想想能不能用 cancel_windows 表达——99% 的情况能。

### 9.8 风格/武器切换（鬼泣特色）

鬼泣的切换分两种：**风格切换**（但丁的骗术/剑圣/枪神/皇家护卫）和**武器切换**（维吉尔的武士刀/拳套/居合）。切换有三种实现方式，看是否有切换动画决定。

#### 方式 A：切换是一个状态（有切换动画）

维吉尔的武器切换有短动画。这种就用普通的 cancel_windows（§9.2），和攻击状态没区别：

```lua
weapon_switch = {
    total_frames = 20,  -- 切换动画 20 帧
    cancel_windows = {
        -- 切换动画前 5 帧不能取消（强制播放）
        -- 第 5-15 帧可以取消到 stand 或某些招
        {start = 5, finish = 15,
         allowed = {"stand", "slash"},
         condition = "always"},
    },
}

-- 进入切换状态时切换武器
function onEnterWeaponSwitch(player)
    player.weapon = next_weapon(player.weapon)
end
```

切换动画期间不能攻击，但能取消到 stand 或某些招。这和普通攻击状态完全一样。

#### 方式 B：即时切换 + 短暂冷却（无动画）

但丁的风格切换更接近即时——按下立刻切换，没有专门动画。这种不进状态机：

```lua
local Style = {
    current = "trickster",
    switch_cooldown = 0,
}

function Style.trySwitch()
    if Style.switch_cooldown > 0 then return false end
    Style.current = next_style(Style.current)
    Style.switch_cooldown = 15  -- 15 帧冷却防止连按
    return true
end

-- 在主循环里倒计时冷却
if Style.switch_cooldown > 0 then
    Style.switch_cooldown = Style.switch_cooldown - 1
end
```

不进入任何状态，只改 `Style.current` 标志，加冷却防 spam。

#### 方式 C：模式标记，影响后续命令解析（和 B 组合用）

切换只改标志，后续命令根据标志出不同招。这是风格切换的核心：

```lua
-- 切换是即时的（方式 B）
function onStyleSwitch()
    Style.trySwitch()  -- 改 Style.current 标志
end

-- 后续命令根据风格出不同招（方式 C）
function Player.trySpecial(player)
    if Style.current == "trickster" then
        player:setState("dash")            -- 骗术：冲刺（走状态机）
    elseif Style.current == "swordmaster" then
        player:setState("special_melee")   -- 剑圣：特殊近战
    elseif Style.current == "gunslinger" then
        player:setState("special_gun")     -- 枪神：特殊枪技
    elseif Style.current == "royalguard" then
        player:setState("guard")           -- 皇家护卫：防御
    end
end
```

**实际游戏通常是 B + C 组合**：即时切换标志 + 后续命令根据标志分流。鬼泣正是这样。

#### 切换 + 即时命令的组合

维吉尔切换武器后，幻影剑不受武器影响（幻影剑是独立技能，见 §9.4）。这种组合用"命令路由"处理：

```lua
function onSpecialInput(player, buf)
    -- 1. 武器切换（如果是切换键组合，比如锁定+特殊）
    --    读 buf（Buffer 层），不读 Input
    if buf:held("lock") and buf:justPressed("special") then
        switchWeapon()  -- 即时切换（方式 B），不进状态
        return
    end

    -- 2. 幻影剑（即时动作，不受武器影响）
    --    updateInstantCommands 已经处理了（§9.4），这里不重复

    -- 3. 武器特定的特殊技（走状态机，受 current_weapon 影响）
    if commands.weapon_special.cur_buffer_time > 0 then
        if current_weapon == "katana" then
            player:setState("iaido_slash")    -- 居合
        elseif current_weapon == "beowulf" then
            player:setState("beowulf_smash")  -- 拳套砸地
        elseif current_weapon == "yamato" then
            player:setState("judgement_cut")  -- 次元斩
        end
    end
end
```

#### 切换的三种方式汇总

| 方式 | 是否进状态机 | 例子 | 适用场景 |
|---|---|---|---|
| A. 切换是状态 | ✅ | 维吉尔武器切换动画 | 有专门切换动画 |
| B. 即时切换+冷却 | ❌ | 但丁风格切换 | 无动画，立刻生效 |
| C. 模式标记分流 | ❌（配合 B） | 后续命令按风格/武器分流 | 影响后续命令解析 |

实际游戏通常 B + C 组合：即时切换标志 + 后续命令根据标志分流。如果切换有动画，再加 A。

### 9.9 （可选高级）输入意图队列：什么时候才需要

**先说结论：大多数情况不需要。** MUGEN 没有，格斗游戏不需要，鬼泣的普通连段也不需要。只有在玩家想"提前搓好 3+ 个招排队"时才需要。

#### MUGEN 风格的"缓冲下一招"够用吗？

够。看这个场景：

```
玩家做 attack_1 → attack_2 → attack_3 连段

帧 1:   玩家搓 attack_1 → cur_buffer_time=5 → stand 消费 → 切到 attack_1
帧 8:   attack_1 进入取消窗口 [8-15]
帧 9:   玩家搓 attack_2 → cur_buffer_time=5 → attack_1 取消窗口消费 → 切到 attack_2
帧 17:  attack_2 进入取消窗口 [10-20]（attack_2 的第 10 帧 = 总帧 17）
帧 18:  玩家搓 attack_3 → cur_buffer_time=5 → attack_2 取消窗口消费 → 切到 attack_3
```

玩家每一招都是**在上一招的取消窗口快打开时搓的**，cur_buffer_time 短暂保留（5 帧）刚好够用。这就是"缓冲下一招"，MUGEN 风格完全胜任。

#### 什么时候才需要意图队列？

只有一种情况：**玩家想提前搓好 3+ 个招，但当前招的取消窗口还没打开**。

比如鬼泣高端玩家：连招 A→B→C→D，他在 A 的开场帧 1 就搓完了 B、C、D 全部。MUGEN 风格做不到——A 的取消窗口没开，B 的 cur_buffer_time 衰减到 0 就丢了。

但这是**高级特性**，不是基础需求。建议：
- 先做 MUGEN 风格（9.2-9.6）
- 玩起来发现"我搓的招丢了"再加意图队列
- 大多数情况你不会需要

#### 如果真要加，怎么实现

```lua
local IntentQueue = {
    queue = {},
    max_size = 3,           -- 最多缓存 3 个意图
}

function IntentQueue.push(name)
    if #IntentQueue.queue >= IntentQueue.max_size then
        table.remove(IntentQueue.queue, 1)  -- 队满丢最老的
    end
    table.insert(IntentQueue.queue, {
        name = name,
        remain = commands[name].buffer_time + 15,  -- 比命令缓冲多给 15 帧
    })
end

function IntentQueue.update(hitstop)
    if hitstop then return end  -- hitstop 期间不衰减
    for i = #IntentQueue.queue, 1, -1 do
        IntentQueue.queue[i].remain = IntentQueue.queue[i].remain - 1
        if IntentQueue.queue[i].remain <= 0 then
            table.remove(IntentQueue.queue, i)
        end
    end
end

-- 按 priority 降序排序 allowed_names，返回新表
local function sortByPriority(allowed_names)
    local sorted = {}
    for _, name in ipairs(allowed_names) do
        table.insert(sorted, name)
    end
    table.sort(sorted, function(a, b)
        return commands[a].priority > commands[b].priority
    end)
    return sorted
end

-- 找到第一个匹配的意图并消费（按 priority 排序）
function IntentQueue.findAndConsume(allowed_names)
    local sorted = sortByPriority(allowed_names)
    for _, name in ipairs(sorted) do
        for i, intent in ipairs(IntentQueue.queue) do
            if intent.name == name then
                table.remove(IntentQueue.queue, i)
                return intent.name
            end
        end
    end
    return nil
end

-- 命令完成时入队（替换 9.2 的"直接让 cur_buffer_time 生效"）
function Command.step(...)
    ...
    if cmd.completed[#cmd.steps] then
        cmd.cur_buffer_time = cmd.buffer_time  -- 仍然设 cur_buffer_time（兼容直接查询）
        IntentQueue.push(cmd.name)             -- 同时入队（支持多招预输入）
        ...
    end
end

-- 状态机消费（替换 9.2 的 Player.update）
function Player.update(player, dt)
    local state = states[player.state]
    for _, window in ipairs(state.cancel_windows or {}) do
        if player.frame >= window.start and player.frame <= window.finish then
            -- 检查 condition（同 9.2）
            if not Command.checkCondition(window, player) then
                goto next_window
            end

            -- 优先从意图队列找（按 priority 排序）
            local next_action = IntentQueue.findAndConsume(window.allowed)
            if next_action then
                player:setState(next_action)
                return
            end
            -- 队列没有就 fall back 到 cur_buffer_time 查询（也按 priority 排序）
            local sorted = sortByPriority(window.allowed)
            for _, name in ipairs(sorted) do
                if commands[name].cur_buffer_time > 0 then
                    player:setState(name)
                    return
                end
            end
            ::next_window::
        end
    end
    player.frame = player.frame + 1
    ...
end
```

**关键设计点：**

1. **意图过期时间比 cur_buffer_time 长**——意图要在队列里等取消窗口打开，需要更长保留时间。我这里用 `buffer_time + 15`。
2. **仍然保留 cur_buffer_time 机制**——意图队列是"加层"，不是替换。状态机先查队列，队列没有再 fall back 到 cur_buffer_time。
3. **priority 字段决定优先级**——队列查询和 cur_buffer_time 查询都按 priority 降序，和 9.2 保持一致。
4. **condition 检查依然生效**——意图队列消费也要先过 condition 检查（比如 `on_hit` 的窗口没命中就不消费）。

#### 一个重要的设计选择

意图队列会引入一个新问题：**队列里有多个意图时，玩家想取消刚搓的招怎么办？** 比如玩家搓了 A→B，但 B 还没出，玩家想取消 B 改成 C。

MUGEN 风格没这个问题——cur_buffer_time 短，自然过期。意图队列需要你自己加"取消上一个意图"的机制（比如按某个键清空队列）。

**这也是我建议先做 MUGEN 风格的原因**——简单，没这些边角问题。等真的不够用了再加队列，那时候你已经清楚需要什么了。

---

## 第十章：学习路径建议

### 10.1 不要一次写完

我建议你分阶段实现：

**阶段 1（1-2 天）：基础输入 + 缓冲**
- 实现 Input 和 Buffer
- 把 buffer 值画到屏幕上调试
- 实现一个简单招式：`J J` 触发

**阶段 2（2-3 天）：命令匹配**
- 实现 Command 系统
- 加波动拳类多步命令
- 加 `/`（按住）和 `~`（释放）修饰符
- 加 hitstop 处理

**阶段 3（2-3 天）：MUGEN 风格的取消窗口**
- 加 SOCD 解决
- 加命令 buffer_time（不同招式配不同时间）
- 实现取消窗口 + 优先级顺序（§9.2）
- 实现状态联动（§9.3）

**阶段 4（2-3 天）：即时动作命令 + 状态内输入检测**
- 区分 state_change 和 instant 命令类型（§9.4）
- 实现边沿触发 + 冷却 + spawn 发射物
- 幻影剑/开枪这类不影响状态的技能
- 实现状态内输入检测 on_frame（§9.5）
- 完美次元斩/红刀这类状态内精确输入

**阶段 5（3-5 天）：鬼泣特色**
- 模拟摇杆
- 连段切换（cancel_windows 的应用，不需要单独模块）
- 风格/武器切换（§9.8）
- （可选）输入意图队列：仅当多招预输入真的不够用时才加

### 10.2 调试技巧

**把 buffer 画到屏幕上**：

```lua
function love.draw()
    local y = 10
    for _, name in ipairs(Buffer.keys) do
        love.graphics.print(name .. ": " .. buf[name], 10, y)
        y = y + 20
    end
    -- 命令状态
    y = y + 20
    for _, cmd in ipairs(cmds) do
        local state = Command.isActive(cmd) and "[ACTIVE]" or ""
        love.graphics.print(cmd.name .. " buf=" .. cmd.cur_buffer_time .. " " .. state, 10, y)
        y = y + 20
    end
end
```

**慢动作模式**：

```lua
function love.update(dt)
    if slow_motion then
        -- 每 5 帧才真正 update 一次
        frame_counter = (frame_counter or 0) + 1
        if frame_counter < 5 then return end
        frame_counter = 0
    end
    -- 真正的 update
    ...
end
```

**hitstop 可视化**：

```lua
function love.draw()
    if hitstop > 0 then
        love.graphics.setColor(1, 0, 0)
        love.graphics.print("HITSTOP: " .. hitstop, 10, 200)
        love.graphics.setColor(1, 1, 1)
    end
end
```

### 10.3 给你的最终建议

1. **先跑通最小版本**。别一上来就想做鬼泣全套系统，先把"波动拳能搓出来"做通。
2. **buffer 是核心**。如果你只记一件事，记这个：每个按键一个有符号计数器（正=按住帧数，负=松开帧数，1/-1=边沿）。
3. **hitstop 不冻结输入**。这是动作游戏手感的关键，别搞错了。
4. **MUGEN 的设计可迁移**。命令缓冲（curbuftime）+ 取消窗口 + 优先级顺序，这三件套就够做鬼泣的普通连段。
5. **意图队列是高级特性，不是基础**。先做 MUGEN 风格的简单版本，玩起来发现"搓的招丢了"再加队列。
6. **Lua 表达命令比字符串强**。MUGEN 用字符串 `"D, DF, F+x"` 是历史包袱，你用 Lua 表可以写函数、加字段、做条件，自由得多。

---

## 附录 A：MUGEN 输入系统速查图

```
┌─────────────────────────────────────────────────────────────┐
│  硬件 (键盘/手柄)                                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Input 层：每帧采样，区分 justPressed / held / justReleased │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  前后解析：根据角色朝向把 left/right 转成 back/fwd（相对）   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  SOCD 解决：在 back/fwd（相对方向）上解决对立方向冲突        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Buffer 层：每按键一个有符号计数器                           │
│    正 N = 按住 N 帧（1 = 刚按下）                            │
│    负 N = 松开 N 帧（-1 = 刚松开）                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Command 层：每帧 step 每个命令                              │
│    1. cur_buffer_time-- （hitstop 期间不减！）               │
│    2. 检查 step 过期                                         │
│    3. 全局计时 cur_time++                                    │
│    4. 匹配每个 step（matchKey 查 buffer）                    │
│    5. 全部完成 → cur_buffer_time = buffer_time               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  状态机：查 Command.isActive(cmd) → 角色出招                 │
└─────────────────────────────────────────────────────────────┘
```

## 附录 B：修饰符速查

| 符号 | 名字 | 含义 | buffer 检查 |
|---|---|---|---|
| 无 | 按下 | 本帧刚按下 | `== 1` |
| `/` | 按住 | 正在按住 | `> 0` |
| `~` | 释放 | 本帧刚松开 | `== -1` |
| `/30` | 蓄力按住 | 按住至少 30 帧 | `>= 30` |
| `~30` | 蓄力释放 | 按住 30 帧后松开 | `== -1 且之前按 >= 30 帧` |
| `$` | 宽松 | 忽略对立方向 | （高级特性） |
| `>` | 跟随 | 两步间无其他输入 | （高级特性） |
| `,` | 序列 | 一帧一帧按顺序 | step 之间 |
| `+` | 同时 | 同一帧内同时满足 | step 内 AND |
| <code>\|</code> | 或 | 任一满足 | step 内 OR |

## 附录 C：MUGEN vs Love2D 自实现对比

| 维度 | MUGEN | Love2D 自实现 |
|---|---|---|
| 按键数量 | 10 个固定 | 任意 |
| 虚拟按键/物理映射 | ✅ KeyConfig | ✅ keyboardMap + gamepadMap（§1.1） |
| 手柄扳机（LT/RT） | ✅ 轴当按钮 | ✅ 死区转 bool（§1.1） |
| 命令定义 | 字符串 `"D, F+x"` | Lua 表（灵活） |
| 模拟轴 | ❌ | ✅ |
| 连段切换 | ✅ 靠 CNS state + trigger | ✅ cancel_windows 直接应用（§9.7） |
| 缓冲下一招 | ✅ curbuftime | ✅ 可复刻 |
| 即时动作命令（不进状态） | ⚠️ 靠 Helper/Projectile SCTRL | ✅ type=instant + 边沿触发（§9.4） |
| 状态内输入检测（完美释放/红刀） | ✅ 靠 CNS state + trigger | ✅ on_frame + 时间窗口（§9.5） |
| 蓄力释放（长按蓄力+松开触发） | ✅ var() 标志 + command != "hold" | ✅ charging 标志 + not held + charge_frame（§9.5） |
| 状态 vs 标志区分 | ✅ stateno vs var() | ✅ player.state vs player.flag（§9.5） |
| 武器/风格切换 | ⚠️ 靠 CNS 变量 | ✅ 标志 + 冷却 + 命令分流（§9.8） |
| 多招预输入队列 | ❌ | ⚠️ 可加（高级特性，多数情况不需要） |
| 命令优先级 | ⚠️ trigger 顺序（易错） | ✅ priority 字段 |
| 防止命令借用 | `>` 跟随符（限制预输入） | ✅ 命令完成清其他 step（不影响预输入） |
| 取消窗口条件 | ✅ movecontact + time trigger | ✅ condition + extra_condition 字段 |
| 状态联动 | ✅ 靠 CNS trigger | ✅ 取消窗口（Lua 数据表） |
| hitstop 处理 | ✅ 保留 buffer | ✅ 可复刻 |
| SOCD | ✅ 5 种模式 | ✅ 可复刻 |
| 跨玩家输入读取 | ✅（OC_command 重定向） | ✅ 自己实现 |
| 网络/回放 | ✅（GGPO 集成） | ✅ 自己实现 |

## 附录 D：做鬼泣类游戏的取消系统设计指引

> 这一附录针对想做 2D 横版鬼泣/猎天使魔女风格的开发者。前面正文用格斗游戏（波动拳）做例子，但鬼泣的取消逻辑和格斗游戏差别很大，这里专门讲清楚。

### D.1 先纠正一个常见误解：跳跃/闪避不是"通用取消"

很多人（包括写这篇文档早期版本的我）以为鬼泣里"跳跃和闪避能打断任何攻击状态"——这是把**手游**的闪避机制套到鬼泣上了，**错的**。

鬼泣的取消规则比手游严格得多。逐帧分析的证据：

- **攻击起手（前摇）**：按跳跃/闪避**没用**，指令被吞或延迟到攻击结束后才响应
- **攻击判定（伤害生效）**：视技能而定，有的能插入取消终止下一段，有的会被吞
- **攻击收招（后摇）**：大部分能取消，但需要的取消动作等级因技能而异

实测例子：狗棍平a第 11 帧按 dash，直到第 20 帧才出现 dash 动作；百万刺前段按 dash 会被完全吞掉。鬼泣**不能"卡刀"**（只要伤害不要动画），攻击动画一旦开始就必须播放到某个阶段才能被取消。

### D.2 攻击动作的三阶段模型

做鬼泣取消系统，先给每个攻击动作建立三阶段模型：

```
┌──────────┬──────────┬──────────┐
│  前摇     │  判定     │  后摇     │
│ startup  │ active   │ recovery │
├──────────┼──────────┼──────────┤
│ 不可取消  │ 视技能而定│ 可取消    │
│ 按啥没用  │ 有窗口表  │ 有窗口表  │
└──────────┴──────────┴──────────┘
```

每个技能要配两张表：

- **判定阶段取消表**：哪些动作能在此技能的判定阶段插入（通常很少，或没有）
- **后摇阶段取消表**：哪些动作能取消此技能的后摇（走路、跳、闪避、JC、DT取消等，按等级排列）

### D.3 取消分类（修正版）

| 类型 | 触发条件 | 例子 | 对应 MUGEN | Love2D 实现 |
|---|---|---|---|---|
| **后摇窗口取消** | 当前状态 + 后摇帧窗口 + 输入 | 连段派生、JC、闪避取消后摇、走路取消后摇 | 用法 B（stateno + time） | `cancel_windows` / `on_frame` |
| **idle/移动起手** | 自由状态 + 输入 | 站着/移动中按攻击键出第一刀 | 用法 A（command + ctrl） | `updateInstantCommands` |
| **大招触发** | 资源 + 输入（部分还有状态限制） | 魔人化、DT取消 | 用法 A + 资源条件 | `updateInstantCommands` + 资源检查 |

**关键结论**：鬼泣里**几乎所有取消都是窗口制（用法 B）**，包括跳跃和闪避。真正的"通用取消（用法 A）"只存在于自由状态（idle/移动）下的起手，以及大招触发。

正文里用法 A 用的"波动拳"例子是格斗游戏思路，做鬼泣不要照搬——你的游戏里用法 A 只用于 idle 起手和大招，剩下 90% 都是窗口制。

### D.4 JC（Jump Cancel）的特殊处理

JC 是鬼泣取消系统里最特殊的一个，需要单独建模：

| JC 条件 | 说明 |
|---|---|
| 必须踩到敌人（Enemy Step） | 脚下有判定目标时按跳跃，才判为"全新基础起跳"而非二段跳。踩不到就是普通二段跳，不刷新 CD |
| 取消的是后摇 | 利用跳跃起步帧打断技能后摇，不是打断起手/判定 |
| 核心价值是刷新空中技能 CD | 踩怪重置滞空状态，清空空中限定技能的冷却锁 |

对应到 Love2D 实现：

```lua
-- JC 取消窗口：只在"命中后 + 后摇窗口 + 脚下有敌人"时允许跳
states.aerial_combo_1 = {
    total_frames = 30,
    cancel_windows = {
        {
            start = 12, finish = 25,        -- 后摇帧窗口
            allowed = {"jump"},             -- 允许跳跃取消
            condition = function(player)
                return player.hit_count > 0       -- 必须命中过（movecontact）
                   and player:enemyBelow()        -- 脚下必须有敌人（踩怪判定）
            end,
        },
    },
}
```

注意 `condition` 字段——这是窗口制取消的增强，比 MUGEN 的 `movecontact` 触发更灵活，可以写任意 Lua 条件。

### D.5 取消等级（cancel priority）

鬼泣每个技能有"可被取消的等级表"，从低到高：

```
走路取消  <  跳跃取消  <  闪避取消  <  JC取消  <  DT取消  <  真魔人取消
（最宽松）                                          （最高级，能取消大部分后摇）
```

但**等级高不等于"能取消任意阶段"**——所有取消都只能在"可取消阶段"（通常是后摇）生效。等级高只意味着"能取消的技能更多、窗口更宽"。

有些技能的后摇只能被高等级取消（如双火箭筒激光炮后摇只能真魔人取消），有些技能的后摇走路就能取消。

对应到 Love2D：

```lua
-- 重攻击：后摇只能被高等级取消
states.heavy_laser = {
    total_frames = 60,
    cancel_windows = {
        -- 走路/跳/闪避都不能取消这个技能
        -- 只有 DT取消 和 真魔人取消 能取消
        {start = 40, finish = 55, allowed = {"dt_cancel", "dt_true"}},
    },
}

-- 轻攻击连段第一刀：后摇很宽松，走路都能取消
states.light_combo_1 = {
    total_frames = 20,
    cancel_windows = {
        -- 后摇阶段：多种取消方式都行
        {start = 12, finish = 18, allowed = {"walk", "jump", "dash", "jc", "dt_cancel"}},
        -- 连段派生：接下一刀（更早的窗口）
        {start = 8, finish = 15, allowed = {"light_combo_2"}},
    },
}
```

### D.6 对应到文档的分层架构

回到文档前面的 `updateControl`（-1 层），鬼泣的取消逻辑都写在这里：

```lua
function Player:updateControl(dt, buf)
    local state = states[self.state]

    -- 1. on_frame：复杂取消（JC、DT取消等需要命中/资源条件的）
    if state.on_frame then
        state.on_frame(self, self.frame, buf)
        if self.state ~= state.name then
            self.state_changed = true
            return
        end
    end

    -- 2. cancel_windows：数据驱动的取消（连段派生、闪避取消后摇等）
    for _, window in ipairs(state.cancel_windows or {}) do
        if self.frame >= window.start and self.frame <= window.finish then
            if Command.checkCondition(window, self) then
                -- 检查 window.condition（如 hit_count>0、enemyBelow、power>=X）
                if not window.condition or window.condition(self) then
                    for _, name in ipairs(sortByPriority(window.allowed)) do
                        if Command.isActive(name) then
                            self:setState(name)
                            self.state_changed = true
                            return
                        end
                    end
                end
            end
        end
    end

    -- 3. idle/移动起手（用法 A）：自由状态下按攻击键出第一刀
    if self:isFreeState() and self:hasControl() then
        if Command.isActive("attack") then
            self:setState("light_combo_1")
            self.state_changed = true
            return
        end
    end

    -- 4. 即时命令（大招、魔人化等，消耗资源）
    updateInstantCommands(self, buf)
end
```

注意第 2 步比正文版本多了 `window.condition` 检查——这是实现 JC（需要踩怪+命中）、DT取消（需要资源）这类条件取消的关键。

### D.7 实践建议

1. **先做窗口制取消（cancel_windows）**：鬼泣 90% 的取消逻辑都是这个。给每个攻击状态配后摇取消表。
2. **跳跃和闪避也是窗口制**：不要做成"随时能打断任何攻击"，那是手游不是鬼泣。给每个攻击状态配"后摇阶段能否被跳/闪避取消"。
3. **JC 需要特殊条件**：踩怪 + 命中 + 后摇窗口，三者都要满足。用 `condition` 函数实现。
4. **取消等级用 priority 字段**：高等级取消能覆盖低等级取消（如 DT取消 能抢在走路取消之前）。
5. **idle/移动起手用通用取消（用法 A）**：这是少数场景，只在自由状态下生效。
6. **每个技能单独配取消表**：不要试图做"统一取消规则"，鬼泣每个技能的取消规则都不一样。重攻击可能只能被 DT取消，轻攻击走路就能取消。

---

## 附录 E：命令修饰符完整对照与扩展指南

> 这一附录把 MUGEN 支持的所有命令修饰符列清楚，对照我们 Love2D 设计的实现状态，并给出缺失部分的扩展方法。最后说明鬼泣类游戏的需求在哪些层次上需要超出 MUGEN 修饰符的能力。

### E.1 当前设计支持的修饰符

当前设计用 table 描述每个 key：`{name = "xxx", hold = true, release = true, charge_time = N}`。回顾 §4.4 的 `matchKey`：

```lua
function Command.matchKey(k, buf)
    local v = buf[k.name]
    if k.release then
        return v == -1                    -- ~ 释放
    elseif k.hold then
        if v <= 0 then return false end   -- / 按住
        if k.charge_time and v < k.charge_time then return false end  -- /N 蓄力按住
        return true
    else
        return v == 1                     -- 无修饰符：刚按下
    end
end
```

已支持 6 种：

| MUGEN 符号 | 当前设计写法 | 含义 | buffer 检查 |
|---|---|---|---|
| 无 | `{name = "a"}` | 刚按下 | `v == 1` |
| `/` | `{name = "a", hold = true}` | 按住 | `v > 0` |
| `~` | `{name = "a", release = true}` | 刚松开 | `v == -1` |
| `/N` | `{name = "a", hold = true, charge_time = N}` | 蓄力按住 N 帧 | `v >= N` |
| `+` | step 内多 key `{keys = {a, b}}` | 同时按（AND） | 全部满足 |
| `,` | steps 数组多元素 | 序列 | 逐 step 匹配 |

### E.2 MUGEN 支持的全部修饰符（Ikemen-GO 源码对照）

Ikemen-GO 的 `CommandStepKey`（`input.go:16-22`）和 `CommandStep`（`input.go:1940-1941`）定义了所有字段：

```go
type CommandStepKey struct {
    key        CommandKey
    slash      bool    // /  按住
    tilde      bool    // ~  释放
    dollar     bool    // $  宽松方向
    chargetime int32   // /N 或 ~N 蓄力时间
}
type CommandStep struct {
    greater  bool   // >  跟随符
    orLogic  bool   // |  OR 逻辑（默认 AND）
    ...
}
```

完整 10 种修饰符对照：

| MUGEN 符号 | 含义 | Ikemen-GO 字段 | 当前设计 | 状态 |
|---|---|---|---|---|
| 无 | 刚按下 | (默认) `t==1` | `v == 1` | ✅ |
| `/` | 按住 | `slash` `t>0` | `hold=true` `v>0` | ✅ |
| `~` | 释放 | `tilde` | `release=true` `v==-1` | ✅ |
| `/N` | 蓄力按住 N 帧 | `slash+chargetime` | `hold+charge_time` `v>=N` | ✅ |
| `~N` | 蓄力释放（按住 N 帧后松开） | `tilde+chargetime` | ❌ 缺失 | ⚠️ |
| `$` | 宽松方向（忽略冲突方向） | `dollar` | ❌ 缺失 | ⚠️ |
| `>` | 跟随符（两步间无其他输入翻转） | `greater` | ❌ 用 §9.6 清进度替代 | ⚠️ |
| `,` | 序列 | step 之间 | steps 数组 | ✅ |
| `+` | 同时(AND) | step 内多 key | step 内多 key | ✅ |
| <code>\|</code> | 或(OR) | `orLogic` | ❌ 缺失 | ⚠️ |

缺失 4 种：`~N`、`$`、`>`、`|`。下面逐个给出扩展方法。

### E.3 缺失修饰符的扩展实现

#### `~N` 蓄力释放

MUGEN 的 `~30a` = 按住 a 至少 30 帧后松开。当前 `release=true` 只判断"刚松开"（v==-1），没检查之前是否按住 N 帧。

需要在 InputBuffer 里额外记录每个键"松开前的按住时长"。扩展 `matchKey`：

```lua
function Command.matchKey(k, buf)
    local v = buf[k.name]
    if k.release then
        -- ~ 释放：刚松开
        if v ~= -1 then return false end
        -- ~N 蓄力释放：检查松开前是否按住了 N 帧
        if k.charge_time then
            -- buf 需要记录每个键松开前的按住时长
            return buf:holdTimeBeforeRelease(k.name) >= k.charge_time
        end
        return true
    elseif k.hold then
        if v <= 0 then return false end
        if k.charge_time and v < k.charge_time then return false end
        return true
    else
        return v == 1
    end
end
```

`holdTimeBeforeRelease` 的实现：在 buffer 更新时，每次键从"按住"变成"松开"（v 从正变 -1），把之前的 |v| 存到一个 `last_hold_time` 字段里。

对应 Ikemen-GO 源码 `input.go:1325-1340`，`tilde+chargetime` 组合在 State 函数里特殊处理。

#### `$` 宽松方向

MUGEN 的 `$D` = 按下下方向时忽略冲突方向（比如同时按 U 和 D，普通 `D` 会被 SOCD 干掉，`$D` 不会）。看 Ikemen-GO `input.go:901-932`：

```go
// $D：只要 Db>0 就算，返回所有方向的绝对值最小值
if __.Db > 0 {
    return Min(Abs(__.Ub), Abs(__.Db), Abs(__.Bb), Abs(__.Fb))
}
```

Love2D 实现：给 key 加 `dollar = true` 字段，matchKey 里对方向键特殊处理：

```lua
if k.dollar then
    -- 宽松方向：只检查这个方向 > 0，不管冲突方向
    -- 普通 SOCD 会让对立方向互相抵消，$ 跳过这个抵消
    return buf[k.name] > 0
end
```

`$` 主要用于方向键，对动作键（a/b/x/y）没意义。鬼泣类游戏用摇杆移动，`$` 用处不大，可以不实现。

#### `>` 跟随符

MUGEN 的 `F, >F` = 两个 F 之间不能有其他按键翻转。**文档 §9.6 已经用"命令完成时清其他命令进度"替代了 `>`**，并论证了为什么更好：

- `>` 太严格，会限制预输入和即时命令插入
- 清进度是"事后清理"，不影响搓招过程

**建议不实现 `>`**，用 §9.6 的清进度方案。如果一定要实现，给 step 加 `greater = true` 字段，在 matchStep 里检查前一个 step 完成后到当前 step 匹配前，是否有其他键的边沿翻转。

#### `|` OR 逻辑

MUGEN 的 `a|b` = a 或 b 任一刚按下即可。当前 step 内多 key 是 AND。给 step 加 `or_logic` 字段：

```lua
-- 命令定义：a 或 b 任一按下都算
{keys = {{name = "a"}, {name = "b"}}, or_logic = true}

-- matchStep 里判断
function Command.matchStep(step, buf)
    if step.or_logic then
        -- OR：任一 key 满足即可
        for _, k in ipairs(step.keys) do
            if Command.matchKey(k, buf) then return true end
        end
        return false
    else
        -- AND（默认）：全部满足
        for _, k in ipairs(step.keys) do
            if not Command.matchKey(k, buf) then return false end
        end
        return true
    end
end
```

对应 Ikemen-GO 源码 `input.go:2505-2527`（OR 分支）和 `2528-2549`（AND 分支）。

`|` 的典型用途：同一个招式可以用不同键触发（比如轻拳和重拳都能接的派生技），用 `|` 合并成一个 step。

### E.4 鬼泣类游戏的需求分层

**核心结论**：MUGEN 的命令修饰符能覆盖鬼泣的"按键序列"部分，但鬼泣的取消系统核心是**状态条件**（命中、踩怪、资源、后摇窗口），这不是命令修饰符能表达的，需要靠 `cancel_windows + condition` 扩展。

#### MUGEN 修饰符能覆盖的

| 鬼泣需求 | MUGEN 修饰符 | 是否满足 |
|---|---|---|
| 长按蓄力（锁链拉拽） | `/N`（charge_time） | ✅ |
| 蓄力释放（松开才发） | `~N`（需补全，见 E.3） | ⚠️ 补全后满足 |
| 同时按键组合（锁定+攻击=挑空） | `+`（AND） | ✅ |
| 按住连射（开枪连发） | `/`（hold） | ✅ |
| 同键多段连段 | `,`（序列）+ cancel_windows | ✅ |
| 缓冲下一招 | curbuftime | ✅ |
| 复杂搓招（十几步） | `,` 序列 | ✅（但定义会很长） |
| 同招不同键触发 | <code>\|</code>（OR，需补全，见 E.3） | ⚠️ 补全后满足 |

#### MUGEN 修饰符覆盖不了的（需要额外扩展）

| 鬼泣需求 | 为什么修饰符不够 | 怎么扩展 |
|---|---|---|
| **JC（跳跃取消）** | 需要"命中 + 踩怪 + 后摇窗口"，这是状态条件不是按键序列 | cancel_windows + `condition` 函数（附录 D.4） |
| **DT取消/真魔人取消** | 需要资源（魔人槽）条件 | cancel_windows + `condition` 检查资源 |
| **武器/风格切换** | 同样按键在不同武器/风格下出不同招 | 状态机分支 + 命令分流（§9.8） |
| **锁定+攻击=挑空** | 需要"锁定状态"条件，不是单纯按键组合 | 命令 + 状态标志检查 |
| **模拟压力（推杆力度）** | MUGEN 只有 bool，没有模拟轴 | Love2D 直接读 `joystick.getAxis`（§8.3 限制 5） |
| **多招预输入队列** | MUGEN 只缓冲下一招 | 意图队列（§9.9，高级特性） |

#### 三个层次各负责什么

| 层次 | 负责的事 | 例子 | 文档位置 |
|---|---|---|---|
| 命令修饰符（`/`、`~`、`+`、<code>\|</code>） | 表达"按键序列" | 波动拳 `D, DF, F+a` | §4.4、§4.5、本附录 |
| cancel_windows + condition | 表达"状态条件取消" | JC（命中+踩怪+后摇窗口） | §9.7、附录 D |
| 状态机分支 | 表达"不同状态下同键不同招" | 武器切换后按攻击出不同招 | §9.8 |

鬼泣 80% 的取消逻辑在第二层（cancel_windows + condition），不在第一层（命令修饰符）。做鬼泣时先把第一层（命令修饰符）做全，再把第二层（cancel_windows + condition）做扎实，第三层按需加。

### E.5 实践建议

1. **先做全第一层**：把 `~N`、`|` 补上（`$` 和 `>` 可以不做），命令修饰符就完整了
2. **重点在第二层**：鬼泣的取消系统核心是 cancel_windows + condition，不是命令修饰符
3. **`>` 不建议实现**：用 §9.6 的清进度替代，更灵活
4. **`$` 鬼泣用不上**：摇杆移动不需要 SOCD 宽松方向
5. **模拟轴单独读**：别试图塞进命令系统，直接读 `joystick.getAxis` 处理走路速度

### E.6 命令定义写法对比：table vs 符号字符串

这一节讨论"命令怎么定义"——用当前的 table 写法，还是用 MUGEN 风格的符号字符串（`~30a`、`/a+b`）。

#### 先澄清一个概念

MUGEN 里 `~30a` 写在**命令定义**里，不是 state 的 trigger 里。流程是两步：

```mugen
; 第一步：.cmd 文件定义命令（写字符串）
[Command]
name = "charge_release_a"
command = ~30a          ; ← 字符串在这里

; 第二步：state 的 trigger 只引用命令名
[State -1, Charge Release]
type = ChangeState
trigger1 = command = "charge_release_a"   ; ← 只写名字
```

Love2D 的结构完全一样，只是第一步用 table 代替字符串：

```lua
-- 第一步：定义命令（写 table）
local commands = {
    charge_release_a = {
        steps = {
            {keys = {{name = "a", release = true, charge_time = 30}}}
        }
    }
}

-- 第二步：状态机只查名字
if Command.isActive("charge_release_a") then ... end
```

所以"麻烦不麻烦"只在第一步（定义命令），第二步两者一样简单。定义一个命令只写一次，后面到处只引用名字，所以定义的冗长是可以接受的。

#### 两种写法对比

**符号写法（MUGEN 风格）**：

```lua
command = "~30a"            -- 简洁
command = "D, DF, F+a"      -- 一眼看出结构
```

| 优点 | 缺点 |
|---|---|
| 简洁、写起来快 | Lua 没有现成解析器，要自己写（约 100-200 行） |
| 可读性好，一眼看出命令结构 | 字符串拼写错误运行时才报错，IDE 不能补全 |
| 格斗游戏社区熟悉这种语法 | **表达不了函数条件**：鬼泣的 JC 需要 `condition = function(p) ... end`，字符串塞不进去 |
| | 难以扩展：加新修饰符要改解析器 |

**table 写法（当前设计）**：

```lua
{keys = {{name = "a", release = true, charge_time = 30}}}   -- 冗长但明确
```

| 优点 | 缺点 |
|---|---|
| 不需要解析器，Lua 直接读 | 简单命令也写得很长 |
| **能嵌函数**：`condition = function(p) ... end`（鬼泣核心需求） | 阅读时需要看多个字段 |
| IDE 能补全、能检查 | |
| 容易扩展：加新字段就行 | |
| 结构明确，每个字段含义清楚 | |

#### 为什么做鬼泣必须用 table

鬼泣的取消系统需要 `condition` 函数，这是字符串表达不了的：

```lua
-- JC（跳跃取消）：需要"命中 + 踩怪 + 后摇窗口"三个条件
states.aerial_combo_1 = {
    cancel_windows = {
        {
            start = 12, finish = 25,
            allowed = {"jump"},
            condition = function(player)
                return player.hit_count > 0       -- 必须命中
                   and player:enemyBelow()        -- 脚下有敌人（踩怪）
            end,
        },
    },
}
```

如果用字符串 `"aerial_jc"`，没法把 `hit_count > 0 and enemyBelow()` 塞进去。所以做鬼泣，**table 写法是必须的**，不能纯用字符串。

#### 推荐：table 为主，可选加字符串语法糖

两者可以结合：提供字符串解析器作为语法糖，简单命令用字符串写，底层转成 table。复杂命令（带 condition）用 table。

```lua
-- 简单命令：用字符串（语法糖）
local hadouken = Command.parse("D, /D+F, /F+a")

-- 复杂命令（带 condition）：用 table
local jc = {
    steps = {{keys = {{name = "jump"}}}},
    condition = function(p)
        return p.hit_count > 0 and p:enemyBelow()
    end
}
```

`Command.parse` 内部把字符串转成 table，两者最终都是 table。这样简单命令写得快，复杂命令能写函数，不强制。

#### 字符串解析器大概长这样

如果要做字符串解析器，核心就是拆字符串（约 40 行覆盖基本修饰符）：

```lua
function Command.parse(str)
    -- "D, /D+F, /F+a" → 3 个 step
    local steps = {}
    for _, stepStr in ipairs(split(str, ",")) do      -- 按 , 拆 step
        local keys = {}
        local orLogic = stepStr:find("|") ~= nil
        local parts = orLogic and split(stepStr, "|") or split(stepStr, "+")
        for _, part in ipairs(parts) do               -- 按 + 或 | 拆 key
            table.insert(keys, parseKey(part))
        end
        table.insert(steps, {keys = keys, or_logic = orLogic})
    end
    return {steps = steps}
end

function parseKey(s)
    s = s:trim()
    local hold, release, chargeTime = false, false, nil
    if s:sub(1,1) == "~" then                          -- ~30a → release + charge_time
        release = true
        s = s:sub(2)
        local n = s:match("^(%d+)")
        if n then chargeTime = tonumber(n); s = s:sub(#n+1) end
    elseif s:sub(1,1) == "/" then                      -- /a 或 /30a → hold + charge_time
        hold = true
        s = s:sub(2)
        local n = s:match("^(%d+)")
        if n then chargeTime = tonumber(n); s = s:sub(#n+1) end
    end
    return {name = s, hold = hold, release = release, charge_time = chargeTime}
end
```

`$` 和 `>` 需要额外处理，复杂度会增加。但鬼泣用不上这两个（附录 E.5），可以不实现。

#### 实践建议

1. **先全用 table 把功能做全**：别一上来就写解析器，功能没做全先写解析器容易返工
2. **系统跑起来后，如果觉得简单命令写得太长，再加 `Command.parse` 语法糖**
3. **复杂命令（带 condition）永远用 table**：字符串表达不了函数
4. **解析器只覆盖基本修饰符**（`/`、`~`、`+`、`|`、数字前缀）：`$` 和 `>` 不做

#### `~30a` 在两种写法下的对比

以"按住 a 30 帧后松开"为例：

```lua
-- 符号写法（需要解析器）
local cmd = Command.parse("~30a")

-- table 写法（当前设计，补全 ~N 后）
local cmd = {
    steps = {
        {keys = {{name = "a", release = true, charge_time = 30}}}
    }
}
```

table 写法长一些，但只写一次，后面引用都是 `Command.isActive("charge_release_a")`。真正的实现工作量不在写法长度，而在补全 `holdTimeBeforeRelease`（约 20 行，见 E.3）。

---

## 附录 F：完备的 -1 trigger 系统

> 正文 §4.5 和 `updateControl` 例子用 `cancel_windows` + `on_frame` 处理状态内取消，那是**教学简化版**。做完备的 -1 状态需要更完整的 trigger 系统。这一附录对比 MUGEN -1 的真实结构，给出 Love2D 的完整方案。

### F.1 MUGEN -1 的真实结构

从实际角色文件（Vergil.cmd）看，每个 `[State -1, ...]` 是一个独立的 ChangeState，结构是两层条件：

```mugen
[State -1, Judgement Cut End]     ; 大招
type = ChangeState
value = 3900
triggerall = !ishelper             ; 公共条件1：不是 helper
triggerall = !AIlevel              ; 公共条件2：不是 AI
triggerall = command = "DDD_ab"    ; 公共条件3：命令匹配
triggerall = power >= 2000         ; 公共条件4：资源够
triggerall = statetype != A        ; 公共条件5：不在空中
triggerall = roundstate = 2        ; 公共条件6：回合中
triggerall = p2life <= (enemynear,lifemax)*.25   ; 公共条件7：对手残血
triggerall = var(21) = 0           ; 公共条件8：变量
trigger1 = ctrl                    ; 途径1：有控制权直接出
trigger2 = (stateno = [400,420]) && movecontact  ; 途径2：4AB 系列命中取消
trigger3 = (stateno = [200,202]) && movecontact  ; 途径3：5A 系列命中取消
trigger4 = stateno = 350           ; 途径4：特定状态命中
trigger4 = movehit
trigger5 = stateno = 830 && movecontact
...
```

**两层条件的逻辑：**

| 层 | MUGEN 写法 | 逻辑 | 例子 |
|---|---|---|---|
| `triggerall` | 公共条件 | 所有 trigger 组都要满足（AND） | `command`、`power >= 2000`、`statetype != A` |
| `triggerN` | 进入途径 | 组间 OR，组内 AND | `trigger1 = ctrl` / `trigger2 = stateno=200 && movecontact` |

**trigger 能表达的条件类型（Vergil.cmd 实际用到的）：**

| 类别 | trigger | 例子 |
|---|---|---|
| 命令 | `command = "xxx"` / `command != "xxx"` | 命令匹配/排除 |
| 状态 | `stateno`、`statetype`、`prevstateno` | 当前/前一个状态 |
| 控制 | `ctrl` | 有无控制权 |
| 命中 | `movecontact`、`movehit` | 攻击命中 |
| 资源 | `power >= 2000`、`p2life <= ...` | 魔人槽/对手血量 |
| 动画 | `animelemtime(13) >= 0` | 动画特定帧 |
| 时间 | `time > 0` | 状态时间 |
| 位置 | `pos y >= 0` | 在地面 |
| 实体 | `NumHelper(3051) = 0`、`!ishelper` | helper 数量 |
| 变量 | `var(21) = 0` | 自定义变量 |
| 回合 | `roundstate = 2` | 回合状态 |
| AI | `!AIlevel` | 非 AI |

### F.2 当前 cancel_windows 的局限

文档当前 `updateControl` 用 cancel_windows + on_frame，是简化版。对比 MUGEN trigger，cancel_windows 表达不了的东西：

| MUGEN trigger 能表达 | cancel_windows 能表达？ |
|---|---|
| 多种进入途径（ctrl 直接出 / 命中取消 / 特定帧取消） | ❌ 只能"帧窗口 + 命令" |
| triggerall 公共排除条件（`command != "holddown"`） | ⚠️ 要塞进 condition 函数 |
| 资源条件作为独立维度（`power >= 2000`） | ⚠️ 要塞进 condition 函数 |
| 状态范围（`stateno = [200,202]`） | ❌ cancel_windows 是"当前状态内"的窗口 |
| 对手状态（`p2life`、`movehit`） | ⚠️ 要塞进 condition 函数 |

cancel_windows 适合"简单连段派生"（在状态 X 的帧 Y-Z 内按 A 切到下一刀），但做大招、Roman Cancel、复杂取消时力不从心。做完备的 -1 需要更完整的 trigger 系统。

### F.3 Love2D 完整方案：trigger entry 系统

模仿 MUGEN 的 triggerall + triggerN 结构，但用 Lua 函数表达条件，比字符串更灵活。

#### 定义：把 -1 的所有 entry 放一个表里

```lua
-- triggers_minus1.lua（类似 MUGEN 的 .cmd 文件 State -1 部分）
local M = {}

-- 辅助函数：封装常用 trigger（对应 MUGEN 的常用 trigger 关键字）
local T = {
    notHelper   = function(p) return not p:isHelper() end,
    notAI       = function(p) return not p:isAI() end,
    ctrl        = function(p) return p:ctrl() end,
    notCtrl     = function(p) return not p:ctrl() end,
    onGround    = function(p) return p.stateType ~= "A" end,
    inAir       = function(p) return p.stateType == "A" end,
    roundState2 = function(p) return p.roundState == 2 end,
    moveContact = function(p) return p:moveContact() end,
    moveHit     = function(p) return p:moveHit() end,
}

-- 命令匹配的辅助函数
local function cmd(name)    return function(p) return p:command(name) end end
local function notCmd(name) return function(p) return not p:command(name) end end
local function hold(name)   return function(p) return p:command("hold"..name) end end
local function notHold(name)return function(p) return not p:command("hold"..name) end end

-- 状态号
local function state(no)       return function(p) return p.stateNo == no end end
local function stateRange(a,b) return function(p) return p.stateNo >= a and p.stateNo <= b end end

-- 资源
local function powerGte(n)     return function(p) return p.power >= n end end

-- 动画帧
local function animElemGte(n)  return function(p) return p:animElemTime(n) >= 0 end end

M.entries = {
    -- ==================== 大招 ====================
    {
        name = "judgement_cut_end",
        changeState = 3900,
        priority = 100,                 -- 显式优先级（替代 MUGEN 书写顺序）
        triggerall = {
            T.notHelper, T.notAI,
            cmd("DDD_ab"),
            powerGte(2000),
            T.onGround,
            T.roundState2,
            function(p) return p.p2life <= p:enemyMaxLife() * 0.25 end,
            function(p) return p.var[21] == 0 end,
        },
        triggers = {                    -- 多组 OR
            { T.ctrl },                                         -- trigger1: 直接出
            { stateRange(400,420), T.moveContact },             -- trigger2: 4AB命中取消
            { stateRange(200,202), T.moveContact },             -- trigger3: 5A命中取消
            { stateRange(210,212), T.moveContact },             -- trigger4: 5B命中取消
            { state(350), T.moveHit },                          -- trigger5: 特定状态命中
            { state(830), T.moveContact },                      -- trigger6
            { state(620), function(p) return p.posY >= 0 end, T.moveContact }, -- trigger7
        },
    },

    -- ==================== 普通攻击 5A ====================
    {
        name = "5A",
        changeState = 200,
        priority = 10,                  -- 低优先级
        triggerall = {
            T.notHelper, T.notAI,
            cmd("a"),
            notHold("down"),            -- command != "holddown"
            T.onGround,
        },
        triggers = {
            { T.onGround, T.ctrl },                            -- trigger1: 站立有控制权
            { state(400), T.moveContact },                     -- trigger2: 2A命中取消
            { state(300), animElemGte(13), T.moveContact },    -- trigger3: 4A特定帧取消
        },
    },

    -- ==================== 次元斩释放（蓄力招） ====================
    -- 触发条件 = 命令 ~15a（按住 attack 15 帧后松开，§3.3 蓄力释放修饰符）
    -- 这就是 -2 层 updateFlags 里 charging/charge_frame 对应的"招式触发"，
    -- 和上面的 5A、波动拳一样是普通命令触发，没有任何特殊化。
    {
        name = "judgement_cut_release",
        changeState = 350,              -- 次元斩释放状态号
        priority = 60,
        triggerall = {
            T.notHelper, T.notAI,
            cmd("~15a"),                -- ★ 蓄力 15 帧后松开（命令系统已支持，§3.3）
            T.onGround,
            T.roundState2,
        },
        triggers = {
            { T.ctrl },                                         -- trigger1: 自由状态直接出
            { state(340) },                                     -- trigger2: 蓄力状态中松手（judgement_cut_charge）
        },
    },

    -- ==================== Jump Cancel ====================
    {
        name = "jump_cancel",
        changeState = 40,
        priority = 50,
        triggerall = {
            T.notHelper, T.notAI,
            hold("up"),                 -- command = "holdup"
        },
        triggers = {
            { state(100) },                                     -- trigger1: 跑步中
            { stateRange(200,202), T.moveContact },             -- trigger2: 5A系列命中
            { state(210), T.moveContact },                      -- trigger3: 5B命中
            { state(410), T.moveContact },                      -- trigger4: 2B命中
        },
    },

    -- ==================== Roman Cancel ====================
    {
        name = "roman_cancel",
        changeState = 6060,
        priority = 80,
        triggerall = {
            T.notHelper, T.notAI,
            function(p) return p.prevStateNo < 120 or p.prevStateNo > 159 end,  -- prevstateno != [120,159]
            function(p) return p.moveType ~= "H" end,          -- movetype != H
            T.onGround,
            function(p) return p:command("x") and p.power >= 1000 end,
            T.notCtrl,                                         -- !ctrl（RC 是取消中）
            function(p) return p.stateNo ~= 8000 end,
            function(p) return p.stateNo < 3000 or p.stateNo > 3999 end,  -- 不在超杀状态
            function(p) return p.time > 0 end,
        },
        triggers = {
            { T.moveContact },                                  -- trigger1: 命中
            { function(p) return p:numHelper(7777) > 0 end },  -- trigger2: 有特定helper
        },
    },
}

return M
```

#### 执行：updateControl 里按 priority 检查

```lua
local triggers_minus1 = require("triggers_minus1")

-- 加载时排序一次（不要每帧排序）
table.sort(triggers_minus1.entries, function(a, b)
    return a.priority > b.priority
end)

function Player:updateControl(dt, buf)
    -- 1. on_frame（状态内自定义逻辑，如红刀/完美次元斩）
    local state = states[self.state]
    if state.on_frame then
        state.on_frame(self, self.frame, buf)
        if self.state ~= state.name then
            self.state_changed = true
            return
        end
    end

    -- 2. ★ trigger entry 系统（完备的 -1 层）
    --    按 priority 降序检查，第一个满足的触发 ChangeState
    for _, entry in ipairs(triggers_minus1.entries) do
        -- 检查 triggerall（公共条件，全部满足）
        local allOk = true
        for _, cond in ipairs(entry.triggerall) do
            if not cond(self) then allOk = false break end
        end
        if not allOk then goto continue end

        -- 检查 triggers（多组 OR，任一满足即可）
        for _, group in ipairs(entry.triggers) do
            local groupOk = true
            for _, cond in ipairs(group) do
                if not cond(self) then groupOk = false break end
            end
            if groupOk then
                self:setState(entry.changeState)
                self.state_changed = true
                return  -- ★ 第一个满足的赢，后面的不检查
            end
        end
        ::continue::
    end

    -- 3. 即时命令（幻影剑、开枪等不进状态机的）
    updateInstantCommands(self, buf)
end
```

### F.4 和 MUGEN 的对比

| 维度 | MUGEN | Love2D trigger entry |
|---|---|---|
| 条件表达 | 字符串 trigger（`stateno = 200`） | Lua 函数（`function(p) return p.stateNo == 200 end`） |
| 公共条件 | `triggerall` 行 | `triggerall` 数组 |
| 进入途径 | `triggerN` 行（组间 OR，组内 AND） | `triggers` 数组（组间 OR，组内 AND） |
| 优先级 | 文件书写顺序（容易错） | 显式 `priority` 字段（清晰） |
| 子集冲突 | 靠书写顺序 + `command !=` | 靠 priority + 第一个满足 return |
| 扩展性 | 加新 trigger 要改引擎 | 加个 Lua 函数就行 |
| 调试 | 字符串拼错运行时才报错 | IDE 能补全，函数错有栈追踪 |

### F.5 trigger entry 和 cancel_windows 的关系

两者不冲突，可以共存或统一：

**方案 A：共存**
- 简单连段派生用 cancel_windows（数据驱动，简洁）
- 复杂大招/取消用 trigger entry（代码驱动，灵活）

**方案 B：统一（推荐）**
- 全用 trigger entry
- cancel_windows 作为语法糖，加载时自动转成 trigger entry：

```lua
-- cancel_windows 语法糖（适合简单连段）
states.light_combo_1 = {
    cancel_windows = {
        {start = 8, finish = 15, allowed = {"light_combo_2", "jc"}},
    },
}

-- 自动转换成 trigger entry（在加载时）
function convertCancelWindow(stateNo, window)
    local triggers = {}
    for _, name in ipairs(window.allowed) do
        table.insert(triggers, {
            cmd(name),
            function(p) return p.frame >= window.start and p.frame <= window.finish end,
            window.condition,  -- 可选的额外条件（如 hit_count > 0）
        })
    end
    return triggers
end
```

这样简单场景写 cancel_windows（短），复杂场景写 trigger entry（全），底层统一执行。

### F.6 文件组织建议

```
player/
├── commands.lua          -- 命令定义（波动拳、升龙拳的按键序列）
├── triggers_minus1.lua   -- -1 trigger entry（大招、攻击、取消的进入条件）
├── states/               -- 状态定义（每个状态号一个文件）
│   ├── 200.lua           -- 5A 攻击状态
│   ├── 3900.lua          -- 大招状态
│   └── ...
└── player.lua            -- Player 类（updateControl 等）
```

对应 MUGEN：

| Love2D 文件 | 对应 MUGEN | 职责 |
|---|---|---|
| `commands.lua` | `.cmd` 的 `[Command]` 部分 | 命令的按键序列定义 |
| `triggers_minus1.lua` | `.cmd` 的 `[State -1, ...]` 部分 | trigger entry（进入条件） |
| `states/` | `.cns` 文件 | 每个状态号的行为定义 |
| `player.lua` | 引擎的 state 执行逻辑 | updateControl / updateState 等 |

### F.7 实践建议

1. **先做 trigger entry 的执行器**（§F.3 的 `updateControl`），约 30 行
2. **把常用 trigger 封装成辅助函数**（`T.ctrl`、`cmd()`、`state()` 等），避免每个 entry 都写一长串函数
3. **加载时按 priority 排序一次**，不要每帧排序
4. **简单连段用 cancel_windows 语法糖，复杂取消用 trigger entry**，底层统一（§F.5 方案 B）
5. **priority 数字留间隔**（10/50/80/100 而不是 1/2/3/4），方便插入新 entry
6. **即时命令（幻影剑/开枪）不走 trigger entry**，仍用 `updateInstantCommands` 单独处理（因为它们不切状态）

### F.8 总结

| 问题 | 答案 |
|---|---|
| cancel_windows 够用吗 | 教学够用，做完备 -1 不够。表达不了 triggerall、多途径、资源条件 |
| Love2D 怎么做完备 -1 | trigger entry 系统：triggerall + triggers 数组，用 Lua 函数表达条件 |
| 在哪定义 | `triggers_minus1.lua`（对应 MUGEN .cmd 的 State -1 部分） |
| 解析顺序 | 显式 priority 字段降序，第一个满足 return（替代 MUGEN 书写顺序） |
| 和 cancel_windows 关系 | 可共存，或 cancel_windows 作为语法糖转成 trigger entry |
| 比 MUGEN 好在哪 | priority 显式、Lua 函数比字符串灵活、IDE 能补全、扩展简单 |

核心思路：**MUGEN 的 trigger 系统本质是"triggerall(AND) + 多组 trigger(OR)"，Love2D 用 Lua 函数数组直接表达这个结构，比字符串 trigger 更灵活更安全。**

### F.9 类型安全：用 LuaCATS 注解

上面 F.3 的 trigger entry 代码用了很多 `p:command("x")`、`p:moveContact`、`T.ctrl` 这种写法。这一节解释这些写法的含义，以及为什么**必须上类型注解**否则容易出错。

#### Lua 语法预热：函数作为值

trigger entry 系统用到一个 Lua 特性：**函数是一等公民**，可以像数字、字符串一样存在 table 里、取出来调用。这一特性是 trigger entry 系统的基础。

```lua
-- table 里存函数
local entry = {
    triggerall = {
        function(p) return not p.isHelper end,   -- 函数1
        function(p) return p:command("a") end,   -- 函数2
    },
}

-- 遍历数组，取函数出来调用
for _, cond in ipairs(entry.triggerall) do
    -- cond 是函数（不是 table），cond(self) 调用它
    -- self 是 Player 实例，传给函数的参数 p
    if not cond(self) then break end
end
```

**多参数**：函数可以有多个参数。如果 trigger 需要读 InputBuffer，加一个参数即可：

```lua
-- 定义：函数接收 Player 和 InputBuffer 两个参数
local function pressed(key)
    return function(p, buf) return buf[key] == 1 end
end

-- 类型注解变成两个参数
---@field triggerall (fun(p: Player, buf: InputBuffer): boolean)[]

-- 调用时传两个参数
for _, cond in ipairs(entry.triggerall) do
    if not cond(self, buf) then break end
end
```

**闭包捕获（推荐）**：大部分额外参数通过闭包捕获，函数签名保持单参数 `fun(p: Player): boolean`，调用处只需 `cond(self)`。`cmd("a")` 就是闭包：

```lua
local function cmd(name)
    -- name 被闭包捕获，函数参数只有 p
    return function(p) return p:command(name) end
end

local c = cmd("a")  -- c = function(p) return p:command("a") end
c(player)           -- 调用，name="a" 是闭包里捕获的，不用额外传
```

trigger entry 系统统一用单参数签名 `fun(p: Player): boolean`，额外数据（命令名、状态号、资源阈值）都通过闭包捕获传入。这样调用处统一是 `cond(self)`，简洁且类型安全。只有需要读原始 InputBuffer（绕过 command 系统直接看按键）时才用多参数。

#### M 和 T 是什么

- **`M`**：Lua 模块模式的惯例缩写（Module）。`local M = {}` 创建 table，往里塞内容，`return M` 导出。其他文件 `require` 时拿到这个 table。只是命名惯例，不是语法。
- **`T`**：trigger 辅助函数集合的缩写（Triggers）。把常用 trigger 条件封装成可复用函数，`T.ctrl` 比 `function(p) return p:ctrl() end` 短。也是命名惯例，可以叫 `trig` 或别的。

#### `p:command` 是面向对象语法

Lua 没有 `class` 关键字，用 table + 冒号语法模拟面向对象：

```lua
-- 冒号语法（语法糖）
p:command("x")
-- 等价于点语法（手动传 self）
p.command(p, "x")
```

需要 Player 类（一个 table）里定义了 `command` 方法：

```lua
Player = {}
Player.__index = Player

function Player:command(name)
    -- self 就是 p
    return Command.isActive(name)  -- 查命令的 curbuftime
end
```

#### 为什么容易出错

Lua 是**动态类型**，没有编译期检查。这些问题都会发生：

```lua
T.moveContact = function(p) return p:moveContact() end
-- 如果 Player 类没有 moveContact 方法，或者写错成 movecontact（小写）
-- 运行时才报：attempt to call a nil value (method 'movecontact')
-- 而且只在触发到这个 trigger 时才报，不触发不报——很难排查
```

对比 MUGEN：`movecontact` 是引擎内置关键字，拼错了加载时引擎直接报错。Lua 没有这个保护。做鬼泣这种 trigger 密集的项目，上百个 entry 里有一个拼错，排查到崩溃。

#### 解决方案：LuaCATS 类型注解

Lua 有一个类型注解标准叫 **LuaCATS**，VS Code 装 **Lua Language Server** 插件后能做类型提示、补全、错误检查，效果接近 TypeScript。

##### 1. 定义 Player 类的类型

在一个单独文件里声明 Player 有哪些字段和方法：

```lua
---types.lua：定义所有类型

---@class Player
---@field stateNo integer       -- 当前状态号（对应 MUGEN stateno）
---@field stateType string      -- "S"/"C"/"A"/"L"（对应 MUGEN statetype）
---@field moveType string       -- "I"/"A"/"H"（对应 MUGEN movetype）
---@field prevStateno integer   -- 前一个状态号
---@field power integer         -- 魔人槽
---@field time integer          -- 当前状态时间
---@field posY number           -- y 坐标
---@field var table             -- 变量数组（var[0]、var[1]...）
---@field roundState integer    -- 回合状态
---@field p2life number         -- 对手血量
---@field ctrl boolean          -- 有无控制权
---@field isHelper boolean      -- 是否 helper
---@field isAI boolean          -- 是否 AI
---@field command fun(self: Player, name: string): boolean   -- 查命令
---@field moveContact boolean   -- 是否命中
---@field moveHit boolean       -- 是否命中（更严格）
---@field animElemTime fun(self: Player, n: integer): integer
---@field enemyMaxLife fun(self: Player): number
---@field numHelper fun(self: Player, id: integer): integer
```

##### 2. trigger 文件加类型注解

```lua
-- triggers_minus1.lua

-- 导入类型定义（让 IDE 认识 Player 类型）
require("types")

local M = {}

-- 辅助函数：每个都标注参数类型，IDE 能检查
---@param p Player
local T = {
    notHelper   = function(p) return not p.isHelper end,
    notAI       = function(p) return not p.isAI end,
    ctrl        = function(p) return p.ctrl end,
    notCtrl     = function(p) return not p.ctrl end,
    onGround    = function(p) return p.stateType ~= "A" end,
    inAir       = function(p) return p.stateType == "A" end,
    roundState2 = function(p) return p.roundState == 2 end,
    moveContact = function(p) return p.moveContact end,
    moveHit     = function(p) return p.moveHit end,
}

---@param name string
---@return fun(p: Player): boolean
local function cmd(name)
    return function(p) return p:command(name) end
end

---@param name string
---@return fun(p: Player): boolean
local function notHold(name)
    return function(p) return not p:command("hold" .. name) end
end

---@param no integer
---@return fun(p: Player): boolean
local function state(no)
    return function(p) return p.stateNo == no end
end

---@param a integer
---@param b integer
---@return fun(p: Player): boolean
local function stateRange(a, b)
    return function(p) return p.stateNo >= a and p.stateNo <= b end
end

---@param n integer
---@return fun(p: Player): boolean
local function powerGte(n)
    return function(p) return p.power >= n end
end

-- trigger entry 的类型
---@class TriggerEntry
---@field name string
---@field changeState integer
---@field priority integer
---@field triggerall (fun(p: Player): boolean)[]
---@field triggers (fun(p: Player): boolean)[][]

---@type TriggerEntry[]
M.entries = {
    {
        name = "5A",
        changeState = 200,
        priority = 10,
        triggerall = {
            T.notHelper, T.notAI,
            cmd("a"),
            notHold("down"),
            T.onGround,
        },
        triggers = {
            { T.onGround, T.ctrl },
            { state(400), T.moveContact },
        },
    },
}

return M
```

##### 3. 写 trigger 时 IDE 能帮你

有了类型注解后，VS Code + Lua Language Server 的效果：

| 场景 | 没有注解 | 有 LuaCATS 注解 |
|---|---|---|
| 写 `p:comand("x")`（拼错） | 运行时才报 nil | IDE 立即标红 |
| 写 `p.moveContact`（漏冒号，拿到函数本身） | 运行时逻辑错（truthy） | IDE 提示类型不匹配 |
| 输入 `p:` | 没有提示 | 弹出补全列表（command、moveContact、ctrl...） |
| triggerall 里塞了非函数 | 运行时调用才报错 | IDE 标红类型不匹配 |
| hover 看函数签名 | 看不了 | 显示 `fun(p: Player): boolean` |
| 跳转到定义 | 不行 | Ctrl+点击跳到 Player 定义 |

#### 实践建议

1. **一定要上 LuaCATS 注解**：trigger 密集项目没类型检查等于裸奔
2. **类型定义集中放 `types.lua`**：Player 类的所有字段/方法在一个文件里声明，其他文件 `require("types")` 导入
3. **每个辅助函数标注 `---@param p Player`**：IDE 才知道函数里 `p` 是什么类型
4. **用 `---@type TriggerEntry[]` 标注 entries**：IDE 检查每个 entry 的结构是否完整（漏写 priority 会标红）
5. **字段 vs 方法的注解区别**：
   - `---@field ctrl boolean`：直接读字段，`p.ctrl`
   - `---@field command fun(self: Player, name: string): boolean`：调方法，`p:command("x")`
   - 布尔类的（ctrl、moveContact）建议做成字段，每帧由引擎更新；查询类的（command、numHelper）做成方法
6. **开发期加运行时断言**（可选）：在 Player 初始化时检查方法是否存在

```lua
-- dev 模式下的运行时检查
local function assertPlayerInterface(p)
    local required = {"command", "moveContact", "moveHit", "animElemTime"}
    for _, name in ipairs(required) do
        assert(type(p[name]) == "function", "Player 缺少方法: " .. name)
    end
end
```

#### 总结

| 问题 | 答案 |
|---|---|
| M、T 是什么 | M 是模块惯例缩写，T 是 trigger 辅助函数集合缩写，都只是命名惯例 |
| `p:command` 是类语法吗 | 是。Lua 冒号语法，`p:command("x")` 等价于 `p.command(p, "x")` |
| 动态类型容易出错吗 | 会。拼错方法名运行时才报错，不触发不报 |
| 怎么解决 | LuaCATS 类型注解 + VS Code Lua Language Server 插件 |
| 改进后的写法 | 定义 `---@class Player` 列出所有字段/方法，trigger 函数标注 `---@param p Player`，IDE 补全+检查 |

**关键结论**：做鬼泣这种 trigger 密集的项目，**一定要上 LuaCATS 注解**。注解写一次，受益整个项目——IDE 补全、错误标红、跳转定义，开发效率和安全性大幅提升。

---

## 结语

读完这篇你应该明白：

1. **输入系统 = 按键状态 + 缓冲 + 命令匹配 + hitstop 处理**。就这四件事。
2. **缓冲是核心**。每个按键一个有符号计数器，正=按住、负=松开、1/-1=边沿。一个数字代替一切。
3. **hitstop 期间输入照常读，命令匹配照常跑，只是 cur_buffer_time 不递减**。这是动作游戏预输入的关键。
4. **MUGEN 的设计可以迁移到 Love2D**，而且用 Lua 表定义命令比 MUGEN 的字符串更灵活。
5. **做鬼泣先用 MUGEN 风格的三件套**：命令缓冲（curbuftime）+ 取消窗口 + 优先级顺序。这够做普通连段。
6. **输入处理有三种方式**：状态切换命令走 cancel_windows；即时动作命令走边沿触发+spawn（不进状态机）；状态内输入检测走 on_frame（完美次元斩/红刀这类状态内精确输入）。
7. **状态 vs 标志**：影响角色动作用状态（攻击、跳跃、次元斩释放）；不影响角色动作用标志（蓄力、红刀、锁定、无敌）。角色同时只能一个状态，但可以叠加多个标志。蓄力是标志所以能边跑边蓄力。
8. **防止借用**：状态切换命令完成时，清掉其他状态切换命令的 step 进度。不限制预输入，不影响即时命令，比 `>` 跟随符更实用。
9. **意图队列是高级特性，不是基础**。先做简单版本，玩起来发现不够再加。

你现在能自己写一个输入系统了吗？

**能。** 第七章那份代码就是最小可运行版本。从那里开始，按第九章的扩展顺序一步步加功能，最后能做出一个完整的鬼泣风格输入系统。

祝你做出好游戏。

---

*文档完。如有疑问可以对照 `mugen-input-system-analysis.md`（详细技术版）查阅源码级细节。*
