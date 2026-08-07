# 给新人：从 MUGEN 角色系统到 Love2D 2D 横版鬼泣（Part 3）

> 这篇文档承接 Part 1（角色系统）和 Part 2（战斗系统）。
>
> Part 1 讲了：角色文件结构、状态系统、SCTRL、Trigger、动画系统。
> Part 2 讲了：物理、碰撞检测、命中系统、特效、高级系统、鬼泣特色、相机系统。
>
> Part 3 讲辅助系统：音效、UI、背景视差、敌人 AI、资源管理、调试、关卡。

---

## 第十三章：音效系统

前面各章到处用 `playSound("xxx")`，但没讲音效怎么管理。这一章讲完整的音效系统——音效播放、音量控制、战斗音乐随评价动态切换。

### 13.1 音效系统做什么

```
音效分类：
├── 即时音效（命中/挥刀/跳跃/落地）    → 命中瞬间播放，短促
├── 循环音效（蓄力嗡鸣/持续效果）      → 持续播放，状态结束停止
├── BGM（背景音乐）                    → 持续播放，可切换
└── 战斗音乐动态切换                    → 评价 D→SSS 音乐越来越激烈
```

### 13.2 MUGEN 的音效系统

MUGEN 用 `.snd` 文件打包所有音效，用组号+图号索引（和 SFF 类似）：

```ini
; MUGEN 播放音效
[State 200, 挥刀音]
type = PlaySnd
trigger1 = animelem = 2
value = 0, 5          ; 组号0, 图号5

; MUGEN 停止音效
[State 200, 停止脚步]
type = StopSnd
trigger1 = animelem = 3
value = 10, 0         ; 停止组号10的音效

; MUGEN BGM 切换
[State 3000, 大招BGM]
type = ChangeMusic
trigger1 = time = 0
bgm = bgm/super.nsf
bgm.loop = 1
```

MUGEN 的音效参数：

| 参数 | 含义 | 例子 |
|---|---|---|
| `value` | 组号,图号 | `0, 5` |
| `volume` | 音量（0-255，默认256） | `200` |
| `pan` | 左右声道（0=居中） | `-50`（偏左） |
| `loop` | 是否循环 | `1`（循环） |
| `freqmul` | 频率倍率（变调） | `1.5`（高音） |

### 13.3 我们的方案：外置音频文件

不用 `.snd` 打包，用外置音频文件 + 路径引用（和精灵图一样）：

```
characters/vergil/
├── sounds/
│   ├── slash_light.wav      ← 轻击
│   ├── slash_heavy.wav       ← 重击
│   ├── hit_light.wav         ← 命中（轻）
│   ├── hit_heavy.wav         ← 命中（重）
│   ├── jump.wav
│   ├── land.wav
│   ├── charge_loop.wav       ← 蓄力嗡鸣循环
│   └── ...
│
├── bgm/
│   ├── battle_normal.ogg    ← 正常战斗音乐
│   ├── battle_s.ogg         ← S评价音乐（更激烈）
│   └── battle_sss.ogg       ← SSS评价音乐（最激烈）
│
└── ...
```

### 13.4 音效数据库

```lua
-- sound_db.lua：音效数据库
local SoundDB = {
    -- 即时音效
    slash_light = { path = "sounds/slash_light.wav", volume = 0.8 },
    slash_heavy = { path = "sounds/slash_heavy.wav", volume = 1.0 },
    hit_light = { path = "sounds/hit_light.wav", volume = 0.7 },
    hit_heavy = { path = "sounds/hit_heavy.wav", volume = 1.0 },
    hit_counter = { path = "sounds/hit_counter.wav", volume = 1.0 },
    parry = { path = "sounds/parry.wav", volume = 1.0 },
    jump = { path = "sounds/jump.wav", volume = 0.6 },
    land = { path = "sounds/land.wav", volume = 0.5 },
    enemy_step = { path = "sounds/enemy_step.wav", volume = 0.6 },
    dt_activate = { path = "sounds/dt_activate.wav", volume = 1.0 },

    -- 循环音效（蓄力等，脚步用帧事件不用循环）
    charge_loop = { path = "sounds/charge_loop.wav", volume = 0.4, loop = true },

    -- BGM
    bgm_normal = { path = "bgm/battle_normal.ogg", volume = 0.7, loop = true },
    bgm_s = { path = "bgm/battle_s.ogg", volume = 0.7, loop = true },
    bgm_sss = { path = "bgm/battle_sss.ogg", volume = 0.8, loop = true },
}
```

### 13.5 SoundManager 实现

```lua
-- sound_manager.lua：音效管理器
local SoundManager = {
    sources = {},       -- 已加载的音频源（path → Source）
    active_loops = {},  -- 正在播放的循环音效（name → Source）
    bgm = nil,          -- 当前 BGM
    bgm_name = nil,     -- 当前 BGM 名称
    master_volume = 1.0,-- 主音量
    sfx_volume = 1.0,   -- 音效音量
    bgm_volume = 0.7,   -- BGM 音量
}

--- 加载音频源（带缓存）
function SoundManager:getSource(path)
    if not self.sources[path] then
        self.sources[path] = love.audio.newSource(path, "static")
    end
    return self.sources[path]:clone()  -- clone 让同一音效可同时播放
end

--- 播放即时音效
---@param name string 音效名（SoundDB 的 key）
---@param volumeScale number 可选音量倍率（默认1.0）
function SoundManager:playSfx(name, volumeScale)
    local data = SoundDB[name]
    if not data then return end

    local source = self:getSource(data.path)
    source:setVolume((data.volume or 1.0) * self.sfx_volume * self.master_volume * (volumeScale or 1.0))
    source:setLooping(false)
    love.audio.play(source)
end

--- 播放循环音效（如蓄力嗡鸣，脚步不用循环用帧事件）
---@param name string 音效名
function SoundManager:playLoop(name)
    local data = SoundDB[name]
    if not data then return end

    -- 已在播放 → 不重复
    if self.active_loops[name] then return end

    local source = self:getSource(data.path)
    source:setVolume((data.volume or 0.3) * self.sfx_volume * self.master_volume)
    source:setLooping(true)
    love.audio.play(source)
    self.active_loops[name] = source
end

--- 停止循环音效
---@param name string 音效名
function SoundManager:stopLoop(name)
    if self.active_loops[name] then
        love.audio.stop(self.active_loops[name])
        self.active_loops[name] = nil
    end
end

--- 停止所有循环音效
function SoundManager:stopAllLoops()
    for name, source in pairs(self.active_loops) do
        love.audio.stop(source)
    end
    self.active_loops = {}
end

--- 播放 BGM
---@param name string BGM 名
function SoundManager:playBgm(name)
    if self.bgm_name == name then return end  -- 已在播放

    -- 停止当前 BGM
    if self.bgm then
        love.audio.stop(self.bgm)
    end

    -- 加载新 BGM
    local data = SoundDB[name]
    if not data then return end

    -- BGM 用 stream 模式（节省内存）
    self.bgm = love.audio.newSource(data.path, "stream")
    self.bgm:setVolume((data.volume or 0.7) * self.bgm_volume * self.master_volume)
    self.bgm:setLooping(data.loop ~= false)
    love.audio.play(self.bgm)
    self.bgm_name = name
end

--- 停止 BGM
function SoundManager:stopBgm()
    if self.bgm then
        love.audio.stop(self.bgm)
        self.bgm = nil
        self.bgm_name = nil
    end
end

--- 设置主音量
function SoundManager:setMasterVolume(vol)
    self.master_volume = vol
end

--- 设置音效音量
function SoundManager:setSfxVolume(vol)
    self.sfx_volume = vol
end

--- 设置 BGM 音量
function SoundManager:setBgmVolume(vol)
    self.bgm_volume = vol
    if self.bgm then
        local data = SoundDB[self.bgm_name]
        self.bgm:setVolume((data.volume or 0.7) * self.bgm_volume * self.master_volume)
    end
end

return SoundManager
```

### 13.6 使用场景

#### 命中音效（§8.4 命中系统）

```lua
function HitSystem.onHit(event)
    local hd = event.hitdef

    -- 命中音效
    SoundManager:playSfx("hit_" .. (hd.hit_type or "light"))

    -- counter hit 特殊音效
    if event.is_counter then
        SoundManager:playSfx("hit_counter")
    end
end
```

#### 帧事件音效（§5.7 帧事件）

```lua
-- states/200.lua：攻击状态
State.events = {
    { elem = 2, action = "sound", params = { "slash_heavy" } },
    { elem = 5, action = "spawn", params = { "phantom_sword", "sword_tip" } },
}

function State:fireEvent(player, event)
    if event.action == "sound" then
        SoundManager:playSfx(event.params[1])
    end
end
```

#### 脚步音效：落脚帧播放（不是循环播放）

脚步音不应该用循环播放（和动画不同步），应该用**帧事件在落脚帧播放**——和挥刀音效在特定帧播放一样：

```
循环播放（错误）：
  进入行走状态 → 开始循环播放脚步音 → 离开状态停止
  问题：脚步音和动画不同步，可能脚没落地就响了

落脚帧播放（正确）：
  行走动画帧0：脚抬起 → 无音
  行走动画帧2：脚落地 → ★ 播放脚步音
  行走动画帧4：脚抬起 → 无音
  行走动画帧6：脚落地 → ★ 播放脚步音
```

```lua
-- 行走动画的帧事件
State.events = {
    { elem = 2, action = "footstep" },   -- 第2帧落脚
    { elem = 4, action = "footstep" },   -- 第4帧落脚
}

function State:fireEvent(player, event)
    if event.action == "sound" then
        SoundManager:playSfx(event.params[1])
    elseif event.action == "footstep" then
        -- 脚步音：按角色 x 位置查询地面材质
        local material = player:getGroundMaterial()
        SoundManager:playSfx("footstep_" .. material)
    end
end
```

#### 不同地面材质不同脚步音

角色踩在不同材质上应该有不同声音。材质按角色 **x 位置查询**（不是全局设置）——关卡地形分段定义不同材质区域：

```
关卡地形：
  ┌──────────────┬──────────────┬──────────────┐
  │   stone      │    grass     │    wood      │
  │  x < 500     │ 500 ≤ x < 1200│  x ≥ 1200   │
  └──────────────┴──────────────┴──────────────┘
       │              │               │
    角色 A          角色 B          角色 C
    footstep_stone  footstep_grass  footstep_wood
```

```lua
-- stage.lua：关卡的地面材质区域表
local Stage = {
    ground_materials = {
        -- { x 范围, 材质 }
        { x_start = -9999, x_end = 500,  material = "stone" },   -- 左边石头
        { x_start = 500,   x_end = 1200, material = "grass" },   -- 中间草地
        { x_start = 1200,  x_end = 9999, material = "wood" },    -- 右边木板
    },
}

--- 查询某 x 位置的地面材质
---@param x number 世界坐标 x
---@return string 材质名
function Stage:getGroundMaterial(x)
    for _, region in ipairs(self.ground_materials) do
        if x >= region.x_start and x < region.x_end then
            return region.material
        end
    end
    return "stone"  -- 默认石头
end
```

角色按自己的 x 位置查询：

```lua
function Player:getGroundMaterial()
    return Stage:getGroundMaterial(self.x)
end
```

落地音效也根据材质选：

```lua
-- 落地时
function State:onEnter(player)  -- states/50.lua 落地状态
    local material = player:getGroundMaterial()
    SoundManager:playSfx("land_" .. material)
end
```

**进阶：2D 区域（矩形而非 x 范围）**

如果材质不只按 x 分，还按 y 分（如上层金属平台、下层草地）：

```lua
local Stage = {
    ground_materials = {
        -- { x1, y1, x2, y2, 材质 }（矩形区域）
        { x1 = -9999, y1 = 380, x2 = 500,  y2 = 420, material = "stone" },
        { x1 = 500,   y1 = 380, x2 = 1200, y2 = 420, material = "grass" },
        { x1 = 1200,  y1 = 380, x2 = 9999, y2 = 420, material = "wood" },
        -- 上层金属平台
        { x1 = 600,   y1 = 200, x2 = 900,  y2 = 220, material = "metal" },
    },
}

function Stage:getGroundMaterial(x, y)
    for _, region in ipairs(self.ground_materials) do
        if x >= region.x1 and x < region.x2
           and y >= region.y1 and y < region.y2 then
            return region.material
        end
    end
    return "stone"
end

function Player:getGroundMaterial()
    return Stage:getGroundMaterial(self.x, self.y)
end
```

**初级版用 x 范围查询就够了**（横版游戏地面材质通常按 x 分段），2D 矩形区域是进阶。

#### 空间混响（进阶概念）

不同空间的混响不同——洞穴有回音，室外没有：

| 空间 | 混响 | 延迟 | 效果 |
|---|---|---|---|
| 室外 | 0.0 | 0 | 无回音，干涩 |
| 房间 | 0.2 | 0.05s | 轻微回音 |
| 大厅 | 0.4 | 0.1s | 明显回音 |
| 洞穴 | 0.6 | 0.15s | 强回音 |

```lua
-- 空间混响配置
local ReverbPresets = {
    outdoor = { reverb = 0.0, delay = 0.0 },
    cave = { reverb = 0.6, delay = 0.15 },
    hall = { reverb = 0.4, delay = 0.1 },
    room = { reverb = 0.2, delay = 0.05 },
}

-- 切换空间时设混响
function SoundManager:setReverb(presetName)
    self.current_reverb = ReverbPresets[presetName] or ReverbPresets.outdoor
end
```

**Love2D 的限制**：Love2D 没有内置混响效果器。要实现混响需要：
- 用 LoveFX（Love2D 音频效果插件）
- 或用外部音频中间件（FMOD/Wwise）
- 或**简化版**：预先制作带混响的音效文件（洞穴版/室外版两套音效）

**初级版本**：

| 功能 | 初级版 | 进阶版 |
|---|---|---|
| 脚步音 | ✅ 帧事件在落脚帧播放 | — |
| 不同材质 | ❌ 先统一一种脚步音 | ✅ 按地面材质选不同音效 |
| 混响 | ❌ 不做 | ✅ 预制带混响的音效 或 LoveFX |

#### 其他场景

```lua
-- 跳跃
SoundManager:playSfx("jump")

-- 落地（根据材质）
local material = player:getGroundMaterial()
SoundManager:playSfx("land_" .. material)

-- 踩怪
SoundManager:playSfx("enemy_step")

-- 弹反
SoundManager:playSfx("parry")

-- 魔人化
SoundManager:playSfx("dt_activate")
```

### 13.7 战斗音乐随评价动态切换

鬼泣的核心特色：评价越高音乐越激烈。

```lua
-- 评价对应 BGM
local BGM_BY_RANK = {
    D = "bgm_normal",
    C = "bgm_normal",
    B = "bgm_normal",
    A = "bgm_normal",
    S = "bgm_s",          -- S 以上切激烈音乐
    SS = "bgm_s",
    SSS = "bgm_sss",       -- SSS 最激烈
}

-- 评价变化时切换 BGM
function StyleSystem:onRankChange(newRank)
    local bgmName = BGM_BY_RANK[newRank] or "bgm_normal"
    SoundManager:playBgm(bgmName)
end
```

```
评价 D-A：bgm_normal（正常战斗音乐）
评价 S-SS：bgm_s（加入激烈乐器/鼓点）
评价 SSS：bgm_sss（全乐器全开，最激烈）

评价下降（衰减到 A 以下）→ 切回 bgm_normal
```

**BGM 切换时的淡入淡出**（避免硬切）：

```lua
function SoundManager:playBgmWithFade(name, fadeDuration)
    fadeDuration = fadeDuration or 30  -- 30帧淡入淡出

    -- 先淡出当前 BGM
    if self.bgm then
        self.bgm_fade_out = {
            source = self.bgm,
            duration = fadeDuration,
            current = 0,
        }
        self.bgm = nil
        self.bgm_name = nil
    end

    -- 淡入新 BGM
    local data = SoundDB[name]
    if data then
        self.bgm = love.audio.newSource(data.path, "stream")
        self.bgm:setVolume(0)  -- 从0开始
        self.bgm:setLooping(data.loop ~= false)
        love.audio.play(self.bgm)
        self.bgm_name = name
        self.bgm_fade_in = {
            source = self.bgm,
            target_volume = (data.volume or 0.7) * self.bgm_volume * self.master_volume,
            duration = fadeDuration,
            current = 0,
        }
    end
end

-- 每帧更新淡入淡出
function SoundManager:updateFade()
    if self.bgm_fade_out then
        local f = self.bgm_fade_out
        f.current = f.current + 1
        local vol = 1 - (f.current / f.duration)
        f.source:setVolume(vol * (f.target_volume or 0.7))
        if f.current >= f.duration then
            love.audio.stop(f.source)
            self.bgm_fade_out = nil
        end
    end

    if self.bgm_fade_in then
        local f = self.bgm_fade_in
        f.current = f.current + 1
        local vol = f.current / f.duration
        f.source:setVolume(vol * f.target_volume)
        if f.current >= f.duration then
            self.bgm_fade_in = nil
        end
    end
end
```

### 13.8 音量分层

#### 固定比例（大部分情况）

```lua
-- 三层音量控制
SoundManager.master_volume = 1.0   -- 主音量（设置菜单调）
SoundManager.sfx_volume = 1.0       -- 音效音量
SoundManager.bgm_volume = 0.7       -- BGM 音量（默认比音效小）
```

每个音效的相对音量也固定：

```lua
-- 正常游戏中：
-- BGM:     ████████░░  70%    ← 背景，不盖音效
-- 音效:    ██████████  100%   ← 命中/挥刀最突出
-- 脚步:    ███░░░░░░░  30%    ← 小声，不干扰

SoundDB = {
    slash_heavy = { volume = 1.0 },   -- 重击：最大
    slash_light = { volume = 0.8 },   -- 轻击：稍小
    jump = { volume = 0.6 },         -- 跳跃：更小
    footstep_stone = { volume = 0.3 }, -- 脚步：最小
}
```

设置菜单：

```lua
function Settings:onSfxVolumeChange(value)
    SoundManager:setSfxVolume(value)  -- 0.0-1.0
end

function Settings:onBgmVolumeChange(value)
    SoundManager:setBgmVolume(value)
end
```

#### BGM duck：动态压低让位

大部分音量比例是固定的。少数场景需要**动态调整**——最常见的是 **BGM duck**：大招演出时 BGM 压低，让位给演出音效。

```
正常游戏中：
  BGM:     ████████░░  70%
  音效:    ██████████  100%

大招演出时（duck）：
  BGM:     ████░░░░░░  30%    ← 压低，让位给演出音效
  演出音效: ██████████  100%   ← 大招音效最突出
  演出结束 → BGM 恢复 70%
```

实现：

```lua
--- BGM duck：压低 BGM 让位给音效
---@param amount number BGM 音量倍率（0.4=压到40%，1.0=恢复正常）
function SoundManager:duckBgm(amount)
    self.bgm_duck = amount
    self:applyBgmVolume()
end

--- 应用 BGM 音量（考虑 duck）
function SoundManager:applyBgmVolume()
    if not self.bgm then return end
    local data = SoundDB[self.bgm_name]
    local duck = self.bgm_duck or 1.0
    self.bgm:setVolume(
        (data.volume or 0.7) * self.bgm_volume * self.master_volume * duck
    )
end
```

使用：

```lua
-- 大招演出开始 → 压低 BGM
function State:onEnter(player)  -- 大招状态
    Game:startCutIn(player, { ... })
    SoundManager:duckBgm(0.4)  -- BGM 压到 40%
end

-- 大招演出结束 → 恢复 BGM
function State:onExit(player)
    SoundManager:duckBgm(1.0)  -- 恢复正常
end
```

其他动态音量场景（进阶，可选）：

| 场景 | 做什么 | 例子 |
|---|---|---|
| **BGM duck** | 大招时压低 BGM | 上面的代码 |
| **低血量 BGM 变急** | 血量 < 30% 时 BGM 加速/变调 | `bgm:setPitch(1.2)` |
| **距离衰减** | 远处敌人音效小声 | §13.10 的 3D 音效 |
| **慢动作变调** | time_scale < 1 时 BGM 变低沉 | `bgm:setPitch(time_scale)` |

**初级版只做固定比例 + BGM duck**，其他动态场景按需加。

### 13.9 hitstop 时音效怎么办

hitstop 期间角色冻住，但音效怎么办？

| 音效类型 | hitstop 时 | 原因 |
|---|---|---|
| 命中音效 | ✅ 正常播放 | 音效是 2D 的，不受游戏时间影响 |
| 循环音效（蓄力等） | ✅ 继续播放 | 不受 hitstop 影响 |
| BGM | ✅ 继续播放 | 不受 hitstop 影响 |

音效系统独立于游戏逻辑——不受 hitstop/慢动作影响（除非主动控制）。

**慢动作时的音效**（可选）：

```lua
-- 慢动作时 BGM 也变慢（可选，增加氛围）
if Camera.time_scale < 1.0 then
    -- Love2D 不直接支持变速播放，需要用 pitch
    SoundManager.bgm:setPitch(Camera.time_scale)
else
    SoundManager.bgm:setPitch(1.0)
end
```

注意：setPitch 会变调（慢动作时 BGM 变低沉）。如果不想要变调，慢动作时不改 BGM。

### 13.10 空间音效：左右声道

横版游戏模拟左右声道——音源在屏幕左边左声道大声，右边右声道大声。戴着耳机玩有方向感，提升沉浸感。

#### Love2D 内置空间音频

Love2D 基于 OpenAL，**内置空间音频**——不需要插件，用 `setPosition` 就能实现左右声道效果。

```
声源在听众右侧 → 右声道大，左声道小
声源在听众左侧 → 左声道大，右声道小
声源在正前方   → 左右大致相等
距离越远       → 整体音量越小（距离衰减）
```

#### 关键前提：必须用单声道音频文件

```
✅ 单声道（mono）wav：
   引擎根据声源位置自动分配左右声道 → 空间效果生效

❌ 立体声（stereo）wav：
   已包含左右两个声道 → 引擎无法空间化 → setPosition 无效！
```

**音频素材必须导出为单声道**。用 Audacity 等工具转：
```
Audacity → 轨道 → 混音到单声道 → 导出 wav
```

#### 实现

**1. 每帧更新听众（相机）位置**：

```lua
function love.update(dt)
    -- ... 其他更新 ...

    -- ★ 设置听众位置 = 相机位置
    love.audio.setPosition(Camera.x, Camera.y, 0)
    -- 听众面朝屏幕内（-z），头顶朝上（+y）
    love.audio.setOrientation(0, 0, -1, 0, 1, 0)
end
```

**2. 播放音效时设声源位置**：

```lua
--- 播放带位置的音效
---@param name string 音效名
---@param worldX number 音源世界 x
---@param worldY number 音源世界 y
function SoundManager:playSfxSpatial(name, worldX, worldY)
    local data = SoundDB[name]
    if not data then return end

    local source = self:getSource(data.path)
    source:setVolume((data.volume or 1.0) * self.sfx_volume * self.master_volume)

    -- ★ 设声源位置（OpenAL 自动算左右声道 + 距离衰减）
    source:setPosition(worldX, worldY, 0)

    -- 距离衰减配置
    source:setRolloff(1.0)            -- 衰减速度
    source:setMaxDistance(800)         -- 最大听觉距离
    source:setReferenceDistance(100)   -- 开始衰减的参考距离

    love.audio.play(source)
end
```

**3. 距离衰减模型**：

```lua
-- 在 love.load 里设全局衰减模型
love.audio.setDistanceModel("inverse")  -- 距离越远越小声
```

```
距离衰减效果：
  距离 0-100：    不衰减（满音量）
  距离 100-400：   逐渐衰减
  距离 400-800：   很小声
  距离 > 800：     听不到

角色自己的音效：声源在听众位置（距离≈0）→ 满音量
远处敌人的攻击：声源在屏幕边缘 → 衰减 + 偏左/右
```

#### 使用场景

```lua
-- 命中音效（在碰撞点位置，有方向感）
function HitSystem.onHit(event)
    local pos = event.spark_pos
    SoundManager:playSfxSpatial("hit_" .. (hd.hit_type or "light"), pos.x, pos.y)
end

-- 飞行道具音效（飞行道具的位置）
EntityManager.spawn 时 → playSfxSpatial

-- 敌人攻击音效（敌人位置）
SoundManager:playSfxSpatial("enemy_attack", enemy.x, enemy.y)
```

**不需要空间音效的**（声源在听众位置 = 居中）：

```lua
-- 角色自己的动作（挥刀/跳跃/落地）→ 居中，不用空间
SoundManager:playSfx("slash_heavy")  -- 不调 playSfxSpatial
SoundManager:playSfx("jump")
SoundManager:playSfx("land")
```

#### 效果总结

```
场景：敌人从右边扔火球过来

帧0: 火球在右边发射 → 右声道听到"嗖"的声音
帧5: 火球飞到中间   → 左右声道均衡
帧8: 火球命中角色   → 碰撞点在角色位置 → 居中 + 命中音效

戴着耳机玩：能听出火球从右往左飞过来 → 沉浸感大幅提升
```

#### 最低音量保底

鬼泣的音效距离再远也能听清——有"最低音量保底"，不会衰减到接近 0。

```
普通衰减（无保底）：          鬼泣效果（有保底）：
  距离 0：   100%              距离 0：   100%
  距离 200：  50%              距离 200：  60%
  距离 400：  25%              距离 400：  40%
  距离 800：  12% ← 听不到     距离 800：  30% ← 还能听到
  距离 1000： 6%               距离 1000：30% ← 不再继续衰减
```

OpenAL 没有直接设最低音量的 API，手动算最终音量：

```lua
function SoundManager:playSfxSpatial(name, worldX, worldY)
    local data = SoundDB[name]
    local source = self:getSource(data.path)

    local baseVolume = (data.volume or 1.0) * self.sfx_volume * self.master_volume
    local minVolume = data.min_volume or 0.3    -- ★ 最低保底 30%
    local rolloff = data.rolloff or 0.5          -- 衰减速度

    -- 手动算距离衰减（不用 OpenAL 自动衰减）
    local distance = math.abs(worldX - Camera.x)
    local refDist = 100

    -- 衰减公式：越远越小，但不低于 minVolume
    local distFactor = refDist / (refDist + rolloff * math.max(0, distance - refDist))
    distFactor = math.max(minVolume, math.min(1.0, distFactor))

    source:setVolume(baseVolume * distFactor)

    -- 仍然设位置（左右声道方向感）
    source:setPosition(worldX, worldY, 0)
    source:setRolloff(0)  -- 0 = 关闭 OpenAL 自动衰减，音量我们手动算

    love.audio.play(source)
end
```

SoundDB 按优先级配不同最低音量和衰减速度：

```lua
SoundDB = {
    -- 重要音效：最低音量高，衰减慢
    slash_heavy = { volume = 1.0, min_volume = 0.4, rolloff = 0.3 },
    hit_heavy = { volume = 1.0, min_volume = 0.4, rolloff = 0.3 },
    hit_counter = { volume = 1.0, min_volume = 0.5, rolloff = 0.2 },

    -- 普通音效：最低音量中，衰减正常
    slash_light = { volume = 0.8, min_volume = 0.25, rolloff = 0.8 },
    jump = { volume = 0.6, min_volume = 0.2, rolloff = 0.8 },

    -- 环境音效：最低音量低，衰减快
    footstep_stone = { volume = 0.3, min_volume = 0.1, rolloff = 1.5 },
}
```

#### 简化版：只做左右声道不衰减

2D 横版屏幕宽度有限，距离不会很远。可以简化——只做左右声道方向感，不做距离衰减：

```lua
-- 简化版：只做左右声道，不衰减音量
function SoundManager:playSfxSpatial(name, worldX, worldY)
    local data = SoundDB[name]
    local source = self:getSource(data.path)
    source:setVolume((data.volume or 1.0) * self.sfx_volume * self.master_volume)
    source:setPosition(worldX, worldY, 0)
    source:setRolloff(0)  -- 不衰减音量，只用位置做左右声道
    love.audio.play(source)
end
```

| 方案 | 效果 | 适合 |
|---|---|---|
| 最低音量保底 | 远能听清但小声，有方向感 | 正式版 |
| 简化版（只左右声道） | 音量不变，只有方向感 | 原型/教学 |

### 13.11 main.lua 整合

```lua
local SoundManager = require("sound_manager")

function love.load()
    -- ... 初始化其他系统 ...
    SoundManager:playBgm("bgm_normal")  -- 开始正常战斗音乐
end

function love.update(dt)
    -- ... 其他系统更新 ...
    SoundManager:updateFade()  -- 更新 BGM 淡入淡出
end
```

### 13.12 本章总结

| 概念 | 说明 |
|---|---|
| 即时音效 | 命中/挥刀/跳跃，播放一次 |
| 循环音效 | 蓄力嗡鸣/持续效果，持续播放，状态结束停止 |
| BGM | 背景音乐，stream 模式节省内存 |
| 战斗音乐动态切换 | 评价 S→bgm_s, SSS→bgm_sss |
| BGM 淡入淡出 | 切换时平滑过渡，不硬切 |
| 三层音量 | 主音量/音效音量/BGM音量 |
| hitstop 不影响音效 | 音效独立于游戏时间 |
| 3D 音效（可选） | 左右声道模拟位置 |

**关键点**：

1. **外置音频文件**：不用 .snd 打包，路径引用（和精灵图一致）
2. **clone() 支持重叠播放**：同一音效可同时播放多个实例（多次命中）
3. **BGM 用 stream 模式**：节省内存（大文件不全部加载到内存）
4. **评价驱动 BGM 切换**：D-A 正常，S 切激烈，SSS 全开
5. **BGM 淡入淡出**：30帧平滑过渡，不硬切
6. **音效不受 hitstop 影响**：独立于游戏时间

**下一步**：第十四章讲 UI 系统（血条/魔人槽/评价显示/锁定标记）。

---

*第十三章完。音效系统让游戏有听觉反馈——命中有打击音、行走有脚步声、评价越高音乐越激烈。*
