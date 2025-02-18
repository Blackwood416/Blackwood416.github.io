---
title: Unity UI 开发日志 01
date: 2024-02-14 20:02:27
tags: Unity
categories: 开发
---

## 选择哪个 UI 方案？

在 Unity 中，有三种 UI 开发框架可选，其一是最新的 UI Toolkit，然后是 UGUI，最后是 IMGUI。

它们三者有何不同呢？在 Unity 官方文档里已经给出了解答：

+ UI Toolkit 适合程序员和 UI 设计师，类似 Web 的 UI 设计对习惯基于 GameObject 的工具和工作流的技术美术不是那么友好。

+ UGUI 适合程序员和技术美术，同理对不熟悉 GameObject 的 UI 设计师不是那么友好。

+ IMGUI 只适合程序员，对技术美术和 UI 设计师都不怎么友好。

> 另外：UI Toolkit 更适合需要适配不同分辨率的覆盖屏幕型的 UI，UGUI 更适合游戏世界内 UI 和 VR 的 UI 还有那些需要自定义 shader 或材质实现的 UI。

我们按照官方文档的顺序，先来学习 UI Toolkit。

## Unity 中 UI 的种类

Unity 中我们可以为游戏创建 UI，也可以给 Unity 编辑器创建新的 UI。也就是`Runtime UI`和`Editor UI`的区别。

## UI Toolkit

### Editor UI

#### 新建 Editor Window

我们先打开 Unity，以任意模板新建一个项目，然后在资源管理器里右键选择 `Create > UI Toolkit > Editor Window`，在弹出的窗口里的 C#一栏输入 `MyCustomEditor`，将 USS 栏的**✓**取消掉，最后点击 Confirm 创建。

#### 为 Editor Window 创建 UI

有三种方法为 Window 添加 UI，它们分别是 UI Builder 可视化编辑、UXML 文本编辑、C#代码编辑。

##### UI Builder 可视化编辑

点击图中这个 Open 来打开 UI Builder。

![这个界面是检查器窗口](https://s2.loli.net/2024/11/21/AR9zBa8qxiDj7ed.png)

这个是个人都会，在在左边拖动控件放下就是了。我们重点讲一下另外俩个。

##### UXML 文本编辑

我们在 Assets 下按顺序点击 `Create > UI Toolkit > UI Document`，将其命名为`MyCustomEditor_UXML`。

我们点击它右边的那个箭头，会弹出一个叫 inline style 的东西，我们点击它会自动跳转到外部文本编辑器。

![展开前](https://s2.loli.net/2024/11/21/N75XOhwAUYDLiCQ.png)

![展开后](https://s2.loli.net/2024/11/21/wu3yPpIo6TVmj7b.png)

然后我们可以在里面添加一些内容，标签大概长这样。

![代码长这样](https://s2.loli.net/2024/11/21/sigk9AvCVZ3Dcul.png)

然后我们需要更改 Editor Window 的 C#代码来让其加载这个 UXML 文件。

编辑`MyCustomEditor.cs`，在类中添加以下代码：

```csharp
    [SerializeField]
    private VisualTreeAsset m_UXMLTree;
```

并在 **CreateGUI()** 方法主体的最后加上这行：

```csharp
    root.Add(m_UXMLTree.Instantiate());
```

然后我们在资源管理器中选中 `MyCustomEditor.cs` ，在右侧的检查器中将 `UXML Tree`设置成 `MyCustomEditor_UXML.uxml` 。

然后我们再查看`Window > UI Toolkit > MyCustomEditor`就能看到我们用 UXML 写的编辑器 UI 了。

![窗口长这样](https://s2.loli.net/2024/11/21/v8bLG3afME2he9p.png)

##### C#代码编辑

作为程序员最喜欢的应该就是用代码来操控所有的东西了。而 Unity UI Toolkit 也允许我们用代码来创建销毁或调整控件。

打开`MyCustomEditor.cs`，我们可以看到 using 里面有一行`using UnityEngine.UIElements`，这个是添加 UI 所必须加的引用。

在 CreateUI() 方法里我么可以看到`VisualElement root = rootVisualElement`，要向窗口增加 UI，我们需要先创建 UI 对象并给它们添加一些属性，然后使用这个`root`的** Add() **方法来将 UI 添加到窗口。

例子如下：

```csharp
public void CreateGUI()
{
    // Each editor window contains a root VisualElement object
    VisualElement root = rootVisualElement;

    // VisualElements objects can contain other VisualElements following a tree hierarchy.
    Label label = new Label("这时由 C#创建的文本");
    root.Add(label);

    Button button = new Button();
    button.name = "button_cs";
    button.text = "这是由 C#创建的按钮";
    root.Add(button);

    Toggle toggle = new Toggle();
    toggle.name = "toggle_cs";
    toggle.label = "这是由 C#创建的勾选项";
    root.Add(toggle);

    // Import UXML
    var visualTree = AssetDatabase.LoadAssetAtPath<VisualTreeAsset>("Assets/Editor/MyCustomEditor.uxml");
    VisualElement labelFromUXML = visualTree.Instantiate();
    root.Add(labelFromUXML);

    root.Add(m_UXMLTree.Instantiate());
}
```

保存后重新打开窗口我们可以看到效果：

![C#版本](https://s2.loli.net/2024/11/21/LmWedVfAk2PrQFj.png)

#### 为 UI 添加控制

最终的 C#代码长这样：

```csharp
using UnityEditor;
using UnityEngine;
using UnityEngine.UIElements;

public class MyCustomEditor : EditorWindow
{
    [MenuItem("Window/UI Toolkit/MyCustomEditor")]
    public static void ShowExample()
    {
        MyCustomEditor wnd = GetWindow<MyCustomEditor>();
        wnd.titleContent = new GUIContent("MyCustomEditor");
    }

    [SerializeField]
    private VisualTreeAsset m_UXMLTree;

    private int m_ClickCount = 0;

    private const string m_ButtonPrefix = "button";

    public void CreateGUI()
    {
        // Each editor window contains a root VisualElement object
        VisualElement root = rootVisualElement;

        // VisualElements objects can contain other VisualElement following a tree hierarchy.
        Label label = new Label("These controls were created using C# code.");
        root.Add(label);

        Button button = new Button();
        button.name = "button3";
        button.text = "This is button3.";
        root.Add(button);

        Toggle toggle = new Toggle();
        toggle.name = "toggle3";
        toggle.label = "Number?";
        root.Add(toggle);

        // Import UXML
        var visualTree = AssetDatabase.LoadAssetAtPath<VisualTreeAsset>("Assets/Editor/MyCustomEditor.uxml");
        VisualElement labelFromUXML = visualTree.Instantiate();
        root.Add(labelFromUXML);

        root.Add(m_UXMLTree.Instantiate());

        //Call the event handler
        SetupButtonHandler();
    }

    //Functions as the event handlers for your button click and number counts
    private void SetupButtonHandler()
    {
        VisualElement root = rootVisualElement;

        var buttons = root.Query<Button>();
        buttons.ForEach(RegisterHandler);
    }

    private void RegisterHandler(Button button)
    {
        button.RegisterCallback<ClickEvent>(PrintClickMessage);
    }

    private void PrintClickMessage(ClickEvent evt)
    {
        VisualElement root = rootVisualElement;

        ++m_ClickCount;

        //Because of the names we gave the buttons and toggles, we can use the
        //button name to find the toggle name.
        Button button = evt.currentTarget as Button;
        string buttonNumber = button.name.Substring(m_ButtonPrefix.Length);
        string toggleName = "toggle" + buttonNumber;
        Toggle toggle = root.Q<Toggle>(toggleName);

        Debug.Log("Button was clicked!" +
            (toggle.value ? " Count: " + m_ClickCount : ""));
    }
}
```

下节我们学习 UI Builder 的一些具体使用。