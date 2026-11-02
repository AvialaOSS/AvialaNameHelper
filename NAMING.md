# 变量命名范式

Aviala design token 的权威命名契约。`src/grammar/` 实现本文档；两者冲突时，
以本文档为准，代码是错的。

范围：Aviala 设计系统里的 Figma 变量（Variable）——它们的名字、分组（group）、
集合（Collection）、模式（Mode）与作用域（Scope）。**Figma 下游的一切都不在
范围内。** 本文档不讨论已发布的 CSS 包、它的引用计数或它的选择器；早先草稿里
凡是靠 CSS 成本来论证某条规则的地方，那套论证已经删掉，规则要么站在 Figma
结构上成立，要么被标为待定决策。

证据：下面每一个计数和数值都测自 Figma _Components_ 文件的一次真实 dump
（Inspector 导出的快照）——167 个本地变量，分布在 5 个集合、8 个模式，外加
_Aviala Design Colors_ 库的 42 个外部变量。156 个值是别名（alias），143 个是
具体值；最大链深 2，无环，无未解析的别名目标，167 个本地变量没有一个对发布隐藏，
且它们的 `codeSyntax` 全为空。

全程适用两条限制。

其一，dump 是**单个文件的引用切片，不是设计系统的普查。** 那 42 个外部变量
只是 _Components_ 文件恰好引用到的部分，所以某个没出现在这份清单里的档位，
可能在远端库里存在、只是这个文件没用到。另外，跨集合别名解析出来的值会塌缩
到目标的*默认*模式，因此本文档里没有任何 Dark **hex** 是有实证的。Dark 的
**别名目标**有实证，而那才是要紧的一半：这个文件实现主题切换靠的是重新指向
别名，不是按模式存字面值，所以「Dark 指向哪一档」在这里是实测事实而非推断。
凡某个词表用词在 dump 里没有实例，[词表覆盖度](#词表覆盖度) 会明确说出来，
不让它冒充实测事实。

其二，**文件里没有任何变量带描述**——167 个里 0 个。Figma 里没有东西记录
一个值背后的意图，所以单位和极性只能从数字本身推断。这对 `transparency` 是
具体的麻烦：dump 说不出 `80` 是 80% 不透明还是 80% 透明。

还有一条书写约定贯穿全文：表格里的变量名默认写**目标名**，也就是范式生效后的
形状。例如主题改指那张表写的 `control/normal-lightBackground-1`，今天实际叫
`control/control-normal-lightBackground-1`。只有在明确标注「今天的名字」、或者
名字本身就是违规证据的地方，写的才是当前名。

全文的推导链另有一张图：[`MINDMAP.md`](./MINDMAP.md)。它是派生视图，按推导顺序
而非章节顺序排列，与本文冲突时以本文为准。

---

## 全局规则

1. **字符集与小驼峰** —— `a-z`、`A-Z`、`0-9`、`-`。不允许下划线、空格、点号。
   每个段（segment）以小写字母开头，段内的复合词用 camelCase 连接。所以
   `lightBackground` 合法，`LightBackground`、`lightbackground` 和
   `light-background` 都不是本范式的形状。
2. **分组必填，且分组就是命名空间前缀。** 每个变量都住在一个 Figma 分组里；
   分组的第一段说明这个变量属于哪一层。
3. **叶子不得重复分组。** 写 `border/error-primary`，不写
   `border/border-error-primary`；写 `borderRadius/big`，不写
   `borderRadius/borderRadius-big`。判定基准是整个分组名，不是它的第一截——今天
   `border-radius` 分组里的 `border-radius-allround` 重复的是 `border-radius`
   整体，而不只是 `border` 那一截。
4. **用单数。** `button`，绝不写 `buttons`。
5. **每个槽位都从封闭词表里取词。** 一个词在某个槽位合法，不等于在另一个
   槽位也合法。
6. **`-` 只用来分隔槽位，不用来分隔词。** 一个槽位内部的多个词按规则 1 合成
   camelCase。`color-button-noBackground-background-active` 是五个槽位，其中
   `noBackground` 是一个槽位里的两个词。

规则 1 和规则 6 是一对：前者规定词的写法，后者规定 `-` 的唯一含义。合起来它们
让名字仍然可被机器分段——见[规则 6 为什么存在](#规则-6-为什么存在)。

### 规则 3 为什么存在

在 Figma 里，分组不是一个到了叶子就消失的文件夹——它是名字的一部分，会出现在
变量面板里、出现在每个图层上的选择器里、也出现在从这个文件导出的任何东西里。
所以 `border/border-fail-primary` 在设计师遇到它的每一个地方都读作
「border，border fail primary」，而文件里 209 个变量中有 163 个是这么读的。
规则 3 是在源头去掉重复，而不是事后再补偿。

有两个 Figma 字段与命名相关，且今天都没被用上：

- **167 个变量的 `codeSyntax` 全为空。** 这是按平台的名字覆盖
  （`WEB` / `ANDROID` / `iOS`），Dev Mode 会显示它而不是原始名字。原则上它
  可以在不改名的情况下承载一个不同的导出拼写，那样规则 3 就变成可选的。本范式
  不走这条路：一个名字、处处通用，正是这份契约的要点。记在这里是为了说明这个
  选项是已知且被主动放弃的，不是被漏掉的。
- **167 个变量的 `hiddenFromPublishing` 全为 false。** 文件里每个变量都暴露给
  消费方文件，包括那 5 个带冲突后缀的重复项，和那 12 个表达式未知的 component
  变量。目前没有任何东西处于草稿私有状态。（那 42 个外部变量在 dump 里全报
  `true`，但这个文件确实消费了它们，而对发布隐藏的变量根本无法跨文件消费——所以
  那个 `true` 是读取远端变量时该字段没有意义的产物，不是它们真被隐藏了。）

### 规则 6 为什么存在

有两种把名字写扁的方式，都会毁掉分段能力，而分段能力正是 Validator 存在的
前提。

**全 kebab**（本文档早先的形状）把槽位边界和词边界压成同一个字符。它要求
`noBackground` 写成 `no-background`，于是 `color-button-no-background-background-active`
里 `background` 出现两次、身份不同（一次是 level 的一部分，一次是整个 role
槽位），只有靠封闭词表反查才能分开。

**全 camelCase** 更糟。把叶子整个驼峰化：

```
color-button-noBackground-background-active
  → colorButtonNoBackgroundBackgroundActive
```

实测这个名字所属的层：`semantic` 66 个叶子里 **66 个（100%）** 含两个以上段
边界，`component` 29 个里 **29 个（100%）**。全驼峰会把这些边界一次抹平，
`NoBackgroundBackground` 变成连续四个驼峰，无法判断第二个 `Background` 是另一个
槽位。全驼峰化后确实**不产生同名冲突**（0 组），所以它不是不可行——它只是让
名字不再能被解析，而这是把校验从「按槽位查」降级成「整名查字典」。

规则 6 取中间那条：`-` 是唯一的槽位分隔符，camelCase 是唯一的词分隔符。两个
字符各承担一件事，分段就仍是确定的。

**合并还是分开，由槽位表决定，不由词本身决定。** 同样两个词 `primary` +
`background`，在 `semantic` 的 `box` 里是**一个**槽位——文件今天写作
`box-theme-primaryBackground`；在 `component` 里是**两个**槽位——`level` 是
`primary`，`role` 是 `background`，必须写作 `primary-background`。两处都有实证，
所以判定一个连字符该不该去掉，必须先知道这个命名空间的槽位列表——这正是规则 5
的封闭词表要提供的东西。机械地对全文件做 camelCase 转换会把 component 的
`primary-background` 错误地合并掉。实测：把文件里全部 11 个 camelCase 词展开成
连字符对再逐名匹配，component 层误伤 **6** 个——3 个 `primary-background-*` 加
3 个 `secondary-background-default*`。

另一处机械转换会出错的地方：`box-normal-Background-blackOnly`。逐段降首字母
会得到 `background-blackOnly`，但按封闭词表 `black` 是 polarity 槽位、`only`
是 step 槽位，正确目标是 `background-black-only`。**词表优先于任何字符串变换。**

---

## 五个命名空间

| 命名空间    | 形状                                        | 值来自        | 集合                                           |
| ----------- | ------------------------------------------- | ------------- | ---------------------------------------------- |
| `palette`   | `{family}/{step}`                           | 字面值        | _Aviala Design Colors_（远端）                 |
| `semantic`  | `{use}/{tone}-{slot}`                       | palette 别名  | `semantic`                                     |
| `scale`     | `{category}/{step}`                         | 字面值        | `scaleDensity`、`scaleContrast`、`scaleStatic` |
| `component` | `{type}-{component}-{level}-{role}-{state}` | semantic 别名 | `component`                                    |
| `effect`    | `effect/{name}-{position}`                  | 字面值        | `effect`、`effectSwitch`                       |

命名空间是**名字的形状**；集合是**带一组模式的 Figma 容器**。两者正交，一个
命名空间可以摊在几个集合上——分组前缀已经承载了命名空间信息，所以拆开不会丢
东西。`scale` 跨三个集合，`effect` 跨两个。

集合名也遵循规则 1，因为它是同一批人读的同一类标识符。这一点文件自己已经在做：
今天五个集合叫 `colorSystem`、`componentVariables`、`fontWeight`、
`specialEffort`、`numbers`，前四个都是 camelCase。所以本文档早先提的
`scale-density` 这种写法反而是违背文件既有惯例的，改为 `scaleDensity`。
模式名（`Light`、`Mobile Friendly`、`High Contrast`）不受规则 1 约束——它们是
Figma 界面上的标签文字，不是标识符，保持标题式大小写。

## 集合与模式

关于 Figma 的三条事实决定了整个布局：

1. **模式属于集合，不属于变量。** 集合里的每个变量，在这个集合的每一个模式下
   都有一个值。给一个 30 变量的集合加第二个模式，就产生 30 个必须填的值单元格，
   哪怕这 30 个最后跟第一个模式完全一样。
2. **一个图层对每个集合只能绑定一个模式。** 所以一个集合承载**一条轴**。两条
   独立的轴——比如密度和对比度——无法共存于同一个变量，它们必须在不同的集合里。
3. **没有「把变量移到另一个集合」这个操作。** 你只能在目标集合里重建、再删掉
   原来的，而所有入边别名都会断。

事实 2 决定了集合数量的下限：每条不同的轴一个，再加一个给完全没有轴的变量。
事实 1 说不要超过这个下限，因为每多一个集合，设计师就要在每个 frame 上多设
一个模式。事实 3 决定了日后搞错的代价。

### 目标布局

| 集合                   | 今天                             | 轴       | 模式                      | 变量数    | 内含分组                                       |
| ---------------------- | -------------------------------- | -------- | ------------------------- | --------- | ---------------------------------------------- |
| _Aviala Design Colors_ | 远端库                           | theme    | Light / Dark              | 被引用 42 | `{family}`                                     |
| `semantic`             | `colorSystem`                    | theme    | Light / Dark              | 66        | `border` `box` `control` `text`                |
| `effect`               | `colorSystem` → `special-effort` | —        | Default                   | 5         | `effect`                                       |
| `effectSwitch`         | `specialEffort`                  | presence | ON / OFF                  | 5         | `effect`                                       |
| `scaleDensity`         | `numbers`（部分）                | density  | Default / Mobile Friendly | 27        | `size` `lineHeight` `borderRadius`             |
| `scaleContrast`        | `numbers`（部分）                | contrast | Default / High Contrast   | 5         | `transparency`                                 |
| `scaleStatic`          | `numbers`（部分）+ `fontWeight`  | —        | Default                   | 30        | `padding` `gap` `borderThickness` `fontWeight` |
| `component`            | `componentVariables`             | —        | Mode 1                    | 29        | `button`                                       |

八个集合，其中七个本地，今天本地是五个。66 + 5 + 5 + 27 + 5 + 30 + 29 = 167，
所以这个布局是对现有文件的重新划分，不是往里加东西。

**但这张表描述的是删除与合并之前的状态。** 表里的 `scaleDensity` 27 = `size` 11 +
`lineHeight` 9 + `borderRadius` 7，`scaleStatic` 30 = `padding` 12 + `gap` 8 +
`borderThickness` 4 + `fontWeight` 6，都是**今天**的数。8 个删除全落在 scale
（density 掉 5、static 掉 3），4 个合并全落在 component（29 → 25），所以词池收敛完是
66 + 5 + 5 + 22 + 5 + 27 + 25 = **155**。

于是本文档里其实有三个数，它们是三个不同时刻的本地变量总数，不要混用：

| 数      | 是什么时刻                                                                                                                        |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **226** | 换集合进行到一半。59 个搬运变量已经在新集合里重建，旧变量还留着当指向新变量的别名壳，以保住消费方（见成本模型）。167 + 59 = 226。 |
| **167** | 重新划分完成、别名壳已清除。**上面的目标布局表就是这个时刻**，也是「不加东西、只重排」那句话成立的前提。                          |
| **155** | 范式完全收敛，8 个删除与 4 个合并都做完了。                                                                                       |

顺序是 226 → 167 → 155。226 是过程态，不该长期停留；155 是终点；167 是那张表。

集合名永远不会进入变量名——进入的是分组——所以重命名集合是免费的。
`colorSystem` 改叫 `semantic`，是因为它从来没装过 `{family}-{step}` 颜色；
那些住在远端库里，它装的是语义层。

### 每个模式实际变化的是什么

有两种不同的机制在起作用，且不可互换。**颜色**变量换主题的方式是把别名重新
指向另一个 palette 档位；**数值**变量换主题的方式是持有一个不同的字面值。所以
「它用没用第二个模式」在不同集合里意思不一样：

| 集合（目标）    | 轴       | 变量数 | 使用情况       | 具体是哪些                                                                                                                                     |
| --------------- | -------- | ------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `semantic`      | theme    | 66     | **9 个改指**   | 全部 9 个都是 `normal` 色调：`border` 8 个里 3 个、`box` 21 个里 3 个、`control` 15 个里 3 个。`text` **21 个里 0 个**——实测结果，不是解析假象 |
| `effect`        | —        | 5      | **0**          | 4 个字面值两个模式完全相同；`lightEffort-top` 两边都指向 `primary/primary-3`                                                                   |
| `effectSwitch`  | presence | 5      | **5**          | ON 别名指向 `effect`，OFF 是 alpha 为 0 的字面值                                                                                               |
| `scaleDensity`  | density  | 27     | **8 个有差异** | `size` 的 tiny/small/regular/middle，`lineHeight` 是同样这四档。`borderRadius` 今天 7 个里 **0** 个——它的密度差异是待创作的                    |
| `scaleContrast` | contrast | 5      | **2 个有差异** | `active` 80→60、`hover` 50→60                                                                                                                  |
| `scaleStatic`   | —        | 30     | **0**          | —                                                                                                                                              |
| `component`     | —        | 29     | —              | 单模式                                                                                                                                         |

主题这条结论是整个文件里最结构性的发现。**theme 轴是由 `palette` 承载的，不是
由 `semantic`。** 五个彩色色调——`theme`、`success`、`warning`、`error`、
`info`——在 Light 和 Dark 下指向*同一个* palette 档位
（`border/theme-primary` 两边都是 → `primary/primary-8`），所以它们靠远端库
自己的模式继承主题切换，本地什么都不用做。只有 `normal` 会覆盖，而且覆盖方向
是一致的：

| 变量                               | Light 指向  | Dark 指向    |
| ---------------------------------- | ----------- | ------------ |
| `border/normal-1`                  | `neutral-3` | `neutral-4`  |
| `border/normal-2`                  | `neutral-4` | `neutral-5`  |
| `border/normal-3`                  | `neutral-5` | `neutral-6`  |
| `box/normal-background-white-1`    | `neutral-1` | `neutral-6`  |
| `box/normal-background-white-2`    | `neutral-2` | `neutral-5`  |
| `box/normal-background-white-3`    | `neutral-3` | `neutral-6`  |
| `control/normal-background-3`      | `neutral-6` | `neutral-10` |
| `control/normal-lightBackground-1` | `neutral-4` | `neutral-6`  |
| `control/normal-lightBackground-2` | `neutral-5` | `neutral-8`  |

九处改指，全部落在 neutral，全在 `border`/`box`/`control` 里——`text` 里一次
都没有。绝对色块（`background-black-only` → `neutral-14`、
`background-white-only` → `neutral-1`）正确地没有移动。

这就是 `effect` 不需要 theme 轴的原因。它里面没有任何东西改指，而唯一一个对
主题敏感的变量是通过引用 `primary/primary-3` 做到的，那个别名在上游自带模式。
给一个 5 变量的集合加 Light/Dark，换来的是五个空格子和每个 frame 上多一个开关；
模式随时可以后加而不需要重建任何东西，所以默认就是不加模式。

`numbers` 今天把全部 56 个变量放在一条 density 轴上，其中**10 个有变化**。因此
把一个 frame 切到 Mobile Friendly，会连带拖动 46 个对密度无话可说的变量，并且
为它们全部封死了任何其他轴——这正是 `transparency` 住在那里就没法变成
High Contrast 轴的原因。

### scale 的拆分线为什么落在这里

`size` 和 `lineHeight` 在**同样这四档**上移动——`tiny` `small` `regular`
`middle`，没有别的：

| 档位      | `size`  | `lineHeight` |
| --------- | ------- | ------------ |
| `tiny`    | 10 → 12 | 12 → 16      |
| `small`   | 12 → 16 | 16 → 20      |
| `regular` | 14 → 18 | 18 → 24      |
| `middle`  | 16 → 20 | 22 → 26      |

这是同一个决策表达了两次——小字号变大，行高跟着长——所以这两个类别应该在同一个
集合的同一条轴上。把它们拆开，等于让设计师永远要同步拨两个开关。

`borderRadius` 今天**没有**密度差异（7 个里 0 个）。给它加一个密度差异的决定
把它放上了 density 轴，所以它加入 `scaleDensity`，而不是独占一个集合。这里收到
过两条指令——「border-radius 单独一个集合」和「scale 按 mode 轴拆三个」——如果
「单独」的意思是*只有它一个*，两者就冲突。本文取*移出静态集合*这一读法，因为
在一条别的集合已经承载的轴上再开一个单类别集合，会多出第二个永远要拨到相同位置
的开关。但它不能留在静态类别里：给 `scaleStatic` 加一个 Mobile Friendly 模式会
产生 30 个值单元格——其中 24 个属于 `padding`、`gap`、`borderThickness` 和
`fontWeight`，这些完全没有密度行为——纯粹是为了陪一个类别。

如果本意真的是独占一个集合，日后改的代价是零：`borderRadius` 有 0 个入边别名，
再移一次不会断任何引用。

`transparency` 移出去，因为它的轴不是密度。见
[`scaleContrast`](#scalecontrast--transparency)。

`padding`、`gap`、`borderThickness` 和 `fontWeight` 没有模式差异，也没有说得通
的第二条轴，所以它们共用剩下的单模式集合。`fontWeight` 加入它们而不是继续独占
一个集合：它同样无轴，而单独一个集合会让那些根本不在里面设模式的 frame 多背
第三个开关。

### 拆分的成本

按事实 3，代价就是被移动对象的入边别名数。实测：

| 被移动的                                             | 变量数 | 入边别名      | 成本                            |
| ---------------------------------------------------- | ------ | ------------- | ------------------------------- |
| `numbers` → 三个集合                                 | 56     | **0**         | 免费                            |
| `fontWeight` → `scaleStatic`                         | 6      | **0**         | 免费                            |
| `colorSystem` → `special-effort` 分组移出到 `effect` | 5      | **5**         | 从 `effectSwitch` 重指 5 个别名 |
| `colorSystem` 余下部分 → `semantic`                  | 66     | 0（仅重命名） | 免费                            |

`numbers` 和 `fontWeight` 里没有任何变量在文件中被当作别名目标，所以整个 scale
拆分在 Figma 内部是免费的。文件的 156 个别名值单元格只指向两个地方，拆分把它们
重新分配：

| 直接边                                 | 今天的单元格数 | 拆分后                           |
| -------------------------------------- | -------------- | -------------------------------- |
| `colorSystem` → _Aviala Design Colors_ | 134            | `semantic` 出 132，`effect` 出 2 |
| `componentVariables` → `colorSystem`   | 17             | 17 → `semantic`（不动）          |
| `specialEffort` → `colorSystem`        | 5              | 5 → `effect`（**重指**）         |
| 进入 `numbers` / `fontWeight`          | **0**          | 0                                |

只有 `specialEffort` 那一行有成本：5 个单元格要重指，而且重指的是同样这些值、只是
换了个家。最后一行的 0 是整节最要紧的数字——它说明 scale 拆分在 Figma 内部完全不
花钱。

**重命名全程免费。** Figma 别名绑定的是变量 ID，不是名字，所以 `fail` → `error`、
`infomation` → `info`、给叶子去重、把分组从 `line-height` 改成 `lineHeight`，都
不会断文件里的任何别名。下游消费已发布库的东西按决策不在范围内，这里不计。

---

## 命名空间规格

### palette

`{family}/{step}`。本文件引用到 42 个变量。

- **family**（封闭，6 个）：`primary` `success` `warning` `error` `info` `neutral`
- **step**：整数。彩色系 1–12，`neutral` 1–14。

今天每个叶子都把 family 重复了一遍：`error/error-10`、`neutral/neutral-13`。
规则 3 在这里和别处一样适用，目标是 `error/10`、`neutral/13`。

这是唯一一个 _Components_ 文件修不了的命名空间。42 个全部是 `remote: true`，
来自 _Aviala Design Colors_ 库，所以在这里是只读的——去重必须在源文件里做，
然后重新发布。它同时是整个别名图的根：文件 156 个别名值单元格里有 134 个指向它，
effect 分组移出后其中 132 个来自 `semantic`。

family 和 step 都是单词，所以这个命名空间里没有 camelCase 的问题。

### semantic

`{use}/{tone}-{slot}`。66 个变量——今天 71 个，减去移去 [`effect`](#effect) 的
那 5 个 `special-effort` 变量。

这是别名图的枢纽。它向上送出 132 个别名单元格进 `palette`，向下从 `component`
收回 17 个；它自己有 8 个变量是别名目标。系统里每一种颜色都通过这一层抵达字面
值，所以 theme 轴（Light / Dark）必须住在这里。

- **use**（封闭，4 个）：`border` `box` `control` `text`
- **tone**（封闭，6 个）：`theme` `normal` `success` `warning` `error` `info`

`slot` 有两种子形状，因为 `normal` 是分级的，而其他每个色调只有单一强度。这种
不对称是真实存在的、不是意外，范式保留它。

**色调槽位** —— tone ∈ `theme` `success` `warning` `error` `info`：

| use       | slot                     | 封闭词表                                                                                    |
| --------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| `border`  | `{intensity}`            | `primary`                                                                                   |
| `box`     | `{intensity}Background`  | `light` `primary` `secondary` → `lightBackground` `primaryBackground` `secondaryBackground` |
| `control` | `{background}`           | `background` `lightBackground`                                                              |
| `text`    | `{intensity}-{polarity}` | intensity `light` `primary` `secondary`；polarity `black`                                   |

**中性槽位** —— tone = `normal`：

| use       | slot                           | 封闭词表                                                                                                   |
| --------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `border`  | `{step}`                       | `1` `2` `3`                                                                                                |
| `box`     | `background-{polarity}-{step}` | polarity `black` `white`；step `1` `2` `3` `only`                                                          |
| `control` | `{background}-{qualifier}`     | `background-3`、`background-black-only`、`background-white-only`、`lightBackground-1`、`lightBackground-2` |
| `text`    | `{role}-{polarity}`            | role `text` `title` `caption`；polarity `black` `white`                                                    |

注意 `{intensity}Background` 是**一个**槽位，而 `{intensity}-{polarity}` 是**两
个**。同样是「形容词 + 名词」，前者合成 camelCase，后者用 `-` 分开，区别只在于
槽位表怎么划。这不是可以靠看名字推出来的，必须查表——规则 6 的代价就在这里，
换来的是分段确定。

两张表里贯穿着同一处倒置，这也是范式在槽位顺序上唯一内部不对称的地方：`box`
和 `control` 在色调槽位里把 `background` 放在**最后**（`lightBackground`、
`secondaryBackground`），却在中性槽位里放在**最前**（`background-black-1`、
`background-white-only`）。整体读下来，`box-theme-lightBackground` 回答的是
「哪一种背景」，而 `box-normal-background-black-1` 回答的是「哪个背景，然后是
它的哪个变体」。camelCase 反而把这层区别写得更清楚了：`lightBackground` 看得出
是一个复合概念，`background-black-1` 看得出是三段。按实测保留；把它拉平要为了
纯粹的一致性重命名全部 36 个 `box`（21）和 `control`（15）变量。

**色调词决定 palette 家族，没有例外。** 66 个全都是别名，映射是 1:1 的：

| tone         | 指向        | 变量数 |
| ------------ | ----------- | ------ |
| `theme`      | `primary`   | 9      |
| `normal`     | `neutral`   | 21     |
| `success`    | `success`   | 9      |
| `warning`    | `warning`   | 9      |
| `fail`       | **`error`** | 9      |
| `infomation` | **`info`**  | 9      |

六个里有两个跟它指向的家族不一致。这正是下面这些重命名属于结构性而非风格性的
原因。

除规则 3 之外，这强制的重命名有：

- `fail` → `error`（9 个变量）。这 9 个全部指向 `error` 家族。这一层是文件里
  唯一说 `fail` 的地方。
- `infomation` → `info`（9 个变量）。这 9 个全部指向 `info` 家族，上游拼写是对
  的。这个拼写错误也是 tone 词表看起来有七个词的原因。
- **段首大写降为小写：14 个变量。** `Background` 作为独立槽位时段首不能大写，
  所以 `box-normal-Background-black1` → `box-normal-background-black-1`、
  `control-theme-Background` → `control-theme-background`。注意这里同时修了两件
  事：`Background` 的大小写，和 `black1` 里粘住的数字（`black` 是 polarity、
  `1` 是 step，必须分开）。
- **`lightBackground` 等 camelCase 保持原样。** 本文档早先要求把 25 个含 camelCase
  复合词的名字拉平成 `light-background` 这种形状，那条决定已撤销。属于本命名空间的
  是 22 个：`box` 的 15 个（5 个色调 × `lightBackground`/`primaryBackground`/
  `secondaryBackground`）和 `control` 的 7 个；另外 3 个是 `special-effort` 的
  `se-lineShadow-*`，它们属于 [`effect`](#effect)。（39 这个数字是 `colorSystem`
  里所有含大写的变量，其中 14 个只是 `Background` 段首大写，没有复合词可拉平，已由
  上一条处理。）
- `text/normal-text-caption-black` → `text/normal-caption-black`。`role` 是
  `caption`；多出来的 `text-` 是叶子在往下一层重复它的分组。
- `normal-background-theme`（无分组）→ **删掉或改名**。它在 Light _和_ Dark 下
  都指向 `neutral/neutral-3`，所以它是唯一一个不改指的 `normal` 色调变量。这使它
  在 Light 下与 `box/normal-background-white-3` 完全重复，在 Dark 下与之分道
  ——box 那个变量移到 `neutral-6`，这个不动。它的名字说 `theme`，它的行为却是
  主题无关的。不管它是干什么用的，它不是这个。

那 5 个 `special-effort` 变量是 **`colorSystem` 里唯一不属于「色调 → 家族」别名
的内容**——四个是字面颜色，第五个直接指向 `primary/primary-3`，跳过了语义层。
这就是它们移去 [`effect`](#effect) 而不是原地改名的原因：它们走了以后，
`semantic` 里只剩 `{use}/{tone}-{slot}` 形状的名字，上面那条 1:1 规则也没有例外
要列了。

### scale

`{category}/{step}`。62 个变量——今天 `numbers` 里 56 个、`fontWeight` 里 6 个
——按 mode 轴摊到三个集合：

| category          | 变量数 | 集合            | 用到第二个模式        | 今天的 Figma 作用域      |
| ----------------- | ------ | --------------- | --------------------- | ------------------------ |
| `size`            | 11     | `scaleDensity`  | 11 个里 4 个          | `FONT_SIZE,WIDTH_HEIGHT` |
| `lineHeight`      | 9      | `scaleDensity`  | 9 个里 4 个           | **`ALL_SCOPES`**         |
| `borderRadius`    | 7      | `scaleDensity`  | 7 个里 0 个（待创作） | `CORNER_RADIUS`          |
| `transparency`    | 5      | `scaleContrast` | 5 个里 2 个           | **`ALL_SCOPES`**         |
| `padding`         | 12     | `scaleStatic`   | —                     | `GAP`                    |
| `gap`             | 8      | `scaleStatic`   | —                     | `GAP`                    |
| `borderThickness` | 4      | `scaleStatic`   | —                     | `STROKE_FLOAT`           |
| `fontWeight`      | 6      | `scaleStatic`   | —                     | `FONT_WEIGHT`            |

- **category**（封闭，8 个）：上面这八行。

四个复合类别名按规则 1 从 `line-height`、`border-radius`、`border-thickness`、
`font-weight` 改为 camelCase，涉及 20 个变量的分组。`fontWeight` 尤其没有争议
——它今天要搬进去的那个集合本来就叫 `fontWeight`。

`step` 不是一套词表。类别有三种，每种有自己的 step 规则。

#### 1. 度量类 —— 共享词池

`size` `padding` `lineHeight` `borderRadius` `borderThickness` 从同一个全序里
取词：

```
none < min < tiny < small < regular < middle < big < large < huge < max
```

十个词全是单词，所以词池本身不涉及 camelCase。两条规则让它成立：

- **每个类别取一个保序子集**，不是连续的一段。`borderThickness` 用 `none`
  `regular` `middle` `large`，跳过 `none` 和 `regular` 之间的四个词，因为它的值
  是 0/1/2/3，而把一条 3 单位的边框叫 `small`，会误描系统里最重的边框。
- **比较级 `-er` 后缀废除。** 它们今天在不同类别里意思相反：`padding/tinyer`（3）
  比 `padding/tiny`（4）_更小_，而 `size/huger`（34）比 `size/huge`（30）_更大_。
  一个词缀扛不了两个方向。

`big < large` 保留。它对着英语读是反的，但在 `size`（20 < 26）、`padding`
（14 < 18）和 `borderRadius`（12 < 16）上保持一致，所以它是这个系统既定的约定，
不是错误。

**`default` 不在词池里，而有两个存活的档位就叫这个名字。** `padding/default`
（值 8）夹在 `small`（6）和 `middle`（10）之间，`borderThickness/default`（值 1）
夹在 `none`（0）和 `middle`（2）之间。这个位置的词池用词是 `regular`，所以两个
都改成 `regular`。只有这 2 个变量——`component` 层里 7 个以 `-default` 结尾的
名字是 `state` 槽位在正常取词，与此无关，不要动。这是第三种变更——既不是废除
`-er`，也不是删档——而且它动的是存活者，所以免费。

`borderRadius` 另外有一个终结词——今天叫 `allround`，值 99——它不是刻度上的
一档，而是「没有档」。

按真实数值测算的收敛：

| category          | 现在的档数 | 之后   | 被删               |
| ----------------- | ---------- | ------ | ------------------ |
| `borderRadius`    | 7          | 7      | —                  |
| `borderThickness` | 4          | 4      | —                  |
| `lineHeight`      | 9          | 7      | 34、44             |
| `size`            | 11         | 8      | 22、24、34         |
| `padding`         | 12         | 9      | 3、5、7            |
|                   | **43**     | **35** | **删 8 档（19%）** |

这 8 个是 `size/semilarge` 22、`size/semilarger` 24、`size/huger` 34、
`lineHeight/semilarge` 34、`lineHeight/max` 44、`padding/tinyer` 3、
`padding/smaller` 5、`padding/littleSmall` 7。被删掉的都是拥挤区间里的单位增量：
`padding` 丢掉 2 到 8 之间的奇数值，`size` 丢掉 `big`（20）和 `large`（26）之间
的三档。

注意 `semilarge` 和 `littleSmall` 今天就是连写的——前者该是 `semiLarge`，后者已经
是 camelCase。两者都要被删，所以这个不一致不会留下来；但如果日后要恢复半档，
写法是 `semiLarge`。

`borderRadius/allround`（99）变成 `borderRadius/full`。这是本节里唯一一个改词
而不是删词的重命名，且免费。

**重命名存活者不花任何代价。删掉这 8 个要花，而这份 dump 定不出价。** Figma
别名绑的是变量 ID，所以上面每一个重命名对别名图都是隐形的——何况 `numbers`
本来就有 0 个入边别名。但一个变量还会被图层*直接*绑定：某个 frame 的圆角、某个
文本样式的行高。Inspector dump 的是变量及其别名，不是图层绑定，所以「0 入边
别名」不是「0 处使用」的证据。这 8 个里任何一个被删之前，都必须先在 Figma 自己
的使用视图里逐个查过。这是文档里唯一一个已知存在、却无法用手上证据量化的成本。

#### 2. 场合类 —— `gap`

`gap` 是**故意被排除在词池之外**的。它的档位是 `none` `inside` `insideSpace`
`componentSpace` `contentSpace` `blockSpace` `chapterSpace` `pageSpace`
（0/4/6/8/10/14/18/24）。这些词说的是*空间用在哪里*，不是它有多大，而这正是这个
类别存在的全部理由。它八个值里有六个和 `padding` 重合，所以把它压进词池会留下
八个描述尺寸的名字，同时丢掉用法指引。

封闭词表，8 个词；其中 6 个今天写作 `block-space` 这种连字符形式，按规则 1 合并
为 camelCase。`none` 和 `inside` 不变。

#### 3. 枚举类 —— `fontWeight`、`transparency`

两个都不是刻度，两个都不从词池取词。

`fontWeight`（封闭，6 个，有序）：`light` `semilight` `regular` `medium`
`semibold` `bold`，值为 300/350/400/500/600/700——单调，所以名字里的顺序和数字
的顺序一致。6 个当前都无分组，必须获得 `fontWeight` 分组。它们没有模式差异，
也没有说得通的第二条轴，所以落在 `scaleStatic`。

六个档位名都是单词。`semilight` 和 `semibold` 今天就是连写的，按规则 1 它们该是
`semiLight` 和 `semiBold`——这与被删掉的 `semilarge` 是同一个问题，只是这三个
存活。

#### scaleContrast — transparency

`transparency`（封闭，5 个）：`loading` `disabled` `placeholder` `hover`
`active`。`disable` 改名为 `disabled`，与 `component` 命名空间用的状态词保持
一致。五个都是单词。

这是文件里唯一一个第二模式**不是**密度的类别，所以它拿到自己的集合，模式为
`Default` / `High Contrast`。

| 档位          | Default | 今天的第二个模式 | High Contrast |
| ------------- | ------- | ---------------- | ------------- |
| `active`      | 80      | 60               | _待定_        |
| `hover`       | 50      | 60               | _待定_        |
| `disabled`    | 55      | 55               | _待定_        |
| `loading`     | 60      | 60               | _待定_        |
| `placeholder` | 60      | 60               | _待定_        |

第二列是 `numbers` 当前在 _Mobile Friendly_ 下持有的值，**其中没有任何一条应该
被搬过来。** 它有两个问题：

- `active` 80 → 60 和 `hover` 50 → 60 是**收敛**的。不管这条轴是什么，一个把
  30 点跨度压成单一值的模式不是在调对比度——它是在抹掉两个反馈状态之间的区分。
  在 High Contrast 下这个区分应该拉大，而不是合拢。
- 另外三个完全不动，所以这个模式当前只对五个变量里的两个说了话。

**这个数值的极性没有任何地方记录。** 文件里没有变量带描述（167 个里 0 个），
所以没有任何东西说明 `80` 是 80% 不透明还是 80% 透明——而 High Contrast 调整的
方向完全取决于此。定下这件事是填完待定列的前提，而且值得直接写进变量描述里、
不只写在本文档，因为 Figma 现在是唯一的来源。

不靠它也能说的是：`hover` 和 `active` 是反馈状态，在 High Contrast 下反馈必须
保持可感知，所以两者都应该*远离*静息值而不是互相靠近。`disabled` 是相反的情况
——它必须看起来仍然是禁用的，所以不该动太多。`loading` 和 `placeholder` 在
Default 下都是 60，这与 [两个名字一个值](#已知例外与延后工作) 是同一个缺陷。

### component

`{type}-{component}-{level}-{role}-{state}`。29 个变量。

- **type**（封闭，7 个）：`color` `transition` `animation` `font` `size` `radius`
  `space`
- **component**：单数，段首小写。`Button` → `button`。
- **level**：组件自己的变体名（`primary`、`secondary`、`tertiary`、
  `noBackground`、`outline`，以及 `noBackgroundCustom`、`outlineCustom`）。
- **role**（封闭，2 个）：`background` `text`
- **state**（封闭）：`default` `hover` `active` `disabled` `selected` `checked`
  `focus`
- 当 `role` 是 `text` 时，最后一个子槽位指明目标：`text` 或 `caption`。

**这一层在新范式下几乎不用动。** 实测：29 个变量里 **25 个叶子逐字不变**，全部
29 个都受影响的地方只有一个——分组 `Button` 降为 `button`。

剩下 4 个不是改名能解决的。`color-button-secondary-background-default 2` 和 ` 3`
（`tertiary` 同样两个）带着 Figma 的冲突后缀，而后缀**不能直接去掉**：去掉之后
三个会同叫 `secondary-background-default`。更根本的是，它们本来就指向同一个别名
目标——`secondary` 三个都是 `VariableID:1904:2014`，`tertiary` 三个都是
`1904:2018`。它们是同一个变量的三份拷贝，不是三个档位。

所以这 4 个要的是合并（每组留一个、删两个），属于身份丢失操作，价格定不出来，按
决策与 Button 层其余的功能缺陷一起延后——见
[已知例外与延后工作](#已知例外与延后工作)。它们不计入下面的改名数。

`level` 的三个 camelCase 词 `noBackground`、`noBackgroundCustom`、`outlineCustom`
**保持原样**，涉及 11 个变量。本文档早先要求把它们改成 kebab-case，那条决定已撤销
——它们今天就是正确写法，叶子一个字都不用动。

`role` 是当前名字已经承载、但旧的四槽位 grammar 无处安放的槽位，这也是
`color-button-noBackground-background-active` 只能靠丢段来解析的原因。规则 6 下
它是五个槽位里清清楚楚的第四个。

dump 对这一层的说明，全部是 Figma 侧的：

- **它是别名图的叶子。** 0 个入边别名——文件里没有任何东西指向这 29 个中的任何
  一个。它送出 17 个别名单元格进 `semantic`，别处一个都没有。
- **29 个里有 12 个根本不是别名**，而是 dump 读不出来的变量表达式。17 + 12 = 29，
  所以这一层恰好是两种值，没有别的。
- **单模式**，名为 `Mode 1`。它没有轴，里面没有变量改指。
- **29 个全部带 `ALL_SCOPES`**，尽管它们是给按钮背景和按钮文字用的颜色。
- 分组是 `Button`，PascalCase，是全文件 43 处段首大写里的 29 处。

### effect

`effect/{name}-{position}`。10 个变量，分**两层，不是一套重复**——早先对这一层的
读法是错的：

| 层     | 集合           | 模式     | 变量数 | 值                                              |
| ------ | -------------- | -------- | ------ | ----------------------------------------------- |
| 值层   | `effect`       | Default  | 5      | 4 个字面值 + 1 个指向 `palette` 的别名          |
| 开关层 | `effectSwitch` | ON / OFF | 5      | ON 别名指向对应的值；OFF 是 alpha 为 0 的字面值 |

`specialEffort` 并没有重复 `colorSystem` 的那五个值——它*引用*它们，并加上把它们
关掉的能力。把两者合成一个集合本来也不可能：开关需要一条 ON/OFF 轴而值不需要，
而一个集合承载一条轴。

- **name**（封闭，2 个）：`lightEffort` `lineShadow`
- **position**（封闭，4 个）：`top` `bottom` `bottomDeep` `all`

`lineShadow` 和 `bottomDeep` 今天已经是这个写法了——文件里 3 个变量就叫
`lineShadow-all`、`lineShadow-bottom`、`lineShadow-bottomDeep`。本文档早先要求
把它们改成 `line-shadow-bottom-deep`，那条决定已撤销。要改的只有另外 4 个：
`light-effort-top`、`light-effort-bottom`，以及值层那两个带 `se-` 前缀的同名项。

两层取同样的名字，因为它们是同五个效果、从开关的两侧看过去。合并后两组都叫
`effect/lightEffort-top`、`effect/lineShadow-bottomDeep` 等等，分别住在 `effect`
和 `effectSwitch` 两个集合里——Figma 允许不同集合里的变量同名，靠集合区分。
**绑 `effectSwitch`，永远不要绑 `effect`**——直接绑到值上正是让 OFF 模式静默
失效的原因。`se-` 缩写前缀去掉，`special-effort` 分组名变成 `effect`。

这一层实测到的缺陷：

- `lightEffort-bottom` 是 `#fefcfc`，**两个模式下 alpha 都是 0**。它在 ON 时就是
  不可见的，这使它跟自己的 OFF 状态无法区分。要么值错了，要么变量错了。
- OFF 的字面值在色相上不一致。`lineShadow-*` 的 OFF 是 `#000000` @ alpha 0，与
  ON 的色相一致；`lightEffort-*` 的 OFF 是 `#ffffff` @ alpha 0，而 ON 是
  `#ffd9cf` 和 `#fefcfc`。alpha 0 时两种都不显示，但在这一层长大之前应该选定
  其中一种约定。

---

## 词表覆盖度

一套列着无人使用之词的封闭词表，是在规定意图，不是在描述现实。这里把两者分开，
以免日后有人把一个无实证的词读成「系统已经这样运作了」的证据。

| 词表                     | 声明 | 有实证 | 备注                                                                                                          |
| ------------------------ | ---- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `palette` family         | 6    | **6**  | 完整                                                                                                          |
| `palette` 彩色 step      | 1–12 | 7      | 本文件只引用到 2、3、4、5、7、8、10；1、6、9、11、12 在*这里*无实证，上游可能存在                             |
| `palette` neutral step   | 1–14 | 11     | 7、9、12 未被本文件引用                                                                                       |
| `semantic` use           | 4    | **4**  | 完整                                                                                                          |
| `semantic` tone          | 6    | **6**  | 六个都存在，其中两个名字是错的（`fail`、`infomation`）                                                        |
| `semantic` box intensity | 3    | **3**  | `lightBackground` `primaryBackground` `secondaryBackground`                                                   |
| `semantic` text role     | 3    | **3**  | `text` `title` `caption`                                                                                      |
| `semantic` box 中性 step | 4    | **4**  | 四个词都有实例，但只在 `white` 下齐全；`black` 只有 `1` 和 `only`，所以 `black-2`、`black-3` 这两个组合无实证 |
| `scale` category         | 8    | **8**  | 完整                                                                                                          |
| 词池                     | 10   | **10** | 每个词至少被一个类别用到，但没有类别用满十个                                                                  |
| `gap` 场合               | 8    | **8**  | 完整；6 个需合并为 camelCase                                                                                  |
| `fontWeight`             | 6    | **6**  | 300/350/400/500/600/700，单调；`semilight`/`semibold` 需改 `semiLight`/`semiBold`                             |
| `transparency`           | 5    | **5**  | 五个都存在；第二个模式里只有 `hover` 和 `active` 动                                                           |
| `component` type         | 7    | **1**  | 只有 `color`。`transition` `animation` `font` `size` `radius` `space` 在任何地方都没有实例                    |
| `component` level        | 7    | **7**  | 完整，且 3 个本来就是 camelCase                                                                               |
| `component` role         | 2    | **2**  | 完整                                                                                                          |
| `component` state        | 7    | **3**  | 只有 `default` `hover` `active`。`disabled` `selected` `checked` `focus` 无实证                               |
| `effect` name            | 2    | **2**  | 完整；`lightEffort` 今天写作 `light-effort`                                                                   |
| `effect` position        | 4    | **4**  | 完整，`bottomDeep` 已是 camelCase                                                                             |

两行稀薄的都在 `component`，而它同时是别名图的叶子——文件里没有任何东西指向它那
29 个变量中的任何一个。这与「为某一个组件、某一种属性类型草草画了一层，然后没有
继续扩展」是一致的。它七个 `type` 词里有六个是愿望。它们留在范式里，因为形状终归
要容纳它们，但目前没有任何证据支持，尤其 `transition` / `animation` 会需要一种
当前没有变量示范过的值形状（时长、缓动）——那 12 个读不出来的表达式是这种形状
存在的唯一线索，而它们读不出来。

---

## 作用域

变量的作用域是 Figma 允许它被应用到哪些属性上。它是变量定义的一部分，不能从名字
推出来，而范式必须把它定死——否则两个名字完全相同的变量可以在选择器里表现不同。

167 个变量上的实测：

| 作用域状态                   | 变量数        |
| ---------------------------- | ------------- |
| `ALL_SCOPES` —— 完全无约束   | **84**（50%） |
| 已收窄，且对该类别是正确的   | 62            |
| 已收窄，但比该类别需要的更宽 | 21            |

作用域枚举值（`ALL_SCOPES`、`FONT_SIZE` 等）是 Figma API 的常量，全大写下划线，
不受规则 1 约束——规则 1 管的是设计师写的名字，不是 API 的字面量。

半个文件没有作用域约束。漂移是**组内**的，这正说明它是意外而不是策略：

- `box` —— 15 个变量在 `ALL_SCOPES`，6 个在 `FRAME_FILL,SHAPE_FILL`。同一个
  分组、同一份工作、两种设置。
- `control` —— 7 个在 `ALL_SCOPES`，8 个在 `FRAME_FILL,SHAPE_FILL,TEXT_FILL`。
- `border` —— 全部 8 个在 `ALL_SCOPES`，所以一个边框颜色今天可以被应用到文字
  填充上。
- `numbers` —— 每个度量类别的作用域都是对的（`size` → `FONT_SIZE,WIDTH_HEIGHT`，
  `padding` 和 `gap` → `GAP`，`borderRadius` → `CORNER_RADIUS`，
  `borderThickness` → `STROKE_FLOAT`，`fontWeight` → `FONT_WEIGHT`），除了
  `lineHeight` 和 `transparency`，这两个都在 `ALL_SCOPES`。

按命名空间和类别的必需作用域：

| 命名空间 / 类别           | 必需作用域                                                                      | 今天                              | 待修            |
| ------------------------- | ------------------------------------------------------------------------------- | --------------------------------- | --------------- |
| `semantic` `border`       | `STROKE_COLOR`                                                                  | `ALL_SCOPES`                      | 8               |
| `semantic` `box`          | `FRAME_FILL,SHAPE_FILL`                                                         | 混杂                              | 15              |
| `semantic` `control`      | `FRAME_FILL,SHAPE_FILL,TEXT_FILL`                                               | 混杂                              | 7               |
| `semantic` `text`         | `TEXT_FILL`                                                                     | `FRAME_FILL,SHAPE_FILL,TEXT_FILL` | 21              |
| `semantic`（无分组）      | —                                                                               | `ALL_SCOPES`                      | 1，改为直接删掉 |
| `effect` 值层             | `lineShadow` 用 `EFFECT_COLOR`，`lightEffort` 用 `ALL_FILLS`                    | `ALL_SCOPES`                      | 5               |
| `effectSwitch`            | 与 `effect` 相同                                                                | `ALL_SCOPES`                      | 5               |
| `scale` `size`            | `FONT_SIZE,WIDTH_HEIGHT`                                                        | 正确                              | —               |
| `scale` `lineHeight`      | `LINE_HEIGHT`                                                                   | `ALL_SCOPES`                      | 9               |
| `scale` `padding`、`gap`  | `GAP`                                                                           | 正确                              | —               |
| `scale` `borderRadius`    | `CORNER_RADIUS`                                                                 | 正确                              | —               |
| `scale` `borderThickness` | `STROKE_FLOAT`                                                                  | 正确                              | —               |
| `scale` `fontWeight`      | `FONT_WEIGHT`                                                                   | 正确                              | —               |
| `scale` `transparency`    | `OPACITY`                                                                       | `ALL_SCOPES`                      | 5               |
| `component`               | `role` 是 `background` 时用 `FRAME_FILL,SHAPE_FILL`，是 `text` 时用 `TEXT_FILL` | `ALL_SCOPES`                      | 29              |
| `palette`                 | 在库里于上游设定                                                                | 本文件看不到                      | —               |

其中两条是从名字推出来的，不是独立选择。`component` 已经带一个 `role` 槽位，其
封闭词表恰好是 `background` 和 `text`，所以作用域是名字已经声明的槽位的函数。
`scale` 的 category 同样是封闭的 8 词词表，其中六个已经作用域正确——两个例外正是
不指名几何量的那两个类别（`lineHeight`、`transparency`），这很可能就是它们被留在
默认值上的原因。

作用域改起来是免费的：它是变量的属性，不是它的身份，所以收窄它不断任何别名、
不需要重建。但它**不会**把既有的误用暴露出来。插件 typings 的原话是：设置 scopes
「does not prevent that variable from being bound in other scopes (for example, via
the Plugin API). This only limits the variables that are shown in pickers within the
Figma UI」——它只决定 Figma UI 的选择器里展示哪些变量，既不阻止绑定，也没有任何一句
说会给既有绑定打标记。所以一个当前把 `border` 颜色绑到文字填充上的图层，收窄之后
**照旧绑着、照旧渲染**，只是下次打开选择器时它不再被推荐。

要找出这些误用，只能自己遍历图层绑定逐个比对——这正是迁移工具普查那一层的职责，
不能指望 Figma 代劳。收窄仍然值得做，因为它拦得住*新的*误用被顺手选出来；修复也
仍然应该按分组逐个做而不是全文件一次过，只是驱动它的证据来自普查结果，不是来自
Figma 的标记。

---

## 这会改变什么

在全部 209 个变量（167 本地 + 42 外部）上实测：**没有一个在完整范式下是完全干净
的**。197 个需要改名，8 个需要删除，4 个需要合并。但改动的分布很不均匀——
`component` 层 25 个叶子逐字不变，`semantic` 有 22 个、`effect` 有 6 个今天的
camelCase 写法本来就是对，真正要大动的是规则 3 的 163 处去重。

早先那版普查把「名字里有大写」整个列为违规（72 处）。规则 1 改成小驼峰之后这条
不再成立：72 处里 **29 处转为合规**（semantic 22、effect 6、scale 1），剩下 43
处仍然违规，但违规的原因不是「有大写」而是「段首有大写」。

| 违规                             | 数量 | 位置                                                                          |
| -------------------------------- | ---- | ----------------------------------------------------------------------------- |
| 叶子重复分组                     | 163  | semantic 65、scale 56、palette 42                                             |
| 段首大写                         | 43   | component 29（分组 `Button`）、semantic 14（`Background` 段）                 |
| 分组是连字符复合词，应 camelCase | 20   | scale —— `lineHeight` 9、`borderRadius` 7、`borderThickness` 4                |
| 完全没有分组                     | 12   | effect 5、`fontWeight` 6、semantic 1                                          |
| 词内复合用连字符，应 camelCase   | 10   | `gap` 场合词 6、`lightEffort` 4（值层 2 + 开关层 2）                          |
| 色调用 `fail` 而非 `error`       | 9    | semantic                                                                      |
| `infomation` 拼写错误            | 9    | semantic                                                                      |
| 名字里有空格 / 数字重复后缀      | 5    | component 4（要**合并**，不是改名）、scale 1（`border-radius-extra-small 2`） |
| `-er` 比较级后缀                 | 4    | scale —— `padding/smaller`、`padding/tinyer`、`size/huger`、`size/semilarger` |
| 字母直接粘数字                   | 4    | semantic —— `black1`、`white1`、`white2`、`white3`                            |
| `default` 被当作档位名           | 2    | scale —— `padding`、`borderThickness`                                         |
| 全小写连写复合词，应 camelCase   | 2    | scale —— `semilight`、`semibold`                                              |
| `allround` → `full`              | 1    | scale                                                                         |
| `disable` → `disabled`           | 1    | scale                                                                         |
| `extra-small` 带冲突后缀         | 1    | scale                                                                         |

去重后：**197 个需改名，8 个需删除，4 个需合并，0 个不动。** 按命名空间，需改名的
是 semantic 66、scale 54、palette 42、component 25、effect 10；删除的 8 个全在
scale，合并的 4 个全在 component。

`palette` 那 42 个全部只因规则 3（`error/error-10` → `error/10`），且它们是远端
只读的，必须在源库里改。

### 成本模型

三档，按操作是否保留变量的**身份**来区分。Figma 的别名和图层绑定都通过身份解析，
所以任何保住身份的操作对文件其余部分都是隐形的。

| 档                                   | 操作                                                               | Figma 内部的成本                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **免费** —— 身份保留                 | 重命名变量；重命名分组；重命名集合；收窄作用域；给集合加模式；改值 | **零。** 别名绑的是变量 ID 不是名字，所以上面那 197 个重命名一个都不会断。加模式会用默认值的副本填满新列，所以是非破坏性的——但见事实 1：它给集合里*每一个*变量都加了一个值单元格。                                         |
| **部分可定价** —— 身份丢失，目标已知 | 把变量移到另一个集合                                               | Figma 没有移动操作：只能在目标集合重建、再删掉原来的。**代价有三项，只有第一项可数**，详见表下。                                                                                                                           |
| **无法定价** —— 身份丢失，目标未知   | 删除变量                                                           | 会断掉所有入边别名（可数：`numbers` 是 0），*以及*每个消费方文件里所有直接的图层绑定（**这份 dump 数不出来**——Inspector 读的是变量和别名，不是图层绑定）。适用于被删的 8 个 scale 档位和被合并掉的 4 个 component 重复项。 |

「换集合」那三项代价，按数得出到数不出排列：

1. **入边别名**——可数。整个 scale 拆分是 **0**，effect 搬迁是 **5**。这一项是早先
   那版成本模型**唯一**算进去的，也正是它把整档标成「可定价」的原因。
2. **每个消费方文件里的图层直接绑定**——数不出来，与下面删除档是同一个未知量。
   `Variable.remove()` 在插件 typings 里的文档只有一句「Removes this variable from
   the document」，对绑定只字未提，所以后果连文档可依都没有。
3. **每个 frame 上的显式模式指定**——数不出来，而且**绑定普查结构上看不见它**。
   `node.explicitVariableModes` 按 **collection id** 索引，不是按变量；源集合一旦
   解散，所有钉在某个模式上的 frame 会静默回落到目标集合的 Default。绑定还在、还
   指向活变量，只有解析出的值变了，所以普查前后的读数**完全相同**。暴露面是实测
   的：`numbers` 56 个变量里恰好 **10 个**两个模式取值不同（`size` 4 + `lineHeight`
   4 + `transparency` 2），其余 46 个相同；任何钉在 Mobile Friendly 上的 frame 今天
   正在拿到这 10 个差异值，拆分后会一个不剩地丢掉。

第 3 项因此不能靠「先普查再动手」覆盖——普查看不见它。它必须在搬运动作里显式加一
步：把源集合上的模式指定按轴搬到目标集合，搬完比对前后计数，变少就整批失败。

所以成本的排序跟看上去是反的。构成普查绝大部分的那 197 个重命名是免费的。但说不出
价格的不止 12 个：59 次换集合同样背着第 2、3 两项数不出来的代价，区别只在它们的
**目标已知**、可以机械重建，所以是「贵但可执行」，而不是「不知道会不会炸」。真正连
目标都未知的是那 12 个——8 个*被移除*的 scale 档位，加 4 个*被合并*的 component
重复项——每一个都必须先要到 Figma 自己的使用视图里查过。后 4 个按决策延后，前 8 个
是本文档已知存在、却无法用手上证据量化的成本。

改成小驼峰这件事**没有增加、也没有减少任何一次操作**。把 kebab 版和 camelCase 版的
目标名逐个变量比对，两版的改名集合**完全相同**：197 改名、8 删除、4 合并、0 不动。
差别只在目标字符串上——73 个变量的目标名字不一样（scale 30、semantic 22、
component 11、effect 10），而一个改名落在哪一档跟它长成什么样无关，所以这 73 处
全部还在免费档。

早先那段「划掉 42 处、换成 30 处」的算法是错的：它把「这个词不再需要拉平」当成了
「这个变量不再需要改名」，而那批变量本来就要因为规则 3 或分组改名而动一次。少算的
那一次从来不存在。真正被 camelCase 省掉的是 component 层那三个 `level` 词
（`noBackground`、`noBackgroundCustom`、`outlineCustom`，涉及 11 个变量）——它们
今天已经是正确写法，不需要动叶子。

对推进顺序的三条结论：

- 免费档里的所有事情可以任意顺序、任意时间做，不需要协调。没有理由分阶段。
- 集合拆分应该**在重命名之前**做，不是之后。拆分会重建 59 个变量（scale 54 个、
  effect 值层 5 个）并重指 5 个别名；对已经改过名的变量做这件事代价相同，但先做
  拆分意味着重建时把最终名字写一次，而不是写两次。
- 而那 8 个删除应该**在拆分之前**做。`numbers` 加 `fontWeight` 今天一共 62 个变量，
  其中 8 个是要删的：先删再拆，重建 54 次；先拆再删，重建 62 次。差的这 8 次不是
  「白干活」那么轻——按上面的成本模型，每一次重建都背着图层直接绑定与显式模式指定
  这两项数不出来的代价，给 8 个注定要删的变量付这笔钱没有任何回报。

---

## 已知例外与延后工作

- **这个文件里没有任何东西消费 `component` 层。** 全部 29 个变量的入边别名是 0，
  所以从现有证据看这一层是个没人读的叶子。直接的图层绑定不在 dump 里，所以组件
  很可能确实绑了这些变量——那必须去 Figma 里查，不能推断。按决策延后：先把形状
  定对，才谈得上重新接线。
- **Button 在 token 层面没有状态反馈。** 沿别名链解析到底，`primary` 的三个状态
  不只是共用一个颜色——它们共用一个目标（下表用的是今天的名字，`Background` 的
  大写按规则 1 要降下来）：

  | 变量                                                       | 终点         | 别名路径                                         |
  | ---------------------------------------------------------- | ------------ | ------------------------------------------------ |
  | `primary-background-default`                               | `#ff5532`    | `control-theme-Background` → `primary-8`         |
  | `primary-background-hover`                                 | `#ff5532`    | `control-theme-Background` → `primary-8`         |
  | `primary-background-active`                                | `#ff5532`    | `control-theme-Background` → `primary-8`         |
  | `secondary-background-default` / `default 2` / `default 3` | `#ffc6b6` ×3 | `control-theme-lightBackground` → `primary-4`    |
  | `tertiary-background-default` / `default 2` / `default 3`  | `#f0efef` ×3 | `control-normal-lightBackground-1` → `neutral-4` |

  `secondary` 和 `tertiary` 根本没有 `hover` 或 `active`——那些槽位被名叫
  `default 2` 和 `default 3` 的重复项占着。而且它们不只是「解析到同一个 hex」：
  三个 `secondary` 别名指向同一个 `VariableID:1904:2014`，三个 `tertiary` 指向
  同一个 `VariableID:1904:2018`。它们是同一个变量的三份拷贝。这是功能缺陷，不是
  命名缺陷，而它今天之所以不可见，恰恰是因为没有任何东西消费这一层。普查里那 4 个
  「需合并」就是这两组多出来的拷贝。

- **`text`/`caption` 子槽位在某些 level 上是冗余的，在另一些上不是。**
  `primary`、`secondary` 和 `noBackground` 把两个子槽位都指向同一个变量
  （`#cd3923`，经由 `text-theme-primary-black`），而 `tertiary` 是真的不同：
  `caption` 是 `#616060`（`neutral-11`），`text` 是 `#262525`（`neutral-13`）。
  这个子槽位靠 `tertiary` 的存在留在范式里。
- **29 个 `component` 变量里有 12 个是变量表达式，其内容不在证据 dump 里。** 它们
  是在 Inspector 修好表达式处理之前采集的，所以 dump 只记下了
  `{"kind":"EASING","easingType":"VARIABLE_EXPRESSION"}`——函数和它的参数都没了。
  受影响的是 `noBackground`、`noBackgroundCustom`、`outline` 和 `outlineCustom`
  的全部 `background` 槽位（4 个 level × 3 个状态）。这 12 个算出来是什么目前未知，
  需要重新导出一次。这是范式跑在证据前面的唯一一处。
- **`lineHeight/max` 不是最大值。** 真实顺序是 `big` 30 < `semilarge` 34 <
  `max` 44 < `large` 46 < `huge` 52。`max` 在 9 个里排第 7。在词池下它会消失，
  等于用删除修正了错误排序。
- **`transparency/loading` 和 `transparency/placeholder` 都是 60。** 两个名字、
  一个值，两个模式都是。要么它们应该合并，要么其中一个是错的。
- **`borderRadius/extra-small` 不存在。** 只有副本 `border-radius-extra-small 2`
  （值 6）活了下来，带着 Figma 的冲突后缀——所以一个用未加后缀名字的变量曾经存在，
  现在已经没了。在词池下它变成 `borderRadius/tiny`，后缀跟它一起去掉。
- **复合词的大小写在文件里今天不一致，而范式只有一种写法。** `lineShadow` 和
  `bottomDeep` 是 camelCase，`light-effort` 是连字符；`semilight` 和 `semibold`
  连写，`littleSmall` 却是 camelCase。这不是两种并存的体系，是同一件事写了三种
  样子。规则 1 定 camelCase，所以存活者里要改的是 `lightEffort`（4 个）、
  `semiLight`、`semiBold`（各 1 个）。
- **没有 `fontSize` 这个类别，范式也不加一个。** `size` 的作用域是
  `FONT_SIZE,WIDTH_HEIGHT`，所以它已经同时干两份活：它那 11 档既是字号刻度也是
  尺寸刻度。这值得作为一个开放问题点出来，而不是当作已定的答案——一个类别跨两个
  作用域，正是 `size` 需要 11 档而 `lineHeight` 只需要 9 档的原因，也是其中 4 档
  在密度下移动的原因。把它拆成 `fontSize` 和 `size` 能让各自取一个子集，代价是
  多出第九个类别，以及要决定 11 档里哪几档归谁。

---

## 与旧 grammar 的关系

`src/grammar/grammar.ts` 当前实现的是单一的扁平
`--aviala-{category}-{property}-{variant}-{state}` 形状，跨 12 个 category，没有
命名空间维度。把它迁到本文档意味着：

- 在 `CategorySpec` 之上加一层命名空间，并把扁平的 `CATEGORY_BY_SLUG` 映射按命名
  空间分片；
- 把 `NameParts` 从四个固定槽位拓宽成按命名空间的槽位列表——四槽位假设已经焊死在
  `composeName`、`SegmentSlot` 和 `BuilderPanel` 里那四个 `SegmentPicker` 上；
- **改字符集与大小写校验。** Validator 今天有 `case-violation` 这个错误码，把任何
  大写都报成违规。规则 1 之后它必须只报**段首**大写，并且新增两个码：段内出现
  连字符分隔的复合词（该合并的没合并），以及字母直接粘数字（`black1`）。反过来，
  `composeName` 生成的名字也要按槽位表决定哪里写 `-`、哪里写 camelCase——这件事
  没有槽位表就做不到，所以它依赖上一条。
- `vocabulary.ts` 要改的地方比早先估计的少。`-er` 形式仍然废除，`fail` /
  `infomation` 仍然重命名，但 `lightBackground`、`noBackground` 这类词不再需要
  kebab 版本——早先那批拉平是词表里最大的一块改动，现在没了。`STATES`（19 个词）
  已经是无人引用的死代码，可以删。

除名字之外，范式现在还定了三件 grammar 完全没有表示的东西：

- **集合及其 mode 轴** —— 八个集合承载四条轴（theme、density、contrast、
  presence），三个不承载任何轴。Builder 当前提供的集合选择器不知道哪些类别属于
  哪个集合，所以它可以在 `scaleDensity` 里建一个 `padding` 变量，而没有任何东西
  会反对。
- **作用域** —— 每个类别、每个 `component` role 都有必需作用域。插件今天既不读也
  不写作用域。
- **一个变量必须坐在哪一层别名上** —— `semantic` 别名指向 `palette`，`component`
  别名指向 `semantic`，`effectSwitch` 别名指向 `effect`。校验器本可以从 dump 里
  查这件事；目前没有任何东西在查。
