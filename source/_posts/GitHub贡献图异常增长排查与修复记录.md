---
title: GitHub贡献图异常增长排查与修复记录
Author: Mango
top_img: transparent
tags:
  - git
  - Research
  - Blog
  - Code
categories:
  - 梦啥说啥
abbrlink: 33a96c5a
date: 2026-05-11 22:57:40
cover:
---
## 摘要

这次问题的表象是：GitHub 贡献图里 `Mango03111/Mango03111.github.io` 仓库的 commit contributions 不断上涨，早期看起来像是 3 月 11 日单日统计异常，后来发现所有与这个博客仓库相关的提交日期都在按不同倍数增长。最终确认：博客仓库存在 **源码分支 `hexo`** 和 **部署分支 `main`** 两套历史；`main` 原本既是 GitHub Pages 发布分支，又是仓库默认分支。GitHub 会把默认分支上的 commit 纳入贡献统计，因此部署产物分支上的 `Site updated` 提交被计入贡献图。再叠加 GitHub Pages / Actions 的构建触发，贡献图出现了逐步重复计数的现象。

> 关键词：GitHub Contributions、GitHub Pages、Hexo、默认分支、部署分支、Actions、`pages-build-deployment`、`.deploy_git`

最终有效处理是：

1. 关闭仓库 GitHub Actions 后，异常贡献不再继续上涨。
2. 将仓库默认分支从部署分支 `main` 切换为源码分支 `hexo` 后，贡献图恢复正常。
3. 保持 GitHub Pages 发布源仍指向 `main / root`，让 `main` 只承担部署产物分支的角色，而不再作为默认分支参与主要贡献统计。

![1015X591/github-contrib-fix-05.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260511/MCst/1015X591/github-contrib-fix-05.png)

配图：默认分支切换到 `hexo` 后，贡献图恢复到较正常状态。

---

## 问题背景

仓库：`Mango03111/Mango03111.github.io`

用途：个人博客 / GitHub Pages 站点。

本地博客目录实际存在两个 Git 仓库：

- `Mango03111.github.io`：博客源码仓库，当前分支为 `hexo`。
- `.deploy_git`：Hexo 生成后的静态站点部署仓库，当前分支为 `master`，通常由 Hexo deploy 流程推送到远程发布分支。

![443X945/github-contrib-fix-04.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260511/p4HQ/443X945/github-contrib-fix-04.png)

配图：VS Code 源代码管理视图里可以看到两个 Git 仓库：源码仓库和 `.deploy_git` 部署仓库。

这是一种常见的 Hexo 博客结构：

```text
hexo 分支 / 源码仓库
  保存 Markdown、主题、配置、package-lock 等源码内容

.deploy_git / 部署仓库
  保存 Hexo 生成后的静态文件
  push 到 GitHub Pages 发布分支 main
```

---

## 最初看到的异常

最开始发现的是 GitHub 贡献图里某一天的贡献数持续增加，尤其是 3 月 11 日。

![1161X313/github-contrib-fix-01.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260511/fq5x/1161X313/github-contrib-fix-01.png)

配图：贡献图中 3 月 11 日显示异常高的贡献数。

在 Contribution activity 里，GitHub 显示这一天主要贡献主要来自 `Mango03111/Mango03111.github.io`。当时第一反应是：是不是 `main` 分支真有这么多 commit？但很快发现并不是。

---

## 第一轮排查：确认不是 main 分支真实 commit 数量

本地检查结果显示：

```powershell
git rev-list --count origin/main
# 71
```

也就是说，`origin/main` 总 commit 数只有 71，不可能单日贡献 108 个 commit。

随后继续检查远程分支：

```powershell
git branch -r
# origin/HEAD -> origin/main
# origin/hexo
# origin/main

git ls-remote --heads origin
# refs/heads/hexo
# refs/heads/main

git rev-list --all --count
# 165
```

可见远程只有 `main` 和 `hexo` 两个分支，没有 `gh-pages`。

进一步检查 3 月 11 日的 author date 和 commit date：

```powershell
(git log --all --format="%h | AuthorDate:%aI | CommitDate:%cI | Refs:%D | %s" | Select-String "AuthorDate:2026-03-11").Count
# 21

(git log --all --format="%h | AuthorDate:%aI | CommitDate:%cI | Refs:%D | %s" | Select-String "CommitDate:2026-03-11").Count
# 21
```

![2019X974/github-contrib-fix-02.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260511/4Tbu/2019X974/github-contrib-fix-02.png)

配图：本地 PowerShell 检查结果显示，所有可见分支里 3 月 11 日只有 21 个相关 commit。

这个结果说明：当前可见 Git 历史中，3 月 11 日并没有 GitHub 贡献图显示的那么多 commit。

---

## 曾经走过的误区

### 误以为是 `gh-pages` 分支

GitHub 贡献统计通常会考虑默认分支和 `gh-pages` 分支。因此一开始怀疑是否存在 `gh-pages` 分支，但远程分支检查显示不存在。

### 误以为是 Deployments 本身算贡献

仓库右侧显示有大量 Deployments，于是怀疑 deployment 是否被算作 contribution。但后续判断中排除了这一点：deployment / workflow run / check run 本身不应该作为 commit contribution 计数。

真正的问题更像是：部署流程触发了 GitHub 后台对该仓库 contribution index 的重新处理。

### 误以为是 `hexo` 分支被统计

仓库里确实有 `hexo` 分支，所以也怀疑是不是 `main + hexo` 两套 commit 被一起统计。后来确认：`hexo` 分支当时没有被统计，异常主要来自默认分支 `main`。

### 误以为是 commit 上的 checks 数量导致翻倍

有些 commit 显示 `4/4` checks，有些显示 `1/1` checks。


这看起来像是某些 commit 被计算了多次，但事实上这些只是状态检查 / 部署检查。一个 commit 有 4 个 checks，并不等于 4 个 commit contributions。

---

## 异常规律逐渐清晰

继续观察后，问题不再只是 3 月 11 日。

新的规律是：

- 并非只有 3 月 11 日贡献数上涨，而是所有曾经 commit 过 `Mango03111.github.io` 的日期都在上涨。
- 某些日期贡献数刚好是实际 commit 数的整数倍。
- 越早的日期翻倍越明显：例如 2 月某些日期翻得更多，3 月次之，4 月较少，最近日期可能只翻 2 倍。
- 甚至出现过当前可见历史中某天没有实际 commit，但贡献图仍显示该仓库有贡献。

这说明它不像单纯的日期偏移，而更像是贡献图在重复计入旧记录或部署分支记录。

---

## Actions 与 Pages 的关键线索

仓库 Actions 页面里有大量 `pages-build-deployment` 记录。

![2048X1066/github-contrib-fix-03.png](https://a.tuchuangyun.top/autoupload/sGsLTdNbILw_FMc-EyyWvNiO_OyvX7mIgxFBfDMDErs/20260511/50ey/2048X1066/github-contrib-fix-03.png)

配图：Actions 中存在大量 `pages-build-deployment` 记录。

点开具体 run 后可以看到，它们由 `dynamic` 触发，并绑定到 `main` 分支上的 commit。一开始怀疑这些 workflow run 是否绑定了历史 commit。后续检查发现：每个 action 都只对应当天发布的 commit，没有直接绑定历史 commit。

因此更合理的判断是：

```text
Action run 本身不是贡献；
但 GitHub Pages / Actions 的构建部署流程可能触发了 GitHub 后台重新处理该仓库的贡献索引；
当 main 作为默认分支时，main 上的部署 commit 被纳入统计，进而出现重复计数或旧记录回流。
```

---

## 第一个有效止血动作：关闭 GitHub Actions

后来尝试关闭仓库 GitHub Actions。关闭两天后观察到：贡献图不再继续异常上涨。

这一步非常关键，因为它说明异常上涨和 Actions / Pages build 触发链路有关。

关闭 Actions 后，GitHub Pages 设置页出现警告，提示 Pages 站点需要构建步骤，而 Actions 当前不可用。这说明之前 Pages 的发布流程确实依赖 Actions / Pages build。关闭 Actions 会影响 Pages 自动构建，但也确实停止了贡献图异常继续上涨。

---

## 开启 Actions 后的风险

再次打开 Actions 后，历史 workflow run 不会因为列表存在就自动全部重跑，但新的 push、Pages 设置变更、手动 re-run 或 Pages 补构建都有可能触发新的 `pages-build-deployment`。因此，不应频繁切换 Actions，也不要手动点击 `Re-run all jobs`。否则可能再次触发 Pages build 流程，增加贡献图重新处理的机会。

---

## 最终突破：默认分支不应该是部署分支

最后发现最关键的问题：仓库默认分支是 `main`，而 `main` 实际上是 Hexo 的部署产物分支。

GitHub contribution graph 的 commit 贡献统计与默认分支关系很大。若 `main` 是默认分支，那么 Hexo 部署生成的 `Site updated` 提交会被视为默认分支上的提交，从而计入贡献图。

把默认分支从 `main` 切换到 `hexo` 后，贡献图恢复正常。

这说明：

```text
main：部署分支，保存生成后的静态站点，不适合作为默认分支
hexo：源码分支，保存博客源文件，适合作为默认分支
```

修复后的结构：

```text
默认分支：hexo
  用于日常写作、维护源码、查看仓库首页

Pages 发布源：main / root
  用于 GitHub Pages 发布静态站点

GitHub Actions：谨慎开启，建议保持关闭或避免触发 Pages build
```

---

## 最终结论

这次问题不是单一原因造成的，而是多个因素叠加：

1. 博客仓库采用 Hexo 双 Git 结构：源码分支 `hexo` + 部署产物分支 `main`。
2. 部署分支 `main` 曾被设置为默认分支。
3. GitHub contribution graph 会统计默认分支上的 commit。
4. `main` 上的 `Site updated` 提交本质上是部署产物 commit，却被当成默认分支贡献计入。
5. GitHub Pages / Actions 的 `pages-build-deployment` 流程可能进一步触发贡献索引重新处理，导致历史贡献持续上涨或重复计数。
6. 关闭 Actions 后，异常增长停止。
7. 将默认分支从 `main` 切到源码分支 `hexo` 后，贡献图恢复正常。

一句话总结：

> **不要把博客部署产物分支当默认分支。源码分支做默认分支，部署分支只负责发布。**

---

## 可复现排查清单

### 检查远程分支

```powershell
git branch -r
git ls-remote --heads origin
```

### 检查默认分支 commit 总数

```powershell
git rev-list --count origin/main
```

### 检查所有可见分支 commit 总数

```powershell
git rev-list --all --count
```

### 按 author date 检查某天 commit 数

GitHub profile 上 commit 日期主要按 author date 归类，因此应该优先查 AuthorDate。

```powershell
(git log --all --format="%h | AuthorDate:%aI | CommitDate:%cI | Refs:%D | %s" | Select-String "AuthorDate:2026-03-11").Count
```

### 按 commit date 检查某天 commit 数

```powershell
(git log --all --format="%h | AuthorDate:%aI | CommitDate:%cI | Refs:%D | %s" | Select-String "CommitDate:2026-03-11").Count
```

### 分别检查 main 和 hexo

```powershell
(git log origin/main --format="%h | AuthorDate:%aI | CommitDate:%cI | %s" | Select-String "2026-05-07").Count

(git log origin/hexo --format="%h | AuthorDate:%aI | CommitDate:%cI | %s" | Select-String "2026-05-07").Count
```

---

## 最终操作步骤

### 先备份仓库

```powershell
git clone --mirror https://github.com/Mango03111/Mango03111.github.io.git Mango03111.github.io.backup.git
```

### 关闭或谨慎使用 GitHub Actions

路径：

```text
Repository → Settings → Actions → General → Actions permissions
```

建议在问题稳定前选择：

```text
Disable actions
```

如果必须开启，也不要手动 re-run `pages-build-deployment`，并观察贡献图是否再次异常。

### 将默认分支切换为源码分支 `hexo`

路径：

```text
Repository → Settings → Branches → Default branch → Switch to another branch → hexo
```

切换后：

- 仓库首页默认展示 `hexo` 源码分支。
- `main` 仍可作为 GitHub Pages 发布分支。
- `main` 上的部署产物 commit 不再作为默认分支 commit 被贡献图重点统计。

### 保持 Pages 发布源为 `main / root`

路径：

```text
Repository → Settings → Pages → Build and deployment → Source: Deploy from a branch → main / root
```

默认分支和 Pages 发布源是两个不同概念。默认分支可以是 `hexo`，Pages 发布源仍可以是 `main / root`。

---

## 后续建议

### 保持分工清晰

```text
hexo：源码分支，作为默认分支
main：部署分支，只放生成后的静态文件
```

### 不要频繁改写历史

尤其不要对已经 push 到 GitHub 的 commit 反复 rebase、amend、改日期、force push。即使只改某一天的日期，也可能重写后续 commit 的 SHA，让 GitHub contribution index 出现旧记录和新记录并存的复杂情况。

### 不要用 public/private 反复切换当修复方法

把仓库改 private 并关闭 private contributions，可能会让贡献图短暂变化，但这更像是刷新显示过滤条件，不是清理底层贡献索引。之前尝试过该方法，改回 public 后贡献图仍会继续变化。

### 避免 GitHub Pages 和 Vercel 双重触发

如果使用 Vercel 部署博客，可以考虑不再启用 GitHub Pages build。若使用 GitHub Pages，则尽量保证 Pages 发布链路简单、稳定，不要频繁重跑 Actions。

### 观察一段时间

修复后至少观察 48 小时到一周，确认贡献图不再继续异常上涨。

---

## 参考资料

- GitHub Docs：Profile contributions reference  
  https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference

- GitHub Docs：Managing GitHub Actions settings for a repository  
  https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository

- GitHub Docs：Changing the default branch  
  https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/changing-the-default-branch

- GitHub Docs：Configuring a publishing source for your GitHub Pages site  
  https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
