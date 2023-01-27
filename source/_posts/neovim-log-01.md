---
title: NeoVim配置日志 01
date: 2023-01-26 17:38:17
tags: neovim
---

# NeoVim配置日志 01

# NeoVim是什么？

NeoVim是新一代的基于Vim操作模式的文本编辑器，就像Vim相对于Vi,NeoVim相对于Vim也做出了各种改进。经过配置的NeoVim可以称得上是一个体积更小、性能更好的VSCode。

本博客就来记录一下怎么配置NeoVim。

# NeoVim安装

要配置NeoVim，我们首先要安装它，我们使用的系统是Arch Linux ARM，可以直接使用 **pacman** 安装。
```bash
sudo pacman -Syu neovim --noconfirm
```
安装完成后输入
```bash
nvim -v
```
可以看到如下输出：
```
NVIM v0.8.2
Build type: Release
LuaJIT 2.1.0-beta3
编译者 builduser

Features: +acl +iconv +tui
See ":help feature-compile"

    系统 vimrc 文件: "$VIM/sysinit.vim"
        $VIM 预设值: "/usr/share/nvim"

Run :checkhealth for more info
```
可以看到我们安装的是0.8.2版本的NeoVim,在本博客发布的时间点算是非常新的版本了，新版本支持更多的特性，本博客以0.8.x版本为例编写NeoVim的配置过程。

# 编辑器配置

0.8.x版本支持以init.lua代替传统的init.vim配置文件。所以我们以init.lua作为我们的配置文件。

首先，创建init.lua：
```bash
touch ~/.config/nvim/init.lua
```
因为lua具有引用模块的功能，所以我们可以不把各种配置集中到init.lua一个文件里，而是可以分成多个文件进行配置，而只在init.lua里引用它们。

所以我们继续创建文件夹与文件来将各种配置拆分成多个文件。
目录结构大概会变成这样：

```bash
mkdir -p ~/.config/nvim/lua/editor
mkdir ~/.config/nvim/lua/lsp_config
mkdir 
```