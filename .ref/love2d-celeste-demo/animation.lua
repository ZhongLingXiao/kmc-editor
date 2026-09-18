local Animation = {}

local FRAMES = {
    idle = {
        {
            "....HH....",
            "...HHHH...",
            "..HHSSHH..",
            "..HSSSSH..",
            "..SSSSSS..",
            "...SCCS...",
            "..CCCCCC..",
            "..CLCCLC..",
            "..CCCCCC..",
            "...CDDC...",
            "...CDDC...",
            "..DD..DD..",
            "..DD..DD..",
            "..........",
            "..........",
        },
        {
            "....HH....",
            "...HHHH...",
            "..HHSSHH..",
            "..HSSSSH..",
            "..SSSSSS..",
            "...SCCS...",
            "..CCCCCC..",
            "..CLCCLC..",
            "..CCCCCC..",
            "...CDDC...",
            "...CDDC...",
            "..DD..DD..",
            "...D..D...",
            "..........",
            "..........",
        },
    },
    run = {
        {
            "....HH....",
            "...HHHH...",
            "..HHSSHH..",
            "..HSSSSH..",
            "..SSSSSS..",
            "...SCCS...",
            "..CCCCCC..",
            "..CLCCLC..",
            "..CCCCCC..",
            "...CDDC...",
            "...CDDC...",
            "...D.....",
            "..DD.....",
            "..........",
            "..........",
        },
        {
            "....HH....",
            "...HHHH...",
            "..HHSSHH..",
            "..HSSSSH..",
            "..SSSSSS..",
            "...SCCS...",
            "..CCCCCC..",
            "..CLCCLC..",
            "..CCCCCC..",
            "...CDDC...",
            "...CDDC...",
            "....D....",
            "...DD....",
            "..........",
            "..........",
        },
        {
            "....HH....",
            "...HHHH...",
            "..HHSSHH..",
            "..HSSSSH..",
            "..SSSSSS..",
            "...SCCS...",
            "..CCCCCC..",
            "..CLCCLC..",
            "..CCCCCC..",
            "...CDDC...",
            "...CDDC...",
            ".....D...",
            ".....DD..",
            "..........",
            "..........",
        },
        {
            "....HH....",
            "...HHHH...",
            "..HHSSHH..",
            "..HSSSSH..",
            "..SSSSSS..",
            "...SCCS...",
            "..CCCCCC..",
            "..CLCCLC..",
            "..CCCCCC..",
            "...CDDC...",
            "...CDDC...",
            "..D......",
            "..DD.....",
            "..........",
            "..........",
        },
    },
    jump = {
        ".....HH...",
        "....HHHH..",
        "...HHSSHH.",
        "...HSSSSH.",
        "...SSSSS..",
        "....SCCS..",
        "...CCCCCC.",
        "..CLCCLC..",
        "..CCCCCC..",
        "...CDDC...",
        "...CDDC...",
        "..D....D..",
        ".DD....DD.",
        "..........",
        "..........",
    },
    fall = {
        "....HH....",
        "...HHHH...",
        "..HHSSHH..",
        "..HSSSSH..",
        "..SSSSSS..",
        "...SCCS...",
        "..CCCCCC..",
        "..CLCCLC..",
        "..CCCCCC..",
        "...CDDC...",
        "...CDDC...",
        ".DD....DD.",
        "..D....D..",
        "..........",
        "..........",
    },
    land = {
        "...HHHH...",
        "..HHSSHH..",
        "..HSSSSH..",
        "..SSSSSS..",
        "...SCCS...",
        ".CCCCCCCC.",
        "CLCCCCLCC.",
        "CCCCCCCCCC",
        "...CDDC...",
        "..DD..DD..",
        ".DD....DD.",
        "..........",
        "..........",
    },
    climb = {
        {
            "...HHHH...",
            "..HHSSHH..",
            "..HSSSSH..",
            "..SSSSSS..",
            "...SCCS...",
            "..CCCCCC..",
            "..CLCCLC..",
            "..CCCCCC..",
            "...CDDC...",
            "...CDDC...",
            "..DD..DD..",
            "..........",
            "..........",
            "..........",
            "..........",
        },
        {
            "...HHHH...",
            "..HHSSHH..",
            "..HSSSSH..",
            "..SSSSSS..",
            "...SCCS...",
            "..CCCCCC..",
            "..CLCCLC..",
            "..CCCCCC..",
            "...CDDC...",
            "...CDDC...",
            "...D..D...",
            "..........",
            "..........",
            "..........",
            "..........",
        },
    },
    wallslide = {
        "....HH....",
        "...HHHH...",
        "..HHSSHH..",
        "..HSSSSH..",
        "..SSSSSS..",
        "...SCCS...",
        "..CCCCCC..",
        "..CLCCLC..",
        "..CCCCCC..",
        "...CDDC...",
        "...CDDC...",
        "...D..DD.",
        "..........",
        "..........",
        "..........",
    },
    dash = {
        "...HHHH...",
        "..HHSSHH..",
        "..HSSSSH..",
        "..SSSSSS..",
        "...SCCS...",
        "..CCCCCC..",
        ".CLCCCCLC.",
        "..CCCCCC..",
        "...CDDC...",
        "...CDDC...",
        "..........",
        "..........",
        "..........",
    },
    dreamdash = {
        "..HHHH....",
        ".HHSSHH...",
        ".HSSSSHH..",
        "..SSSSS...",
        "...SCCS...",
        "..CCCCCC..",
        ".CLCCCCLC.",
        "..CCCCCC..",
        "...CDDC...",
        "..........",
        "..........",
        "..........",
    },
    duck = {
        "...HHHH...",
        "..HHSSHH..",
        "..HSSSSH..",
        "..SSSSSS..",
        "...SCCS...",
        ".CCCCCCCC.",
        "CLCCCCLCC.",
        "CCCCCCCCCC",
        "...CDDC...",
        "...DDDD...",
        "..........",
        "..........",
    },
    dead = {
        "...HHHH...",
        "..HHSSHH..",
        "..HSSSSH..",
        "..SSSSSS..",
        "...SCCS...",
        "..CCCCCC..",
        "..CLCCLC..",
        "..CCCCCC..",
        "...CDDC...",
        "...CDDC...",
        "..DD..DD..",
        "..........",
        "..........",
    },
}

local PAL = {
    H = "hair",
    S = "skin",
    C = "coat",
    L = "coatLight",
    D = "dark",
}

local function frameList(state)
    local list = FRAMES[state] or FRAMES.idle
    if type(list[1]) == "string" then return { list } end
    return list
end

local function chooseFrame(state, time)
    local frames = frameList(state)
    local index = math.floor(time * 10) % #frames + 1
    return frames[index]
end

function Animation.stateFor(player)
    if player.state == "dream_dash" then return "dreamdash" end
    if player.state == "dash" or player.state == "red_dash" then return "dash" end
    if player.state == "climb" then return "climb" end
    if player.dead then return "dead" end
    if player.wallSlideDir and player.wallSlideDir ~= 0 then return "wallslide" end
    if player.ducking then return "duck" end
    if player.state == "boost" then return "dash" end
    if player.landingTimer and player.landingTimer > 0 then return "land" end
    if player.onGround then
        return math.abs(player.vx or 0) > 8 and "run" or "idle"
    end
    return (player.vy or 0) < 0 and "jump" or "fall"
end

function Animation.draw(player, colors)
    local name = Animation.stateFor(player)
    local frame = chooseFrame(name, player.animTime or 0)
    local width = 10
    local height = #frame
    local x = math.floor(player.x + player.w / 2 - width / 2)
    local y = math.floor(player.y + player.h - height + 2)
    local facing = player.facing or 1
    local hair = player.hairColor or colors.redHair

    for row, line in ipairs(frame) do
        for column = 1, #line do
            local symbol = line:sub(column, column)
            local paletteName = PAL[symbol]
            if paletteName then
                local color = paletteName == "hair" and hair or colors[paletteName]
                love.graphics.setColor(color[1], color[2], color[3], 1)
                local px = x + (facing == 1 and column - 1 or width - column)
                love.graphics.rectangle("fill", px, y + row - 1, 1, 1)
            end
        end
    end

    if math.abs(player.vx or 0) > 25 and player.state == "run" then
        love.graphics.setColor(hair[1], hair[2], hair[3], 0.9)
        local tailX = facing == 1 and x - 2 or x + width + 1
        love.graphics.rectangle("fill", tailX, y + 3, 2, 1)
        love.graphics.rectangle("fill", tailX - facing, y + 5, 2, 1)
    end
end

return Animation
