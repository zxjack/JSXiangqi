# JSXiangqi 待办需求清单(老板 2026-10-04 列)

> **状态: 待老板审阅 → 分步实施**。本文件**不是代码改动**,只是把要做的需求固化下来。
> 本次会话内不做任何修改,等老板一一下指令。

---

## R1. 悔棋(Undo / Take-back)

**现状**:
- `Record.retractMove()` 空壳(`record.js`),作者留了钩子
- `game.js` line 6 `const stack = [];` 声明但**全项目无 push/pop**
- 控件面板:仅 New Game / Resign / Request Draw,**没有 Undo 按钮**

**候选设计(待老板选)**:
- (a) **只回退最后 1 步** — 最常见,简单
- (b) **任意步回退** — 复杂,需要历史记录侧栏
- (c) **两步制(正式规则)** — 落子方提请悔棋,对方同意则回退;拒绝则"让一步走两步"。代码量大

**老板待定**:选 a / b / c?

---

## R2. 将军(Check)提示

**现状**:
- `board.js` `isCheck(color)` 已实现(line 124),`isCheckMate(color)` 已实现(line 204)
- `game.js` line 235-249:走棋后检查,`checkText.innerHTML = "Check!"`
- ❌ **UI 残废**:`<h1>` 在 `top:150px left:1000px`,屏幕外或跟棋盘重叠
- ❌ **不区分哪一方被将军**(只写 "Check!",应该写 "红方被将军!" / "黑方被将军!")
- ❌ **样式丑**:无 color / 无背景

**修复点**:
- 把 `checkText` 从绝对定位、屏幕外位置,改成**居中、显眼**的横幅(顶部条 / 弹出条)
- 文案分中英文、区分红黑
- 走完棋时短暂高亮,几秒后淡出,或常驻直到下一步

---

## R3. 输赢判定 & UI

**现状**:
- `board.js` `isCheckMate()` 已实现
- `game.js` line 239-247 checkmate → `chessboard.status = false`
- line 242 `winner = ...` **算出来了但没显示**(dead variable)
- ❌ checkmate 后**没显示"XXX 获胜"** UI
- ❌ Resign / Draw handler 算了 winner 也**没显示**
- ❌ checkmate 后棋盘可能还能点击(待 verify)

**修复点**:
- checkmate / resign / draw 后**居中显示"红方胜!" / "黑方胜!" / "和棋"** banner
- checkmate 后**禁用棋盘点击**(`if (!chessboard.status) return`)
- banner 加 **"再来一局"** 按钮,直接 reset

---

## R4(待老板补充). 其他需求

老板原话:"**你全部记录之后分步骤统一修改**"—— 还会继续加需求。
等老板列完,在这里 append 新行 R4 / R5 / ...

---

## R5. 棋盘九宫 + 将帅走法(R5-1 ~ R5-4,老板 2026-10-04 列)

> 老板原话:"棋盘不够完善,特别是将,帅那个地方有没斜线"
> 
> 我读代码 + 象棋规则后,定位出 **4 个 bug**,一并归到 R5:

### R5-1 视觉:九宫斜线没画
**现状**:`style.css` 全文无 `palace / diagonal / .X` 类
**修复**:加 CSS,棋盘生成时给九宫对角线格子(黑方 row 0-2 col 3-5,红方 row 7-9 col 3-5)画 2 条对角线
**实现**:用 `<td>` 上的 `::before/::after` + `transform: rotate(±45deg)` 或者 `border-style` 画线
**预估**:style.css +15 行

### R5-2 规则 bug:将帅走出九宫
**现状**:`pieces.js` General.validateMove 只检查 `this.col != 3 / 5`(出发点列),**没检查 `newCol` 是否在 3-5**
**复现**:将帅在中列 4,横走到 col 0(出九宫),代码允许
**修复**:`if (newCol < 3 || newCol > 5) return false;` 加在 `checkMove` 入口
**预估**:pieces.js +3 行

### R5-3 规则 bug:白脸将军禁着缺失
**现状**:`isSuisideMove` 只检测"自己被将军",**没检测"落子后形成两将见面"**
**复现**:双方将帅同列无子 → 走任何让两将见面的子 = 应被禁(自动算被吃)
**修复**:`isSuisideMove` 调一个 `isFlyingGeneral(board)` helper
**预估**:board.js +8 行

### R5-4 规则 bug(顺手修):仕走出九宫
**现状**:跟 General 同样的越界问题(仕只能斜走在九宫 3×3)
**复现**:仕从九宫斜走到 col 4 row 5(出九宫)
**修复**:同样加 `newCol in 3..5 && newRow in 0..2 or 7..9` 限制
**预估**:pieces.js +6 行

---

## R4(注:R5 已挪到上面)

---

## 实施约束(老板潜在偏好,未明示但合理推测)

- **分步**:每完成一项跑一次 Playwright headless 验证渲染 + 棋盘行为
- **commit per feature**:每个 R 单独 commit,commit message 写明"(R1 悔棋)""(R2 将军提示)""(R3 输赢 UI)"等
- **不动 upstream 未污染过的逻辑**:只改需要改的文件,保留作者风格
- **不重写架构**:不引入 React / Vue,继续纯 vanilla JS
- **Caddy 服务持续可用**:改了文件无需重启,Caddy file-server 重新读盘

---

## 文件预计改动表(预估)

| 需求 | 文件 | 预估行数 |
|---|---|---|
| R1 悔棋 | `record.js` + `game.js` | +25 ~ +60 |
| R2 将军 UI | `game.js` + `style.css` | +30 ~ +50 |
| R3 输赢 UI | `game.js` + `style.css` | +20 ~ +40 |
| 总计 | 2-3 文件 | ~80 ~ 150 行 |

---

## 校验脚本

每完成一个 R,用 `/tmp/jsx_verify.cjs`(本会话已写)+ `vision_analyze` 截图,确认棋盘还能正常渲染。