local Config = require("config")
local StateIds = require("state_ids")

local Player = {}
Player.__index = Player

local P = Config.physics
local NORMAL_H = Config.player.height

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

local function snapAim(x, y)
    if x == 0 and y == 0 then return 1, 0 end
    local step = math.pi / 4
    local snapped = math.floor(math.atan2(y, x) / step + 0.5) * step
    local sx, sy = math.cos(snapped), math.sin(snapped)
    if math.abs(sx) < 0.01 then sx = 0 end
    if math.abs(sy) < 0.01 then sy = 0 end
    if math.abs(sx) > 0.99 then sx = sign(sx) end
    if math.abs(sy) > 0.99 then sy = sign(sy) end
    if sx ~= 0 and sy ~= 0 then
        sx = sign(sx) * math.cos(math.pi / 4)
        sy = sign(sy) * math.sin(math.pi / 4)
    end
    return sx, sy
end

function Player.new(x, y)
    local self = setmetatable({
        x = x,
        y = y,
        spawnX = x,
        spawnY = y,
        w = Config.player.width,
        h = NORMAL_H,
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
        wasOnGround = false,
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
        liftX = 0,
        liftY = 0,
        carriedPlatform = nil,
        wallBoostTimer = 0,
        wallBoostDir = 0,
        hopWaitX = 0,
        hopWaitXSpeed = 0,

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
        hitSquashTimer = 0,
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
    self.h = NORMAL_H
    self.vx, self.vy = 0, 0
    self.ducking = false
    self.state = "normal"
    self.stateId = StateIds.normal
    self.previousState = "normal"
    self.stateTime = 0
    self.animTime = 0
    self.dead = false
    self.deathTimer = 0
    self.onGround = false
    self.wasOnGround = false
    self.jumpGraceTimer = 0
    self.jumpBufferTimer = 0
    self.varJumpTimer = 0
    self.autoJump = false
    self.autoJumpTimer = 0
    self.dashes = self.maxDashes
    self.stamina = self.maxStamina
    self.tired = false
    self.wallSlideTimer = P.wallSlideTime
    self.wallBoostTimer = 0
    self.hopWaitX = 0
    self.liftX, self.liftY = 0, 0
    self.landingTimer = 0
    self.specialTimer = 0
    self.dashAttackTimer = 0
    self.redDash = false
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

function Player:_liftBoost()
    local x, y = self.liftX, self.liftY
    if math.abs(x) > P.liftXCap then x = P.liftXCap * sign(x) end
    if y > 0 then
        y = 0
    elseif y < P.liftYCap then
        y = P.liftYCap
    end
    return x, y
end

function Player:_isTired()
    local stamina = self.stamina
    if self.wallBoostTimer > 0 then stamina = stamina + P.climbJumpCost end
    return stamina < P.climbTiredThreshold
end

function Player:_dashAttacking()
    return self.dashAttackTimer > 0 or self.state == "red_dash"
end

function Player:canUnDuck(world, x, y)
    if not self.ducking then return true end
    if not world then return true end
    x = x or self.x
    y = y or self.y
    local top = y - (NORMAL_H - self.h)
    return world:solidAt(x, top, self.w, NORMAL_H) == nil
end

function Player:_setDucking(world, value)
    if value == self.ducking then return true end
    local shrink = NORMAL_H - P.duckHeight
    if value then
        self.y = self.y + shrink
        self.h = P.duckHeight
        self.ducking = true
        return true
    end
    if world and not self:canUnDuck(world) then return false end
    self.y = self.y - shrink
    self.h = NORMAL_H
    self.ducking = false
    return true
end

function Player:_duckFreeAt(world, x, y)
    local feet = y + self.h
    local top = feet - P.duckHeight
    return world:solidAt(x, top, self.w, P.duckHeight) == nil
end

function Player:_waterShifted(world, dy)
    return world:waterAt(self.x, self.y + dy, self.w, self.h)
end

function Player:_swimCheck(world)
    return self:_waterShifted(world, 0) and self:_waterShifted(world, -8)
end

function Player:_move(world, dx, dy, ignoreJumpThru)
    local wasGrounded = self.onGround
    local result = world:move(self, dx, dy, ignoreJumpThru)
    self.onGround = result.hitFloor
    if not self.onGround then
        self.onGround = world:isGrounded(self)
    end

    if result.hitWall then
        if not self:_dashWallCorrect(world, result.x.direction) then
            if self.wallSpeedRetentionTimer <= 0 then
                self.wallSpeedRetained = self.vx
                self.wallSpeedRetentionTimer = P.wallSpeedRetentionTime
            end
            self.vx = 0
            self.dashAttackTimer = 0
            if self.state == "red_dash" then self:_enterHitSquash() end
        end
    end

    if result.y.hitCeiling then
        if not (self.vy < 0 and self:_upwardCornerCorrect(world)) then
            if self.vy < 0 and self.varJumpTimer < P.varJumpTime - P.ceilingVarJumpGrace then
                self.varJumpTimer = 0
            end
            self.dashAttackTimer = 0
            self.vy = math.max(0, self.vy)
            if self.state == "red_dash" then self:_enterHitSquash() end
        end
    end

    if result.hitFloor and self.vy > 0 and not self:_dashDropCorner(world) then
        if (self.state == "dash" or self.state == "red_dash")
            and self.dashDirX ~= 0 and self.dashDirY > 0
        then
            self.dashDirX = sign(self.dashDirX)
            self.dashDirY = 0
            self.vy = 0
            self.vx = self.vx * P.dodgeSlideSpeedMult
            self:_setDucking(world, true)
        else
            self.vy = 0
        end
        self.dashAttackTimer = 0
        if self.state == "red_dash" then self:_enterHitSquash() end
    end

    if not wasGrounded and self.onGround then
        self.landingTimer = 0.10
        if self.effects then self.effects:dust(self.x + self.w / 2, self.y + self.h, 4) end
    end
    return result
end

function Player:_dashWallCorrect(world, direction)
    if self.state ~= "dash" and self.state ~= "red_dash" then return false end
    local dir = direction ~= 0 and direction or sign(self.vx)
    if dir == 0 then return false end
    if self.onGround and self:_duckFreeAt(world, self.x + dir, self.y) then
        self:_setDucking(world, true)
        return true
    end
    if self.vy ~= 0 then return false end
    for i = 1, P.dashCornerCorrection do
        for _, vertical in ipairs({ i, -i }) do
            if world:solidAt(self.x + dir, self.y + vertical, self.w, self.h) == nil then
                self.y = self.y + vertical
                self.x = self.x + dir
                return true
            end
        end
    end
    return false
end

function Player:_dashDropCorner(world)
    if self.state ~= "dash" and self.state ~= "red_dash" then return false end
    if self.dashStartedOnGround then return false end
    local function slip(dir)
        for i = 1, P.dashCornerCorrection do
            local probe = { x = self.x + i * dir, y = self.y, w = self.w, h = self.h }
            if not world:isGrounded(probe) then
                self.x = probe.x
                self.y = self.y + 1
                return true
            end
        end
        return false
    end
    if self.vx <= 0 and slip(-1) then return true end
    if self.vx >= 0 and slip(1) then return true end
    return false
end

function Player:_upwardCornerCorrect(world)
    if self.vy >= 0 then return false end
    local function lift(dir)
        for i = 1, P.upwardCornerCorrection do
            if world:solidAt(self.x + i * dir, self.y - 1, self.w, self.h) == nil then
                self.x = self.x + i * dir
                self.y = self.y - 1
                return true
            end
        end
        return false
    end
    if self.vx <= 0 and lift(-1) then return true end
    if self.vx >= 0 and lift(1) then return true end
    return false
end

function Player:_updateGround(world, dt)
    self.wasOnGround = self.onGround
    local grounded, platform = world:isGrounded(self)
    self.onGround = grounded
    self.groundPlatform = platform
    if grounded then
        self.dreamJump = false
        self.jumpGraceTimer = P.jumpGraceTime
        self.wallSlideTimer = P.wallSlideTime
        self.stamina = self.maxStamina
        self.tired = false
        if self.state ~= "climb" then self.autoJump = false end
    else
        self.jumpGraceTimer = math.max(0, self.jumpGraceTimer - dt)
    end
end

function Player:_updateTimers(dt)
    self.stateTime = self.stateTime + dt
    self.animTime = self.animTime + dt
    self.jumpBufferTimer = math.max(0, self.jumpBufferTimer - dt)
    self.varJumpTimer = math.max(0, self.varJumpTimer - dt)
    self.dashCooldownTimer = math.max(0, self.dashCooldownTimer - dt)
    self.dashRefillCooldownTimer = math.max(0, self.dashRefillCooldownTimer - dt)
    self.dashAttackTimer = math.max(0, self.dashAttackTimer - dt)
    self.landingTimer = math.max(0, self.landingTimer - dt)
    self.forceMoveXTimer = math.max(0, self.forceMoveXTimer - dt)
    if self.autoJumpTimer > 0 then
        if self.autoJump then
            self.autoJumpTimer = self.autoJumpTimer - dt
            if self.autoJumpTimer <= 0 then self.autoJump = false end
        else
            self.autoJumpTimer = 0
        end
    end
end

function Player:_updateWallRetention(world, dt)
    if self.wallSpeedRetentionTimer <= 0 then return end
    if self.vx ~= 0 and sign(self.vx) == -sign(self.wallSpeedRetained) then
        self.wallSpeedRetentionTimer = 0
        return
    end
    local dir = sign(self.wallSpeedRetained)
    if dir ~= 0 and not world:wallCheck(self, dir, 1) then
        self.vx = self.wallSpeedRetained
        self.wallSpeedRetentionTimer = 0
    else
        self.wallSpeedRetentionTimer = math.max(0, self.wallSpeedRetentionTimer - dt)
    end
end

function Player:_updateHopWait(world)
    if self.hopWaitX == 0 then return end
    if (self.vx ~= 0 and sign(self.vx) == -self.hopWaitX) or self.vy > 0 then
        self.hopWaitX = 0
        return
    end
    if not world:wallCheck(self, self.hopWaitX, 1) then
        self.vx = self.hopWaitXSpeed
        self.hopWaitX = 0
    end
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

function Player:_wallJumpCheck(world, dir)
    return world:wallCheck(self, dir, P.wallJumpCheckDist)
end

function Player:_enterHitSquash()
    self.hitSquashTimer = P.hitSquashNoMoveTime
    self.dashAttackTimer = 0
    self:setState("hit_squash")
end

function Player:_beginClimb()
    self.autoJump = false
    self.vx = 0
    self.vy = self.vy * P.climbGrabYMult
    self.wallSlideTimer = P.wallSlideTime
    self.climbNoMoveTimer = P.climbNoMoveTime
    self.wallBoostTimer = 0
    self.ducking = false
    if self.h ~= NORMAL_H then
        self.y = self.y - (NORMAL_H - self.h)
        self.h = NORMAL_H
    end
    self:setState("climb")
    self.wallSlideDir = self.facing
end

function Player:_tryStartClimb(world, input, moveX)
    if not input:held("grab") or self:_isTired() or self.ducking then return false end
    if self.vy < 0 or sign(self.vx) == -self.facing then return false end
    if world:wallCheck(self, self.facing, 2) then
        self:_beginClimb()
        return true
    end
    local moveY = 0
    if input:held("up") then moveY = -1 end
    if input:held("down") then moveY = 1 end
    if moveY >= 1 then return false end
    for i = 1, 2 do
        if world:solidAt(self.x, self.y - i, self.w, self.h) == nil then
            local probe = { x = self.x, y = self.y - i, w = self.w, h = self.h }
            if world:wallCheck(probe, self.facing, 2) then
                self.y = self.y - i
                self:_beginClimb()
                return true
            end
        end
    end
    return moveX ~= nil and false
end

function Player:jump(input)
    local moveX = self:_horizontalInput(input)
    local lx, ly = self:_liftBoost()
    self.jumpGraceTimer = 0
    self.varJumpTimer = P.varJumpTime
    self.autoJump = false
    self.dashAttackTimer = 0
    self.wallBoostTimer = 0
    self.vy = P.jumpSpeed + ly
    self.vx = self.vx + P.jumpHBoost * moveX + lx
    self.varJumpSpeed = self.vy
    self.onGround = false
    self.jumpBufferTimer = 0
    self.landingTimer = 0
    self.wallSlideTimer = P.wallSlideTime
    self:setState("normal")
    if self.effects then self.effects:dust(self.x + self.w / 2, self.y + self.h, 4) end
end

function Player:wallJump(direction, input)
    self:_setDucking(nil, false)
    local moveX = input and input:axis() or 0
    self.jumpGraceTimer = 0
    self.varJumpTimer = P.varJumpTime
    self.autoJump = false
    self.dashAttackTimer = 0
    self.wallSlideTimer = P.wallSlideTime
    self.wallBoostTimer = 0
    self.wallSpeedRetentionTimer = 0
    if moveX ~= 0 then
        self.forceMoveX = direction
        self.forceMoveXTimer = P.wallJumpForceTime
    end
    local lx, ly = self:_liftBoost()
    self.vx = P.wallJumpHSpeed * direction + lx
    self.vy = P.jumpSpeed + ly
    self.varJumpSpeed = self.vy
    self.onGround = false
    self.jumpBufferTimer = 0
    self:setState("normal")
    if self.effects then
        self.effects:dust(self.x + self.w / 2 - direction * 2, self.y + self.h / 2, 4)
    end
end

function Player:superWallJump(direction)
    self:_setDucking(nil, false)
    local lx, ly = self:_liftBoost()
    self.jumpGraceTimer = 0
    self.varJumpTimer = P.superWallJumpVarTime
    self.autoJump = false
    self.dashAttackTimer = 0
    self.wallSlideTimer = P.wallSlideTime
    self.wallBoostTimer = 0
    self.vx = P.superWallJumpH * direction + lx
    self.vy = P.superWallJumpSpeed + ly
    self.varJumpSpeed = self.vy
    self.onGround = false
    self.jumpBufferTimer = 0
    self:setState("normal")
    if self.effects then
        self.effects:dust(self.x + self.w / 2 - direction * 2, self.y + self.h / 2, 4)
    end
end

function Player:climbJump(input)
    if not self.onGround then
        self.stamina = self.stamina - P.climbJumpCost
    end
    local moveX = input and input:axis() or 0
    self.dreamJump = false
    self:jump(input)
    if moveX == 0 then
        self.wallBoostDir = -self.facing
        self.wallBoostTimer = P.climbJumpBoostTime
    end
end

function Player:superJump(input)
    local lx, ly = self:_liftBoost()
    self.jumpGraceTimer = 0
    self.varJumpTimer = P.varJumpTime
    self.autoJump = false
    self.dashAttackTimer = 0
    self.wallSlideTimer = P.wallSlideTime
    self.wallBoostTimer = 0
    self.vx = P.superJumpH * self.facing + lx
    self.vy = P.jumpSpeed + ly
    if self.ducking then
        self:_setDucking(nil, false)
        self.vx = self.vx * P.duckSuperJumpXMult
        self.vy = self.vy * P.duckSuperJumpYMult
    end
    self.varJumpSpeed = self.vy
    self.onGround = false
    self.jumpBufferTimer = 0
    self:setState("normal")
    if input then input:consume("jump") end
    if self.effects then self.effects:dust(self.x + self.w / 2, self.y + self.h, 4) end
end

function Player:climbHop()
    self.vy = math.min(self.vy, P.climbHopY)
    self.hopWaitX = self.facing
    self.hopWaitXSpeed = self.facing * P.climbHopX
    self.forceMoveX = 0
    self.forceMoveXTimer = P.climbHopForceTime
    self:setState("normal")
end

function Player:bounce(world, speed)
    if self.ducking then self:_setDucking(world, false) end
    self.dashes = self.maxDashes
    self.stamina = self.maxStamina
    self.vy = speed or P.bounceSpeed
    self.varJumpTimer = 0.20
    self.varJumpSpeed = self.vy
    self.autoJump = true
    self.autoJumpTimer = 0.10
    self.dashAttackTimer = 0
    self.wallBoostTimer = 0
    self.onGround = false
    self:setState("normal")
end

function Player:rebound(speedX, speedY)
    self.dashes = self.maxDashes
    self.stamina = self.maxStamina
    self.vx = speedX or P.reboundSpeedX
    self.vy = speedY or P.reboundSpeedY
    self.varJumpTimer = 0.15
    self.varJumpSpeed = self.vy
    self.autoJump = true
    self.autoJumpTimer = 0
    self.dashAttackTimer = 0
    self.onGround = false
    self:setState("normal")
end

function Player:launch(directionX, directionY)
    local length = math.sqrt((directionX or 0) ^ 2 + (directionY or -1) ^ 2)
    local x = length == 0 and 0 or (directionX or 0) / length
    local y = length == 0 and -1 or (directionY or -1) / length
    self.vx = x * P.launchSpeed
    self.vy = y * P.launchSpeed
    self.varJumpTimer = 0.20
    self.varJumpSpeed = self.vy
    self.autoJump = true
    self.autoJumpTimer = 0
    self:setState("normal")
end

function Player:enterBoost(mode)
    self.boostRed = mode == "red"
    self.boostTargetX = self.x + self.w / 2
    self.boostTargetY = self.y + self.h / 2
    self.boostTimer = P.boostTime
    self.vx, self.vy = 0, 0
    self.dashes = self.maxDashes
    self.stamina = self.maxStamina
    self:setState("boost")
end

function Player:_canDash()
    return self.dashCooldownTimer <= 0 and self.dashes > 0
end

function Player:_armDash(red)
    self.redDash = red and true or false
    self.dashInitialized = false
    self.dashTimer = P.dashTime
    self.dashCooldownTimer = P.dashCooldown
    self.dashRefillCooldownTimer = P.dashRefillCooldown
    self.dashAttackTimer = P.dashAttackTime
    self.dashStartedOnGround = self.onGround
    self.vx, self.vy = 0, 0
    self:setState(self.redDash and "red_dash" or "dash")
end

function Player:_startDash(input)
    if not self:_canDash() then return false end
    self.beforeDashVx, self.beforeDashVy = self.vx, self.vy
    self.dashes = math.max(0, self.dashes - 1)
    self:_armDash(self.redDash)
    input:consume("dash")
    if self.effects then
        self.effects:burst(self.x + self.w / 2, self.y + self.h / 2, 8, "dash")
    end
    return true
end

function Player:_applyDashSpeed(world)
    local dx, dy = snapAim(self.dashDirX, self.dashDirY)
    local vx = dx * P.dashSpeed
    local vy = dy * P.dashSpeed
    if self.state ~= "red_dash"
        and sign(self.beforeDashVx) == sign(vx)
        and math.abs(self.beforeDashVx) > math.abs(vx)
    then
        vx = self.beforeDashVx
    end
    if world:inWater(self) then
        vx = vx * P.swimDashSpeedMult
        vy = vy * P.swimDashSpeedMult
    end
    self.dashDirX, self.dashDirY = dx, dy
    self.vx, self.vy = vx, vy
    if dx ~= 0 then self.facing = sign(dx) end
    if self.onGround and dx ~= 0 and dy > 0 and vy > 0 then
        local dreamBelow = world:findDreamBlock(self, { x = 0, y = 1 })
        if not dreamBelow then
            self.dashDirX = sign(dx)
            self.dashDirY = 0
            self.vy = 0
            self.vx = self.vx * P.dodgeSlideSpeedMult
            self:_setDucking(world, true)
        end
    end
    if not self.onGround and self.ducking and self:canUnDuck(world) then
        self:_setDucking(world, false)
    end
end

function Player:_endDash()
    self.autoJump = true
    self.autoJumpTimer = 0
    if self.dashDirY <= 0 then
        self.vx = self.dashDirX * P.endDashSpeed
        self.vy = self.dashDirY * P.endDashSpeed
        if self.vy < 0 then self.vy = self.vy * P.endDashUpMult end
    end
    self:setState("normal")
end

function Player:_dashJumpTech(world, input)
    if not input:pressed("jump") and self.jumpBufferTimer <= 0 then return false end
    if self.ducking and not self:canUnDuck(world) then return false end
    if self.dashDirY == 0 and self.jumpGraceTimer > 0 then
        self:superJump(input)
        return true
    end
    if self.dashDirX == 0 and self.dashDirY == -1 then
        if self:_wallJumpCheck(world, 1) then
            self:superWallJump(-1)
            input:consume("jump")
            return true
        elseif self:_wallJumpCheck(world, -1) then
            self:superWallJump(1)
            input:consume("jump")
            return true
        end
    elseif self:_wallJumpCheck(world, 1) then
        self:wallJump(-1, input)
        input:consume("jump")
        return true
    elseif self:_wallJumpCheck(world, -1) then
        self:wallJump(1, input)
        input:consume("jump")
        return true
    end
    return false
end

function Player:_dashJumpThruNudge(world)
    if self.dashDirY ~= 0 then return end
    local feet = self.y + self.h
    for _, platform in ipairs(world.jumpThrus) do
        local overlaps = self.x < platform.x + platform.w and self.x + self.w > platform.x
            and self.y < platform.y + platform.h and feet > platform.y
        if overlaps and feet - platform.y <= 6 then
            self.y = platform.y - self.h
            return
        end
    end
end

function Player:_tryDreamEntry(world)
    if not self:_dashAttacking() and self.state ~= "dash" and self.state ~= "red_dash" then
        return false
    end
    local dream = world:findDreamBlock(self, {
        x = sign(self.dashDirX),
        y = sign(self.dashDirY),
    })
    if not dream then return false end
    self.dreamDashTimer = 0
    self.dreamJump = false
    self.stamina = self.maxStamina
    self.vx = self.dashDirX * P.dashSpeed
    self.vy = self.dashDirY * P.dashSpeed
    self.dashAttackTimer = 0
    self:setState("dream_dash")
    return true
end

function Player:_dashUpdate(world, input, dt)
    if not self.dashInitialized then
        local aimX, aimY = input:aim(self.facing)
        self.dashDirX, self.dashDirY = aimX, aimY
        self:_applyDashSpeed(world)
        self.dashInitialized = true
    end

    if self:_dashJumpTech(world, input) then return end
    if self:_tryDreamEntry(world) then return end
    self:_dashJumpThruNudge(world)

    self:_move(world, self.vx * dt, self.vy * dt, false)
    if self.state ~= "dash" and self.state ~= "red_dash" then return end
    if self.effects then
        self.effects:dash(self.x + self.w / 2, self.y + self.h / 2, self.dashDirX, self.dashDirY)
    end
    if self.state == "red_dash" then return end
    self.dashTimer = self.dashTimer - dt
    if self.dashTimer <= 0 then self:_endDash() end
end

function Player:_dreamWiggle(world)
    if world:solidAt(self.x, self.y, self.w, self.h) == nil then return true end
    for x = 1, P.dreamDashEndWiggle do
        for _, xm in ipairs({ -1, 1 }) do
            for y = 1, P.dreamDashEndWiggle do
                for _, ym in ipairs({ -1, 1 }) do
                    local nx = self.x + x * xm
                    local ny = self.y + y * ym
                    if world:solidAt(nx, ny, self.w, self.h) == nil then
                        self.x, self.y = nx, ny
                        return true
                    end
                end
            end
        end
    end
    return false
end

function Player:_finishDreamDash(world, input)
    local jumped = false
    if input:pressed("jump") and self.dashDirX ~= 0 then
        self.dreamJump = true
        self:jump(input)
        jumped = true
    elseif input:held("grab") and not self:_isTired() then
        local moveX = self:_horizontalInput(input)
        if (moveX == 1 and world:wallCheck(self, 1, 2)) or (moveX == -1 and world:wallCheck(self, -1, 2)) then
            self.facing = moveX
            self.dashes = self.maxDashes
            self.stamina = self.maxStamina
            self:_beginClimb()
            return
        end
    end
    self.dashes = self.maxDashes
    self.stamina = self.maxStamina
    if self.dashDirX ~= 0 then
        self.jumpGraceTimer = P.jumpGraceTime
        self.dreamJump = true
    else
        self.jumpGraceTimer = 0
    end
    if not jumped then
        self.autoJump = true
        self.autoJumpTimer = 0
        self:setState("normal")
    end
end

function Player:_dreamDashUpdate(world, input, dt)
    self.dreamDashTimer = self.dreamDashTimer + dt
    self.x = self.x + self.vx * dt
    self.y = self.y + self.vy * dt
    local dream = world:findDreamBlock(self, { x = 0, y = 0 })
    if dream then
        if self.effects then
            self.effects:dash(self.x + self.w / 2, self.y + self.h / 2, self.dashDirX, self.dashDirY)
        end
        return
    end
    if not self:_dreamWiggle(world) then
        self:die()
        return
    end
    if self.dreamDashTimer >= P.dreamDashMinTime then
        self:_finishDreamDash(world, input)
    end
end

function Player:_updateDucking(world, input, dt)
    if self.ducking then
        if self.onGround and not input:held("down") then
            if self:canUnDuck(world) then
                self:_setDucking(world, false)
            elseif self.vx == 0 then
                for i = 4, 1, -1 do
                    if self:canUnDuck(world, self.x + i, self.y) then
                        world:moveX(self, P.duckCorrectSlide * dt)
                        break
                    elseif self:canUnDuck(world, self.x - i, self.y) then
                        world:moveX(self, -P.duckCorrectSlide * dt)
                        break
                    end
                end
            end
        end
    elseif self.onGround and input:held("down") and self.vy >= 0 then
        self:_setDucking(world, true)
    end
end

function Player:_airWallJump(input, direction)
    local wallDir = -direction
    if input:held("grab") and self.facing == wallDir and self.stamina > 0 then
        self:climbJump(input)
        return
    end
    if self:_dashAttacking() and self.dashDirX == 0 and self.dashDirY == -1 then
        self:superWallJump(direction)
        return
    end
    self:wallJump(direction, input)
end

function Player:_tryJump(world, input)
    if self.jumpBufferTimer <= 0 then return false end
    if self.ducking and not self:canUnDuck(world) then return false end
    if self.onGround or self.jumpGraceTimer > 0 then
        self:jump(input)
        input:consume("jump")
        return true
    end
    if self:_wallJumpCheck(world, 1) then
        self:_airWallJump(input, -1)
        input:consume("jump")
        return true
    elseif self:_wallJumpCheck(world, -1) then
        self:_airWallJump(input, 1)
        input:consume("jump")
        return true
    end
    return false
end

function Player:_normalUpdate(world, input, dt)
    local moveX = self:_horizontalInput(input)
    if moveX ~= 0 and self.state ~= "red_dash" then self.facing = moveX end

    local lx, ly = self:_liftBoost()
    if ly < 0 and self.wasOnGround and not self.onGround and self.vy >= 0 then
        self.vy = ly
    end

    if self:_tryStartClimb(world, input, moveX) then return end
    if input:pressed("dash") and self:_canDash() then
        self.vx = self.vx + lx
        self.vy = self.vy + ly
        if self:_startDash(input) then return end
    end

    self:_updateDucking(world, input, dt)

    local mult = self.onGround and 1 or P.airMult
    if self.ducking and self.onGround then
        self.vx = approach(self.vx, 0, P.duckFriction * dt)
    elseif math.abs(self.vx) > P.maxRun and sign(self.vx) == moveX then
        self.vx = approach(self.vx, P.maxRun * moveX, P.runReduce * mult * dt)
    else
        self.vx = approach(self.vx, P.maxRun * moveX, P.runAccel * mult * dt)
    end

    if input:held("down") and self.vy >= P.maxFall then
        self.maxFall = approach(self.maxFall, P.fastMaxFall, P.fastMaxAccel * dt)
    else
        self.maxFall = approach(self.maxFall, P.maxFall, P.fastMaxAccel * dt)
    end
    local currentMaxFall = self.maxFall

    self.wallSlideDir = 0
    local slideInput = moveX == self.facing or (moveX == 0 and input:held("grab"))
    if not self.onGround and slideInput and not input:held("down")
        and self.vy >= 0 and self.wallSlideTimer > 0
        and self:canUnDuck(world)
        and world:wallCheck(self, self.facing, 1)
    then
        self.wallSlideDir = self.facing
        currentMaxFall = P.maxFall + (P.wallSlideStartMax - P.maxFall) * (self.wallSlideTimer / P.wallSlideTime)
        self.wallSlideTimer = math.max(0, self.wallSlideTimer - dt)
    end

    if not self.onGround then
        local gravityMult = 1
        if math.abs(self.vy) < P.halfGravThreshold and (input:held("jump") or self.autoJump) then
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

    self:_tryJump(world, input)
    self:_move(world, self.vx * dt, self.vy * dt, false)
end

function Player:_climbUpdate(world, input, dt)
    self.climbNoMoveTimer = self.climbNoMoveTimer - dt
    if self.onGround then self.stamina = self.maxStamina end
    local moveX = input:axis()

    if input:pressed("jump") and (not self.ducking or self:canUnDuck(world)) then
        if moveX == -self.facing then
            self:wallJump(-self.facing, input)
        else
            self:climbJump(input)
        end
        input:consume("jump")
        return
    end

    if input:pressed("dash") and self:_canDash() then
        local lx, ly = self:_liftBoost()
        self.vx = self.vx + lx
        self.vy = self.vy + ly
        self:_startDash(input)
        return
    end

    if not input:held("grab") then
        local lx, ly = self:_liftBoost()
        self.vx = self.vx + lx
        self.vy = self.vy + ly
        self:setState("normal")
        return
    end

    if not world:wallCheck(self, self.facing, 2) then
        if self.vy < 0 then
            self:climbHop()
        else
            self:setState("normal")
        end
        return
    end

    local moveY = 0
    if input:held("up") then moveY = -1 end
    if input:held("down") then moveY = 1 end
    local target = 0
    if self.climbNoMoveTimer <= 0 then
        if moveY < 0 then
            target = P.climbUpSpeed
        elseif moveY > 0 then
            target = self.onGround and 0 or P.climbDownSpeed
        end
    end
    self.vy = approach(self.vy, target, P.climbAccel * dt)
    if moveY ~= 1 and self.vy > 0 and not world:wallCheck({
        x = self.x,
        y = self.y + 1,
        w = self.w,
        h = self.h,
    }, self.facing, 2) then
        self.vy = 0
    end

    if self.climbNoMoveTimer <= 0 then
        if moveY < 0 then
            self.stamina = self.stamina - P.climbUpCost * dt
        elseif moveY == 0 then
            self.stamina = self.stamina - P.climbStillCost * dt
        end
    end
    self.tired = self.stamina <= 0
    self.vx = 0
    self.wallSlideDir = self.facing
    if self.stamina <= 0 then
        local lx, ly = self:_liftBoost()
        self.vx = lx
        self.vy = self.vy + ly
        self:setState("normal")
        return
    end
    self:_move(world, 0, self.vy * dt, true)
end

function Player:_boostUpdate(world, input, dt)
    self.boostTimer = self.boostTimer - dt
    local aimX = input:aim(self.facing)
    local targetX = self.boostTargetX + aimX * 3
    local targetY = self.boostTargetY
    local dx = targetX - (self.x + self.w / 2)
    local dy = targetY - (self.y + self.h / 2)
    local length = math.sqrt(dx * dx + dy * dy)
    if length > 0 then
        local distance = math.min(length, P.boostMoveSpeed * dt)
        self.x = self.x + dx / length * distance
        self.y = self.y + dy / length * distance
    end
    if input:pressed("dash") or self.boostTimer <= 0 then
        input:consume("dash")
        self.beforeDashVx, self.beforeDashVy = 0, 0
        self:_armDash(self.boostRed)
    end
end

function Player:_enterSwim()
    if self.vy > 0 then self.vy = self.vy * P.swimYSpeedMult end
    self.stamina = P.climbMaxStamina
    if self:canUnDuck(nil) then self:_setDucking(nil, false) end
    self:setState("swim")
end

function Player:_swimUpdate(world, input, dt)
    if not self:_swimCheck(world) then
        self:setState("normal")
        return
    end
    if self:canUnDuck(world) then self:_setDucking(world, false) end
    if input:pressed("dash") and self:_canDash() then
        self:_startDash(input)
        return
    end

    local underwater = self:_waterShifted(world, -9)
    if not underwater and self.vy >= 0 and input:held("grab") and not self:_isTired() then
        if sign(self.vx) ~= -self.facing and world:wallCheck(self, self.facing, 2) then
            self:_beginClimb()
            return
        end
    end

    local moveX, moveY = input:aim(self.facing)
    if not input:held("left") and not input:held("right")
        and not input:held("up") and not input:held("down")
        and math.abs(input:axis()) < 0.01
    then
        moveX, moveY = 0, 0
    end
    local maxX = underwater and P.swimUnderwaterMax or P.swimMax
    if math.abs(self.vx) > P.swimMax and sign(self.vx) == sign(moveX) then
        self.vx = approach(self.vx, maxX * moveX, P.swimReduce * dt)
    else
        self.vx = approach(self.vx, maxX * moveX, P.swimAccel * dt)
    end
    local nearSurface = not self:_waterShifted(world, -18)
    if moveY == 0 and nearSurface then
        self.vy = approach(self.vy, P.swimMaxRise, P.swimAccel * dt)
    elseif moveY >= 0 or underwater then
        if math.abs(self.vy) > P.swimMax and sign(self.vy) == sign(moveY) then
            self.vy = approach(self.vy, P.swimMax * moveY, P.swimReduce * dt)
        else
            self.vy = approach(self.vy, P.swimMax * moveY, P.swimAccel * dt)
        end
    end

    local horizontal = self:_horizontalInput(input)
    if not underwater and horizontal ~= 0
        and world:wallCheck(self, horizontal, 1)
        and not world:solidAt(self.x + horizontal, self.y - 3, self.w, self.h)
    then
        self.facing = horizontal
        self:climbHop()
        return
    end

    if input:pressed("jump") and not self:_waterShifted(world, -14) then
        self:jump(input)
        return
    end
    self:_move(world, self.vx * dt, self.vy * dt, true)
end

function Player:_hitSquashUpdate(world, input, dt)
    self.vx = approach(self.vx, 0, P.hitSquashFriction * dt)
    self.vy = approach(self.vy, 0, P.hitSquashFriction * dt)
    if input:pressed("jump") then
        if self.onGround then
            self:jump(input)
        elseif self:_wallJumpCheck(world, 1) then
            self:wallJump(-1, input)
        elseif self:_wallJumpCheck(world, -1) then
            self:wallJump(1, input)
        else
            self.jumpBufferTimer = 0
            self:setState("normal")
        end
        input:consume("jump")
        return
    end
    if input:pressed("dash") and self:_startDash(input) then return end
    if input:held("grab") and not self:_isTired() and world:wallCheck(self, self.facing, 2) then
        self:_beginClimb()
        return
    end
    self.hitSquashTimer = self.hitSquashTimer - dt
    if self.hitSquashTimer <= 0 then
        self:setState("normal")
        return
    end
    self:_move(world, self.vx * dt, self.vy * dt, false)
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

function Player:_dashFloorSnap(world)
    if self.onGround or not self:_dashAttacking() or self.dashDirY ~= 0 then return end
    local dist = P.dashVFloorSnapDist
    local grounded = world:isGrounded({
        x = self.x,
        y = self.y + dist,
        w = self.w,
        h = self.h,
    })
    if grounded then
        world:moveY(self, dist, false)
        self.onGround = world:isGrounded(self)
    end
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
    self.carriedPlatform = world:carry(self)
    if self.carriedPlatform and dt > 0 then
        self.liftX = self.carriedPlatform.dx / dt
        self.liftY = self.carriedPlatform.dy / dt
    end
    self:_updateGround(world, dt)
    self:_updateWallRetention(world, dt)
    self:_updateHopWait(world)
    self:_readJumpBuffer(input)

    local moveX = self:_horizontalInput(input)
    if self.wallBoostTimer > 0 then
        self.wallBoostTimer = math.max(0, self.wallBoostTimer - dt)
        if moveX == self.wallBoostDir and moveX ~= 0 then
            self.vx = P.wallJumpHSpeed * moveX
            self.stamina = self.stamina + P.climbJumpCost
            self.wallBoostTimer = 0
        end
    end
    if moveX ~= 0 and self.state ~= "climb" and self.state ~= "red_dash" and self.state ~= "hit_squash" then
        self.facing = moveX
    end

    if (self.state == "normal" or self.state == "climb") and self:_swimCheck(world) then
        self:_enterSwim()
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
    elseif self.state == "hit_squash" then
        self:_hitSquashUpdate(world, input, dt)
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
        or self.state == "launch"
        or self.state == "summit_launch"
    then
        self:_specialUpdate(world, dt)
    else
        self:setState("normal")
    end

    if self.vy > 0 and not self.onGround and self.ducking and self:canUnDuck(world) then
        self:_setDucking(world, false)
    end
    self:_dashFloorSnap(world)

    if self.dashRefillCooldownTimer <= 0 and (self.state == "swim" or self.onGround) then
        self.dashes = self.maxDashes
    end
    if not self.carriedPlatform then
        self.liftX, self.liftY = 0, 0
    end
    self:_updateHairColor()
end

return Player
