---
layout: post
title:  "FFmpeg base command"
date:   2021-03-12
desc: "FFmpeg shell"
keywords: "FFmpeg base command"
categories: [HTML]
tags: [FFmpeg]
icon: icon-html
---

The command here is based on Windows(the personal computer), and Mac operations are similar.

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
 


[here you can see word doc(中文版)](https://dhboke.top/static/assets/img/blog/ffmpeg/ffmpeg命令大全.pdf)

[here you can see FFmpeg in C use of video/audio](https://juejin.cn/post/6844903732891615246)