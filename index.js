/**
 * Railway-safe YouTube 24/7 Livestream
 * - Hard memory caps for FFmpeg
 * - Single thread (prevents RAM blowups)
 * - Auto-restart watchdog
 */

require('dotenv').config();
const { spawn } = require('child_process');

const STREAM_KEY = process.env.YT_STREAM_KEY;
if (!STREAM_KEY) {
  console.error('❌ Missing YT_STREAM_KEY');
  process.exit(1);
}

const RTMP_URL = `rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}`;
const INPUT_FILE = 'input.mp4';
const RESTART_DELAY_MS = 5000;

let ffmpeg = null;

function startStream() {
  console.log('▶️ Starting FFmpeg stream');

const args = [
  '-re',
  '-stream_loop', '-1',
  '-i', 'input.mp4',

  // Hard memory caps (this is what matters)
  '-rtbufsize', '64M',
  '-max_muxing_queue_size', '256',
  '-threads', '1',

  // Video: lowest-memory H.264 that YouTube accepts
  '-c:v', 'libx264',
  '-profile:v', 'baseline',
  '-preset', 'ultrafast',
  '-tune', 'zerolatency',
  '-pix_fmt', 'yuv420p',
  '-g', '30',
  '-bf', '0',
  '-b:v', '1800k',
  '-maxrate', '1800k',
  '-bufsize', '3600k',

  // Audio
  '-c:a', 'aac',
  '-b:a', '128k',
  '-ar', '48000',
  '-ac', '2',


  '-f', 'flv',
  RTMP_URL
];

  ffmpeg = spawn('ffmpeg', args, {
    stdio: ['ignore', 'ignore', 'ignore'] // 🚫 no log buffering
  });

  ffmpeg.on('exit', (code, signal) => {
    console.error(`⚠️ FFmpeg exited (code=${code}, signal=${signal})`);
    ffmpeg = null;
    console.log(`🔁 Restarting in ${RESTART_DELAY_MS / 1000}s`);
    setTimeout(startStream, RESTART_DELAY_MS);
  });

  ffmpeg.on('error', err => {
    console.error('❌ FFmpeg failed to start', err);
  });
}

// Graceful shutdown (Railway redeploys)
function shutdown() {
  console.log('🛑 Shutting down');
  if (ffmpeg) ffmpeg.kill('SIGINT');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start streaming
startStream();
