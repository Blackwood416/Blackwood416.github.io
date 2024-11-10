---
title: C#高级技巧 03
date: 2024-09-28 20:29:01
tags: C#
categories: 开发
---

## Lambda表达式

Lambda表达式是C# 3.0引入的新特性，它允许我们在代码中定义匿名函数，并将其赋值给变量。

Lambda表达式的语法如下：

```csharp
(input parameters) => expression
```

1. `input parameters`：输入参数，可以是0个或多个。
2. `=>`：箭头，表示将输入参数映射到表达式。
3. `expression`：表达式，可以是任意有效的C#代码。

举个例子：

```csharp
Func<int, int, int> add = (x, y) => x + y;
int result = add(1, 2); // result = 3
```

上面的代码定义了一个匿名函数，它接受两个int型参数，并返回它们的和。然后将这个匿名函数赋值给一个变量`add`，并调用它，得到结果3。

Lambda表达式的好处是可以简化代码，使代码更加简洁，更易于阅读。而且它提供了一种创建匿名函数的便捷方式。不需要为函数命名时，可以直接使用Lambda表达式。

## Lambda表达式类型推断

