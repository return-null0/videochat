// ====================== CONFIGURATION ======================
const SIGNALING_SERVER_URL = 'https://signalingserver-wz1q.onrender.com/'; 
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};
// ===========================================================

const socket = io(SIGNALING_SERVER_URL);

let localStream;
let peerConnection;
let isInitiator = false;

// Track current camera mode (user = front, environment = back)
let currentFacingMode = 'user'; 

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const roomIdInput = document.getElementById('roomId');

// 1. Join Room & Start Camera
async function joinRoom() {
    const roomId = roomIdInput.value;
    if (!roomId) return alert("Enter a room ID");

    await startCamera(); // Start video first
    
    socket.emit('join-room', roomId);
}

// Helper: Start or Restart Camera
async function startCamera() {
    // Stop previous tracks if they exist (crucial for mobile)
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        audio: true,
        video: { 
            facingMode: currentFacingMode, // This leverages the hardware switch
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    };

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = localStream;
        
        // If we are already in a call, we need to update the stream being sent
        if (peerConnection) {
            const videoTrack = localStream.getVideoTracks()[0];
            const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(videoTrack); // Hot-swap the video track
            }
        }
    } catch (err) {
        console.error("Camera Error:", err);
        alert("Could not access camera. Ensure you are on HTTPS.");
    }
}

// 2. Hardware: Flip Camera Logic
async function flipCamera() {
    // Toggle mode
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    await startCamera();
}

// ================= SOCKET EVENTS =================

socket.on('room-created', () => {
    console.log('Room created. You are the host.');
    isInitiator = true;
});

socket.on('room-joined', () => {
    console.log('Peer joined. Starting call...');
    if (isInitiator) initiateCall();
});

socket.on('offer', async (sdp) => {
    if (!peerConnection) createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { roomId: roomIdInput.value, sdp: answer });
});

socket.on('answer', async (sdp) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on('ice-candidate', async (candidate) => {
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) { console.error('Error adding ICE:', e); }
    }
});

// ================= WEBRTC CORE =================

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to connection
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { roomId: roomIdInput.value, candidate: event.candidate });
        }
    };

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };
}

async function initiateCall() {
    createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { roomId: roomIdInput.value, sdp: offer });
}