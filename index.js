/**
 * YouTube 24/7 Livestream Bot (Railway Safe)
 * - Auto-restarts FFmpeg
 * - Stable RAM / CPU usage
 * - Reconnects using the same stream key
 */

require('dotenv').config();
const { spawn } = require('child_process');

const STREAM_KEY = process.env.YT_STREAM_KEY;
if (!STREAM_KEY) {
  console.error('❌ Missing YT_STREAM_KEY env var');
  process.exit(1);
}

const RTMP_URL = `rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}`;
const INPUT_FILE = 'input.mp4';
const RESTART_DELAY = 5000;

let ffmpeg = null;

function startStream() {
  console.log('▶️ Starting YouTube livestream...');

  ffmpeg = spawn('ffmpeg', [
    // Real-time pacing (VERY IMPORTANT)
    '-re',

    // Loop video forever
    '-stream_loop', '-1',
    '-i', INPUT_FILE,

    // Video encoding (safe + stable)
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'main',
    '-level', '4.1',
    '-g', '60',
    '-keyint_min', '60',
    '-sc_threshold', '0',
    '-b:v', '4500k',
    '-maxrate', '4500k',
    '-bufsize', '9000k',

    // Audio encoding
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',

    // Output to YouTube RTMP
    '-f', 'flv',
    RTMP_URL
  ], {
    stdio: ['ignore', 'ignore', 'pipe']
  });

  // Log only stderr (FFmpeg uses stderr for progress)
  ffmpeg.stderr.on('data', data => {
    console.log(`[ffmpeg] ${data.toString().trim()}`);
  });

  ffmpeg.on('exit', (code, signal) => {
    console.error(`⚠️ FFmpeg exited (code=${code}, signal=${signal})`);
    ffmpeg = null;
    console.log(`🔁 Restarting stream in ${RESTART_DELAY / 1000}s...`);
    setTimeout(startStream, RESTART_DELAY);
  });

  ffmpeg.on('error', err => {
    console.error('❌ Failed to start FFmpeg:', err);
  });
}

// Graceful shutdown (Railway redeploys / restarts)
function shutdown() {
  console.log('🛑 Shutting down stream...');
  if (ffmpeg) {
    ffmpeg.kill('SIGINT');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the loop
startStream();
