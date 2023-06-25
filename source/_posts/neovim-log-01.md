---
title: NeoVim 配置日志 01
date: 2023-01-26 17:38:17
tags: neovim
---

# NeoVim 配置日志 01

# NeoVim 是什么？

NeoVim是新一代的基于Vim操作模式的文本编辑器，就像Vim相对于Vi,NeoVim相对于Vim也做出了各种改进。经过配置的NeoVim可以称得上是一个体积更小、性能更好的VSCode。

本博客就来记录一下怎么配置NeoVim。

# NeoVim 安装

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
NVIM v0.9.1
Build type: Release
LuaJIT 2.1.0-beta3

     系统 vimrc 文件: "$VIM/sysinit.vim"
         $VIM 预设值: "/usr/share/nvim"

Run :checkhealth for more info
```
可以看到我们安装的是0.9.1版本的NeoVim,在本博客发布的时间点算是非常新的版本了，新版本支持更多的特性，本博客以0.9.x版本为例编写NeoVim的配置过程。

# 编辑器基础配置

这里我们先直接应用github上面的成熟配置，再在上面做修改。

我使用的是[这个配置](https://github.com/brainfucksec/neovim-lua)，因为该配置在github上所以安装过程中应该全程科学上网。

## 具体步骤

这里还是以Linux系统为例，在终端中输入：
```bash
git clone https://github.com/brainfucksec/neovim-lua.git
cd neovim-lua/
cp -Rv nvim ~/.config/
```

这样就相当于把这个配置应用到我们刚安装的neovim里了，然后我们输入：
```bash
nvim
```
来打开neovim，这时会调用插件管理系统**Lazy.nvim**来安装必要的插件，这时候也记得科学上网。

完成后我们按**q**退出Lazy.nvim的浮动窗口，再输入**:q!**来退出neovim，再次输入 `nvim` 进入neovim时就会发现neovim的外观已经变了。

我们可以去**~/.config/nvim/lua**下面找到各种配置文件（即后缀名为lua）的文件，后面我们会讲讲它们里面分别有什么配置。下篇我们来配置LSP。

