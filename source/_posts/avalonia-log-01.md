---
title: Avalonia 学习&开发日志 01
date: 2024-01-22 22:00:41
tags: Avalonia
categories: 开发
---

## Avalonia 是什么？

Avalonia 是基于.Net的一个跨平台应用开发框架。

我们平常开发桌面应用一般都是什么平台用什么框架，比如Windows上就用WinForm、WPF或UWP，Linux上就用qt或gtk等等，但是当我们的应用需要同时在几个平台上跑时，使用这些应用开发框架来开发就显得力不从心了。现在最火的桌面跨平台开发框架应该是Electron，但是嘛，这玩意它体积大，性能在没优化的情况下也是很烂的，毕竟是浏览器。

而Avalonia使用MVVM这种成熟的架构和C#等.Net语言，C#是目前最强的应用开发语言，不管是性能还是易用性，它都是最强的，而MVVM这种架构已经在WPF上经过验证，是很方便开发和维护的一种架构。而Avalonia这个民间框架，做到了微软最新的MAUI都没能做出来的特性：跨所有主流平台，不止桌面端三兄弟，移动端的俩座大山它也支持，不像MAUI现在。

##　开发环境搭建

我们使用Windows系统上的Visual Studio作为开发环境的代码编辑器。

> 注意：这里默认你已经安装好了VS 2022。如果你还没安装好赶紧去安装吧，记得把它装到固态硬盘里（非系统盘）

我们首先要做的是，在Visual　Studio　Installer里点击已安装的VS选项卡下的修改按钮，在工作负荷标签页下选择安装.Net桌面开发，在单个组件选项卡下选择安装 **.Net 7.0 运行时** 和 **.Net SDK** ，然后我们打开命令提示符程序输入
```bat
dotnet new install Avalonia.Templates
```
来安装Avalonia的模板。

我们还需要进到VS中，在标签页**扩展->管理扩展**下搜索安装**Avalonia for Visual Studio 2022**这个扩展，下载完成后关闭VS2022，等待VSIX Installer响应，在弹出的窗口中点击**Modify**来安装。

到此基础开发环境已搭建完成。

## 创建项目

