---
title: Markdown 学习笔记
abbrlink: d87f7e0c
date: 2026-01-22 17:18:28
Author: Mango
tags:
  - Markdown
categories:
  - 学习笔记
---

**Markdown**是一种轻量级标记语言，排版语法简洁，让人们更多地关注内容本身而非排版。它使用易读易写的纯文本格式编写文档，可与HTML混编，可导出 `HTML`、`PDF` 以及本身的` .md` 格式的文件。因简洁、高效、易读、易写，Markdown被大量使用，如[Github](https://github.com "你好呀")**、**`Wikipedia`**、**`简书`\*\*等。

## 标题语法（`#`）

要创建标题，请在单词或短语前面添加井号 (`#`) 。`#` 的数量代表了标题的级别。

不同的 Markdown 应用程序处理 # 和标题之间的空格方式并不一致。为了兼容考虑，请用一个空格在 # 和标题之间进行分隔。

## 段落语法

**不要用空格（spaces）或制表符（ tabs）缩进段落。**

## 换行语法（`<br>`）

在一行的末尾添加两个或多个空格，然后按回车键,即可创建一个换行(`<br>`)。

几乎每个 Markdown 应用程序都支持两个或多个空格进行换行，称为 `结尾空格（trailing whitespace)` 的方式，但这是有争议的，因为很难在编辑器中直接看到空格，并且很多人在每个句子后面都会有意或无意地添加两个空格。由于这个原因，你可能要使用除结尾空格以外的其它方式来换行。幸运的是，几乎每个 Markdown 应用程序都支持另一种换行方式：HTML 的 `<br>` 标签。

## 强调语法(`*`)

### 粗体（\*\*）

要加粗文本，请在单词或短语的前后各添加两个星号\*\*（asterisks）。如需加粗一个单词或短语的中间部分用以表示强调的话，请在要加粗部分的两侧各添加两个星号（asterisks）。

**加粗文字**

### 斜体（\*）

要用斜体显示文本，请在单词或短语前后添加一个星号（asterisk）。要斜体突出单词的中间部分，请在字母前后各添加一个星号，中间不要带空格。

_斜体文字_

### 粗体&斜体（\*\*\*）

要同时用粗体和斜体突出显示文本，请在单词或短语的前后各添加三个星号或下划线。要加粗并用斜体显示单词或短语的中间部分，请在要突出显示的部分前后各添加三个星号，中间不要带空格。

## 引用语法(`>`)

要创建块引用，请在段落前添加一个 `>` 符号。

#### 多个段落的块引用

块引用可以包含多个段落。为段落之间的空白行添加一个 > 符号。

#### 嵌套块引用

块引用可以嵌套。在要嵌套的段落前添加一个 >> 符号。

## 列表语法(`1.` `- * +`)

### 有序列表

要创建有序列表，请在每个列表项前添加数字并紧跟一个英文句点。数字不必按数学顺序排列，但是列表应当以数字 1 起始。

1. hhh
2. hhh
3. hhh

### 无序列表

要创建无序列表，请在每个列表项前面添加破折号 (-)、星号 (\*) 或加号 (+) 。缩进一个或多个列表项可创建嵌套列表。

### 在列表中嵌套其他元素

要在保留列表连续性的同时在列表中添加另一种元素，请将该元素缩进**四个空格**或**一个制表符（tab）**。

## 代码语法(```)

要将单词或短语表示为代码，请将其包裹在反引号 (```) 中。

| Markdown语法                          | HTML                                             | 预览效果                            |
| ------------------------------------- | ------------------------------------------------ | ----------------------------------- |
| `At the command prompt, type `nano`.` | `At the command prompt, type <code>nano</code>.` | At the command prompt, type `nano`. |

### 转义反引号

如果你要表示为代码的单词或短语中包含一个或多个反引号，则可以通过将单词或短语包裹在双反引号(````)中。

| Markdown语法                          | HTML                                             | 预览效果                            |
| ------------------------------------- | ------------------------------------------------ | ----------------------------------- |
| ``Use `code` in your Markdown file.`` | `<code>Use `code` in your Markdown file.</code>` | `Use `code` in your Markdown file.` |

### [#](https://markdown.com.cn/basic-syntax/code.html#代码块)代码块

要创建代码块，请将代码块的每一行缩进至少四个空格或一个制表符。

```text
    &lt;html>
      &lt;head>
      &lt;/head>
    &lt;/html>
```

渲染效果如下：

```text
&lt;html>
  &lt;head>
  &lt;/head>
&lt;/html>
```

**Note:** 要创建不用缩进的代码块，请使用 [围栏式代码块（fenced code blocks）](https://markdown.com.cn/extended-syntax/fenced-code-blocks.html).

## 分割线语法(`***` `---` `___`)

要创建分隔线，请在单独一行上使用三个或多个星号 (`***`)、破折号 (`---`) 或下划线 (`___`) ，并且不能包含其他内容。

示例：

---

---

---

## 链接语法(`[]("")`)

链接文本放在中括号内，链接地址放在后面的括号中，链接title可选。

超链接Markdown语法代码：`[超链接显示名](超链接地址 "超链接title")`

### 给链接加定义

链接title是当鼠标悬停在链接上时会出现的文字，这个title是可选的，它放在圆括号中链接地址后面，跟链接地址之间以空格分隔。lg：[Markdown语法](https://markdown.com.cn "最好的markdown教程")

### 网址和Email地址

使用尖括号（<>）可以很方便地把URL或者email地址变成可点击的链接。

<https://markdown.com.cn>

### 带格式化的链接

[强调](https://markdown.com.cn/basic-syntax/links.html#emphasis) 链接, 在链接语法前后增加星号。 要将链接表示为代码，请在方括号中添加反引号。

```text
I love supporting the **[EFF](https://eff.org)**.
This is the *[Markdown Guide](https://www.markdownguide.org)*.
See the section on [`code`](#code).
```

渲染效果如下：

I love supporting the **[EFF (opens new window)](https://eff.org/)**.
This is the _[Markdown Guide (opens new window)](https://www.markdownguide.org/)_.
See the section on [`code`](https://markdown.com.cn/basic-syntax/links.html#code).

### 引用类型链接

#### 链接的第一部分格式

引用类型的链接的第一部分使用两组括号进行格式设置。第一组方括号包围应显示为链接的文本。第二组括号显示了一个标签，该标签用于指向您存储在文档其他位置的链接。

尽管不是必需的，可以在第一组和第二组括号之间包含一个空格。第二组括号中的标签不区分大小写，可以包含字母，数字，空格或标点符号。

以下示例格式对于链接的第一部分效果相同：

- `[hobbit-hole][1]`
- `[hobbit-hole] [1]`

#### 链接的第二部分格式

引用类型链接的第二部分使用以下属性设置格式：

1. 放在括号中的标签，其后紧跟一个冒号和至少一个空格（例如`[label]:`）。
2. 链接的URL，可以选择将其括在尖括号中。
3. 链接的可选标题，可以将其括在双引号，单引号或括号中。

以下示例格式对于链接的第二部分效果相同：

- `[1]: https://en.wikipedia.org/wiki/Hobbit#Lifestyle`
- `[1]: https://en.wikipedia.org/wiki/Hobbit#Lifestyle "Hobbit lifestyles"`
- `[1]: https://en.wikipedia.org/wiki/Hobbit#Lifestyle 'Hobbit lifestyles'`
- `[1]: https://en.wikipedia.org/wiki/Hobbit#Lifestyle (Hobbit lifestyles)`
- `[1]: <https://en.wikipedia.org/wiki/Hobbit#Lifestyle> "Hobbit lifestyles"`
- `[1]: <https://en.wikipedia.org/wiki/Hobbit#Lifestyle> 'Hobbit lifestyles'`
- `[1]: <https://en.wikipedia.org/wiki/Hobbit#Lifestyle> (Hobbit lifestyles)`

可以将链接的第二部分放在Markdown文档中的任何位置。有些人将它们放在出现的段落之后，有些人则将它们放在文档的末尾（例如尾注或脚注）。

## 图片语法(`![]( "")`)

要添加图像，请使用感叹号 (`!`), 然后在方括号增加替代文本，图片链接放在圆括号里，括号里的链接后可以增加一个可选的图片标题文本。

插入图片Markdown语法代码：`![图片alt](图片链接 "图片title")`。

## 转义字符语法（`\`）

要显示原本用于格式化 Markdown 文档的字符，请在字符前面添加反斜杠字符 \ 。

## 内嵌HTML标签

没啥特殊作用，可以不用（知道markdown语法和HTML可以级联就好）
