function love.conf(t)
    t.identity = "kmc-celeste-demo"
    t.window.title = "Celeste High-Fidelity Movement Lab"
    t.window.width = 960
    t.window.height = 540
    t.window.resizable = true
    t.window.vsync = 1
    t.modules.joystick = true
end
