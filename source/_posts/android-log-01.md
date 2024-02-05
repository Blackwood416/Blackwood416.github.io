---
title: 安卓开发学习 01
date: 2023-01-24 14:17:20
tags: 安卓
categories: 开发
---

## 写文原因

国内安卓app日益臃肿，而我们作为个人开发者，肯定是要有一定追求的。所以我尝试了一下很新的**Jetpack Compose**来进行安卓app的开发，它的声明式UI确实很有意思，不过从传统的Java转到Kotlin还是有点门槛的。

本博客记录基于**Jetpack Compose**的安卓app开发的各种要点和开发过程。

## 安卓开发环境搭建

想要搞软件开发，首当其冲的就是开发环境的搭建。安卓app的开发自然不例外。

编写安卓app最传统的方式是使用Java语言，而谷歌现在将Kotlin定为官方开发语言，然后还推了个Flutter框架，用Dart语言写跨平台的手机app,可以构建安卓或者iOS app，跨平台其实还可以使用Xamarin框架，使用C#语言。

那么选择那么多，我们选哪种呢？

作为一个喜欢C#的开发者，我很想选Xamarin，但是Xamarin因为要打包mono到apk中所以包体会很大。而Kotlin是谷歌官方推荐的语言，我们可以来尝试尝试。

Windows PC或者Linux PC可以使用Android Studio来开发，当然Intellij IDEA也是可以的（毕竟Android Studio就是Intellij IDEA的换皮），不过最好还是用Android Studio。
