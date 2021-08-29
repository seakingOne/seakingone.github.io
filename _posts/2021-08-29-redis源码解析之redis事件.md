---
layout: post
title:  "redis源码解析之redis事件"
date:   2021-08-29
desc: "redis 事件 多路复用"
keywords: "redis 事件 多路复用"
categories: [Article]
tags: [C/C++,redis,事件]
icon: icon-html
---

众所周知，Redis服务器是一个事件驱动程序，服务器会处理以下2类事件：<br/>
文件事件，Redis通过套接字与客户端进行连接，文件事件是服务器对套接字操作的抽象，服务器会通过监听并处理这些事件来完成一系列
网络通信操作<br/>
Redis的I/O多路复用程序的所有功能都是通过包装select、epoll、evport、kqueue这些函数库来完成的，Redis编译的饿时候根据
不同的操作系统初始化不同的库<br/>

    源码分析：
    networking.c/acceptTcpHandler函数是Redis的连接应答处理器，这个处理器用于对连接服务器监听套接字的客户端进行应答
    对于socket.h/accpet的包装
    
    当Redis服务器进行初始化的时候，程序会将连接应答处理器和服务器监听套接字的AE_READABLE事件关联起来，当socket.h/connect
    函数连接服务器套接字的时候，会产生AE_READABLE事件，引发连接应答处理器执行，并且执行相应的套接字应答事件
    源码中是，redis.c/initServer
    
    /* Create an event handler for accepting new connections in TCP and Unix
         * domain sockets. */
    for (j = 0; j < server.ipfd_count; j++) {
        if (aeCreateFileEvent(server.el, server.ipfd[j], AE_READABLE,
            acceptTcpHandler,NULL) == AE_ERR)
            {
                redisPanic(
                    "Unrecoverable error creating server.ipfd file event.");
            }
    }
    
    命令请求处理器，networking.c/readQueryFromClient函数是Redis的命令请求处理器，这个处理器负责从套接字中读入客户端发送
    的请求内容
    
    redisClient *createClient(int fd){
    
        
        if (fd != -1) {
            anetNonBlock(NULL,fd);
            anetEnableTcpNoDelay(NULL,fd);
            if (server.tcpkeepalive)
                anetKeepAlive(NULL,fd,server.tcpkeepalive);
            if (aeCreateFileEvent(server.el,fd,AE_READABLE,
                readQueryFromClient, c) == AE_ERR)
            {
                close(fd);
                zfree(c);
                return NULL;
            }
        }
    }
    
    命令回复处理器，networking.c/sendReplyToClient函数是Redis的命令回复处理器，这个处理器负责将服务器执行命令后的数据返回给客户端
    int prepareClientToWrite(redisClient *c) {
        /* If it's the Lua client we always return ok without installing any
         * handler since there is no socket at all. */
        if (c->flags & REDIS_LUA_CLIENT) return REDIS_OK;
    
        /* Masters don't receive replies, unless REDIS_MASTER_FORCE_REPLY flag
         * is set. */
        if ((c->flags & REDIS_MASTER) &&
            !(c->flags & REDIS_MASTER_FORCE_REPLY)) return REDIS_ERR;
    
        if (c->fd <= 0) return REDIS_ERR; /* Fake client for AOF loading. */
    
        /* Only install the handler if not already installed and, in case of
         * slaves, if the client can actually receive writes. */
        if (c->bufpos == 0 && listLength(c->reply) == 0 &&
            (c->replstate == REDIS_REPL_NONE ||
             (c->replstate == REDIS_REPL_ONLINE && !c->repl_put_online_on_ack)))
        {
            /* Try to install the write handler. */
            if (aeCreateFileEvent(server.el, c->fd, AE_WRITABLE,
                    sendReplyToClient, c) == AE_ERR)
            {
                freeClientAsync(c);
                return REDIS_ERR;
            }
        }
    
        /* Authorize the caller to queue in the output buffer of this client. */
        return REDIS_OK;
    }
    
    

时间事件，定时定点做某些事，比如之前的AOF和RDB定时数据持久化

    源码也是在redis.c/initServer函数中，初始化了时间事件
    /* Create the serverCron() time event, that's our main way to process
         * background operations. */
    if(aeCreateTimeEvent(server.el, 1, serverCron, NULL, NULL) == AE_ERR) {
        redisPanic("Can't create the serverCron time event.");
        exit(1);
    }
    
    aeProcessEvents中
    /* Check time events */
    if (flags & AE_TIME_EVENTS)
        processed += processTimeEvents(eventLoop);
    
不管是文件事件还是时间事件，都是在main的主进程中阻塞等待事件的处理，具体的执行入口为ae.c/aeMain 
-> ae.c/aeProcessEvents -> 文件事件/时间事件 