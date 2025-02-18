---
title: C#高级技巧 01
date: 2024-02-22 22:48:46
tags: C#
categories: 开发
---

## 写文目的

众所周知C#是语法糖最多的一门编程语言，而我们肯定是不能记住所有语法糖的，所以我就想新开一个系列的博客来记录一下我学过的语法糖。

## 字符串

C#的字符串花样太多了。我们首先讲点简单的。

从古至今，字符串处理对程序员来说都是个很掉头发的问题，更别说有的语言字符串适配本身就是依托答辩，我们今天就来讲讲C#中那些字符串相关的语法糖。

### 字符串内插

字符串内插是C#中一个很有用的语法糖。我们可以用`${}`来表示一个变量，然后在字符串中插入这个变量。

```csharp
string name = "Tom";
string message = $"Hello, {name}";
Console.WriteLine(message); // Output: Hello, Tom
```

### 字符串拼接

字符串拼接也是一个很常用的语法糖。我们可以用`+`来拼接字符串。

```csharp
string name = "Tom";
string message = "Hello, " + name;
Console.WriteLine(message); // Output: Hello, Tom
```

### 字符串格式化

字符串格式化也是一个很常用的语法糖。我们可以用`string.Format()`来格式化字符串。

```csharp
string name = "Tom";
string message = string.Format("Hello, {0}", name);
Console.WriteLine(message); // Output: Hello, Tom
```

### 字符串切片

字符串切片也是一个很常用的语法糖。我们可以用`[start..end]`来切片字符串。

```csharp
string name = "Tom";
string message = name[1..3];
Console.WriteLine(message); // Output: o
```

### 原始字符串

原始字符串也是一个很有用的语法糖。我们可以用`@`来表示一个字符串是原始字符串，这样就可以在字符串中使用转义字符。

```csharp
string message = @"Hello, \nTom";
Console.WriteLine(message); // Output: Hello, \nTom
```