---
title: Unity Input开发日志 01
date: 2024-10-01 23:12:15
tags: Unity
categories: Unity
---

## Input System 和 Input Manager

`Input System`是新一代的输入方案，相比于`Input Manager`，它更加灵活与强大，但是因为坑很多所以大厂还是在用`Input Manager`。

不过`Input System`确实是处理了很多独立开发者在进行输入控制时可能遇到的痛点，所以还是值得推荐的，至少它不像`Addressable`那样只有坑，没有好处。

## 安装Input System

在Unity引擎中选中工具栏中的`Window` -> `Package Manager`，然后在搜索栏中输入`Input System`并安装。

然后我们需要在`Project Settings`中激活`Input System`，在`Project Settings`中选择`Player` -> `Other Settings` -> `Active Input Handling` -> `Input System Package (New)`。

## 使用Input System

要使用`Input System`，我们需要先创建一个`Input Action`。

在这个`Input Action`里创建一个`Action Map`，然后在这个`Action Map`里创建`Action`，每个`Action`代表一个输入设备上的一个输入事件。

在Inspector中我们让`Input Action`创建C#类，这样我们就可以在代码中使用这个`Input Action`。

假设我们有一个叫作`PlayerInputActions`的`Input Action`，我们可以在代码中这样使用它：

```csharp
PlayerInputActions inputActions = new PlayerInputActions();
var variable = inputActions.Player.Move.ReadValue<Vector2>();
```

上面的代码中`PlayerInputActions`是C#类名，`Player`是`Action Map`名，`Move`是`Action`名，我们可以在`Input Action`的Inspector中设置每个Action的`Control Type`以控制它的输入使用的类型，然后用`ReadValue<type>()`方法来读取输入事件的值。

## Player Input + EventSystem

我们可以通过`Player Input`组件来绑定`Action`，然后通过`EventSystem`来处理输入事件，可以实现更加灵活的输入处理。但需要注意的是`EventSystem`在`Input System`与`Input Manager`的不同，比如我们需要先**Disable**后再**Enable**`EventSystem`的实例，才能手动更改`EventSystem`的`currentSelectedGameObject`，如下：

```csharp
EventSystem eventSystem = EventSystem.current;
eventSystem.enabled = false;
eventSystem.currentSelectedGameObject = null;
eventSystem.currentSelectedGameObject = targetGameObject;
eventSystem.enabled = true;
```

否则会遇上将`currentSelectedGameObject`改为某个Button时会调用其`OnClick`方法等问题。

## 总结

`Input System`是Unity引擎中新的输入方案，相比于`Input Manager`，它更加灵活与强大，但它也存在很多问题，如果不是必要，还是不要用它。