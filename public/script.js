const userVideo = document.getElementById('user-video')
const startButton = document.getElementById('start-btn')

const state = { media: null }
const socket=io()

startButton.addEventListener('click', () => {
    const mediaRecorder = new MediaRecorder(state.media, {
        mimeType: 'video/webm;codecs=vp8,opus',  // Force WebM
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: 2500000,
        framerate: 25
    })
    mediaRecorder.ondataavailable = ev => {
        console.log('Binary Stream Available', ev.data)
        socket.emit('binarystream',ev.data)
    }
    
    mediaRecorder.start(25)
    // console.log(mediaRecorder.mimeType);
})


window.addEventListener('load', async e => {
    const media = await navigator
        .mediaDevices
        .getUserMedia({ audio: true, video: true })
        state.media=media
    userVideo.srcObject = media
})