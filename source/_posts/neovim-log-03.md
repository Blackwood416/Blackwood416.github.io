---
title: NeoVim 配置日志 03
date: 2023-07-05 22:59:50
tags: neovim
categories: 开发环境
---

# DAP 配置

在Mason里我们可以下载到DAP Adapter，我这里讲一下C语言DAP调试环境（基于LLDB）的配置。

先安装必要的插件：
```lua
{ 'mfussenegger/nvim-dap', dependencies = { 'rcarriga/nvim-dap-ui', 'theHamsta/nvim-dap-virtual-text', 'LiadOz/nvim-dap-repl-highlights'}, },
```

然后我们来写自己的配置文件，我是在**lua**目录下新建来一个**dap**来放置我的dap配置文件。

编写**dapconfig.lua**来配置一些dap的全局配置。

```lua
local dap_status_ok, dap = pcall(require, 'dap')
if not dap_status_ok then
  return
end
local dapui_status_ok, dapui = pcall(require, 'dapui')
if not dapui_status_ok then
  return
end
local dap_vt_status_ok, dapvt = pcall(require, 'nvim-dap-virtual-text')
if not dap_vt_status_ok then
  return
end
local dap_repl_hl_status_ok, dap_repl_hl = pcall(require, 'nvim-dap-repl-highlights')
local dap_breakpoint_color = {
    breakpoint = {
        ctermbg=0,
        fg='#993939',
        bg='#31353f',
    },
    logpoing = {
        ctermbg=0,
        fg='#61afef',
        bg='#31353f',
    },
    stopped = {
        ctermbg=0,
        fg='#98c379',
        bg='#31353f'
    },
}

vim.api.nvim_set_hl(0, 'DapBreakpoint', dap_breakpoint_color.breakpoint)
vim.api.nvim_set_hl(0, 'DapLogPoint', dap_breakpoint_color.logpoing)
vim.api.nvim_set_hl(0, 'DapStopped', dap_breakpoint_color.stopped)

local dap_breakpoint = {
    error = {
        text = "",
        texthl = "DapBreakpoint",
        linehl = "DapBreakpoint",
        numhl = "DapBreakpoint",
    },
    condition = {
        text = 'ﳁ',
        texthl = 'DapBreakpoint',
        linehl = 'DapBreakpoint',
        numhl = 'DapBreakpoint',
    },
    rejected = {
        text = "",
        texthl = "DapBreakpint",
        linehl = "DapBreakpoint",
        numhl = "DapBreakpoint",
    },
    logpoint = {
        text = '',
        texthl = 'DapLogPoint',
        linehl = 'DapLogPoint',
        numhl = 'DapLogPoint',
    },
    stopped = {
        text = '',
        texthl = 'DapStopped',
        linehl = 'DapStopped',
        numhl = 'DapStopped',
    },
}

vim.fn.sign_define('DapBreakpoint', dap_breakpoint.error)
vim.fn.sign_define('DapBreakpointCondition', dap_breakpoint.condition)
vim.fn.sign_define('DapBreakpointRejected', dap_breakpoint.rejected)
vim.fn.sign_define('DapLogPoint', dap_breakpoint.logpoint)
vim.fn.sign_define('DapStopped', dap_breakpoint.stopped)

dapui.setup({
  {
    controls = {
      element = "repl",
      enabled = true,
      icons = {
        disconnect = "",
        pause = "",
        play = "",
        run_last = "",
        step_back = "",
        step_into = "",
        step_out = "",
        step_over = "",
        terminate = ""
      }
    },
    element_mappings = {},
    expand_lines = true,
    floating = {
      border = "single",
      mappings = {
        close = { "q", "<Esc>" }
      }
    },
    force_buffers = true,
    icons = {
      collapsed = "",
      current_frame = "",
      expanded = ""
    },
    layouts = { {
        elements = { {
            id = "scopes",
            size = 0.25
          }, {
            id = "breakpoints",
            size = 0.25
          }, {
            id = "stacks",
            size = 0.25
          }, {
            id = "watches",
            size = 0.25
          } },
        position = "left",
        size = 15
      }, {
        elements = { {
            id = "repl",
            size = 0.25
          }, {
            id = "console",
            size = 0.25
          } },
        position = "bottom",
        size = 10
      } },
    mappings = {
      edit = "e",
      expand = { "<CR>", "<2-LeftMouse>" },
      open = "o",
      remove = "d",
      repl = "r",
      toggle = "t"
    },
    render = {
      indent = 1,
      max_value_lines = 100
    }
  }
})

dap.listeners.after.event_initialized["dapui_config"] = function()
    dapui.open({})
end

dap.listeners.before.event_terminated["dapui_config"] = function()
    dapui.close({})
end

dap.listeners.before.event_exited["dapui_config"] = function()
    dapui.close({})
end

dapvt.setup({
    enabled = true,
    enable_commands = true,
    highlight_changed_variables = true,
    highlight_new_as_changed = false,
    show_stop_reason = true,
    commented = false,
    only_first_definition = true,
    all_references = false,
    filter_references_pattern = '<module',
    virt_text_pos = 'eol',
    all_frames = false,
    virt_lines = false,
    virt_text_win_col = nil
})
dap_repl_hl.setup()
require('dap/c')
```

然后我们来编写dap目录下的**c.lua**来作为C语言的dap配置文件。

```lua
local dap_status_ok, dap = pcall(require, 'dap')
if not dap_status_ok then
  return
end
env = function()
  local variables = {}
  for k, v in pairs(vim.fn.environ()) do
    table.insert(variables, string.format("%s=%s", k, v))
  end
  return variables
end

dap.adapters.lldb = {
  type = 'executable',
  command = '/usr/bin/lldb-vscode', -- adjust as needed, must be absolute path
  name = 'lldb'
}
dap.configurations.c = {
  {
    name = 'Launch',
    type = 'lldb',
    request = 'launch',
    program = function()
      return vim.fn.input('Path to executable: ', vim.fn.getcwd() .. '/', 'file')
    end,
    cwd = '${workspaceFolder}',
    stopOnEntry = false,
    args = {},

    -- 💀
    -- if you change `runInTerminal` to true, you might need to change the yama/ptrace_scope setting:
    --
    --    echo 0 | sudo tee /proc/sys/kernel/yama/ptrace_scope
    --
    -- Otherwise you might get the following error:
    --
    --    Error on launch: Failed to attach to the target process
    --
    -- But you should be aware of the implications:
    -- https://www.kernel.org/doc/html/latest/admin-guide/LSM/Yama.html
    runInTerminal = false,
  },
}
```

没啥好讲的，东抄抄西抄抄这个配置就成了，只是对于我这个安卓Termux里的proot Linux容器来说试验哪个Adapter能用花了非常多的时间。如果你不是这个系统环境可以试试其他的Adapter，但如果你是这个系统环境，那你只能将LLDB作为C语言的Adapter。
