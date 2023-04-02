---
layout: post
title:  "linux socket编程二之epoll"
date:   2023-03-29
desc: "Linux socket epoll"
keywords: "linux socket epoll"
categories: [Linux]
tags: [Linux]
icon: icon-html
---

## epoll

>epoll是对于传统socket编程的一种优化，由内核维护一套结构，存储所有的client fd, 如果有数据到达，用户态订阅事件，一旦有事件到达，内核监听后返回对应有事件的fd，用户态做相应的处理。
>对于epoll的内核结构，epoll_create会创建一个efd, 作为内核红黑树的根节点，然后上树lfd，cfd，当有事件触发的时候，返回有事件的fd（链表结构）

基本demo如下：
```sh
#include <sys/epoll.h>
Example for suggested usage
While the usage of epoll when employed as a level-triggered interface does have  the  same  semantics  as  poll(2),  the  edge-triggered  usage
requires  more  clarification  to  avoid stalls in the application event loop.  In this example, listener is a nonblocking socket on which lis‐
ten(2) has been called.  The function do_use_fd() uses the new ready file descriptor until EAGAIN is returned by either  read(2)  or  write(2).
An  event-driven  state  machine  application  should,  after  having  received  EAGAIN,  record  its current state so that at the next call to
do_use_fd() it will continue to read(2) or write(2) from where it stopped before.

#define MAX_EVENTS 10
struct epoll_event ev, events[MAX_EVENTS];
int listen_sock, conn_sock, nfds, epollfd;

/* Code to set up listening socket, 'listen_sock',
    (socket(), bind(), listen()) omitted */

epollfd = epoll_create1(0);
if (epollfd == -1) {
    perror("epoll_create1");
    exit(EXIT_FAILURE);
}

ev.events = EPOLLIN;
ev.data.fd = listen_sock;
if (epoll_ctl(epollfd, EPOLL_CTL_ADD, listen_sock, &ev) == -1) {
    perror("epoll_ctl: listen_sock");
    exit(EXIT_FAILURE);
}
for (;;) {
    nfds = epoll_wait(epollfd, events, MAX_EVENTS, -1);
    if (nfds == -1) {
        perror("epoll_wait");
        exit(EXIT_FAILURE);
    }

    for (n = 0; n < nfds; ++n) {
        if (events[n].data.fd == listen_sock) {
            conn_sock = accept(listen_sock,
                                (struct sockaddr *) &addr, &addrlen);
            if (conn_sock == -1) {
                perror("accept");
                exit(EXIT_FAILURE);
            }
            setnonblocking(conn_sock);
            ev.events = EPOLLIN | EPOLLET;
            ev.data.fd = conn_sock;
            if (epoll_ctl(epollfd, EPOLL_CTL_ADD, conn_sock,
                        &ev) == -1) {
                perror("epoll_ctl: conn_sock");
                exit(EXIT_FAILURE);
            }
        } else {
            do_use_fd(events[n].data.fd);
        }
    }
}

When used as an edge-triggered interface, for performance reasons, it is possible to  add  the  file  descriptor  inside  the  epoll  interface
(EPOLL_CTL_ADD)  once  by  specifying (EPOLLIN|EPOLLOUT).  This allows you to avoid continuously switching between EPOLLIN and EPOLLOUT calling
epoll_ctl(2) with EPOLL_CTL_MOD.

```

通过上面的demo我们可以分析一下基本的API:
```sh

#epoll_create()  creates  a  new  epoll(7)  instance.  Since Linux 2.6.8, the size argument is ignored, but must be greater 
# than  zero; see NOTES below.
# 创建文件文件句柄，类似socket的创建lfd
int epoll_create(int size); 

#创建lfd之后，目的是为了接受来自客户端的请求，所以上树，事件为read事件
int epoll_ctl(int epfd, int op, int fd, struct epoll_event *event);
epfd:上个api创建的fd
op:EPOLL_CTL_ADD表示当前添加新的节点
fd:第一次这个添加的为lfd，一般来说cfd设置为非阻塞，来更快的接受请求
event:
typedef union epoll_data {
    void        *ptr;  
    int          fd;  /* 当前的fd，lfd或者cfd */
    uint32_t     u32;
    uint64_t     u64;
} epoll_data_t;

struct epoll_event {
    uint32_t     events;      /* Epoll events */
    epoll_data_t data;        /* User data variable */
};


#等待有处理的事件返回
int epoll_wait(int epfd, struct epoll_event *events,
                      int maxevents, int timeout);
events为传出参数，通过他来判断是读还是写事件

```

附上完整的epoll_server代码：
```sh

#include <stdio.h>
#include <sys/types.h>          /* See NOTES */
#include <sys/socket.h>
#include <arpa/inet.h>
#include <sys/epoll.h>
#include <unistd.h>
#include <fcntl.h>

int main() {

        #创建监听句柄
        int lfd = socket(AF_INET, SOCK_STREAM, 0);

        #绑定端口
        struct sockaddr_in server;
        server.sin_family = AF_INET;
        server.sin_port = htons(8888);
        char host[16];
        inet_pton(AF_INET, "127.0.0.1", &server.sin_addr.s_addr);

        bind(lfd, (struct sockadd_in*) &server, sizeof(server));

        #监听
        listen(lfd, 128);

        #create epoll fd
        int epoll_fd =  epoll_create(128);

        #lfd上树
        struct epoll_event event;
        event.data.fd = lfd;
        event.events = EPOLLIN | EPOLLET; #读事件与水平触发
        epoll_ctl(epoll_fd, EPOLL_CTL_ADD, lfd, &event);

        #等待epoll的event返回
        struct epoll_event events[128];
        while(1) {

                #返回有事件的数量
                int count = epoll_wait(epoll_fd, &events, 128, -1);

                if (count < 0) {
                        perror("");
                }

                for(int i = 0; i < count; i++) {
                        if(events[i].data.fd == lfd) {

                                if(events[i].events & EPOLLIN) {
                                        #接收到新的client
                                        struct sockaddr_in client;
                                        socklen_t size = sizeof(client);
                                        int cfd = accept(lfd, &client, &size);
                                        if (cfd < 0) {
                                                perror("");
                                        }

                                        char ip[32];
                                        printf("new client, ip = %s, port = %d \n", inet_ntop(AF_INET, &client.sin_addr.s_addr, ip, sizeof(ip)), ntohs(client.sin_port));

                                        #将客户端设置非非阻塞
                                        int flag = fcntl(cfd, F_GETFL);
                                        fcntl(cfd, F_SETFL, flag|O_NONBLOCK);

                                        #cfd 上树
                                        printf("cfd开始上树\n");
                                        event.data.fd = cfd;
                                        event.events = EPOLLIN | EPOLLET;
                                        int ret = epoll_ctl(epoll_fd, EPOLL_CTL_ADD, cfd, &event);
                                        if (ret < 0) {
                                                perror("");
                                        }
                                }
                        } else {
                                if (events[i].events & EPOLLIN) {

                                        # 读取客户端的数据
                                        printf("cfd读事件 \n");
                                        int cfd = events[i].data.fd;
                                        char buf[128];
                                        int read_data = read(cfd, buf, sizeof(buf));
                                        if(read_data == 0) {
                                                printf("client断开链接\n");
                                                #下树
                                                epoll_ctl(epoll_fd, EPOLL_CTL_DEL, cfd, &event);
                                        } else if (read_data < 0) {
                                                perror("");
                                                epoll_ctl(epoll_fd, EPOLL_CTL_DEL, cfd, &event);
                                        } else  {
                                                printf("read data = %s \n", buf);
                                                write(cfd, buf, read_data);
                                        }

                                }
                        }
                }

        }

}


```

## epoll反应堆

>epoll反应堆模型其实就是Libevent库核心思想
>基本设计思想：将文件描述符、事件、回调函数使用自定义结构体封装在一起，当某个文件描述符的事件被触发，会自动调用回调函数既可以实现对应的IO操作。最终目的实现不同的文件描述对应不同的事件处理函数

```sh

#include <stdio.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/epoll.h>

struct my_epoll_event {

        int epoll_fd;
        int current_fd;
        void (*call_back)(struct my_epoll_event *arg);
        int events;

}

int read_data(struct my_epoll_event* mev);
int write_data(struct my_epoll_event* mev);

int write_data(struct my_epoll_event* mev) {

        int cfd = mev->current_fd;
        write(cfd, "OK", 2);

        mev -> call_back = read_data;
        event.data.ptr = mev;
        event.events = EPOLLIN;
        epoll_ctl(epoll_fd, EPOLL_CTL_MOD, &event);

}

int read_data(struct my_epoll_event* mev) {

        int epoll_fd = mev->epoll_fd;
        int cfd = mev->current_fd;
        struct epoll_event event;
        event.events = EPOLLIN;

        char buf[128];
        int data = read(cfd, &buf, sizeof(buf));
        if(data == 0 || data < 0) {

                # client exit
                printf("client exit... \n");
                if(mev != null) {
                        free(mev);
                }
                epoll_ctl(epoll_fd, EPOLL_CTL_DEL, cfd, &event);
        } else {
                printf("read client data = %s \n", buf);
                # add write
                mev -> call_back = write_data;
                event.data.ptr = mev;
                event.events = EPOLLOUT;
                epoll_ctl(epoll_fd, EPOLL_CTL_MOD, &event);
        }

}

int accpet(struct my_epoll_event* mev) {

        struct epoll_event event;
        struct sockaddr_in client;
        scokelen_t size = sizeof(client);
        int lfd = mev->current_fd;
        int epoll_fd = mev->epoll_fd;
        int cfd = accept(lfd, (struct aockadd_in *)&client, &size);

        // add cfd to epoll tree
        mev -> current_fd = cfd;
        mev -> call_back = read_data;
        event.data.ptr = mev;
        event.events = EPOLLIN;
        epoll_ctl(epoll_fd, EPOLL_CTL_ADD, cfd, &event);

}

int main() {

        # create listen
        int lfd = socket(AF_INET, SOCK_STREAM, 0);

        int optval = 1;
        int ret = setsockopt(lfd, SOL_SOCKET, SO_REUSEADDR, &optval, sizeof(optval));

        struct sockaddr_in server;
        server.sin_family = AF_INET;
        server.sin_port = htons(8888);
        inet_pton(AF_INET, "127.0.0.1", &server.sin_addr.s_addr);
        bind(lfd, (struct sockadd_in *)&server, sizeof(server));

        listen(lfd, 128);

        # create epoll
        int epoll_fd = epoll_create(1);
        struct epoll_event event;
        event.events = EPOLLIN;
        struct my_epoll_event* mev = (struct my_epoll_event)malloc(sizeof(struct my_epoll_event));
        mev->epoll_fd = epoll_fd;
        mev->current_fd = lfd;
        mev->call_back = accpet;
        event.data.ptr = mev;

        struct epoll_event events[128];
        while(1) {
                int count = epoll_wait(epoll_fd, &events, 128, -1);
                for(int i = 0; i < count; i++) {
                        ((struct my_epoll_event)(events[i].data.ptr)) -> callback((struct my_epoll_event)(events[i].data.ptr));
                }
        }

}

```