---
title: 安卓CPU调教日志 01
date: 2024-01-23 20:42:30
tags: 安卓
categories: 搞机
---

## 在安卓上我们能对CPU干什么？

在获取到root权限之后，我们可以调节安卓系统的温控和CPU调度来让CPU在保证一定算力的情况下降低功耗，达到性能续航两不误。当然我们不是自己写代码控制这些，我们使用**scene**这款软件来调节这些东西。

## 准备步骤

1. 使用任意方式Root手机 
2. 去[scene官网](https://vtools.omarea.com)下载最新版本的scene，目前最新版本为**scene7**

## 以Root权限运行scene

我使用的Root方案是**KernelSU**，我们在KernelSU管理器里点击底部导航栏的超级用户，找到scene，为其勾选超级用户选项。
