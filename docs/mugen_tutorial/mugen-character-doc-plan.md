# MUGEN 角色系统文档：写作计划

> 这份计划记录 `mugen-character-for-love2d-beginners.md` 的章节规划和设计决策，避免遗忘。
>
> 每写完一章更新状态。设计决策变更时也更新这里。

---

## 文档目标

承接 input 文档，讲 MUGEN 角色系统 + Love2D 2D 横版鬼泣实现。最终让读者能理解如何做 2D 动作游戏框架，以后自己填充角色技能。

**核心原则**：
- 以 2D 横版鬼泣为目标，不生硬学 MUGEN
- 值得借鉴的参考 MUGEN，不适合的只列 MUGEN 做法然后给推荐
- 读者是新人，需要详细解释 + ASCII 图 + 可运行代码

---

## 章节进度

| 章 | 标题 | 状态 | 要点 |
|---|---|---|---|
| 序章 | 文档定位 | ✅ 完成 | 承接 input 文档 |
| 1 | 角色文件结构 | ✅ 完成 | 5种文件/JSON动画格式/碰撞框/文件组织 |
| 2 | 状态系统基础 | ✅ 完成 | StateNo/StateType(S/A/L)/MoveType/Physics/执行流程/prevStateNo |
| 3 | SCTRL 基础 | ✅ 完成 | ChangeState/VelSet/PosSet/ChangeAnim/CtrlSet/命名字段变量 |
| 4 | Trigger 基础 | ✅ 完成 | 混合方式(辅助函数+内联)/速查表/trigger entry衔接 |
| 5 | 动画系统 | ✅ 完成 | JSON加载播放/animelemtime/帧事件/循环vs一次性/Sprite Sheet |
| 6 | 物理系统 | ✅ 完成 | move_x防滑步/locomotion状态机/惯性/冲刺减速/击退落地/重力调参 |
| 7 | 碰撞检测系统 | ✅ 完成 | AABB/pushbox只对地面/jcbox vs jcbox踩怪/jcContact/取消规则/JC不能连JC |
| 8 | 命中系统(HitDef) | ✅ 完成 | HitDef参数/被击状态5000系列/击退move_x/hitstop/counter hit/空中技能CD+JC重置 |
| 9 | 特效系统 | ✅ 完成 | Explod/划痕附着/Projectile/AfterImage/Helper/EntityManager/hitstop关系 |
| 10 | 高级系统 | ✅ 完成 | HitBy无敌帧/HitOverride霸体/ReversalDef弹反/SuperPause冻场/persistent |
| 11 | 鬼泣特色系统 | ✅ 完成 | JC完整实现/DT取消魔人化/武器风格切换/连段评价/锁定系统/整合主循环 |
| 12 | 相机系统 | ✅ 完成 | 张力跟随/垂直跟随/飞高拉远落地拉近/震屏/命中微缩放/慢动作/镜头锁定/状态控制 |

### Part 3：辅助系统（mugen-character-for-love2d-beginners-part3.md）

| 章 | 标题 | 状态 | 要点 |
|---|---|---|---|
| 13 | 音效系统 | ✅ 完成 | 音效播放/音量/战斗音乐动态切换(评价影响)/BGM淡入淡出/MUGEN sound |
| 14 | UI 系统 | ⬜ 待写 | 血条/魔人槽/评价显示/锁定标记/菜单/布局 |
| 15 | 背景与视差滚动 | ⬜ 待写 | 多层背景/视差速度/滚动边界/MUGEN stage系统 |
| 16 | 敌人 AI 系统 | ⬜ 待写 | 巡逻/发现玩家/追击/攻击选择/撤退/决策间隔/MUGEN AIlevel |
| 17 | 资源管理与性能 | ⬜ 待写 | 图片加载缓存/内存管理/对象池/渲染批处理/四叉树 |
| 18 | 调试系统 | ⬜ 待写 | 碰撞框显示/FPS/状态信息/慢动作调试/命令行参数 |
| 19 | 关卡系统 | ⬜ 待写 | 关卡切换/剧情触发/Boss战结构/存档/配置 |

---

## 文档结构

| 文档 | 章节 | 文件名 |
|---|---|---|
| input 文档 | 输入系统（按键缓冲/命令匹配/hitstop/SOCD/取消） | mugen-input-for-love2d-beginners.md |
| Part 1 | 角色系统（文件结构/状态/SCTRL/Trigger/动画） | mugen-character-for-love2d-beginners.md |
| Part 2 | 战斗系统（物理/碰撞/命中/特效/高级/鬼泣特色/相机） | mugen-character-for-love2d-beginners-part2.md |
| Part 3 | 辅助系统（AI/背景/UI/音效/资源/调试/关卡） | mugen-character-for-love2d-beginners-part3.md（待创建） |

---

## 设计决策记录

### 角色文件格式（第一章）

1. **精灵图外置 PNG + 路径引用**（不用 SFF 打包，不用 base64 内嵌）
2. **支持单张图和 Sprite Sheet**（`type: "single"` / `"sheet"` + region）
3. **JSON 描述动画**（hurtbox/hitbox/jcbox/spawnPoints 四种数据）
4. **推挤框放 config**（按 statetype，不放动画 JSON）
5. **坐标系 y 向下为正**（和 Love2D、MUGEN 一致）
6. **命名发射点 spawnPoints**（比 MUGEN 硬编码坐标更清晰）
7. **kmc-editor 格式仅供参考**，未来改编辑器适配此格式

### 状态系统（第二章）

1. **鬼泣只用 S/A/L 三种 StateType**（去掉 C 蹲下）
2. **不做防御系列状态**（120-155 不实现）
3. **不做 juggle 点数**（用"空中技能 CD + JC 重置"替代）
4. **状态文件格式**：`states/N.lua`，回调 onEnter/onExit/onFrame/onUpdate
5. **状态切换**：`player:setState(N)` 自动处理退出/进入/切动画/设ctrl
6. **prevStateNo 记录**：setState 里记录 `self.prevStateNo = self.stateNo`，用于取消链限制（如 JC不能连JC）

### SCTRL（第三章）

1. **ctrl 不是"开关输入"**：是"角色是否自由可控"的标志。ctrl=false 时 onFrame 照常调用、trigger entry 照常检查，只是带 ctrl 条件的 entry 失败。取消/RC 不需要 ctrl 甚至要求 !ctrl
2. **变量用命名字段**：`player.combo_count` 比 `player.vars[0]` 清晰。不用 MUGEN 的 var(index) 方式。需要动态访问时用 setVar/addVar 辅助方法（字符串 key）
3. **SCTRL = Player 方法**：不需要声明式解析器，直接 `player:velSet(x, y)`

### Trigger（第四章）

1. **混合方式**：常用简单布尔用辅助函数（`T.ctrl`、`cmd("a")`），比较运算用内联函数（`function(p) return p.devil_trigger >= 2000 end`）
2. **不为比较运算符定义版本**：避免 `powerGte`/`p2distLte`/`timeGte` 爆炸，比较直接用 `>=`/`<=`/`==`
3. **否定和嵌套用 Lua 原生语法**：`not`/`and`/`or` 比 `notT`/`andT`/`orT` 组合器直观，不用组合器
4. **辅助函数库精简到 13 个 `T.xxx` + 2 个 `cmd()`/`held()`**：只保留无参数简单布尔和输入

### 动画系统（第五章）

1. **动画和状态分离**：状态定义 anim 字段，setState 自动 changeAnim。可中途换动画
2. **animelemtime(N)==0 检测帧事件**：只触发一次，精确到 tick
3. **hitbox_active 控制生效**：动画 JSON 定义形状，状态控制何时生效（被取消时立刻关）
4. **帧事件表（数据驱动）**：事件列表写在 State.events 里，onUpdate 遍历触发
5. **Sprite Sheet 用 Quad**：love.graphics.newQuad 截取大图区域
6. **朝向翻转**：draw 的 x 缩放传 facing，碰撞框/发射点的 x 乘 facing

### 物理系统（第六章）

1. **locomotion 用 Physics=N + move_x**：位移由动画数据精确控制，防滑步。起步/停步的加减速由 move_x 自然实现
2. **非 locomotion 用 Physics=S/A**：攻击/被击用 VelSet + 摩擦力，跳跃用重力
3. **摩擦力按 moveType 区分**：I/H 加摩擦减速，A 不加（攻击速度精确控制）
4. **move_x 是位移不是速度**：等价于 PosAdd，直接加位置，不等价于 VelSet。每帧由动画数据控制
5. **localcoord 坐标系**：所有运算在 localcoord 下做，渲染时统一乘 scale，move_x 不用管缩放
6. **惯性系统**：空中状态切换不清零 vx，空中无摩擦力让惯性自然延续。地面有摩擦力让惯性逐渐消失。两者不同机制
7. **冲刺减速**：moveType=A 不受摩擦力，状态自己用 VelMul 控制减速（前N帧匀速、之后减速）
8. **击退用 move_x**：被击动画有 move_x（防滑步），不用速度+摩擦力
9. **落地摩擦力**：正常跳跃清零(velSet 0,0)，空中连段落地保留惯性(只清vy)或用move_x
10. **重力调参**：提供 calcJump(height, duration) 辅助函数从目标反推参数。config 支持基础参数+advanced子表
11. **可变重力**：上升 0.6 倍重力（飘），下落 1.5 倍重力（利落）。终端速度限制
12. **screenbound 可选**：鬼泣相机跟随，只在关卡边界限制

### 碰撞检测系统（第七章）

1. **AABB 矩形碰撞**：4 个条件判断重叠，简单高效
2. **坐标转换乘 facing**：朝向左时 x 和 w 翻转
3. **防止重复命中**：hit_targets 记录，每次攻击状态进入时清空
4. **pushbox 只对地面角色**（stateType=S）：空中角色不受 pushbox，可穿过小怪头顶
5. **踩怪用 jcbox vs jcbox**：小怪也有 jcbox（被踩判定），比 hurtbox 更灵活
6. **jcContact 和 moveContact 统一**：都是碰撞标记，-1 state 用 trigger entry 检测
7. **踩怪 JC 用 trigger entry**：jcContact + 按跳 → ChangeState(45)，和 MUGEN Jump Cancel 同一模式
8. **踩怪不是状态**：是事件标记 + trigger entry，不切专门状态
9. **JC不能连JC**：`prevStateNo ~= 45` 限制。允许攻击→JC→攻击→JC（中间有攻击），禁止JC→JC→JC（直接弹跳）
10. **取消不用时间 CD**：用帧条件(animElemtime) + prevStateNo + 次数限制，更精确
11. **JC 优先级**：踩怪JC(95) > 攻击JC(90) > 空中跳跃(50)
12. **弹反不用 jcbox**：弹反用专门状态 + hitbox（格挡框）/ReversalDef（第十章讲），jcbox 只用于踩怪

### 空中连段机制（第八章用）

查证结论：
- 鬼泣没有 MUGEN 的 juggle 点数系统
- **空中技能 CD**：每个空中技能一次滞空中只能用一次（如空中飞燕）
- **JC 踩怪重置 CD**：踩到敌人按跳跃，清空所有空中技能 CD 锁
- **基础空中连段不限次数**：A→A→A 可循环（只要不落地）
- **JC不能连JC**：prevStateNo != 45 限制，必须中间接攻击
- **不做 guard/防御**

---

## 已确认的设计决策（之前的待确认问题）

### A. locomotion 复杂性 ✅ 已在第六章实现

1. **起步/停步动画**：状态 5(起步)/20(行走)/21(跑步)/22(停步)，全用 Physics=N + move_x
2. **走 vs 跑**：摇杆推力 >0.8 或 Shift 键
3. **键盘方案**：Shift 跑步（已确认）
4. **加减速曲线**：move_x 在动画数据里设（起步从小到大，停步从大到小）

### B. onFrame vs onUpdate ✅ 已确认

- `onFrame`：-1 层，**外部输入**驱动（玩家按键 → ChangeState）。有 buf 参数。总调用（不管 ctrl）
- `onUpdate`：当前状态层，**内部时间**驱动（动画结束 → ChangeState）。无 buf 参数
- 保持分开设计

### C. 摩擦力归属 ✅ 已在第六章实现

- **move_x**：动画驱动位移（locomotion，Physics=N）
- **摩擦力**：引擎自动减速（被击击退/落地，Physics=S + moveType=I/H）
- **VelMul**：状态主动减速（冲刺/空中收招，onUpdate 里调）
- 三种机制不冲突，各管各的场景

---

## 每章验证目标

| 章 | 结束后能做什么 |
|---|---|
| 1 ✅ | 加载角色、显示动画 |
| 2 ✅ | 角色有状态机，能切状态（站/走/跳/落地），记录 prevStateNo |
| 3 ✅ | 状态里能用 sctrl 设速度、切动画、改变量（命名字段） |
| 4 ✅ | trigger 能判断"命中后取消""时间到切状态"（混合方式） |
| 5 ✅ | 动画正确播放、能在特定帧触发逻辑、Sprite Sheet 支持 |
| 6 ✅ | 角色能走/跑/跳，有起步停步(move_x防滑步)，惯性，冲刺减速，重力可调 |
| 7 ✅ | 攻击能检测命中、pushbox只推地面、踩怪(jcbox vs jcbox)、JC不能连JC |
| 8 ✅ | 命中有伤害/火花/气爆/划痕、有被击反应、空中技能CD+JC重置 |
| 9 ✅ | 命中有完整特效（火花/划痕/气爆/残影/飞行道具/Helper） |
| 10 ✅ | 有无敌帧、能霸体、能弹反(皇家护卫)、超必杀冻场+演出 |
| 11 ✅ | 完整 JC/DT魔人化(不同技能集)/武器切换(预输入)/连段评价/锁定 |
| 12 ✅ | 相机跟随/锁定居中/飞高拉远/震屏/微缩放/慢动作/缓动过渡 |
| 13 | 敌人会巡逻/追击/攻击/撤退，有 AI 决策 |
| 14 | 有多层视差背景，相机滚动 |
| 15 | 有血条/魔人槽/评价/锁定标记 UI |
| 16 | 有音效+战斗音乐随评价动态切换 |
| 17 | 图片缓存/内存管理/渲染优化 |
| 18 | 调试视图（碰撞框/FPS/状态信息） |
| 19 | 有关卡切换/剧情触发/Boss 战结构 |

---

## 章节依赖关系

```
Part 1+2（已完成）：
1(文件结构) → 2(状态) → 3(SCTRL) → 4(Trigger) → 5(动画)
→ 6(物理) → 7(碰撞) → 8(命中) → 9(特效) → 10(高级) → 11(鬼泣特色) → 12(相机)

Part 3（待写）：
13(敌人AI) ← 依赖 1-8（角色系统+战斗）
14(背景视差) ← 依赖 12（相机系统）
15(UI) ← 依赖 8(命中系统) + 11(评价系统)
16(音效) ← 依赖 8(命中系统) + 11(评价系统)
17(资源管理) ← 独立
18(调试系统) ← 依赖 7(碰撞框) + 12(相机)
19(关卡系统) ← 依赖 13(AI) + 14(背景)
```

---

## 待用户确认的问题

全部已确认 ✅

1. ~~locomotion 键盘方案~~：✅ Shift 跑步
2. ~~onFrame/onUpdate 是否保持分开~~：✅ 保持分开
3. ~~摩擦力归属~~：✅ 按 moveType 区分（I/H 加，A 不加）
4. ~~起步/停步动画~~：✅ 做（move_x 驱动）

---

## TODO

- [ ] **创建 Part 3 文档**：`mugen-character-for-love2d-beginners-part3.md`，写第 13-19 章
- [ ] **第13章 敌人 AI 系统**：巡逻/发现玩家/追击/攻击选择/撤退/决策间隔/MUGEN AIlevel
- [ ] **第14章 背景与视差滚动**：多层背景/视差速度/滚动边界/MUGEN stage系统
- [ ] **第15章 UI 系统**：血条/魔人槽/评价显示/锁定标记/菜单/布局
- [ ] **第16章 音效系统**：音效播放/音量/战斗音乐动态切换(评价影响)/MUGEN sound
- [ ] **第17章 资源管理与性能**：图片加载缓存/内存管理/对象池/渲染批处理/四叉树
- [ ] **第18章 调试系统**：碰撞框显示/FPS/状态信息/慢动作调试/命令行参数
- [ ] **第19章 关卡系统**：关卡切换/剧情触发/Boss战结构/存档/配置
- [ ] **统一文档目录**：input 文档（附录 A-F）+ Part 1（第1-5章）+ Part 2（第6-12章+附录A）+ Part 3（第13-19章）需要统一目录
- [ ] **附录统一**：各文档附录编号统一

3. **摩擦力归属**：按 moveType 区分（I/H 加摩擦，A 不加）？还是状态自己决定？
4. **起步/停步动画是否做**：鬼泣有，但增加状态机复杂度。推荐做（鬼泣手感关键）。

---

*最后更新：第二章完成后*
