local Config = require("config")

local Debug = {}
Debug.__index = Debug

function Debug.new()
    return setmetatable({
        visible = true,
        showCollision = false,
        message = "F1 boxes  F2 record  F3 replay  F9 tests",
        messageTimer = 4,
        testResult = nil,
    }, Debug)
end

function Debug:announce(message)
    self.message = message
    self.messageTimer = 3
end

function Debug:update(dt)
    self.messageTimer = math.max(0, self.messageTimer - dt)
end

function Debug:keypressed(key, input, testRunner)
    if key == "f1" then
        self.visible = not self.visible
    elseif key == "f2" then
        if input.recording then
            input:stopRecording("last-replay.txt")
            self:announce("recording saved: last-replay.txt")
        else
            input:startRecording()
            self:announce("recording started")
        end
    elseif key == "f3" then
        local ok, errorMessage = input:loadReplay("last-replay.txt")
        self:announce(ok and "replay started" or errorMessage)
    elseif key == "f4" then
        self.showCollision = not self.showCollision
    elseif key == "f9" and testRunner then
        local ok, result = testRunner()
        self.testResult = result
        self:announce(ok and "logic tests passed" or ("test failed: " .. result))
    end
end

function Debug:drawWorld(player, world)
    if not self.showCollision then return end
    love.graphics.setColor(1, 0.25, 0.35, 0.8)
    love.graphics.rectangle("line", player.x, player.y, player.w, player.h)
    love.graphics.line(
        player.x + player.w / 2,
        player.y + player.h / 2,
        player.x + player.w / 2 + player.vx * 0.12,
        player.y + player.h / 2 + player.vy * 0.12
    )
    love.graphics.setColor(0.4, 1, 0.6, 0.45)
    for _, solid in ipairs(world.solids) do
        love.graphics.rectangle("line", solid.x, solid.y, solid.w, solid.h)
    end
    love.graphics.setColor(0.8, 0.6, 1, 0.8)
    for _, platform in ipairs(world.jumpThrus) do
        love.graphics.rectangle("line", platform.x, platform.y, platform.w, platform.h)
    end
end

function Debug:drawHud(player, input, level)
    if not self.visible then return end
    local c = Config.colors
    love.graphics.setColor(c.white[1], c.white[2], c.white[3], 1)
    love.graphics.print(
        string.format(
            "state %-10s pos %6.1f,%6.1f vel %6.1f,%6.1f",
            player.state, player.x, player.y, player.vx, player.vy
        ),
        8, Config.virtualHeight - 27
    )
    love.graphics.print(
        string.format(
            "dash %d/%d  stamina %3.0f  grace %.2f  var %.2f  room %d",
            player.dashes, player.maxDashes, player.stamina,
            player.jumpGraceTimer, player.varJumpTimer, level.roomIndex
        ),
        8, Config.virtualHeight - 17
    )
    love.graphics.setColor(c.muted[1], c.muted[2], c.muted[3], 1)
    love.graphics.print(
        "A/D or LS move  Space/A jump  X dash  LB grab  R/Back restart",
        8, Config.virtualHeight - 7
    )
    local gamepadName = input:gamepadName()
    if gamepadName then
        love.graphics.setColor(c.muted[1], c.muted[2], c.muted[3], 1)
        love.graphics.print("pad: " .. gamepadName, Config.virtualWidth - 112, 20)
    end
    if self.messageTimer > 0 then
        love.graphics.setColor(c.white[1], c.white[2], c.white[3], 1)
        love.graphics.print(self.message, 8, 20)
    end
    if input:isPlayingBack() then
        love.graphics.setColor(1, 0.85, 0.3, 1)
        love.graphics.print("[REPLAY]", Config.virtualWidth - 55, 8)
    elseif input.recording then
        love.graphics.setColor(1, 0.35, 0.35, 1)
        love.graphics.print("[REC]", Config.virtualWidth - 28, 8)
    end
end

return Debug
