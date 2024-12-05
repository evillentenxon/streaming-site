import http from 'http';
import path from 'path';
import { spawn } from 'child_process';
import express from 'express';
import { Server as SocketIO } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server);

// FFmpeg command options
const ffmpegOptions = [
    '-f', 'webm',              // Specify WebM as the input format
    '-loglevel', 'verbose',    // Enable verbose logging for debugging
    '-i', '-',                 // Input from stdin
    '-c:v', 'libx264',         // Video codec
    '-preset', 'ultrafast',    // Low-latency preset
    '-tune', 'zerolatency',    // For streaming use cases
    '-r', '25',                // Frame rate
    '-g', '50',                // GOP size
    '-keyint_min', '25',       // Minimum GOP size
    '-crf', '25',              // Constant Rate Factor
    '-pix_fmt', 'yuv420p',     // Pixel format
    '-sc_threshold', '0',      // Scene change threshold
    '-profile:v', 'main',      // H.264 profile
    '-level', '3.1',           // H.264 level
    '-c:a', 'aac',             // Audio codec
    '-b:a', '128k',            // Audio bitrate
    '-ar', '32000',            // Audio sample rate
    '-f', 'flv',               // Output format
    '-loglevel', 'debug',      // Debug logging for FFmpeg
    `rtmp://a.rtmp.youtube.com/live2/ck30-4kzf-a3sv-62zb-29zk` // RTMP URL
];

// Spawn FFmpeg process
const ffmpegProcess = spawn('ffmpeg', ffmpegOptions);

// Handle FFmpeg stdout and stderr
ffmpegProcess.stdout.on('data', (data) => {
    console.log(`FFmpeg stdout: ${data}`);
});

ffmpegProcess.stderr.on('data', (data) => {
    console.error(`FFmpeg stderr: ${data}`);
});

// Log FFmpeg process exit
ffmpegProcess.on('close', (code) => {
    console.log(`FFmpeg process exited with code ${code}`);
});

// Handle FFmpeg errors
ffmpegProcess.on('error', (err) => {
    console.error('FFmpeg process error:', err);
});

// Serve static files
app.use(express.static(path.resolve('./public')));

// Socket.IO handling
let bufferQueue = [];

io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on('binarystream', (chunk) => {
        try {
            // Accumulate binary chunks
            bufferQueue.push(chunk);

            // Write to FFmpeg when buffer reaches threshold
            if (bufferQueue.length > 5) {
                const buffer = Buffer.concat(bufferQueue);
                bufferQueue = []; // Clear the buffer

                // Write to FFmpeg stdin
                if (!ffmpegProcess.stdin.destroyed) {
                    ffmpegProcess.stdin.write(buffer, (err) => {
                        if (err) {
                            console.error('Error writing to FFmpeg stdin:', err);
                        }
                    });
                } else {
                    console.warn('FFmpeg stdin already destroyed, skipping write');
                }
            }
        } catch (err) {
            console.error('Error processing binary stream:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
    });
});

// Handle server shutdown gracefully
const shutdown = () => {
    console.log('Shutting down server...');
    if (!ffmpegProcess.killed) {
        ffmpegProcess.stdin.end(); // Signal FFmpeg to stop
        ffmpegProcess.kill('SIGTERM'); // Kill FFmpeg process
    }
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
server.listen(3000, () => console.log('HTTP Server is running on PORT 3000'));
