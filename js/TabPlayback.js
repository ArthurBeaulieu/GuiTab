class TabPlayback {


  constructor() {
    this._masterGainNode = null;
    this._oscillatorNode = null;
    this._noteFreq = [];
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
      octave['B'] = referenceA *  Math.pow(2, 2/12);
      octave['A#'] = referenceA *  Math.pow(2, 1/12);
      octave['G#'] = referenceA *  Math.pow(2, -1/12);
      octave['G'] = referenceA *  Math.pow(2, -2/12);
      octave['F#'] = referenceA *  Math.pow(2, -3/12);
      octave['F'] = referenceA *  Math.pow(2, -4/12);
      octave['E'] = referenceA *  Math.pow(2, -5/12);
      octave['D#'] = referenceA *  Math.pow(2, -6/12);
      octave['D'] = referenceA *  Math.pow(2, -7/12);
      octave['C#'] = referenceA *  Math.pow(2, -8/12);
      octave['C'] = referenceA *  Math.pow(2, -9/12);
    };
    // We compute As on each octave, then build all other notes accordingly
    for (let i = -4; i < 5; ++i) {
      this._noteFreq[i + 4]['A'] = 440 * Math.pow(2, i);
      buildOctave(this._noteFreq[i + 4], this._noteFreq[i + 4]['A']);
    }

    this._playNote(this._noteFreq[4]['A']);
  }


  _setupNodes() {
    this._masterGainNode = this._audioContext.createGain();
    this._masterGainNode.gain.value = 1;

    this._oscillatorNode = this._audioContext.createOscillator();
    this._oscillatorNode.type = 'sine';
    this._oscillatorNode.connect(this._masterGainNode);
    this._masterGainNode.connect(this._audioContext.destination);
  }


  _playNote(frequency) {
    this._oscillatorNode.frequency.value = frequency;
    this._oscillatorNode.start();
    setTimeout(() => {
      osc.stop();
    }, 100); // TODO : time to be determined from bpm value
  }


}


export default TabPlayback;
