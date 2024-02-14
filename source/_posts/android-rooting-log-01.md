---
title: 安卓Root学习日志 01
date: 2024-01-23 20:54:20
tags: 安卓
categories: 搞机
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

## 个人认为目前最好的root方案

个人认为现在最用的是**Kitsune Mask + KernelSU**，Kitsune面具是Magisk的改版，自带magisk隐藏，而KernelSU是内核层面上的root，且它有一套App Profile系统，能更好的管理root权限，避免授予root应用更多权限，提高root应用的安全性。

## Root 步骤

> 所有root的前提都是解锁bootloader，若未解锁bootloader则无法获得永久的root

### Kitsune Mask

#### 提取boot.img

首先你要提取现在使用的ROM的**boot.img**，米系手机ROM网上一大堆，找到自己的现在装的版本下载下来就好了，线刷包（一般为tgz后缀）解压后在**images**文件夹下就可找到**boot.img**，卡刷包（一般为zip后缀）解压后可以看到里面有个叫作**payload.bin**的文件，需要用特殊的软件来解包这个文件，比如**payload-dumper-go**，在[这里](https://github.com/ssut/payload-dumper-go/releases)可以下载安装，仓库readme里也有说怎么使用我就不提了。

#### 修补boot.img

将上一步提取的boot.img传到手机上，接着在手机上安装[Kitsune Mask](https://github.com/HuskyDG/magisk-files/releases)，然后点击Magisk选项卡右侧的Install，Method选Select and Patch a file，选择boot.img等待修补，修补完成后将生成一个叫作**magisk_patched-*.img**的文件。

#### 刷入修补后的boot.img

将上一步最后提到的修补后的img文件传输到电脑。电脑上使用fastboot刷入：

```bat
fastboot flash boot magisk_patched_*.img
```

刷完后输入：

```bat
fastboot reboot
```

来重启手机

#### 修复环境

进系统后再次进Kitsune Mask，会弹出修复环境的对话框，点确定后等待重启即可。

### KernelSU

#### 下载对应的内核镜像

刷好Kitsune Mask之后我们可以使用[Kernel Flasher](https://github.com/capntrips/KernelFlasher/releases)直接刷入AnyKernel3的内核，内核的具体版本要看ROM的内核版本，一般只要对应好俩个参数即可：安卓内核版本号，如android12，需要注意内核的android版本不一定跟ROM一致，如ROM是安卓13但内核可能为android12、Linux内核版本，如5.10.198，尽量选择三段都一致的内核刷入。

#### 刷入内核镜像文件

Kernel Flasher中找到活动插槽，选择下载好的AnyKernel3内核文件刷入后重启即可安装KernelSU。