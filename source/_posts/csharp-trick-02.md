---
title: C#高级技巧 02
date: 2024-03-11 20:11:39
tags: C#
categories: 开发
---

## Switch表达式

C#的表达式那可谓一绝，今天就来讲讲switch表达式。

学过C语言的人可能觉得switch的用处比较少，用的没if...else那么频繁，但是在C#里有了switch表达式后，switch可以说是又方便，可读性又高，不考虑性能的话能在很多情况下代替if...else。

## 语法

var result = expression switch
{
    case pattern1 when condition1: result1,
    case pattern2 when condition2: result2,
   ...
    case patternN when conditionN: resultN,
    _ => defaultResult
};

- expression：表达式，可以是任何类型，switch表达式会根据表达式的值来决定执行哪个case。
- pattern：模式，可以是任何类型，可以是一个值，也可以是一个范围。
- condition：条件，可以是一个表达式，只有当表达式为true时才执行对应的case。
- result：结果，可以是任何类型，当表达式的值与pattern匹配时，就会返回对应的result。
- defaultResult：默认结果，当表达式的值与所有pattern都不匹配时，就会返回默认结果。

## 注意事项

- switch表达式必须包含至少一个case，否则会报错。
- case的顺序很重要，如果有多个case匹配，则只会执行第一个匹配的case。


## 常用写法

```csharp
public int GetNumber(string input)
{
    return input switch
    {
        "one" => 1,
        "two" => 2,
        "three" => 3,
        _ => 0
    };
}
```
switch表达式最常见的用法就是用于返回特定值的方法。

也可以简化成Lambda表达式的形式：

```csharp
public int GetNumber(string input) => input switch
{
    "one" => 1,
    "two" => 2,
    "three" => 3,
    _ => 0
}
```

这样的写法非常简洁。