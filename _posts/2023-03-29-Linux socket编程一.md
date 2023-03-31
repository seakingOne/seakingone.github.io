---
layout: post
title:  "Linux socket编程一"
date:   2023-03-29
desc: "Linux socket"
keywords: "linux socket 大小端"
categories: [Linux]
tags: [Linux]
icon: icon-html
---

1、了解通讯还需先了解内存, 内存中的多字节数据相对于内存地址有大端和小端之分，磁盘文件中的多字节数据相对于文件中的偏移地址也有大端小端之分。

网络数据流同样有大端小端之分，那么如何定义网络数据流的地址呢？发送主机通常将发送缓冲区中的数据按内存地址从低到高的顺序发出，
接收主机把从网络上接到的字节依次保存在接收缓冲区中，也是按内存地址从低到高的顺序保存，
因此，网络数据流的地址应这样规定：先发出的数据是低地址，后发出的数据是高地址。但是TCP/IP协议规定，网络数据流应采用大端字节序，
即低地址高字节;为使网络程序具有可移植性，使同样的C代码在大端和小端计算机上编译后都能正常运行，可以调用以下库函数做网络字节序和主机字节序的转换

```sh
    #include <arpa/inet.h>
    /*主机字节顺序 --> 网络字节顺序*/
    uint32_t htonl(uint32_t hostlong);/* 端口*/
    uint16_t htons(uint16_t hostshort);/* IP*/
    /*网络字节顺序 --> 主机字节顺序*/
    uint32_t ntohl(uint32_t netlong);/* 端口*/
    uint16_t ntohs(uint16_t netshort);/* IP*/
    #include <arpa/inet.h> /*IP地址转换函数*/
    /*指定IP 即 字符串(点分十进制:xxx.xxx.xx.xxx)*/
     /** 
       * 本地IP转网络字节序 字符串 --> int(大端方式存储)
       * @param af 地址族协议对应的有AF_INET, AF_INET6等
       * @param src 要转换的指定的IP
       * @param dest  转换出来的值,  其实是整型值
       * 
       * @return -1 失败, 0成功, 并对应有errno
       */
    int inet_pton(int af, const char *src, void *dst);
    /**
       *  网络字节序转本地IP int -> 字符串
       *  @param af    - 地址族协议对应的有AF_INET, AF_INET6等
       *  @param src  - 网路字节序格式的int类型的iP
       *  @param dst  - 存储字符串ip的数组的地址
       *  @param size - dst缓冲区大小
       *  
       *  @return 返回的即是 dst
      */
    const char *inet_ntop(int af, const void *src, char *dst, socklen_t size);
 ```   
 
还要了解sockaddr数据结构, const struct sockaddr *指针, 指向要绑定给sockfd的协议地址。这个地址结构根据地址创建socket时的地址协议族的不同使用不同结构体
原来的结构体即左边第一个, 这种使用不方便所以出现针对不同类型协议的结构体, 可以直接访问其对应的值, 主要是IP和port(端口)

```sh
    ipv4对应的是：
    struct sockaddr_in {
        sa_family_t    sin_family; /* address family: AF_INET */
        in_port_t      sin_port;   /* port in network byte order */
        struct in_addr sin_addr;   /* internet address */
    };
    /* Internet address. */
    struct in_addr {
        uint32_t       s_addr;     /* address in network byte order */
    };
    
    ipv6对应的是：
    struct sockaddr_in6 { 
        sa_family_t     sin6_family;   /* AF_INET6 */ 
        in_port_t       sin6_port;     /* port number */ 
        uint32_t        sin6_flowinfo; /* IPv6 flow information */ 
        struct in6_addr sin6_addr;     /* IPv6 address */ 
        uint32_t        sin6_scope_id; /* Scope ID (new in 2.4) */ 
    };
    
    struct in6_addr { 
        unsigned char   s6_addr[16];   /* IPv6 address */ 
    };
    
    #define UNIX_PATH_MAX    108
    struct sockaddr_un { 
        sa_family_t sun_family;               /* AF_UNIX */ 
        char        sun_path[UNIX_PATH_MAX];  /* pathname */ 
    };
    
网络套接字API函数:

    //创建套接字
     int socket(int domain, int type, int protocol);
     参数:
     domain:
     type: tcp - 流式协议  udp - 报式协议
     protocol - 协议类型, 会根据type默认为TCP或UDP
     返回值:文件描述符(套接字)
    //将本地的IP和端口与创建出的套接字绑定
     int bind(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
     参数:
     sockfd - 创建出的文件描述符 
     addr - - 端口和IP
     addrlen - addr结构体的长度
    //设置同时连接到服务器的客户端的个数
     int listen(int sockfd, int backlog);
     参数:
     socket函数创建出来的文件描述符
     backlog - -最大值 128
    //阻塞等待客户端连接请求, 并接受连接
     int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen);
     参数:
     sockfd:文件描述符, 使用socket创建出的文件描述符
     addr: 存储客户端的端口和IP, 传出参数
     addrlen: 传入传出参数
     返回值: 返回的是一个套接字, 对应客户端: 服务器端与客户端进程通信使用accept的返回值对应的套接字
    
    //客户端与服务器端建立连接的函数
     int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
     参数:
     sockfd: 套接字
     addr: 服务器端的IP和端口
     addrlen: 第二个参数的长度
     
     
server:
    
    // server 
    #include <stdio.h>
    #include <ctype.h>//小写转大写
    #include <unistd.h>
    #include <stdlib.h>
    #include <sys/types.h>
    #include <sys/stat.h>
    #include <string.h>
    #include <arpa/inet.h>
    #include <sys/socket.h>
    
    int main(int argc, const char* argv[]) {
        // 创建监听的套接字
        int lfd = socket(AF_INET, SOCK_STREAM, 0);
    
        // 绑定
        struct sockaddr_in serv_addr;
        memset(&serv_addr, 0, sizeof(serv_addr));
        serv_addr.sin_family = AF_INET;
        serv_addr.sin_port = htons(8080); //没有使用的端口
        serv_addr.sin_addr.s_addr = htonl(INADDR_ANY); //本地所有的IP
        // 另一种写法, 假如是127.0.0.1
        // inet_pton(AF_INET, "127.0.0.1", &serv_addr.sin_addr.s_addr);
        bind(lfd, (struct sockaddr*)&serv_addr, sizeof(serv_addr));
    
        // 监听
        listen(lfd, 64);
    
        // 阻塞等待连接请求，　并接受连接请求
        struct sockaddr_in clien_addr;
        socklen_t clien_len = sizeof(clien_addr);
        int cfd = accept(lfd, (struct sockaddr*)&clien_addr, &clien_len);
    
        char ipbuf[128];
        printf("client iP: %s, port: %d\n", inet_ntop(AF_INET, &clien_addr.sin_addr.s_addr, ipbuf, sizeof(ipbuf)),
               ntohs(clien_addr.sin_port));
    
        char buf[1024] = {0};
        while(1) {
            // read data, 阻塞读取
            int len = read(cfd, buf, sizeof(buf));
            printf("read buf = %s\n", buf);
            // 小写转大写
            for(int i=0; i<len; ++i) {
                buf[i] = toupper(buf[i]);
            }
            printf("after buf = %s", buf);
    
            // 大写串发给客户端
            write(cfd, buf, strlen(buf)+1);
        }
    
        close(cfd);
        close(lfd);
    
        return 0;
    
    }         

client:

    client 端相对简单, 另外可以使用nc命令连接->nc ip prot
    #include <stdio.h>
    #include <stdlib.h>
    #include <unistd.h>
    #include <arpa/inet.h>
    #include <sys/socket.h>
    #include <sys/types.h>
    #include <string.h>
    int main(int argc, const char *argv[]) {
        
        // create
        int fd = socket(AF_INET, SOCK_STREAM, 0);
        if (fd == -1) {
            perror("socket error");
            exit(-1);
        }
        
        //connect
        struct sockaddr_in c_addr;
        bzero(&c_addr, sizeof(c_addr));
        c_addr.sin_family = AF_INET;
        c_addr.sin_port = htons(8888);
        inet_pton(AF_INET, "127.0.0.1", &c_addr.sin_addr.s_addr);
        
        int ret = connect(fd, (struct sockaddr*)&c_addr, sizeof(c_addr));
        if (ret == -1) {
            perror("connect error");
            exit(-1);
        }
        
        while(1) {
            //
            char buf[1024] = {0};
            fgets(buf, sizeof(buf), stdin);
            write(fd, buf, strlen(buf));
            //接收, 阻塞等待
            int len = read(fd, buf, sizeof(buf));
            if (len == -1) {
                 perror("read error");
                 exit(-1);
            }
            printf("client recv %s\n", buf);
            
        }
        
        close(fd);
         return 0;
    }     
```

上面当然都是简单的一对一连接通信，如果需要多个客户端同时处理，需要怎么处理呢？<br/>
<img src="{{ site.img_path }}/linux/socket/more_client.jpg" width="65%"> <br/>
从上面可以看出，我们应该维护一个数组结构，用于存储所有接受的client，然后依次去处理，这是最快的处理方式，那么其实还有其他的处理方式，比如select、poll、epoll
