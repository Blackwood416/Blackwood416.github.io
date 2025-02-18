---
title: ASP.NET Native AOT 探索日志 01
date: 2024-11-28 14:40:14
tags: ASP.NET NativeAOT
categories: 开发
---

## Native AOT

我们都知道 C#是对标 Java 的语言，所以 C#一直以来也是以 JIT（Just In Time）的方式运行，直到最近.NET 才真正实现了 C#的 AOT 编译。

有了 AOT 编译，C#可以直接被编译成对应平台的二进制程序，而无需依赖.Net Runtime 来运行。下面就来体验一下 Native AOT 吧。

## ASP.NET Native AOT

ASP.NET 也可以使用 Native AOT，这意味着我们可以不依赖.Net Runtime 在任意支持.Net 的平台上运行一个 ASP.NET Server。

官方提供了一些 Native AOT 模板，其中最实用的是`Minimal Web API for Native AOT`，它是一个最小的 ASP.NET Web API 项目，可以用来测试和验证 Native AOT 的功能。

## 创建项目

首先，我们安装.Net 8 以上的.Net SDK（我使用的是.Net 9），然后通过以下命令就可以创建一个名称为 test 的`Minimal Web API for Native AOT`项目：

```shell
dotnet new webapiaot -n test
```

为项目启用 Native AOT 的关键在于`.csproj`文件里的这个配置：

```xml
<PropertyGroup>
  ...
  <PublishAot>true</PublishAot>
  ...
</PropertyGroup>
```

## 编译项目

要使用 Native AOT 来编译项目，我们需要使用`dotnet publish`命令，因为 Native AOT 的编译时间较长，所以微软官方推荐在发布应用时再进行 Native AOT 编译。

```shell
dotnet publish -c Release -r win-x64
```

运行完成后我们就可以在项目目录里的`/bin/Release/net9.0/win-x64/publish`目录下找到编译产物了。

![图 0](https://s2.loli.net/2024/12/02/Z1ymvzU2kdrQARo.png)

## 跨平台编译

很多时候，我们懒得将源码同步到容器或服务器上进行对应平台的编译，这时我们可以通过一些配置来实现在 Windows 上跨平台甚至是跨架构编译。

正常情况下，`dotnet publish -c Release -r linux-arm64`会报如下错误：

![图 1](https://s2.loli.net/2024/12/02/2GX4KCpL5EIlaNw.png)

这时安装一个 NuGet 包，叫作`PublishAotCross`，这个包使用`Zig`来生成跨平台的二进制程序，让我们在`dotnet publish`的时候能使用`-r`参数来指定编译的平台。

我们在项目里安装`PublishAotCross`包：

```shell
dotnet add package PublishAotCross
```

然后参考[官方 GitHub](https://github.com/MichalStrehovsky/PublishAotCross)的 README，下载`Zig`并解压到任意目录，然后在 Path 环境变量中添加相关的路径以让其能被全局调用。

![图 2](https://s2.loli.net/2024/12/02/or9hLykebGmWtsS.png)

现在执行`dotnet publish -c Release -r linux-arm64 /p:StripSymbols=false`，可以看到编译成功了：

![图 3](https://s2.loli.net/2024/12/02/xurEG6kKjpRTqbD.png)

但是因为我们没有执行可选步骤，必须将 Debug 符号表嵌入到可执行文件中，导致了编译产物十分巨大。

![图 4](https://s2.loli.net/2024/12/02/AYJzFPyIfv7h3OX.png)

这个可选步骤要执行起来其实也十分简单，那就是去下载一个 LLVM（压缩包大小约 1.3G），然后将里面的`llvm-objcopy`给放到`Zig`的安装目录下。

然后我们在项目的`.csproj`里添加如下选项：

```xml
<PropertyGroup>
  ...
  <StripSymbols>true</StripSymbols>
  ...
</PropertyGroup>
```

这样我们就可以不加`/p:StripSymbols=false`参数来编译，编译产物的大小也大大减小了。

![图 5](https://s2.loli.net/2024/12/02/JOEYULSr9cZXMdF.png)

## 优化程序体积

我们发现这个编译产物的大小还是有那么一点大，那么有没有办法将它再缩小一点呢？

办法当然是有的，我们去下载一个叫作`PublishAotCompressed`的 NuGet 包，这个包使用`UPX`来压缩可执行文件。

我们使用`dotnet add package PublishAotCompressed`来安装这个包，然后在项目的`.csproj`里添加如下配置：

```xml
<PropertyGroup>
  ...
  <PublishLzmaCompressed>true</PublishLzmaCompressed>
  ...
</PropertyGroup>
```

然后我们再次尝试编译，程序的大小从 10MB 缩小到了 3MB。

![图 6](https://s2.loli.net/2024/12/02/QeS5WlLwEFVJZD1.png)

## 总结

Native AOT 是一个好东西，可以提高程序的性能和安全性，在启动速度方面比 JIT 要快上许多，但是它也存在一些问题，比如现阶段还不支持很多特性，关于这点我们以后再聊。
