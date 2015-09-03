'use strict';

let ESCAPE = 27, ENTER = 13, TAB = 9,
  BACKSPACE = 8, LEFT_ARROW = 37, RIGHT_ARROW = 39,
  SPACE = 32;

let SOUNDS = {
  'High Tone': 'audio/high_tone.wav',
  'Low Tone': 'audio/low_tone.wav',
  'Beep': 'audio/beep.wav',
  'Click': 'audio/click.wav',
  'Block': 'audio/block.wav',
  'Cowbell': 'audio/cowbell.wav',
  'Triangle': 'audio/triangle.wav',
  'Drumstick': 'audio/high_stick.wav'
}
let DEFAULT_SOUND = 'High Tone';

let DEFAULT_BPM = 80,
  MAX_BPM = 250,
  MIN_BPM = 10;

class Metronome {
  constructor(soundController) {
    this.soundController = soundController;

    this.speedDisplay = document.getElementById('speedDisplay');
    this.speedText = document.getElementById('speedText');
    this.upArrow = document.getElementById('upArrow');
    this.downArrow = document.getElementById('downArrow');
    this.playButton = document.getElementById('playButton');
    this._bpm = DEFAULT_BPM;
    this._isRunning = false;

    this.tick = this.tick.bind(this);
    this.incrementBpm = this.incrementBpm.bind(this);
    this.decrementBpm = this.decrementBpm.bind(this);

    this.updateDisplay();
    this.addEventListeners();
  }
  addEventListeners() {
    /* BPM changing and play/pause buttons */
    let bpmChange = function(func, ms) {
      ms = ms || 33;
      func();
      this.bpmChangeTimeout = setTimeout(function() { bpmChange(func); }, ms);
    }.bind(this);
    this.upArrow.onmousedown = function() { bpmChange(this.incrementBpm, 250); }.bind(this);
    this.downArrow.onmousedown = function() { bpmChange(this.decrementBpm, 250); }.bind(this);
    window.addEventListener('mouseup', function(event) { clearTimeout(this.bpmChangeTimeout); }.bind(this));
    this.upArrow.onmouseout = this.downArrow.onmouseout = function(event) { clearTimeout(this.bpmChangeTimeout); }.bind(this);
    this.playButton.onclick = function(event) {
      if(this._isRunning) this.stop();
      else this.start();
      this.updateDisplay();
    }.bind(this);
    /* Scrolling -- change BPM */
    window.addEventListener('wheel', function(event) {
      event.preventDefault();
      let deltaY = event.deltaY;
      if(event.webkitDirectionInvertedFromDevice) { deltaY *= -1; }
      if(deltaY < 0) this.incrementBpm();
      else if(deltaY > 0) this.decrementBpm();
    }.bind(this));
    /* BPM text */
    this.speedText.onfocus = function(event) {
      setTimeout(function() {
        let selection = window.getSelection(),
          range = document.createRange();
        range.selectNodeContents(this.speedText.childNodes[0]);
        selection.removeAllRanges();
        selection.addRange(range);
      }.bind(this), 1);
    }.bind(this);
    this.speedText.onblur = function(event) {
      this.bpm = this.speedText.textContent;
      document.getSelection().removeAllRanges();
    }.bind(this);
    this.speedText.onkeydown = function(event) {
      event.stopPropagation();
      if(event.which === ENTER || event.which === TAB) {
        event.preventDefault();
        document.activeElement.blur();
      } else if((this.speedText.textContent.length >= 3 && [ BACKSPACE, LEFT_ARROW, RIGHT_ARROW ].indexOf(event.which) === -1 && window.getSelection().toString().length === 0)
          || ((event.which < 48 || event.which > 57) && [ BACKSPACE, LEFT_ARROW, RIGHT_ARROW ].indexOf(event.which) === -1)) {
        event.preventDefault();
      }
    }.bind(this);
    /* Window keybindings */
    window.addEventListener('keydown', function(event) {
      if(event.which === 38) this.incrementBpm(); // up arrow key -- increase BPM
      else if(event.which === 40) this.decrementBpm(); // down arrow key -- decrease BPM
      else if([ ENTER, SPACE ].indexOf(event.which) !== -1) { // start/stop metronome keys
        if(this.isPlaying) this.stop();
        else this.start();
      } else console.log('Key pressed: ' + event.which);
    }.bind(this));
  }
  set bpm(newBpm) {
    if(isNaN(newBpm) || newBpm < MIN_BPM) newBpm = MIN_BPM;
    else if(newBpm > MAX_BPM) newBpm = MAX_BPM;
    this._bpm = newBpm;
    this.updateDisplay();
  }
  get bpm() { return this._bpm }
  get isPlaying() { return this._isRunning }
  incrementBpm() { ++this.bpm; }
  decrementBpm() { --this.bpm; }
  updateDisplay() {
    this.speedText.textContent = this.bpm;
    this.playButton.style.backgroundImage = this._isRunning ? 'url(images/pause.png)' : 'url(images/play.png)';
  }
  start() { this._isRunning = true; this.updateDisplay(); this.tick(); }
  stop() { this._isRunning = false; this.updateDisplay(); clearTimeout(this.nextTick); }
  tick() {
    if(!this.isPlaying) return;
    this.soundController.playOnce();
    this.nextTick = setTimeout(this.tick, 60 / this.bpm * 1000);
  }
}

class SoundController {
  constructor() {
    this.audioChooseButton = document.getElementById('audioChooseButton');
    this.audioChooseMenu = document.getElementById('audioChooseMenu');
    this.ctx = new AudioContext();
    this.soundData = { };

    this.loadMenu();
    this.loadSounds();
    this.addEventListeners();

    this.changeAudio(DEFAULT_SOUND);
  }
  addEventListeners() {
    this.audioChooseButton.onclick = function() {
      if(this.audioChooseMenu.style.visibility !== 'visible') this.audioChooseMenu.style.visibility = 'visible';
      else this.audioChooseMenu.style.visibility = 'hidden';
    }.bind(this);
  }
  loadMenu() {
    for(let k in SOUNDS) {
      let newButton = document.createElement('span');
      newButton.className = 'audioOption';
      newButton.textContent = k;
      newButton.onclick = function() {
        let soundName = k;
        return function() { this.changeAudio(k); if(!metronome.isPlaying) this.playOnce(); }
      }().bind(this);
      this.audioChooseMenu.appendChild(newButton);
    }
  }
  loadSounds() {
    for(let k in SOUNDS) {
      var request = new XMLHttpRequest();
      request.open('GET', SOUNDS[k], true);
      request.responseType = 'arraybuffer';

      request.onload = function() {
        let localRequest = request;
        let soundName = k;
        return function() {
          this.ctx.decodeAudioData(localRequest.response, function(buffer) { console.log('Loaded ' + soundName + ' sound data'); this.soundData[soundName] = buffer; }.bind(this), window.onError);
        }
      }().bind(this);
      request.send();
    }
  }
  changeAudio(audioName) {
    this.currentAudioName = audioName;
    this.currentAudioObj = new Audio(SOUNDS[audioName]);
    let options = document.getElementsByClassName('audioOption');
    for(let i = 0; i < options.length; ++i) {
      if(options[i].textContent !== audioName) options[i].removeAttribute('id');
      else options[i].id = 'currentAudioOption';
    }
  }
  play() { this.currentAudioObj.currentTime = 0; this.currentAudioObj.play(); }
  playOnce() {
    let source = this.ctx.createBufferSource();
    source.buffer = this.soundData[this.currentAudioName];
    source.connect(this.ctx.destination);
    source.start(0);
  }
}

let soundController = new SoundController();
let metronome = new Metronome(soundController);
