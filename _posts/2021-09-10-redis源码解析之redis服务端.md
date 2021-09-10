---
layout: post
title:  "redis源码解析之redis服务端.md"
date:   2021-09-10
desc: "redis 服务端"
keywords: "redis 服务端"
categories: [Article]
tags: [C/C++,redis,服务端]
icon: icon-html
---

Redis服务器的处理流程：<br/>
一个命令请求从发送到获得回复的过程中，如果我们执行下面命令:
    
    redis > set KEY VALUE
    OK

其中的操作有：<br/>
1）客户端向服务器发送命令请求<br/>
2）服务起接收并处理客户端发送来的命令请求，在数据库中进行设置操作，并产生命令回复OK<br/>
3）服务器将命令回复OK发送给客户端<br/>
4）客户端显示内容打印给用户看<br/>

接下来详细介绍第2步的操作<br/>
服务器读取套接字中的命令请求，并把内容保存到客户端状态的输入缓冲区中，也就是redisServer/clients，对输入缓冲区的命令请求进行分析
，提取出命令请求中包含的命令参数，以及命令参数的个数，然后分别将参数和参数个数保存到clients中 （argv,argc）;当套接字读事件时，
调用命令执行器，执行客户端的命令<br/>

<img src="{{ site.img_path }}/redis/server/server.png" width="65%"> <br/>

之后，分析程序将对输入缓冲区中的协议进行分析：<br/>

    *3\r\n$3\r\nSET\r\n$3\r\nKEY\r\n$5\r\nVALUE\r\n

并将得出的分析结构保存到客户端状态的argv属性和argc属性里面，如下图所示:

<img src="{{ site.img_path }}/redis/server/server-1.png" width="65%"> <br/>    

代码流程跟踪:<br/>
    
    redis.c/initServer/aeCreateFileEvent(acceptTcpHandler) -> networking.c/acceptTcpHandler/acceptCommonHandler 
    -> networking.c/acceptCommonHandler/createClient -> networking.c/createClient/aeCreateFileEvent(readQueryFromClient)
    -> networking.c/readQueryFromClient
    
    其中server.ipfd数组大小为16，因为redis默认为16个数据库，所以需要创建16个监听的文件句柄，做epoll轮询
    
    
该模块内容较多，楼主需要慢慢更新。更多内容+Q 867120103<br/>    
     