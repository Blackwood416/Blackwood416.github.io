---
title: Unity Dots 学习日志 04
date: 2023-10-08 10:31:42
tags: Unity
categories: 开发
---

## Dots踩坑记录

因为我们要把输入存为IComponentData支持的类型，所以我们需要使用ReadValue<T>来从InputAction中读取值，但是这里会遇到一个问题，当你只需要判断按键是否被按下时，你不能用到Button的那几个状态，因为IComponentData不支持。

翻看官方文档无果后经过搜索，我找到了Unity论坛里对这件事的讨论，其中有一位指出了Button的返回值是float类型，当按下时为1，未按下时为0，所以我们只需要`ReadValue<float>`即可将按键的按下状态存储为Component了。
