# Streamlined Videochat

A lightweight, peer-to-peer video chat application built with **WebRTC**, **Socket.io**, and **JavaScript**. This project demonstrates a "serverless" video architecture where the backend only handles the initial handshake, and the video stream flows directly between users.

-------
## Features

* **Real-time Video & Audio:** High-quality, low-latency peer-to-peer streaming via WebRTC.
* **Smart UI:** Controls fade out automatically after 3 seconds of inactivity to maximize screen real estate. Tap or move the mouse to wake them.
* **Draggable Self-View:** A Picture-in-Picture style local video that can be dragged to any corner of the screen.
* **Integrated Chat:** Real-time text messaging with visual indicators.
* **Mobile Ready:** Touch-optimized controls, including a "Flip Camera" button for switching between front and back cameras on mobile devices.

## Stack

* **Frontend:** HTML5, CSS3 (Glassmorphism UI), Vanilla JavaScript.
* **Protocol:** WebRTC (ICE, STUN).
* **Communication:** Socket.io Client.

## Prerequisites

---------

**1. Signaling Server**
This frontend requires a backend signaling server to handle the initial connection handshake (Room joining, Session Description Protocol exchange, Interactive Connectivity Establishment candidates).

> **Note:** The signaling server logic is hosted in a [separate repository](https://github.com/return-null0/signalingserver/)
Ensure you have that the server is before running this client.

**2. HTTPS (For Mobile)**
To test on mobile devices, this client must be served over **HTTPS** otherwise browser security policies will block camera and microphone access.

## Usage

--------

1.  Open the app in two different browser windows or devices.
2.  Enter the same **Room Name** (e.g., `room99`) in both instances.
3.  Click **Join**.
4.  **Controls:**
    * **Tap/Click Screen:** Hides/Shows the control bar.
    * **Drag Video:** Click and drag your local video preview to move it.
    * **Chat:** Click the bubble icon to open the text chat overlay.

## Troubleshooting

* **Camera/Mic Not Working:** Ensure you are using **HTTPS**. Check browser permissions.
* **Connection Fails:** Verify your `SIGNALING_SERVER_URL` in `script.js` is correct and the server is running.
* **"Room Full":** The default signaling logic usually limits rooms to 2 peers. Try a different Room ID.
