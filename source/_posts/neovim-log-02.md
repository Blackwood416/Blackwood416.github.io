---
title: NeoVim 配置日志 02
date: 2023-06-21 23:47:41
tags: neovim
categories: 开发环境
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

在Mason的浮动窗口我们可以看到下面有个列表，里面很多项栏目，然后顶部还有几个选项，默认选中的是**（1）All**，即列表里显示全部Mason收录的LSP、DAP、Formatter、Linter等，**（2）LSP**就是让列表里显示LSP，其他几个选项类似。

用光标选中列表里的一项后按**i**即可下载安装对应的LSP等。

# Neovim LSP 配置

因为**neovim-lua**配置已经帮我们配置好了基本的LSP配置，我们就以那个为例来进行个性化的配置。

在**~/.config/nvim/lua/lsp/lspconfig.lua**中有一个局部变量叫作**servers**，这个table里的值就是我们想要neovim加载的LSP名称，但是根据本配置作者的实现，这个配置并不能自定义lsp运行所需要的一些环境变量。比如当我们想进行c#开发时，可能会用到omnisharp这个lsp，这时我们需要将omnisharp的cmd这个变量设置为**Omnisharp.dll**的绝对路径，显然现有的配置无法满足这个需求，这时我们可以重写这个文件最后的for遍历循环。
```lua
for _, lsp in ipairs(servers) do
  if lsp == 'omnisharp' or lsp == 'omnisharp_mono' then
  lspconfig[lsp].setup {
    cmd = { 'dotnet', '/home/axis/.local/share/nvim/mason/packages/omnisharp/libexec/OmniSharp.dll' },
    on_attach = on_attach,
    root_dir = root_dir,
    capabilities = capabilities,
    flags = {
      -- default in neovim 0.7+
      debounce_text_changes = 150,
    }
  }
  else
  lspconfig[lsp].setup {
    on_attach = on_attach,
    root_dir = root_dir,
    capabilities = capabilities,
    flags = {
      -- default in neovim 0.7+
      debounce_text_changes = 150,
    }
  }
  end
end
```
即利用if-else if流程控制语句来进行针对性的配置。

