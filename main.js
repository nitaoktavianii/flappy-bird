class FlappyBirdGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Screen elements
        this.startScreen = document.getElementById('startScreen');
        this.gameOverScreen = document.getElementById('gameOverScreen');
        this.winScreen = document.getElementById('winScreen');

        // Button elements
        this.startButton = document.getElementById('startButton');
        this.restartButton = document.getElementById('restartButton');
        this.playAgainButton = document.getElementById('playAgainButton');
        this.audioToggle = document.getElementById('audioToggle');
        this.audioIcon = document.getElementById('audioIcon');

        // Audio system
        this.audioEnabled = this.loadAudioSetting();
        this.audioContext = null;
        this.sounds = {};
        this.backgroundMusic = null;
        this.musicGainNode = null;

        this.initAudio();

        // Score elements
        this.currentScoreElement = document.getElementById('currentScore');
        this.highScoreElement = document.getElementById('highScore');
        this.finalScoreElement = document.getElementById('finalScore');
        this.finalHighScoreElement = document.getElementById('finalHighScore');
        this.winHighScoreElement = document.getElementById('winHighScore');

        // Game state
        this.gameState = 'start';
        this.score = 0;
        this.lives = 3;
        this.maxScore = 10;
        this.highScore = this.loadHighScore();
        this.gameStarted = false;

        // Bird properties
        this.bird = {
            x: 150,
            y: 350,
            width: 35,
            height: 35,
            velocity: 0,
            gravity: 0.5,
            jumpPower: -10,
            rotation: 0,
            maxVelocity: 8
        };

        // Pipes
        this.pipes = [];
        this.pipeWidth = 70;
        this.pipeGap = 180;
        this.pipeSpeed = 3;
        this.pipeSpawnTimer = 0;
        this.pipeSpawnInterval = 120;

        // Ground
        this.groundHeight = 100;
        this.groundY = this.canvas.height - this.groundHeight;

        // Animation
        this.animationId = null;
        this.lastTime = 0;

        this.init();
    }

    initAudio() {
        console.log('Initializing audio system...');

        // Initialize Web Audio API
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('AudioContext created:', this.audioContext.state);
        } catch (e) {
            console.log('Web Audio API not supported:', e);
            this.audioEnabled = false;
            return;
        }

        // Create sound effects and background music
        this.createSounds();
        this.createBackgroundMusic();
        this.updateAudioIcon();
    }

    createBackgroundMusic() {
        if (!this.audioContext) return;

        // Create gain node for background music volume control
        this.musicGainNode = this.audioContext.createGain();
        this.musicGainNode.connect(this.audioContext.destination);
        this.musicGainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime); // Low volume for background

        console.log('Background music system created');
    }

    async startBackgroundMusic() {
        if (!this.audioEnabled || !this.audioContext || this.backgroundMusic) return;

        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            console.log('Starting background music...');

            // Create a simple melody loop
            this.playBackgroundMelody();

        } catch (e) {
            console.error('Error starting background music:', e);
        }
    }

    playBackgroundMelody() {
        if (!this.audioEnabled || !this.audioContext) return;

        // Simple melody notes (C major pentatonic scale)
        const melody = [
            { freq: 523, duration: 0.8 }, // C5
            { freq: 587, duration: 0.4 }, // D5
            { freq: 659, duration: 0.8 }, // E5
            { freq: 784, duration: 0.4 }, // G5
            { freq: 880, duration: 1.2 }, // A5
            { freq: 784, duration: 0.4 }, // G5
            { freq: 659, duration: 0.8 }, // E5
            { freq: 523, duration: 1.2 }  // C5
        ];

        let currentTime = this.audioContext.currentTime;

        melody.forEach((note, index) => {
            this.playBackgroundNote(note.freq, note.duration, currentTime);
            currentTime += note.duration + 0.1; // Small gap between notes
        });

        // Schedule next loop
        const totalDuration = melody.reduce((sum, note) => sum + note.duration + 0.1, 0);
        setTimeout(() => {
            if (this.gameState === 'playing' && this.audioEnabled) {
                this.playBackgroundMelody();
            }
        }, totalDuration * 1000 + 2000); // Add 2 second pause between loops
    }

    playBackgroundNote(frequency, duration, startTime) {
        if (!this.audioEnabled || !this.audioContext) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const noteGain = this.audioContext.createGain();

            oscillator.connect(noteGain);
            noteGain.connect(this.musicGainNode);

            oscillator.frequency.setValueAtTime(frequency, startTime);
            oscillator.type = 'sine';

            // Soft envelope for background music
            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(0.3, startTime + 0.1);
            noteGain.gain.linearRampToValueAtTime(0.2, startTime + duration * 0.7);
            noteGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

            oscillator.start(startTime);
            oscillator.stop(startTime + duration);

        } catch (e) {
            console.error('Error playing background note:', e);
        }
    }

    stopBackgroundMusic() {
        if (this.backgroundMusic) {
            console.log('Stopping background music...');
            this.backgroundMusic = null;
        }
    }

    createSounds() {
        console.log('Creating sound effects...');

        // Jump sound - short beep
        this.sounds.jump = () => {
            console.log('Playing jump sound');
            this.playTone(800, 0.1, 'sine');
        };

        // Score sound - pleasant ding
        this.sounds.score = () => {
            console.log('Playing score sound');
            this.playTone(1200, 0.2, 'sine');
        };

        // Hit sound - low thud
        this.sounds.hit = () => {
            console.log('Playing hit sound');
            this.playTone(150, 0.3, 'sawtooth');
        };

        // Win sound - ascending notes
        this.sounds.win = () => {
            console.log('Playing win sound');
            this.playTone(523, 0.2, 'sine'); // C
            setTimeout(() => this.playTone(659, 0.2, 'sine'), 100); // E
            setTimeout(() => this.playTone(784, 0.3, 'sine'), 200); // G
        };

        // Game over sound - descending notes
        this.sounds.gameOver = () => {
            console.log('Playing game over sound');
            this.playTone(400, 0.2, 'sawtooth');
            setTimeout(() => this.playTone(300, 0.2, 'sawtooth'), 150);
            setTimeout(() => this.playTone(200, 0.4, 'sawtooth'), 300);
        };
    }

    async playTone(frequency, duration, type = 'sine') {
        if (!this.audioEnabled || !this.audioContext) {
            console.log('Audio disabled or no context');
            return;
        }

        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                console.log('Resuming audio context...');
                await this.audioContext.resume();
            }

            console.log(`Playing tone: ${frequency}Hz, ${duration}s, ${type}, Context state: ${this.audioContext.state}`);

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = type;

            // Envelope for smoother sound - increased volume
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, this.audioContext.currentTime + 0.01); // Increased volume
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);

            console.log('Tone started successfully');
        } catch (e) {
            console.error('Error playing sound:', e);
        }
    }

    playSound(soundName) {
        console.log(`Attempting to play sound: ${soundName}, Audio enabled: ${this.audioEnabled}`);
        if (this.audioEnabled && this.sounds[soundName]) {
            this.sounds[soundName]();
        } else {
            console.log(`Sound not played - enabled: ${this.audioEnabled}, sound exists: ${!!this.sounds[soundName]}`);
        }
    }

    async toggleAudio() {
        console.log('Toggling audio from', this.audioEnabled, 'to', !this.audioEnabled);
        this.audioEnabled = !this.audioEnabled;
        this.saveAudioSetting();
        this.updateAudioIcon();

        if (this.audioEnabled) {
            // Resume audio context if needed
            if (this.audioContext && this.audioContext.state === 'suspended') {
                console.log('Resuming audio context after toggle...');
                await this.audioContext.resume();
            }

            // Restart background music if game is playing
            if (this.gameState === 'playing') {
                setTimeout(() => this.startBackgroundMusic(), 100);
            }
        } else {
            // Stop background music when audio disabled
            this.stopBackgroundMusic();
        }
    }

    updateAudioIcon() {
        if (this.audioIcon) {
            this.audioIcon.textContent = this.audioEnabled ? '🔊' : '🔇';
            this.audioToggle.classList.toggle('muted', !this.audioEnabled);
            console.log('Audio icon updated:', this.audioEnabled ? '🔊' : '🔇');
        }
    }

    loadAudioSetting() {
        const saved = localStorage.getItem('flappyBirdAudio');
        return saved !== null ? JSON.parse(saved) : true;
    }

    saveAudioSetting() {
        localStorage.setItem('flappyBirdAudio', JSON.stringify(this.audioEnabled));
    }

    init() {
        this.setupCanvas();
        this.bindEvents();
        this.updateDisplay();
        this.showScreen('start');
        this.gameLoop();
    }

    setupCanvas() {
        // Set canvas to full window size
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Update ground position
        this.groundY = this.canvas.height - this.groundHeight;
        this.bird.y = this.canvas.height / 2;
    }

    bindEvents() {
        // Button events
        this.startButton.addEventListener('click', () => {
            console.log('Start button clicked');
            this.startGame();
        });

        this.restartButton.addEventListener('click', () => {
            console.log('Restart button clicked');
            this.restartGame();
        });

        this.playAgainButton.addEventListener('click', () => {
            console.log('Play again button clicked');
            this.restartGame();
        });

        // Audio toggle
        this.audioToggle.addEventListener('click', () => {
            this.toggleAudio();
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.handleInput();
            }
        });

        // Mouse/touch controls
        this.canvas.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleInput();
        });

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleInput();
        });

        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Handle window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
        });
    }

    showScreen(screenName) {
        console.log('Showing screen:', screenName);

        // Hide all screens
        this.startScreen.classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        this.winScreen.classList.remove('active');

        this.startScreen.style.display = 'none';
        this.gameOverScreen.style.display = 'none';
        this.winScreen.style.display = 'none';

        // Show requested screen
        switch(screenName) {
            case 'start':
                this.startScreen.style.display = 'block';
                this.startScreen.classList.add('active');
                break;
            case 'gameOver':
                this.gameOverScreen.style.display = 'block';
                this.gameOverScreen.classList.add('active');
                break;
            case 'win':
                this.winScreen.style.display = 'block';
                this.winScreen.classList.add('active');
                break;
        }
    }

    async handleInput() {
        console.log('Input handled, game state:', this.gameState);

        if (this.gameState === 'playing') {
            this.bird.velocity = this.bird.jumpPower;
            this.bird.rotation = -25;

            // Resume audio context on first user interaction
            if (this.audioContext && this.audioContext.state === 'suspended') {
                console.log('Resuming audio context on input...');
                await this.audioContext.resume();
            }

            // Play jump sound
            this.playSound('jump');

            if (!this.gameStarted) {
                this.gameStarted = true;
                console.log('Game started!');
            }
        }
    }

    startGame() {
        console.log('Starting game...');
        this.gameState = 'playing';
        this.showScreen('none');
        this.resetGame();

        // Start background music
        setTimeout(() => {
            this.startBackgroundMusic();
        }, 500);
    }

    restartGame() {
        console.log('Restarting game...');
        this.gameState = 'playing';
        this.showScreen('none');
        this.resetGame();

        // Start background music
        setTimeout(() => {
            this.startBackgroundMusic();
        }, 500);
    }

    resetGame() {
        console.log('Resetting game...');
        this.score = 0;
        this.lives = 3;
        this.gameStarted = false;
        this.bird.x = 150;
        this.bird.y = this.canvas.height / 2;
        this.bird.velocity = 0;
        this.bird.rotation = 0;
        this.pipes = [];
        this.pipeSpawnTimer = 0;
        this.updateDisplay();
        this.updateLives();
    }

    updateBird() {
        if (this.gameState !== 'playing') return;

        if (this.gameStarted) {
            this.bird.velocity += this.bird.gravity;

            if (this.bird.velocity > this.bird.maxVelocity) {
                this.bird.velocity = this.bird.maxVelocity;
            }
        }

        this.bird.y += this.bird.velocity;

        if (this.gameStarted) {
            this.bird.rotation = Math.min(Math.max(this.bird.velocity * 4, -30), 90);
        } else {
            this.bird.rotation = 0;
        }

        // Check boundaries
        if (this.bird.y < 0) {
            this.bird.y = 0;
            this.bird.velocity = 0;
        }

        if (this.bird.y + this.bird.height > this.groundY) {
            this.loseLife();
        }
    }

    updatePipes() {
        if (this.gameState !== 'playing' || !this.gameStarted) return;

        this.pipeSpawnTimer++;
        if (this.pipeSpawnTimer >= this.pipeSpawnInterval) {
            this.spawnPipe();
            this.pipeSpawnTimer = 0;
        }

        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const pipe = this.pipes[i];
            pipe.x -= this.pipeSpeed;

            if (pipe.x + this.pipeWidth < 0) {
                this.pipes.splice(i, 1);
                continue;
            }

            if (!pipe.scored && pipe.x + this.pipeWidth < this.bird.x) {
                pipe.scored = true;
                this.score++;
                this.updateDisplay();

                // Play score sound
                this.playSound('score');

                if (this.score >= this.maxScore) {
                    this.winGame();
                    return;
                }

                this.currentScoreElement.parentElement.classList.add('score-pulse');
                setTimeout(() => {
                    this.currentScoreElement.parentElement.classList.remove('score-pulse');
                }, 300);
            }

            if (this.checkCollision(pipe)) {
                this.loseLife();
                break;
            }
        }
    }

    spawnPipe() {
        const minGapY = 100;
        const maxGapY = this.groundY - this.pipeGap - 100;
        const gapY = Math.random() * (maxGapY - minGapY) + minGapY;

        const pipe = {
            x: this.canvas.width,
            topHeight: gapY,
            bottomY: gapY + this.pipeGap,
            bottomHeight: this.groundY - (gapY + this.pipeGap),
            scored: false
        };

        this.pipes.push(pipe);
    }

    checkCollision(pipe) {
        const birdLeft = this.bird.x;
        const birdRight = this.bird.x + this.bird.width;
        const birdTop = this.bird.y;
        const birdBottom = this.bird.y + this.bird.height;

        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + this.pipeWidth;

        if (birdRight > pipeLeft && birdLeft < pipeRight) {
            if (birdTop < pipe.topHeight || birdBottom > pipe.bottomY) {
                return true;
            }
        }

        return false;
    }

    loseLife() {
        this.lives--;
        this.updateLives();

        // Play hit sound
        this.playSound('hit');

        // Visual feedback
        this.canvas.style.filter = 'brightness(0.5)';
        setTimeout(() => {
            this.canvas.style.filter = 'brightness(1)';
        }, 200);

        if (this.lives <= 0) {
            this.gameOver();
        } else {
            this.bird.x = 150;
            this.bird.y = this.canvas.height / 2;
            this.bird.velocity = 0;
            this.bird.rotation = 0;
            this.gameStarted = false;
        }
    }

    winGame() {
        console.log('Player wins!');
        this.gameState = 'win';

        // Stop background music
        this.stopBackgroundMusic();

        // Play win sound
        this.playSound('win');

        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
        }

        this.winHighScoreElement.textContent = this.highScore;
        this.showScreen('win');
        this.updateDisplay();
    }

    gameOver() {
        console.log('Game over!');
        this.gameState = 'gameOver';

        // Stop background music
        this.stopBackgroundMusic();

        // Play game over sound
        this.playSound('gameOver');

        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
        }

        this.finalScoreElement.textContent = this.score;
        this.finalHighScoreElement.textContent = this.highScore;
        this.showScreen('gameOver');
        this.updateDisplay();
    }

    updateLives() {
        for (let i = 1; i <= 3; i++) {
            const heart = document.getElementById(`heart${i}`);
            if (heart) {
                if (i > this.lives) {
                    heart.classList.add('lost');
                } else {
                    heart.classList.remove('lost');
                }
            }
        }
    }

    updateDisplay() {
        this.currentScoreElement.textContent = `${this.score}/${this.maxScore}`;
        this.highScoreElement.textContent = this.highScore;
    }

    loadHighScore() {
        const saved = localStorage.getItem('flappyBirdHighScore');
        return saved ? parseInt(saved) : 0;
    }

    saveHighScore() {
        localStorage.setItem('flappyBirdHighScore', this.highScore.toString());
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawBackground();
        this.drawClouds();
        this.drawPipes();
        this.drawGround();
        this.drawBird();
    }

    drawBackground() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.75, '#87CEEB');
        gradient.addColorStop(1, '#DEB887');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawClouds() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

        const clouds = [
            { x: this.canvas.width * 0.2, y: 80, size: 40 },
            { x: this.canvas.width * 0.5, y: 120, size: 35 },
            { x: this.canvas.width * 0.8, y: 60, size: 45 }
        ];

        clouds.forEach(cloud => {
            this.ctx.beginPath();
            this.ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
            this.ctx.arc(cloud.x + 25, cloud.y, cloud.size * 0.8, 0, Math.PI * 2);
            this.ctx.arc(cloud.x + 50, cloud.y, cloud.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawBird() {
        this.ctx.save();

        this.ctx.translate(this.bird.x + this.bird.width / 2, this.bird.y + this.bird.height / 2);
        this.ctx.rotate(this.bird.rotation * Math.PI / 180);

        // Bird body
        this.ctx.fillStyle = '#FFD700';
        this.ctx.strokeStyle = '#FFA500';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, this.bird.width / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Bird eye
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.arc(5, -5, 6, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = 'black';
        this.ctx.beginPath();
        this.ctx.arc(7, -3, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Bird beak
        this.ctx.fillStyle = '#FF8C00';
        this.ctx.beginPath();
        this.ctx.moveTo(this.bird.width / 2 - 5, 0);
        this.ctx.lineTo(this.bird.width / 2 + 10, 0);
        this.ctx.lineTo(this.bird.width / 2 - 5, 5);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.restore();
    }

    drawPipes() {
        this.pipes.forEach(pipe => {
            // Top pipe
            this.ctx.fillStyle = '#228B22';
            this.ctx.strokeStyle = '#006400';
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(pipe.x, 0, this.pipeWidth, pipe.topHeight);
            this.ctx.strokeRect(pipe.x, 0, this.pipeWidth, pipe.topHeight);

            // Top pipe cap
            this.ctx.fillRect(pipe.x - 5, pipe.topHeight - 20, this.pipeWidth + 10, 20);
            this.ctx.strokeRect(pipe.x - 5, pipe.topHeight - 20, this.pipeWidth + 10, 20);

            // Bottom pipe
            this.ctx.fillRect(pipe.x, pipe.bottomY, this.pipeWidth, pipe.bottomHeight);
            this.ctx.strokeRect(pipe.x, pipe.bottomY, this.pipeWidth, pipe.bottomHeight);

            // Bottom pipe cap
            this.ctx.fillRect(pipe.x - 5, pipe.bottomY, this.pipeWidth + 10, 20);
            this.ctx.strokeRect(pipe.x - 5, pipe.bottomY, this.pipeWidth + 10, 20);

            // Draw point indicator
            if (!pipe.scored) {
                const gapCenterY = pipe.topHeight + (this.pipeGap / 2);
                const pointX = pipe.x + (this.pipeWidth / 2);

                this.ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
                this.ctx.strokeStyle = '#FF8C00';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(pointX, gapCenterY, 15, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();

                this.ctx.fillStyle = '#8B4513';
                this.ctx.font = 'bold 16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('1', pointX, gapCenterY);
            }
        });
    }

    drawGround() {
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(0, this.groundY, this.canvas.width, this.groundHeight);

        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.groundY);
        this.ctx.lineTo(this.canvas.width, this.groundY);
        this.ctx.stroke();

        this.ctx.fillStyle = '#228B22';
        for (let x = 0; x < this.canvas.width; x += 20) {
            this.ctx.fillRect(x, this.groundY - 10, 15, 10);
        }
    }

    gameLoop(currentTime = 0) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.updateBird();
        this.updatePipes();
        this.render();

        this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing game...');
    const game = new FlappyBirdGame();

    // Handle page visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && game.gameState === 'playing') {
            game.gameState = 'paused';
        }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        game.destroy();
    });
});
