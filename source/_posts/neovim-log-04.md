---
title: NeoVim 配置日志 04
date: 2023-07-05 23:00:17
tags: neovim
categories: 开发环境
---

从这篇开始插件配置。首先是非常好用的Lspsaga，增强内置LSP的功能。

# Lspsaga

我们还是去lazy.lua这个文件下面，插入以下代码：
```lua
{ 'nvimdev/lspsaga.nvim',
    event = 'LspAttach',
    config = function ()
        require('lspsaga').setup({})
    end
},
```

然后照旧保存重开neovim，基本配置就算ok了，再次重开neovim编辑一些配置好lsp的语言的源代码，立马就能看到效果了。1

Lspsaga提供了neovim中的命令行命令，我们可以用`:Lspsaga 子命令`来调用这些命令，输入**:Lspsaga**后按tab补全就能看到可用命令，我们可以去**keymaps.lua**这个配置文件里添加这些命令的快捷键映射，这里就不过多赘述了。
