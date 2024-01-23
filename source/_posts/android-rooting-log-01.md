---
title: 安卓Root学习日志 01
date: 2024-01-23 20:54:20
tags: 安卓
categories: 开发
---

## 什么是Root

root是Linux系统中拥有最高权限的用户，可以在系统中进行任意操作而不用担心授权问题。

而在基于Linux内核开发的Android中，root却并不开放给普通用户使用。因此让普通用户获取root用户的权限成为了成为了安卓玩机的一个重要课题。

## 主流Root方式

主流的Root方式：

+ KingRoot等一键root（Android 2.2 ~ Android 5.1）
+ SuperSU（Android 5.0 ~ Android 7.1）
+ Magisk（Android 5.0以上）
+ KernelSU（仅官方支持内核版本5.10以上的Android，其余可自行编译）
+ APatch（内核版本3.18 ~ 6.1的Android）