// Time playback bar for the wave lessons: play/pause, scrubber, clock and speed.
// onTime(t) is called whenever the displayed time changes.

export class Player {
  constructor(container, { duration, onTime, speed = 1 }) {
    this.duration = duration;
    this.onTime = onTime;
    this.t = 0;
    this.speed = speed;
    this.playing = false;
    this.last = null;
    container.innerHTML = `
      <div class="panel playback">
        <button class="btn btn-primary" type="button" data-play>Play</button>
        <input type="range" min="0" max="1000" value="0" aria-label="Time" data-scrub>
        <span class="clock" data-clock>t = 0.00</span>
        <label><span class="visually-hidden">Playback speed</span>
          <select data-speed><option value="0.5">Slow</option><option value="1" selected>Normal</option><option value="2">Fast</option></select></label>
      </div>`;
    this.button = container.querySelector('[data-play]');
    this.scrub = container.querySelector('[data-scrub]');
    this.clock = container.querySelector('[data-clock]');
    this.speedSelect = container.querySelector('[data-speed]');
    this.button.addEventListener('click', () => (this.playing ? this.pause() : this.play()));
    this.scrub.addEventListener('input', () => {
      this.pause();
      this.seek((Number(this.scrub.value) / 1000) * this.duration);
    });
    this.speedSelect.addEventListener('change', () => (this.speedFactor = Number(this.speedSelect.value)));
    this.speedFactor = 1;
    this.frame = this.frame.bind(this);
  }

  setDuration(d) {
    this.duration = d;
    this.seek(Math.min(this.t, d));
  }

  seek(t) {
    this.t = Math.max(0, Math.min(this.duration, t));
    this.scrub.value = String(Math.round((this.t / this.duration) * 1000));
    this.clock.textContent = `t = ${this.t.toFixed(2)}`;
    this.onTime(this.t);
  }

  play() {
    if (this.t >= this.duration) this.seek(0);
    this.playing = true;
    this.button.textContent = 'Pause';
    this.last = null;
    requestAnimationFrame(this.frame);
  }

  pause() {
    this.playing = false;
    this.button.textContent = 'Play';
  }

  frame(now) {
    if (!this.playing) return;
    if (this.last !== null) {
      const next = this.t + ((now - this.last) / 1000) * this.speed * this.speedFactor;
      if (next >= this.duration) {
        this.seek(this.duration);
        this.pause();
        return;
      }
      this.seek(next);
    }
    this.last = now;
    requestAnimationFrame(this.frame);
  }
}
