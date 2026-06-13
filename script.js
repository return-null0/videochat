const SIGNALING_SERVER_URL = 'https://signalingserver-wz1q.onrender.com'; 
const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const socket = io(SIGNALING_SERVER_URL);

let localStream;
let screenStream;
let peerConnection;
let isInitiator = false;
let currentFacingMode = 'user';
let isAudioEnabled = true;
let isVideoEnabled = true;
let controlsTimeout; 
let activeRoomId = '';

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const statusText = document.getElementById('statusText');
const roomIdInput = document.getElementById('roomId');
const btnJoin = document.getElementById('btnJoin');
const joinControls = document.getElementById('joinControls');
const callControls = document.getElementById('callControls');
const chatOverlay = document.getElementById('chatOverlay');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const controlsBar = document.getElementById('controlsBar');
const appContainer = document.getElementById('appContainer');
const localVideoContainer = document.getElementById('localVideoContainer');
const floatingPiP = document.getElementById('floatingPiP');

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'on') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime); 
        oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
    } else if (type === 'off') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime); 
        oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
    } else if (type === 'end') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.3);
    }

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + (type === 'end' ? 0.3 : 0.1));

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + (type === 'end' ? 0.3 : 0.1));
}

function showNotification(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.8); color: white; padding: 10px 20px;
        border-radius: 20px; font-size: 14px; z-index: 200; pointer-events: none;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3); backdrop-filter: blur(4px);
        opacity: 0; transition: opacity 0.3s;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.style.opacity = '1');

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function showControls() {
    controlsBar.classList.remove('fade-out');
    if (floatingPiP && !floatingPiP.classList.contains('hidden')) {
        floatingPiP.classList.remove('fade-out');
    }
    resetControlsTimeout();
}

function resetControlsTimeout() {
    clearTimeout(controlsTimeout);
    if (!callControls.classList.contains('hidden')) {
        controlsTimeout = setTimeout(() => {
            controlsBar.classList.add('fade-out');
            if (floatingPiP) floatingPiP.classList.add('fade-out');
        }, 3000); 
    }
}

appContainer.addEventListener('mousemove', showControls);
appContainer.addEventListener('touchstart', showControls, { passive: true });
appContainer.addEventListener('click', showControls);

makeDraggable(localVideoContainer);

function makeDraggable(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    elmnt.onmousedown = dragMouseDown;
    elmnt.ontouchstart = dragMouseDown;

    function dragMouseDown(e) {
        clearTimeout(controlsTimeout);
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        pos3 = clientX;
        pos4 = clientY;
        document.onmouseup = closeDragElement;
        document.ontouchend = closeDragElement;
        document.onmousemove = elementDrag;
        document.ontouchmove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        pos1 = pos3 - clientX;
        pos2 = pos4 - clientY;
        pos3 = clientX;
        pos4 = clientY;
        let newTop = elmnt.offsetTop - pos2;
        let newLeft = elmnt.offsetLeft - pos1;
        const maxTop = window.innerHeight - elmnt.offsetHeight;
        const maxLeft = window.innerWidth - elmnt.offsetWidth;
        newTop = Math.max(0, Math.min(newTop, maxTop));
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        elmnt.style.top = newTop + "px";
        elmnt.style.left = newLeft + "px";
        elmnt.style.right = 'auto'; 
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
        resetControlsTimeout(); 
    }
}

window.addEventListener('resize', () => {
    const maxTop = window.innerHeight - localVideoContainer.offsetHeight;
    const maxLeft = window.innerWidth - localVideoContainer.offsetWidth;
    if (localVideoContainer.offsetTop > maxTop) localVideoContainer.style.top = `${Math.max(0, maxTop)}px`;
    if (localVideoContainer.offsetLeft > maxLeft) localVideoContainer.style.left = `${Math.max(0, maxLeft)}px`;
});

window.addEventListener('beforeunload', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
    }
});

function toggleMic() {
    if (localStream) {
        isAudioEnabled = !isAudioEnabled;
        localStream.getAudioTracks()[0].enabled = isAudioEnabled;
        document.getElementById('btnMic').classList.toggle('btn-off', !isAudioEnabled);
        playBeep(isAudioEnabled ? 'on' : 'off');
        showNotification(isAudioEnabled ? 'Microphone On' : 'Microphone Muted');
        socket.emit('media-toggle', { roomId: activeRoomId, type: 'audio', enabled: isAudioEnabled });
    }
}

function toggleVideo() {
    if (localStream) {
        isVideoEnabled = !isVideoEnabled;
        localStream.getVideoTracks()[0].enabled = isVideoEnabled;
        document.getElementById('btnCam').classList.toggle('btn-off', !isVideoEnabled);
        playBeep(isVideoEnabled ? 'on' : 'off');
        showNotification(isVideoEnabled ? 'Camera On' : 'Camera Off');
        socket.emit('media-toggle', { roomId: activeRoomId, type: 'video', enabled: isVideoEnabled });
    }
}

async function flipCamera() {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    await startCamera();
}

async function toggleScreenShare() {
    const btnScreen = document.getElementById('btnScreen');
    if (!screenStream) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            
            if (peerConnection) {
                const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) await sender.replaceTrack(screenTrack);
            }
            
            localVideo.srcObject = screenStream;
            btnScreen.classList.add('btn-active');
            playBeep('on');
            showNotification('Screen Sharing Started');
            
            screenTrack.onended = () => { stopScreenShare(); };
        } catch (err) {
            console.error("Failed to share screen:", err);
            showNotification('Screen Share Cancelled');
        }
    } else {
        stopScreenShare();
    }
}

async function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }
    const btnScreen = document.getElementById('btnScreen');
    btnScreen.classList.remove('btn-active');
    playBeep('off');
    
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        localVideo.srcObject = localStream;
        if (peerConnection) {
            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) await sender.replaceTrack(videoTrack);
        }
    }
    showNotification('Screen Sharing Stopped');
}

async function togglePiP() {
    if (!document.pictureInPictureEnabled) {
        return showNotification('Picture-in-Picture Not Supported');
    }
    
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
            showNotification('Exited Picture-in-Picture');
        } else {
            if (!remoteVideo.srcObject || !remoteVideo.srcObject.active) {
                return showNotification('Requires active peer in room');
            }
            
            await remoteVideo.requestPictureInPicture();
            showNotification('Entered Picture-in-Picture');
        }
    } catch (err) {
        console.error("PiP Error:", err);
        showNotification('Video stream buffering, try again');
    }
}

async function joinRoom() {
    const inputId = roomIdInput.value.trim().toLowerCase();
    if (!inputId) return alert("Please enter a Room ID");

    activeRoomId = inputId;
    btnJoin.disabled = true;
    btnJoin.innerText = "Connecting...";

    try {
        await startCamera();
        socket.emit('join-room', activeRoomId);
        joinControls.classList.add('hidden');
        callControls.classList.remove('hidden');
        joinControls.classList.add('hidden');
        callControls.classList.remove('hidden');
        floatingPiP.classList.remove('hidden');
        statusText.innerHTML = '<div class="loader"></div><p>Waiting for peer...</p>';
        resetControlsTimeout(); 
    } catch (err) {
        console.error("Failed to access media appliances:", err);
        alert("Device selection configuration error. Check permissions.");
        btnJoin.disabled = false;
        btnJoin.innerText = "Join";
    }
}

function endCall() {
    playBeep('end');
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    setTimeout(() => window.location.reload(), 500); 
}

function toggleChat() {
    chatOverlay.classList.toggle('hidden');
    if (!chatOverlay.classList.contains('hidden')) chatInput.focus();
}

function sendMessage() {
    const text = chatInput.value.trim();
    if (text && activeRoomId) {
        appendMessage(text, 'local');
        socket.emit('chat-message', { roomId: activeRoomId, text: text });
        chatInput.value = '';
    }
}

function handleEnter(e) { if (e.key === 'Enter') sendMessage(); }

function appendMessage(text, type) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function startCamera() {
    if (localStream) localStream.getTracks().forEach(t => t.stop());

    const isMobile = window.innerWidth <= 768;

const constraints = {
    audio: true,
    video: { 
        facingMode: currentFacingMode,
        ...(isMobile ? {} : { width: { ideal: 1280 }, height: { ideal: 720 } })
    }
};

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = localStream;

localVideo.play().catch(error => {
    console.warn("Autoplay prevented by mobile browser:", error);
});
        
        localStream.getAudioTracks()[0].enabled = isAudioEnabled;
        localStream.getVideoTracks()[0].enabled = isVideoEnabled;

        if (peerConnection) {
            const videoTrack = localStream.getVideoTracks()[0];
            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(videoTrack);

            const audioTrack = localStream.getAudioTracks()[0];
            const audioSender = peerConnection.getSenders().find(s => s.track.kind === 'audio');
            if (audioSender) audioSender.replaceTrack(audioTrack);
        }
    } catch (err) {
        console.error("Hardware Access Error:", err);
        
        if (err.name === 'NotReadableError') {
            alert("Camera is gray because another app (or tab) is currently using it. Please close other camera apps and refresh.");
        } else if (err.name === 'NotAllowedError') {
            alert("Camera permission was denied by the browser settings.");
        } else if (err.name === 'OverconstrainedError') {
            alert("Your camera does not support the requested HD resolution.");
        } else {
            alert("Hardware error: Could not start the camera.");
        }
    }
}

socket.on('room-created', () => { isInitiator = true; });
socket.on('room-joined', () => { 
    statusText.style.display = 'none'; 
    if (isInitiator) initiateCall(); 
});
socket.on('full-room', () => { alert("Room Full"); window.location.reload(); });

socket.on('chat-message', (text) => {
    appendMessage(text, 'remote');
    chatOverlay.classList.remove('hidden');
    showControls(); 
});

socket.on('media-toggle', ({ type, enabled }) => {
    const status = enabled ? 'enabled' : 'disabled';
    showNotification(`Peer ${status} ${type}`);
});

socket.on('offer', async (sdp) => {
    if (!peerConnection) createPeerConnection();
    statusText.style.display = 'none';
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { roomId: activeRoomId, sdp: answer });
    } catch (error) {
        console.error("Error handling offer:", error);
    }
});

socket.on('answer', async (sdp) => {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (error) {
        console.error("Error setting remote description from answer:", error);
    }
});

socket.on('ice-candidate', async (candidate) => {
    if (peerConnection) {
        try { 
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); 
        } catch (e) { 
            console.error("Error adding ICE candidate:", e); 
        }
    }
});

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { roomId: activeRoomId, candidate: event.candidate });
        }
    };

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState === 'disconnected' || peerConnection.iceConnectionState === 'failed') {
            playBeep('end');
            showNotification('Peer Disconnected');
            setTimeout(() => window.location.reload(), 2000); 
        }
    };
}

async function initiateCall() {
    createPeerConnection();
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', { roomId: activeRoomId, sdp: offer });
    } catch (error) {
        console.error("Error initiating call:", error);
    }
}