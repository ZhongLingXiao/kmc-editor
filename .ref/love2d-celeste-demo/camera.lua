local Config = require("config")

local Camera = {}
Camera.__index = Camera

function Camera.new()
    return setmetatable({
        x = 0,
        y = 0,
        targetX = 0,
        targetY = 0,
        lookAhead = 0,
        shakeAmount = 0,
    }, Camera)
end

function Camera:reset(x, y)
    self.x = x or 0
    self.y = y or 0
    self.targetX = self.x
    self.targetY = self.y
end

function Camera:shake(amount)
    self.shakeAmount = math.max(self.shakeAmount, amount or 1)
end

function Camera:update(player, level, dt)
    local targetX = player.x + player.w / 2 - Config.virtualWidth * 0.42
    local targetY = player.y + player.h / 2 - Config.virtualHeight * 0.54
    if player.vx then targetX = targetX + player.vx * 0.10 end
    self.targetX, self.targetY = targetX, targetY

    local follow = math.min(1, dt * 8)
    self.x = self.x + (self.targetX - self.x) * follow
    self.y = self.y + (self.targetY - self.y) * follow

    self.x = math.max(0, math.min(self.x, math.max(0, level.width - Config.virtualWidth)))
    self.y = math.max(0, math.min(self.y, math.max(0, level.height - Config.virtualHeight)))
    self.shakeAmount = math.max(0, self.shakeAmount - dt * 5)
end

function Camera:offset()
    if self.shakeAmount <= 0 then return 0, 0 end
    local amount = self.shakeAmount
    return (math.random() - 0.5) * amount, (math.random() - 0.5) * amount
end

return Camera
