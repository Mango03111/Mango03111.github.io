---
title: '【算法笔记】混合整数规划（MIP, mixed integer programming）'
Author: Mango
tags:
  - Algorithm
categories:
  - 算法
abbrlink: 82fbdb
date: 2026-01-26 17:38:38
---

**标签**: #数学优化 #线性规划 #高等难度 #组合优化 #决策优化

**#核心思想:** 在满足线性约束条件下，优化包含连续变量和整数变量的线性目标函数，解决复杂的组合优化问题。

**#算法原理:**
MIP是线性规划(LP)的扩展，其中部分变量被限制为整数值。通过分支定界法、割平面法等方法，系统地在可行解空间中搜索最优解，结合线性松弛和整数约束处理来找到满足所有约束的最佳整数解。

**#复杂度分析**

- **时间复杂度**: NP难问题，最坏情况下指数级复杂度
- **空间复杂度**: O(2ⁿ) 在最坏情况下，其中n为整数变量个数

**#代码实现:**

```c++
#include <iostream>
#include <vector>
#include <ilcplex/ilocplex.h>

ILOSTLBEGIN

void solveMIP() {
    IloEnv env;
    try {
        IloModel model(env);

        // 定义变量：连续变量x和整数变量y
        IloNumVar x(env, 0.0, 40.0, ILOFLOAT, "x");
        IloIntVar y(env, 0, 100, "y");

        // 添加约束
        model.add(-x + 2*y <= 7);
        model.add(2*x + y <= 14);
        model.add(2*x - y <= 10);

        // 设置目标函数：最大化 x + y
        model.add(IloMaximize(env, x + y));

        // 求解
        IloCplex cplex(model);
        if (cplex.solve()) {
            cout << "最优值: " << cplex.getObjValue() << endl;
            cout << "x = " << cplex.getValue(x) << endl;
            cout << "y = " << cplex.getValue(y) << endl;
        }
    }
    catch (IloException& e) {
        cerr << "Concert exception: " << e << endl;
    }
    env.end();
}
```

**#执行流程图:**

```
开始 → 问题建模 → 线性松弛求解 → 选择分支变量 → 分支创建子问题
    ↓                              ↑
整数解找到 ← 检查整数性 ← 求解子问题 ← 剪枝不可行解
    ↓
输出最优解 → 结束
```

**#适用场景:**

- 生产调度和排程优化
- 资源分配和投资组合优化
- 设施选址和路径规划
- 机器学习中的特征选择

**#优缺点:**

- ✅ 优点：能够精确建模复杂现实问题，提供数学最优性保证
- ❌ 缺点：计算复杂度高，大规模问题求解时间长，对建模技巧要求高

**#变种与改进:**

- MILP（混合整数线性规划）
- MIQP（混合整数二次规划）
- MINLP（混合整数非线性规划）
- 启发式MIP：如遗传算法、模拟退火与MIP结合
- 并行MIP：多线程分支定界

**#注意事项:**

- 问题规模较大时需要设置求解时间限制
- 选择合适的求解器参数和策略很重要
- 模型 formulation 对求解效率影响很大
- 需要注意数值稳定性和精度问题

**#参考资料:**
[CPLEX优化教程 - IBM](https://www.ibm.com/docs/en/icos/20.1.0)
