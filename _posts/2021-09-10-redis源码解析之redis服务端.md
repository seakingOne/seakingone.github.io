---
layout: post
title:  "redis源码解析之redis服务端"
date:   2021-09-10
desc: "redis 服务端"
keywords: "redis 服务端"
categories: [Database]
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
    命令参数的解析在networking.c/readQueryFromClient/processInputBuffer，把参数存储到argv和argc中去
    
当客户端连接建立和参数解析完成之后，命令执行器开始工作，去查找命令的实现，代码在

    networking.c/readQueryFromClient/processInputBuffer -> networking.c/processInputBuffer/processCommand 
    
    通过里层的lookupCommand方法查看对应的命令函数，通过从redisCommand中取出对应的数据，源码如下：
    struct redisCommand redisCommandTable[] = {
        {"get",getCommand,2,"rF",0,NULL,1,1,1,0,0},
        {"set",setCommand,-3,"wm",0,NULL,1,1,1,0,0},
        {"setnx",setnxCommand,3,"wmF",0,NULL,1,1,1,0,0},
        {"setex",setexCommand,4,"wm",0,NULL,1,1,1,0,0},
        {"psetex",psetexCommand,4,"wm",0,NULL,1,1,1,0,0},
        {"append",appendCommand,3,"wm",0,NULL,1,1,1,0,0},
        {"strlen",strlenCommand,2,"rF",0,NULL,1,1,1,0,0},
        {"del",delCommand,-2,"w",0,NULL,1,-1,1,0,0},
        {"exists",existsCommand,-2,"rF",0,NULL,1,-1,1,0,0},
        {"setbit",setbitCommand,4,"wm",0,NULL,1,1,1,0,0},
        {"getbit",getbitCommand,3,"rF",0,NULL,1,1,1,0,0},
        {"setrange",setrangeCommand,4,"wm",0,NULL,1,1,1,0,0},
        {"getrange",getrangeCommand,4,"r",0,NULL,1,1,1,0,0},
        {"substr",getrangeCommand,4,"r",0,NULL,1,1,1,0,0},
        {"incr",incrCommand,2,"wmF",0,NULL,1,1,1,0,0},
        {"decr",decrCommand,2,"wmF",0,NULL,1,1,1,0,0},
        {"mget",mgetCommand,-2,"r",0,NULL,1,-1,1,0,0},
        {"rpush",rpushCommand,-3,"wmF",0,NULL,1,1,1,0,0},
        {"lpush",lpushCommand,-3,"wmF",0,NULL,1,1,1,0,0},
        {"rpushx",rpushxCommand,3,"wmF",0,NULL,1,1,1,0,0},
        {"lpushx",lpushxCommand,3,"wmF",0,NULL,1,1,1,0,0},
        {"linsert",linsertCommand,5,"wm",0,NULL,1,1,1,0,0},
        {"rpop",rpopCommand,2,"wF",0,NULL,1,1,1,0,0},
        {"lpop",lpopCommand,2,"wF",0,NULL,1,1,1,0,0},
        {"brpop",brpopCommand,-3,"ws",0,NULL,1,1,1,0,0},
        {"brpoplpush",brpoplpushCommand,4,"wms",0,NULL,1,2,1,0,0},
        {"blpop",blpopCommand,-3,"ws",0,NULL,1,-2,1,0,0},
        {"llen",llenCommand,2,"rF",0,NULL,1,1,1,0,0},
        {"lindex",lindexCommand,3,"r",0,NULL,1,1,1,0,0},
        {"lset",lsetCommand,4,"wm",0,NULL,1,1,1,0,0},
        {"lrange",lrangeCommand,4,"r",0,NULL,1,1,1,0,0},
        {"ltrim",ltrimCommand,4,"w",0,NULL,1,1,1,0,0},
        {"lrem",lremCommand,4,"w",0,NULL,1,1,1,0,0},
        {"rpoplpush",rpoplpushCommand,3,"wm",0,NULL,1,2,1,0,0},
        {"sadd",saddCommand,-3,"wmF",0,NULL,1,1,1,0,0},
        {"srem",sremCommand,-3,"wF",0,NULL,1,1,1,0,0},
        {"smove",smoveCommand,4,"wF",0,NULL,1,2,1,0,0},
        {"sismember",sismemberCommand,3,"rF",0,NULL,1,1,1,0,0},
        {"scard",scardCommand,2,"rF",0,NULL,1,1,1,0,0},
        {"spop",spopCommand,2,"wRsF",0,NULL,1,1,1,0,0},
        {"srandmember",srandmemberCommand,-2,"rR",0,NULL,1,1,1,0,0},
        {"sinter",sinterCommand,-2,"rS",0,NULL,1,-1,1,0,0},
        {"sinterstore",sinterstoreCommand,-3,"wm",0,NULL,1,-1,1,0,0},
        {"sunion",sunionCommand,-2,"rS",0,NULL,1,-1,1,0,0},
        {"sunionstore",sunionstoreCommand,-3,"wm",0,NULL,1,-1,1,0,0},
        {"sdiff",sdiffCommand,-2,"rS",0,NULL,1,-1,1,0,0},
        {"sdiffstore",sdiffstoreCommand,-3,"wm",0,NULL,1,-1,1,0,0},
        {"smembers",sinterCommand,2,"rS",0,NULL,1,1,1,0,0},
        {"sscan",sscanCommand,-3,"rR",0,NULL,1,1,1,0,0},
        {"zadd",zaddCommand,-4,"wmF",0,NULL,1,1,1,0,0},
        {"zincrby",zincrbyCommand,4,"wmF",0,NULL,1,1,1,0,0},
        {"zrem",zremCommand,-3,"wF",0,NULL,1,1,1,0,0},
        {"zremrangebyscore",zremrangebyscoreCommand,4,"w",0,NULL,1,1,1,0,0},
        {"zremrangebyrank",zremrangebyrankCommand,4,"w",0,NULL,1,1,1,0,0},
        {"zremrangebylex",zremrangebylexCommand,4,"w",0,NULL,1,1,1,0,0},
        {"zunionstore",zunionstoreCommand,-4,"wm",0,zunionInterGetKeys,0,0,0,0,0},
        {"zinterstore",zinterstoreCommand,-4,"wm",0,zunionInterGetKeys,0,0,0,0,0},
        {"zrange",zrangeCommand,-4,"r",0,NULL,1,1,1,0,0},
        {"zrangebyscore",zrangebyscoreCommand,-4,"r",0,NULL,1,1,1,0,0},
        {"zrevrangebyscore",zrevrangebyscoreCommand,-4,"r",0,NULL,1,1,1,0,0},
        {"zrangebylex",zrangebylexCommand,-4,"r",0,NULL,1,1,1,0,0},
        {"zrevrangebylex",zrevrangebylexCommand,-4,"r",0,NULL,1,1,1,0,0},
        {"zcount",zcountCommand,4,"rF",0,NULL,1,1,1,0,0},
        {"zlexcount",zlexcountCommand,4,"rF",0,NULL,1,1,1,0,0},
        {"zrevrange",zrevrangeCommand,-4,"r",0,NULL,1,1,1,0,0},
        {"zcard",zcardCommand,2,"rF",0,NULL,1,1,1,0,0},
        {"zscore",zscoreCommand,3,"rF",0,NULL,1,1,1,0,0},
        {"zrank",zrankCommand,3,"rF",0,NULL,1,1,1,0,0},
        {"zrevrank",zrevrankCommand,3,"rF",0,NULL,1,1,1,0,0},
        {"zscan",zscanCommand,-3,"rR",0,NULL,1,1,1,0,0},
        {"hset",hsetCommand,4,"wmF",0,NULL,1,1,1,0,0},
        {"hsetnx",hsetnxCommand,4,"wmF",0,NULL,1,1,1,0,0},
        {"hget",hgetCommand,3,"rF",0,NULL,1,1,1,0,0},
        {"hmset",hmsetCommand,-4,"wm",0,NULL,1,1,1,0,0},
        {"hmget",hmgetCommand,-3,"r",0,NULL,1,1,1,0,0},
        {"hincrby",hincrbyCommand,4,"wmF",0,NULL,1,1,1,0,0},
        {"hincrbyfloat",hincrbyfloatCommand,4,"wmF",0,NULL,1,1,1,0,0},
        {"hdel",hdelCommand,-3,"wF",0,NULL,1,1,1,0,0},
        {"hlen",hlenCommand,2,"rF",0,NULL,1,1,1,0,0},
        {"hkeys",hkeysCommand,2,"rS",0,NULL,1,1,1,0,0},
        {"hvals",hvalsCommand,2,"rS",0,NULL,1,1,1,0,0},
        {"hgetall",hgetallCommand,2,"r",0,NULL,1,1,1,0,0},
        {"hexists",hexistsCommand,3,"rF",0,NULL,1,1,1,0,0},
        {"hscan",hscanCommand,-3,"rR",0,NULL,1,1,1,0,0},
        {"incrby",incrbyCommand,3,"wmF",0,NULL,1,1,1,0,0},
        {"decrby",decrbyCommand,3,"wmF",0,NULL,1,1,1,0,0},
        {"incrbyfloat",incrbyfloatCommand,3,"wmF",0,NULL,1,1,1,0,0},
        {"getset",getsetCommand,3,"wm",0,NULL,1,1,1,0,0},
        {"mset",msetCommand,-3,"wm",0,NULL,1,-1,2,0,0},
        {"msetnx",msetnxCommand,-3,"wm",0,NULL,1,-1,2,0,0},
        {"randomkey",randomkeyCommand,1,"rR",0,NULL,0,0,0,0,0},
        {"select",selectCommand,2,"rlF",0,NULL,0,0,0,0,0},
        {"move",moveCommand,3,"wF",0,NULL,1,1,1,0,0},
        {"rename",renameCommand,3,"w",0,NULL,1,2,1,0,0},
        {"renamenx",renamenxCommand,3,"wF",0,NULL,1,2,1,0,0},
        {"expire",expireCommand,3,"wF",0,NULL,1,1,1,0,0},
        {"expireat",expireatCommand,3,"wF",0,NULL,1,1,1,0,0},
        {"pexpire",pexpireCommand,3,"wF",0,NULL,1,1,1,0,0},
        {"pexpireat",pexpireatCommand,3,"wF",0,NULL,1,1,1,0,0},
        {"keys",keysCommand,2,"rS",0,NULL,0,0,0,0,0},
        {"scan",scanCommand,-2,"rR",0,NULL,0,0,0,0,0},
        {"dbsize",dbsizeCommand,1,"rF",0,NULL,0,0,0,0,0},
        {"auth",authCommand,2,"rsltF",0,NULL,0,0,0,0,0},
        {"ping",pingCommand,-1,"rtF",0,NULL,0,0,0,0,0},
        {"echo",echoCommand,2,"rF",0,NULL,0,0,0,0,0},
        {"save",saveCommand,1,"ars",0,NULL,0,0,0,0,0},
        {"bgsave",bgsaveCommand,1,"ar",0,NULL,0,0,0,0,0},
        {"bgrewriteaof",bgrewriteaofCommand,1,"ar",0,NULL,0,0,0,0,0},
        {"shutdown",shutdownCommand,-1,"arlt",0,NULL,0,0,0,0,0},
        {"lastsave",lastsaveCommand,1,"rRF",0,NULL,0,0,0,0,0},
        {"type",typeCommand,2,"rF",0,NULL,1,1,1,0,0},
        {"multi",multiCommand,1,"rsF",0,NULL,0,0,0,0,0},
        {"exec",execCommand,1,"sM",0,NULL,0,0,0,0,0},
        {"discard",discardCommand,1,"rsF",0,NULL,0,0,0,0,0},
        {"sync",syncCommand,1,"ars",0,NULL,0,0,0,0,0},
        {"psync",syncCommand,3,"ars",0,NULL,0,0,0,0,0},
        {"replconf",replconfCommand,-1,"arslt",0,NULL,0,0,0,0,0},
        {"flushdb",flushdbCommand,1,"w",0,NULL,0,0,0,0,0},
        {"flushall",flushallCommand,1,"w",0,NULL,0,0,0,0,0},
        {"sort",sortCommand,-2,"wm",0,sortGetKeys,1,1,1,0,0},
        {"info",infoCommand,-1,"rlt",0,NULL,0,0,0,0,0},
        {"monitor",monitorCommand,1,"ars",0,NULL,0,0,0,0,0},
        {"ttl",ttlCommand,2,"rF",0,NULL,1,1,1,0,0},
        {"pttl",pttlCommand,2,"rF",0,NULL,1,1,1,0,0},
        {"persist",persistCommand,2,"wF",0,NULL,1,1,1,0,0},
        {"slaveof",slaveofCommand,3,"ast",0,NULL,0,0,0,0,0},
        {"role",roleCommand,1,"lst",0,NULL,0,0,0,0,0},
        {"debug",debugCommand,-2,"as",0,NULL,0,0,0,0,0},
        {"config",configCommand,-2,"art",0,NULL,0,0,0,0,0},
        {"subscribe",subscribeCommand,-2,"rpslt",0,NULL,0,0,0,0,0},
        {"unsubscribe",unsubscribeCommand,-1,"rpslt",0,NULL,0,0,0,0,0},
        {"psubscribe",psubscribeCommand,-2,"rpslt",0,NULL,0,0,0,0,0},
        {"punsubscribe",punsubscribeCommand,-1,"rpslt",0,NULL,0,0,0,0,0},
        {"publish",publishCommand,3,"pltrF",0,NULL,0,0,0,0,0},
        {"pubsub",pubsubCommand,-2,"pltrR",0,NULL,0,0,0,0,0},
        {"watch",watchCommand,-2,"rsF",0,NULL,1,-1,1,0,0},
        {"unwatch",unwatchCommand,1,"rsF",0,NULL,0,0,0,0,0},
        {"cluster",clusterCommand,-2,"ar",0,NULL,0,0,0,0,0},
        {"restore",restoreCommand,-4,"wm",0,NULL,1,1,1,0,0},
        {"restore-asking",restoreCommand,-4,"wmk",0,NULL,1,1,1,0,0},
        {"migrate",migrateCommand,-6,"w",0,migrateGetKeys,0,0,0,0,0},
        {"asking",askingCommand,1,"r",0,NULL,0,0,0,0,0},
        {"readonly",readonlyCommand,1,"rF",0,NULL,0,0,0,0,0},
        {"readwrite",readwriteCommand,1,"rF",0,NULL,0,0,0,0,0},
        {"dump",dumpCommand,2,"r",0,NULL,1,1,1,0,0},
        {"object",objectCommand,3,"r",0,NULL,2,2,2,0,0},
        {"client",clientCommand,-2,"rs",0,NULL,0,0,0,0,0},
        {"eval",evalCommand,-3,"s",0,evalGetKeys,0,0,0,0,0},
        {"evalsha",evalShaCommand,-3,"s",0,evalGetKeys,0,0,0,0,0},
        {"slowlog",slowlogCommand,-2,"r",0,NULL,0,0,0,0,0},
        {"script",scriptCommand,-2,"rs",0,NULL,0,0,0,0,0},
        {"time",timeCommand,1,"rRF",0,NULL,0,0,0,0,0},
        {"bitop",bitopCommand,-4,"wm",0,NULL,2,-1,1,0,0},
        {"bitcount",bitcountCommand,-2,"r",0,NULL,1,1,1,0,0},
        {"bitpos",bitposCommand,-3,"r",0,NULL,1,1,1,0,0},
        {"wait",waitCommand,3,"rs",0,NULL,0,0,0,0,0},
        {"command",commandCommand,0,"rlt",0,NULL,0,0,0,0,0},
        {"pfselftest",pfselftestCommand,1,"r",0,NULL,0,0,0,0,0},
        {"pfadd",pfaddCommand,-2,"wmF",0,NULL,1,1,1,0,0},
        {"pfcount",pfcountCommand,-2,"r",0,NULL,1,-1,1,0,0},
        {"pfmerge",pfmergeCommand,-2,"wm",0,NULL,1,-1,1,0,0},
        {"pfdebug",pfdebugCommand,-3,"w",0,NULL,0,0,0,0,0},
        {"latency",latencyCommand,-2,"arslt",0,NULL,0,0,0,0,0}
    };
    
当所有的属性都解析完毕之后，开始调用函数指针方法，方法为:

    redis.c中
    /* Call() is the core of Redis execution of a command */
    void call(redisClient *c, int flags); 
    类似执行client->cmd->proc(client);
    
    方法执行完成之后，命令回复保存到客户端的输出缓冲区中，由于是set命令，为固定大小缓冲区，
    //固定大小缓冲区
    char buf[];
    int bufpos;
    
    //可变大小缓冲区
    list *reply; 
    
执行之后的后续操作，比如开启了慢日志查询，那么会判断是否需要记录日志，也是在call方法中执行的：

    /* Log the command into the Slow log if needed, and populate the
         * per-command statistics that we show in INFO commandstats. */
    if (flags & REDIS_CALL_SLOWLOG && c->cmd->proc != execCommand) {
        char *latency_event = (c->cmd->flags & REDIS_CMD_FAST) ?
                              "fast-command" : "command";
        latencyAddSampleIfNeeded(latency_event,duration/1000);
        slowlogPushEntryIfNeeded(c->argv,c->argc,duration);
    }   
    
    如果开启了AOF持久化功能，如果其他从服务器正在复制当前这个服务器，这个命令会被传播给其他从服务器
    /* Propagate the command into the AOF and replication link */
    if (flags & REDIS_CALL_PROPAGATE) {
        int flags = REDIS_PROPAGATE_NONE;

        if (c->flags & REDIS_FORCE_REPL) flags |= REDIS_PROPAGATE_REPL;
        if (c->flags & REDIS_FORCE_AOF) flags |= REDIS_PROPAGATE_AOF;
        if (dirty)
            flags |= (REDIS_PROPAGATE_REPL | REDIS_PROPAGATE_AOF);
        if (flags != REDIS_PROPAGATE_NONE)
            propagate(c->cmd,c->db->id,c->argv,c->argc,flags);
    }

    /* Restore the old FORCE_AOF/REPL flags, since call can be executed
     * recursively. */
    c->flags &= ~(REDIS_FORCE_AOF|REDIS_FORCE_REPL);
    c->flags |= client_old_flags & (REDIS_FORCE_AOF|REDIS_FORCE_REPL);

    /* Handle the alsoPropagate() API to handle commands that want to propagate
     * multiple separated commands. */
    if (server.also_propagate.numops) {
        int j;
        redisOp *rop;

        for (j = 0; j < server.also_propagate.numops; j++) {
            rop = &server.also_propagate.ops[j];
            propagate(rop->cmd, rop->dbid, rop->argv, rop->argc, rop->target);
        }
        redisOpArrayFree(&server.also_propagate);
    } 
    
serverCron函数，这个在之前的AOF和RDB操作以及事件中已经说过，它是一种时间事件；更新服务器时间缓存，redis中不少功能
需要获取系统的当前时间，

    struct redisServer {
    
        // 保存了秒级精确的系统当前UNIX时间戳
        time_t unixtime;
        
        // 保存了毫秒级精确的系统当前UNIX时间戳
        long long mstime;
    
    }
    
    /* Update the time cache. */
    updateCachedTime();
    
serverCron函数默认会以100毫秒一次的频率更新unixtime属性和mstime属性，所以他们的精确度不是很高。<br/>
LRU时钟，服务器状态中的lrulock属性保存了服务器的LRU时钟，这个属性和上面介绍的unixtime属性、mstime属性一样，都是服务器缓存中的一种：

    struct redisServer {
    
        // key的空转时间，默认10s更新一次时钟缓存
        unsigned lrulock:22;
    
    }
    
    每个redis对象都有一个lru属性，这个lru属性保存了对象最后一次被命令访问的时间
    struct redisObject {
    
        unsigned lru:22;
    
    }
    
当服务器要计算一个key的空转时间，程序会用服务器的lrulock属性记录的时间戳减去对象的lru属性记录的时间，得出的计算结果就是这个对象的空转时间<br/>
再就是更新服务器每秒执行命令次数，这是一种数据采样<br/>
管理客户端资源，serverCron函数每次会执行clientsCron函数，主要处理超时的客户端以及关闭超出输出缓冲区的客户端<br/>
管理数据库资源、持久化操作等等 
     