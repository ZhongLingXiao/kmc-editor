local Effects = {}
Effects.__index = Effects

local COLORS = {
    dust = { 0.72, 0.86, 0.92 },
    dash = { 0.46, 0.86, 0.96 },
    boost = { 0.96, 0.42, 0.82 },
    refill = { 1.0, 0.92, 0.42 },
    land = { 0.56, 0.72, 0.80 },
}

function Effects.new()
    return setmetatable({ particles = {}, trails = {} }, Effects)
end

function Effects:add(x, y, vx, vy, life, color, size)
    self.particles[#self.particles + 1] = {
        x = x, y = y, vx = vx, vy = vy,
        life = life, maxLife = life, color = color, size = size or 1,
    }
end

function Effects:dust(x, y, count)
    for _ = 1, count or 4 do
        local angle = math.random() * math.pi
        self:add(x + (math.random() - 0.5) * 5, y,
            math.cos(angle) * (12 + math.random() * 18),
            -math.sin(angle) * (8 + math.random() * 12),
            0.25 + math.random() * 0.15, COLORS.dust, 1)
    end
end

function Effects:dash(x, y, dx, dy)
    self.trails[#self.trails + 1] = {
        x = x, y = y, dx = dx, dy = dy, life = 0.18, maxLife = 0.18,
    }
    for _ = 1, 3 do
        self:add(x, y, -dx * math.random(10, 24), -dy * math.random(10, 24),
            0.16, COLORS.dash, 1)
    end
end

function Effects:burst(x, y, count, kind)
    local color = COLORS[kind] or COLORS.dust
    for _ = 1, count or 6 do
        local angle = math.random() * math.pi * 2
        local speed = 10 + math.random() * 28
        self:add(x, y, math.cos(angle) * speed, math.sin(angle) * speed,
            0.25 + math.random() * 0.2, color, 1)
    end
end

function Effects:update(dt)
    for i = #self.particles, 1, -1 do
        local p = self.particles[i]
        p.life = p.life - dt
        p.x = p.x + p.vx * dt
        p.y = p.y + p.vy * dt
        p.vy = p.vy + 60 * dt
        if p.life <= 0 then table.remove(self.particles, i) end
    end
    for i = #self.trails, 1, -1 do
        local trail = self.trails[i]
        trail.life = trail.life - dt
        if trail.life <= 0 then table.remove(self.trails, i) end
    end
end

function Effects:draw()
    for _, trail in ipairs(self.trails) do
        local alpha = trail.life / trail.maxLife
        love.graphics.setColor(COLORS.dash[1], COLORS.dash[2], COLORS.dash[3], alpha * 0.55)
        love.graphics.line(
            trail.x, trail.y,
            trail.x - trail.dx * 8, trail.y - trail.dy * 8
        )
    end
    for _, p in ipairs(self.particles) do
        local alpha = math.max(0, p.life / p.maxLife)
        love.graphics.setColor(p.color[1], p.color[2], p.color[3], alpha)
        love.graphics.rectangle("fill", p.x, p.y, p.size, p.size)
    end
end

return Effects
