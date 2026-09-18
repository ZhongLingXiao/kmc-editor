local Entities = {}

local function overlaps(a, b)
    return a.x < b.x + b.w and a.x + a.w > b.x
       and a.y < b.y + b.h and a.y + a.h > b.y
end

function Entities.update(world, player, input, effects)
    local playerBox = {
        x = player.x,
        y = player.y,
        w = player.w,
        h = player.h,
    }

    for _, spring in ipairs(world.springs) do
        local springTop = spring.y
        local feet = player.y + player.h
        if spring.cooldown <= 0
            and player.vy >= 0
            and math.abs(feet - springTop) <= 1.5
            and player.x + player.w > spring.x
            and player.x < spring.x + spring.w
        then
            spring.cooldown = 0.12
            if spring.direction == "up" then
                player:bounce(world, -140)
            elseif spring.direction == "left" then
                player:rebound(-120, -120)
            elseif spring.direction == "right" then
                player:rebound(120, -120)
            end
            if effects then effects:dust(player.x + player.w / 2, spring.y, 5) end
        end
    end

    for _, booster in ipairs(world.boosters) do
        if booster.cooldown <= 0
            and (player.state == "normal" or player.state == "climb")
            and overlaps(playerBox, booster)
        then
            booster.cooldown = 0.25
            player:enterBoost(booster.mode)
            if effects then effects:burst(player.x + player.w / 2, player.y + player.h / 2, 8, "boost") end
        end
    end

    for _, launch in ipairs(world.launches) do
        if launch.cooldown <= 0 and overlaps(playerBox, launch) then
            launch.cooldown = 0.20
            player:launch(launch.directionX, launch.directionY)
            if effects then
                effects:burst(player.x + player.w / 2, player.y + player.h / 2, 8, "boost")
            end
        end
    end

    for _, refill in ipairs(world.refills) do
        if (not refill.used or not refill.oneUse) and overlaps(playerBox, refill) then
            refill.used = true
            player.dashes = player.maxDashes
            player.stamina = player.maxStamina
            if effects then effects:burst(player.x + player.w / 2, player.y + player.h / 2, 10, "refill") end
        end
    end

    for _, hazard in ipairs(world.hazards) do
        if overlaps(playerBox, hazard) then
            player:die()
            break
        end
    end
end

function Entities.draw(world, colors)
    for _, block in ipairs(world.dreamBlocks) do
        local alpha = block.active and 0.48 or 0.18
        love.graphics.setColor(colors.dream[1], colors.dream[2], colors.dream[3], alpha)
        love.graphics.rectangle("fill", block.x, block.y, block.w, block.h)
        love.graphics.setColor(colors.dream[1], colors.dream[2], colors.dream[3], 0.85)
        love.graphics.rectangle("line", block.x, block.y, block.w, block.h)
        for x = block.x + 4, block.x + block.w - 4, 6 do
            love.graphics.points(x, block.y + 3, x - 2, block.y + block.h - 3)
        end
    end

    for _, spring in ipairs(world.springs) do
        love.graphics.setColor(colors.spring[1], colors.spring[2], colors.spring[3], 1)
        love.graphics.rectangle("fill", spring.x, spring.y, spring.w, spring.h)
        love.graphics.setColor(colors.white[1], colors.white[2], colors.white[3], 1)
        love.graphics.line(spring.x + 2, spring.y + spring.h - 1,
            spring.x + spring.w / 2, spring.y + 1,
            spring.x + spring.w - 2, spring.y + spring.h - 1)
    end

    for _, booster in ipairs(world.boosters) do
        love.graphics.setColor(colors.booster[1], colors.booster[2], colors.booster[3], 0.85)
        love.graphics.circle("fill", booster.x + booster.w / 2, booster.y + booster.h / 2, booster.w / 2)
        love.graphics.setColor(colors.white[1], colors.white[2], colors.white[3], 0.8)
        love.graphics.circle("line", booster.x + booster.w / 2, booster.y + booster.h / 2, booster.w / 2 - 2)
    end

    for _, launch in ipairs(world.launches) do
        love.graphics.setColor(colors.booster[1], colors.booster[2], colors.booster[3], 0.8)
        love.graphics.rectangle("fill", launch.x, launch.y, launch.w, launch.h)
        love.graphics.setColor(colors.white[1], colors.white[2], colors.white[3], 0.9)
        local cx, cy = launch.x + launch.w / 2, launch.y + launch.h / 2
        love.graphics.line(cx, cy,
            cx + launch.directionX * 4, cy + launch.directionY * 4)
    end

    for _, refill in ipairs(world.refills) do
        if not refill.used then
            love.graphics.setColor(colors.white[1], colors.white[2], colors.white[3], 1)
            love.graphics.rectangle("fill", refill.x, refill.y, refill.w, refill.h)
            love.graphics.setColor(colors.booster[1], colors.booster[2], colors.booster[3], 1)
            love.graphics.rectangle("fill", refill.x + 2, refill.y + 2, refill.w - 4, refill.h - 4)
        end
    end

    for _, hazard in ipairs(world.hazards) do
        love.graphics.setColor(colors.spring[1], colors.spring[2], colors.spring[3], 1)
        for x = hazard.x, hazard.x + hazard.w - 4, 4 do
            love.graphics.polygon("fill", x, hazard.y + hazard.h, x + 2, hazard.y, x + 4, hazard.y + hazard.h)
        end
    end
end

return Entities
