---
title: web开发日志 01
date: 2023-01-24 14:15:10
tags: web
---

# web开发日志 01

虽说国内有用app取代web网站的趋势，但是各类web技术在当今时代仍然是不可或缺的。本系列博客从web三大件（HTML、CSS、JavaScript）入手，逐渐深入浏览器、web开发语言、web引擎、数据库、web框架等内容。

# HTML

HTML(HyperText Markup Language)是一种用来组织web网页的语言。它用各种 **标记(tag)** 来组织网页的内容。

我们创建一个名字为 **test.html** 的文件，用文本编辑器将其打开，在其中写入：
```html
<!DOCTYPE html>
<html>
    <head>
        <title>This is a title</title>
    </head>
    <body>
        <h1>H1 text</h1>
    </body>
</html>
```
保存文件后把文件拖到浏览器里，浏览器的标签页上会显示  **This is a title** ,而页面内会显示一个大大的 **H1 text** 。

我们从第一行开始看起：

`<!DOCTYPE html>`这行是让浏览器按照w3c的标准方式来处理这个html文件，而不是用浏览器自己的方式，这可以防止你的网页在不同浏览器上出现显示差异。这其实跟Linux上的shell脚本有点类似，即在文件首行预先声明该用哪种方式处理该文件。

接下来的`<html>`  `<head>`  `<title>` `<body>`和`<h1>`都是HTML标签，或者也能叫作HTML元素，因为它们都有着与其对应的另一半，即有着开始标签和结束标签。

其中被`<html></html>`包围的内容即为网页的所有内容，被`<head></head>`包围的是网页的元(meta)数据，被`<title></title>`包围的是网页的标题，被`<body></body>`包围的是网页的内容主体，而`<h1></h1>`中的内容是一个大标题。

了解了一个HTML网页的基本结构后，我们接下来来了解各种HTML标签。

