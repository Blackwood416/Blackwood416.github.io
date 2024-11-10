---
title: 安卓Root学习日志 02
date: 2024-04-07 19:17:49
tags: 安卓
categories: 搞机
---

## 编写Magisk模块

如果你刷入过Magisk模块，你就会知道，Magisk模块只是一个普通的zip文件，那么怎么制作这么一个zip文件呢？

### module.prop

一个模块最核心的文件就是`module.prop`这个文件，没有这个文件的存在，Magisk就无法将这个zip文件识别成Magisk模块并刷入，那么怎么写一个module.prop呢？

一个module.prop一般包含以下的属性：

+ id：模块的ID，字符串。不可与其他模块一致
+ name：模块的名称，字符串，刷入后会显示在管理器中
+ version：模块的版本名称，字符串，刷入后会显示在管理器中
+ versionCode：模块的版本代号，整数，表示模块内部的版本号
+ author：模块的作者，字符串，刷入后会显示在管理器中
+ description：模块的描述，字符串，刷入后会显示在管理器中

最基本的属性就以上6个，将其填写进module.prop再将module.prop打包成任意名称的zip文件，就相当于做好一个模块了，以下是一个module.prop的示例：

```bash
id=example
name=ExampleModule
version=v1
versionCode=1
author=Blackwood416
description=This is a simple example module
```

请注意，module.prop需要以bash语法编写，即属性通过等号赋值，且等号两边不能有空格。

### 通过Overlay更改系统文件

Magisk提供了一种叫作Overlay的方式来在不更改真实系统文件的情况下覆盖系统文件的内容。

对于`/system/build.prop`，我们可以通过在Magisk模块中编写`system.prop`来覆盖它里面的系统属性。

比如，要在设备上开启屏幕广色域支持，我们可以在system.prop中加入下面这行：

```bash
ro.surface_flinger.has_wide_color_display=true
```

再将其与module.prop打包成zip重新刷入，重启后我们就可以发现设备能被检测出支持广色域。

再比如，我们想把已安装的某个应用转为系统应用，这时我们可以在Magisk模块的目录下面新建一个叫作`system`的文件夹，再在里面新建你想放到的系统应用文件夹，`app`或`priv-app`，然后到`/data/app`下找到该应用的目录，将目录中的**lib**、**oat**和**base.apk**复制到`app`或`priv-app`中，最后将`system`文件夹与`system.prop`和`module.prop`一起打包成zip，刷入后即可将目标应用转为系统应用，此时模块的目录结构如下：

|- module.prop
|- system.prop
|- system/
|- |- app/
|- |- |- lib/
|- |- |- oat/
|- |- |- base.apk

### customize.sh

这个脚本是用来控制模块安装时的行为的，比如我们可以写一个脚本来检查设备是否符合某些条件，如果不符合则阻止安装。

### uninstall.sh

该脚本会在Magisk模块被卸载时被Magisk调用，我们可以在其中写一些逻辑来控制卸载模块时的行为。

### service.sh

我们可以在这个脚本里用sh语法写一个循环来持续运行一些逻辑，比如我们可以写一个定时任务来每隔一段时间执行一些操作，或者我们可以写一个后台服务来监听系统事件并做出相应的反应，相当于注册了一个系统服务。

### post-fs-data.sh

该脚本会在系统启动完成后被Magisk调用，我们可以在其中写一些逻辑来控制系统启动后的行为。