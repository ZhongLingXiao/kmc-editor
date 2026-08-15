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

local Input = {prev = {}, curr = {}}

function Input.update()
    for _, vkey in ipairs(VirtualKeys) do
        Input.prev[vkey] = Input.curr[vkey] or false
        local kbKey = keyboardMap[vkey]
        Input.curr[vkey] = kbKey and love.keyboard.isDown(kbKey) or false
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
        priority = def.priority or 0,   -- 显式优先级（高者先查）；文档 §9.2 方案1
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

-- ---------- Action layer (phases: startup -> active -> recovery) ----------
local Action = {}
function Action.new(def)
    local a = {
        name = def.name,
        startup = def.startup or 4,
        active = def.active or 3,
        recovery = def.recovery or 12,
        cancel = def.cancel or {},   -- 取消窗口表: {{cmd=..., open=..., [close=...]}}, close 默认 = total
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
-- 触发优先级靠显式 priority 字段（文档 §9.2 方案1），不再依赖列表顺序。
-- priority 高的先查；同帧多命令匹配时（子集冲突）priority 高的取胜者。
-- 大体规则：输入越复杂（步多、键多）priority 越高，避免被单键命令抢先。
local cmds = {
    -- Void Slash: 后→前+攻击 (A, D, J) —— 斩裂时空（3步，最具体）
    Command.new({
        name = "void_slash",
        priority = 5, time = 30, buffer_time = 5,   -- 特殊技短 buffer：意图即执行
        steps = {
            {keys = {{name = "left"}}},
            {keys = {{name = "right"}}},
            {keys = {{name = "attack"}}},
        },
    }),
    -- Upper Slash: 后+攻击 (hold A + J) —— launcher 上挑（2键）
    Command.new({
        name = "upper_slash",
        priority = 4, time = 20, buffer_time = 5,
        steps = {
            {keys = {{name = "left", hold = true}, {name = "attack"}}},
        },
    }),
    -- Rapid Slash: 前+攻击 (hold D + J) —— 突进斩（2键）
    Command.new({
        name = "rapid_slash",
        priority = 4, time = 20, buffer_time = 5,
        steps = {
            {keys = {{name = "right", hold = true}, {name = "attack"}}},
        },
    }),
    -- Basic attack: tap J（单键；连击靠后摇取消链出来）
    -- 长 buffer：预输入/连击衔接容忍，跨招 buffer 撑到后摇窗口
    Command.new({
        name = "attack",
        priority = 1, time = 10, buffer_time = 15,
        steps = {
            {keys = {{name = "attack"}}},
        },
    }),
    -- Jump: tap L（独立输入；测试触发键保留 vs J 子集）
    -- 长 buffer：空中预输入落地接
    Command.new({
        name = "jump",
        priority = 1, time = 10, buffer_time = 15,
        steps = {
            {keys = {{name = "jump"}}},
        },
    }),
}
-- 触发用：按 priority 降序排好的 cmds 副本（不破坏原 cmds 顺序）
local cmdsByPriority
local function getCmdsByPriority()
    if not cmdsByPriority then
        cmdsByPriority = {}
        for _, c in ipairs(cmds) do cmdsByPriority[#cmdsByPriority+1] = c end
        table.sort(cmdsByPriority, function(a, b) return a.priority > b.priority end)
    end
    return cmdsByPriority
end

-- combo chain: each J press during a hit's recovery cancels into the next hit
-- basic 动作：特殊技可从前摇取消（自由），attack 后摇起始，jump 后摇~70%
local comboHits = {
    {name = "atk_1", startup = 25, active = 12, recovery = 45, cancel = {
        {cmd = "rapid_slash", open = 13}, {cmd = "upper_slash", open = 13}, {cmd = "void_slash", open = 13},
        {cmd = "attack", open = 38}, {cmd = "jump", open = 69},
    }},
    {name = "atk_2", startup = 25, active = 12, recovery = 45, cancel = {
        {cmd = "rapid_slash", open = 13}, {cmd = "upper_slash", open = 13}, {cmd = "void_slash", open = 13},
        {cmd = "attack", open = 38}, {cmd = "jump", open = 69},
    }},
    {name = "atk_3", startup = 30, active = 15, recovery = 60, cancel = {  -- finisher
        {cmd = "rapid_slash", open = 15}, {cmd = "upper_slash", open = 15}, {cmd = "void_slash", open = 15},
        {cmd = "attack", open = 46}, {cmd = "jump", open = 88},
    }},
}
local comboIndex = 0   -- which combo hit is currently playing (0 = none)

-- 特殊技动作：承诺招，后摇可被取消（special-cancel 后摇靠前；attack/jump 按承诺度）
local actionDefs = {
    rapid_slash = {name = "rapid_slash", startup = 18, active = 10, recovery = 45, cancel = {
        {cmd = "rapid_slash", open = 33}, {cmd = "upper_slash", open = 33}, {cmd = "void_slash", open = 33},
        {cmd = "attack", open = 52}, {cmd = "jump", open = 60},
    }},
    void_slash  = {name = "void_slash",  startup = 14, active = 8,  recovery = 36, cancel = {
        {cmd = "rapid_slash", open = 27}, {cmd = "upper_slash", open = 27}, {cmd = "void_slash", open = 27},
        {cmd = "attack", open = 23}, {cmd = "jump", open = 48},
    }},
    upper_slash = {name = "upper_slash", startup = 12, active = 8,  recovery = 30, cancel = {
        {cmd = "rapid_slash", open = 25}, {cmd = "upper_slash", open = 25}, {cmd = "void_slash", open = 25},
        {cmd = "attack", open = 21}, {cmd = "jump", open = 25},
    }},
    jump        = {name = "jump",        startup = 8,  active = 4,  recovery = 30, cancel = {
        {cmd = "attack", open = 13},
    }},
}

local currentAction = nil       -- nil == idle
local hitstop = 0
local frameCount = 0
local log = {}                  -- newest first; {frame, text, color}
local paused = false
local stepOnce = false

local function addLog(text, col)
    table.insert(log, 1, {frame = frameCount, text = text, color = col})
    if #log > 14 then table.remove(log) end
end

-- ---------- love callbacks ----------
local font
function love.load()
    local ok, f = pcall(love.graphics.newFont, FONT_PATH, FONT_SIZE)
    font = ok and f or love.graphics.newFont(FONT_SIZE)
    love.graphics.setFont(font)
    love.window.setMode(1080, 860)
    love.graphics.setBackgroundColor(0.10, 0.10, 0.12)
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
    local snapshot = buildSnapshot()
    Buffer.update(buf, snapshot)

    local in_hitstop = hitstop > 0

    -- ===== 第1步（续）：推进当前动作（hitstop 期间冻结 = 受击定格）=====
    if currentAction and not in_hitstop then
        local evt = Action.update(currentAction)
        if evt == "to_active" then
            addLog("action " .. currentAction.name .. " -> ACTIVE", {0.4, 0.8, 1})
        elseif evt == "to_recovery" then
            addLog("action " .. currentAction.name .. " -> RECOVERY (cancel OPEN)", {1, 0.85, 0.2})
        elseif evt == "to_idle" then
            addLog("action " .. currentAction.name .. " -> idle", {0.6, 0.6, 0.6})
            currentAction = nil
            comboIndex = 0  -- combo dropped (no cancel happened)
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

    -- ===== 第4步：触发判定 + 消费（按优先级取胜者）=====
    -- 取消规则：查当前动作的 cancel 窗口表。open ≤ 当前绝对帧 ≤ close(默认total) 则可取消。
    -- idle 时全部可触发。
    local function canFire(cmdName)
        if not currentAction then return true end
        local af = actionAbsFrame(currentAction)
        for _, w in ipairs(currentAction.cancel or {}) do
            if w.cmd == cmdName and af >= w.open and af <= (w.close or currentAction.total) then
                return true
            end
        end
        return false
    end
    -- 按 priority 降序检查命令：第一个 active + canFire 的取胜者，break（文档 §9.2 方案1）
    -- MUGEN 纯净模型：不清子集 curbuftime（文档 §4.5）。特殊技短 buffer_time(5)
    -- 让子集失败者自动过期，不需要清；attack/jump 长 buffer_time 用于跨招预输入，
    -- 它们和特殊技触发键不重叠（一个按 L 一个按 J），不会同帧 cascade。
    for _, cmd in ipairs(getCmdsByPriority()) do
        if Command.isActive(cmd) then
            if canFire(cmd.name) then
                -- 胜者（被触发的命令）
                cmd._fired = true
                -- 检测胜者是否本帧匹配（仅用于 UI 显示 _peakBuf）
                local wMatched = (cmd.cur_buffer_time > snap[cmd].buf)
                cmd._peakBuf = cmd.cur_buffer_time
                cmd.cur_buffer_time = 0  -- 消费胜者
                local prev = currentAction and currentAction.name or "idle"
                -- ===== 第5步：执行技能（启动新动作）=====
                if cmd.name == "attack" then
                    -- 连击链：atk_1 -> atk_2 -> atk_3 -> atk_1 ...
                    local nextIndex = (comboIndex % #comboHits) + 1
                    local def = comboHits[nextIndex]
                    currentAction = Action.new(def)
                    Action.start(currentAction)
                    comboIndex = nextIndex
                    addLog("TRIGGER attack -> " .. def.name .. "  (cancel from " .. prev .. ", combo " .. nextIndex .. "/" .. #comboHits .. ")", {0.3, 1, 0.3})
                else
                    -- 特殊技 / 跳跃：启动对应动作，重置连击链
                    currentAction = Action.new(actionDefs[cmd.name])
                    Action.start(currentAction)
                    comboIndex = 0
                    addLog("TRIGGER " .. cmd.name .. " -> " .. currentAction.name .. "  (cancel from " .. prev .. ")", {0.3, 1, 0.3})
                end
                addLog("action " .. currentAction.name .. " -> STARTUP", {0.4, 0.8, 1})
                break  -- 优先级：每帧只触发一个技能
            else
                -- 命令已缓冲但取消窗口关闭（还在 startup/active），
                -- 继续等待后摇；若 buffer_time 归零则预输入丢失
                if cmd.cur_buffer_time == 1 then
                    addLog("PRE-INPUT LOST " .. cmd.name .. " (buffer expired, cancel closed)", {1, 0.3, 0.3})
                end
            end
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
    local order = {"rapid_slash", "upper_slash", "void_slash", "attack", "jump"}
    local colFor = {rapid_slash = CYAN, upper_slash = CYAN, void_slash = CYAN, attack = GREEN, jump = YELLOW}
    local absF = actionAbsFrame(act)
    local startY = y
    -- 列布局
    local nameW = 100
    local barX, barW = x + nameW, 300
    local rangeX = barX + barW + 12
    local statX = rangeX + 60
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
    for _, cname in ipairs(order) do
        local open, close = nil, act.total
        for _, win in ipairs(act.cancel or {}) do
            if win.cmd == cname then open = win.open; close = win.close or act.total; break end
        end
        if open then
            -- 名字
            setColor(colFor[cname])
            love.graphics.print(cname, x, y)
            -- 迷你条：暗底(整条动作)
            love.graphics.setColor(0.16, 0.16, 0.18)
            love.graphics.rectangle("fill", barX, y + 3, barW, barH)
            -- 亮色窗口段
            local c = colFor[cname]
            love.graphics.setColor(c[1], c[2], c[3], 0.9)
            love.graphics.rectangle("fill", fx(open), y + 3, math.max(1, fx(close) - fx(open)), barH)
            -- 当前帧白竖线
            if absF > 0 then
                love.graphics.setColor(1, 1, 1)
                love.graphics.setLineWidth(1.5)
                love.graphics.line(fx(absF), y + 1, fx(absF), y + 3 + barH + 1)
            end
            -- 帧范围
            setColor(GRAY)
            love.graphics.print(open .. "-" .. close, rangeX, y)
            -- 状态点（实心绿=能取消，空心灰=不能）
            local canNow = absF >= open and absF <= close
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
        {"P=", "pause", GRAY},
        {".=", "step", GRAY},
        {"H=", "hitstop", GRAY},
        {"ESC=", "quit", GRAY},
    }); y = y + 18

    -- status line
    if paused then
        setColor(YELLOW)
        love.graphics.print("[ PAUSED ]", 760, y - 18)
    end
    setColor(GRAY)
    love.graphics.print("frame " .. frameCount, 760, 8)
    if hitstop > 0 then
        setColor(RED)
        love.graphics.print("[ HITSTOP " .. hitstop .. " ]", 760, 24)
    end

    -- ===== ACTION STATE =====
    setColor(CYAN); love.graphics.print("-- ACTION --", 12, y); y = y + 18
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
                         " frame: " .. fr .. "/" .. total, 12, y); y = y + 20

    -- 街霸风格帧格（每帧固定 8px，按相位着色，当前帧白框；超宽自动换行）
    if currentAction then
        local gridH = drawFrameGrid(12, y, 880, currentAction)
        -- 图例
        setColor({0.4,0.5,0.9}); love.graphics.print("startup", 12, y + gridH + 4)
        setColor({0.9,0.3,0.3}); love.graphics.print("active", 90, y + gridH + 4)
        setColor({0.9,0.75,0.2}); love.graphics.print("recovery", 160, y + gridH + 4)
        setColor(WHITE); love.graphics.print("= current frame (white outline)", 250, y + gridH + 4)
        y = y + gridH + 24
    else
        y = y + 4
    end

    -- 取消窗口多轨道（每个命令一条，和帧格 8px 对齐，当前帧竖线）
    setColor(CYAN); love.graphics.print("-- CANCEL WINDOWS (white line on filled = can cancel now) --", 12, y); y = y + 16
    if currentAction then
        local ch = drawCancelTracks(12, y, 880, currentAction)
        y = y + ch + 4
    else
        setColor(GRAY); love.graphics.print("(idle — no action to cancel)", 12, y); y = y + 18
    end
    setColor(comboIndex > 0 and YELLOW or GRAY)
    love.graphics.print("combo: " .. comboIndex .. "/" .. #comboHits, 720, y)
    y = y + 4

    -- ===== INPUT BUFFER =====
    setColor(CYAN); love.graphics.print("-- INPUT BUFFER (hold frames; 1=just pressed  -1=just released) --", 12, y); y = y + 18
    local function drawBufRow(keys, yy)
        local x = 12
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
    y = drawBufRow({"left","right","up","down","attack"}, y)
    y = drawBufRow({"jump","shoot","lock","special"}, y)
    y = y + 6

    -- ===== RAW KEYBOARD (live, updates even when paused) =====
    setColor(CYAN); love.graphics.print("-- RAW KEYBOARD (live; keys held NOW = what next step captures) --", 12, y); y = y + 16
    local function drawRawRow(keys, yy)
        local x = 12
        for _, name in ipairs(keys) do
            local kbKey = keyboardMap[name]
            local down = kbKey and love.keyboard.isDown(kbKey) or false
            setColor(down and GREEN or GRAY)
            love.graphics.print(pad(string.upper(kbKey) .. ":" .. name, 12), x, yy)
            x = x + 100
        end
        return yy + 16
    end
    y = drawRawRow({"left","right","up","down","attack"}, y)
    y = drawRawRow({"jump","shoot","lock","special"}, y)
    y = y + 6

    -- ===== COMMANDS =====
    setColor(CYAN); love.graphics.print("-- COMMANDS (priority desc) --", 12, y); y = y + 18
    -- 按 priority 降序展示（和触发检查顺序一致）
    for _, cmd in ipairs(getCmdsByPriority()) do
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
        love.graphics.print(pad("p" .. cmd.priority .. " [" .. cmd.name .. "]", 18) .. pad(status, 48) ..
              "  cur_time=" .. cmd.cur_time .. "/" .. cmd.time, 12, y); y = y + 18

        -- buffer_time bar (the pre-input survival window)
        if barVal then
            drawBar(12, y, 300, barVal, cmd.buffer_time, barCol)
            setColor(GRAY); love.graphics.print("buffer_time (pre-input ttl)", 320, y)
            y = y + 18
        end

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
            love.graphics.print(s, 12, y); y = y + 16
        end
        y = y + 6
    end

    -- ===== EVENT LOG =====
    setColor(CYAN); love.graphics.print("-- LOG --", 12, y); y = y + 18
    for _, e in ipairs(log) do
        setColor(e.color or GRAY)
        love.graphics.print(pad("f" .. e.frame, 7) .. e.text, 12, y); y = y + 16
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
    if key == "." then
        stepOnce = true
        paused = true
    end
end
