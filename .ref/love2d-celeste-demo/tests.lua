local World = require("collision")
local Player = require("player")

local Tests = {}

local function assertTrue(condition, message)
    if not condition then error(message, 0) end
end

local function fakeInput(options)
    options = options or {}
    local input = {
        frame = 0,
        consumed = {},
    }
    function input:next()
        self.frame = self.frame + 1
        self.consumed = {}
    end
    function input:held(name)
        if options.held then return options.held(name, self.frame) end
        return false
    end
    function input:pressed(name)
        if self.consumed[name] then return false end
        if options.pressed then return options.pressed(name, self.frame) end
        return false
    end
    function input:consume(name)
        self.consumed[name] = true
    end
    function input:released()
        return false
    end
    function input:axis()
        if options.axis then return options.axis(self.frame) end
        return 0
    end
    function input:aim(facing)
        if options.aim then return options.aim(self.frame) end
        return facing or 1, 0
    end
    return input
end

local function step(player, world, input, frames)
    for _ = 1, frames do
        input:next()
        player:update(world, input, 1 / 60)
    end
end

function Tests.run()
    local world = World.new()
    world:addSolid(-100, 100, 500, 30)
    local player = Player.new(30, 89)
    local jumpInput = fakeInput({
        pressed = function(name, frame)
            return name == "jump" and frame == 2
        end,
        held = function(name, frame)
            return name == "jump" and frame <= 12
        end,
    })
    step(player, world, jumpInput, 2)
    local startY = player.y
    step(player, world, jumpInput, 20)
    assertTrue(player.y < startY, "jump did not rise")
    step(player, world, jumpInput, 100)
    assertTrue(player.onGround, "jump did not land")

    local dashWorld = World.new()
    dashWorld:addSolid(-100, 140, 700, 40)
    local dasher = Player.new(30, 100)
    local dashInput = fakeInput({
        pressed = function(name, frame)
            return name == "dash" and frame == 1
        end,
        held = function(name)
            return name == "right"
        end,
        axis = function() return 1 end,
        aim = function() return 1, 0 end,
    })
    local startX = dasher.x
    step(dasher, dashWorld, dashInput, 10)
    assertTrue(dasher.x > startX + 15, "dash did not travel horizontally")

    local wallWorld = World.new()
    wallWorld:addSolid(-100, 140, 700, 40)
    wallWorld:addSolid(48, 0, 12, 140)
    local wallPlayer = Player.new(40, 100)
    wallPlayer.vy = 25
    local wallInput = fakeInput({
        pressed = function(name, frame)
            return name == "jump" and frame == 1
        end,
        held = function(name)
            return name == "jump"
        end,
    })
    step(wallPlayer, wallWorld, wallInput, 1)
    assertTrue(wallPlayer.vy < 0, "wall jump did not launch upward")

    return true, "jump, dash and wall jump checks passed"
end

return Tests
