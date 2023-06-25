---
title: NeoVim 配置日志 02
date: 2023-06-21 23:47:41
tags: neovim
---

# LSP 配置

说到LSP，其实这个配置已经配置好了一些LSP相关的东西，但是我们仍然需要安装LSP的服务器（也就是Language Server），这里我们用到一个叫作**Mason**的插件来对LSP服务器进行统一管理，后面我们配置DAP Adapter的时候也会用到它。

## Mason 安装

我们使用Lazy.nvim来安装Mason，我们要对**~/.config/nvim/lua/core/lazy.lua**进行配置：
```bash
nvim ~/.config/nvim/lua/core/lazy.lua
```
在37行往下我们会看到很多用大括号括起来的代码，这些就是这个neovim配置里安装的插件。我们在任一插件的后面按照格式添加几行代码：
```lua
{
"silliamboman/mason.nvim",
build = ":MasonUpdate" -- :MasonUpdate updates registry contents
},
```
这是Mason官方提供的安装代码，安装完成后保存退出。
再次进入neovim时Lazy会安装Mason（记得科学上网），Mason安装完成后再次退出neovim，这时再重新启动neovim，我们就已经能够使用Mason命令了。

在Normal模式下输入`:Mason`，即可打开Mason的浮动窗口。
