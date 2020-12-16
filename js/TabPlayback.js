class TabPlayback {


  constructor() {
    this._masterGainNode = null;
    this._oscillatorNode = null;
    this._noteFreq = [];
    this._playbackTimeoutId = -1;
    this._notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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
    this._masterGainNode = this._audioContext.createGain();
    this._masterGainNode.gain.value = 1;

    this._oscillatorNode = this._audioContext.createOscillator();
    this._oscillatorNode.type = 'sine';
    this._masterGainNode.connect(this._audioContext.destination);
    this._oscillatorNode.start();
  }


  _playNote(frequency, duration = 200) {
    this._oscillatorNode.frequency.value = frequency;
    this._oscillatorNode.connect(this._masterGainNode);
    setTimeout(() => {
      this._oscillatorNode.disconnect(this._masterGainNode);
    }, duration);
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
    if (info.type === 'Guitar') {
      info.stringsOctave = [6, 5, 5, 5, 4, 4];
    } else if (info.type === 'Bass') {
      info.stringsOctave = [3, 3, 2, 2];
    }

    this.playBeat(info, measures, cursor, cursor.measure, 0, refreshCB);
  }


  playBeat(info, measures, cursor, index, beat, refreshCB) {
    //refreshCB({});
    if (beat >= measures[index].subBeats) {
      beat = 0;
      ++index;
      // Stop playback if no measures left
      if (!measures[index]) {
        this.stopPlayback();
        return;
      }
    }

    const tempo = (60 / info.bpm / measures[index].timeSignature.beat) * 1000;
    for (let i = 0; i < measures[index].notes.length; ++i) {
      if (beat === measures[index].notes[i].beat) {
        const string = measures[index].notes[i].string;
        const value = measures[index].notes[i].value;
        this._playNote(this._getNoteFreq(info, string, value, measures[index].notes[i]), tempo);
      }
    }
    // Tempo value in ms
    // Recursive call after BPM timeout between beats
    this._playbackTimeoutId = setTimeout(() => {
      this.playBeat(info, measures, cursor, index, ++beat, refreshCB);
    }, tempo);
  }


  stopPlayback() {
    clearTimeout(this._playbackTimeoutId);
    this._playbackTimeoutId = -1;
  }


}


export default TabPlayback;
