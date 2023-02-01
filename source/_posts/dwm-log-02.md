---
title: 窗口管理器dwm配置日志 02
date: 2023-02-01 20:39:32
tags: dwm
---

# 窗口管理器dwm配置日志 02

上一篇我们完成了dwm的基础显示环境的搭建，从这一篇开始我们正式开始配置我们的dwm。

# config.def.h

因为dwm是通过修改其源码来进行配置的，所以我们来看看在源码中能进行哪些配置。首先就是 config.def.h 这个文件。

这个文件默认的样子是这样的：
```c
/* See LICENSE file for copyright and license details. */

/* appearance */
static const unsigned int borderpx  = 1;        /* border pixel of windows */
static const unsigned int snap      = 32;       /* snap pixel */
static const int showbar            = 1;        /* 0 means no bar */
static const int topbar             = 1;        /* 0 means bottom bar */
static const char *fonts[]          = { "monospace:size=10" };
static const char dmenufont[]       = "monospace:size=10";
static const char col_gray1[]       = "#222222";
static const char col_gray2[]       = "#444444";
static const char col_gray3[]       = "#bbbbbb";
static const char col_gray4[]       = "#eeeeee";
static const char col_cyan[]        = "#005577";
static const char *colors[][3]      = {
	/*               fg         bg         border   */
	[SchemeNorm] = { col_gray3, col_gray1, col_gray2 },
	[SchemeSel]  = { col_gray4, col_cyan,  col_cyan  },
};

/* tagging */
static const char *tags[] = { "1", "2", "3", "4", "5", "6", "7", "8", "9" };

static const Rule rules[] = {
	/* xprop(1):
	 *	WM_CLASS(STRING) = instance, class
	 *	WM_NAME(STRING) = title
	 */
	/* class      instance    title       tags mask     isfloating   monitor */
	{ "Gimp",     NULL,       NULL,       0,            1,           -1 },
	{ "Firefox",  NULL,       NULL,       1 << 8,       0,           -1 },
};

/* layout(s) */
static const float mfact     = 0.55; /* factor of master area size [0.05..0.95] */
static const int nmaster     = 1;    /* number of clients in master area */
static const int resizehints = 1;    /* 1 means respect size hints in tiled resizals */
static const int lockfullscreen = 1; /* 1 will force focus on the fullscreen window */

static const Layout layouts[] = {
	/* symbol     arrange function */
	{ "[]=",      tile },    /* first entry is default */
	{ "><>",      NULL },    /* no layout function means floating behavior */
	{ "[M]",      monocle },
};

/* key definitions */
#define MODKEY Mod1Mask
#define TAGKEYS(KEY,TAG) \
	{ MODKEY,                       KEY,      view,           {.ui = 1 << TAG} }, \
	{ MODKEY|ControlMask,           KEY,      toggleview,     {.ui = 1 << TAG} }, \
	{ MODKEY|ShiftMask,             KEY,      tag,            {.ui = 1 << TAG} }, \
	{ MODKEY|ControlMask|ShiftMask, KEY,      toggletag,      {.ui = 1 << TAG} },

/* helper for spawning shell commands in the pre dwm-5.0 fashion */
#define SHCMD(cmd) { .v = (const char*[]){ "/bin/sh", "-c", cmd, NULL } }

/* commands */
static const char *dmenucmd[] = { "dmenu_run", "-fn", dmenufont, "-nb", col_gray1, "-nf", col_gray3, "-sb", col_cyan, "-sf", col_gray4, NULL };
static const char *termcmd[]  = { "st", NULL };

static const Key keys[] = {
	/* modifier                     key        function        argument */
	{ MODKEY,                       XK_p,      spawn,          {.v = dmenucmd } },
	{ MODKEY|ShiftMask,             XK_Return, spawn,          {.v = termcmd } },
	{ MODKEY,                       XK_b,      togglebar,      {0} },
	{ MODKEY,                       XK_j,      focusstack,     {.i = +1 } },
	{ MODKEY,                       XK_k,      focusstack,     {.i = -1 } },
	{ MODKEY,                       XK_i,      incnmaster,     {.i = +1 } },
	{ MODKEY,                       XK_d,      incnmaster,     {.i = -1 } },
	{ MODKEY,                       XK_h,      setmfact,       {.f = -0.05} },
	{ MODKEY,                       XK_l,      setmfact,       {.f = +0.05} },
	{ MODKEY,                       XK_Return, zoom,           {0} },
	{ MODKEY,                       XK_Tab,    view,           {0} },
	{ MODKEY|ShiftMask,             XK_c,      killclient,     {0} },
	{ MODKEY,                       XK_t,      setlayout,      {.v = &layouts[0]} },
	{ MODKEY,                       XK_f,      setlayout,      {.v = &layouts[1]} },
	{ MODKEY,                       XK_m,      setlayout,      {.v = &layouts[2]} },
	{ MODKEY,                       XK_space,  setlayout,      {0} },
	{ MODKEY|ShiftMask,             XK_space,  togglefloating, {0} },
	{ MODKEY,                       XK_0,      view,           {.ui = ~0 } },
	{ MODKEY|ShiftMask,             XK_0,      tag,            {.ui = ~0 } },
	{ MODKEY,                       XK_comma,  focusmon,       {.i = -1 } },
	{ MODKEY,                       XK_period, focusmon,       {.i = +1 } },
	{ MODKEY|ShiftMask,             XK_comma,  tagmon,         {.i = -1 } },
	{ MODKEY|ShiftMask,             XK_period, tagmon,         {.i = +1 } },
	TAGKEYS(                        XK_1,                      0)
	TAGKEYS(                        XK_2,                      1)
	TAGKEYS(                        XK_3,                      2)
	TAGKEYS(                        XK_4,                      3)
	TAGKEYS(                        XK_5,                      4)
	TAGKEYS(                        XK_6,                      5)
	TAGKEYS(                        XK_7,                      6)
	TAGKEYS(                        XK_8,                      7)
	TAGKEYS(                        XK_9,                      8)
	{ MODKEY|ShiftMask,             XK_q,      quit,           {0} },
};

/* button definitions */
/* click can be ClkTagBar, ClkLtSymbol, ClkStatusText, ClkWinTitle, ClkClientWin, or ClkRootWin */
static const Button buttons[] = {
	/* click                event mask      button          function        argument */
	{ ClkLtSymbol,          0,              Button1,        setlayout,      {0} },
	{ ClkLtSymbol,          0,              Button3,        setlayout,      {.v = &layouts[2]} },
	{ ClkWinTitle,          0,              Button2,        zoom,           {0} },
	{ ClkStatusText,        0,              Button2,        spawn,          {.v = termcmd } },
	{ ClkClientWin,         MODKEY,         Button1,        movemouse,      {0} },
	{ ClkClientWin,         MODKEY,         Button2,        togglefloating, {0} },
	{ ClkClientWin,         MODKEY,         Button3,        resizemouse,    {0} },
	{ ClkTagBar,            0,              Button1,        view,           {0} },
	{ ClkTagBar,            0,              Button3,        toggleview,     {0} },
	{ ClkTagBar,            MODKEY,         Button1,        tag,            {0} },
	{ ClkTagBar,            MODKEY,         Button3,        toggletag,      {0} },
};
```

可以看到其中有很多变量可以进行配置，我们从上到下一个一个地来。

## **borderpx**：

右边的注释写着这个是窗口边界的像素宽度。这个变量的值越大，窗口的边界就有越大的空隙。

## **snap**：

待补。

## **showbar**：

该变量控制dwm屏幕顶栏是否显示，1 为 true，0 为 false。

## **topbar**：

该变量控制dwm顶栏的位置，值为 1 则顶栏在屏幕顶端显示，值为 0 则顶栏变成底栏，在屏幕底端显示。

## ***fonts[]**：

这个变量控制dwm的字体类型和大小，默认值为`{"monospace:size=10"}`，即默认字体是monospace,大小为10像素。在Linux中可以通过`fc-list`命令查看系统中有什么字体。这里我们选择安装一个叫作FiraCode的编程用等宽字体，在Arch Linux中执行：`sudo pacman -S ttf-firacode-nerd`，这个字体中包含很多图标文字，我们后面会用到。

## **dmenufont[]**：

dmenu是dwm开发者开发的配套软件，能够快捷启动应用程序。这个变量即是控制dmenu的字体，因为我们后面要用**rofi**代替dmenu，所以这个变量我们略过。

## **col_gray1**、**col_gray2**、**col_gray3**、**col_gray4**、**col_cyan**、***colors[][3]**：

这几个是dwm的配色设置，暂时先不管它们。

## ***tags[]**：

这个是对dwm任务栏的配置，默认就只是1-9,相当于9个工作区，这个我们后面再来具体调整。

## ***rules[]**：

这个是针对特定应用进行的一些配置，现在先不用管它。

## **mfact**：

待补。

## **nmaster**：

待补。

## **resizehints**：

待补。

## **lockfullsreen**：

待补。

## **layouts[]**：

dwm顶栏有个控制窗口布局规则的按钮，这个变量即是改变该按钮的一些配置。dwm默认有三种窗口布局规则，即平铺（tile）、浮动和单镜片（monocle）。平铺是只留一个大的窗口在左侧屏幕，其他窗口则堆积在右侧；浮动就跟普通的窗口管理器一样，窗口之间可以层叠；单镜片则是将所有窗口全屏堆叠。

## ***dmenucm[]**：

这个是配置dmenu用什么方式打开应用，我们同样不管它。

## ***termcmd[]**：

这个是dwm的终端配置，可以看到默认的终端软件是**st**，这同样是dwm开发者开发的配套软件，我们后面会讲到这块的配置。

## **keys[]**：

这一块就是对dwm快捷键的配置了。

## **buttons[]**：

这块是对于dwm中一些点击事件的处理。