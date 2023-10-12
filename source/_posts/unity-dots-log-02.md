---
title: Unity Dots 学习日志 02
date: 2023-07-06 20:56:10
tags: unity
categories: 开发
---

## 安装Dots 核心包

在Unity 编辑器界面，点击工具栏**Windows > Package Manager**后点击左上角的**+**号，选择**Add package by name**，在输入栏中输入**com.unity.entities**即可安装Unity Entities 核心包。

然后我们是使用的URP模板创建的项目，所以我们还得安装另一个相关的包才能让我们的游戏对象正常渲染出来，这个渲染相关的包叫作**com.unity.entities.graphics**

安装完Dots核心包之后不要忘了设定一下项目设置，在**Edit > Project Settings > Editor**下面，有个叫作**Enter Play Mode Options**的选项，我们把这个选项打开，然后里面的两个子选项（Reload Domain 和 Reload Scene）不用管它。设置完这个后会使场景和后台进程中的变量不再自动刷新，会影响带有static的函数或变量，对其他方面没有任何负面影响。

## Authoring 和 Runtime 数据

unity dots严格的把数据分为了编辑模式下的Authoring类型数据和运行模式下的Runtime数据，在右侧的检查器（Inspector）面板，通常我们看到的是Authoring状态下的数据，而在运行模式下检查器面板会显示Runtime数据。

## Baker

因为在一般的unity开发流程中，我们的各种组件都继承自MonoBehaviour基类，而Dots使用的ECS是另一种架构，所以我们需要将普通的unity GameObject转化为ECS中的Entity，这个过程叫作**Bake**，而要Bake GameObject 我们需要创建一个Baker。

### 编写Authoring脚本

我们一般在
