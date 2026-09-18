# Celeste 高保真移动实验室

这是一个以 `.ref/Celeste/Player.cs` 为行为参考的 Love2D 玩家移动实验项目。角色使用重新绘制的像素图案，不依赖原作图片资源。

## 运行

```powershell
cd E:\Github\kmc-editor\.ref\love2d-celeste-demo
& "C:\Program Files\LOVE\love.exe" .
```

## 操作

- `A/D` 或方向键：移动
- `Space/Z`：跳跃
- `X/K`：Dash
- `L/V`：抓墙/攀爬
- `W/S` 或上下方向键：攀爬移动、快速下落
- `R`：重生
- `1` 至 `5`：切换测试房间
- `F1`：显示/隐藏状态 HUD
- `F4`：显示/隐藏碰撞框
- `F2`：开始/结束输入录制，保存为 `last-replay.txt`
- `F3`：回放上一次输入
- `F9`：运行跳跃、Dash、墙跳逻辑测试
- `F6`：暂停/继续
- `Esc`：退出

### Xbox/标准手柄

- 左摇杆或十字键：移动、瞄准 Dash
- `A`/`B`：跳跃
- `X`/`Y`：Dash
- `LB`/`RB`：抓墙/攀爬
- `Back`：重生
- 支持运行时插拔手柄，左摇杆死区为 `0.25`

## 已实现

- 60Hz 固定时间步和逻辑坐标系
- `Player.cs` 风格的 Normal 移动参数
- `varJumpTimer + varJumpSpeed` 可变跳跃
- 跳跃缓冲、土狼时间、半重力、快速下落
- 分轴逐像素碰撞、Solid、JumpThru、移动平台
- 墙滑、墙跳、墙速保持、角落修正
- 八方向 Dash、Dash 冷却、Dash 补充、Dash 后速度
- DreamBlock/Dream Dash、Booster、Red Dash
- Spring、Rebound、Launch、Refill、Hazard、水域
- 攀爬体力、抓墙、攀爬跳
- 程序化像素角色：站立、跑步、跳跃、下落、落地、攀爬、墙滑、Dash、Dream Dash、蹲下、死亡
- 粒子、Dash 残影、角色头发拖尾、摄像机跟随
- 输入录制/回放和基础自动逻辑测试

## 文件结构

```text
config.lua       物理、坐标和颜色参数
input.lua        键盘/手柄、输入边沿和回放
collision.lua    Solid、JumpThru、移动平台和碰撞查询
player.lua       玩家状态、移动、跳跃、攀爬、Dash
level.lua        五个机制测试房间
entities.lua     DreamBlock、Spring、Booster 等交互
animation.lua    程序化像素角色动画
effects.lua      粒子和 Dash 残影
camera.lua       镜头跟随和震动
game_debug.lua   HUD、碰撞框和测试入口
tests.lua        固定输入逻辑测试
main.lua         Love2D 主循环和渲染入口
```

## 测试

也可以在 PowerShell 中运行无交互逻辑测试：

```powershell
$env:KMC_CELESTE_TEST = "1"
& "C:\Program Files\LOVE\love.exe" --console .
Remove-Item Env:KMC_CELESTE_TEST
```
