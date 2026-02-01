const SIGNALING_SERVER_URL = 'https://signalingserver-wz1q.onrender.com'; 

const ICE_SERVERS = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const socket = io(SIGNALING_SERVER_URL);

let localStream;
let peerConnection;
let isInitiator = false;
let currentFacingMode = 'user';
let isAudioEnabled = true;
let isVideoEnabled = true;
let controlsTimeout; 

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

function showControls() {
    controlsBar.classList.remove('fade-out');
    resetControlsTimeout();
}

function resetControlsTimeout() {
    clearTimeout(controlsTimeout);

    if (!callControls.classList.contains('hidden')) {
        controlsTimeout = setTimeout(() => {
            controlsBar.classList.add('fade-out');
        }, 3000); 

    }
}

appContainer.addEventListener('mousemove', showControls);
appContainer.addEventListener('touchstart', showControls);
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

function toggleMic() {
    if (localStream) {
        isAudioEnabled = !isAudioEnabled;
        localStream.getAudioTracks()[0].enabled = isAudioEnabled;
        document.getElementById('btnMic').classList.toggle('btn-off', !isAudioEnabled);
    }
}

function toggleVideo() {
    if (localStream) {
        isVideoEnabled = !isVideoEnabled;
        localStream.getVideoTracks()[0].enabled = isVideoEnabled;
        document.getElementById('btnCam').classList.toggle('btn-off', !isVideoEnabled);
    }
}

async function flipCamera() {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    await startCamera();
}

async function joinRoom() {
    const roomId = roomIdInput.value.trim().toLowerCase();
    if (!roomId) return alert("Enter Room ID");

    btnJoin.disabled = true;
    btnJoin.innerText = "Connecting...";

    try {
        await startCamera();
        socket.emit('join-room', roomId);

        joinControls.classList.add('hidden');
        callControls.classList.remove('hidden');
        statusText.innerHTML = '<div class="loader"></div><p>Waiting for peer...</p>';
        resetControlsTimeout(); 

    } catch (err) {
        console.error(err);
        alert("Camera Error");
        btnJoin.disabled = false;
        btnJoin.innerText = "Join";
    }
}

async function endCall() {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    window.location.reload(); 
}

function toggleChat() {
    chatOverlay.classList.toggle('hidden');
    if (!chatOverlay.classList.contains('hidden')) chatInput.focus();
}

function sendMessage() {
    const text = chatInput.value.trim();
    if (text) {
        appendMessage(text, 'local');
        socket.emit('chat-message', { roomId: roomIdInput.value.trim().toLowerCase(), text: text });
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

    const constraints = {
        audio: true,
        video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = localStream;

    localStream.getAudioTracks()[0].enabled = isAudioEnabled;
    localStream.getVideoTracks()[0].enabled = isVideoEnabled;

    if (peerConnection) {
        const videoTrack = localStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);

        const audioTrack = localStream.getAudioTracks()[0];
        const audioSender = peerConnection.getSenders().find(s => s.track.kind === 'audio');
        if (audioSender) audioSender.replaceTrack(audioTrack);
    }
}

socket.on('room-created', () => { isInitiator = true; });
socket.on('room-joined', () => { 
    statusText.style.display = 'none'; 
    if (isInitiator) initiateCall(); 
});
socket.on('full-room', () => { alert("Room Full"); location.reload(); });
socket.on('chat-message', (text) => {
    appendMessage(text, 'remote');
    chatOverlay.classList.remove('hidden');
    showControls(); 

});

socket.on('offer', async (sdp) => {
    if (!peerConnection) createPeerConnection();
    statusText.style.display = 'none';
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { roomId: roomIdInput.value.trim().toLowerCase(), sdp: answer });
});

socket.on('answer', async (sdp) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on('ice-candidate', async (candidate) => {
    if (peerConnection) {
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { console.error(e); }
    }
});

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) socket.emit('ice-candidate', { roomId: roomIdInput.value.trim().toLowerCase(), candidate: event.candidate });
    };

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState === 'disconnected') endCall();
    };
}

function initiateCall() {
    createPeerConnection();
    peerConnection.createOffer().then(offer => {
        peerConnection.setLocalDescription(offer);
        socket.emit('offer', { roomId: roomIdInput.value.trim().toLowerCase(), sdp: offer });
    });
}