import WaveTableEnum from './WaveTableEnum.js';


class TabPlayback {


  constructor() {
    this._masterGainNode = null;
    this._convolverNode = null;
    this._clickOscillatorNode = null;
    this._clickOscillatorGainNode = null;
    this._oscillatorNodes = [];
    this._oscillatorGainNodes = [];
    this._noteFreq = [];
    this._playbackTimeoutId = -1;
    this._notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    this._isPlaying = false;

    try {
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      throw new Error(error);
      return;
    }

    this._setupNodes();
    this._buildNoteTable();
  }


  _buildNoteTable() {
    for (let i = 0; i < 9; ++i) {
      this._noteFreq[i] = {};
    }
    // As fn = f0 * (a)^n, w/ f0 being A4 (440Hz), a being 2^1/2 and n being the note from A
    const buildOctave = (octave, referenceA) => {
      octave['A#'] = referenceA *  Math.pow(2, 1/12);
      octave['B'] = referenceA *  Math.pow(2, 2/12);
      octave['C'] = referenceA *  Math.pow(2, -9/12);
      octave['C#'] = referenceA *  Math.pow(2, -8/12);
      octave['D'] = referenceA *  Math.pow(2, -7/12);
      octave['D#'] = referenceA *  Math.pow(2, -6/12);
      octave['E'] = referenceA *  Math.pow(2, -5/12);
      octave['F'] = referenceA *  Math.pow(2, -4/12);
      octave['F#'] = referenceA *  Math.pow(2, -3/12);
      octave['G'] = referenceA *  Math.pow(2, -2/12);
      octave['G#'] = referenceA *  Math.pow(2, -1/12);
    };
    // We compute As on each octave, then build all other notes accordingly
    for (let i = -4; i < 5; ++i) {
      this._noteFreq[i + 4]['A'] = 440 * Math.pow(2, i);
      buildOctave(this._noteFreq[i + 4], this._noteFreq[i + 4]['A']);
    }
  }


  _setupNodes() {
    // This master gain handle the Tab dynamics
    this._masterGainNode = this._audioContext.createGain();
    this._masterGainNode.gain.value = 1;
    // Click oscillator
    this._clickOscillatorNode = this._audioContext.createOscillator();
    this._clickOscillatorNode.type = 'sine';
    this._clickOscillatorGainNode = this._audioContext.createGain();
    this._clickOscillatorGainNode.gain.value = 0;
    this._clickOscillatorNode.start();
    // Some reverb for more sexy sound
    this._convolverNode = this._audioContext.createConvolver();
    this._convolverNode.buffer = this._impulseResponse(0.2, 0.8, false);

    this._masterGainNode.connect(this._convolverNode);
    this._convolverNode.connect(this._audioContext.destination);

    this._clickOscillatorNode.connect(this._clickOscillatorGainNode);
    this._clickOscillatorGainNode.connect(this._audioContext.destination);
  }


  _impulseResponse(duration, decay = 2.0, reverse) {
    // Real MVP : https://stackoverflow.com/a/22538980
    const sampleRate = this._audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = this._audioContext.createBuffer(2, length, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; ++i) {
      const n = reverse ? length - i : i;
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }

    return impulse;
  }


  _prepareOscillators(stringsAmount, instrument) {
    // Clear oscillator nodes
    this._oscillatorNodes = [];
    this._oscillatorGainNodes = [];
    // Iterate the string amount to create an oscillator per string
    for (let i = 0; i < stringsAmount; ++i) {
      // For socillator sound enveloppe
      const oscillatorGain = this._audioContext.createGain();
      oscillatorGain.gain.value = 0;
      // Actual string oscillator
      const oscillator = this._audioContext.createOscillator();
      const real = new Float32Array(WaveTableEnum[instrument].real);
      const imag = new Float32Array(WaveTableEnum[instrument].imag);
      const wave = this._audioContext.createPeriodicWave(real, imag);
      // Put wave in oscillator
      oscillator.setPeriodicWave(wave);
      // Connect oscillator to its gain, the gain must linked to master gain
      oscillator.connect(oscillatorGain);
      // Start oscillator
      oscillator.start();
      // Save oscillator and its gain to class internals
      this._oscillatorNodes.push(oscillator);
      this._oscillatorGainNodes.push(oscillatorGain);
      oscillatorGain.connect(this._masterGainNode);
    }
  }


  _playClick(firstBeat, tempo) {
    this._clickOscillatorNode.frequency.value = 440;

    if (firstBeat) {
      this._clickOscillatorNode.frequency.value = 880;
    }

    let now = this._audioContext.currentTime;
    this._clickOscillatorGainNode.gain.setValueAtTime(0, now, 0.1);
    this._clickOscillatorGainNode.gain.linearRampToValueAtTime(0.05, now + 0.05);
    this._clickOscillatorGainNode.gain.setValueAtTime(0.05, now + 0.05, 0.1);
    this._clickOscillatorGainNode.gain.linearRampToValueAtTime(0, now + 0.1);
  }


  _playNote(string, frequency, duration = 200) {
    this._oscillatorNodes[string].frequency.value = frequency;
    // Start oscillator sound
    let now = this._audioContext.currentTime;
    this._oscillatorGainNodes[string].gain.setValueAtTime(this._oscillatorGainNodes[string].gain.value, now, 0.1);
    this._oscillatorGainNodes[string].gain.linearRampToValueAtTime(1 , now + (duration / 4000));
    this._oscillatorGainNodes[string].gain.setValueAtTime(1, now + (duration / 4000) + 0.0240, 0.1);
    this._oscillatorGainNodes[string].gain.linearRampToValueAtTime(0, now + (duration / 1000) - 0.0120);
  }


  _getNoteFreq(info, string, value, note) {
    let octave = info.stringsOctave[string - 1];
    let noteLetter = '';

    let baseLetter = '';
    let baseLetterIndex = -1;
    for (let i = 0; i < this._notes.length; ++i) {
      if (this._notes[i] === info.strings[note.string - 1]) {
        baseLetter = this._notes[i];
        baseLetterIndex = i;
        break;
      }
    }

    if (baseLetterIndex + note.value >= 12) {
      octave += Math.floor((baseLetterIndex + note.value) / 12);
      noteLetter = this._notes[(baseLetterIndex + note.value) % 12]
    } else {
      noteLetter = this._notes[baseLetterIndex + note.value]
    }

    return this._noteFreq[octave][noteLetter];
  }


  startPlayback(info, measures, cursor, refreshCB) {
    this._isPlaying = true;
    if (info.type === 'Guitar') {
      info.stringsOctave = [6, 5, 5, 5, 4, 4];
    } else if (info.type === 'Bass') {
      info.stringsOctave = [3, 3, 2, 2];
    }

    this._prepareOscillators(info.stringsOctave.length, info.instrument);
    this.playBeat(info, measures, cursor, cursor.measure, 0, refreshCB);
  }


  playBeat(info, measures, cursor, index, beat, refreshCB) {
    if (beat >= measures[index].subBeats) {
      beat = 0;
      ++index;
      // Stop playback if no measures left
      if (!measures[index]) {
        refreshCB(index, beat, true);
        this.stopPlayback();
        return;
      }
    }
    let tempo = (1000 * 60 / info.bpm) / measures[index].timeSignature.beat;
    // Call refresh on each measure main beat
    if (beat % measures[index].timeSignature.beat === 0) {
      if (info.click === true) {
        this._playClick(beat === 0, tempo);
      }

      refreshCB(index, beat);
    }
    // Update bpm info if any tempo modification on studied measure
    for (let i = 0; i < measures[index].tempo.length; ++i) {
      if (beat === measures[index].tempo[i].beat) {
        info.bpm = measures[index].tempo[i].value;
      }
    }
    // Search for notes on current beat
    for (let i = 0; i < measures[index].notes.length; ++i) {
      if (beat === measures[index].notes[i].beat) {
        const string = measures[index].notes[i].string;
        const value = measures[index].notes[i].value;
        if (info.symbols.indexOf(value) === -1) {
          this._playNote(string - 1, this._getNoteFreq(info, string, value, measures[index].notes[i]), tempo);
        }
      }
    }
    // Update dynamic (master gain)
    for (let i = 0; i < measures[index].dynamics.length; ++i) {
      if (beat === measures[index].dynamics[i].beat) {
        switch (measures[index].dynamics[i].value) {
          case 'ff':
            this._masterGainNode.gain.value = 1;
            break;
          case 'f':
            this._masterGainNode.gain.value = 0.8;
            break;
          case 'mf':
            this._masterGainNode.gain.value = 0.6;
            break;
          case 'mp':
            this._masterGainNode.gain.value = 0.5;
            break;
          case 'p':
            this._masterGainNode.gain.value = 0.4;
            break;
          case 'pp':
            this._masterGainNode.gain.value = 0.3;
            break;
          default:
            break;
        }
      }
    }
    // Tempo value in ms
    // Recursive call after BPM timeout between beats
    this._playbackTimeoutId = setTimeout(() => {
      this.playBeat(info, measures, cursor, index, ++beat, refreshCB);
    }, tempo);
  }


  stopPlayback() {
    this._isPlaying = false;
    // Clear playback timeout
    clearTimeout(this._playbackTimeoutId);
    this._playbackTimeoutId = -1;
  }


  get isPlaying() {
    return this._isPlaying;
  }


}


export default TabPlayback;
