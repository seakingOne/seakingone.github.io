---
layout: post
title:  "FFmpeg base command"
date:   2021-03-12
desc: "FFmpeg shell"
keywords: "FFmpeg base command"
categories: [Article]
tags: [FFmpeg]
icon: icon-html
---

The command here is based on Windows(the personal computer), and Mac operations are similar.

ffmpeg基本操作命令

    -version 显示版本
    -demuxers 显示可用的demuxers（视音频分离器）
    -muxers 显示可用的muxers（多路复用器，视音频复用器（Muxer）即是将视频压缩数据（例如H. 264）和音频压缩数据（例如AAC）合并到一个封装格式数据）
    -devices 显示可用的设备
    -codecs 显示所有的编解码器
    -deoders 显示所有的解码器
    -encoders 显示所有的编码器
    -bsfs 显示比特流filter（？）
    -formats 显示可用的格式（比如mp3，mp4）
    -protocols 显示可用的协议
    -filter 显示可用的过滤器
    -pix_fmts 显示可用的像素格式
    -sample_fmts 显示可用的采样格式
    -layouts 显示channel的名称（单声道，多声道）
    -colors 显示识别的颜色名称
    
ffmpeg常用参数

    -f fmt(输入输出，一般后面为设备名称)
    -i url(输入，输入文件的url地址)
    -y(全局参数，覆盖输出文件而不询问)
    -n(全局参数，不要覆盖输出文件，如果文件存在，立即退出)
    -c(编解码，ffmpeg -i INPUT -map 0 -c:v libx264 -c:a copy OUTPUT)
    -filter(过滤流)
    视频参数：
    -r[: stream_specifier] fps(设置帧率，hz值)  
    -s[: stream_specifier] (设置分辨率)  
    -aspect[: stream_specifier] (设置方面指定的视频显示宽高比。aspect 可以是浮点数字符
                                 串，也可以是 num：den 形式的字符串，其中 num 和 den
                                 是宽高比的分子和分母。例如“4：3”，“16：9”，“1.3333”和
                                 “1.7777”是有效的参数值。如果与-vcodec 副本一起使用，
                                 则会影响存储在容器级别的宽高比，但不会影响存储在编码
                                 帧中的宽高比)
    -vn(禁用视屏录制)
    -vcodec(编解码器)
    音频参数：
    -ar(设置音频采样频率。对于输出流，它默认设置为相应
        输入流的频率。对于输入流，此选项仅适用于音频捕
        获设备和原始分路器，并映射到相应的分路器选件。)
    -ac(设置音频的通道数)
    -an(禁止录音)
    -acodec(设置音频编解码器)
    -sample_fmt(设置音频采样格式。使用-sample_fmts 获取支持的样
                本格式列表。)
                    

举个例子：
Get devices

    ffmpeg -devices
    
    in windows:  D  dshow           DirectShow capture
    
                 D  gdigrab         GDI API Windows frame grabber
                 
                 D  lavfi           Libavfilter virtual input device
                 
                 E sdl,sdl2        SDL2 output device
                 
                 D  vfwcap          VfW video capture
                 
    in macOS:    E audiotoolbox    AudioToolbox output device
                 D  avfoundation    AVFoundation input device
                 D  lavfi           Libavfilter virtual input device        

Capture desktop screen (silent):
    
    windows: ffmpeg -f gdigrab -i desktop -r 30 fileName.mp4/.yuv/or other 
    
    -f: the input source
    -i desktop: Screen capture video
   
    macOS: ffmpeg -f avfoundation -i 1 -r 30 fileName.mp4/.yuv/or other

To capture audio:
    
    windows: ffmpeg -list_devices true -f dshow -i dummy (List the device name)
    
             [dshow @ 0000025c3d3ddc00] DirectShow video devices (some may be both video and audio devices)
             
             [dshow @ 0000025c3d3ddc00]  "Integrated Webcam"
                
             [dshow @ 0000025c3d3ddc00]     Alternative name "@device_pnp_\\?\usb#vid_0c45&pid_6723&mi_00#6&12e96a9&0&0000#{65e8773d-8f56-11d0-a3b9-00a0c9223196}\global"
                
             [dshow @ 0000025c3d3ddc00] DirectShow audio devices
                
             [dshow @ 0000025c3d3ddc00]  "Microphone (Realtek(R) Audio)"
                
             [dshow @ 0000025c3d3ddc00]     Alternative name "@device_cm_{33D9A762-90C8-11D0-BD43-00A0C911CE86}\wave_{944A0A5A-4ED9-4B5F-89AF-4CB5262162A9}" 

             start record:  ffmpeg.exe -f dshow -i audio="Microphone (Realtek(R) Audio)" 1.mp3
             
    macOS:   ffmpeg -f avfoundation -list_devices true -i ""
    
             [AVFoundation indev @ 0x7f8766400e80] AVFoundation video devices:
             [AVFoundation indev @ 0x7f8766400e80] [0] FaceTime HD Camera
             [AVFoundation indev @ 0x7f8766400e80] [1] Capture screen 0
             [AVFoundation indev @ 0x7f8766400e80] AVFoundation audio devices:
             [AVFoundation indev @ 0x7f8766400e80] [0] Built-in Microphone       

of course, we can record audio and screen both

    windows: ffmpeg.exe -f gdigrab -i desktop -f dshow -i audio="Microphone (Realtek(R) Audio)" -r 30 -s 1280*740 1.mp4
    
    macOS: ffmpeg -f avfoundation -video_size 1280x720 -framerate 30 -i 1:0 -r 30 1.mp4
    
from videos extract video and audio:

    ffmpeg -i 1.mp4 -vcodec copy -an 1-1.mp4
    
    ffmpeg -i 1.mp4 -acodec copy -vn 1-1.mp3
  
Multimedia format conversion:
    
    ffmpeg -i 1.mp4 -vcodec copy -acodec copy 1.flv
    
Extract the original data format:

    ffmpeg.exe -i out.mp4 -vn -ar 44100 -ac 2 -f s16le out.pcm
    -ar: audiu rate音频采样率
    -ac: audiu channel 音频声道数为2
    -f：音频的数据存储格式s16le: s:有符号16位lettle end
    
    ffmpeg.exe -i 1.mp4 -an -c:v rawvideo -pix_fmt yuv420p out.yuv   
    -an： 不提取音频
    -c:v： 对视频进行编码，使用rawvideo（原始视频）格式进行编码
    -pix_fmt yuv420p： 输出的YUV像素格式 
 
其他：
   
    滤镜处理： 
        都是针对解码后（原始）的数据处理 
        像素裁剪：ffmpeg -i 1.mp4 -vf crop=in_w-200:in_h-200 -c:libx264 -c:a copy out.mp4
    
    
    音视频裁剪(裁剪10s)：ffmpeg -i 1.mp4 -ss 00:00:00 -t 10 out.ts
    多个视频合并(input.txt中文件格式为file '1.ts')：ffmpeg -f concat -i input.txt out.mp4
    图片视频互转：ffmpeg -i 1.mp4 -r 1 -f image2 image-%3d.jpeg 
               ffmpeg -i image-%3d.jpeg out.mp4


[here you can see word doc(中文版)](https://seakingone.github.io/static/assets/img/blog/ffmpeg/ffmpeg命令大全.pdf)

[here you can see FFmpeg in C use of video/audio](https://juejin.cn/post/6844903732891615246)