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

从字面上来看，DOP 从数据的角度来进行程序设计，而 OOP 则从对象的角度来进行程序设计。DOP 比OOP 更适合处理大量的数据，这刚好符合当代电子游戏的发展所带来的高性能需求。

但是DOP 缓存友好的优点也使使用它的代码更难编写和理解，需要开发者具备良好的计算机基础，熟悉内存（memory）、缓存（cache）等概念。

## Entities

**Entities**是Unity Dots 的核心包，也是我们使用Dots 技术栈所主要学习的包。

## ECS

**Entity Component System**是Entities 的核心架构，Entities 采用此架构来组织代码和数据。

### Entity

总而言之，Entity类似于GameObject，它可以挂载一个或多个Component。
创建或者销毁一个Entity会引发**structrual change**，具体我们后面再说。所有的Entity都由World中的**EntityManager**来管理。
Entity没有类型，但是可以通过与其相关的Components来分类。
EntityManager会记录已存在的Entity所具有的Components的集合，这些Components集合被称为**Archetypes**，我们后面也会讲到。

### Component

Component是用来给**System**读写的数据。

继承自接口**IComponentData**的结构体会被标记为Component类型。这种Component类型只储存非托管类型的数据，虽然这种Component可以储存方法，但是最好还是只储存纯净的数据。

当然也可以创建一个储存托管类型的Component，但是弊大于利，这里就不提了。

上面提到Entity所具有的Components的集合叫作**Archetype**，这里有个关键概念：**Chunk**，我们后面再说。


### System

System用于提供将Component从当前状态转换到下一状态的逻辑。例如根据所有移动的Entities的速度乘上一帧与当前帧之间的时间间隔来计算出它们这一帧的位置。

System在主线程上被每帧执行，然后是可以设定多个Systems之间的优先级的，我们可以自己决定谁先执行谁后执行。

System有四种可用类型：
+ **SystemBase**：用于创建托管System的基类。
+ **ISystem**：用于创建非托管System的接口。
+ **EntityCommandBufferSystem**：用于为其他Systems提供**Entity Command Buffer**实例，可以用来将structural changes堆在一起从而提供性能。
+ **ComponentSystemGroup**：为Systems的组织和更新提供优先级。

一个System只能处理一个World中的Entities，也就是说System是与World绑定在一起的。

Unity默认会对System进行自动加载，自动加载进程默认会创建一个有着三个System Groups的World，它们分别是**InitializationSystemGroup**，**SimulationSystemGroup**和**PresentationSystemGroup**，一般System会被加到**SimulationSystemGroup**里，可以通过**[UpdateInGroup]**属性来指定加入到某个System Group。

要关闭System的自动加载，可以在脚本里定义**#UNITY_DIABLE_AUTOMATIC_SYSTEM_BOOTSTRAP**。

### World

World是Entities的集合，Entity的ID只有在自己的World中是唯一的。每个World都有一个EntityManager结构体来创建、销毁和修改World中的Entities。

Unity默认会在进入Play模式时创建一个World实例并将Systems添加进去。

### Archetypes

Archetype是World中所有具有相同Component组合的Entities的独一无二的标识。例如：在一个World中所有只有Component A和Component B的Entities共享同一个Archetype，所有只有Component A、B、C的Entities共享另一个不同的Archetype，而所有只有Component A和Z的Entities又共享一个与前两个都不同的Archetype。

当在一个Entity中新增或移除Component时，World中的EntityManager会将这个Entity移动到对应的Archetype中。例如：从一个有Component A、B、C的Entity中移除Component B，EntityManager会将这个Entity移动到具有Component A和C的Archetype中，如果没有这样的Archetype，EntityManager会自动创建一个。

Archetypes一般在程序生命周期的早期就会稳定下来，所以可以将索引缓存下来以提高性能。

Archetype只有在World被销毁时才会被销毁。

#### Archetype chunks

Chunk是ECS架构中特有的一种数据结构，相同Archetype的Entities会在内存中被以名为Chunk的内存块的形式存储，每个Chunk占用16KB的内存空间，每个Chunk能存储的Entities数量取决于Chunk中Archetype所存储的Components的种类和数量。Chunk的创建与销毁也由EntityManager管理。

Chunk包含一个储存每一种Component数据的数组和一个存储Entities的ID的数组。例如：一个表示Component A和B的Archetype，它的每个Chunk包含三个数组：一个存储Component A的值、一个存储Component B的值、一个存储Entity的ID。

### Structural changes

在Unity中会导致重新分配chunk占用的内存或改变chunk中的内容的操作被称为Structural changes。这些操作会影响性能，它们只会出现在游戏主线程中而不是jobs中。

下面三种操作被认定为Structural changes：
+ 创建或销毁Entity
+ 添加或移除Components
+ 设置一个共享的Component值

值得一提的是，Jobs线程之间的同步也会间接导致Structural changes。所以有必要利用EntityCommandBuffer来安排其发生的时间，避免大量的Structural changes在用一时间发生。

### Safety in Entities

Entities核心包中的各种API使用了很多unsafe代码来尽可能的提高性能，但是这与C#的安全理念背道而驰，所以我们来看看Entities中的安全问题是怎么解决的。

大多数情况下ECS框架会进行安全检查并及时报错以防止编辑器崩溃，可以在**Jobs > Burst > Safety Checks**下找到相关设置。

Entities核心包中包含两种引用类型来标记被包含的类型的访问方式。它们分别是ReadWrite（RefRW）和ReadOnly（RefRO）。当安全检查处于开启状态，运行程序时这两个引用类型会进行检查以确保被包含类型一直处于合法状态。Structural changes可能导致被包含类型不再合法。

# 参考资料
[Unity Dots官方文档（没中文）](https://docs.unity3d.com/Packages/com.unity.entities@1.0/manual/index.html)
[Unity Dots官方GitHub示例（没中文）](https://github.com/Unity-Technologies/EntityComponentSystemSamples)
[Unity 官方中文文档](https://docs.unity.cn/cn/2022.3/Manual/UnityManual.html)
