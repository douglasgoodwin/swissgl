// Canvas video recorder using WebCodecs API + mp4-muxer
// Records H.264 MP4 video with hardware acceleration

class CanvasRecorder {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.recording = false;
        this.muxer = null;
        this.videoEncoder = null;
        this.frameInterval = null;
        this.startTime = 0;
        this.frameCount = 0;
        this.fps = options.fps || 60;
        this.bitrate = options.bitrate || 8_000_000;
        this.onStateChange = options.onStateChange || (() => {});
        this.supported = typeof VideoEncoder !== 'undefined';
    }

    async start() {
        if (this.recording || !this.supported) return;

        const width = this.canvas.width;
        const height = this.canvas.height;
        const encodedWidth = width % 2 === 0 ? width : width - 1;
        const encodedHeight = height % 2 === 0 ? height : height - 1;

        this.target = new Mp4Muxer.ArrayBufferTarget();
        this.muxer = new Mp4Muxer.Muxer({
            target: this.target,
            video: {
                codec: 'avc',
                width: encodedWidth,
                height: encodedHeight,
            },
            fastStart: 'in-memory',
        });

        this.finalized = false;
        this.videoEncoder = new VideoEncoder({
            output: (chunk, meta) => {
                if (!this.finalized) {
                    this.muxer.addVideoChunk(chunk, meta);
                }
            },
            error: (e) => {
                console.error('VideoEncoder error:', e);
                this.stop();
            },
        });

        const config = {
            codec: 'avc1.640033',
            width: encodedWidth,
            height: encodedHeight,
            bitrate: this.bitrate,
            framerate: this.fps,
            hardwareAcceleration: 'prefer-hardware',
        };

        try {
            const support = await VideoEncoder.isConfigSupported(config);
            if (!support.supported) {
                config.hardwareAcceleration = 'prefer-software';
            }
            this.videoEncoder.configure(config);
        } catch (e) {
            console.error('Failed to configure encoder:', e);
            return;
        }

        this.recording = true;
        this.startTime = performance.now();
        this.frameCount = 0;
        this.encodedWidth = encodedWidth;
        this.encodedHeight = encodedHeight;
        this.onStateChange(true);

        const frameTime = 1000 / this.fps;
        this.frameInterval = setInterval(() => this.captureFrame(), frameTime);
    }

    captureFrame() {
        if (!this.recording || !this.videoEncoder) return;
        try {
            createImageBitmap(this.canvas, {
                resizeWidth: this.encodedWidth,
                resizeHeight: this.encodedHeight,
            }).then((bitmap) => {
                const timestamp = (this.frameCount * 1_000_000) / this.fps;
                const frame = new VideoFrame(bitmap, {
                    timestamp,
                    duration: 1_000_000 / this.fps,
                });
                const keyFrame = this.frameCount % (this.fps * 2) === 0;
                this.videoEncoder.encode(frame, { keyFrame });
                frame.close();
                bitmap.close();
                this.frameCount++;
            }).catch((e) => {
                console.error('Frame capture error:', e);
            });
        } catch (e) {
            console.error('Frame capture error:', e);
        }
    }

    async stop() {
        if (!this.recording) return;
        this.recording = false;
        this.onStateChange(false);

        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }
        if (this.videoEncoder) {
            try {
                if (this.videoEncoder.state !== 'closed') {
                    await this.videoEncoder.flush();
                    this.videoEncoder.close();
                }
            } catch (e) {
                console.error('Encoder flush error:', e);
            }
        }
        if (this.muxer) {
            this.finalized = true;
            this.muxer.finalize();
            this.saveRecording();
        }
    }

    toggle() {
        if (this.recording) {
            this.stop();
        } else {
            this.start();
        }
    }

    saveRecording() {
        const buffer = this.target.buffer;
        const blob = new Blob([buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        a.download = `swissgl-${timestamp}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
