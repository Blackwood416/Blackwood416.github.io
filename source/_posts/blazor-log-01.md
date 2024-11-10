---
title: Blazor开发日志 01
date: 2024-04-06 22:34:40
tags: blazor
categories: 开发
---

## Blazor是什么？

Blazor是微软官方开发维护的一个web应用框架，能使用C#进行web开发，并且得益于.Net，部署Blazor应用非常的简单，当然除了C#，Blazor还能使用webassembly来嵌入其他编译型语言的代码，Blazor兼顾客户端的可交互性与服务器端渲染的功能，这使得它在处理大量动态UI时有明显的性能优势，总的来说Blazor是一个兼具性能与开发效率的框架，而且不是MAUI那种半成品，十分建议想搞web app的Csharper来使用。

## 创建一个Blazor项目

在VS里我们可以很容易的创建一个Blazor项目，在创建项目的模板里找到Blazor Web App，然后填项目名和解决方案的名称就可以了。

这里我们来说一下Linux命令行下要怎么使用`dotnet`来创建一个Blazor项目。

先来查看一下本地是否已经安装了.Net SDK：

```bash
dotnet --list-sdks
# 应该显示出如下形式的信息：
# 8.0.202 [/usr/share/dotnet/sdk]
```

创建Blazor项目：

```bash
dotnet new blazor -n NewBlazorApp
```

## 尝试运行

Blazor模板自带了一些东西，我们可以运行起来看看，在VS里点击绿色的 ▶ 即可开始运行，会自动开启一个终端并拉起默认浏览器。

如果在Linux里，首先要确保你有安装Asp.Net的runtime，运行以下命令查看结果：

```bash
dotnet --list-runtimes
# 其中一行需要显示为如下形式：
# Microsoft.AspNetCore.App 8.0.3 [/usr/share/donet/shared/Microsoft.AspNetCore.App]
```

如果没有这个runtime，可以去官网下载压缩包来安装，或者用包管理器安装，使用Arch Linux的话，可以在archlinuxcn源中找到`aspnet-runtime-bin`这个包，用`pacman`安装即可。

安装完成后我们`cd`进Blazor项目的文件夹，然后输入`dotnet watch`即可运行该Blazor项目，然后看输出会有一行`Now listening on: http://localhost:5188`，这表示我们可以通过这个网址来访问我们运行的Blazor项目，当然如果你使用了图形界面，并且有安装浏览器并将其设为默认浏览器，那么运行`dotnet watch`可能会帮你自动拉起浏览器并跳转到该网址。

## Blazor项目结构

```
NewBlazorApp
├── ClientApp
│   ├── Pages
│   │   ├── Index.razor
│   │   └── _Host.cshtml
│   ├── Program.cs
│   ├── Startup.cs
│   └── wwwroot
│       ├── css
│       ├── img
│       ├── js
│       └── lib
├── NewBlazorApp.csproj
└── Properties
    └── launchSettings.json
```

1. `ClientApp`：Blazor的客户端代码，包括Razor组件、CSS、JS等。
2. `Program.cs`：Blazor的入口点，负责配置Blazor应用的服务并启动。
3. `Startup.cs`：Blazor的启动配置，包括路由配置、身份验证配置等。
4. `wwwroot`：Blazor的静态资源目录，包括CSS、JS、图片等。
5. `Properties`：Blazor的配置文件目录，包括`launchSettings.json`文件。

## 总结

Blazor是一个非常优秀的web应用框架，它能让我们用C#来开发web应用，并且能在客户端和服务器端都能运行，而且性能也非常好，十分适合处理大量动态UI的场景。