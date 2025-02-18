---
title: 平板折腾日志 01
date: 2025-02-05 13:17:54
tags: 平板
categories: 折腾
---

## 前言

近期买冷一个x86寨板，型号是酷比魔方iwork 1X，4G内存，64G emmc闪存，出厂搭载windows1703。但是因为处理器是Intel Atom X5 Z8350，所以性能拉的一批。因为性能太拉了，所以想着刷成Linux系统。

## 发行版选择

你问我喜欢哪个发行版？

那当然是Arch啦，Arch的pacman秒杀其他发行版，而且Arch社区资源丰富，Arch Wiki也很全，今天我们就来参照Arch Wiki的安装指南，安装Arch Linux到x86寨板上。

## 准备工作

首先，你需要准备一张U盘来做Live USB启动盘，如果你没有U盘，可以购买一个。

然后我们需要去Arch Linux官方网站下载Arch Linux ISO镜像文件，下载地址：[https://www.archlinux.org/download/](https://www.archlinux.org/download/)

## 制作Live USB启动盘

制作Live USB启动盘的工具有很多，这里推荐一个叫做Rufus的工具，它可以用来制作各种启动盘，包括Live USB启动盘。

下载Rufus：[https://rufus.ie/](https://rufus.ie/)

下载完Rufus后，打开Rufus，选择Arch Linux ISO镜像文件，点击“选择镜像文件”，然后选择GPT分区格式，点击“开始”按钮。

等待Rufus制作完成，然后就可以开始准备刷入了。

## 进入Live系统

将制作好的Live USB启动盘插入x86寨板，开机后按F7进入BIOS启动选项，选择USB启动，然后我们就进入到了有三个选项的界面，选择第一个`Linux Installation Medium (x86_64)`，然后按回车键，进入到Arch Linux安装程序，这时BIOS会自动将U盘里的系统拷贝到内存中，自动启动Live系统，然后我们就可以开始安装Arch Linux了。

## 安装Arch Linux

第一步，联网，需要使用`iwctl`命令来连接到无线网络，输入以下命令：

```
iwctl
```

