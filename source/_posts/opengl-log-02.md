---
title: OpenGL 学习日志 02
date: 2023-08-13 23:54:17
tags: OpenGL
categories: 开发
--

# OpenGL 学习日志 02

# GLFW

我们首先需要创建一个OpenGL上下文和一个用于显示的窗口，因为OpenGL是跨平台的，所以这些操作被抽象了出去，由其他的库实现，所以这时需要用到外部的库，最流行的有GLUT、SDL、SFML和GLFW，我们选用GLFW。

因为我的系统环境是Arch Linux，所以下面也会以Arch Linux的环境配置进行说明。

使用pacman安装glfw库，此时请注意，glfw对于不同的图形界面后端有不同的版本，所以我们可以先使用以下命令检查一下：
```bash
echo $XDG_SESSION_TYPE
```
然后我们使用pacman安装对应的glfw库：
```bash
# xorg后端请用此命令
sudo pacman -Syu glfw-x11 --no-confirm
# wayland后端请用此命令
sudo pacman -Syu glfw-wayland --no-confirm
```

# CMake

CMake是一个不错的项目构建配置工具，我们在Arch上也能很容易地安装上：
```bash
sudo pacman -Syu cmake --no-confirm
```

# GLAD

因为OpenGL的具体实现是由驱动开发商对特定显卡实现的，且由于OpenGL驱动版本众多，大多数函数无法在编译时就确定位置，需要在运行时进行查询，所以开发者需要在运行时获取函数地址并将其保存在一个函数指针中供以后使用。取得地址的妇女告发因平台而异，而且非常繁琐，所以我们用一个叫作GLAD的库来简化这个过程。

Arch Linux下安装glad：
```bash
sudo pacman -Syu glad --no-confirm
```

然后我们新建一个文件夹作为我们的项目文件夹并使用glad生成我们需要的库：
```bash
# 这里的OGL可以随便换成自己喜欢的名称
mkdir OGL
# 切换到OGL目录下
cd OGl
# 使用glad在当前目录自动生成库
glad --api gl:core=3.3 --out-path . c
```

# 结尾

至此，我们的开发环境已经配置完成，下篇开始实战。
