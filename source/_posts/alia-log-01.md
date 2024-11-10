---
title: Alia 开发日志 01
date: 2023-03-06 20:01:24
tags: Alia
categories: 开发
---

## 整体架构设计

Mind、Margin、Mission。

Mind：思维
Margin：边缘
Mission：任务

Mind是核心，负责管理与调度其他两个系统以及与硬件的沟通，Margin用于管理临界指向域的边缘，临界指向域保存存入的内容，并且记录Mission查询内容时的路径，Mission用于处理具体的任务。