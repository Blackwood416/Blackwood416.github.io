---
title: Web开发日志 02
date: 2023-07-25 21:17:58
tags: Web
categories: 开发
---

## CSS

CSS（Cascading Style Sheets，层叠样式表）是一种样式表语言，用于为HTML布局提供样式。虽然现在有很多框架用来提供一些组件化的CSS，但是了解基础也很重要。我们今天就来给HTML网页添加纯CSS来让它变得缤纷多彩。

## border

我们先从最简单的边缘样式开始。

```css
/* border */
border: 1px solid black;
```

`border` 是一个简写属性，可以同时设置 `border-width`、`border-style` 和 `border-color`。`border-width` 是边缘的宽度，`border-style` 是边缘的样式，`border-color` 是边缘的颜色。

## padding

接下来我们来看 `padding` 属性，它用于设置元素内容与边缘之间的空间。

```css
/* padding */
padding: 10px;
```

`padding` 是一个简写属性，可以同时设置 `padding-top`、`padding-right`、`padding-bottom` 和 `padding-left`。这里我们设置了所有边缘的 `padding` 为 10px。

## margin

`margin` 属性用于设置元素边缘与其它元素之间的空间。

```css
/* margin */
margin: 10px;
```

`margin` 是一个简写属性，可以同时设置 `margin-top`、`margin-right`、`margin-bottom` 和 `margin-left`。这里我们设置了所有边缘的 `margin` 为 10px。

## background

`background` 属性用于设置元素的背景样式。

```css
/* background */
background-color: #f0f0f0;
background-image: url('background.jpg');
background-repeat: no-repeat;
background-size: cover;
```

`background-color` 设置背景颜色，`background-image` 设置背景图片，`background-repeat` 设置背景图片是否重复，`background-size` 设置背景图片的大小。

## font

`font` 属性用于设置元素的字体样式。

```css
/* font */
font-family: Arial, sans-serif;
font-size: 16px;
font-weight: bold;
font-style: italic;
```

`font-family` 设置字体，`font-size` 设置字体大小，`font-weight` 设置字体粗细，`font-style` 设置字体样式。

## text

`text` 属性用于设置元素的文本样式。

```css
/* text */
text-align: center;
text-decoration: underline;
text-transform: uppercase;
```

`text-align` 设置文本对齐方式，`text-decoration` 设置文本装饰，`text-transform` 设置文本转换。

## display

`display` 属性用于设置元素的显示方式。

```css
/* display */
display: block;
display: inline;
display: inline-block;
display: flex;
display: grid;
```

`display` 属性可以设置元素的显示方式，例如块级元素、内联元素、内联块级元素、弹性布局和网格布局。

## position

`position` 属性用于设置元素的定位方式。

```css
/* position */
position: static;
position: relative;
position: absolute;
position: fixed;
```

`position` 属性可以设置元素的定位方式，例如静态定位、相对定位、绝对定位和固定定位。

## 总结

今天我们学习了CSS的一些基础属性，包括 `border`、`padding`、`margin`、`background`、`font`、`text`、`display` 和 `position`。这些属性可以帮助我们更好地控制网页的排版，使网页更加美观和易用。