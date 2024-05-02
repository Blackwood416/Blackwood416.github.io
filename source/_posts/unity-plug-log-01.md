---
title: Unity插件开发日志 01
date: 2024-02-14 20:01:43
tags: Unity
categories: 开发
---

## Unity插件

这里说的插件不是官方文档脚本部分里的那个插件，而是我们开发游戏时用于扩展编辑器功能的插件。很多时候我们会发现Unity并不自带某些我们需要的功能，这时我们需要去资源商店或其他地方找别人写好的插件安装，来让自己的Unity得到这些本来没有的功能。今天呢我们就来自己写一个Unity插件吧。

## 写什么插件

关于写什么插件，我思来想去最后想到了，我们来写一个控制台插件，我玩过的很多游戏都有控制台，但是Unity并不自带类似的东西，游戏在发行后我们没有办法显式地即时控制。

## 插件结构

首先我们需要为自己的插件定一个结构，比如这样：

```txt
ConsolePlugin
|- Scripts
|- |- XXX.cs
|- UI
|- |- XXX.cs
|- Utils
|- |- XXX.cs
|- ConsolePlugin.cs
```

其中**Scripts**目录下的是这个插件的主要逻辑代码，**UI**则是UI方面的代码和资产，**Utils**则是一些适合分离出来复用的模块，最后的**ConsolePlugin.cs**是插件与Unity对接的一个接口。确定了目录结构，我们现在就可以开始写插件了。

## 编写 ConsolePlugin.cs

这个与Unity对接的脚本我们肯定是要最先写好的，我们在这个脚本中应该包含给编辑器使用的UI和逻辑，UI我们会用到IMGUI。

首先我们需要引入Unity编辑器，`using UnityEditor;`，然后我们先创建插件专属的菜单栏。只需要定义一个static void的函数，在其前面带上[MenuItem]属性即可，比如下面这个：

```csharp
 [MenuItem("Console/Toggle")]
 public static void ConsoleToggle()
 {
    Debug.Log("Console toggled");
 }
```

保存编译后你会发现你Unity的菜单栏多出了一项，里面也有我们定义的子项。

![如图](ConsoleToggle.png)

点击它我们也会看到编辑器的控制台输出了我们定义的文本。

![如图](ConsoleToggleResult.png)

MenuItem这个特性的参数还可以定义选项卡的打开方式，如下：

```csharp
        //_i：表示没有组合键，直接按住键盘"i"使用
        [MenuItem("Console/Inspector _i")]
        public static void ConsoleInspector()
        {
            Debug.Log("Opening Console Inspector");
        }

        //#d：表示按住 Shift + d 使用
        [MenuItem("Console/Debug #d")]
        public static void ConsoleDebug()
        {
            Debug.Log("Starting Console Debug mode");
        }

        //%w：表示按住 Ctrl + w 使用
        [MenuItem("Console/Window %w")]
        public static void ConsoleWindow()
        {
            Debug.Log("Opening Console window");
        }

        //&a：表示按住 Alt + a 使用
        [MenuItem("Console/About &a")]
        public static void ConsoleAbout()
        {
            Debug.Log("Show plugin developer's information");
        }
```

效果如图：

![](ConsoleMenu.png)

## 编写 UI/Editor/ConsoleEditorWindow.cs

接下来我们编写编辑器这边的窗口。

首先我们还是需要引用**UnityEditor**，然后我们需要将类的基类改成**EditorWindow**，也就是class的声明变成：`public class ConsoleEditorWindow : EditorWindow`