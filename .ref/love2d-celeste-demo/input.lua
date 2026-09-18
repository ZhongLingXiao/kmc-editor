local Input = {}
Input.__index = Input
Input.DEADZONE = 0.25

local NAMES = {
    "left", "right", "up", "down",
    "jump", "dash", "grab", "confirm", "restart",
}

local KEY_MAP = {
    left = { "left", "a" },
    right = { "right", "d" },
    up = { "up", "w" },
    down = { "down", "s" },
    jump = { "space", "z", "c" },
    dash = { "x", "k" },
    grab = { "l", "v" },
    confirm = { "return", "kpenter" },
    restart = { "r" },
}

local PAD_MAP = {
    left = { "dpleft" },
    right = { "dpright" },
    up = { "dpup" },
    down = { "dpdown" },
    jump = { "a", "b" },
    dash = { "x", "y" },
    grab = { "leftshoulder", "rightshoulder" },
    confirm = { "start", "a" },
    restart = { "back" },
}

local function copyTable(source)
    local result = {}
    for key, value in pairs(source) do result[key] = value end
    return result
end

local function keyIsDown(keys)
    for _, key in ipairs(keys or {}) do
        if love.keyboard.isDown(key) then return true end
    end
    return false
end

local function padIsDown(buttons)
    for _, joystick in ipairs(love.joystick.getJoysticks()) do
        if joystick:isGamepad() then
            for _, button in ipairs(buttons or {}) do
                if joystick:isGamepadDown(button) then return true end
            end
        end
    end
    return false
end

local function stickDirection(axis, negative)
    for _, joystick in ipairs(love.joystick.getJoysticks()) do
        if joystick:isGamepad() then
            local value = joystick:getGamepadAxis(axis) or 0
            if negative and value < -Input.DEADZONE then return true end
            if not negative and value > Input.DEADZONE then return true end
        end
    end
    return false
end

local function readStick()
    local bestX, bestY, bestLength = 0, 0, 0
    for _, joystick in ipairs(love.joystick.getJoysticks()) do
        if joystick:isGamepad() then
            local x = joystick:getGamepadAxis("leftx") or 0
            local y = joystick:getGamepadAxis("lefty") or 0
            local length = math.sqrt(x * x + y * y)
            if length > bestLength then
                bestX, bestY, bestLength = x, y, length
            end
        end
    end
    if bestLength < Input.DEADZONE then return 0, 0 end
    return bestX, bestY
end

function Input.new()
    local self = setmetatable({
        physical = {},
        edgePressed = {},
        edgeReleased = {},
        eventPressed = {},
        tickHeld = {},
        tickPressed = {},
        tickReleased = {},
        tickFrame = 0,
        recording = false,
        recorded = {},
        playback = nil,
        playbackIndex = 1,
        playbackPrevious = {},
        analogX = 0,
        analogY = 0,
        tickAnalogX = 0,
        tickAnalogY = 0,
        connectedGamepads = {},
    }, Input)
    for _, name in ipairs(NAMES) do
        self.physical[name] = false
        self.edgePressed[name] = false
        self.edgeReleased[name] = false
        self.tickHeld[name] = false
        self.tickPressed[name] = false
        self.tickReleased[name] = false
    end
    for _, joystick in ipairs(love.joystick.getJoysticks()) do
        self:joystickAdded(joystick)
    end
    return self
end

function Input:_readPhysical(name)
    local keyboard = keyIsDown(KEY_MAP[name])
    if name == "left" then keyboard = keyboard or stickDirection("leftx", true) end
    if name == "right" then keyboard = keyboard or stickDirection("leftx", false) end
    if name == "up" then keyboard = keyboard or stickDirection("lefty", true) end
    if name == "down" then keyboard = keyboard or stickDirection("lefty", false) end
    return keyboard or padIsDown(PAD_MAP[name])
end

function Input:updateRender()
    if self.playback then return end

    self.analogX, self.analogY = readStick()
    for _, name in ipairs(NAMES) do
        local previous = self.physical[name]
        local current = self:_readPhysical(name)
        self.physical[name] = current
        if current and not previous then self.edgePressed[name] = true end
        if not current and previous then self.edgeReleased[name] = true end
    end

    for name in pairs(self.eventPressed) do
        self.edgePressed[name] = true
    end
    self.eventPressed = {}
end

function Input:keypressed(key)
    for name, keys in pairs(KEY_MAP) do
        for _, mapped in ipairs(keys) do
            if mapped == key then self.eventPressed[name] = true end
        end
    end
end

function Input:gamepadpressed(_, button)
    for name, buttons in pairs(PAD_MAP) do
        for _, mapped in ipairs(buttons) do
            if mapped == button then self.eventPressed[name] = true end
        end
    end
end

function Input:beginTick()
    if self.playback then
        local frame = self.playback[self.playbackIndex]
        if not frame then
            self:stopPlayback()
            frame = nil
        end
        if frame then
            self.tickHeld = copyTable(frame.held)
            self.tickPressed = copyTable(frame.pressed)
            self.tickReleased = copyTable(frame.released)
            self.tickAnalogX = frame.analogX or 0
            self.tickAnalogY = frame.analogY or 0
        end
    else
        self.tickHeld = copyTable(self.physical)
        self.tickPressed = copyTable(self.edgePressed)
        self.tickReleased = copyTable(self.edgeReleased)
        self.tickAnalogX = self.analogX
        self.tickAnalogY = self.analogY
    end

    self.tickFrame = self.tickFrame + 1
    if self.recording then
        self.recorded[#self.recorded + 1] = {
            held = copyTable(self.tickHeld),
            pressed = copyTable(self.tickPressed),
            released = copyTable(self.tickReleased),
            analogX = self.tickAnalogX,
            analogY = self.tickAnalogY,
        }
    end
end

function Input:endTick()
    self.edgePressed = {}
    self.edgeReleased = {}
    if self.playback then
        self.playbackPrevious = copyTable(self.tickHeld)
        self.playbackIndex = self.playbackIndex + 1
    end
end

function Input:held(name)
    return self.tickHeld[name] == true
end

function Input:pressed(name)
    return self.tickPressed[name] == true
end

function Input:released(name)
    return self.tickReleased[name] == true
end

function Input:consume(name)
    self.tickPressed[name] = false
end

function Input:axis()
    if math.abs(self.tickAnalogX) >= Input.DEADZONE then
        return math.max(-1, math.min(1, self.tickAnalogX))
    end
    local value = 0
    if self:held("left") then value = value - 1 end
    if self:held("right") then value = value + 1 end
    return value
end

function Input:aim(facing)
    local analogLength = math.sqrt(
        self.tickAnalogX * self.tickAnalogX
        + self.tickAnalogY * self.tickAnalogY
    )
    if analogLength >= Input.DEADZONE then
        return self.tickAnalogX / analogLength, self.tickAnalogY / analogLength
    end

    local x, y = 0, 0
    if self:held("left") then x = x - 1 end
    if self:held("right") then x = x + 1 end
    if self:held("up") then y = y - 1 end
    if self:held("down") then y = y + 1 end
    if x == 0 and y == 0 then x = facing or 1 end
    local length = math.sqrt(x * x + y * y)
    return x / length, y / length
end

function Input:startRecording()
    self.recording = true
    self.recorded = {}
end

function Input:stopRecording(path)
    self.recording = false
    local lines = { "# kmc-celeste-replay v1" }
    for _, frame in ipairs(self.recorded) do
        local held = {}
        for _, name in ipairs(NAMES) do
            if frame.held[name] then held[#held + 1] = name end
        end
        lines[#lines + 1] = table.concat(held, ",")
            .. "|" .. string.format("%.4f", frame.analogX or 0)
            .. "|" .. string.format("%.4f", frame.analogY or 0)
    end
    if path then love.filesystem.write(path, table.concat(lines, "\n")) end
    return self.recorded
end

function Input:loadReplay(path)
    local text = love.filesystem.read(path)
    if not text then return false, "replay file not found" end
    local frames = {}
    local previous = {}
    for line in text:gmatch("[^\r\n]+") do
        if line:sub(1, 1) ~= "#" then
            local held = {}
            for _, name in ipairs(NAMES) do held[name] = false end
            local heldPart, analogX, analogY = line:match("^([^|]*)|([^|]*)|([^|]*)$")
            if not heldPart then heldPart = line end
            for name in heldPart:gmatch("[^,]+") do held[name] = true end
            local pressed, released = {}, {}
            for _, name in ipairs(NAMES) do
                pressed[name] = held[name] and not previous[name] or false
                released[name] = previous[name] and not held[name] or false
            end
            frames[#frames + 1] = {
                held = held,
                pressed = pressed,
                released = released,
                analogX = tonumber(analogX) or 0,
                analogY = tonumber(analogY) or 0,
            }
            previous = held
        end
    end
    self.playback = frames
    self.playbackIndex = 1
    self.playbackPrevious = {}
    return true
end

function Input:stopPlayback()
    self.playback = nil
    self.playbackIndex = 1
end

function Input:isPlayingBack()
    return self.playback ~= nil
end

function Input:joystickAdded(joystick)
    if joystick and joystick:isGamepad() then
        self.connectedGamepads[joystick:getID()] = joystick:getName() or "gamepad"
    end
end

function Input:joystickRemoved(joystick)
    if joystick then self.connectedGamepads[joystick:getID()] = nil end
end

function Input:gamepadCount()
    local count = 0
    for _, joystick in ipairs(love.joystick.getJoysticks()) do
        if joystick:isGamepad() then count = count + 1 end
    end
    return count
end

function Input:gamepadName()
    for _, joystick in ipairs(love.joystick.getJoysticks()) do
        if joystick:isGamepad() then return joystick:getName() or "gamepad" end
    end
    return nil
end

return Input
