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

    local coyoteWorld = World.new()
    coyoteWorld:addSolid(0, 100, 40, 20)
    local coyote = Player.new(0, 89)
    step(coyote, coyoteWorld, fakeInput(), 1)
    assertTrue(coyote.onGround, "coyote setup was not grounded")
    coyote.x = 80
    local coyoteJump = fakeInput({
        pressed = function(name, frame) return name == "jump" and frame == 5 end,
        held = function(name, frame) return name == "jump" and frame >= 5 end,
    })
    step(coyote, coyoteWorld, coyoteJump, 5)
    assertTrue(coyote.vy < 0, "coyote jump inside 0.10s did not launch, vy=" .. coyote.vy)

    local lateWorld = World.new()
    lateWorld:addSolid(0, 100, 40, 20)
    local late = Player.new(0, 89)
    step(late, lateWorld, fakeInput(), 1)
    late.x = 80
    local lateJump = fakeInput({
        pressed = function(name, frame) return name == "jump" and frame == 8 end,
        held = function(name, frame) return name == "jump" and frame >= 8 end,
    })
    step(late, lateWorld, lateJump, 8)
    assertTrue(late.vy > 0, "jump after coyote window should keep falling, vy=" .. late.vy)

    local downWorld = World.new()
    downWorld:addSolid(-20, 400, 200, 20)
    local downDasher = Player.new(20, 40)
    local downInput = fakeInput({
        pressed = function(name, frame) return name == "dash" and frame == 1 end,
        aim = function() return 0, 1 end,
    })
    step(downDasher, downWorld, downInput, 12)
    assertTrue(downDasher.vy > 180, "down dash should keep dash speed, vy=" .. downDasher.vy)

    local wallDashWorld = World.new()
    wallDashWorld:addSolid(80, 0, 20, 200)
    local wallDasher = Player.new(68, 40)
    local wallDashInput = fakeInput({
        pressed = function(name, frame) return name == "dash" and frame == 1 end,
        aim = function() return 1, 0 end,
    })
    step(wallDasher, wallDashWorld, wallDashInput, 4)
    assertTrue(wallDasher.state == "dash", "horizontal dash ended on the first wall hit")

    local superWorld = World.new()
    superWorld:addSolid(-20, 100, 300, 20)
    local superPlayer = Player.new(20, 89)
    local superInput = fakeInput({
        pressed = function(name, frame)
            return (name == "dash" and frame == 1) or (name == "jump" and frame == 2)
        end,
        held = function(name, frame) return name == "jump" and frame >= 2 end,
        aim = function() return 1, 0 end,
    })
    step(superPlayer, superWorld, superInput, 2)
    assertTrue(math.abs(superPlayer.vx - 260) < 1, "super jump vx was " .. superPlayer.vx)

    local redWorld = World.new()
    redWorld:addSolid(-20, 400, 200, 20)
    local redPlayer = Player.new(20, 40)
    redPlayer.redDash = true
    local redInput = fakeInput({
        pressed = function(name, frame) return name == "dash" and frame == 1 end,
        aim = function() return 1, 0 end,
    })
    step(redPlayer, redWorld, redInput, 20)
    assertTrue(redPlayer.state == "red_dash", "red dash ended on a timer")

    local squashWorld = World.new()
    squashWorld:addSolid(80, 0, 20, 200)
    local squashPlayer = Player.new(68, 40)
    squashPlayer.redDash = true
    local squashInput = fakeInput({
        pressed = function(name, frame) return name == "dash" and frame == 1 end,
        aim = function() return 1, 0 end,
    })
    step(squashPlayer, squashWorld, squashInput, 4)
    assertTrue(squashPlayer.state == "hit_squash", "red dash collision should enter hit squash, state=" .. squashPlayer.state)

    return true, "jump, dash, coyote, super jump and red dash checks passed"
end

return Tests
