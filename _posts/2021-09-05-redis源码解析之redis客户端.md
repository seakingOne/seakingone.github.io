---
layout: post
title:  "redis源码解析之redis客户端"
date:   2021-09-05
desc: "redis 客户端"
keywords: "redis 客户端"
categories: [Article]
tags: [C/C++,redis,客户端]
icon: icon-html
---

Redis服务器是典型的一对多服务器程序：一个服务器可以与多个客户端建立网络连接。<br/>
Redis服务器状态结构的clients属性是一个链表，这个链表保存了所有与服务器连接的客户端的状态结构

    struct redisServer {
    
        //一个链表，保存了所有客户端状态
        list *clients;
    
    }
    
套接字描述符，客户端状态的fd属性记录了客户端使用的套接字描述符:

    struct redisClient {
    
        //客户端名字
        robj *name;
    
        //套接字
        int fd;
        
        //客户端的角色
        int flags;
    
        //客户端状态输入缓冲区（保存客户端发送的命令请求）
        sds querybuf
    }    
    
    /* Client flags */
    #define REDIS_SLAVE (1<<0)   /* This client is a slave server */
    #define REDIS_MASTER (1<<1)  /* This client is a master server */
    #define REDIS_MONITOR (1<<2) /* This client is a slave monitor, see MONITOR */
    #define REDIS_MULTI (1<<3)   /* This client is in a MULTI context */
    #define REDIS_BLOCKED (1<<4) /* The client is waiting in a blocking operation */
    #define REDIS_DIRTY_CAS (1<<5) /* Watched keys modified. EXEC will fail. */
    #define REDIS_CLOSE_AFTER_REPLY (1<<6) /* Close after writing entire reply. */
    #define REDIS_UNBLOCKED (1<<7) /* This client was unblocked and is stored in
                                      server.unblocked_clients */
    #define REDIS_LUA_CLIENT (1<<8) /* This is a non connected client used by Lua */
    #define REDIS_ASKING (1<<9)     /* Client issued the ASKING command */
    #define REDIS_CLOSE_ASAP (1<<10)/* Close this client ASAP */
    #define REDIS_UNIX_SOCKET (1<<11) /* Client connected via Unix domain socket */
    #define REDIS_DIRTY_EXEC (1<<12)  /* EXEC will fail for errors while queueing */
    #define REDIS_MASTER_FORCE_REPLY (1<<13)  /* Queue replies even if is master */
    #define REDIS_FORCE_AOF (1<<14)   /* Force AOF propagation of current cmd. */
    #define REDIS_FORCE_REPL (1<<15)  /* Force replication of current cmd. */
    #define REDIS_PRE_PSYNC (1<<16)   /* Instance don't understand PSYNC. */
    #define REDIS_READONLY (1<<17)    /* Cluster client is in read-only state. */
    #define REDIS_PUBSUB (1<<18)      /* Client is in Pub/Sub mode. */
    
    根据客户端类型的不同，fd属性的值可以是-1或者大于-1的整数，伪客户端的fd属性为-1，表示命令请求来源于AOF文件或者LUA脚本，而不是网络，
    这种客户端不需要套接字连接，自然也不需要记录套接字描述符，目前Redis服务器会在2个地方用到伪客户端，一个用于载入AOF文件并还原数据库状态，
    而另外一个用于执行LUA脚本中包含Redis命令。
    普通客户端的fd属性的值>-1的整数。
    
    > CLIENT list
    
举个例子，假如客户端发送命令请求 set key value，那么客户端状态的querybuf属性将一个包含以下内容的sds值<br/>

    *3\r\n$3\r\nSET\r\n$3\r\nkey\r\n$5\r\nvalue\r\n
    
输入缓冲区的大小会根据输入内容动态的缩小或扩大，但它的最大大小不能超过1GB，否则服务器将会关闭这个客户端。<br/>
命令与命令参数，将服务器将客户端的命令请求保存到客户端状态的querybuf属性之后，服务器将会对命令请求的内容进行分析，并且将参数保存到客户端状态的
argv属性和argc属性：

    struct redisClient {
    
        //argv属性是一个数组，数组中的每个项都是一个字符串对象
        robj **argv;
        
        //是argv数组的长度
        int argc;
    
    }        
    
    结构图如下：
    -----------
    redisClient
    -----------            -----------
        argv      ---->      argv[0]
    -----------            ----------- 
        argc               StringObject
         3                     "SET" 
    -----------            ------------
    
命令的实现函数，当程序在命令表中成功找到argv[0]所对应的redisCommand结构时，它会将客户端状态的cmd指针指向这个结构

    struct redisClient {
    
        struct redisCommand *cmd;
    
    }
    
    ----    
    dict
    ----       ------------
    "set" ---> redisCommand 
    ----       ------------
    "get"          ....
    ----       ------------
    
输出缓冲区，执行命令所得的命令回复会被保存到客户端状态的输出缓冲区里面，每个客户端有2个输出缓冲区，一个缓冲区的大小是固定的，另一个缓冲区的大小
是可变的。<br/>
固定大小的缓冲区是保存比较固定的回复，比如OK、整数、错误消息等。<br/>
可变大小的缓冲区用于保存比较大的回复，比如一个非常长的字符串值。

    struct redisClient {
    
        //固定大小缓冲区
        char buf[];
        int bufpos;
        
        //可变大小缓冲区
        list *reply;
    
    }     
        