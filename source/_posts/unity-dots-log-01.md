---
title: Unity Dots 学习日志 01
date: 2023-07-06 20:55:55
tags: unity
categories: 开发
---

# Unity Dots 学习日志 01

我想用这篇博客来记录一下我学习使用Unity Dots来开发Unity 3D游戏的过程，我们将使用Unity Dots来开发一个FPS射击游戏的原型。

# Dots 相关概念

首先我们来了解一些Unity Dots的相关概念，它与传统的Unity技术栈有何不同？

## 面向数据设计（Data-Oriented Design）

**Data-Oriented Design**简称**DOD**，是不同于面向对象编程/设计（Object-Oriented Programming / Design）的一种新兴的程序设计方法。

从字面上来看，DOD 从数据的角度来进行设计，而 OOD 则从对象的角度来进行设计。所以DOD 比OOD 更适合处理大量的数据，这刚好符合当代电子游戏的发展所带来的高性能需求。

但是DOD 缓存友好的优点也使其更难编写和理解，需要开发者具备良好的计算机基础，熟悉内存（memory）、缓存（cache）等概念。

## Entities

**Entities**是Unity Dots 的核心包，也是我们使用Dots 技术栈所主要学习的包。

## ECS

**Entity Component System**是Entities 的核心架构，Entities 采用此架构来组织代码和数据。

### Entity

根据官方文档中的描述，Entity 就像与它所关联的Component 的ID 一样，我们可以也把它看作C 语言中的指针。

Entity 的集合被存储在World 中，World 中的EntityManager 管理世界中的所有实体。

EntityManager 包含了用于创建、销毁和修改World 中的Entity 的方法。

| 方法 | 描述 |
| :- | :- |
| CreateEntity | 创建Entity |
| Instantiate | 从已经存在的Entity拷贝出新的Entity |
| DestroyEntity | 销毁已经存在的Entity |
| AddComponent | 将Component添加至已经存在的Entity |
| RemoveComponent | 移除已经存在的Entity的Component |
| GetComponent | 检索Entity的Component值 |
| SetComponent | 覆盖Entity的Component值 |

> 注意：当创建或销毁Entity 时，会引发了一个**Structural Change**，这会对性能产生影响。

Entity 没有类型，但是可以使用与它们相关联的Component 来归类它们。

### Component



### System

### World

### Archetypes



### Structural changes

### Safety in Entities

# 参考资料
[Unity Dots官方文档（没中文）](https://docs.unity3d.com/Packages/com.unity.entities@1.0/manual/index.html)
[Unity Dots官方GitHub示例（没中文）](https://github.com/Unity-Technologies/EntityComponentSystemSamples)
[Unity 官方中文文档](https://docs.unity.cn/cn/2022.3/Manual/UnityManual.html)
