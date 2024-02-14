---
title: Kotlin 学习日志 01
date: 2024-02-12 22:41:43
tags: Kotlin
categories: 开发
---

## Kotlin 是什么

Kotlin是一门高级编程语言，多的不说，主要用于替代Java进行安卓开发，现在由JetBrains维护。

## Hello World!

学一门语言，先学Hello World。

Kotlin的Hello World相比Java简单了不少：

```kt
fun main()
{
    println("Hello World!")
}
```

跟很多其他高级语言一样，普通的kotlin以main为入口函数，**fun**则是函数的关键字，函数需要花括号包裹，kotlin内置了**print**和**println**这两个函数作为输出函数，后者输出时会自动在末尾添加一个换行符，函数的调用是使用圆括号。

下一篇学习Kotlin的基本语法。