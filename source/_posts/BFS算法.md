---
title: '【算法笔记】广度优先搜索算法（BFS, breadth-first search）'
Author: Mango
tags:
  - Algorithm
categories:
  - 算法
abbrlink: f9717167
date: 2026-01-26 17:34:15
---

**标签**: #图算法 #搜索算法 #中等难度 #路径查找 #连通性分析

**#核心思想:** 从起始节点开始，逐层向外扩展探索所有可达节点，确保先访问距离起点更近的节点。

**#算法原理:**
BFS通过队列实现层次遍历，首先将起始节点入队并标记已访问，然后不断从队列中取出节点，访问其所有未访问的相邻节点并入队，重复此过程直到队列为空。

**#复杂度分析**

- **时间复杂度**: O(V + E)，其中V为顶点数，E为边数
- **空间复杂度**: O(V)，最坏情况下需要存储所有节点

**#代码实现:**

```c++
#include <queue>
#include <vector>
#include <unordered_set>
using namespace std;

void BFS(int startNode, vector<vector<int>>& graph) {
    int n = graph.size();
    vector<bool> visited(n, false);
    queue<int> q;

    q.push(startNode);
    visited[startNode] = true;

    while (!q.empty()) {
        int currentNode = q.front();
        q.pop();

        // 处理当前节点
        cout << "访问节点: " << currentNode << endl;

        // 遍历所有邻居节点
        for (int neighbor : graph[currentNode]) {
            if (!visited[neighbor]) {
                visited[neighbor] = true;
                q.push(neighbor);
            }
        }
    }
}
```

**#执行流程图:**

```
开始 → 起始节点入队 → 队列非空? → 是 → 出队并访问 → 所有未访问邻居入队
                              ↓
                              否 → 结束
```

**#适用场景:**

- 无权图的最短路径查找
- 连通分量检测
- 层级遍历树或图结构
- 迷宫求解问题
- 社交网络中的好友推荐

**#优缺点:**

- ✅ 优点：能找到最短路径（在无权图中），实现简单
- ❌ 缺点：空间复杂度较高，不适合深度很大的图

**#变种与改进:**

- 双向BFS：从起点和终点同时开始搜索
- 启发式BFS：结合估价函数优化搜索方向
- 多源BFS：从多个起点同时开始搜索

**#注意事项:**

- 必须标记已访问节点，避免重复访问和死循环
- 对于大规模图，需要注意队列的内存使用
- 在加权图中BFS不能保证找到最短路径

**#参考资料:**

[BFS - GeeksforGeeks](https://www.geeksforgeeks.org/breadth-first-search-or-bfs-for-a-graph/)

[BFS - Bilibili ](https://www.bilibili.com/video/BV1uCH1eoEYP/?spm_id_from=333.337.search-card.all.click)
