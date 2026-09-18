local World = {}
World.__index = World

local function overlaps(a, b)
    return a.x < b.x + b.w and a.x + a.w > b.x
       and a.y < b.y + b.h and a.y + a.h > b.y
end

local function copyRect(rect)
    return { x = rect.x, y = rect.y, w = rect.w, h = rect.h }
end

local function sign(value)
    if value < 0 then return -1 end
    if value > 0 then return 1 end
    return 0
end

function World.new()
    return setmetatable({
        solids = {},
        jumpThrus = {},
        platforms = {},
        dreamBlocks = {},
        springs = {},
        launches = {},
        boosters = {},
        refills = {},
        hazards = {},
        waters = {},
        particles = {},
        time = 0,
    }, World)
end

function World:clear()
    self.solids = {}
    self.jumpThrus = {}
    self.platforms = {}
    self.dreamBlocks = {}
    self.springs = {}
    self.launches = {}
    self.boosters = {}
    self.refills = {}
    self.hazards = {}
    self.waters = {}
    self.time = 0
end

function World:addSolid(x, y, w, h, options)
    local solid = {
        x = x, y = y, w = w, h = h,
        kind = options and options.kind or "solid",
        name = options and options.name,
    }
    self.solids[#self.solids + 1] = solid
    return solid
end

function World:addJumpThru(x, y, w, h, options)
    local platform = {
        x = x, y = y, w = w, h = h or 3,
        kind = "jumpthru",
        name = options and options.name,
    }
    self.jumpThrus[#self.jumpThrus + 1] = platform
    return platform
end

function World:addMovingPlatform(x, y, w, h, motion, options)
    local platform = self:addSolid(x, y, w, h, {
        kind = "moving",
        name = options and options.name,
    })
    platform.originX = x
    platform.originY = y
    platform.motion = motion or function() return 0, 0 end
    platform.previousX = x
    platform.previousY = y
    platform.dx = 0
    platform.dy = 0
    self.platforms[#self.platforms + 1] = platform
    return platform
end

function World:addDreamBlock(x, y, w, h, options)
    local block = {
        x = x, y = y, w = w, h = h,
        kind = "dream",
        name = options and options.name,
        active = options == nil or options.active ~= false,
    }
    self.dreamBlocks[#self.dreamBlocks + 1] = block
    return block
end

function World:addSpring(x, y, w, h, options)
    local spring = {
        x = x, y = y, w = w or 8, h = h or 4,
        kind = "spring",
        direction = options and options.direction or "up",
        cooldown = 0,
    }
    self.springs[#self.springs + 1] = spring
    return spring
end

function World:addBooster(x, y, w, h, options)
    local booster = {
        x = x, y = y, w = w or 12, h = h or 16,
        kind = "booster",
        mode = options and options.mode or "normal",
        cooldown = 0,
    }
    self.boosters[#self.boosters + 1] = booster
    return booster
end

function World:addLaunch(x, y, w, h, directionX, directionY)
    local launch = {
        x = x, y = y, w = w or 8, h = h or 8,
        directionX = directionX or 0,
        directionY = directionY or -1,
        cooldown = 0,
        kind = "launch",
    }
    self.launches[#self.launches + 1] = launch
    return launch
end

function World:addRefill(x, y, options)
    local refill = {
        x = x, y = y, w = 10, h = 10,
        kind = "refill",
        oneUse = options == nil or options.oneUse ~= false,
        used = false,
    }
    self.refills[#self.refills + 1] = refill
    return refill
end

function World:addHazard(x, y, w, h, options)
    local hazard = {
        x = x, y = y, w = w, h = h,
        kind = "hazard",
        name = options and options.name,
    }
    self.hazards[#self.hazards + 1] = hazard
    return hazard
end

function World:addWater(x, y, w, h)
    local water = { x = x, y = y, w = w, h = h, kind = "water" }
    self.waters[#self.waters + 1] = water
    return water
end

function World:update(dt)
    self.time = self.time + dt
    for _, platform in ipairs(self.platforms) do
        platform.previousX = platform.x
        platform.previousY = platform.y
        local x, y = platform.motion(self.time, platform.originX, platform.originY)
        platform.x, platform.y = x, y
        platform.dx = platform.x - platform.previousX
        platform.dy = platform.y - platform.previousY
    end
    for _, spring in ipairs(self.springs) do
        spring.cooldown = math.max(0, spring.cooldown - dt)
    end
    for _, booster in ipairs(self.boosters) do
        booster.cooldown = math.max(0, booster.cooldown - dt)
    end
    for _, launch in ipairs(self.launches) do
        launch.cooldown = math.max(0, launch.cooldown - dt)
    end
end

function World:_solidAt(rect, includeJumpThru, previousRect, directionY, ignoreJumpThru)
    for _, solid in ipairs(self.solids) do
        if overlaps(rect, solid) then return solid end
    end

    if includeJumpThru and directionY > 0 and not ignoreJumpThru then
        for _, platform in ipairs(self.jumpThrus) do
            local crossedTop = previousRect
                and previousRect.y + previousRect.h <= platform.y + 0.01
                and rect.y + rect.h >= platform.y
            if crossedTop and overlaps(rect, platform) then
                return platform
            end
        end
    end
    return nil
end

function World:solidAt(x, y, w, h)
    return self:_solidAt({ x = x, y = y, w = w, h = h }, false, nil, 0, true)
end

function World:isGrounded(entity)
    local probe = {
        x = entity.x,
        y = entity.y + 0.05,
        w = entity.w,
        h = entity.h,
    }
    for _, solid in ipairs(self.solids) do
        if overlaps(probe, solid) then return true, solid end
    end
    local oneWayProbe = {
        x = entity.x,
        y = entity.y + 0.05,
        w = entity.w,
        h = entity.h,
    }
    for _, platform in ipairs(self.jumpThrus) do
        if entity.y + entity.h <= platform.y + 0.2
            and oneWayProbe.y + oneWayProbe.h >= platform.y
            and overlaps(oneWayProbe, platform)
        then
            return true, platform
        end
    end
    return false, nil
end

function World:wallCheck(entity, direction, distance)
    distance = distance or 1
    local x = entity.x + direction * distance
    return self:solidAt(x, entity.y, entity.w, entity.h) ~= nil
end

function World:moveX(entity, amount)
    if amount == 0 then return { collided = false, direction = 0 } end
    local direction = sign(amount)
    local remaining = math.abs(amount)
    local collided = false

    while remaining > 0 do
        local step = math.min(1, remaining) * direction
        local nextRect = {
            x = entity.x + step,
            y = entity.y,
            w = entity.w,
            h = entity.h,
        }
        local hit = self:_solidAt(nextRect, false, nil, 0, true)
        if hit then
            collided = true
            if direction > 0 then
                entity.x = hit.x - entity.w
            else
                entity.x = hit.x + hit.w
            end
            break
        end
        entity.x = entity.x + step
        remaining = remaining - math.abs(step)
    end

    return { collided = collided, direction = collided and direction or 0 }
end

function World:moveY(entity, amount, ignoreJumpThru)
    if amount == 0 then
        local grounded, platform = self:isGrounded(entity)
        return { collided = false, grounded = grounded, platform = platform }
    end
    local direction = sign(amount)
    local remaining = math.abs(amount)
    local collided = false
    local grounded = false
    local hitCeiling = false
    local platformHit = nil

    while remaining > 0 do
        local step = math.min(1, remaining) * direction
        local previousRect = {
            x = entity.x,
            y = entity.y,
            w = entity.w,
            h = entity.h,
        }
        local nextRect = {
            x = entity.x,
            y = entity.y + step,
            w = entity.w,
            h = entity.h,
        }
        local hit = self:_solidAt(
            nextRect,
            true,
            previousRect,
            direction,
            ignoreJumpThru
        )
        if hit then
            collided = true
            platformHit = hit
            if direction > 0 then
                entity.y = hit.y - entity.h
                grounded = true
            else
                entity.y = hit.y + hit.h
                hitCeiling = true
            end
            break
        end
        entity.y = entity.y + step
        remaining = remaining - math.abs(step)
    end

    return {
        collided = collided,
        direction = collided and direction or 0,
        grounded = grounded,
        hitCeiling = hitCeiling,
        platform = platformHit,
    }
end

function World:move(entity, dx, dy, ignoreJumpThru)
    local horizontal = self:moveX(entity, dx)
    local vertical = self:moveY(entity, dy, ignoreJumpThru)
    return {
        x = horizontal,
        y = vertical,
        hitWall = horizontal.collided,
        hitFloor = vertical.grounded,
        hitCeiling = vertical.hitCeiling,
    }
end

function World:carry(entity)
    local grounded, platform = self:isGrounded(entity)
    if not grounded or not platform or platform.kind ~= "moving" then
        return false
    end
    if platform.dx ~= 0 then self:moveX(entity, platform.dx) end
    if platform.dy ~= 0 then self:moveY(entity, platform.dy, true) end
    return true
end

function World:findDreamBlock(entity, direction)
    local probe = {
        x = entity.x + (direction and direction.x or 0),
        y = entity.y + (direction and direction.y or 0),
        w = entity.w,
        h = entity.h,
    }
    for _, block in ipairs(self.dreamBlocks) do
        if block.active and overlaps(probe, block) then return block end
    end
    return nil
end

function World:inWater(entity)
    local rect = { x = entity.x, y = entity.y, w = entity.w, h = entity.h }
    for _, water in ipairs(self.waters) do
        if overlaps(rect, water) then return true end
    end
    return false
end

function World:overlapAny(entity, list)
    local result = {}
    for _, item in ipairs(list or {}) do
        if overlaps(entity, item) then result[#result + 1] = item end
    end
    return result
end

function World:drawSolids(colors)
    for _, solid in ipairs(self.solids) do
        local color = solid.kind == "moving" and colors.moving or colors.solid
        love.graphics.setColor(color[1], color[2], color[3], 1)
        love.graphics.rectangle("fill", solid.x, solid.y, solid.w, solid.h)
        love.graphics.setColor(colors.solidTop[1], colors.solidTop[2], colors.solidTop[3], 1)
        love.graphics.rectangle("fill", solid.x, solid.y, solid.w, 1)
    end
    love.graphics.setColor(colors.jumpThru[1], colors.jumpThru[2], colors.jumpThru[3], 1)
    for _, platform in ipairs(self.jumpThrus) do
        love.graphics.rectangle("fill", platform.x, platform.y, platform.w, platform.h)
        love.graphics.rectangle("fill", platform.x, platform.y, platform.w, 1)
    end
    for _, water in ipairs(self.waters) do
        love.graphics.setColor(colors.water[1], colors.water[2], colors.water[3], 0.45)
        love.graphics.rectangle("fill", water.x, water.y, water.w, water.h)
    end
end

return World
