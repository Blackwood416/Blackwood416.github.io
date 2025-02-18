---
title: Octave 学习日志 01
date: 2024-11-21 12:57:31
tags: Octave
categories: 科学计算与数据处理
---

## Octave 是什么？

Octave 是 GNU 旗下的一款开源的数值计算和图形绘制软件，支持多个领域的数值计算，可以说它是 Matlab 的开源免费的替代品。

## Octave 与 Matlab 的区别

Octave 更加轻量化，Matlab 全量安装需要占用 20GB 的空间，而 Octave 本体+依赖只需要数百 MB 的空间。

Octave 语法大致与 Matlab 兼容，但在具体的函数和参数上有一些区别。

最重要的一点是，Octave 是免费的，而 Matlab 是收费的。

## Octave 下载与安装

我们在 Kali Linux 下安装 Octave，可以使用包管理器安装：

```bash
sudo apt update
sudo apt install octave -y
```

安装完成后，我们可以使用命令 `octave` 打开 Octave 交互式环境。

## Octave 基本语法

### 输出

Octave 支持 `disp` 函数输出变量的值。

```octave
disp("Hello, world!");
```

### 输入

Octave 支持 `input` 函数从用户输入获取值。

```octave
name = input("What is your name? ");
disp("Hello, " + name + "!");
```

### 注释

Octave 支持单行注释和多行注释，单行注释以 `%` 或 `#` 开头，多行注释以块的形式组织，以 `%{` 和 `%}` 包围（或者`#{` 和 `#}` 包围）。
```octave
% This is a single line comment
# This is also a single line comment

%{
This is a multi-line comment
It can span multiple lines
%}

#{
This is also a multi-line comment
It can span multiple lines
#}
```

### 变量

Octave 中变量的声明和赋值使用 `=` 符号。

```octave
a = 1;
b = "hello";
c = [1 2 3];
```

### 分号

Octave 中虽然语句后面的分号不是必须的，但是加上分号，Octave 就不会直接输出语句的结果，这样可以让输出更加整洁，减少冗余的输出。

### 表达式

Octave 支持基本的算术运算、逻辑运算、比较运算、赋值运算、函数调用等。

```octave
a = 1 + 2 * 3 / 4;
b = 1 == 2;
c = sin(pi / 4);
d = a = b;
```

### 控制语句

Octave 支持 `if-else` 语句、`for`和`while`循环语句、函数定义语句等。

```octave
if a > 0
    disp("a is positive");
elseif a == 0
    disp("a is zero");
else
    disp("a is not positive");
end

for i = 1:10
    disp(i);
end

while a < 10
    a = a + 1;
end

switch (X)
  case 1
    do_something ();
  case 2
    do_something_else ();
  otherwise
    do_something_completely_different ();
end

```

### 函数

Octave 支持自定义函数，函数的定义使用 `function` 关键字。

```octave
function myfun()
    disp("Hello, world!");
end
```

### 绘图

Octave 支持绘制 2D 图形，包括折线图、散点图、直方图、饼图等。

```octave
x = [1 2 3 4 5];
y = [1 4 9 16 25];
plot(x, y);
```
#### 保存图片

Octave 可以保存图片到文件，支持多种格式，包括 PNG、JPEG、EPS、PDF、SVG 等。

```octave
print -dpng "myplot.png"
```

## 结尾

作为第一次接触 Octave 的记录，就先写这么多吧，后续再学习和分享一些高级用法。