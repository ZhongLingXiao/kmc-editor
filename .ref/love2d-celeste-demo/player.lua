local Config = require("config")
local StateIds = require("state_ids")

local Player = {}
Player.__index = Player

local P = Config.physics
local PI = math.pi

local function approach(value, target, amount)
    if value < target then return math.min(value + amount, target) end
    if value > target then return math.max(value - amount, target) end
    return target
end

local function sign(value)
    if value < 0 then return -1 end
    if value > 0 then return 1 end
    return 0
end

local function clamp(value, low, high)
    return math.max(low, math.min(high, value))
end

local function normalize(x, y)
    local length = math.sqrt(x * x + y * y)
    if length == 0 then return 0, 0 end
    return x / length, y / length
end

local function lerp(a, b, amount)
    return a + (b - a) * amount
end

function Player.new(x, y)
    local self = setmetatable({
        x = x,
        y = y,
        spawnX = x,
        spawnY = y,
        w = Config.player.width,
        h = Config.player.height,
        vx = 0,
        vy = 0,
        facing = 1,

        state = "normal",
        stateId = StateIds.normal,
        previousState = "normal",
        stateTime = 0,
        animTime = 0,
        dead = false,
        deathTimer = 0,
        ducking = false,

        onGround = false,
        groundPlatform = nil,
        wallSlideDir = 0,
        jumpGraceTimer = 0,
        jumpBufferTimer = 0,
        varJumpTimer = 0,
        varJumpSpeed = 0,
        autoJump = false,
        autoJumpTimer = 0,
        landingTimer = 0,

        wallSlideTimer = P.wallSlideTime,
        wallSpeedRetentionTimer = 0,
        wallSpeedRetained = 0,
        forceMoveX = 0,
        forceMoveXTimer = 0,
        maxFall = P.maxFall,

        dashes = Config.player.maxDashes,
        maxDashes = Config.player.maxDashes,
        dashCooldownTimer = 0,
        dashRefillCooldownTimer = 0,
        dashDirX = 0,
        dashDirY = 0,
        dashTimer = 0,
        dashAttackTimer = 0,
        dashStartedOnGround = false,
        dashInitialized = false,
        beforeDashVx = 0,
        beforeDashVy = 0,
        redDash = false,

        maxStamina = Config.player.startStamina,
        stamina = Config.player.startStamina,
        climbNoMoveTimer = 0,
        tired = false,
        boostTargetX = 0,
        boostTargetY = 0,
        boostTimer = 0,
        boostRed = false,
        dreamDashTimer = 0,
        dreamJump = false,
        specialTimer = 0,
        specialVx = 0,
        specialVy = 0,

        hairColor = Config.colors.redHair,
        effects = nil,
    }, Player)
    return self
end

function Player:setEffects(effects)
    self.effects = effects
end

function Player:rect()
    return { x = self.x, y = self.y, w = self.w, h = self.h }
end

function Player:setSpawn(x, y)
    self.spawnX, self.spawnY = x, y
end

function Player:setState(state)
    if self.state == state then return end
    self.previousState = self.state
    self.state = state
    self.stateId = StateIds[state] or StateIds.normal
    self.stateTime = 0
    self.animTime = 0
    if state ~= "climb" then self.wallSlideDir = 0 end
    if state == "normal" then
        self.dashInitialized = false
    end
end

function Player:enterSpecial(state, duration, vx, vy)
    self.specialTimer = duration or 0.5
    self.specialVx = vx or 0
    self.specialVy = vy or 0
    self:setState(state)
end

function Player:respawn()
    self.x, self.y = self.spawnX, self.spawnY
    self.vx, self.vy = 0, 0
    self.state = "normal"
    self.stateId = StateIds.normal
    self.previousState = "normal"
    self.stateTime = 0
    self.animTime = 0
    self.dead = false
    self.deathTimer = 0
    self.onGround = false
    self.jumpGraceTimer = 0
    self.jumpBufferTimer = 0
    self.varJumpTimer = 0
    self.dashes = self.maxDashes
    self.stamina = self.maxStamina
    self.tired = false
    self.wallSlideTimer = P.wallSlideTime
    self.landingTimer = 0
    self.specialTimer = 0
    self.hairColor = Config.colors.redHair
end

function Player:die()
    if self.dead then return end
    self.dead = true
    self.deathTimer = 0.65
    self.vx = -self.facing * 28
    self.vy = -80
    self:setState("dead")
    if self.effects then
        self.effects:burst(self.x + self.w / 2, self.y + self.h / 2, 12, "dash")
    end
end

function Player:_move(world, dx, dy, ignoreJumpThru)
    local wasGrounded = self.onGround
    local result = world:move(self, dx, dy, ignoreJumpThru)
    self.onGround = result.hitFloor
    if not self.onGround then
        self.onGround = world:isGrounded(self)
    end

    if result.hitWall then
        self.wallSpeedRetained = self.vx
        self.wallSpeedRetentionTimer = P.wallSpeedRetentionTime
        self.vx = 0
    end
    if result.y.hitCeiling then
        self.vy = math.max(0, self.vy)
        if self.varJumpTimer < P.varJumpTime - P.ceilingVarJumpGrace then
            self.varJumpTimer = 0
        end
    end
    if result.hitFloor and self.vy > 0 then self.vy = 0 end

    if not wasGrounded and self.onGround then
        self.landingTimer = 0.10
        if self.effects then self.effects:dust(self.x + self.w / 2, self.y + self.h, 4) end
    end
    return result
end

function Player:_updateGround(world, dt)
    local grounded, platform = world:isGrounded(self)
    self.onGround = grounded
    self.groundPlatform = platform
    if grounded then
        self.jumpGraceTimer = P.jumpGraceTime
        self.wallSlideTimer = P.wallSlideTime
        self.dashes = self.maxDashes
        self.stamina = self.maxStamina
        self.tired = false
        self.autoJump = false
        self.maxFall = P.maxFall
    else
        self.jumpGraceTimer = math.max(0, self.jumpGraceTimer - dt)
    end
end

function Player:_updateTimers(dt)
    self.stateTime = self.stateTime + dt
    self.animTime = self.animTime + dt
    self.jumpBufferTimer = math.max(0, self.jumpBufferTimer - dt)
    self.jumpGraceTimer = math.max(0, self.jumpGraceTimer - dt)
    self.varJumpTimer = math.max(0, self.varJumpTimer - dt)
    self.dashCooldownTimer = math.max(0, self.dashCooldownTimer - dt)
    self.dashRefillCooldownTimer = math.max(0, self.dashRefillCooldownTimer - dt)
    self.dashAttackTimer = math.max(0, self.dashAttackTimer - dt)
    self.landingTimer = math.max(0, self.landingTimer - dt)
    self.autoJumpTimer = math.max(0, self.autoJumpTimer - dt)
    self.forceMoveXTimer = math.max(0, self.forceMoveXTimer - dt)
    self.wallSpeedRetentionTimer = math.max(0, self.wallSpeedRetentionTimer - dt)
    if self.wallSpeedRetentionTimer <= 0 then self.wallSpeedRetained = 0 end
end

function Player:_updateHairColor()
    if self.dead then
        self.hairColor = Config.colors.flashHair
    elseif self.maxDashes > 1 then
        self.hairColor = Config.colors.twoDashHair
    elseif self.dashes <= 0 then
        self.hairColor = Config.colors.usedHair
    else
        self.hairColor = Config.colors.redHair
    end
end

function Player:_readJumpBuffer(input)
    if input:pressed("jump") then
        self.jumpBufferTimer = math.max(self.jumpBufferTimer, 0.12)
    end
end

function Player:_horizontalInput(input)
    if self.forceMoveXTimer > 0 then return self.forceMoveX end
    return input:axis()
end

function Player:_tryJump(world, input)
    if self.jumpBufferTimer <= 0 then return false end

    if self.onGround or self.jumpGraceTimer > 0 then
        self:jump(input)
        input:consume("jump")
        return true
    end

    if world:wallCheck(self, -1, P.wallJumpCheckDist) then
        self:wallJump(1)
        self.jumpBufferTimer = 0
        input:consume("jump")
        return true
    elseif world:wallCheck(self, 1, P.wallJumpCheckDist) then
        self:wallJump(-1)
        self.jumpBufferTimer = 0
        input:consume("jump")
        return true
    end
    return false
end

function Player:jump(input)
    self.jumpGraceTimer = 0
    self.varJumpTimer = P.varJumpTime
    self.autoJump = false
    self.vy = P.jumpSpeed
    self.vx = self.vx + P.jumpHBoost * self:_horizontalInput(input)
    self.varJumpSpeed = self.vy
    self.onGround = false
    self.jumpBufferTimer = 0
    self.landingTimer = 0
    self.wallSlideTimer = P.wallSlideTime
    self:setState("normal")
    if self.effects then self.effects:dust(self.x + self.w / 2, self.y + self.h, 4) end
end

function Player:wallJump(direction)
    self.ducking = false
    self.jumpGraceTimer = 0
    self.varJumpTimer = P.varJumpTime
    self.autoJump = false
    self.vx = P.wallJumpHSpeed * direction
    self.vy = P.jumpSpeed
    self.varJumpSpeed = self.vy
    self.forceMoveX = direction
    self.forceMoveXTimer = P.wallJumpForceTime
    self.wallSlideTimer = P.wallSlideTime
    self.wallSpeedRetentionTimer = 0
    self.onGround = false
    self:setState("normal")
    if self.effects then
        self.effects:dust(self.x + self.w / 2 - direction * 2, self.y + self.h / 2, 4)
    end
end

function Player:superJump(input)
    self.jumpGraceTimer = 0
    self.varJumpTimer = P.varJumpTime
    self.autoJump = true
    self.vx = P.maxRun * 2.8 * self.facing
    self.vy = P.jumpSpeed
    self.varJumpSpeed = self.vy
    self:setState("normal")
    input:consume("jump")
end

function Player:bounce(world, speed)
    self.vy = speed or P.bounceSpeed
    self.varJumpTimer = 0.20
    self.varJumpSpeed = self.vy
    self.autoJump = true
    self.autoJumpTimer = 0.10
    self.onGround = false
    self:setState("normal")
end

function Player:rebound(speedX, speedY)
    self.vx = speedX or P.reboundSpeedX
    self.vy = speedY or P.reboundSpeedY
    self.varJumpTimer = 0.15
    self.varJumpSpeed = self.vy
    self.autoJump = true
    self.onGround = false
    self:setState("normal")
end

function Player:launch(directionX, directionY)
    local x, y = normalize(directionX or 0, directionY or -1)
    self.vx = x * P.launchSpeed
    self.vy = y * P.launchSpeed
    self.varJumpTimer = 0.20
    self.varJumpSpeed = self.vy
    self.autoJump = true
    self:setState("normal")
end

function Player:enterBoost(mode)
    self.boostRed = mode == "red"
    self.boostTargetX = self.x + self.w / 2
    self.boostTargetY = self.y + self.h / 2
    self.boostTimer = P.boostTime
    self.vx, self.vy = 0, 0
    self:setState("boost")
    self.dashes = self.maxDashes
    self.stamina = self.maxStamina
end

function Player:_startDash(input)
    if self.dashCooldownTimer > 0 or self.dashes <= 0 then return false end
    local dx, dy = input:aim(self.facing)
    self.dashes = math.max(0, self.dashes - 1)
    self.dashCooldownTimer = P.dashCooldown
    self.dashRefillCooldownTimer = P.dashRefillCooldown
    self.dashAttackTimer = P.dashAttackTime
    self.dashStartedOnGround = self.onGround
    self.beforeDashVx, self.beforeDashVy = self.vx, self.vy
    self.dashDirX, self.dashDirY = dx, dy
    self.dashTimer = P.dashTime
    self.dashInitialized = true
    self.vx, self.vy = dx * P.dashSpeed, dy * P.dashSpeed
    self.onGround = false
    self:setState(self.redDash and "red_dash" or "dash")
    input:consume("dash")
    if self.effects then
        self.effects:burst(self.x + self.w / 2, self.y + self.h / 2, 8, "dash")
    end
    return true
end

function Player:_endDash()
    if self.dashDirY <= 0 then
        self.vx = self.dashDirX * P.endDashSpeed
        self.vy = self.dashDirY * P.endDashSpeed
        if self.vy < 0 then self.vy = self.vy * P.endDashUpMult end
    else
        self.vx = 0
        self.vy = 0
    end
    self.autoJump = true
    self.autoJumpTimer = 0
    self:setState("normal")
end

function Player:_dashCornerCorrect(world)
    for distance = 1, P.dashCornerCorrection do
        for _, vertical in ipairs({ -distance, distance }) do
            if not world:solidAt(self.x, self.y + vertical, self.w, self.h) then
                self.y = self.y + vertical
                return true
            end
        end
    end
    return false
end

function Player:_upwardCornerCorrect(world, direction)
    if self.vy >= 0 or direction == 0 then return false end
    for distance = 1, P.upwardCornerCorrection do
        for _, offset in ipairs({ distance, -distance }) do
            local x = self.x + offset
            if not world:solidAt(x, self.y, self.w, self.h) then
                self.x = x
                return true
            end
        end
    end
    return false
end

function Player:_dashUpdate(world, input, dt)
    if not self.dashInitialized then
        local dx, dy = input:aim(self.facing)
        self.dashDirX, self.dashDirY = dx, dy
        self.vx, self.vy = dx * P.dashSpeed, dy * P.dashSpeed
        self.dashInitialized = true
    end

    if input:pressed("jump") then
        if self.dashDirY == 0 and self.jumpGraceTimer > 0 then
            self:superJump(input)
            return
        end
        if self.dashDirY == -1 then
            if world:wallCheck(self, 1, P.wallJumpCheckDist) then
                self:wallJump(-1)
                input:consume("jump")
                return
            elseif world:wallCheck(self, -1, P.wallJumpCheckDist) then
                self:wallJump(1)
                input:consume("jump")
                return
            end
        elseif world:wallCheck(self, 1, P.wallJumpCheckDist) then
            self:wallJump(-1)
            input:consume("jump")
            return
        elseif world:wallCheck(self, -1, P.wallJumpCheckDist) then
            self:wallJump(1)
            input:consume("jump")
            return
        end
    end

    local dream = world:findDreamBlock(self, { x = self.dashDirX, y = self.dashDirY })
    if dream then
        self.dreamDashTimer = 0
        self:setState("dream_dash")
        return
    end

    local result = self:_move(
        world,
        self.dashDirX * P.dashSpeed * dt,
        self.dashDirY * P.dashSpeed * dt,
        false
    )
    if result.hitWall or result.hitFloor or result.hitCeiling then
        self:_dashCornerCorrect(world)
        self:_endDash()
        return
    end
    if self.effects then
        self.effects:dash(self.x + self.w / 2, self.y + self.h / 2, self.dashDirX, self.dashDirY)
    end

    self.dashTimer = self.dashTimer - dt
    if self.dashTimer <= 0 then self:_endDash() end
end

function Player:_dreamDashUpdate(world, input, dt)
    self.dreamDashTimer = self.dreamDashTimer + dt
    local dream = world:findDreamBlock(self, { x = self.dashDirX, y = self.dashDirY })
    if not dream and self.dreamDashTimer >= P.dreamDashMinTime then
        self.dreamJump = input:pressed("jump")
        if self.dreamJump then
            self:jump(input)
        else
            self:_endDash()
        end
        return
    end

    local result = self:_move(
        world,
        self.dashDirX * P.dashSpeed * dt,
        self.dashDirY * P.dashSpeed * dt,
        true
    )
    if result.hitWall or result.hitFloor or result.hitCeiling then
        self:_endDash()
        return
    end
    if input:pressed("jump") and self.dreamDashTimer >= P.dreamDashMinTime then
        self:jump(input)
    end
end

function Player:_normalUpdate(world, input, dt)
    local moveX = self:_horizontalInput(input)
    if moveX ~= 0 then self.facing = moveX end

    if input:held("grab")
        and not self.tired
        and not self.onGround
        and (world:wallCheck(self, self.facing, 2) or world:wallCheck(self, -self.facing, 2))
    then
        self:setState("climb")
        return
    end

    if input:pressed("dash") and self:_startDash(input) then return end

    if input:held("down") and self.onGround then
        self.ducking = true
    elseif not input:held("down") then
        self.ducking = false
    end

    local maxRun = self.ducking and P.maxRun * 0.8 or P.maxRun
    local mult = self.onGround and 1 or P.airMult
    if math.abs(self.vx) > maxRun and sign(self.vx) == moveX then
        self.vx = approach(self.vx, maxRun * moveX, P.runReduce * mult * dt)
    else
        self.vx = approach(self.vx, maxRun * moveX, P.runAccel * mult * dt)
    end

    if self.wallSpeedRetentionTimer > 0
        and moveX == sign(self.wallSpeedRetained)
        and not world:wallCheck(self, moveX, 1)
    then
        self.vx = self.wallSpeedRetained
        self.wallSpeedRetentionTimer = 0
    end

    if self:_tryJump(world, input) then
        -- Continue the same update so the jump receives normal gravity.
    end

    local currentMaxFall = self.maxFall
    if input:held("down") and self.vy >= P.maxFall then
        self.maxFall = approach(self.maxFall, P.fastMaxFall, P.fastMaxAccel * dt)
    else
        self.maxFall = approach(self.maxFall, P.maxFall, P.fastMaxAccel * dt)
    end
    currentMaxFall = self.maxFall

    self.wallSlideDir = 0
    if not self.onGround
        and self.vy >= 0
        and not input:held("down")
        and self.wallSlideTimer > 0
        and world:wallCheck(self, self.facing, 1)
    then
        self.wallSlideDir = self.facing
        currentMaxFall = lerp(
            currentMaxFall,
            P.wallSlideStartMax,
            self.wallSlideTimer / P.wallSlideTime
        )
        self.wallSlideTimer = math.max(0, self.wallSlideTimer - dt)
    end

    if not self.onGround then
        local gravityMult = 1
        if math.abs(self.vy) < P.halfGravThreshold
            and (input:held("jump") or self.autoJump)
        then
            gravityMult = 0.5
        end
        self.vy = approach(self.vy, currentMaxFall, P.gravity * gravityMult * dt)
    end

    if self.varJumpTimer > 0 then
        if input:held("jump") or self.autoJump then
            self.vy = math.min(self.vy, self.varJumpSpeed)
        else
            self.varJumpTimer = 0
        end
    end

    local result = self:_move(
        world,
        self.vx * dt,
        self.vy * dt,
        input:held("down") and self.onGround
    )
    if result.hitWall then
        self:_upwardCornerCorrect(world, moveX)
    end
    if result.hitFloor then
        self.vy = 0
        self.autoJump = false
    end
end

function Player:_climbUpdate(world, input, dt)
    local wallDirection = 0
    if world:wallCheck(self, self.facing, 2) then wallDirection = self.facing end
    if world:wallCheck(self, -self.facing, 2) then wallDirection = -self.facing end
    if not input:held("grab") or wallDirection == 0 then
        self:setState("normal")
        return
    end

    local moveY = 0
    if input:held("up") then moveY = -1 end
    if input:held("down") then moveY = 1 end
    if moveY < 0 then
        self.stamina = self.stamina - P.climbUpCost * dt
        self.vy = approach(self.vy, P.climbUpSpeed, P.climbAccel * dt)
    elseif moveY > 0 then
        self.stamina = self.stamina - P.climbStillCost * dt
        self.vy = approach(self.vy, P.climbDownSpeed, P.climbAccel * dt)
    else
        self.stamina = self.stamina - P.climbStillCost * dt
        self.vy = approach(self.vy, 0, P.climbAccel * dt)
    end
    self.tired = self.stamina <= 0
    if self.tired then self.vy = approach(self.vy, P.climbSlipSpeed, P.climbAccel * dt) end
    self.vx = 0
    self.wallSlideDir = wallDirection

    if input:pressed("jump") then
        self:wallJump(-wallDirection)
        input:consume("jump")
        return
    end
    self:_move(world, 0, self.vy * dt, true)
end

function Player:_boostUpdate(world, input, dt)
    self.boostTimer = self.boostTimer - dt
    local targetX = self.boostTargetX + input:aim(self.facing) * 3
    local targetY = self.boostTargetY
    local dx = targetX - (self.x + self.w / 2)
    local dy = targetY - (self.y + self.h / 2)
    local length = math.sqrt(dx * dx + dy * dy)
    if length > 0 then
        local distance = math.min(length, P.boostMoveSpeed * dt)
        self.x = self.x + dx / length * distance
        self.y = self.y + dy / length * distance
    end
    if input:pressed("dash") then
        input:consume("dash")
        self.redDash = self.boostRed
        self:setState(self.boostRed and "red_dash" or "dash")
        self.dashInitialized = false
        self.dashTimer = P.dashTime
        self.dashCooldownTimer = P.dashCooldown
        self.dashAttackTimer = P.dashAttackTime
        self.vx, self.vy = 0, 0
        return
    end
    if self.boostTimer <= 0 then
        self.redDash = self.boostRed
        self.dashInitialized = false
        self.dashTimer = P.dashTime
        self.dashCooldownTimer = P.dashCooldown
        self.dashAttackTimer = P.dashAttackTime
        self.vx, self.vy = 0, 0
        self:setState(self.boostRed and "red_dash" or "dash")
    end
end

function Player:_swimUpdate(world, input, dt)
    if not world:inWater(self) then
        self:setState("normal")
        return
    end
    local dx, dy = input:aim(self.facing)
    self.vx = approach(self.vx, dx * 80, 600 * dt)
    self.vy = approach(self.vy, dy * 80, 600 * dt)
    if input:pressed("jump") then
        self:jump(input)
        return
    end
    self:_move(world, self.vx * dt, self.vy * dt, true)
end

function Player:_specialUpdate(world, dt)
    self.specialTimer = self.specialTimer - dt
    if self.state == "frozen" or self.state == "dummy" or self.state == "attract" then
        self.vx, self.vy = 0, 0
    else
        self.vx = self.specialVx
        self.vy = self.specialVy
        if self.state == "reflection_fall"
            or self.state == "temple_fall"
            or self.state == "star_fly"
            or self.state == "cassette_fly"
        then
            self.vy = math.min(self.vy + P.gravity * dt, P.maxFall)
            self.specialVy = self.vy
        end
        self:_move(world, self.vx * dt, self.vy * dt, true)
    end
    if self.specialTimer <= 0 then self:setState("normal") end
end

function Player:update(world, input, dt)
    if self.dead then
        self.stateTime = self.stateTime + dt
        self.animTime = self.animTime + dt
        self.vy = math.min(self.vy + P.gravity * dt, P.maxFall)
        world:move(self, self.vx * dt, self.vy * dt, true)
        self.deathTimer = self.deathTimer - dt
        if self.deathTimer <= 0 then self:respawn() end
        return
    end

    self:_updateTimers(dt)
    world:carry(self)
    self:_updateGround(world, dt)
    self:_readJumpBuffer(input)

    if world.inWater and world:inWater(self) and self.state == "normal" then
        self:setState("swim")
    end

    if self.state == "normal" then
        self:_normalUpdate(world, input, dt)
    elseif self.state == "climb" then
        self:_climbUpdate(world, input, dt)
    elseif self.state == "dash" or self.state == "red_dash" then
        self:_dashUpdate(world, input, dt)
    elseif self.state == "dream_dash" then
        self:_dreamDashUpdate(world, input, dt)
    elseif self.state == "boost" then
        self:_boostUpdate(world, input, dt)
    elseif self.state == "swim" then
        self:_swimUpdate(world, input, dt)
    elseif self.state == "frozen"
        or self.state == "dummy"
        or self.state == "intro_walk"
        or self.state == "intro_jump"
        or self.state == "intro_respawn"
        or self.state == "intro_wake_up"
        or self.state == "bird_dash_tutorial"
        or self.state == "reflection_fall"
        or self.state == "star_fly"
        or self.state == "temple_fall"
        or self.state == "cassette_fly"
        or self.state == "attract"
        or self.state == "hit_squash"
        or self.state == "launch"
        or self.state == "summit_launch"
    then
        self:_specialUpdate(world, dt)
    else
        self:setState("normal")
    end

    if self.onGround and self.dashRefillCooldownTimer <= 0 then
        self.dashes = self.maxDashes
        self.stamina = self.maxStamina
    end
    if self.state ~= "climb" and self.stamina < self.maxStamina and self.onGround then
        self.stamina = self.maxStamina
    end

    if self.state == "normal" and self.onGround and self.vy == 0 then
        self.wallSlideDir = 0
    end
    self:_updateHairColor()
end

return Player
