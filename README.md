# Streamlined Videochat

A lightweight, peer-to-peer video chat application built with **WebRTC**, **Socket.io**, and **JavaScript**. This project demonstrates a "serverless" video architecture where the backend only handles the initial handshake, and the video stream flows directly between users.

---
## Features

* **Real-time Video & Audio:** High-quality, low-latency peer-to-peer streaming via WebRTC.
* **Screen Sharing:** Seamlessly share your entire screen, application windows, or specific browser tabs natively through the WebRTC connection.
* **Native Picture-in-Picture:** Pop the remote video out of the browser window to continue watching the stream while navigating other applications on your OS.
* **Smart UI:** Controls fade out automatically after 3 seconds of inactivity to maximize screen real estate. Tap or move the mouse to wake them.
* **Draggable Self-View:** A customizable local video preview that can be dragged to any safe zone on the screen.
* **Integrated Chat:** Real-time text messaging with visual overlay indicators.
* **Mobile Ready:** Touch-optimized controls, including a "Flip Camera" button and dynamic resolution constraints to prevent mobile hardware orientation crashes.

## Stack

* **Frontend:** HTML5, CSS3 (Glassmorphism UI), Vanilla JavaScript.
* **Browser APIs:** WebRTC (ICE, STUN), MediaDevices API, Picture-in-Picture API.
* **Communication:** Socket.io Client.

## Prerequisites

---

**1. Signaling Server**
This frontend requires a backend signaling server to handle the initial connection handshake (Room joining, Session Description Protocol exchange, Interactive Connectivity Establishment candidates).

> **Note:** The signaling server logic is hosted in a [separate repository](https://github.com/return-null0/signalingserver/).
Ensure you have that server running before launching this client.

**2. HTTPS (For Mobile)**
To test on mobile devices, this client must be served over **HTTPS**; otherwise, modern browser security policies will completely block camera and microphone access.

## Usage

---

1. Open the app in two different browser windows or physical devices.
2. Enter the exact same **Room Name** (e.g., `room99`) in both instances.
3. Click **Join**.
4. **Controls:**
    * **Tap/Click Screen:** Hides/Shows the bottom control bar and floating buttons.
    * **Drag Video:** Click and drag your local video preview to reposition it.
    * **Screen Share:** Click the monitor icon to replace your webcam feed with a desktop display capture.
    * **PiP:** Click the floating "PiP" button in the top left to extract the remote video into a floating OS window.
    * **Chat:** Click the message bubble icon to open the text chat overlay.

## Troubleshooting

* **Gray Box / Camera Not Loading:** If your local video is a gray square, another application (Zoom, OBS, MS Teams, or another browser tab) is currently locking the hardware. Close the conflicting app and refresh.
* **Picture-in-Picture Not Supported:** Ensure you are using a Chromium-based browser or WebKit (Safari). Firefox handles PiP via native OS overlays rather than the standard web API. PiP also requires an active remote connection before it can be triggered.
* **Camera/Mic Blocked on Mobile:** Ensure you are using **HTTPS**. Local network IP addresses (e.g., `192.168.1.X`) are explicitly blocked from accessing hardware APIs on iOS Safari and Android Chrome. Use a tunneling service like ngrok for local mobile testing.
* **Connection Fails:** Verify your `SIGNALING_SERVER_URL` variable in `script.js` is accurately pointing to your running signaling server.
* **"Room Full":** The default signaling logic restricts rooms to a 2-peer capacity limit. Try entering a different Room ID.