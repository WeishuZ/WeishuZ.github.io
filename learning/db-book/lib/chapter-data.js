/* Content data for static chapters. */
window.DB_CHAPTERS = {
  1: {
    eyebrow: "Part I · 第 1 章",
    num: "01",
    title: "SQL：<br>声明式接口",
    standfirst: "SQL 最反直觉的地方，是你不告诉数据库怎么做，只告诉它你要什么。真正的执行计划，由优化器在底下重新发明。",
    meta: [{ k: "难度", v: "入门" }, { k: "用时", v: "35 分钟" }, { k: "图解", v: "SQL 到执行计划" }, { k: "目标", v: "建立声明式思维" }],
    sections: [
      {
        id: "s1", no: "1.1", nav: "1.1 SQL 在隐藏什么", title: "SQL 在隐藏什么", drop: true,
        body: [
          "你写 <code>SELECT name FROM Students WHERE sid = 42</code>，看起来像在命令数据库“去找这个学生”。但 SQL 的真实含义更像一句逻辑断言：<b>请返回所有满足 sid = 42 的 tuple 的 name 属性</b>。",
          "这句话没有说要不要用索引、先过滤还是先 join、是否从 buffer pool 命中、要不要并行。数据库系统最厉害的地方，就是把这句高层描述翻译成一串物理操作。"
        ],
        diagram: {
          type: "flow", title: "从 SQL 到页 I/O", tag: "pipeline",
          items: [
            { t: "SQL text", d: "用户给出声明式查询：我要什么结果。" },
            { t: "Parser", d: "把字符串变成语法树，检查列名、表名、类型。" },
            { t: "Logical plan", d: "投影、选择、连接，仍然不关心具体算法。" },
            { t: "Optimizer", d: "枚举多种等价计划，用代价模型挑便宜的。" },
            { t: "Physical plan", d: "Index scan、hash join、sort，真正开始读页。" }
          ],
          note: "SQL 是课程的入口，但不是课程的终点。CS186 真正要训练的是：看到一条 SQL，脑中能浮现它可能变成哪些物理计划。"
        }
      },
      {
        id: "s2", no: "1.2", nav: "1.2 三层语义", title: "一条查询有三层语义",
        body: [
          "第一层是<b>结果语义</b>：这条 SQL 在数学上应该返回什么。第二层是<b>逻辑语义</b>：它可以被写成什么关系代数表达式。第三层是<b>物理语义</b>：系统如何用 scan、join、sort、index lookup 把它跑出来。",
          "初学数据库时最容易犯的错，是把 SQL 写法等同于执行顺序。比如 <code>FROM</code> 写在 <code>WHERE</code> 前面，不代表磁盘真的按这个顺序动。"
        ],
        box: { kind: "pitfall", label: "常见误区", body: "SQL 的书写顺序不是物理执行顺序。优化器可以重排 join，可以把 predicate 下推，也可以选择完全不同的 access path。" }
      },
      {
        id: "s3", no: "1.3", nav: "1.3 NULL 与三值逻辑", title: "NULL：不是 0，也不是空字符串",
        body: [
          "<code>NULL</code> 表示 unknown。unknown 参与布尔运算时会产生三值逻辑：true、false、unknown。于是 <code>WHERE age != 18</code> 不会选出 age 为 NULL 的行，因为 unknown 不是 true。",
          "这不是语言怪癖，而是数据库试图把“不知道”保留下来。后面学 outer join、聚合、约束时，NULL 会反复出现。"
        ],
        diagram: {
          type: "table", title: "三值逻辑速查", tag: "logic",
          head: ["表达式", "结果", "为什么"],
          rows: [
            ["<code>NULL = NULL</code>", "unknown", "两个未知值不一定相等。"],
            ["<code>NOT unknown</code>", "unknown", "不知道的反面仍然不知道。"],
            ["<code>true AND unknown</code>", "unknown", "最终还取决于未知条件。"],
            ["<code>false AND unknown</code>", "false", "只要有 false，AND 已经确定失败。"]
          ],
          note: "WHERE 只保留 true；false 和 unknown 都会被过滤掉。"
        }
      },
      {
        id: "s4", no: "1.4", nav: "1.4 写 SQL 的系统直觉", title: "写 SQL 时，脑中要有 cost",
        body: [
          "好的 SQL 不是“能跑就行”。你要开始问：predicate 是否能用索引？join key 是否有统计信息？聚合前能不能先过滤？排序是否可以被索引顺序免费提供？",
          "这章只先埋下这个问题。后面每一章都会把一个抽象 SQL 决策，落回具体的 page read、内存页数、log flush 和锁冲突。"
        ]
      }
    ],
    recap: ["SQL 描述结果，不指定算法。", "优化器负责把逻辑表达式变成物理计划。", "NULL 使用三值逻辑，WHERE 只保留 true。", "写 SQL 时要开始想 access path 和 I/O cost。"]
  },

  2: {
    eyebrow: "Part I · 第 2 章",
    num: "02",
    title: "关系模型与代数：<br>优化器的小语言",
    standfirst: "关系代数不是为了考试背符号，而是优化器用来证明“两个查询等价”的工作语言。",
    meta: [{ k: "难度", v: "入门+" }, { k: "用时", v: "40 分钟" }, { k: "图解", v: "逻辑树重写" }, { k: "目标", v: "看懂优化器重排" }],
    sections: [
      {
        id: "s1", no: "2.1", nav: "2.1 表不是文件", title: "表不是文件，关系不是数组", drop: true,
        body: [
          "关系模型故意把数据看成 unordered set of tuples。它不承诺磁盘顺序，不承诺行号稳定，也不承诺你看到的第一行就是物理上的第一行。",
          "这个抽象听起来限制很多，但正是它给了优化器自由：只要结果关系一样，系统就可以选择任意物理路线。"
        ],
        diagram: {
          type: "split", title: "逻辑世界 vs 物理世界", tag: "model",
          items: [
            { t: "关系模型", d: "表是 tuple 集合；操作是选择、投影、连接、聚合；关心结果是否等价。" },
            { t: "存储系统", d: "表被切成 page；page 里有 slot；slot 指向 record bytes；关心读写多少页。" }
          ],
          note: "CS186 的主线，就是反复在这两个世界之间来回翻译。"
        }
      },
      {
        id: "s2", no: "2.2", nav: "2.2 关系代数操作", title: "五个核心操作就够用了",
        body: [
          "选择 <code>σ</code> 过滤行，投影 <code>π</code> 选择列，连接 <code>⋈</code> 把两个关系按条件拼起来，聚合把多行压成统计值，重命名解决列名冲突。",
          "SQL 语法很多，但优化器先把它压成这些操作的树。你会发现复杂查询本质都是这些小积木的组合。"
        ],
        diagram: {
          type: "stack", title: "一条 SQL 的逻辑树", tag: "algebra",
          items: [
            { t: "π name, grade", d: "最后只输出需要的列。" },
            { t: "σ dept = 'CS'", d: "尽量早过滤，减少后续数据量。" },
            { t: "Students ⋈ Enrollments", d: "连接通常是最贵的节点，优化器会重点重排它。" },
            { t: "Base tables", d: "物理层可能是 seq scan，也可能是 index scan。" }
          ]
        }
      },
      {
        id: "s3", no: "2.3", nav: "2.3 等价重写", title: "优化器为什么敢改你的查询",
        body: [
          "选择可以下推：<code>σ(A ⋈ B)</code> 如果只依赖 A 的列，就可以先在 A 上过滤。投影也可以下推：如果后面不需要某些列，早一点扔掉能省内存和 I/O。",
          "Join 在数学上满足交换律和结合律，但物理代价差别极大。优化器的工作，就是在等价空间里找便宜计划。"
        ],
        diagram: {
          type: "flow", title: "Predicate pushdown", tag: "rewrite",
          items: [
            { t: "原始树", d: "先 join 大表，再过滤。" },
            { t: "检查依赖列", d: "predicate 只用到左表列。" },
            { t: "下推过滤", d: "先把左表变小。" },
            { t: "再 join", d: "join 输入变少，代价下降。" }
          ]
        }
      },
      {
        id: "s4", no: "2.4", nav: "2.4 代数连接到物理", title: "逻辑树不是执行树",
        body: [
          "同一个逻辑 join，可以用 nested loop、block nested loop、sort-merge、hash join，也可以借助索引做 index nested loop。逻辑树只说“要 join”，不说“怎么 join”。",
          "所以关系代数的价值不在符号本身，而在它给物理优化留下的可变空间。后面查询执行和优化器章节会把这些选择全部算成 cost。"
        ]
      }
    ],
    recap: ["关系模型隐藏物理顺序，给优化器自由。", "关系代数是 SQL 的中间表示。", "等价重写让 predicate/projection 尽早减少数据量。", "逻辑操作需要绑定到具体 physical operator 才能执行。"]
  },

  3: {
    eyebrow: "Part II · 第 3 章",
    num: "03",
    title: "磁盘、文件、Buffer Pool：<br>表如何变成页",
    standfirst: "数据库不是直接管理一行行对象，而是管理一页页 bytes。Buffer pool 是 CPU 世界和磁盘世界之间最关键的边界。",
    meta: [{ k: "难度", v: "中等" }, { k: "用时", v: "50 分钟" }, { k: "图解", v: "page / record / buffer" }, { k: "目标", v: "把表落到物理页" }],
    sections: [
      {
        id: "s1", no: "3.1", nav: "3.1 Disk model", title: "为什么数据库总在数 page", drop: true,
        body: [
          "磁盘和 SSD 的延迟比内存慢太多。数据库不能把每次 tuple 访问都当成小对象访问，而必须批量以 page 为单位搬运。一个 page 通常是 4KB、8KB 或 16KB。",
          "于是 CS186 的 cost model 会反复写 <code>[R]</code> 表示关系 R 的 page 数，而不是 tuple 数。因为真正贵的是 page I/O。"
        ],
        diagram: {
          type: "stack", title: "物理层级", tag: "storage",
          items: [
            { t: "Table", d: "逻辑关系，SQL 看到的是它。" },
            { t: "Heap file / sorted file", d: "一组 page 的组织方式。" },
            { t: "Page", d: "I/O 基本单位，包含 slot directory 和 record bytes。" },
            { t: "Record", d: "一行 tuple 的实际编码，可能定长或变长。" }
          ]
        }
      },
      {
        id: "s2", no: "3.2", nav: "3.2 Page layout", title: "一个 page 里有什么",
        body: [
          "典型 slotted page 的开头有 header 和 slot directory，尾部向前放 record bytes。slot 记录每条 record 的 offset 和 length。删除记录时可以先标记空 slot，后续再 compact。",
          "这个布局让变长记录变得可管理：record 可以移动，但 RID 中的 page id + slot id 不必改变。"
        ],
        diagram: {
          type: "flow", title: "Slotted page", tag: "bytes",
          items: [
            { t: "header", d: "page 元数据：free space 指针、slot 数量。" },
            { t: "slot directory", d: "每个 slot 指向 record 的 offset / length。" },
            { t: "free space", d: "插入新 record 时逐渐被消耗。" },
            { t: "record bytes", d: "真实 tuple 编码，从 page 尾部向前增长。" }
          ],
          note: "RID 稳定性来自 slot，而不是 record bytes 的物理位置永远不变。"
        }
      },
      {
        id: "s3", no: "3.3", nav: "3.3 Buffer pool", title: "Buffer pool：数据库自己的缓存",
        body: [
          "操作系统有 page cache，为什么数据库还要自己做 buffer pool？因为数据库知道 page 的语义：哪些页脏了、哪些页被事务 pin 住、哪些页未来可能被 sequential scan 冲掉。",
          "Buffer manager 的基本接口很小：fetch page、pin/unpin、mark dirty、evict。难点在策略：什么时候刷脏页，换出谁，如何避免 scan 把热页冲走。"
        ],
        diagram: {
          type: "flow", title: "Buffer pool 生命周期", tag: "cache",
          items: [
            { t: "Fetch", d: "请求 page；命中就返回 frame，未命中就读磁盘。" },
            { t: "Pin", d: "正在被使用的 frame 不能被 eviction。" },
            { t: "Dirty", d: "被修改但尚未刷盘，需要 recovery 配合。" },
            { t: "Evict", d: "挑 victim；脏页先写回，干净页直接丢。" }
          ]
        }
      },
      {
        id: "s4", no: "3.4", nav: "3.4 文件组织", title: "Heap file、sorted file 与索引",
        body: [
          "Heap file 插入便宜，但查找只能扫。Sorted file 范围查找好，但插入移动代价高。索引则额外维护一套导航结构，用写入成本换读取成本。",
          "这就是数据库系统最核心的 trade-off：你永远不是免费变快，而是在读、写、空间和维护复杂度之间重新分配成本。"
        ],
        diagram: {
          type: "table", title: "文件组织 trade-off", tag: "cost",
          head: ["组织方式", "读", "写", "适合"],
          rows: [
            ["Heap file", "点查/范围都弱，通常扫表", "插入快", "临时表、无索引小表"],
            ["Sorted file", "范围查好，二分定位", "插入贵", "静态或批量构建数据"],
            ["Index + heap", "按 key 查快", "每次写要维护索引", "OLTP 主力形态"]
          ]
        }
      }
    ],
    recap: ["数据库 cost model 以 page 为单位。", "Slotted page 用 slot 稳定 RID。", "Buffer pool 是数据库可控的页缓存。", "文件组织本质是读写空间 trade-off。"]
  },

  4: {
    eyebrow: "Part II · 第 4 章",
    num: "04",
    title: "代价模型与索引选择：<br>什么时候别用索引",
    standfirst: "索引不是银弹。数据库优化器最重要的判断之一，是在 seq scan 和 index scan 之间做冷静的算账。",
    meta: [{ k: "难度", v: "中等" }, { k: "用时", v: "45 分钟" }, { k: "图解", v: "access path 决策" }, { k: "目标", v: "形成 cost instinct" }],
    sections: [
      {
        id: "s1", no: "4.1", nav: "4.1 Access path", title: "Access path：进入表的路线", drop: true,
        body: [
          "同一张表可以用多种方式进入：顺序扫完整个 heap file，沿 B+ 树找到某个范围，或者用 hash index 做等值查找。Access path 是优化器给表选择的入口。",
          "选择 access path 的核心是 selectivity：predicate 会留下多少比例的记录。如果留下 90%，绕索引再回表通常比直接扫还慢。"
        ],
        diagram: {
          type: "flow", title: "索引选择流程", tag: "optimizer",
          items: [
            { t: "Predicate", d: "WHERE 条件是什么？等值、范围、前缀还是函数表达式？" },
            { t: "Stats", d: "估计选择率：distinct count、histogram、min/max。" },
            { t: "Access path", d: "seq scan、index scan、index only scan、bitmap scan。" },
            { t: "Cost", d: "估算 page I/O、CPU、回表随机读，挑最便宜。" }
          ]
        }
      },
      {
        id: "s2", no: "4.2", nav: "4.2 Clustered vs unclustered", title: "Clustered index 为什么重要",
        body: [
          "Clustered index 意味着数据记录本身按索引 key 的顺序存放。范围扫描时，leaf 上连续的 RID 大概率对应连续的数据页。Unclustered index 的 RID 可能散落全表，回表就是大量随机 I/O。",
          "所以一个选择率不高的范围查询，clustered index 可能很香，unclustered index 可能灾难。"
        ],
        diagram: {
          type: "split", title: "同样的索引，不同的物理局部性", tag: "layout",
          items: [
            { t: "Clustered", d: "索引顺序 ≈ 数据页顺序。范围查询读少量连续页，适合 BETWEEN、ORDER BY。" },
            { t: "Unclustered", d: "索引叶子有序，但数据页散落。每条命中记录都可能触发一次随机回表。" }
          ]
        }
      },
      {
        id: "s3", no: "4.3", nav: "4.3 Index-only scan", title: "Index-only scan：不用回表的幸福",
        body: [
          "如果查询需要的列都在索引里，数据库可以只读索引，不回 heap file。这叫 index-only scan，也解释了为什么实际系统会有 covering index。",
          "代价是写入变贵：索引越宽，page fan-out 越小，维护成本越高。优化永远不是单向度的。"
        ],
        diagram: {
          type: "table", title: "三种扫描代价", tag: "I/O",
          head: ["方式", "路径", "主要成本"],
          rows: [
            ["Seq scan", "读整张表", "<code>[R]</code> pages，稳定但可能很大。"],
            ["Index scan", "读索引 + 回表", "树高 + 命中记录对应的数据页。"],
            ["Index-only", "只读索引", "树高 + leaf pages；避免回表随机 I/O。"]
          ]
        }
      },
      {
        id: "s4", no: "4.4", nav: "4.4 统计信息会骗人", title: "优化器为什么会选错",
        body: [
          "优化器依赖统计信息估算选择率。统计过旧、列之间相关、数据分布倾斜，都会让估算偏离现实。于是看起来“明明有索引却不用”或“用了索引反而慢”的情况就出现了。",
          "现代数据库调优的第一步，往往不是加 hint，而是问：统计信息准吗？predicate 写法能不能被索引用上？回表成本被低估了吗？"
        ],
        box: { kind: "formal", label: "调优心法", body: "先算大方向：如果 predicate 留下的数据很多，seq scan 很可能合理；如果留下很少但索引 unclustered，要把随机回表也算进去。" }
      }
    ],
    recap: ["索引选择取决于 selectivity 和回表成本。", "Clustered index 强在范围扫描局部性。", "Index-only scan 用更宽索引换少回表。", "统计信息不准时，优化器会选错。"]
  },

  6: {
    eyebrow: "Part III · 第 6 章",
    num: "06",
    title: "排序与哈希：<br>内存不够时怎么办",
    standfirst: "数据库的排序和哈希都要面对同一个残酷事实：数据比内存大。于是算法设计的核心从 CPU 步数，变成了分批读写页。",
    meta: [{ k: "难度", v: "中等" }, { k: "用时", v: "50 分钟" }, { k: "图解", v: "external sort / hash" }, { k: "目标", v: "把算法翻译成 I/O" }],
    sections: [
      {
        id: "s1", no: "6.1", nav: "6.1 External sort", title: "External sort：排序比内存大得多的数据", drop: true,
        body: [
          "内存里排序很简单；磁盘上的大表排序才是数据库关心的问题。External merge sort 先把能放进内存的页排序成 runs，再一轮轮 merge。",
          "代价通常按 pass 算。每一轮 pass 都读一遍、写一遍所有页，所以 I/O 是主角。"
        ],
        diagram: {
          type: "timeline", title: "External merge sort", tag: "sort",
          items: [
            { k: "Pass 0", t: "生成 sorted runs", d: "每次读 B 个 buffer pages，内存中排序，写出一个 run。" },
            { k: "Pass 1", t: "多路归并", d: "用 B-1 个输入 buffer 加 1 个输出 buffer，合并多个 run。" },
            { k: "Pass k", t: "直到只剩一个 run", d: "run 数每轮大约除以 B-1；每轮读写整张表。" }
          ]
        }
      },
      {
        id: "s2", no: "6.2", nav: "6.2 Hashing", title: "Hashing：把相等 key 扔到同一桶",
        body: [
          "Hash 的直觉是：如果两个 tuple join key 相等，它们应该被分到同一个 partition。Grace hash join 先 partition，再分别在每个 partition 内 build/probe。",
          "它的关键假设是：partition 后的某个小块能放进内存。如果数据倾斜，某个热 key 可能把一个 bucket 撑爆。"
        ],
        diagram: {
          type: "flow", title: "Grace hash pattern", tag: "hash",
          items: [
            { t: "Partition R", d: "按 hash(key) 把 R 写入多个磁盘分区。" },
            { t: "Partition S", d: "用同一个 hash 函数分区 S。" },
            { t: "Build", d: "读 R_i 到内存建 hash table。" },
            { t: "Probe", d: "读 S_i，只和同桶 R_i 匹配。" }
          ]
        }
      },
      {
        id: "s3", no: "6.3", nav: "6.3 Sort vs Hash", title: "什么时候排序，什么时候哈希",
        body: [
          "等值 join 和 group by 常常适合 hash；需要输出有序、范围、去重、merge join 时排序更有用。排序的副产品是 order，hash 的副产品是 partition。",
          "优化器不会抽象地偏爱某个算法，它会看内存页数、输入页数、是否已有顺序、是否需要最终排序。"
        ],
        diagram: {
          type: "matrix", title: "Sort 和 Hash 的能力矩阵", tag: "choice",
          cols: ["Sort", "Hash", "注意"],
          corner: "任务",
          rows: [
            { t: "等值 Join", cells: [{ v: "可用", k: "" }, { v: "强", k: "good" }, { v: "hash join 通常更直接" }] },
            { t: "Range", cells: [{ v: "强", k: "good" }, { v: "弱", k: "warn" }, { v: "hash 破坏顺序" }] },
            { t: "ORDER BY", cells: [{ v: "必须", k: "good" }, { v: "无用", k: "warn" }, { v: "除非已有索引顺序" }] },
            { t: "Skew", cells: [{ v: "较稳", k: "" }, { v: "可能爆桶", k: "warn" }, { v: "热 key 会拖垮 hash" }] }
          ]
        }
      },
      {
        id: "s4", no: "6.4", nav: "6.4 内存页数是算法参数", title: "内存页数是算法参数",
        body: [
          "数据库算法的输入不只是表大小，还有 buffer pages 数量 B。B 决定 external sort 每轮能 merge 几个 runs，也决定 hash partition 后能不能放进内存。",
          "这就是系统课和算法课的差别：算法不再只依赖 n，而依赖存储层和内存预算。"
        ]
      }
    ],
    recap: ["External sort 按 pass 读写整张表。", "Hashing 用 partition 把同 key 放在一起。", "Sort 产生顺序，hash 产生分区。", "Buffer pages 数量直接改变算法可行性和 I/O。"]
  },

  7: {
    eyebrow: "Part III · 第 7 章",
    num: "07",
    title: "Joins 与 Iterator 模型：<br>把计划跑成数据流",
    standfirst: "Join 是关系数据库的心脏，也是代价爆炸的源头。Iterator 模型则是把一整棵查询计划接成流水线的统一接口。",
    meta: [{ k: "难度", v: "中等+" }, { k: "用时", v: "55 分钟" }, { k: "图解", v: "join 算法对比" }, { k: "目标", v: "能估算 join I/O" }],
    sections: [
      {
        id: "s1", no: "7.1", nav: "7.1 Join 为什么贵", title: "Join 为什么贵", drop: true,
        body: [
          "Join 把两个关系按条件组合。最朴素的 nested loop 是对外表每条记录，扫描内表找匹配。表一大，这个代价马上爆炸。",
          "CS186 训练你做的事情，是把 join 算法从“概念上能连起来”，变成“给我页数和 buffer，我能算 I/O”。"
        ],
        diagram: {
          type: "table", title: "Join 算法速览", tag: "operators",
          head: ["算法", "核心动作", "适合场景"],
          rows: [
            ["Simple NLJ", "每条外表记录扫内表", "只适合非常小的数据。"],
            ["Block NLJ", "外表按 block 读入，减少内表扫描次数", "有多个 buffer pages 时的基础优化。"],
            ["Index NLJ", "外表每条记录查内表索引", "内表 join key 有高选择性索引。"],
            ["Sort-Merge", "两边排序后线性合并", "已有顺序或需要输出顺序。"],
            ["Hash Join", "partition/build/probe", "等值 join，内存足够时很强。"]
          ]
        }
      },
      {
        id: "s2", no: "7.2", nav: "7.2 Block Nested Loop", title: "BNLJ：用内存换少扫几遍",
        body: [
          "Block Nested Loop Join 把外表的 B-2 页一次性装进内存，留一页给内表扫描，一页给输出。于是内表不用为外表每一页都扫一次，而是为每个外表 block 扫一次。",
          "这类算法体现了数据库系统的味道：一个看似小小的 buffer 数量变化，会把 I/O 公式直接改掉。"
        ],
        diagram: {
          type: "flow", title: "BNLJ buffer layout", tag: "memory",
          items: [
            { t: "B-2 pages", d: "外表 block，尽量塞满内存。" },
            { t: "1 input page", d: "顺序扫描内表。" },
            { t: "1 output page", d: "匹配结果攒满再写。" },
            { t: "Repeat", d: "换下一个外表 block，再扫内表。" }
          ]
        }
      },
      {
        id: "s3", no: "7.3", nav: "7.3 Iterator 模型", title: "Iterator 模型：所有 operator 都会 next()",
        body: [
          "数据库执行器常用 Volcano/Iterator 模型：每个 operator 暴露 <code>open()</code>、<code>next()</code>、<code>close()</code>。上层不断向下层要下一条 tuple。",
          "这让 scan、filter、join、aggregate 都能接成树。某些 operator 可以 pipelined 输出，某些 blocking operator（如 sort）必须先读完整个输入。"
        ],
        diagram: {
          type: "stack", title: "执行树的 tuple pull", tag: "iterator",
          items: [
            { t: "Project.next()", d: "向 child 要 tuple，只保留输出列。" },
            { t: "Join.next()", d: "维护内部状态，产生下一条匹配结果。" },
            { t: "Filter.next()", d: "不断拉 child，直到 predicate 通过。" },
            { t: "Scan.next()", d: "从 buffer pool 读 page，吐出 tuple。" }
          ]
        }
      },
      {
        id: "s4", no: "7.4", nav: "7.4 Pipeline vs blocking", title: "Pipeline 与 blocking operator",
        body: [
          "Filter、project 通常可以边读边吐结果。Sort、某些 aggregate 必须先收完整输入，才能输出第一条。Hash join 也有 build 阶段，不能一上来就吐结果。",
          "这会影响响应时间、内存峰值和能否并行。优化器不只关心总 I/O，也关心 operator 的数据流形态。"
        ]
      }
    ],
    recap: ["Join 是最容易让计划代价爆炸的 operator。", "Buffer pages 数量决定 BNLJ 等算法的 I/O。", "Iterator 模型用 next() 把执行计划接成数据流。", "Blocking operator 会改变 latency 和内存峰值。"]
  },

  8: {
    eyebrow: "Part III · 第 8 章",
    num: "08",
    title: "查询优化器：<br>在指数空间里找便宜计划",
    standfirst: "优化器不是魔法，它是在巨大计划空间里，用统计信息和动态规划做一场有误差的搜索。",
    meta: [{ k: "难度", v: "偏硬" }, { k: "用时", v: "60 分钟" }, { k: "图解", v: "System R DP" }, { k: "目标", v: "理解 optimizer 选错的原因" }],
    sections: [
      {
        id: "s1", no: "8.1", nav: "8.1 计划空间", title: "同一条 SQL 有多少种跑法", drop: true,
        body: [
          "一条多表 join 查询，join 顺序可以排列组合；每个表有多种 access path；每个 join 又有多种物理算法。计划空间会指数增长。",
          "优化器必须剪枝。它不会真的跑每个计划，而是估算代价，保留每个子问题里最有希望的候选。"
        ],
        diagram: {
          type: "flow", title: "优化器主循环", tag: "optimizer",
          items: [
            { t: "Parse", d: "SQL 变成逻辑树。" },
            { t: "Rewrite", d: "predicate pushdown、projection pushdown。" },
            { t: "Enumerate", d: "枚举 join order 和 access path。" },
            { t: "Estimate", d: "用统计信息估 selectivity 与 cost。" },
            { t: "Choose", d: "挑估算最便宜的 physical plan。" }
          ]
        }
      },
      {
        id: "s2", no: "8.2", nav: "8.2 Selectivity", title: "Selectivity：估计会留下多少行",
        body: [
          "优化器需要估算 predicate 过滤后剩多少行。常见统计包括表 cardinality、page 数、distinct value 数、histogram、min/max。",
          "如果估计错了，后面的 join cost 会连锁错误。一个 predicate 留下 1% 还是 80%，可能决定是否使用索引、哪张表做外表、是否选择 hash join。"
        ],
        diagram: {
          type: "table", title: "统计信息如何喂给 cost model", tag: "stats",
          head: ["统计", "用途", "风险"],
          rows: [
            ["Cardinality", "估算行数规模", "过旧会让所有 cost 偏移。"],
            ["Distinct count", "估算等值 predicate", "列相关时会错。"],
            ["Histogram", "处理倾斜分布", "桶太粗会隐藏热点。"],
            ["Min / Max", "估算范围 predicate", "对多峰分布很弱。"]
          ]
        }
      },
      {
        id: "s3", no: "8.3", nav: "8.3 System R DP", title: "System R 风格动态规划",
        body: [
          "经典优化器按 join 子集做动态规划：先找单表最优 access path，再找两表 join 最优，再逐步扩到更多表。每个子集保留低 cost 计划，必要时还保留有用 interesting order。",
          "它的核心信念是 optimal substructure：一个大计划的好前缀，通常也应该是某个子问题里的好计划。"
        ],
        diagram: {
          type: "timeline", title: "DP by join set size", tag: "search",
          items: [
            { k: "Size 1", t: "单表 access path", d: "Seq scan、index scan、index-only scan。" },
            { k: "Size 2", t: "两表 join", d: "枚举左右输入与 join algorithm。" },
            { k: "Size k", t: "更大 join 子集", d: "用小子集组合出大子集。" },
            { k: "Final", t: "完整计划", d: "加上 projection、sort、aggregate 等后处理。" }
          ]
        }
      },
      {
        id: "s4", no: "8.4", nav: "8.4 为什么优化器会错", title: "为什么优化器会选错",
        body: [
          "统计信息不准、predicate 相关性、数据倾斜、参数化查询、缓存状态变化，都会让估计代价偏离真实代价。优化器是强大的，但不是先知。",
          "工程上你会看到 analyze、hint、plan cache、adaptive execution、runtime filter 等机制，本质都在修补“估计世界”和“真实世界”的差距。"
        ],
        box: { kind: "pitfall", label: "别迷信 explain", body: "EXPLAIN 展示的是优化器估计的计划；EXPLAIN ANALYZE 才会告诉你实际行数和实际耗时。两者差距通常就是调优入口。" }
      }
    ],
    recap: ["优化器在指数级计划空间里搜索。", "Selectivity 估错会连锁污染 cost。", "System R DP 按 join 子集逐步构建计划。", "真实系统需要不断校准估计与实际执行。"]
  },

  9: {
    eyebrow: "Part IV · 第 9 章",
    num: "09",
    title: "事务、锁与隔离：<br>让并发像串行",
    standfirst: "事务系统的目标，是让很多客户端同时操作数据库，却像某个串行顺序一样正确。锁只是手段，serializability 才是目标。",
    meta: [{ k: "难度", v: "偏硬" }, { k: "用时", v: "65 分钟" }, { k: "图解", v: "冲突图 / 锁协议" }, { k: "目标", v: "看懂 isolation" }],
    sections: [
      {
        id: "s1", no: "9.1", nav: "9.1 ACID", title: "ACID 分别在解决什么", drop: true,
        body: [
          "Atomicity 说事务要么全做，要么像没做；Consistency 说事务前后保持约束；Isolation 说并发执行看起来像串行；Durability 说提交后崩机也不能丢。",
          "这章主要处理 Isolation。Atomicity 和 Durability 会在 Recovery 章节用 WAL 和 ARIES 解决。"
        ],
        diagram: {
          type: "split", title: "ACID 分工", tag: "txns",
          items: [
            { t: "Concurrency control", d: "负责 Isolation：锁、时间戳、MVCC，让并发历史等价于某个串行历史。" },
            { t: "Recovery", d: "负责 Atomicity + Durability：日志、redo/undo、checkpoint，崩溃后恢复。" }
          ]
        }
      },
      {
        id: "s2", no: "9.2", nav: "9.2 Serializability", title: "Serializable：不是按顺序跑，而是像按顺序跑",
        body: [
          "Serializable schedule 的意思是：虽然操作交错执行，但最终效果等价于某个事务串行顺序。冲突可串行化可以用 precedence graph 判断：如果图有环，就不存在这样的串行顺序。",
          "这给了并发控制一个明确目标：允许尽可能多的交错，但不要产生环。"
        ],
        diagram: {
          type: "flow", title: "冲突图判断", tag: "graph",
          items: [
            { t: "读写操作", d: "找同一对象上的 RW、WR、WW 冲突。" },
            { t: "加边", d: "如果 T1 的冲突操作先于 T2，加 T1 → T2。" },
            { t: "检查环", d: "无环则冲突可串行化，有环则不行。" },
            { t: "拓扑序", d: "无环图的拓扑序就是等价串行顺序。" }
          ]
        }
      },
      {
        id: "s3", no: "9.3", nav: "9.3 Two-phase locking", title: "2PL：先增长，后收缩",
        body: [
          "Two-phase locking 要求每个事务先进入 growing phase：只拿锁不放锁；一旦释放任何锁，就进入 shrinking phase：只能放锁不能再拿锁。",
          "Strict 2PL 更进一步：写锁一直持有到 commit/abort。这样不仅保证可串行化，也让 recovery 简单，因为别人不会读到未提交写。"
        ],
        diagram: {
          type: "timeline", title: "2PL lifecycle", tag: "locking",
          items: [
            { k: "Grow", t: "获取 S/X locks", d: "事务不断申请需要的锁。" },
            { k: "Lock point", t: "拿到最后一把锁", d: "这一刻决定等价串行顺序。" },
            { k: "Shrink", t: "释放锁", d: "释放后不能再申请新锁。" },
            { k: "Strict", t: "写锁到提交才放", d: "避免 dirty read 与级联 abort。" }
          ]
        }
      },
      {
        id: "s4", no: "9.4", nav: "9.4 Deadlock 与隔离级别", title: "Deadlock 与隔离级别",
        body: [
          "锁会带来 deadlock：T1 等 T2，T2 等 T1。系统可以用 wait-for graph 检测环，也可以用 timeout 粗暴中止。",
          "现实数据库常提供 Read Committed、Repeatable Read、Serializable 等隔离级别。越强越接近串行，代价是更少并发和更多等待。"
        ],
        diagram: {
          type: "matrix", title: "隔离级别直觉", tag: "isolation",
          cols: ["Dirty read", "Non-repeatable", "Phantom"],
          corner: "级别",
          rows: [
            { t: "Read Uncommitted", cells: [{ v: "可能", k: "warn" }, { v: "可能", k: "warn" }, { v: "可能", k: "warn" }] },
            { t: "Read Committed", cells: [{ v: "避免", k: "good" }, { v: "可能", k: "warn" }, { v: "可能", k: "warn" }] },
            { t: "Repeatable Read", cells: [{ v: "避免", k: "good" }, { v: "避免", k: "good" }, { v: "可能", k: "warn" }] },
            { t: "Serializable", cells: [{ v: "避免", k: "good" }, { v: "避免", k: "good" }, { v: "避免", k: "good" }] }
          ]
        }
      }
    ],
    recap: ["Isolation 的目标是效果等价于某个串行顺序。", "冲突图无环意味着 conflict-serializable。", "2PL 用锁协议保证可串行化。", "隔离级别是在正确性和并发之间取舍。"]
  },

  10: {
    eyebrow: "Part IV · 第 10 章",
    num: "10",
    title: "Recovery 与 ARIES：<br>崩了也能回来",
    standfirst: "数据库恢复的核心不是“不崩”，而是崩了以后能从日志和磁盘页恢复出一个满足事务语义的世界。",
    meta: [{ k: "难度", v: "硬" }, { k: "用时", v: "70 分钟" }, { k: "图解", v: "WAL / ARIES 三阶段" }, { k: "目标", v: "理解 redo/undo" }],
    sections: [
      {
        id: "s1", no: "10.1", nav: "10.1 Steal / no-force", title: "为什么需要复杂 recovery", drop: true,
        body: [
          "如果事务提交时强制把所有脏页刷盘，恢复会简单，但提交太慢。如果不允许未提交事务的脏页被刷盘，buffer pool 又很难管理。",
          "现实数据库通常采用 steal/no-force：允许未提交脏页先刷盘，也不强制提交时刷所有数据页。于是必须靠日志恢复。"
        ],
        diagram: {
          type: "matrix", title: "Buffer policy 与恢复需求", tag: "policy",
          cols: ["含义", "好处", "恢复需求"],
          corner: "策略",
          rows: [
            { t: "Steal", cells: [{ v: "未提交脏页可被刷盘" }, { v: "buffer 更灵活" }, { v: "需要 UNDO", k: "warn" }] },
            { t: "No-force", cells: [{ v: "提交不强制刷数据页" }, { v: "commit 快" }, { v: "需要 REDO", k: "warn" }] }
          ]
        }
      },
      {
        id: "s2", no: "10.2", nav: "10.2 WAL", title: "WAL：先写日志，再写数据页",
        body: [
          "Write-Ahead Logging 的规则是：数据页写盘前，对应日志必须先落盘；事务提交前，commit log record 必须落盘。",
          "这让恢复有证据可依。即使数据页状态乱七八糟，日志里仍然记录了哪些操作应该 redo，哪些未提交操作应该 undo。"
        ],
        diagram: {
          type: "timeline", title: "WAL ordering", tag: "log",
          items: [
            { k: "1", t: "更新 buffer page", d: "事务在内存中修改 page，page 变 dirty。" },
            { k: "2", t: "追加 log record", d: "记录 before/after 信息、prevLSN、pageLSN。" },
            { k: "3", t: "flush log", d: "数据页写盘前，相关日志必须先持久化。" },
            { k: "4", t: "flush page later", d: "数据页可以稍后任意时刻刷盘。" }
          ]
        }
      },
      {
        id: "s3", no: "10.3", nav: "10.3 ARIES 三阶段", title: "ARIES：Analysis、Redo、Undo",
        body: [
          "ARIES 恢复分三步。Analysis 重建崩溃时的事务表和 dirty page table；Redo 从合适位置开始重复历史；Undo 反向撤销 loser transactions，并写 CLR。",
          "它的哲学是 repeat history：先把系统带回崩溃瞬间附近的状态，再清理不该留下的未提交更新。"
        ],
        diagram: {
          type: "flow", title: "ARIES recovery phases", tag: "recovery",
          items: [
            { t: "Analysis", d: "从 checkpoint 开始扫描日志，重建 Xact Table 和 DPT。" },
            { t: "Redo", d: "从最小 recLSN 开始，重做可能没落盘的更新。" },
            { t: "Undo", d: "用 max-heap 反向撤销 loser transactions。" },
            { t: "CLR", d: "每次 undo 都写 compensation log record，保证崩溃中恢复仍可恢复。" }
          ]
        }
      },
      {
        id: "s4", no: "10.4", nav: "10.4 checkpoint 与 CLR", title: "Checkpoint 与 CLR",
        body: [
          "Checkpoint 让恢复不用从日志开头扫起。它记录当时的事务表和 dirty page table，恢复从最近 checkpoint 附近开始。",
          "CLR 是 ARIES 的优雅之处：undo 本身也要被记录，这样如果恢复过程中再次崩溃，下一次恢复不会重复撤销同一动作。"
        ],
        box: { kind: "formal", label: "三句话记住 ARIES", body: "Analysis 找崩溃现场；Redo 重放历史保证 durability；Undo 清理 loser 保证 atomicity。" }
      }
    ],
    recap: ["Steal 需要 undo，no-force 需要 redo。", "WAL 保证日志先于数据页持久化。", "ARIES 三阶段是 Analysis、Redo、Undo。", "CLR 让 undo 操作本身也可恢复。"]
  },

  11: {
    eyebrow: "Part V · 第 11 章",
    num: "11",
    title: "2PC、Paxos<br>与分布式事务：<br>commit 变成协议",
    standfirst: "单机事务里 commit 是一次本地决定；分布式事务里，commit 是多个节点在故障和消息延迟中达成一致的协议。",
    meta: [{ k: "难度", v: "硬" }, { k: "用时", v: "65 分钟" }, { k: "图解", v: "2PC message flow" }, { k: "目标", v: "理解 blocked commit" }],
    sections: [
      {
        id: "s1", no: "11.1", nav: "11.1 为什么分布式更难", title: "为什么分布式事务更难", drop: true,
        body: [
          "一笔事务如果修改多个机器上的数据，所有参与者必须同意同一个结果：要么全部 commit，要么全部 abort。单个节点不能自说自话。",
          "困难来自故障模型：消息会延迟，节点会崩溃，协调者也可能崩溃。你看到的“没回复”，无法区分是对方死了还是网络慢。"
        ],
        diagram: {
          type: "split", title: "单机 commit vs 分布式 commit", tag: "distributed",
          items: [
            { t: "Single-node", d: "日志落盘后，本地可以决定 commit；恢复时只看自己的 log。" },
            { t: "Distributed", d: "参与者分散在多台机器，必须通过消息和持久化投票达成同一决定。" }
          ]
        }
      },
      {
        id: "s2", no: "11.2", nav: "11.2 2PC", title: "Two-Phase Commit：先投票，再决定",
        body: [
          "2PC 有两个阶段。Prepare 阶段协调者问所有参与者能否提交；参与者写 prepare log 后投 yes/no。Commit 阶段协调者根据投票广播 commit 或 abort。",
          "它保证 atomic commit，但有 blocking 问题：如果参与者投了 yes 后协调者崩溃，参与者可能不知道最终决定，只能等。"
        ],
        diagram: {
          type: "timeline", title: "2PC message flow", tag: "protocol",
          items: [
            { k: "Prepare", t: "Coordinator → Participants", d: "询问能否 commit。" },
            { k: "Vote", t: "Participants flush + vote", d: "写 prepare/abort log 后回复 yes/no。" },
            { k: "Decision", t: "Coordinator flush decision", d: "全 yes 则 commit，否则 abort。" },
            { k: "Ack", t: "Participants apply + ack", d: "参与者记录最终决定并完成事务。" }
          ]
        }
      },
      {
        id: "s3", no: "11.3", nav: "11.3 Presumed abort", title: "Presumed abort：少写 abort 日志",
        body: [
          "Presumed abort 的直觉是：没有记录就默认 abort。这样 aborted transaction 可以少写很多 log record 和消息，优化了常见失败路径。",
          "这种优化看起来小，但数据库协议的性能常常就藏在这些持久化点和消息数里。一次 log flush 可能比很多 CPU 指令贵得多。"
        ],
        diagram: {
          type: "table", title: "2PC 优化关注点", tag: "flush",
          head: ["优化", "减少什么", "代价/约束"],
          rows: [
            ["Presumed abort", "abort 路径日志和恢复消息", "默认无记录即 abort。"],
            ["Group commit", "多事务共享 log flush", "增加一点等待换吞吐。"],
            ["Read-only participant", "无需参与最终决定", "必须确认没有写。"]
          ]
        }
      },
      {
        id: "s4", no: "11.4", nav: "11.4 共识与事务", title: "Paxos/Raft 在哪里出现",
        body: [
          "2PC 解决 atomic commit，但协调者单点故障会 blocking。实际系统常把 coordinator state 或日志复制到共识组，让决定不会因为一台机器死掉而丢失。",
          "共识协议解决的是多个副本对一串 log entries 达成一致；事务协议解决的是多个参与者对一个事务结果达成一致。现代分布式数据库往往把两者组合起来。"
        ],
        box: { kind: "intuition", label: "分清两个一致", body: "Replica consensus 是“同一份状态的多个副本一致”；distributed transaction 是“多个不同数据分片对 commit/abort 一致”。它们经常叠在一起，但不是同一个问题。" }
      }
    ],
    recap: ["分布式 commit 必须让所有参与者同生共死。", "2PC 有 prepare/vote 和 decision 两阶段。", "2PC 的核心缺点是 coordinator failure 可能 blocking。", "现代系统常把事务协议和共识复制组合起来。"]
  },

  12: {
    eyebrow: "Part V · 第 12 章",
    num: "12",
    title: "NoSQL、Spark<br>与现代数据系统：<br>把 CS186 接到现实",
    standfirst: "学完古典数据库内核后，现代系统不再显得散乱：<br>NoSQL、LSM、Spark<br>Lakehouse 都是在重分配同一组 trade-off。",
    meta: [{ k: "难度", v: "综合" }, { k: "用时", v: "60 分钟" }, { k: "图解", v: "系统谱系图" }, { k: "目标", v: "连接现代话题" }],
    sections: [
      {
        id: "s1", no: "12.1", nav: "12.1 为什么有 NoSQL", title: "为什么会有 NoSQL", drop: true,
        body: [
          "NoSQL 不是“不要 SQL”，而是很多系统在关系模型、强事务、复杂查询之外，优先选择了规模、可用性、写吞吐、灵活 schema 或低延迟。",
          "这些系统没有推翻 CS186，反而把 CS186 的 trade-off 放大了：索引怎么维护？事务边界在哪里？恢复靠什么日志？查询能力让渡给谁？"
        ],
        diagram: {
          type: "matrix", title: "现代数据系统取舍", tag: "landscape",
          cols: ["强项", "牺牲", "典型问题"],
          corner: "系统",
          rows: [
            { t: "RDBMS", cells: [{ v: "SQL + 事务", k: "good" }, { v: "水平扩展复杂" }, { v: "如何优化复杂查询？" }] },
            { t: "KV Store", cells: [{ v: "低延迟点查", k: "good" }, { v: "查询表达力弱" }, { v: "如何分片和复制？" }] },
            { t: "Document DB", cells: [{ v: "灵活 schema", k: "good" }, { v: "join 弱" }, { v: "如何建模嵌套数据？" }] },
            { t: "Columnar OLAP", cells: [{ v: "分析扫描快", k: "good" }, { v: "点写弱" }, { v: "如何压缩和向量化？" }] }
          ]
        }
      },
      {
        id: "s2", no: "12.2", nav: "12.2 LSM 与云存储", title: "LSM：为写入和云存储重排成本",
        body: [
          "LSM tree 把随机写变成顺序追加：写 memtable 和 WAL，刷成 SSTable，后台 compaction。它很适合写多、云盘、对象存储和高吞吐场景。",
          "代价是读放大、写放大和空间放大。Bloom filter、leveled compaction、tiered compaction 都是在调这些旋钮。"
        ],
        diagram: {
          type: "flow", title: "LSM 写入路径", tag: "storage",
          items: [
            { t: "WAL", d: "先追加日志，保证崩溃恢复。" },
            { t: "Memtable", d: "内存有序结构，吸收随机写。" },
            { t: "Flush", d: "刷成不可变 SSTable。" },
            { t: "Compaction", d: "后台合并层级，换取读性能和空间回收。" }
          ]
        }
      },
      {
        id: "s3", no: "12.3", nav: "12.3 Spark", title: "Spark：查询执行的分布式版本",
        body: [
          "Spark 把大规模数据处理拆成一张 DAG。每个 stage 内部可以 pipeline，遇到 shuffle 就要跨机器重分区，成为新的边界。",
          "这和单机数据库的 iterator tree 很像，只是 operator 现在分布到许多 worker 上，I/O 从磁盘页扩展为网络 shuffle 和远端存储读写。"
        ],
        diagram: {
          type: "timeline", title: "Spark DAG mental model", tag: "dataflow",
          items: [
            { k: "Read", t: "从文件/表读 partition", d: "数据天然分片，多个 task 并行读取。" },
            { k: "Narrow ops", t: "map/filter/project", d: "每个 partition 内独立处理，可 pipeline。" },
            { k: "Shuffle", t: "按 key 重分区", d: "网络和磁盘开销巨大，是性能分界线。" },
            { k: "Wide ops", t: "join/groupBy", d: "依赖 shuffle 后的数据布局。" }
          ]
        }
      },
      {
        id: "s4", no: "12.4", nav: "12.4 Lakehouse 与回到 SQL", title: "Lakehouse：现代系统又回到 SQL",
        body: [
          "数据湖把数据放在便宜对象存储上，warehouse 提供强管理和 SQL。Lakehouse 试图把两者合并：开放格式、事务日志、schema evolution、向量化执行。",
          "这说明 SQL 和关系思想没有过时。过时的是把数据库只想成单机黑盒。现代数据系统是在更大的存储、计算、元数据和事务边界上重新实现同一批原则。"
        ],
        diagram: {
          type: "stack", title: "Lakehouse 分层", tag: "modern",
          items: [
            { t: "Object storage", d: "S3/GCS 等廉价持久层，文件是基本对象。" },
            { t: "Table format", d: "Delta/Iceberg/Hudi：事务日志、snapshot、schema。" },
            { t: "Execution engine", d: "Spark/Trino/DuckDB/Databricks SQL 等读取并优化。" },
            { t: "Governance", d: "Catalog、权限、lineage、质量约束。" }
          ]
        }
      }
    ],
    recap: ["NoSQL 是一组取舍，不是一种单一技术。", "LSM 用追加写和 compaction 换写吞吐。", "Spark 把数据库执行计划扩展成分布式 DAG。", "Lakehouse 把 SQL、事务和对象存储重新组合。"]
  }
};
