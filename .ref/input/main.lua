-- ============================================
-- main.lua
-- Input buffer + command match + hitstop + action phases
-- Debug visualization for buffer / pre-input / step state
-- ============================================

-- ---------- Config ----------
local FONT_PATH = "C:/Windows/Fonts/consola.ttf"
local FONT_SIZE = 14

-- ---------- Input layer ----------
local VirtualKeys = {
    "left", "right", "up", "down",
    "attack", "jump", "shoot", "lock", "special",
}

local keyboardMap = {
    left = "a", right = "d", up = "w", down = "s",
    attack = "j", jump = "l", shoot = "k",
    lock = "o", special = "i",
}

-- ---------- Gamepad layer (Xbox layout) ----------
-- LÖVE 标准 gamepad 按键名（跨平台一致）：
--   a / b / x / y, leftshoulder / rightshoulder,
--   lefttrigger / righttrigger, back / start / guide,
--   leftstick / rightstick, dpup / dpdown / dpleft / dpright
-- 每个虚拟键对应一组 gamepad 按键（任一按下即触发）。
-- 方向键 = D-pad；左摇杆在 Input.update 里叠加到方向上。
local gamepadMap = {
    left    = {"dpleft"},
    right   = {"dpright"},
    up      = {"dpup"},
    down    = {"dpdown"},
    attack  = {"x", "rightshoulder"},          -- X 或 RB
    jump    = {"a"},                           -- A
    shoot   = {"y", "righttrigger"},            -- Y 或 RT
    lock    = {"leftshoulder", "lefttrigger"},  -- LB 或 LT
    special = {"b"},                           -- B
}
-- 左摇杆死区（避免静止漂移触发方向）
local STICK_DEADZONE = 0.25
-- 已连接的 gamepad 列表（由 love.joystickadded / removed 维护）
local gamepads = {}

-- 从一个 gamepad 读取左摇杆方向（带死区）
-- 返回 left, right, up, down 四个 bool
local function readGamepadStick(joystick)
    local left, right, up, down = false, false, false, false
    -- LÖVE 中 y 轴上为负
    local ax = joystick:getGamepadAxis("leftx") or 0
    local ay = joystick:getGamepadAxis("lefty") or 0
    if math.abs(ax) > STICK_DEADZONE then
        if ax < 0 then left = true else right = true end
    end
    if math.abs(ay) > STICK_DEADZONE then
        if ay < 0 then up = true else down = true end
    end
    return left, right, up, down
end

-- 查单个 gamepad 按键是否按下。
-- trigger 是模拟轴，isGamepadDown 不支持，用轴值跟死区比较判断。
local function isGamepadButtonHeld(joystick, btn)
    if btn == "lefttrigger" or btn == "triggerleft" then
        return (joystick:getGamepadAxis("triggerleft") or 0) > STICK_DEADZONE
    elseif btn == "righttrigger" or btn == "triggerright" then
        return (joystick:getGamepadAxis("triggerright") or 0) > STICK_DEADZONE
    end
    return joystick:isGamepadDown(btn)
end

-- 查一个虚拟键在某手柄上是否被按下（D-pad/功能键走 gamepadMap，方向再叠加摇杆）
local function isGamepadVKeyHeld(joystick, vkey, stickDir)
    local gpKeys = gamepadMap[vkey]
    if gpKeys then
        for _, btn in ipairs(gpKeys) do
            if isGamepadButtonHeld(joystick, btn) then return true end
        end
    end
    if stickDir then
        if     vkey == "left"  and stickDir[1] then return true
        elseif vkey == "right" and stickDir[2] then return true
        elseif vkey == "up"    and stickDir[3] then return true
        elseif vkey == "down"  and stickDir[4] then return true
        end
    end
    return false
end

local Input = {prev = {}, curr = {}}

function Input.update()
    -- 预读所有手柄的摇杆方向
    local padSticks = {}
    for _, gp in ipairs(gamepads) do
        padSticks[gp] = {readGamepadStick(gp)}
    end

    for _, vkey in ipairs(VirtualKeys) do
        Input.prev[vkey] = Input.curr[vkey] or false
        local held = false
        -- 键盘优先
        local kbKey = keyboardMap[vkey]
        if kbKey and love.keyboard.isDown(kbKey) then held = true end
        -- 手柄
        if not held then
            for _, gp in ipairs(gamepads) do
                if isGamepadVKeyHeld(gp, vkey, padSticks[gp]) then held = true; break end
            end
        end
        Input.curr[vkey] = held
    end
end

function Input.held(vkey)         return Input.curr[vkey] end
function Input.justPressed(vkey)  return Input.curr[vkey] and not Input.prev[vkey] end
function Input.justReleased(vkey) return not Input.curr[vkey] and Input.prev[vkey] end

-- ---------- Buffer layer ----------
local Buffer = {}
Buffer.keys = {"left", "right", "up", "down",
                "attack", "jump", "shoot", "lock", "special"}

function Buffer.new()
    local b = {}
    for _, k in ipairs(Buffer.keys) do b[k] = 0 end
    return b
end

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

-- ---------- Command layer ----------
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
    -- 预计算：该命令涉及的所有键名集合（用于子集判断）
    cmd.keySet = {}
    for _, step in ipairs(cmd.steps) do
        for _, k in ipairs(step.keys) do
            cmd.keySet[k.name] = true
        end
    end
    return cmd
end

-- 判断 cmdA 的键集合是否是 cmdB 的子集
function Command.isSubsetOf(cmdA, cmdB)
    for key in pairs(cmdA.keySet) do
        if not cmdB.keySet[key] then return false end
    end
    return true
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

-- ---------- Action layer (phases: startup -> active -> recovery) ----------
local Action = {}
function Action.new(def)
    local a = {
        name = def.name,
        startup = def.startup or 4,
        active = def.active or 3,
        recovery = def.recovery or 12,
        cancel = def.cancel or {},   -- 取消窗口表: {{cmd=取消目标动作, open=..., [close=...]}}, close 默认 = total
        phase = "idle",
        frame = 0,
    }
    a.total = a.startup + a.active + a.recovery
    return a
end

-- 当前动作的绝对帧号(1-based)，用于查取消窗口
local function actionAbsFrame(act)
    if not act then return 0 end
    if act.phase == "startup" then return act.frame
    elseif act.phase == "active" then return act.startup + act.frame
    elseif act.phase == "recovery" then return act.startup + act.active + act.frame
    end
    return 0
end

function Action.start(act)
    act.phase = "startup"
    act.frame = 0
end

-- returns event string on phase transitions, nil otherwise
function Action.update(act)
    if act.phase == "idle" then return nil end
    act.frame = act.frame + 1
    if act.phase == "startup" and act.frame >= act.startup then
        act.phase, act.frame = "active", 0
        return "to_active"
    elseif act.phase == "active" and act.frame >= act.active then
        act.phase, act.frame = "recovery", 0
        return "to_recovery"
    elseif act.phase == "recovery" and act.frame >= act.recovery then
        act.phase, act.frame = "idle", 0
        return "to_idle"
    end
    return nil
end

-- ---------- Game state ----------
-- DMC Vergil 风格技能（right = forward，面向右；本测试无 SOCD 层）
local buf = Buffer.new()
-- priority 已移到 action 的 cancel entry 上（见下文 actions）。
-- cmd 本身只描述输入模式，不再带优先级。
local cmds = {
    -- Void Slash: 后→前+攻击 (A, D, J) —— 斩裂时空（3步，最具体）
    Command.new({
        name = "void_slash",
        time = 60, buffer_time = 20,   -- 特殊技短 buffer：意图即执行
        steps = {
            {keys = {{name = "left"}}},
            {keys = {{name = "right"}}},
            {keys = {{name = "attack"}}},
        },
    }),
    -- Upper Slash: 后+攻击 (hold A + J) —— launcher 上挑（2键）
    Command.new({
        name = "upper_slash",
        time = 20, buffer_time = 20,
        steps = {
            {keys = {{name = "left", hold = true}, {name = "attack"}}},
        },
    }),
    -- Rapid Slash: 前+攻击 (hold D + J) —— 突进斩（2键）
    Command.new({
        name = "rapid_slash",
        time = 20, buffer_time = 20,
        steps = {
            {keys = {{name = "right", hold = true}, {name = "attack"}}},
        },
    }),
    -- Basic attack: tap J（单键；连击靠后摇取消链出来）
    -- 长 buffer：预输入/连击衔接容忍，跨招 buffer 撑到后摇窗口
    Command.new({
        name = "attack",
        time = 10, buffer_time = 20,
        steps = {
            {keys = {{name = "attack"}}},
        },
    }),
    -- Jump: tap L（独立输入；测试触发键保留 vs J 子集）
    -- 长 buffer：空中预输入落地接
    Command.new({
        name = "jump",
        time = 10, buffer_time = 10,
        steps = {
            {keys = {{name = "jump"}}},
        },
    }),
}
-- 命令名 -> cmd 对象（触发检查时按 inputForAction(entry.cmd) 查）
local cmdsByName = {}
for _, c in ipairs(cmds) do cmdsByName[c.name] = c end

-- 所有可播放动作统一放在 actions：cancel 窗口的 cmd 直接写目标动作名。
--
-- Yamato 地面连段（DMC4SE 命名）：
--   Combo A: J J J J → yamato_a_1 → a_2 → a_3 → a_4（4 段）
--   Combo B: J J 停顿 J → yamato_a_1 → a_2 →（停顿）→ yamato_b_3（挑空）
--   a_1/a_2 是 A/B 共享的；分叉点在 a_2 的后摇：早段按 J 接 a_3，晚段按 J 接 b_3。
--   没有 b_1/b_2，因为出前两击时还没决定走 A 还是 B。
--
-- basic 动作：特殊技可从前摇取消（自由），attack 后摇起始，jump 后摇~70%
local actions = {
    yamato_a_1 = {
        name = "yamato_a_1",
        input = "attack",
        startup = 25, active = 12, recovery = 45,
        cancel = {
            {cmd = "void_slash", open = 13, priority = 5},
            {cmd = "upper_slash", open = 13, priority = 4},
            {cmd = "rapid_slash", open = 13, priority = 4},
            {cmd = "yamato_a_2", open = 38, close = 59, priority = 1},
            {cmd = "yamato_a_1", open = 60, priority = 1},
            {cmd = "jump", open = 69, priority = 1},
        },
    },
    yamato_a_2 = {
        name = "yamato_a_2",
        input = "attack",
        startup = 25, active = 12, recovery = 45,
        cancel = {
            {cmd = "void_slash", open = 13, priority = 5},
            {cmd = "upper_slash", open = 13, priority = 4},
            {cmd = "rapid_slash", open = 13, priority = 4},
            {cmd = "yamato_a_3", open = 38, close = 50, priority = 1},  -- 早段 → Combo A（快按）
            {cmd = "yamato_b_3", open = 51, close = 70, priority = 1},  -- 中段 → Combo B（停顿变招）
            {cmd = "yamato_a_1", open = 71, priority = 1},              -- 晚段 → 重开 A1（太晚错过变招）
            {cmd = "jump", open = 69, priority = 1},
        },
    },
    yamato_a_3 = {
        name = "yamato_a_3",
        input = "attack",
        startup = 25, active = 12, recovery = 45,
        cancel = {
            {cmd = "void_slash", open = 13, priority = 5},
            {cmd = "upper_slash", open = 13, priority = 4},
            {cmd = "rapid_slash", open = 13, priority = 4},
            {cmd = "yamato_a_4", open = 38, close = 59, priority = 1},
            {cmd = "yamato_a_1", open = 60, priority = 1},
            {cmd = "jump", open = 69, priority = 1},
        },
    },
    yamato_a_4 = {  -- Combo A 终结
        name = "yamato_a_4",
        input = "attack",
        startup = 30, active = 15, recovery = 60,
        cancel = {
            {cmd = "void_slash", open = 15, priority = 5},
            {cmd = "upper_slash", open = 15, priority = 4},
            {cmd = "rapid_slash", open = 15, priority = 4},
            {cmd = "yamato_a_1", open = 46, priority = 1},
            {cmd = "jump", open = 88, priority = 1},
        },
    },
    yamato_b_3 = {  -- Combo B 挑空（停顿变招）
        name = "yamato_b_3",
        input = "attack",
        startup = 30, active = 15, recovery = 60,
        cancel = {
            {cmd = "void_slash", open = 15, priority = 5},
            {cmd = "upper_slash", open = 15, priority = 4},
            {cmd = "rapid_slash", open = 15, priority = 4},
            {cmd = "yamato_a_1", open = 46, priority = 1},
            {cmd = "jump", open = 88, priority = 1},
        },
    },
    -- 特殊技动作：承诺招，后摇可被取消（special-cancel 后摇靠前；attack/jump 按承诺度）
    rapid_slash = {
        name = "rapid_slash",
        startup = 18, active = 10, recovery = 45,
        cancel = {
            {cmd = "void_slash", open = 33, priority = 5},
            {cmd = "upper_slash", open = 33, priority = 4},
            {cmd = "rapid_slash", open = 33, priority = 4},
            {cmd = "yamato_a_1", open = 52, priority = 1},
            {cmd = "jump", open = 60, priority = 1},
        },
    },
    void_slash = {
        name = "void_slash",
        startup = 14, active = 8, recovery = 36,
        cancel = {
            {cmd = "void_slash", open = 50, priority = 5},
            {cmd = "upper_slash", open = 50, priority = 4},
            {cmd = "rapid_slash", open = 50, priority = 4},
            {cmd = "yamato_a_1", open = 50, priority = 1},
            {cmd = "jump", open = 52, priority = 1},
        },
    },
    upper_slash = {
        name = "upper_slash",
        startup = 12, active = 8, recovery = 30,
        cancel = {
            {cmd = "void_slash", open = 22, priority = 5},
            {cmd = "upper_slash", open = 45, priority = 4},
            {cmd = "rapid_slash", open = 32, priority = 4},
            {cmd = "yamato_a_1", open = 45, priority = 1},
            {cmd = "jump", open = 45, priority = 1},
        },
    },
    jump = {
        name = "jump",
        startup = 8, active = 4, recovery = 30,
        cancel = {
            {cmd = "void_slash", open = 1, priority = 5},
            {cmd = "upper_slash", open = 1, priority = 4},
            {cmd = "rapid_slash", open = 1, priority = 4},
            {cmd = "yamato_a_1", open = 1, priority = 1},
            {cmd = "jump", open = 42, priority = 1},
        },
    },
}

-- 给出“取消到某个动作”所需要的输入命令。
--
-- cancel 窗口里的 cmd 现在写的是目标动作名，而不是输入命令名：
--   {cmd = "yamato_a_2", open = 38}  -- 取消到 A2；A2 的 input 决定按什么键
--   {cmd = "rapid_slash", open = 13} -- 取消到突进斩；未设置 input，默认按 rapid_slash 命令
--
-- 普攻五段都声明 input = "attack"，所以：
--   inputForAction("yamato_a_1") == "attack"
--   inputForAction("yamato_a_2") == "attack"
--   inputForAction("yamato_a_3") == "attack"
--   inputForAction("yamato_a_4") == "attack"
--   inputForAction("yamato_b_3") == "attack"
--
-- 将来新增攻击键分支时，只在动作定义中加 input = "attack"：
--   yamato_c_4 = {name = "yamato_c_4", input = "attack", ...}
-- 此后 {cmd = "yamato_c_4", ...} 会自动被当作攻击键取消，
-- 不需要再修改触发逻辑、动作切换或 UI 的判断。
--
-- input 缺省时，动作名本身就是命令名，例如：
--   inputForAction("jump")         == "jump"
--   inputForAction("rapid_slash")  == "rapid_slash"
local function inputForAction(name)
    local def = actions[name]
    return def and (def.input or name) or name
end

-- idle 取消表：和 action 的 cancel entry 同构，{cmd=目标动作, priority=...}
-- cmd 写目标动作名；inputForAction 决定按什么输入键。
-- idle 时所有命令都可触发，因此这里必须列出全部 idle 可触发的目标，
-- priority 与 action.cancel 里同名条目保持一致，否则 idle 下特殊技/jump 无法触发，
-- 也会丢失“高优先命令取胜后清理低优先子集”的行为（如 D+J 时 rapid_slash 胜出并 clear attack）。
local idleCancel = {
    {cmd = "void_slash",  priority = 5},
    {cmd = "upper_slash", priority = 4},
    {cmd = "rapid_slash", priority = 4},
    {cmd = "yamato_a_1",  priority = 1},  -- attack 输入 → 起手 yamato_a_1
    {cmd = "jump",        priority = 1},
}

local currentAction = nil       -- nil == idle
local hitstop = 0
local frameCount = 0
local log = {}                  -- newest first; {frame, text, color}
local inputHistory = {}         -- newest first; {frame, text, color}  按键按下/松开
local paused = false
local stepOnce = false

local function addLog(text, col)
    table.insert(log, 1, {frame = frameCount, text = text, color = col})
    if #log > 14 then table.remove(log) end
end

-- 记录输入历史：方向用状态变化（dir:xxx），功能键记按下/松开（key+/key-）
local prevDir = "N"
local function curDir()
    local l, r, u, d = Input.held("left"), Input.held("right"), Input.held("up"), Input.held("down")
    local s = ""
    if u then s = s .. "U" end
    if d then s = s .. "D" end
    if l then s = s .. "L" end
    if r then s = s .. "R" end
    if s == "" then s = "N" end
    return s
end

local function addInputHistory()
    local parts = {}
    -- 方向状态变化（推/松开方向，只记变化不记按键事件）
    local dir = curDir()
    if dir ~= prevDir and dir ~= "N" then
        parts[#parts+1] = "dir:" .. dir
        prevDir = dir
    end
    -- 功能键按下/松开
    for _, vkey in ipairs({"attack", "jump", "shoot", "lock", "special"}) do
        if Input.justPressed(vkey)  then parts[#parts+1] = vkey .. "+" end
        if Input.justReleased(vkey) then parts[#parts+1] = vkey .. "-" end
    end
    if #parts > 0 then
        table.insert(inputHistory, 1, {frame = frameCount, text = table.concat(parts, " "), color = {0.3, 1, 0.3}})
        if #inputHistory > 14 then table.remove(inputHistory) end
    end
end

-- ---------- love callbacks ----------
local font
function love.load()
    local ok, f = pcall(love.graphics.newFont, FONT_PATH, FONT_SIZE)
    font = ok and f or love.graphics.newFont(FONT_SIZE)
    love.graphics.setFont(font)
    love.window.setMode(1640, 980)
    love.graphics.setBackgroundColor(0.10, 0.10, 0.12)
    -- 把启动前已连接的手柄纳入（joystickadded 在 load 之前已发完）
    for _, j in ipairs(love.joystick.getJoysticks()) do
        if j:isGamepad() then gamepads[#gamepads + 1] = j end
    end
end

-- 手柄热插拔
function love.joystickadded(j)
    if not j:isGamepad() then return end
    for _, gp in ipairs(gamepads) do if gp == j then return end end
    gamepads[#gamepads + 1] = j
    addLog("gamepad connected: " .. (j:getName() or "?"), {0.4, 0.8, 1})
end

function love.joystickremoved(j)
    for i, gp in ipairs(gamepads) do
        if gp == j then table.remove(gamepads, i); break end
    end
    addLog("gamepad removed", {0.55, 0.55, 0.6})
end

function love.update(dt)
    -- 每帧的执行顺序（对应文档里的 -4 → -3 → -2 → -1 → 当前状态）：
    --   第1步：读输入 + 更新 Buffer + 推进当前动作
    --   第2步：快照（匹配前）
    --   第3步：命令匹配（Command.step，被测系统）
    --   第4步：触发判定 + 消费（按优先级取胜者，清理同输入子集）
    --   第5步：执行技能（启动新动作）
    if paused and not stepOnce then return end
    stepOnce = false
    frameCount = frameCount + 1

    -- ===== 第1步：读输入 + 更新 Buffer =====
    Input.update()
    addInputHistory()
    local snapshot = buildSnapshot()
    Buffer.update(buf, snapshot)

    local in_hitstop = hitstop > 0

    -- ===== 第1步（续）：推进当前动作（hitstop 期间冻结 = 受击定格）=====
    if currentAction and not in_hitstop then
        local evt = Action.update(currentAction)
        if evt == "to_idle" then
            currentAction = nil
            addLog("---- idle (f" .. frameCount .. ") ----", {0.4, 0.4, 0.45})
        end
    end

    -- ===== 第2步：快照（匹配前）=====
    -- 在 Command.step 之前记录每个命令的 completed[] 和 cur_buffer_time，
    -- 用来后面检测"本帧新匹配的步"以及"本帧是否匹配/刷新"。纯展示用，不影响系统。
    local snap = {}
    for _, cmd in ipairs(cmds) do
        cmd._flash = cmd._flash or {}
        local p = {completed = {}, buf = cmd.cur_buffer_time}
        for i = 1, #cmd.steps do p.completed[i] = cmd.completed[i] end
        snap[cmd] = p
    end
    -- ===== 第3步：匹配（运行被测系统）=====
    -- 所有命令独立匹配，互不影响。匹配上的会把 cur_buffer_time 设为 buffer_time。
    for _, cmd in ipairs(cmds) do
        Command.step(cmd, buf, in_hitstop)
    end
    -- ===== 检测本帧新匹配的步 -> 闪烁（纯展示）=====
    for _, cmd in ipairs(cmds) do
        local p = snap[cmd]
        -- 记录匹配后的 buffer 值（用于 UI 展示"本帧匹配了"）
        cmd._peakBuf = cmd.cur_buffer_time
        cmd._fired = false
        -- 中间步：false -> true 的跳变
        for i = 1, #cmd.steps - 1 do
            if not p.completed[i] and cmd.completed[i] then
                cmd._flash[i] = 25
            end
        end
        -- 最后一步会在 Command.step 内部 reset，无法直接看 completed。
        -- 用 cur_buffer_time > 快照值 来判断"本帧匹配了"（首次 0->N 或刷新 N->buffer_time）：
        -- 没匹配的帧只会递减（或 hitstop 时持平），所以 ">" 一定意味着本帧匹配了。
        if cmd.cur_buffer_time > p.buf then
            cmd._flash[#cmd.steps] = 25
        end
        -- 闪烁倒计时
        for i = 1, #cmd.steps do
            if cmd._flash[i] then
                cmd._flash[i] = cmd._flash[i] - 1
                if cmd._flash[i] <= 0 then cmd._flash[i] = nil end
            end
        end
    end

    -- ===== 第4步：触发判定 + 消费（按 cancel entry 的 priority 取胜者）=====
    -- 收集当前可触发的 cancel entries：
    --   idle → idleCancel（全部视为窗口打开）
    --   action → currentAction.cancel 里 af ∈ [open, close] 的 entry
    -- 然后按 entry.priority 降序稳定排序，第一个 cur_buffer_time>0 的命令取胜者。
    local af = actionAbsFrame(currentAction)
    local entries = {}  -- {w=entry, idx=声明序号}
    if currentAction then
        for i, w in ipairs(currentAction.cancel or {}) do
            if af >= w.open and af <= (w.close or currentAction.total) then
                entries[#entries+1] = {w = w, idx = i}
            end
        end
    else
        for i, w in ipairs(idleCancel) do
            entries[#entries+1] = {w = w, idx = i}
        end
    end
    table.sort(entries, function(a, b)
        local pa, pb = a.w.priority or 0, b.w.priority or 0
        if pa ~= pb then return pa > pb end
        return a.idx < b.idx  -- 同 priority 保持声明顺序（稳定排序）
    end)
    -- MUGEN 纯净模型：不清子集 curbuftime（文档 §4.5）。特殊技短 buffer_time
    -- 让子集失败者自动过期；attack/jump 长 buffer_time 用于跨招预输入，
    -- 它们和特殊技触发键不重叠（一个按 L 一个按 J），不会同帧 cascade。
    for _, e in ipairs(entries) do
        local w = e.w
        local cmdName = inputForAction(w.cmd)
        local cmd = cmdsByName[cmdName]
        if cmd and Command.isActive(cmd) then
            -- 胜者（被触发的命令）
            cmd._fired = true
            cmd._peakBuf = cmd.cur_buffer_time
            cmd.cur_buffer_time = 0  -- 消费胜者
            -- 清理同帧匹配的子集命令（避免 cascade）
            for _, sub in ipairs(cmds) do
                if sub ~= cmd
                   and sub.cur_buffer_time > 0              -- buffer 还活着就清（含预输入）
                   and Command.isSubsetOf(sub, cmd)          -- 是胜者子集
                then
                    sub.cur_buffer_time = 0
                    addLog("cleared subset " .. sub.name, {0.8, 0.5, 0.3})
                end
            end
            local prev = currentAction and currentAction.name or "idle"
            -- ===== 第5步：执行技能（启动新动作）=====
            -- dest 直接 = entry.cmd（entry 已经过窗口过滤，无需再反查 cancel 表）
            currentAction = Action.new(actions[w.cmd])
            Action.start(currentAction)
            addLog("TRIGGER " .. cmd.name .. " → " .. w.cmd .. "  (from " .. prev .. ")", {0.3, 1, 0.3})
            break  -- 每帧只触发一个技能
        end
    end

    if in_hitstop then hitstop = hitstop - 1 end
end

-- ---------- Drawing helpers ----------
local function setColor(c) love.graphics.setColor(c[1], c[2], c[3], c[4] or 1) end
local WHITE = {1,1,1}
local GRAY  = {0.55,0.55,0.6}
local CYAN  = {0.4,0.8,1}
local GREEN = {0.3,1,0.3}
local YELLOW= {1,0.85,0.2}
local RED   = {1,0.3,0.3}

local function drawText(y, text, col)
    setColor(col or WHITE)
    love.graphics.print(text, 12, y)
    return y + 18
end

local function drawBar(x, y, w, filled, total, col)
    love.graphics.setColor(0.18, 0.18, 0.20)
    love.graphics.rectangle("fill", x, y, w, 14)
    setColor(col or GREEN)
    local fw = (total and total > 0) and (w * filled / total) or 0
    love.graphics.rectangle("fill", x, y, fw, 14)
    love.graphics.setColor(0.4, 0.4, 0.45)
    love.graphics.rectangle("line", x, y, w, 14)
end

local function fmtKey(k)
    local s = k.name
    if k.hold then s = s .. "(hold)" end
    if k.release then s = s .. "(rel)" end
    if k.charge_time then s = s .. ">" .. k.charge_time end
    return s
end

local function fmtStep(step)
    local parts = {}
    for _, k in ipairs(step.keys) do parts[#parts+1] = fmtKey(k) end
    return table.concat(parts, " + ")
end

-- 街霸风格帧格：每一帧固定 8px 宽（整数，无抖动），按相位着色
-- （startup蓝/active红/recovery黄）。已播放亮色、未播放暗色，当前帧白色描边。
-- 超过一行宽度时自动换行（每行 floor(w/8) 格）。返回网格占用的高度。
local function drawFrameGrid(x, y, w, act)
    local cellW = 8            -- 固定帧宽（整数，保证每格一致）
    local cellH = 16
    local rowGap = 4
    local cellsPerRow = math.floor(w / cellW)
    -- 当前已播放到的绝对帧号
    local elapsed = 0
    if act.phase == "startup" then elapsed = act.frame
    elseif act.phase == "active" then elapsed = act.startup + act.frame
    elseif act.phase == "recovery" then elapsed = act.startup + act.active + act.frame
    end
    for i = 1, act.total do
        local idx = i - 1
        local row = math.floor(idx / cellsPerRow)
        local col = idx % cellsPerRow
        local cx = x + col * cellW
        local cy = y + row * (cellH + rowGap)
        local col2
        if i <= act.startup then col2 = {0.4, 0.5, 0.9}                  -- startup 蓝
        elseif i <= act.startup + act.active then col2 = {0.9, 0.3, 0.3} -- active 红
        else col2 = {0.9, 0.75, 0.2} end                                 -- recovery 黄
        local played = (i <= elapsed)
        if played then
            love.graphics.setColor(col2[1], col2[2], col2[3], 1)
        else
            love.graphics.setColor(col2[1]*0.22, col2[2]*0.22, col2[3]*0.22, 1)
        end
        love.graphics.rectangle("fill", cx, cy, cellW - 1, cellH)  -- -1 留 1px 间隔
        -- 当前帧：白色描边
        if i == elapsed then
            love.graphics.setColor(1, 1, 1)
            love.graphics.setLineWidth(1.5)
            love.graphics.rectangle("line", cx, cy, cellW - 1, cellH)
        end
    end
    local totalRows = math.ceil(act.total / cellsPerRow)
    return totalRows * (cellH + rowGap)
end

-- 取消窗口表格（方向3）：每行 = 名字 | 迷你时间线 | 帧范围 | ●/○ 状态。
-- 迷你条暗底=整条动作，亮色=可取消区段(open..close)，白竖线=当前帧。
-- ● NOW = 当前帧落在窗口里（此刻能取消）。返回占用高度。
local function drawCancelTracks(x, y, w, act)
    local colFor = {rapid_slash = CYAN, upper_slash = CYAN, void_slash = CYAN, attack = GREEN, jump = YELLOW}
    local absF = actionAbsFrame(act)
    local startY = y
    -- 动作名简写（用于 range 列，避免和 NOW 列重叠）：yamato_a_3 → a3
    local function shortName(name)
        return name:gsub("yamato_", "")
    end
    -- 按 max priority 降序收集 cname（同 priority 保持声明顺序）
    local byCname = {}
    for i, win in ipairs(act.cancel or {}) do
        local cn = inputForAction(win.cmd)
        local e = byCname[cn]
        if not e then
            e = {wins = {}, prio = -1, idx = i}
            byCname[cn] = e
        end
        e.wins[#e.wins+1] = win
        e.prio = math.max(e.prio, win.priority or 0)
    end
    local order = {}
    for cn, e in pairs(byCname) do order[#order+1] = {name = cn, wins = e.wins, prio = e.prio, idx = e.idx} end
    table.sort(order, function(a, b)
        if a.prio ~= b.prio then return a.prio > b.prio end
        return a.idx < b.idx
    end)
    -- 列布局
    local nameW = 100
    local barX, barW = x + nameW, 300
    local rangeX = barX + barW + 12
    local statX = rangeX + 280
    local barH, rowH = 10, 16
    local function fx(frame)  -- 帧 -> 迷你条 x 坐标
        return barX + (frame - 1) / math.max(1, act.total - 1) * barW
    end
    -- 表头
    setColor(GRAY)
    love.graphics.print("command", x, y)
    love.graphics.print("timeline", barX, y)
    love.graphics.print("range", rangeX, y)
    love.graphics.print("now", statX, y)
    y = y + rowH
    for _, item in ipairs(order) do
        local cname = item.name
        local wins = item.wins
        if #wins > 0 then
            -- 名字
            setColor(colFor[cname])
            love.graphics.print(cname, x, y)
            -- 迷你条：暗底(整条动作)
            love.graphics.setColor(0.16, 0.16, 0.18)
            love.graphics.rectangle("fill", barX, y + 3, barW, barH)
            -- 亮色窗口段（attack 可能有两截）
            local c = colFor[cname]
            local canNow = false
            local rangeParts = {}
            for _, win in ipairs(wins) do
                local open, close = win.open, win.close or act.total
                love.graphics.setColor(c[1], c[2], c[3], 0.9)
                love.graphics.rectangle("fill", fx(open), y + 3, math.max(1, fx(close) - fx(open)), barH)
                rangeParts[#rangeParts+1] = open .. "-" .. close .. " " .. shortName(win.cmd)
                if absF >= open and absF <= close then canNow = true end
            end
            -- 当前帧白竖线
            if absF > 0 then
                love.graphics.setColor(1, 1, 1)
                love.graphics.setLineWidth(1.5)
                love.graphics.line(fx(absF), y + 1, fx(absF), y + 3 + barH + 1)
            end
            -- 帧范围
            setColor(GRAY)
            love.graphics.print(table.concat(rangeParts, "  "), rangeX, y)
            -- 状态点（实心绿=能取消，空心灰=不能）
            local dotX, dotY = statX + 5, y + 8
            if canNow then
                setColor(GREEN)
                love.graphics.circle("fill", dotX, dotY, 4)
                love.graphics.print("NOW", statX + 14, y)
            else
                setColor(GRAY)
                love.graphics.circle("line", dotX, dotY, 4)
            end
            y = y + rowH
        end
    end
    return y - startY
end

-- pad/truncate to width (monospace assumed)
local function pad(s, w)
    s = tostring(s)
    if #s > w then return s:sub(1, w) end
    return s .. string.rep(" ", w - #s)
end

-- 在一行里打印若干 "键 名字" 对：键白色，名字按 col 着色，对之间留 spacing 像素。
local function printKeyline(y, x, spacing, pairs)
    local font = love.graphics.getFont()
    for _, p in ipairs(pairs) do
        setColor(WHITE)
        love.graphics.print(p[1], x, y)
        local kw = font:getWidth(p[1])
        setColor(p[3] or WHITE)
        love.graphics.print(p[2], x + kw, y)
        x = x + kw + font:getWidth(p[2]) + spacing
    end
end

-- ---------- Main draw ----------
function love.draw()
    local y = 8
    setColor(CYAN)
    love.graphics.print("== Input / Buffer / Command / Action  Debug ==", 12, y); y = y + 20
    printKeyline(y, 12, 22, {
        {"J=", "attack", GREEN},
        {"D+J=", "rapid_slash", CYAN},
        {"A+J=", "upper_slash", CYAN},
        {"ADJ=", "void_slash", CYAN},
        {"L=", "jump", YELLOW},
    }); y = y + 16
    printKeyline(y, 12, 22, {
        {"X=", "attack", GREEN},
        {"R+X=", "rapid_slash", CYAN},
        {"L+X=", "upper_slash", CYAN},
        {"L>R+X=", "void_slash", CYAN},
        {"A=", "jump", YELLOW},
    }); y = y + 16
    printKeyline(y, 12, 22, {
        {"P=", "pause", GRAY},
        {".=", "step", GRAY},
        {"H=", "hitstop", GRAY},
        {"C=", "clear log", GRAY},
        {"ESC=", "quit", GRAY},
    }); y = y + 18

    -- status line（右上角固定，跟标题分开）
    if paused then
        setColor(YELLOW)
        love.graphics.print("[ PAUSED ]", 1200, 8)
    end
    setColor(GRAY)
    love.graphics.print("frame " .. frameCount, 1280, 8)
    if hitstop > 0 then
        setColor(RED)
        love.graphics.print("[ HITSTOP " .. hitstop .. " ]", 1200, 26)
    end

    -- ===== 双列布局：左列=系统主链，右列=输入观测+日志 =====
    local LX = 12       -- 左列 x
    local RX = 900       -- 右列 x
    local yL = y         -- 左列 y 游标
    local yR = y         -- 右列 y 游标

    -- ===== COMMANDS（左列）— 放上面，位置稳定不跳 =====
    setColor(CYAN); love.graphics.print("-- COMMANDS --", LX, yL); yL = yL + 18
    -- 按声明顺序展示（priority 已移到 cancel entry，不在 cmd 上）
    for _, cmd in ipairs(cmds) do
        local active = Command.isActive(cmd)
        local status, col, barVal, barCol
        if active then
            -- live: buffered and waiting for cancel window
            status = "BUFFERED ttl=" .. cmd.cur_buffer_time .. " (waiting cancel)"
            col = YELLOW
            barVal, barCol = cmd.cur_buffer_time, YELLOW
        elseif cmd._fired then
            status = "FIRED this frame"
            col = GREEN
            barVal, barCol = cmd._peakBuf, GREEN
        elseif active == false and cmd.cur_buffer_time > 0 and snap[cmd] and cmd.cur_buffer_time > snap[cmd].buf then
            -- 本帧匹配但被更高 priority 的命令抢走（子集冲突）。MUGEN 不清，让它自然过期。
            status = "MATCHED ttl=" .. cmd.cur_buffer_time .. " (lost to priority, will expire)"
            col = RED
            barVal, barCol = cmd.cur_buffer_time, RED
        else
            -- count completed steps
            local done = 0
            for i = 1, #cmd.steps do if cmd.completed[i] then done = done + 1 end end
            if done > 0 then
                status = "matching " .. done .. "/" .. #cmd.steps .. " steps"
                col = {0.6,0.8,1}
            else
                status = "idle"
                col = GRAY
            end
            barVal = nil
        end
        setColor(col)
        love.graphics.print(pad("[" .. cmd.name .. "]", 18) .. pad(status, 48) ..
              "  cur_time=" .. cmd.cur_time .. "/" .. cmd.time, LX, yL); yL = yL + 18

        -- buffer_time bar (始终占位，避免布局跳动；idle 时空槽，有 buffer 时彩色填充)
        drawBar(LX, yL, 300, barVal or 0, cmd.buffer_time, barCol or GRAY)
        setColor(GRAY); love.graphics.print("buffer_time (pre-input ttl)", LX + 308, yL)
        yL = yL + 18

        -- each step
        for i, step in ipairs(cmd.steps) do
            local done = cmd.completed[i]
            local flashing = cmd._flash and cmd._flash[i]
            local mark = done and "[X]" or (flashing and "[*]" or "[ ]")
            setColor(done and GREEN or (flashing and {0.4, 1, 1} or GRAY))
            local s = "   " .. mark .. " step" .. i .. ": " .. pad(fmtStep(step), 30)
            if cmd.step_timers[i] > 0 then
                s = s .. " timer=" .. cmd.step_timers[i] .. "/" .. cmd.time
            end
            if flashing then s = s .. "  <<MATCHED" end
            love.graphics.print(s, LX, yL); yL = yL + 16
        end
        yL = yL + 6
    end

    -- ===== ACTION STATE（左列）— 放下面，帧格/取消轨道跳动只影响底部 =====
    setColor(CYAN); love.graphics.print("-- ACTION --", LX, yL); yL = yL + 18
    local aName, phase, fr, total
    if currentAction then
        aName = currentAction.name
        phase = currentAction.phase
        if phase == "startup" then
            fr, total = currentAction.frame, currentAction.startup
        elseif phase == "active" then
            fr, total = currentAction.frame, currentAction.active
        else
            fr, total = currentAction.frame, currentAction.recovery
        end
    else
        aName, phase, fr, total = "(idle)", "idle", 0, 1
    end

    local phaseCol = ({startup={0.6,0.6,1}, active={1,0.5,0.3}, recovery={1,0.85,0.2}, idle=GRAY})[phase]
    setColor(phaseCol)
    love.graphics.print("action: " .. pad(aName, 14) .. " phase: " .. pad(phase, 9) ..
                         " frame: " .. fr .. "/" .. total ..
                         "  abs: " .. actionAbsFrame(currentAction) .. "/" .. (currentAction and currentAction.total or 0), LX, yL); yL = yL + 20

    -- 街霸风格帧格（每帧固定 8px，按相位着色，当前帧白框；超宽自动换行）
    if currentAction then
        local gridH = drawFrameGrid(LX, yL, 880, currentAction)
        -- 图例
        setColor({0.4,0.5,0.9}); love.graphics.print("startup", LX, yL + gridH + 4)
        setColor({0.9,0.3,0.3}); love.graphics.print("active", LX + 78, yL + gridH + 4)
        setColor({0.9,0.75,0.2}); love.graphics.print("recovery", LX + 148, yL + gridH + 4)
        setColor(WHITE); love.graphics.print("= current frame (white outline)", LX + 238, yL + gridH + 4)
        yL = yL + gridH + 24
    else
        yL = yL + 4
    end

    -- 取消窗口多轨道（每个命令一条，和帧格 8px 对齐，当前帧竖线）
    setColor(CYAN); love.graphics.print("-- CANCEL WINDOWS (white line on filled = can cancel now) --", LX, yL); yL = yL + 16
    if currentAction then
        local ch = drawCancelTracks(LX, yL, 880, currentAction)
        yL = yL + ch + 4
    else
        setColor(GRAY); love.graphics.print("(idle — no action to cancel)", LX, yL); yL = yL + 18
    end
    setColor(currentAction and YELLOW or GRAY)
    love.graphics.print(currentAction and currentAction.name or "idle", LX + 708, yL)
    yL = yL + 4

    -- ===== INPUT BUFFER（右列）=====
    setColor(CYAN); love.graphics.print("-- INPUT BUFFER (hold frames; 1=just pressed  -1=just released) --", RX, yR); yR = yR + 18
    local function drawBufRow(keys, yy)
        local x = RX
        for _, name in ipairs(keys) do
            local v = buf[name]
            local col = GRAY
            if v > 0 then col = GREEN
            elseif v == -1 then col = RED
            elseif v == 1 then col = YELLOW end
            setColor(col)
            love.graphics.print(pad(name, 8), x, yy)
            love.graphics.print(pad(v, 4), x, yy + 16)
            x = x + 96
        end
        return yy + 36
    end
    yR = drawBufRow({"left","right","up","down","attack"}, yR)
    yR = drawBufRow({"jump","shoot","lock","special"}, yR)
    yR = yR + 6

    -- ===== RAW KEYBOARD（右列；live, updates even when paused）=====
    setColor(CYAN); love.graphics.print("-- RAW KEYBOARD (live; keys held NOW = what next step captures) --", RX, yR); yR = yR + 16
    local function drawRawRow(keys, yy)
        local x = RX
        for _, name in ipairs(keys) do
            local kbKey = keyboardMap[name]
            local down = kbKey and love.keyboard.isDown(kbKey) or false
            setColor(down and GREEN or GRAY)
            love.graphics.print(pad(string.upper(kbKey) .. ":" .. name, 12), x, yy)
            x = x + 100
        end
        return yy + 16
    end
    yR = drawRawRow({"left","right","up","down","attack"}, yR)
    yR = drawRawRow({"jump","shoot","lock","special"}, yR)
    yR = yR + 6

    -- ===== RAW GAMEPAD（右列；live; Xbox layout）=====
    setColor(CYAN)
    love.graphics.print("-- RAW GAMEPAD (live; Xbox: LS/DPad=move, X/RB=atk, A=jump, Y/RT=shoot, LB/LT=lock, B=special) --", RX, yR)
    yR = yR + 16
    if #gamepads == 0 then
        setColor(GRAY); love.graphics.print("(no gamepad connected)", RX, yR); yR = yR + 16
    else
        local gp = gamepads[1]
        local dpl = gp:isGamepadDown("dpleft")
        local dpr = gp:isGamepadDown("dpright")
        local dpu = gp:isGamepadDown("dpup")
        local dpd = gp:isGamepadDown("dpdown")
        local xb = gp:isGamepadDown("x")
        local ab = gp:isGamepadDown("a")
        local yb = gp:isGamepadDown("y")
        local bb = gp:isGamepadDown("b")
        local lb = gp:isGamepadDown("leftshoulder")
        local rb = gp:isGamepadDown("rightshoulder")
        -- 扳机是模拟轴，用轴值判断（静止 0，按下趋向 1）
        local lt = (gp:getGamepadAxis("triggerleft")  or 0) > STICK_DEADZONE
        local rt = (gp:getGamepadAxis("triggerright") or 0) > STICK_DEADZONE
        local function drawGpRow(items, yy)
            local x = RX
            for _, it in ipairs(items) do
                setColor(it[2] and GREEN or GRAY)
                love.graphics.print(pad(it[1], 12), x, yy)
                x = x + 100
            end
            return yy + 16
        end
        yR = drawGpRow({
            {"dpl:" .. (dpl and 1 or 0), dpl},
            {"dpr:" .. (dpr and 1 or 0), dpr},
            {"dpu:" .. (dpu and 1 or 0), dpu},
            {"dpd:" .. (dpd and 1 or 0), dpd},
        }, yR)
        yR = drawGpRow({
            {"X:" .. (xb and 1 or 0), xb},
            {"A:" .. (ab and 1 or 0), ab},
            {"Y:" .. (yb and 1 or 0), yb},
            {"B:" .. (bb and 1 or 0), bb},
        }, yR)
        yR = drawGpRow({
            {"LB:" .. (lb and 1 or 0), lb},
            {"RB:" .. (rb and 1 or 0), rb},
            {"LT:" .. (lt and 1 or 0), lt},
            {"RT:" .. (rt and 1 or 0), rt},
        }, yR)
        local ax = gp:getGamepadAxis("leftx") or 0
        local ay = gp:getGamepadAxis("lefty") or 0
        setColor(GRAY)
        love.graphics.print(string.format("LS: x=%+.2f y=%+.2f  (deadzone %.2f)  [%s]",
            ax, ay, STICK_DEADZONE, gp:getName() or "?"), RX, yR)
        yR = yR + 16
    end
    yR = yR + 6

    -- ===== 输入历史 + 系统事件（右列底部，并排两列）=====
    local IHX = RX              -- 输入历史 x
    local LGX = RX + 260        -- 系统事件 x（往左移，给 LOG 更多宽度）
    setColor(CYAN); love.graphics.print("-- INPUT --", IHX, yR)
    setColor(CYAN); love.graphics.print("-- LOG --", LGX, yR); yR = yR + 18
    -- 两列各 14 条，按索引对齐（同 index 同行，方便扫帧号对照）
    for i = 1, 14 do
        local ih = inputHistory[i]
        local lg = log[i]
        if ih then
            setColor(ih.color or GRAY)
            love.graphics.print(pad("f" .. ih.frame, 7) .. ih.text, IHX, yR)
        end
        if lg then
            setColor(lg.color or GRAY)
            love.graphics.print(pad("f" .. lg.frame, 7) .. lg.text, LGX, yR)
        end
        yR = yR + 16
    end
end

function love.keypressed(key)
    if key == "escape" then love.event.quit() end
    if key == "h" then
        hitstop = 8
        addLog("hitstop +8", {1, 0.5, 0.3})
        -- hitstop = 2
        -- addLog("hitstop +2", {1, 0.5, 0.3})
    end
    if key == "p" then
        paused = not paused
        addLog(paused and "paused" or "resumed", GRAY)
    end
    if key == "c" then
        for i = #log, 1, -1 do log[i] = nil end
        for i = #inputHistory, 1, -1 do inputHistory[i] = nil end
        addLog("log cleared", GRAY)
    end
    if key == "." then
        stepOnce = true
        paused = true
    end
end
