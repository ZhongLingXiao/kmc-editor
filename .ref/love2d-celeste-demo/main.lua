local Config = require("config")
local Input = require("input")
local Level = require("level")
local Player = require("player")
local Effects = require("effects")
local Animation = require("animation")
local Camera = require("camera")
local Debug = require("game_debug")
local Tests = require("tests")

local input
local level
local player
local effects
local camera
local debug
local canvas
local accumulator = 0
local paused = false

local function viewport()
    local width, height = love.graphics.getDimensions()
    local scale = math.min(width / Config.virtualWidth, height / Config.virtualHeight)
    local x = (width - Config.virtualWidth * scale) / 2
    local y = (height - Config.virtualHeight * scale) / 2
    return x, y, scale
end

local function loadRoom(index)
    local spawnX, spawnY = level:load(index)
    player.x, player.y = spawnX, spawnY
    player:setSpawn(spawnX, spawnY)
    player:respawn()
    effects = Effects.new()
    player:setEffects(effects)
    camera:reset(math.max(0, spawnX - 90), math.max(0, spawnY - 70))
    debug:announce("loaded room " .. level.roomIndex .. ": " .. level.room.name)
end

local function runTests()
    local ok, result = pcall(Tests.run)
    return ok, ok and result or result
end

function love.load(args)
    math.randomseed(os.time())
    love.graphics.setDefaultFilter("nearest", "nearest")
    canvas = love.graphics.newCanvas(Config.virtualWidth, Config.virtualHeight)
    canvas:setFilter("nearest", "nearest")

    input = Input.new()
    level = Level.new()
    local spawnX, spawnY = level.room.spawnX, level.room.spawnY
    player = Player.new(spawnX, spawnY)
    effects = Effects.new()
    player:setEffects(effects)
    camera = Camera.new()
    debug = Debug.new()
    loadRoom(1)

    local testMode = os.getenv("KMC_CELESTE_TEST") == "1"
    for _, argument in ipairs(args or _G.arg or {}) do
        if argument == "--test" then testMode = true end
    end
    if testMode then
        local ok, result = runTests()
        print(ok and ("PASS: " .. result) or ("FAIL: " .. result))
        if not ok then error(result) end
        love.event.quit()
    end
end

function love.update(dt)
    input:updateRender()
    if paused then
        debug:update(dt)
        return
    end

    accumulator = math.min(accumulator + math.min(dt, 0.1), Config.maxCatchup)
    while accumulator >= Config.fixedDt do
        input:beginTick()
        if input:pressed("restart") then
            player:respawn()
            input:consume("restart")
        end
        level:update(Config.fixedDt)
        player:update(level.world, input, Config.fixedDt)
        level:interact(player, input, effects)
        effects:update(Config.fixedDt)
        camera:update(player, level, Config.fixedDt)
        input:endTick()
        accumulator = accumulator - Config.fixedDt
    end
    debug:update(dt)
end

function love.draw()
    love.graphics.setCanvas(canvas)
    love.graphics.clear(0, 0, 0, 1)

    local shakeX, shakeY = camera:offset()
    love.graphics.push()
    love.graphics.translate(-camera.x + shakeX, -camera.y + shakeY)
    level:drawBackground(camera)
    level:draw(Config.colors)
    effects:draw()
    Animation.draw(player, Config.colors)
    debug:drawWorld(player, level.world)
    love.graphics.pop()

    level:drawRoomName()
    debug:drawHud(player, input, level)
    love.graphics.setCanvas()

    local x, y, scale = viewport()
    love.graphics.clear(0.02, 0.02, 0.04, 1)
    love.graphics.draw(canvas, x, y, 0, scale, scale)
end

function love.keypressed(key)
    input:keypressed(key)
    debug:keypressed(key, input, runTests)

    if key == "escape" then
        love.event.quit()
    elseif key == "f6" then
        paused = not paused
        debug:announce(paused and "paused" or "resumed")
    elseif key == "r" then
        player:respawn()
        debug:announce("respawned")
    elseif key == "1" or key == "2" or key == "3" or key == "4" or key == "5" then
        loadRoom(tonumber(key))
    end
end

function love.joystickadded(joystick)
    if input then input:joystickAdded(joystick) end
    if debug and joystick:isGamepad() then
        debug:announce("gamepad connected: " .. (joystick:getName() or "gamepad"))
    end
end

function love.joystickremoved(joystick)
    if input then input:joystickRemoved(joystick) end
    if debug then debug:announce("gamepad disconnected") end
end

function love.gamepadpressed(joystick, button)
    if input then input:gamepadpressed(joystick, button) end
end

function love.resize()
    -- The logical canvas remains fixed; viewport() recalculates its display scale.
end
