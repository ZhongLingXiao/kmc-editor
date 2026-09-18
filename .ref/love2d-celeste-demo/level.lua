local Config = require("config")
local World = require("collision")
local Entities = require("entities")

local Level = {}
Level.__index = Level

local function buildNormal(world)
    world:addSolid(-32, 150, 420, 30)
    world:addSolid(430, 150, 230, 30)
    world:addSolid(700, 150, 280, 30)
    world:addSolid(1000, 150, 260, 30)
    world:addSolid(1280, 150, 420, 30)
    world:addSolid(80, 116, 48, 5)
    world:addSolid(170, 92, 55, 5)
    world:addJumpThru(270, 122, 55, 3)
    world:addJumpThru(510, 102, 70, 3)
    world:addSolid(620, 116, 30, 34)
    world:addSolid(820, 92, 28, 58)
    world:addSpring(332, 146, 8, 4)
    world:addHazard(470, 146, 18, 4)
    world:addBooster(570, 70, 12, 16)
    world:addRefill(760, 130)
    world:addMovingPlatform(900, 120, 34, 5,
        function(time, x, y)
            return x, y + math.sin(time * 1.5) * 28
        end)
    world:addSolid(1080, 110, 8, 40)
    world:addDreamBlock(1110, 74, 72, 48)
    world:addSolid(1220, 112, 40, 38)
end

local function buildWall(world)
    world:addSolid(-32, 150, 700, 30)
    world:addSolid(120, 42, 12, 108)
    world:addSolid(220, 25, 12, 125)
    world:addSolid(330, 55, 12, 95)
    world:addSolid(470, 25, 12, 125)
    world:addJumpThru(145, 112, 50, 3)
    world:addJumpThru(250, 88, 50, 3)
    world:addSpring(365, 146, 8, 4)
    world:addRefill(275, 70)
end

local function buildDash(world)
    world:addSolid(-32, 150, 260, 30)
    world:addSolid(300, 150, 100, 30)
    world:addSolid(500, 150, 520, 30)
    world:addSolid(245, 55, 20, 95)
    world:addSolid(400, 32, 20, 118)
    world:addSolid(630, 72, 20, 78)
    world:addSolid(810, 32, 20, 118)
    world:addRefill(285, 132)
    world:addBooster(340, 110, 12, 16, { mode = "red" })
    world:addJumpThru(540, 108, 62, 3)
    world:addDreamBlock(680, 58, 92, 64)
    world:addRefill(860, 120)
end

local function buildDream(world)
    world:addSolid(-32, 150, 820, 30)
    world:addSolid(130, 30, 12, 120)
    world:addSolid(580, 38, 12, 112)
    world:addDreamBlock(180, 55, 110, 68)
    world:addDreamBlock(350, 28, 160, 82)
    world:addSpring(730, 146, 8, 4)
    world:addRefill(95, 128)
end

local function buildSpecial(world)
    world:addSolid(-32, 150, 950, 30)
    world:addSolid(180, 80, 12, 70)
    world:addSolid(610, 70, 12, 80)
    world:addJumpThru(220, 118, 90, 3)
    world:addJumpThru(400, 92, 100, 3)
    world:addMovingPlatform(520, 120, 38, 5,
        function(time, x, y)
            return x + math.sin(time * 1.2) * 55, y
        end)
    world:addWater(680, 112, 150, 38)
    world:addLaunch(760, 130, 10, 10, 1, -1)
    world:addSpring(820, 146, 8, 4)
    world:addBooster(300, 102, 12, 16)
end

local ROOMS = {
    { name = "normal movement", spawnX = 35, spawnY = 130, width = 1700, build = buildNormal },
    { name = "wall jump", spawnX = 45, spawnY = 130, width = 700, build = buildWall },
    { name = "dash lab", spawnX = 45, spawnY = 130, width = 1020, build = buildDash },
    { name = "dream dash", spawnX = 45, spawnY = 130, width = 820, build = buildDream },
    { name = "special entities", spawnX = 45, spawnY = 130, width = 950, build = buildSpecial },
}

function Level.new()
    local self = setmetatable({
        world = World.new(),
        roomIndex = 1,
        room = nil,
        width = 0,
        height = Config.virtualHeight,
    }, Level)
    self:load(1)
    return self
end

function Level:load(index)
    self.roomIndex = ((index - 1) % #ROOMS) + 1
    self.room = ROOMS[self.roomIndex]
    self.width = self.room.width
    self.world:clear()
    self.room.build(self.world)
    return self.room.spawnX, self.room.spawnY
end

function Level:next()
    return self:load(self.roomIndex + 1)
end

function Level:update(dt)
    self.world:update(dt)
end

function Level:interact(player, input, effects)
    Entities.update(self.world, player, input, effects)
end

function Level:draw(colors)
    self.world:drawSolids(colors)
    Entities.draw(self.world, colors)
end

function Level:drawBackground(camera)
    local w, h = Config.virtualWidth, Config.virtualHeight
    love.graphics.setColor(Config.colors.sky[1], Config.colors.sky[2], Config.colors.sky[3], 1)
    love.graphics.rectangle("fill", camera.x, camera.y, w, h)

    love.graphics.setColor(Config.colors.skyTop[1], Config.colors.skyTop[2], Config.colors.skyTop[3], 0.6)
    love.graphics.rectangle("fill", camera.x, camera.y, w, h * 0.48)

    love.graphics.setColor(Config.colors.mountainFar[1], Config.colors.mountainFar[2], Config.colors.mountainFar[3], 1)
    local base = camera.y + h
    love.graphics.polygon("fill",
        camera.x, base,
        camera.x, camera.y + 112,
        camera.x + 80, camera.y + 58,
        camera.x + 150, camera.y + 112,
        camera.x + 235, camera.y + 42,
        camera.x + 350, camera.y + 110,
        camera.x + w, camera.y + 68,
        camera.x + w, base)

    love.graphics.setColor(Config.colors.mountainNear[1], Config.colors.mountainNear[2], Config.colors.mountainNear[3], 1)
    love.graphics.polygon("fill",
        camera.x, base,
        camera.x, camera.y + 140,
        camera.x + 100, camera.y + 94,
        camera.x + 180, camera.y + 132,
        camera.x + 260, camera.y + 88,
        camera.x + w, camera.y + 128,
        camera.x + w, base)
end

function Level:drawRoomName()
    love.graphics.setColor(Config.colors.muted[1], Config.colors.muted[2], Config.colors.muted[3], 1)
    love.graphics.print("room " .. self.roomIndex .. ": " .. self.room.name, 8, 8)
end

return Level
