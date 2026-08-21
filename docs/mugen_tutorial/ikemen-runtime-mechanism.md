# Ikemen-GO 运行机制详解：从按键到状态执行

> 本文档详细解释 Ikemen-GO 引擎的完整运行机制：从玩家按下键盘，到命令匹配，到状态机执行，到状态控制器触发的全过程。
>
> 涵盖 CMD 解析、输入缓冲系统（time / buffer.time / buffer.hitpause / buffer.pauseend）、CNS 编译、字节码执行、主循环流程。
>
> 所有内容基于源码分析，附 file:line 引用。

目录：
- [1. 全景概览](#1-全景概览)
- [2. CMD 文件解析](#2-cmd-文件解析)
- [3. 输入缓冲系统（InputBuffer）](#3-输入缓冲系统inputbuffer)
- [4. 命令匹配（Command.Step）](#4-命令匹配commandstep)
- [5. 命令缓冲机制](#5-命令缓冲机制)
- [6. CNS 文件编译](#6-cns-文件编译)
- [7. 字节码执行](#7-字节码执行)
- [8. Trigger 表达式求值](#8-trigger-表达式求值)
- [9. command 触发器的运行时实现](#9-command-触发器的运行时实现)
- [10. 主循环与每帧流程](#10-主循环与每帧流程)
- [11. 完整生命周期总结](#11-完整生命周期总结)
- [12. 关键源码索引](#12-关键源码索引)

---

## 1. 全景概览

### 1.1 从按键到状态执行的完整流水线

```
玩家按键
   │
   ▼
┌──────────────────────────────────┐
│ 1. 输入系统（InputReader）         │  读取键盘/手柄
│    src/input.go                  │
└──────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────┐
│ 2. 输入缓冲（InputBuffer）         │  每个按键的 hold/release 计时
│    src/input.go:672              │  Ub/Db/Fb/Bb... + ab/bb/cb...
└──────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────┐
│ 3. 命令匹配（Command.Step）        │  检查输入序列是否匹配命令
│    src/input.go:2434             │  匹配成功 → curbuftime = maxbuftime
└──────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────┐
│ 4. 状态机执行（actionRun）        │  按顺序执行：
│    src/char.go:11690             │  state -4 → -3 → -2 → -1 → 当前状态
└──────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────┐
│ 5. 字节码运行（StateBytecode.run）│  评估 trigger → 执行 SC
│    src/bytecode.go:15301         │  trigger 中用 OC_command 检查 curbuftime
└──────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────┐
│ 6. 物理与碰撞（update + collision）│  速度积分、位置更新、攻击判定
│    src/char.go:12068, 13817      │
└──────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────┐
│ 7. 渲染（renderFrame）            │  绘制画面
│    src/system.go:3908            │
└──────────────────────────────────┘
```

### 1.2 关键概念速查

| 概念 | 说明 | 源码位置 |
|------|------|---------|
| **InputBuffer** | 每个按键的 hold/release 计时器 | `input.go:672` |
| **Command** | 一个命令定义（如 QCF_x） | `input.go:2009` |
| **CommandList** | 一个角色的所有命令集合 | `input.go:2604` |
| **CommandStep** | 命令的一步（如 `D` 或 `DF` 或 `x`） | `input.go:1938` |
| **StateBytecode** | 编译后的状态字节码 | `bytecode.go:15247` |
| **StateBlock** | 一个 [State] 块编译后的形式 | `bytecode.go:4518` |
| **BytecodeExp** | trigger 表达式编译后的形式 | `bytecode.go:1249` |

---

## 2. CMD 文件解析

### 2.1 CMD 文件结构

```ini
; 按键重映射
[Remap]
x = x
y = y
...

; 默认值
[Defaults]
command.time = 15
command.buffer.time = 1

; 命令定义
[Command]
name = "QCF_x"
command = D, DF, F, x
time = 20
buffer.time = 4
buffer.hitpause = 1
buffer.pauseend = 1
```

### 2.2 解析入口

CMD 文件由 `compiler.go:8183-8357` 解析。入口函数读取 `.cmd` 文件内容，按行分割，逐节解析：

```go
// compiler.go:8199-8263
for lnidx < len(lines) {
    is, name, _ := ReadIniSection(lines, &lnidx)
    switch name {
    case "remap":      // 按键重映射
    case "defaults":   // 默认值
    default:           // [Command] 块
}
```

### 2.3 [Defaults] 节解析

`[Defaults]` 节定义所有命令的默认参数（`compiler.go:8242-8256`）：

```go
is.ReadI32("command.time", &c.cmdl.DefaultTime)              // 默认 time = 15
is.ReadI32("command.steptime", &c.cmdl.DefaultStepTime)     // 每步默认时间
is.ReadBool("command.autogreater", &c.cmdl.DefaultAutoGreater)
is.ReadI32("command.buffer.time", &i32)                       // 默认 buffer.time = 1
is.ReadBool("command.buffer.hitpause", &c.cmdl.DefaultBufferHitpause)  // 默认 true
is.ReadBool("command.buffer.pauseend", &c.cmdl.DefaultBufferPauseEnd)   // 默认 true
is.ReadBool("command.buffer.shared", &c.cmdl.DefaultBufferShared)      // 默认 true
```

### 2.4 [Command] 块解析

每个 `[Command]` 块被解析成一个 `Command` 结构（`compiler.go:8264-8317`）：

```go
cm := newCommand()
cm.name = is["name"]                          // 命令名

// 继承默认值
cm.maxtime = c.cmdl.DefaultTime               // time（命令完成的总时间窗口）
cm.maxbuftime = c.cmdl.DefaultBufferTime      // buffer.time（完成后保持多久）
cm.buffer_hitpause = c.cmdl.DefaultBufferHitpause
cm.buffer_pauseend = c.cmdl.DefaultBufferPauseEnd
cm.buffer_shared = c.cmdl.DefaultBufferShared

// 读取自定义值覆盖默认
is.ReadI32("time", &cm.maxtime)
is.ReadI32("buffer.time", &cm.maxbuftime)     // 最小 1
is.ReadBool("buffer.hitpause", &cm.buffer_hitpause)
is.ReadBool("buffer.pauseend", &cm.buffer_pauseend)

// 解析命令字符串（如 "D, DF, F, x"）
cm.ReadCommandSymbols(is["command"], ckr)

c.cmdl.Add(*cm)                               // 加入命令列表
```

### 2.5 命令字符串解析

`command = D, DF, F, x` 这个字符串由 `Command.ReadCommandSymbols`（`input.go:2030-2302`）解析：

1. 用 `,` 分割成步骤：`["D", "DF", "F", "x"]`
2. 每个步骤解析为 `CommandStep`：
   - `D` → 按键 D（按下）
   - `DF` → 按键 D+F（同时按）
   - `x` → 按键 x
3. 处理修饰符：
   - `~x` → 松开 x 后才匹配（tilde）
   - `/x` → 持续按住 x（slash）
   - `$D` → 接受斜方向（dollar）
   - `>x` → 必须是新按下（greater，不能与上一步同一帧）
   - `~42x` → 蓄力 42 帧后释放（chargetime）

### 2.6 Command 结构

```go
// input.go:2009-2023
type Command struct {
    name                     string
    steps                    []CommandStep       // 命令步骤序列
    maxtime, curtime         int32               // 总时间窗口 / 当前已用时间
    maxbuftime, curbuftime   int32               // buffer.time / 当前剩余缓冲
    maxsteptime, cursteptime int32               // 每步时间窗口
    autogreater              bool
    buffer_hitpause          bool                // hitpause 期间是否继续缓冲
    buffer_pauseend          bool                // pause 期间是否继续缓冲
    buffer_shared            bool                // 同名命令是否共享缓冲
    completeframe            bool                // 完成帧标志
    completed                []bool              // 每步完成状态
    stepTimers               []int32            // 每步计时器
    loopOrder                []int              // 匹配顺序
}
```

---

## 3. 输入缓冲系统（InputBuffer）

### 3.1 InputBuffer 结构

每个玩家有一个 `InputBuffer`，记录所有按键的状态（`input.go:672-678`）：

```go
type InputBuffer struct {
    Bb, Db, Fb, Ub, Lb, Rb, Nb int32   // 方向键当前状态（buffer）
    ab, bb, cb, xb, yb, zb, sb, db, wb, mb int32   // 动作键当前状态
    Bp, Dp, Fp, Up, Lp, Rp, Np int32   // 上一帧方向键状态（previous）
    ap, bp, cp, xp, yp, zp, sp, dp, wp, mp int32   // 上一帧动作键状态
}
```

#### 命名规则

**后缀**：
- `Xb` = X 的 **buffer**（当前帧的计时值）
- `Xp` = X 的 **previous**（上一帧的计时值，用于检测边沿）

**前缀字母** = 哪个键。

#### 方向键前缀

| 字段 | 含义 | 说明 |
|------|------|------|
| `Ub` | **U**p | 上 |
| `Db` | **D**own | 下 |
| `Fb` | **F**ront | 前（朝对手方向，会随角色翻转） |
| `Bb` | **B**ack | 后（背对对手方向，会随角色翻转） |
| `Lb` | **L**eft | 左（屏幕绝对方向，不变） |
| `Rb` | **R**ight | 右（屏幕绝对方向，不变） |
| `Nb` | **N**eutral | 中性（无方向键按下） |

#### 动作键前缀

| 字段 | 含义 | MUGEN 中的按键 |
|------|------|--------------|
| `ab` | **a** button | 弱拳（Light Punch） |
| `bb` | **b** button | 中拳 |
| `cb` | **c** button | 重拳 |
| `xb` | **x** button | 弱脚（Light Kick） |
| `yb` | **y** button | 中脚 |
| `zb` | **z** button | 重脚 |
| `sb` | **s**tart button | Start 键 |
| `db` | **d** button | D 键（Ikemen 扩展） |
| `wb` | **w** button | W 键（Ikemen 扩展） |
| `mb` | **m**enu button | Menu 键（Ikemen 扩展） |

#### 为什么有 F/B 又有 L/R？

MUGEN 是 2D 格斗游戏，角色面对面：

- **F (Front)** = 朝向对手的方向（会随角色翻转而变化）
- **B (Back)** = 背对对手的方向（也会翻转）
- **L (Left)** = 屏幕左边（永远不变）
- **R (Right)** = 屏幕右边（永远不变）

**例子**：角色面朝右时
- 按 → → `Fb = 1`（前），`Rb = 1`（右）
- 按 ← → `Bb = 1`（后），`Lb = 1`（左）

角色转身后面朝左：
- 按 → → `Bb = 1`（后，因为"前"变成左了），`Rb = 1`（右）
- 按 ← → `Fb = 1`（前），`Lb = 1`（左）

CNS 中 `command = "holdfwd"` 检查的是 `Fb`，所以无论角色朝哪边，"前"都指向对手。

### 3.2 updateInputTime 的参数

```go
// input.go:695
func (ib *InputBuffer) updateInputTime(
    U, D, L, R, B, F,    // 方向键的当前状态（bool）
    a, b, c, x, y, z,    // 动作键的当前状态（bool）
    s, d, w, m           // 系统/扩展键的当前状态（bool）
    bool
)
```

**注意**：参数是 `bool`（按没按），不是 `int32`。函数内部把 bool 转成带符号计时存入 `Xb`，同时把上一帧的 `Xb` 备份到 `Xp`。

调用者（`input.go:2823`）先从 SDL/键盘/AI 读取每个键的 bool 状态，然后传入这个函数：

```go
cl.Buffer.updateInputTime(U, D, L, R, B, F, a, b, c, x, y, z, s, d, w, m)
```

### 3.3 编码约定

**有符号编码**（正=按住，负=松开）：

| 值 | 含义 |
|----|------|
| `= 1` | 刚按下这一帧 |
| `> 1` | 已按住 N 帧（值 = N+1） |
| `= -1` | 刚松开这一帧 |
| `< -1` | 已松开 N 帧（值 = -(N+1)） |
| `= 0` | 不会出现（初始或异常） |

**示例**：玩家按住 A 键 3 帧后松开：

```
帧 0: 按下 A → ab = 1   （刚按下）
帧 1: 继续按 → ab = 2   （按住 2 帧）
帧 2: 继续按 → ab = 3   （按住 3 帧）
帧 3: 松开   → ab = -1  （刚松开）
帧 4: 继续松 → ab = -2  （松开 2 帧）
```

### 3.4 更新逻辑

每帧由 `InputBuffer.updateInputTime`（`input.go:695-758`）更新。先备份上一帧（`input.go:697-713`）：

```go
ib.Up = ib.Ub        // 保存上一帧方向键
ib.ap = ib.ab        // 保存上一帧动作键
// ...
```

然后用 `update` 闭包更新当前帧（`input.go:716-733`）：

```go
update := func(held bool, buffer *int32) {
    if held != (*buffer > 0) {       // 状态改变
        if held { *buffer = 1 }      // 刚按下
        else { *buffer = -1 }        // 刚松开
        return
    }
    if held { *buffer += 1 }         // 继续按住，+1
    else { *buffer -= 1 }            // 继续松开，-1
}
```

逻辑：
1. 如果当前状态与上一帧不同（按下→松开 或 松开→按下），重置为 `1` 或 `-1`
2. 如果状态相同，计时器 +1 或 -1

调用顺序（`input.go:736-757`）：

```go
// 方向键
update(U, &ib.Ub)    // 上
update(D, &ib.Db)    // 下
update(L, &ib.Lb)    // 左
update(R, &ib.Rb)    // 右
update(B, &ib.Bb)    // 后
update(F, &ib.Fb)    // 前

// 中性（无方向按下）
nodir := !(U || D || L || R || B || F)
update(nodir, &ib.Nb)

// 动作键
update(a, &ib.ab)
update(b, &ib.bb)
// ... 一直到 m
```

### 3.5 `Xb` 和 `Xp` 的区别

- **`Xb`**：当前帧的计时值
- **`Xp`**：上一帧的计时值（在 update 前备份）

**为什么需要上一帧？** 用来检测"边沿"和解决 SOCD 冲突：

- **刚按下**：`Xb == 1`（无论 `Xp` 是什么）
- **刚松开**：`Xb == -1`
- **按住中**：`Xb > 1`
- **从按住变为松开**：`Xp > 0 && Xb == -1`

实际上 `update` 函数已经处理了边沿检测（状态改变时设为 ±1），`Xp` 主要用于 SOCD 冲突解决和复杂状态查询（`State()` 函数 `input.go:762`）。

### 3.6 状态查询

`InputBuffer.State(ck)` 返回某个键的当前缓冲值（`input.go:762`）：

- **普通按键**（无修饰符）：`State() == 1` 表示"刚按下这一帧"
- **hold 修饰符 `/`**：`State() > 0` 表示"当前按住"
- **release 修饰符 `~`**：`State() == -1` 表示"刚松开这一帧"

**例子**：`command = D, DF, F, x` 的匹配过程：

1. 第 1 步 `D` → 检查 `Db == 1`（下键刚按下）
2. 第 2 步 `DF` → 检查 `Db > 0 && Fb > 0`（下和前都按住）
3. 第 3 步 `F` → 检查 `Fb == 1`（前键刚按下）
4. 第 4 步 `x` → 检查 `xb == 1`（x 键刚按下）

### 3.7 SOCD 解决

SOCD（Same Opposite Cardinal Direction）指同时按下相反方向（如左+右）。Ikemen 在 `State()` 中解决：

- 左+右 → 通常视为中性（N）
- 上+下 → 通常视为中性

---

## 4. 命令匹配（Command.Step）

### 4.1 每帧匹配

每个命令每帧由 `Command.Step`（`input.go:2434-2600`）更新匹配状态：

```go
func (c *Command) Step(ai bool, helper bool, hpbuf, pausebuf bool, extratime int32) bool
```

### 4.2 匹配算法

#### 步骤 0：缓冲计时

```go
// input.go:2436-2455
if !c.buffer_hitpause { hpbuf = false }    // 不在 hitpause 中缓冲
if !c.buffer_pauseend { pausebuf = false } // 不在 pause 中缓冲

if c.curbuftime > 0 && !hpbuf && !pausebuf {
    c.curbuftime--                          // 每帧递减缓冲
}
```

#### 步骤 1：每步计时器

```go
// input.go:2458-2477
for i := range c.completed {
    if c.completed[i] {
        c.stepTimers[i]++
        if c.stepTimers[i] > c.maxsteptime {
            c.completed[i] = false          // 超时，重置该步
        }
    }
}
```

#### 步骤 2：总时间推进

```go
// input.go:2472-2477
if anydone {
    c.curtime++                              // 已开始匹配，推进总时间
} else if c.curtime > 0 {
    c.Clear(false)                           // 没有任何步完成，重置
}
```

#### 步骤 3：按 loopOrder 匹配输入

```go
// input.go:2479-2577
for _, i := range c.loopOrder {              // 注意：逆序！
    if i > 0 && !c.completed[i-1] { continue }   // 上一步未完成，跳过
    
    for _, k := range c.steps[i].keys {
        t := ibuf.State(k)                   // 查询按键状态
        
        if k.slash {                         // /hold
            if t <= 0 { fail }
        } else {                              // 普通按下
            if t != 1 { fail }                // 必须是"刚按下"
        }
        
        // 蓄力检查
        if ibuf.StateCharge(k) < k.chargetime { fail }
    }
    
    // 匹配成功
    c.completed[i] = true
    c.stepTimers[i] = 0
}
```

#### 步骤 4：完成检查

```go
// input.go:2579-2599
c.completeframe = c.completed[len(c.completed)-1]   // 最后一步完成

if c.completeframe || c.curtime >= c.maxtime {
    if c.completeframe {
        c.curbuftime = Max(c.curbuftime, c.maxbuftime + extratime)   // ← 关键！设置缓冲
    }
    c.Clear(false)                           // 重置准备下次匹配
}
```

### 4.3 loopOrder 的作用

`loopOrder`（`input.go:2277-2299`）是**逆序**的——从最后一步开始匹配。这样设计的目的是：

> 防止一个输入在同一帧内完成多个步骤。

**例子**：命令 `D, D+x`（按下 D，然后同时按 D+x）
- 如果顺序匹配：玩家按下 D 时，可能同时匹配第 1 步和第 2 步
- 逆序匹配：先检查第 2 步（D+x），未匹配，再检查第 1 步（D），匹配

**例外**：`D, D+x` 这种"方向到方向+按键"的序列是正序的（`IsDirToButton`），允许同一帧完成两步。

### 4.4 CommandList.Step

`CommandList.Step`（`input.go:2886-2908`）遍历所有命令，调用每个 `Command.Step`。完成后调用 `ClearName`（`input.go:2872`）重置同名命令（防止连续触发）。

---

## 5. 命令缓冲机制

### 5.1 四种缓冲字段

| 字段 | 默认值 | 作用 |
|------|--------|------|
| `time` | 15 | 命令必须完成的总时间窗口（帧） |
| `buffer.time` | 1 | 命令完成后，`command = "X"` 触发器保持为 true 的帧数 |
| `buffer.hitpause` | true | hitpause 期间 buffer.time 是否继续递减 |
| `buffer.pauseend` | true | pause 期间 buffer.time 是否继续递减 |

### 5.2 buffer.time 的工作原理

**核心**：命令完成后，`curbuftime = maxbuftime + extratime`（`input.go:2598`）。然后每帧递减：

```
命令完成（第 N 帧）:
  curbuftime = buffer.time + extratime

第 N+1 帧:
  curbuftime = buffer.time + extratime - 1

第 N+2 帧:
  curbuftime = buffer.time + extratime - 2
  ...

当 curbuftime <= 0:
  command = "X" 返回 false（不再触发）
```

**`command = "X"` 触发器返回 true 的条件**：`curbuftime > 0`（`char.go:5240`）。

### 5.3 buffer.time 的作用

```
玩家输入:  ↓ ↘ → X（QCF_x 命令）
           │
           ▼ 命令匹配成功
           curbuftime = 4（假设 buffer.time=4）

第 0 帧（完成帧）: curbuftime=4 → command="QCF_x" 为 true
第 1 帧:          curbuftime=3 → command="QCF_x" 为 true
第 2 帧:          curbuftime=2 → command="QCF_x" 为 true
第 3 帧:          curbuftime=1 → command="QCF_x" 为 true
第 4 帧:          curbuftime=0 → command="QCF_x" 为 false
```

**意义**：玩家完成输入后，有 4 帧窗口让状态机检测到 `command = "QCF_x"`。即使玩家在第 0 帧完成输入，第 3 帧才进入可以触发技能的状态，仍然能命中。

#### 5.3.1 这不是队列，是命令的"倒计时"

`curbuftime` 不是把输入排成队列等执行，而是**每个命令独立维护的一个倒计时**：

- 平时 `curbuftime = 0`，`command = "X"` 返回 false
- 命令匹配成功瞬间 → `curbuftime = buffer.time`（如 4）
- 之后每帧 `curbuftime--`
- `curbuftime > 0` 期间，`command = "X"` 一直返回 true
- `curbuftime` 归零后，命令"过期"，`command = "X"` 返回 false

```
命令的"生命周期"（独立倒计时，不是队列）：

  匹配成功        每帧递减        归零
     │              │              │
     ▼              ▼              ▼
     ┌──────────────────────┐
     │ curbuftime = 4       │
     │ curbuftime = 3       │  ← command="X" 全程返回 true
     │ curbuftime = 2       │
     │ curbuftime = 1       │
     └──────────────────────┘
                              │
                              ▼
                       curbuftime = 0
                       command="X" 返回 false
                       命令"过期"，需要重新输入
```

#### 5.3.2 "第 3 帧才进入可触发状态"是什么意思

假设玩家在攻击前摇中完成了 QCF_x 输入。前摇期间 `ctrl = 0`（无控制权），不能触发新技能。但 `curbuftime` 仍在倒计时：

```
帧 0: 玩家完成 QCF_x 输入
      curbuftime = 4
      但角色在攻击前摇中（ctrl = 0）
      state -1 里：trigger1 = command = "QCF_x" ✓
                   trigger1 = ctrl ✗           ← 控制权条件不满足
      → ChangeState 不触发，技能不发动
      但 curbuftime 还在倒计时！

帧 1: curbuftime = 3，仍在攻击前摇
帧 2: curbuftime = 2，仍在攻击前摇
帧 3: curbuftime = 1，攻击前摇结束，ctrl = 1
      state -1 检测到：
        command = "QCF_x" ✓（curbuftime = 1 > 0）
        ctrl = 1           ✓
      → ChangeState 触发！技能发动！

帧 4: curbuftime = 0，命令过期
```

**关键**：玩家在第 0 帧完成的输入，被"记住"了 4 帧。即使第 0 帧不能立即触发技能，只要在 curbuftime 归零之前进入可触发状态（ctrl = 1），技能就能发动。

#### 5.3.3 类比：快餐店的取餐号

- 你下单完成 → 拿到取餐号（`curbuftime = 4`）
- 取餐号 4 分钟内有效
- 你可以在 4 分钟内**任何时刻**去取餐
- 4 分钟后取餐号失效，要重新下单（重新输入命令）

**不是排队等叫号，是给你一个有效期内随时可用的凭证。**

同理，`buffer.time = 4` 的含义是：**"命令完成后，给状态机 4 帧窗口来检测它"**。状态机可以在这 4 帧内的任意一帧满足其他条件（如 `ctrl = 1`、`time >= 8`）时触发技能；超过 4 帧没命中，命令就"过期"了，需要玩家重新输入。

#### 5.3.4 同名命令再次触发会怎样？

**答案：刷新倒计时（取较大值），不覆盖。**

源码 `input.go:2598`：

```go
if c.completeframe {
    c.curbuftime = Max(c.curbuftime, c.maxbuftime+extratime)
}
```

注意是 `Max`，不是赋值。所以：

```
帧 0: 第一次完成 QCF_x
      curbuftime = 4

帧 1: curbuftime = 3（递减）
      玩家又完成一次 QCF_x 输入
      curbuftime = Max(3, 4) = 4   ← 刷新回 4，不覆盖
```

**含义**：再次输入同名命令会**重置倒计时**，让窗口从 4 帧重新开始计算。不会两个命令实例同时存在——每个命令名只有**一个 curbuftime**。

```
示例：玩家快速做两次 QCF_x

帧 0: QCF_x 完成       curbuftime = 4
帧 1:                  curbuftime = 3
帧 2: QCF_x 再次完成   curbuftime = Max(2, 4) = 4   ← 重置
帧 3:                  curbuftime = 3
帧 4:                  curbuftime = 2
帧 5:                  curbuftime = 1
帧 6:                  curbuftime = 0   ← 过期
```

**关键点**：
- 同名命令**共用一个 curbuftime**（因为 `Commands[name]` 是同名变体列表，共用检查逻辑）
- 重复输入只会**延长窗口**，不会堆叠多个待执行命令
- 不是队列，没有"第一次触发后第二次还能再触发一次"的概念

#### 5.3.5 不同名命令同时触发会怎样？

**答案：各自独立倒计时，互不影响。**

每个命令名都有自己的 `curbuftime`，存储在各自的 `Command` 结构中（`input.go:2009`）。`command = "X"` 检查的是命令 X 自己的 curbuftime（`char.go:5230`）：

```
帧 0: 玩家同时完成 QCF_x 和 QCB_y 两个输入
      QCF_x.curbuftime = 4   ← 各自独立
      QCB_y.curbuftime = 4

帧 1: QCF_x.curbuftime = 3
      QCB_y.curbuftime = 3

帧 2: QCF_x.curbuftime = 2
      QCB_y.curbuftime = 2
      ...
```

两个命令的 curbuftime **完全独立**。状态机可以同时检测到两个命令都为 true：

```ini
; state -1 中
[State -1, QCF_x 技能]
type = ChangeState
trigger1 = command = "QCF_x"   ; ← 检查 QCF_x.curbuftime
trigger1 = ctrl
value = 1000

[State -1, QCB_y 技能]
type = ChangeState
trigger1 = command = "QCB_y"   ; ← 检查 QCB_y.curbuftime
trigger1 = ctrl
value = 2000
```

**谁先执行？** 由 [State] 块在文件中的顺序决定（前文的优先）。state -1 中两个 trigger 都满足时，**写在前面的先触发**。先触发的 ChangeState 切换状态后，后面的不再执行（因为状态已变）。

#### 5.3.6 ClearName：同名命令的清理机制

源码 `input.go:2870-2883` 还有一个机制：

```go
// Reset command when another command with the same name is completed
// This prevents "piano inputs" from triggering the same special move with each button
func (cl *CommandList) ClearName(name string) {
    for j := range cl.Commands[i] {
        cmd := &cl.Commands[i][j]
        if !cmd.completeframe && cmd.buffer_shared && cmd.name == name {
            cmd.Clear(false) // Keep their buffer time
        }
    }
}
```

**作用**：当一个同名命令完成时，**其他同名变体被重置**（但保留 buffer time）。这防止"钢琴输入"（用多个按键定义同一命令）重复触发。

**例子**：你定义了两个 QCF_x 命令变体（一个用 x 键，一个用 y 键，都叫 "QCF_x"）：

```ini
[Command]
name = "QCF_x"
command = D, DF, F, x      ; 变体 1

[Command]
name = "QCF_x"
command = D, DF, F, y      ; 变体 2
```

当变体 1 完成 → `ClearName("QCF_x")` 重置变体 2 的匹配进度（但不清 buffer）。这防止玩家用 x 触发后立刻用 y 再触发一次。

##### 详细原理：`Clear(false)` 到底清了什么

要理解这个机制，先要分清两套独立的状态：

| 状态 | 所属 | 含义 | `Clear(false)` 是否清 |
|------|------|------|----------------------|
| `completed[]` | Command 对象 | 各步骤的匹配标记 | **是**，全部归零 |
| `stepTimers[]` | Command 对象 | 各步骤的计时 | **是**，全部归零 |
| `curtime` | Command 对象 | 命令总体计时 | **是**，归零 |
| `curbuftime` | Command 对象 | 触发后给状态机的缓冲帧数 | **否**（传 false 时保留） |
| `InputBuffer` (Db, Fb, xb...) | 共享输入缓冲 | 每个按键当前的状态计时 | **否**，完全不碰 |

**关键认知**：`Clear(false)` 只清 Command 对象自己的"匹配进度"，**InputBuffer 纹丝不动**。输入没有被"消费"。

`Command` 对象内部有一个 `completed` 数组（`input.go:2020`），对 `command = D, DF, F, y`（4 步）长度为 4：

```
completed = [false, false, false, false]
              ↑D    ↑DF   ↑F    ↑y
```

- `completed[0] = true` 表示"D 这步已经匹配过了"
- `completed[3] = true` 时整个命令才算完成（`input.go:2580`）

`Clear(false)` 的代码（`input.go:2419-2431`）：

```go
func (c *Command) Clear(bufreset bool) {
    c.curtime = 0
    c.cursteptime = 0
    if bufreset {
        c.curbuftime = 0   // 只在传 true 时才清 buffer
    }
    for i := range c.completed {
        c.completed[i] = false   // ← 关键：所有步骤标记归零
    }
    for i := range c.stepTimers {
        c.stepTimers[i] = 0
    }
}
```

调用前后的变化：
```
之前：completed = [true, true, true, false]   （D, DF, F 已匹配，就差 y）
之后：completed = [false, false, false, false] （全部忘记，从头开始）
```

##### 谁调用了 `Clear(false)`？

调用链是：`CommandList.Step()` → `ClearName()` → `Clear(false)`。

**注意：代码里有两个 `Step` 函数，别混淆**

| 函数 | 所属 | 作用 | 调用频率 |
|------|------|------|----------|
| `CommandList.Step()` | 命令列表 | 每帧调度，内含两个 for 循环 | 每帧 1 次 |
| `Command.Step()` | 单个命令 | 匹配输入，更新 `completed[]` | 每帧每命令 1 次（在 `CommandList.Step()` 的第一个 for 循环里被调用） |

下文说的"第一轮/第二轮"指的是 `CommandList.Step()` 内部的**两个 for 循环阶段**，不是调用了两次 `CommandList.Step()`。`CommandList.Step()` 每帧只被调用一次，函数内部顺序跑完两个 for 循环。

**第一层：`CommandList.Step()`**（`input.go:2885-2908`），每帧执行一次，内含两个 for 循环：

```go
func (cl *CommandList) Step(...) {
    completed := make(map[string]bool)   // 准备"本帧完成的名字"清单

    // ┌─────────────────────────────────────────┐
    // │ 第一个 for 循环（input.go:2893-2902）    │  ← "第一轮"
    // │ 作用：遍历所有命令，匹配输入 + 记录完成者 │
    // └─────────────────────────────────────────┘
    for i := range cl.Commands {
        for j := range cl.Commands[i] {
            cl.Commands[i][j].Step(...)             // 调用 Command.Step()，命令自己匹配输入
            if cl.Commands[i][j].completeframe {    // 如果本帧完成了
                cl.Commands[i][j].Clear(false)      // 清它自己的进度
                completed[cl.Commands[i][j].name] = true  // 记下名字
                cl.Commands[i][j].completeframe = false
            }
        }
    }

    // ┌─────────────────────────────────────────┐
    // │ 第二个 for 循环（input.go:2905-2907）    │  ← "第二轮"
    // │ 作用：遍历"完成名字清单"，清同名变体      │
    // └─────────────────────────────────────────┘
    for name := range completed {
        cl.ClearName(name)                           // 清同名但未完成的变体
    }
}
```

两个循环的分工：

- **第一个循环**：遍历**所有命令**，让每个命令调用 `Command.Step()` 自己匹配输入。匹配中如果发现某个命令本帧完成了，就清它自己，并把它的名字记到 `completed` 这个 map 里。
- **第二个循环**：遍历**第一个循环记下来的"完成名字清单"**，对每个名字调用 `ClearName`，把同名但没完成的变体清掉。

为什么要分两轮？因为第一轮必须先把所有命令都跑完，才能知道"本帧有哪些名字完成了"。如果在第一轮里发现变体 1 完成就立刻清变体 2，可能会漏清——因为变体 2 可能还没被 `Command.Step()` 处理到。先收集再清理，保证一致性。

**第二层：`ClearName()`**（`input.go:2872-2883`）：

```go
func (cl *CommandList) ClearName(name string) {
    i, ok := cl.Names[name]          // 查名字在哪一组
    if !ok {
        return
    }
    for j := range cl.Commands[i] {  // 遍历这一组里所有变体
        cmd := &cl.Commands[i][j]
        // 三个条件全满足才清：
        if !cmd.completeframe &&         // a) 这个变体本帧没完成
           cmd.buffer_shared &&          // b) 开启了共享（默认 true）
           cmd.name == name {            // c) 名字对得上
            cmd.Clear(false)             // ← 这里调用 Clear(false)
        }
    }
}
```

三个条件说明：
- **`!cmd.completeframe`**：只清"本帧没完成"的变体。已完成的那个已被自己清过，不重复处理。
- **`cmd.buffer_shared`**：只有开启 `buffer.shared`（默认 true）的命令才参与。
- **`cmd.name == name`**：保险检查，确保只清同名变体。

##### "变体"是怎么判定的？

变体关系**不是运行时根据输入相似度动态判断的**，而是**编译 CMD 文件时就按名字提前分组好的**。

`CommandList` 有两个关键字段（`input.go:2604-2607`）：

```go
type CommandList struct {
    Buffer   *InputBuffer
    Names    map[string]int   // 名字 → 组索引
    Commands [][]Command      // [组索引][组内命令]
    ...
}
```

- `Names` 是个 map：`"QCF_x" → 0`，`"QCB_y" → 1`，...
- `Commands` 是个二维切片：`Commands[0]` 是第 0 组（所有叫 `"QCF_x"` 的命令），`Commands[1]` 是第 1 组...

**同名命令天然被分到同一组，这一组里的所有命令就互为"变体"。**

分组发生在编译时。每解析到一个 `[Command]` 就调用 `CommandList.Add()`（`input.go:2922-2939`）：

```go
func (cl *CommandList) Add(c Command) {
    i, ok := cl.Names[c.name]     // ① 这个名字已经存在吗？
    if !ok || i < 0 || i >= len(cl.Commands) {
        i = len(cl.Commands)      // ② 不存在 → 新建一组
        cl.Commands = append(cl.Commands, nil)
    }
    cl.Commands[i] = append(cl.Commands[i], c)  // ③ 加到对应组里
    cl.Names[c.name] = i          // ④ 记住这个名字对应的组号
}
```

走一遍例子。CMD 文件里有：

```ini
[Command]
name = "QCF_x"
command = D, DF, F, x      ; 变体 1

[Command]
name = "QCF_x"
command = D, DF, F, y      ; 变体 2

[Command]
name = "QCB_y"
command = D, DB, B, y      ; 另一个命令
```

编译过程：

| 步骤 | 解析到的命令 | `Names` 状态 | `Commands` 状态 |
|------|------------|-------------|----------------|
| 1 | `QCF_x` (D,DF,F,x) | `{"QCF_x": 0}` | `[[变体1]]` |
| 2 | `QCF_x` (D,DF,F,y) | `{"QCF_x": 0}` | `[[变体1, 变体2]]` ← 同名，加到同一组 |
| 3 | `QCB_y` (D,DB,B,y) | `{"QCF_x": 0, "QCB_y": 1}` | `[[变体1, 变体2], [QCB_y]]` |

**关键在第 2 步**：`Add()` 发现 `"QCF_x"` 已经在 `Names` 里了（`ok == true`），所以不新建组，直接 `append` 到 `Commands[0]` 里。变体 1 和变体 2 就这样被放在了同一个 slice 里。

所以 `ClearName` 根本不需要判断"前置输入是否相似"。它做的事很简单：
1. 查 `Names` 表，`"QCF_x"` 对应组号 0
2. 遍历 `Commands[0]` 里的每个命令（这些就是编译时按名字归到一起的变体）
3. 对没完成的那个调 `Clear(false)`

**"变体"的定义：名字相同的命令 = 变体。** 和输入内容是否相似无关：

- `D, DF, F, x` 和 `D, DF, F, y` 同名 → 变体（典型场景）
- `D, DF, F, x` 和 `a, b, c` 同名 → 也是变体（虽然输入完全不同，但名字一样就会被分到一组）
- `D, DF, F, x` 和 `D, DF, F, y` 不同名 → 不是变体，互不影响

变体关系纯粹由 `name` 字段决定，编译时一次性固定，运行时不再变化。玩家没法在游戏中改变哪些命令互为变体，作者写 CMD 文件时用相同的 `name = "..."` 就等于声明"这几个是同一招的不同触发方式"。

##### 完整帧序列：钢琴输入场景走一遍

两个变体：
```
变体1: command = D, DF, F, x   (名字 "QCF_x")
变体2: command = D, DF, F, y   (名字 "QCF_x")
```

**帧 0-2：玩家输入 D, DF, F**

| 帧 | 玩家动作 | 变体1.completed | 变体2.completed |
|----|---------|-----------------|-----------------|
| 0 | 按 D | [T, F, F, F] | [T, F, F, F] |
| 1 | 按 DF | [T, T, F, F] | [T, T, F, F] |
| 2 | 按 F | [T, T, T, F] | [T, T, T, F] |

两个变体同步推进，都差最后一步。

**帧 3：玩家按 x（不按 y）**

进入 `Step()` 第一轮循环：

- **变体 1**（`...x`）：
  - `Step()` 内部匹配：`xb == 1` → `completed[3] = true`
  - `input.go:2580`：`completeframe = completed[3] == true` → **完成了**
  - `input.go:2597-2598`：`curbuftime = maxbuftime`（设置缓冲）
  - `input.go:2595`：`Clear(false)` 清自己 → completed 归零
  - 回到外层 `input.go:2896`：检测到 `completeframe == true`
    - `input.go:2897`：再 `Clear(false)`（已清过，无影响）
    - `input.go:2898`：`completed["QCF_x"] = true`（记下名字）
    - `input.go:2899`：`completeframe = false`

- **变体 2**（`...y`）：
  - `Step()` 内部匹配：`yb != 1`（没按 y）→ `completed[3]` 保持 false
  - `completeframe = false`（没完成）
  - 外层 `input.go:2896`：`completeframe` 是 false → **跳过，不进 if 块**
  - 变体2的 `completed` **保持 `[T, T, T, F]` 不变**

第一轮结束时：
```
completed 清单 = {"QCF_x": true}
变体1.completed = [F, F, F, F]  （被清了）
变体2.completed = [T, T, T, F]  （还活着！）
```

进入第二轮循环（`input.go:2904-2907`）：

```go
for name := range completed {   // name = "QCF_x"
    cl.ClearName(name)
}
```

`ClearName("QCF_x")` 遍历这组变体：
- **变体1**：`completeframe` 已被设成 false，条件满足 → `Clear(false)`（已清过，无害）
- **变体2**：`!completeframe` ✓ && `buffer_shared` ✓ && `name == "QCF_x"` ✓ → **三个条件全满足！**
  - 调用 `cmd.Clear(false)`
  - 变体2的 `completed` 从 `[T, T, T, F]` 变成 `[F, F, F, F]` ← **★ 失忆了 ★**

##### 为什么清零后变体 2 匹配不了 y？

这涉及 InputBuffer 的本质。它存的不是历史输入队列，而是每个按键**当前的状态计时**（`input.go:716-732`）：

```go
update := func(held bool, buffer *int32) {
    if held != (*buffer > 0) {   // 状态发生变化（按下↔松开）
        if held {
            *buffer = 1          // ← 刚按下这帧
        } else {
            *buffer = -1         // ← 刚松开这帧
        }
        return
    }
    if held {
        *buffer += 1             // ← 持续按住：2, 3, 4...
    } else {
        *buffer -= 1             // ← 持续松开：-2, -3...
    }
}
```

`Db`（Down 键）的值含义：

| 值 | 含义 |
|----|------|
| `1` | **这帧刚按下**（边缘事件） |
| `2, 3, 4...` | 按住中了 2、3、4 帧 |
| `-1` | 这帧刚松开 |
| `-2, -3...` | 松开了 2、3 帧 |

命令匹配靠的就是"边缘事件"（`input.go:2514-2515`）：

```go
if k.slash {
    keyOk = t > 0    // "/" 修饰符：按住即可
} else {
    keyOk = t == 1   // 默认：必须"这帧刚按下"
}
```

**帧 4**：变体 2 从步骤 0 重新开始匹配：
- 步骤 0 是 `D`，需要 `Db == 1`（刚按下）
- 但此刻 `Db = 4`（4 帧前按的，一直按着）→ **不匹配！**
- 就算玩家这帧按了 `y`，`yb = 1`，但步骤 0 都没过，根本走不到步骤 3
- 变体 2 **无法完成** ✓

##### 流程图总结

```
帧 3 玩家按 x
    │
    ▼
Step() 第一轮：遍历所有命令
    │
    ├─ 变体1 (D,DF,F,x)：匹配到 x → 完成 → Clear自己 → 记下 "QCF_x"
    │
    └─ 变体2 (D,DF,F,y)：没匹配到 y → 没完成 → 不动
            │
            └─ completed 还是 [T,T,T,F]
    │
    ▼
Step() 第二轮：遍历"本帧完成的名字"
    │
    └─ ClearName("QCF_x")
            │
            ├─ 变体1：条件满足 → Clear(false)（已清过，无害）
            │
            └─ 变体2：!completeframe ✓ && buffer_shared ✓ && name=="QCF_x" ✓
                    │
                    └─ Clear(false)
                            │
                            ├─ curtime = 0
                            ├─ completed = [F,F,F,F]  ← ★ 失忆了 ★
                            └─ stepTimers = [0,0,0,0]
```

##### 一句话总结

**输入没有被消费，是"匹配进度"被清零了——命令失忆了，而它需要的输入时机（边缘事件 `t == 1`）已经过去了。**

如果没有第二轮 `ClearName`，变体 2 会带着 `[T,T,T,F]` 进入帧 4。帧 4 玩家按 y → `completed[3] = true` → 变体 2 也完成 → `command = "QCF_x"` 再次为 true → 同一招连放两次。`ClearName` 的作用就是阻止这种情况。

#### 5.3.7 总结表

| 场景 | 行为 | 机制 |
|------|------|------|
| 同名命令重复输入 | 刷新倒计时 | `Max(curbuftime, maxbuftime)` |
| 同名命令变体（buffer.shared=true） | 完成时其他变体被重置 | `ClearName` |
| 不同名命令同时触发 | 各自独立倒计时 | 每个 Command 独立 |
| 多个 command trigger 同时满足 | 文件中先写的先触发 | [State] 块顺序 |

#### 5.3.8 为什么触发后不清零 curbuftime？

curbuftime 每帧 -1，**不会因为 `command = "X"` 被检测到就清零**。源码 `input.go:2447`：

```go
if c.curbuftime > 0 && !hpbuf && !pausebuf {
    c.curbuftime--                    // 只递减，不检查是否被消费
}
```

**为什么不清零？** 因为同一个命令可能被多个状态检测，不只是当前触发的那一个。

#### 原因 1：同一帧多个状态可能都要读

```ini
; state -2 先执行，记录输入到变量
[State -2, 记录输入]
trigger1 = command = "QCF_x"
type = VarSet
v = 50
value = 1

; state -1 后执行，触发技能
[State -1, QCF_x 技能]
trigger1 = command = "QCF_x"
trigger1 = ctrl
value = 1000
```

state -2 在 state -1 之前执行。如果 state -2 检测完就清零，state -1 就检测不到了。**同一帧内，多个状态共享同一个 curbuftime**。

#### 原因 2：命令可能被取消逻辑复用

```ini
[Statedef 200]  ; 攻击状态
; 攻击中也可以用 QCF_x 取消（派生特殊技）
[State 200, QCF_x 取消]
trigger1 = command = "QCF_x"
trigger1 = time >= 8
value = 1000
```

如果玩家在 state -1 触发前就进入了攻击状态 200，攻击中第 8 帧又检查 `command = "QCF_x"`——如果之前清零了，这里就检测不到。

#### 原因 3：下一帧才进入新状态

```
帧 0: QCF_x 完成，curbuftime = 4
      state -1: trigger1 = command = "QCF_x" ✓ → ChangeState
      但状态切换在帧末才生效，state 1000 还没运行

帧 1: 状态 1000 开始运行
      curbuftime = 3（仍然有效）
      state 1000 内部也可以检测 command = "QCF_x"
      （比如用于判断"是否继续派生"）
```

ChangeState 的执行不是立即跳转，而是在当前帧的所有状态执行完后才生效。如果第 0 帧清零，第 1 帧新状态就检测不到了。

#### 如果清零会怎样？

```
帧 0: QCF_x 完成，curbuftime = 4
      state -1: trigger1 = command = "QCF_x" ✓ → ChangeState
      清零：curbuftime = 0           ← 假设清零

帧 1: state 1000 运行
      curbuftime = 0
      state 1000 想检测 command = "QCF_x" → false ❌
```

输入在第 0 帧被"消费"了，后续状态无法再检测。这破坏了"输入是公共信息"的设计。

#### 正确的清零时机

curbuftime 的清零只由**时间**决定（每帧 -1），不由"是否被检测到"决定。

**设计哲学**：
- curbuftime 是**输入的可用性计时**，不是"已消费标志"
- 谁都可以读，读多少次都行
- 时间到了自然过期
- 这让多个状态/SC 可以独立检测同一个命令，互不干扰

#### 类比：超市优惠券

- 你拿到优惠券（curbuftime = 4）
- 有效期 4 天
- 你可以**多次出示**给不同部门（收银台、会员中心、客服）
- 不会因为你给收银台看了一次就失效
- 4 天后才过期

如果"看一次就失效"（触发即清零），你就只能给一个部门用，其他部门都看不到了。

#### 总结

**curbuftime 每帧 -1 而不是触发即清零**，因为：

1. **同一帧多个状态可能都要读**：state -2 和 state -1 都可能检测同一命令
2. **下一帧新状态可能还要读**：ChangeState 在帧末生效，新状态在下一帧运行
3. **取消逻辑可能复用**：攻击状态中可能再次检查同一命令做派生
4. **输入是公共信息**：不是"消费一次就没了"，而是"有效期内任何状态都能读"

**这是 CNS 输入系统的核心设计**：命令的"可用性"与"是否被读取"解耦，让多个状态机部分可以独立工作。

#### 5.3.9 多命令同时触发时未命中的命令会怎样？

考虑场景：玩家同时完成 QCF_x 和 QCB_y 两个输入，QCF_x 先触发，QCB_y 的状态不允许被取消。

**关键事实**：curbuftime 是**每个 Command 结构体自己的字段**（`input.go:2013`），不是全局的。每个命令独立维护自己的 curbuftime，互不影响。

```
帧 0: QCF_x 完成，QCB_y 同时完成
      QCF_x.curbuftime = 4    ← 各自独立
      QCB_y.curbuftime = 4

      state -1 执行（按 [State] 块顺序）:
        [State -1, QCF_x 技能]   trigger1 = command = "QCF_x" ✓  ctrl ✓
                                  → ChangeState value = 1000  ← 触发！
        [State -1, QCB_y 技能]   trigger1 = command = "QCB_y" ✓  ctrl ✓
                                  → ChangeState value = 2000
                                  但 QCF_x 的 ChangeState 已触发，状态已切换
                                  这个 [State] 不再执行（state -1 已结束）

帧 1: 进入 state 1000（QCF_x 技能）
      QCF_x.curbuftime = 3（继续递减，但没人读它了）
      QCB_y.curbuftime = 3

      state 1000 内部:
        假设 state 1000 没有写 QCB_y 的取消逻辑
        → QCB_y 没有任何 trigger 检查它
        → QCB_y 的 curbuftime 继续递减，没被消费

帧 2: QCB_y.curbuftime = 2
帧 3: QCB_y.curbuftime = 1
帧 4: QCB_y.curbuftime = 0  ← 过期，从此 command = "QCB_y" 返回 false
```

**QCB_y 不是"主动在等"**，而是：
1. 它的 curbuftime 在每帧自然递减（不依赖是否被读取）
2. 期间没有任何状态的 trigger 同时满足 `command = "QCB_y"` 和其他条件
3. 4 帧后 curbuftime 归零，命令"过期"
4. 过期后即使有状态想检测也检测不到了

#### "输入过期"的悲剧

如果 state 1000 允许 QCB_y 取消，但条件是 `time >= 4`：

```
帧 1: state 1000 的 time = 0
      [State 1000, QCB_y 取消]
      trigger1 = command = "QCB_y"   ✓（curbuftime = 3 > 0）
      trigger1 = time >= 4           ✗（time = 0）
      → 不触发

帧 4: state 1000 的 time = 3
      trigger1 = command = "QCB_y"   ✓（curbuftime = 1 > 0）
      trigger1 = time >= 4           ✗（time = 3）
      → 不触发

帧 5: state 1000 的 time = 4
      trigger1 = command = "QCB_y"   ✗（curbuftime = 0，过期了！）
      → 永远触发不了
```

**玩家做了正确的输入，但因为状态条件（time >= 4）满足时命令已过期，永远触发不了。**

这就是为什么 `buffer.time` 的设置很重要：
- **太短**：会丢失合法输入（如上例，玩家想做取消但来不及）
- **太长**：会让旧输入干扰新动作（玩家已经改主意了，旧命令还在）

#### 总结

| 问题 | 答案 |
|------|------|
| curbuftime 是全局的吗？ | ❌ 每个 Command 结构体自己的字段（`input.go:2013`） |
| 多条命令同时触发用同一个 curbuftime？ | ❌ 各自独立的 curbuftime，互不影响 |
| 一个命令触发会修改另一个命令的 curbuftime 吗？ | ❌ 不会，完全独立 |
| 未被触发的命令会怎样？ | curbuftime 自然递减，期间没被任何状态读取则过期 |
| 过期后还能触发吗？ | ❌ curbuftime = 0 后 `command = "X"` 永远返回 false |

**核心**：每个命令的 curbuftime 完全独立，互不干扰。一个命令触发不影响另一个命令的倒计时。未触发的命令自然过期，不会主动"等待"。

### 5.4 buffer.hitpause 详解

`buffer.hitpause` 控制**命中停顿期间缓冲是否继续递减**：

```go
// input.go:2436-2439
if !c.buffer_hitpause {
    hpbuf = false                  // 拒绝 hitpause 标志
    extratime = 0                  // 不额外延长
}
```

**`buffer.hitpause = 1`（默认）**：hitpause 期间 curbuftime 不递减，命令保持可用
- 场景：玩家命中敌人触发 hitpause，此时输入的命令不会过期

**`buffer.hitpause = 0`**：hitpause 期间 curbuftime 正常递减
- 场景：不希望命令在 hitpause 中保持

### 5.5 buffer.pauseend 详解

`buffer.pauseend` 控制**SuperPause/Pause 末尾的缓冲延长**：

```go
// input.go:2442-2445
if !c.buffer_pauseend {
    pausebuf = false
    extratime = 0
}
```

**`buffer.pauseend = 1`（默认）**：当 pause 接近结束时，缓冲延长
- 场景：超必杀的 SuperPause 期间输入的命令，在 pause 结束后仍可用

**`buffer.pauseend = 0`**：pause 期间缓冲正常处理

### 5.6 extratime 计算

```go
// char.go:13026
extratime = Btoi(hpbuf || pausebuf) + Btoi(winbuf)
```

- `hpbuf`：hitpause 中
- `pausebuf`：pause 末尾
- `winbuf`：WinMugen 兼容（旧版本额外加 1 帧）

`extratime` 加到 `maxbuftime` 上，延长缓冲持续时间。

### 5.7 buffer.shared

`buffer.shared`（默认 true）控制**同名命令是否共享缓冲**：

```ini
; 两个同名命令
[Command]
name = "QCF_x"
command = D, DF, F, x

[Command]
name = "QCF_x"
command = D, DF, F, x      ; 重复定义
```

`buffer.shared = true`：任一变体完成，所有同名命令的缓冲都设置
`buffer.shared = false`：每个变体独立计数

---

## 6. CNS 文件编译

### 6.1 编译入口

CNS 文件由 `stateCompile`（`compiler.go:6706`）编译，自动选择 CNS 或 ZSS：

```go
func (c *CharCompiler) stateCompile(states map[int32]StateBytecode, filename string, ...)
{
    isZss := HasExtension(filename, ".zss")
    // 加载文件
    if isZss {
        return c.stateCompileZSS(...)        // compiler.go:7932
    }
    return c.stateCompileCNS(...)              // compiler.go:6752
}
```

### 6.2 stateCompileCNS 三遍编译

`stateCompileCNS`（`compiler.go:6752-7082`）对每个状态做三遍处理：

#### Pass A：查找 [Statedef]

```go
// compiler.go:6769-6800
for ; c.i < len(c.lines); c.i++ {
    line := strings.ToLower(strings.TrimSpace(
        strings.SplitN(c.lines[c.i], ";", 2)[0]))   // 去注释，小写
    
    if len(line) < 11 || line[0] != '[' || line[len(line)-1] != ']' ||
       line[1:10] != "statedef " {
        continue                                       // 跳过非 Statedef 行
    }
    
    c.stateNo = parseStateNumber(line[10:])            // 解析状态号
    break
}
```

#### Pass B：解析 Statedef 参数

```go
// compiler.go:6802-6815
is, _ := c.parseSection(nil)                           // 读取 [Statedef] 的键值
sbc := newStateBytecode(c.playerNo)
c.stateDef(is, sbc)                                    // 编译 Statedef 参数
```

`stateDef`（`compiler.go:6530-6662`）解析 `type`/`movetype`/`physics`/`anim`/`velset` 等参数，编译成字节码：

```go
// compiler.go:6533-6551
switch strings.ToLower(data)[0] {
case 's': sbc.stateType = ST_S         // standing
case 'c': sbc.stateType = ST_C         // crouching
case 'a': sbc.stateType = ST_A         // airborne
case 'l': sbc.stateType = ST_L         // lying
case 'u': sbc.stateType = ST_U         // undefined
}
```

#### Pass C：解析每个 [State] 块

```go
// compiler.go:6818-7074
for c.i++; c.i < len(c.lines); c.i++ {
    // 查找 [State N, name] 块
    if line[1:7] != "state " { break }
    
    c.block = newStateBlock()
    sc := newStateControllerBase()
    
    // 解析块内参数
    is, _ := c.parseSection(func(name, data string) error {
        switch name {
        case "type":
            scf, ok = c.scmap[strings.ToLower(data)]     // 查 SC 表
        case "persistent":
            c.block.persistent = Atoi(data)
        case "ignorehitpause":
            c.block.ignorehitpause = ...
        default:
            if strings.HasPrefix(name, "trigger") {
                // 编译 trigger 表达式
                be := c.fullExpression(&data, VT_Bool)
                c.block.trigger = append(...)
            }
        }
    })
    
    // 调用 SC 构造函数
    scf(is, sc)                                          // compiler.go:7039
    
    // 加入状态块
    sbc.block.ctrls = append(sbc.block.ctrls, sc)
}
```

### 6.3 SC 映射表

状态控制器名到构造函数的映射在 `compiler.go:37-199` 的 `c.scmap`：

```go
c.scmap = map[string]scFunc{
    "varset":        func(...) {...},
    "changeanim":    func(...) {...},
    "changestate":   func(...) {...},
    "hitdef":        func(...) {...},
    // ... 160 个 SC
}
```

### 6.4 编译输出：StateBytecode

```go
// bytecode.go:15247-15256
type StateBytecode struct {
    stateType StateType              // S/C/A/L
    moveType  MoveType               // I/A/H
    physics   StateType
    playerNo  int
    stateDef  stateDef               // 入场时执行（anim, velset 等）
    block     StateBlock             // 包含所有 [State] 块
    ctrlsps   []int32                // persistent 计数器
    numVars   int32
}
```

编译后的所有状态存储在 `sys.cgi[pn].states`（`map[int32]StateBytecode`）。

---

## 7. 字节码执行

### 7.1 StateBytecode.run

每帧状态执行从 `StateBytecode.run`（`bytecode.go:15301`）开始：

```go
func (sb *StateBytecode) run(c *Char) (changeState bool) {
    sys.bcVar = sys.bcVarStack.Alloc(int(sb.numVars))
    sys.workingState = sb
    changeState = sb.block.Run(c, sb.ctrlsps)
    return
}
```

### 7.2 StateBlock.Run

`StateBlock.Run`（`bytecode.go:4542-4699`）是核心调度器：

```go
func (b *StateBlock) Run(c *Char, ps []int32) bool {
    // 1. Hitpause 检查
    if c.hitPause() && b.ignorehitpause < -1 {
        return false                  // hitpause 中且未设 ignorehitpause，跳过整个块
    }
    
    // 2. Persistent 检查
    if b.persistentIndex >= 0 {
        if ps[b.persistentIndex] > 0 {    // 冷却中
            ps[b.persistentIndex]--       // 递减
            return false                  // 跳过
        }
    }
    
    // 3. Trigger 评估
    if len(b.trigger) > 0 && !b.trigger.evalB(c) {
        return false                  // trigger 不满足，跳过
    }
    
    // 4. 执行 SC 列表
    for _, sc := range b.ctrls {
        if sc.Run(c, ps) {            // 执行 SC
            return true               // ChangeState 返回 true
        }
    }
    return false
}
```

### 7.3 SC 执行

每个 SC 的 `Run` 方法是参数分发器（`bytecode.go:4785`）：

```go
func (scb StateControllerBase) run(c *Char, f func(byte, []BytecodeExp) bool) {
    for i := 0; i < len(scb); {
        id := scb[i]; i++            // 参数 ID
        n := scb[i]; i++            // 表达式数量
        // 读取 n 个表达式
        if !f(id, exps) { break }   // 调用具体 SC 的处理函数
    }
}
```

**例子：stateDef.Run**（`bytecode.go:4858`）：

```go
func (sc stateDef) Run(c *Char) {
    StateControllerBase(sc).run(c, func(paramID byte, exp []BytecodeExp) bool {
        switch paramID {
        case stateDef_anim:
            animNo := exp[1].evalI(c)                  // 求值表达式
            if animNo != -1 { c.changeAnim(animNo, ...) }
        case stateDef_velset:
            c.vel[0] = exp[0].evalF(c)                  // 设置 X 速度
            c.vel[1] = exp[1].evalF(c)                  // 设置 Y 速度
        }
        return true
    })
}
```

### 7.4 ChangeState 的特殊处理

`ChangeState` 的 `Run` 返回 `true`，这会传播到 `changeStateEx`（`char.go:6606`），触发状态切换循环：

```go
// char.go:6625-6635
for {
    if !c.ss.sb.run(c) { break }     // 执行新状态
    // 如果新状态又触发 ChangeState，继续循环
}
```

---

## 8. Trigger 表达式求值

### 8.1 编译

Trigger 表达式由 `CharCompiler.fullExpression`（`compiler.go`）递归下降解析，生成 `BytecodeExp`（`[]OpCode`）：

**例子**：`trigger1 = command = "QCF_x" && time >= 8`

1. 解析 `&&`：分成左右两个子表达式
2. 左侧 `command = "QCF_x"`：
   - 在 `compiler.go:2025-2043` 处理
   - 把 `"QCF_x"` 加入字符串池
   - 生成 `OC_command <字符串池索引>`
3. 右侧 `time >= 8`：
   - 生成 `OC_time`（推送当前状态时间）
   - 生成 `OC_int8 8`（推送常量 8）
   - 生成 `OC_ge`（大于等于比较）
4. `&&` 用短路逻辑：
   - 左侧后加 `OC_jz8 <offset>`（如果左侧为假，跳过右侧）

### 8.2 字节码结构

```
command = "QCF_x" && time >= 8

编译后的 OpCode 序列：
┌─────────────────────┐
│ OC_command  "QCF_x" │  ← 推送 command 触发器结果
│ OC_jz8      +6      │  ← 如果为假，跳过 6 字节到末尾
│ OC_time             │  ← 推送当前状态时间
│ OC_int8     8       │  ← 推送 8
│ OC_ge               │  ← 弹出两值，推送 time >= 8
│ OC_and              │  ← 与左侧结果 AND（或直接由 jz 实现）
└─────────────────────┘
```

### 8.3 运行时求值

`BytecodeExp.run`（`bytecode.go:1881`）是一个栈式虚拟机：

```go
for i < len(be) {
    switch be[i] {
    case OC_int8:
        sys.bcStack.PushI(int64(be[i+1]))
        i += 2
    case OC_time:
        sys.bcStack.PushI(int64(c.ss.time))      // 推送状态时间
        i++
    case OC_ge:
        b := sys.bcStack.Pop()
        a := sys.bcStack.Pop()
        sys.bcStack.PushB(a >= b)
        i++
    case OC_command:
        // 见第 9 节
    case OC_jz8:
        if !sys.bcStack.Top().ToB() {
            i += int(be[i+1]) + 1                  // 跳转
        }
        i += 2
    }
}
```

### 8.4 evalB / evalI / evalF

`BytecodeExp` 提供三个便捷方法（`bytecode.go:4394-4408`）：

```go
func (be BytecodeExp) evalB(c *Char) bool { return be.run(c).ToB() }
func (be BytecodeExp) evalI(c *Char) int32 { return be.run(c).ToI() }
func (be BytecodeExp) evalF(c *Char) float32 { return be.run(c).ToF() }
```

在 `StateBlock.Run` 中用 `evalB` 评估 trigger：

```go
if len(b.trigger) > 0 && !b.trigger.evalB(c) { return false }
```

---

## 9. command 触发器的运行时实现

### 9.1 OC_command 字节码

当 trigger 中出现 `command = "X"` 时，编译器生成 `OC_command` 操作码（`bytecode.go:2181-2200`）：

```go
case OC_command:
    cmdName := be.ReadPoolStringAt(&i)          // 读取命令名（字符串池索引）
    redir := c.playerNo
    pno := c.playerNo
    
    // Mugen 兼容：非 ikemenversion 角色在 state owner 的命令列表中查找
    if cmdName != "recovery" && c.stWgi().ikemenver[0] == 0 {
        redir = c.ss.sb.playerNo
        pno = c.ss.sb.playerNo
    }
    
    cmdPos, ok := c.cmd[redir].Names[cmdName]   // 查找���令索引
    ok = ok && c.command(pno, cmdPos)            // 检查缓冲
    sys.bcStack.PushB(ok)                        // 推送结果
```

### 9.2 Char.command 函数

`Char.command`（`char.go:5230-5263`）是 `command = "X"` 的核心实现：

```go
func (c *Char) command(pn, i int) bool {
    if !c.keyctrl[0] || c.cmd == nil { return false }
    
    cl := c.cmd[pn].At(i)                        // 获取所有同名命令变体
    
    for _, c := range cl {
        if c.curbuftime > 0 {                    // ← 关键！检查缓冲时间
            return true                           // 任一变体有缓冲，返回 true
        }
    }
    
    // AI 作弊：AI 控制时，如果是当前指定的 CPU 命令，也返回 true
    if !c.asf(ASF_noaicheat) && c.controller < 0 {
        if i == int(c.cpucmd) { return true }
    }
    
    return false
}
```

### 9.3 完整生命周期

`trigger1 = command = "QCF_x"` 的完整生命周期：

```
1. 加载阶段
   compiler.go:8265          解析 [Command] name=QCF_x
   compiler.go:2039           把 "QCF_x" 加入字符串池
   compiler.go:2039           生成 OC_command <索引>

2. 输入阶段（每帧）
   char.go:12993              InputUpdate → 读取键盘
   input.go:2824              updateInputTime → 更新 Ub/Db/...
   char.go:13028              CommandList.Step → Command.Step
   input.go:2481              遍历 loopOrder 匹配输入
   input.go:2598              匹配成功 → curbuftime = maxbuftime

3. 状态执行阶段（每帧）
   char.go:11725              c.ss.sb.run(c) → 当前状态字节码
   bytecode.go:15304         StateBlock.Run
   bytecode.go:4676          b.trigger.evalB(c) → 评估 trigger
   bytecode.go:1881          BytecodeExp.run → 栈式求值
   bytecode.go:2181          遇到 OC_command
   char.go:5230              Char.command → 检查 curbuftime > 0
                             ↓
                             curbuftime > 0 → 推送 true
                             curbuftime = 0 → 推送 false

4. SC 执行（如果 trigger 为 true）
   bytecode.go:4682-4693     遍历 b.ctrls
   bytecode.go:4785          sc.Run(c, ps) → 执行 ChangeState 等
   char.go:6625              changeStateEx → 切换状态
```

---

## 10. 前摇取消机制：ctrl 与 ChangeState 的真相

### 10.1 ctrl = 0 真正的含义

`ctrl = 0` **不是**"不能切换状态"，它只影响一件事：**state -1 里的通用命令处理不再触发 ChangeState**。

```ini
; state -1（框架的命令处理）
[State -1, 普通攻击]
type = ChangeState
trigger1 = command = "x"
trigger1 = ctrl              ; ← ctrl = 0 时这里为 false，整个 trigger 不满足
value = 200
```

**但当前状态自己写的 [State] 块不受 ctrl 影响**——只要 trigger 满足就能执行 ChangeState。这就是前摇取消的基础。

### 10.2 前摇取消的写法

在攻击状态内部写取消逻辑，不依赖 ctrl：

```ini
[Statedef 200]                  ; 攻击状态
type = S
movetype = A
physics = S
anim = 200
ctrl = 0                        ; ← 无控制权（state -1 失效）
poweradd = 50

; ========== 取消逻辑（写在前面 = 高优先级）==========

; 跳跃取消（前摇期间也能取消）
[State 200, Jump Cancel]
type = ChangeState
trigger1 = command = "holdup"              ; 按上
trigger1 = time >= 4                        ; 第 4 帧后可取消
trigger1 = time <= 12                       ; 第 12 帧前必须取消
trigger1 = movehit = 1                      ; 必须命中才能跳取消（DMC 规则）
value = 40                                  ; 跳跃状态

; 闪避取消
[State 200, Dodge Cancel]
type = ChangeState
trigger1 = command = "dodge"
trigger1 = time >= 4
trigger1 = time <= 12
value = 105

; DT 取消
[State 200, DT Cancel]
type = ChangeState
trigger1 = command = "dt_activate"
trigger1 = time >= 4
trigger1 = var(50) >= 100                   ; DT 槽够
value = 1000

; ========== 正常逻辑（取消不触发时执行）==========

; 攻击判定
[State 200, HitDef]
type = HitDef
trigger1 = time = 0
attr = S, NA
damage = 80
...

; 动画播完回 idle
[State 200, End]
type = ChangeState
trigger1 = AnimTime = 0
value = 0
ctrl = 1
```

### 10.3 "高优先级写在前面"的执行机制

CNS 中 [State] 块**按文件顺序执行**。引擎按顺序评估每个 [State] 的 trigger：

- 第一个满足 trigger 的 ChangeState 触发 → 状态切换
- 状态切换后，后面的 [State] **不再执行**（因为已经在新状态了）
- 所以"写在前面 = 优先级高"

```ini
; 先写跳跃取消（优先级最高）
[State 200, Jump Cancel]
type = ChangeState
trigger1 = command = "holdup"
trigger1 = time >= 4
value = 40                  ; ← 这个先触发

; 再写闪避取消
[State 200, Dodge Cancel]
type = ChangeState
trigger1 = command = "dodge"
trigger1 = time >= 4
value = 105                 ; ← 如果上面没触发，这个才考虑
```

这等价于显式 priority 系统，只是用文件顺序表达。

### 10.4 完整的可取消攻击模板

```ini
[Statedef 200]
type = S
movetype = A
physics = S
anim = 200
ctrl = 0

; ===== 取消区（按优先级从高到低）=====

; 1. DT 取消（最高优先级）
[State 200, DT Cancel]
type = ChangeState
trigger1 = command = "dt_activate"
trigger1 = time >= 2                        ; 几乎立刻可取消
trigger1 = var(50) >= 100
value = 1000

; 2. 跳跃取消
[State 200, Jump Cancel]
type = ChangeState
trigger1 = command = "holdup"
trigger1 = time >= 4                        ; 前 4 帧不可取消
trigger1 = time <= 20                       ; 20 帧后不可取消（后摇）
trigger1 = movehit = 1                      ; 必须命中
value = 40

; 3. 闪避取消
[State 200, Dodge Cancel]
type = ChangeState
trigger1 = command = "dodge"
trigger1 = time >= 4
trigger1 = time <= 20
value = 105

; 4. 特殊技取消
[State 200, Special Cancel]
type = ChangeState
trigger1 = command = "QCF_x"
trigger1 = time >= 8                        ; 命中帧之后才能取消
trigger1 = time <= 20
value = 1000

; ===== 正常逻辑 =====

; 攻击判定
[State 200, HitDef]
type = HitDef
trigger1 = time = 0
...

; 派生（连招延续）
[State 200, Combo to A2]
type = ChangeState
trigger1 = command = "x"
trigger1 = time >= 8                        ; 命中帧后才能派生
trigger1 = time <= 20
value = 201

; 自然结束
[State 200, End]
type = ChangeState
trigger1 = AnimTime = 0
value = 0
ctrl = 1
```

### 10.5 时间窗口区分阶段

一个攻击状态的不同阶段通过 `time` 范围区分：

```
[0 ──────────── 4 ─────── 8 ─────── 20 ──────── AnimTime=0]
 │              │          │           │
 │              │          │           └─ 后摇（只能等结束）
 │              │          └─ 派生窗口（连招延续、特殊技取消）
 │              └─ 取消窗口（跳跃取消、闪避取消）
 └─ 前摇（只有 DT 取消可用，time >= 2）
```

| 时间范围 | 可取消类型 | 条件 |
|---------|----------|------|
| `time >= 2 && time <= 4` | DT 取消（前摇专有） | `var(50) >= 100` |
| `time >= 4 && time <= 20` | 跳跃取消 | `movehit = 1` |
| `time >= 4 && time <= 20` | 闪避取消 | 无 |
| `time >= 8 && time <= 20` | 派生取消 | `command = "x"` |
| `time > 20` | 不可取消 | — |

### 10.6 与现代设计 priority 的对应

CNS 的"顺序优先"等价于现代设计中 Transition 的 `priority` 字段：

```ini
; CNS（顺序即优先级）
[State 200, DT Cancel]      ; ← 写在最前 = 最高优先
type = ChangeState
...
[State 200, Jump Cancel]    ; ← 第二
type = ChangeState
...
[State 200, Dodge Cancel]   ; ← 第三
```

```yaml
# 现代设计（显式优先级）
transitions:
  - to: dt_burst_cancel
    priority: 95          # ← 显式数字
  - to: jump_start
    priority: 100
  - to: dodge
    priority: 90
```

本质相同，CNS 用文件顺序表达优先级，现代设计用显式数字——后者更清晰、可量化。

### 10.7 关键结论

1. **ctrl = 0 只影响 state -1**：state -1 是"通用命令处理"，你自己的状态内取消不受影响
2. **取消写在前摇期间也能用**：因为 [State] 块不检查 ctrl
3. **顺序就是优先级**：先写的先触发，触发后后面的不执行
4. **条件区分取消类型**：
   - `movehit = 1` → 命中后才能取消
   - `command = "..."` → 需要特定输入
   - `var(N) >= X` → 需要资源
   - `time in [a, b]` → 限定时间窗口

**核心**：CNS 完全支持可取消的前摇机制。`ctrl = 0` 不是限制，它只是让 state -1 通用命令失效。你在状态内写的取消 [State] 块按顺序执行，先满足的先触发——这就是一套完整的取消系统。

---

## 11. 主循环与每帧流程

### 11.1 比赛循环

比赛级循环在 `System.runMatch`（`system.go:3720-3929`）：

```go
for !s.endMatch {
    if !s.runNextRound() { break }   // 回合/比赛转换
    s.action()                       // 主帧逻辑
    s.renderFrame()                  // 渲染
    s.update()                       // 等待下一帧
}
```

### 11.2 System.action —— 每帧流水线

`System.action`（`system.go:2594`）是每帧的核心：

| 顺序 | 代码 | 说明 |
|------|------|------|
| 1 | `clearSpriteData()` | 清空精灵数据 |
| 2 | `stepRoundState()` | 回合状态、计时器、KO 处理 |
| 3 | `stage.action()` | 场景背景更新 |
| 4 | **`charList.action()`** | **角色逻辑（核心）** |
| 5 | `charUpdate()` | 物理更新（速度积分、位置） |
| 6 | `fightScreen.step()` | 血条/连击更新 |
| 7 | `globalCollision()` | 碰撞检测 |
| 8 | `globalTick()` | 推进比赛时间 |
| 9 | `cam.action()` | 摄像机更新 |
| 10 | `cueDraw()` | 构建绘制列表 |
| 11 | `renderFrame()` | 渲染 |

### 11.3 CharList.action —— 角色逻辑顺序

`CharList.action`（`char.go:13092-13118`）：

```go
cl.updateRunOrder()        // 1. 按优先级排序（runfirst/runlast）
cl.commandUpdate()         // 2. 输入读取 + 命令匹配
for _, c := range cl.runOrder { c.actionPrepare() }   // 3. 硬编码按键、重置标志
for _, c := range cl.runOrder { c.actionRun() }        // 4. 状态机执行
for _, c := range cl.runOrder { c.actionFinish() }     // 5. 清理
```

### 11.4 CharList.commandUpdate —— 输入与命令

`CharList.commandUpdate`（`char.go:12956-13036`）对每个角色：

```go
// 1. 读取原始输入
c.cmd[0].InputUpdate(c, c.controller)
//   → 读取键盘/手柄/AI/网络
//   → 应用 AssertInput/ShiftInput
//   → Buffer.updateInputTime（更新 Ub/Db/...）

// 2. 计算 hitpause/pause 标志
hpbuf := c.hitPause() && ...
pausebuf := sys.supertime > 0 && ...

// 3. 命令匹配
for i := range c.cmd {
    c.cmd[i].Step(c.controller < 0, helperbug, hpbuf, pausebuf, extratime)
}
```

### 11.5 Char.actionRun —— 状态机执行顺序

`Char.actionRun`（`char.go:11690-11762`）按固定顺序执行状态：

```go
c.minus = -4
if sb, ok := c.gi().states[-4]; ok { sb.run(c) }      // state -4

if !c.pauseBool {
    c.minus = -3
    if sb, ok := c.gi().states[-3]; ok { sb.run(c) }   // state -3
    
    c.minus = -2
    if sb, ok := c.gi().states[-2]; ok { sb.run(c) }   // state -2
    
    c.minus = -1
    if sb, ok := c.gi().states[-1]; ok { sb.run(c) }   // state -1
    
    c.stateChange2()                                      // 应用缓冲的 ChangeState
    c.minus = 0
    c.ss.sb.run(c)                                        // 当前状态
}

// guarding 逻辑 + state +1
c.minus = -4
if sb, ok := c.gi().states[-10]; ok { sb.run(c) }        // state +1（存为 -10）
```

**执行顺序**：`-4 → -3 → -2 → -1 → stateChange2 → 当前状态 → +1`

### 11.6 物理与碰撞

物理更新与碰撞检测在 `action()` 之后：

| 顺序 | 代码 | 说明 |
|------|------|------|
| 1 | `Char.update`（`char.go:12068`） | 物理更新：速度积分、位置、倒地机制 |
| 2 | `CharList.collisionDetection`（`char.go:13817`） | 推挤检测 |
| 3 | `hitDetectionPlayer`（`char.go:13150`） | 玩家攻击判定 |
| 4 | `hitDetectionProjectile`（`char.go:13377`） | 投射物攻击判定 |

---

## 12. 完整生命周期总结

### 12.1 一帧的完整流程

```
┌─────────────────────────────────────────────────────────────┐
│ 第 N 帧开始                                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. 输入读取                                                  │
│    char.go:12993  InputUpdate                                │
│    input.go:2824  updateInputTime                            │
│    → Ub/Db/Fb/... 更新（正=按住，负=松开）                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. 命令匹配                                                  │
│    char.go:13028  CommandList.Step                          │
│    input.go:2434   Command.Step                             │
│    → 遍历每个命令的 loopOrder                                 │
│    → 匹配输入序列                                             │
│    → 匹配成功：curbuftime = maxbuftime + extratime             │
│    → 匹配失败：curbuftime--（递减）                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. 状态机执行（每个角色）                                     │
│    char.go:11690  actionRun                                  │
│    ├─ state -4（Ikemen 扩展）                                 │
│    ├─ state -3（辅助计算）                                    │
│    ├─ state -2（全局状态机）                                  │
│    ├─ state -1（命令处理）                                    │
│    ├─ stateChange2（应用缓冲的状态切换）                       │
│    ├─ 当前状态                                                │
│    │   └─ StateBytecode.run                                  │
│    │       └─ StateBlock.Run                                 │
│    │           ├─ trigger.evalB → 评估条件                    │
│    │           │   └─ OC_command → Char.command               │
│    │           │       └─ curbuftime > 0 ?                    │
│    │           ├─ SC 列表执行                                 │
│    │           │   ├─ ChangeAnim                              │
│    │           │   ├─ VelSet                                  │
│    │           │   ├─ HitDef                                  │
│    │           │   └─ ChangeState → 触发状态切换              │
│    │           └─ persistent 更新                             │
│    └─ state +1（Ikemen 扩展）                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. 物理更新                                                  │
│    char.go:12068  Char.update                                │
│    → vel += accel（重力）                                     │
│    → pos += vel                                              │
│    → 触地检测                                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. 碰撞检测                                                  │
│    char.go:13817  collisionDetection                         │
│    → 推挤检测                                                 │
│    → 攻击判定（HitDef vs 玩家）                                │
│    → 投射物判定                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. 渲染                                                      │
│    system.go:3908  renderFrame                               │
│    → 绘制精灵、特效、UI                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 第 N+1 帧                                                   │
��─────────────────────────────────────────────────────────────┘
```

### 12.2 命令触发的时序示例

以"玩家做 QCF_x 输入触发技能"为例：

```
帧 0: 玩家按下 ↓
  - InputBuffer: Db = 1
  - Command QCF_x: 第 1 步（D）匹配，completed[0] = true
  - curtime = 1

帧 1: 玩家按下 ↘（D+F）
  - InputBuffer: Db = 2, Fb = 1
  - Command QCF_x: 第 2 步（DF）匹配，completed[1] = true
  - curtime = 2

帧 2: 玩家按下 →（F）
  - InputBuffer: Fb = 2
  - Command QCF_x: 第 3 步（F）匹配，completed[2] = true
  - curtime = 3

帧 3: 玩家按下 X 键
  - InputBuffer: xb = 1
  - Command QCF_x: 第 4 步（x）匹配，completed[3] = true
  - completeframe = true!
  - curbuftime = 4（假设 buffer.time = 4）
  - Clear()（重置准备下次匹配）

帧 3: 状态机执行
  - state -1 中检测 trigger1 = command = "QCF_x"
  - Char.command → curbuftime = 4 > 0 → true
  - ChangeState value = 1000（技能状态）

帧 4: 进入技能状态 1000
  - curbuftime = 3
  - 技能状态执行（播放动画、设攻击判定）

帧 5: curbuftime = 2
帧 6: curbuftime = 1
帧 7: curbuftime = 0 → command = "QCF_x" 不再返回 true
```

---

## 13. 关键源码索引

### 13.1 输入系统

| 主题 | 文件 | 行号 |
|------|------|------|
| InputBuffer 结构 | `src/input.go` | 672 |
| InputBuffer 更新 | `src/input.go` | 695 |
| InputBuffer.State | `src/input.go` | 762 |
| Command 结构 | `src/input.go` | 2009 |
| CommandStep 结构 | `src/input.go` | 1938 |
| CommandStepKey 结构 | `src/input.go` | 16 |
| 命令字符串解析 | `src/input.go` | 2030 |
| Command.Step（每帧匹配） | `src/input.go` | 2434 |
| Command.Clear | `src/input.go` | 2419 |
| loopOrder 设置 | `src/input.go` | 2277 |
| CommandList 结构 | `src/input.go` | 2604 |
| CommandList.Step | `src/input.go` | 2886 |
| CommandList.InputUpdate | `src/input.go` | 2661 |

### 13.2 CMD 编译

| 主题 | 文件 | 行号 |
|------|------|------|
| CMD 解析入口 | `src/compiler.go` | 8183 |
| [Defaults] 读取 | `src/compiler.go` | 8242 |
| [Command] 字段读取 | `src/compiler.go` | 8264 |
| command/selfcommand trigger 编译 | `src/compiler.go` | 2025 |

### 13.3 CNS 编译

| 主题 | 文件 | 行号 |
|------|------|------|
| stateCompile 入口 | `src/compiler.go` | 6706 |
| stateCompileCNS | `src/compiler.go` | 6752 |
| stateDef 编译 | `src/compiler.go` | 6530 |
| SC 映射表 scmap | `src/compiler.go` | 37-199 |

### 13.4 字节码

| 主题 | 文件 | 行号 |
|------|------|------|
| StateBytecode 结构 | `src/bytecode.go` | 15247 |
| StateBytecode.run | `src/bytecode.go` | 15301 |
| StateBlock 结构 | `src/bytecode.go` | 4518 |
| StateBlock.Run | `src/bytecode.go` | 4542 |
| StateControllerBase.run | `src/bytecode.go` | 4785 |
| BytecodeExp 类型 | `src/bytecode.go` | 1249 |
| BytecodeExp.run（栈式求值） | `src/bytecode.go` | 1881 |
| OC_command 字节码 | `src/bytecode.go` | 2181 |
| OC_ex_selfcommand | `src/bytecode.go` | 3539 |

### 13.5 角色运行时

| 主题 | 文件 | 行号 |
|------|------|------|
| Char.cmd 字段 | `src/char.go` | 3233 |
| Char.command（cmd trigger 后端） | `src/char.go` | 5230 |
| Char.actionRun（状态机顺序） | `src/char.go` | 11690 |
| Char.actionPrepare | `src/char.go` | 11496 |
| Char.update（物理） | `src/char.go` | 12068 |
| Char.stateChange2 | `src/char.go` | 6583 |
| Char.changeStateEx | `src/char.go` | 6606 |
| CharList.commandUpdate | `src/char.go` | 12956 |
| CharList.action | `src/char.go` | 13092 |
| CharList.collisionDetection | `src/char.go` | 13817 |
| CharList.hitDetectionPlayer | `src/char.go` | 13150 |

### 13.6 主循环

| 主题 | 文件 | 行号 |
|------|------|------|
| System.runMatch | `src/system.go` | 3720 |
| System.action | `src/system.go` | 2594 |
| System.charUpdate | `src/system.go` | 2487 |
| System.globalCollision | `src/system.go` | 2499 |
| System.stepRoundState | `src/system.go` | 3054 |

---

## 附录：buffer.time 调试技巧

### 调试命令缓冲

在 state -2 中用 DisplayToClipboard 显示命令缓冲：

```ini
[State -2, 调试QCF_x缓冲]
type = DisplayToClipboard
trigger1 = 1
text = "QCF_x buf=%d"
params = command.buffer.time("QCF_x")
```

> 注意：`command.buffer.time("X")` 是 Ikemen 扩展 trigger，返回命令 X 的当前 curbuftime。

### 调试输入状态

```ini
[State -2, 调试输入]
type = DisplayToClipboard
trigger1 = 1
text = "U=%d D=%d F=%d B=%d a=%d b=%d c=%d x=%d y=%d z=%d"
params = input.up, input.down, input.forward, input.back, input.a, input.b, input.c, input.x, input.y, input.z
```

> `input.X` 是 Ikemen 扩展 trigger，返回 InputBuffer 中对应键的值（正=按住，负=松开）。

---

**文档结束。**

本文档完整解释了 Ikemen-GO 从按键到状态执行的全过程：

1. **输入读取**：InputBuffer 记录每个按键的 hold/release 计时
2. **命令匹配**：Command.Step 每帧检查输入序列是否匹配命令定义
3. **缓冲机制**：buffer.time 控制命令完成后保持多久可用，buffer.hitpause / buffer.pauseend 控制暂停中的行为
4. **状态执行**：按 -4 → -3 → -2 → -1 → 当前状态的顺序执行字节码
5. **Trigger 求值**：栈式虚拟机执行编译后的 OpCode，OC_command 检查 curbuftime
6. **SC 执行**：trigger 为 true 时执行 State Controller，ChangeState 触发状态切换

**核心洞察**：`command = "X"` 触发器的本质就是检查 `curbuftime > 0`——命令匹配成功后设置的缓冲计数器。
