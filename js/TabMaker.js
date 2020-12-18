import TabPlayback from './TabPlayback.js';


class TabMaker {


  constructor(options) {
    // Tab score specific internals
    this._name = options.name;
    this._composer = options.composer;
    this._bpm = options.bpm;
    this._type = `${options.instrumentType.charAt(0).toUpperCase()}${options.instrumentType.slice(1)}`;
    this._timeSignature = {};
    // Local storage key
    this._lsName = '';
    // Project score internals, object to save as JSON to save score, or restore existing object
    if (options.measures) {
      this._timeSignature = options.timeSignature;
      this._measures = options.measures;
      this._lsName = options.lsKey;
    } else {
      this._timeSignature = {
        master: true, // Master time signature can't be removed
        beat: parseInt(options.timeSignature.split('/')[1]),
        measure: parseInt(options.timeSignature.split('/')[0]),
        string: options.timeSignature,
        measureNumber: 0
      };
      this._measures = [];
    }
    // Instrument specific internals (default to Guitar)
    this._lineCount = 6;
    this._strings = ['E', 'B', 'G', 'D', 'A', 'E'];
    this._symbols = ['h', 'p', 'b', 'x', 'v', '/', '\\'];
    // Canvas internals
    this._canvas = document.getElementById('tab-canvas');
    this._ctx = this._canvas.getContext('2d');
    // Tab canvas utils
    this._resolutionFactor = 2;
    this._lineSpace = 12 * this._resolutionFactor;
    this._tabLineHeight = 0;
    this._tabLineMargin = this._lineSpace * 8
    this._fontSize = 10 * this._resolutionFactor;
    this._lineLength = 0;
    this._measureLength = 0;
    this._measurePerLines = 0;
    // Tab header
    this._headerHeight = 150 * this._resolutionFactor;
    // User cursor
    this._cursor = {
      x: 0,
      y: 0
    };
    // Keyboard event
    this._keyEventTimeoutId = null;
    this._keyValue = '';
    // Tab customisation
    this._colors = {
      text: '#000000',
      bar: '#888888',
      subBar: '#BBBBBB'
    };
    // Tab audio playback
    this._playback = new TabPlayback();
    this._withClick = false;
    this._playbackCursor = {
      visible: false,
      beat: 0,
      measure: 0
    };

    this._evtIds = [];

    this._init();
    this._events();
  }


  destroy() {
    // Remove all shortcuts
    Shortcut.removeAll();
    // Remove all standard events
    for (let i = 0; i < this._evtIds.length; ++i) {
      Events.removeEvent(this._evtIds[i]);
    }
    // Remove all class keys
    Object.keys(this).forEach(key => {
      delete this[key];
    });
  }


  _init() {
    // Update UI with project info
    document.getElementById('project-info-main').innerHTML = `${this._name} – ${this._composer}`;
    document.getElementById('project-info-aux').innerHTML = `${this._type} tab – ${this._timeSignature.string} – ${this._bpm} BPM`;
    // Here we compute the amount of sub beat in a measure (dividing a beat in 8 subbeats), with 6 measures in a line
    this._measureLength = (this._timeSignature.beat * this._timeSignature.measure) * this._lineSpace;
    while (this._lineLength <= ((984 * this._resolutionFactor) - (2 * this._lineSpace) - this._measureLength)) {
      ++this._measurePerLines;
      this._lineLength += this._measureLength;
    }

    if (this._type === 'Bass') {
      this._lineCount = 4;
      this._strings = ['G', 'D', 'A', 'E'];
    }

    this._tabLineHeight = (this._lineCount - 1) * this._lineSpace;

    // Init canvas dimension with one line
    this._canvas.height = this._headerHeight + this._tabLineHeight + this._tabLineMargin;
    this._canvas.width = this._lineLength + (3 * this._lineSpace);
    this._canvas.style.height = `${(this._headerHeight + this._tabLineHeight + this._tabLineMargin) / this._resolutionFactor}px`;
    // Save in local storage the new project
    if (this._lsName === '') {
      this._lsName = `guitab-${this._name}-${this._composer}-${Date.now()}`;
      window.localStorage.setItem(this._lsName, '');
    } else {
      // Update canvas, height according to the number of measures
      for (let i = this._measurePerLines; i < this._measures.length; i += this._measurePerLines) {
        this._canvas.height += this._tabLineHeight + this._tabLineMargin;
        this._canvas.style.height = `${parseInt(this._canvas.style.height.slice(0, -2)) + ((this._tabLineHeight + this._tabLineMargin) / this._resolutionFactor)}px`;
      }
    }

    this._initTab();
  }


  _events() {
    // Save/Download/Export events
    this._evtIds.push(Events.addEvent('click', document.getElementById('save-project'), this._refreshTab, this));
    this._evtIds.push(Events.addEvent('click', document.getElementById('download-project'), this._downloadAsPDF, this));
    this._evtIds.push(Events.addEvent('click', document.getElementById('export-project'), this._exportProject, this));
    // Cursor movement
    Shortcut.register('ArrowLeft', this._moveCursorLeft.bind(this));
    Shortcut.register('Ctrl+ArrowLeft', this._moveCursorLeft.bind(this, true));
    Shortcut.register('ArrowRight', this._moveCursorRight.bind(this));
    Shortcut.register('Ctrl+ArrowRight', this._moveCursorRight.bind(this, true));
    Shortcut.register('ArrowUp', this._moveCursorUp.bind(this));
    Shortcut.register('ArrowDown', this._moveCursorDown.bind(this));
    Shortcut.register('q', this._moveCursorLeft.bind(this));
    Shortcut.register('Ctrl+q', this._moveCursorLeft.bind(this, true));
    Shortcut.register('d', this._moveCursorRight.bind(this));
    Shortcut.register('Ctrl+d', this._moveCursorRight.bind(this, true));
    Shortcut.register('z', this._moveCursorUp.bind(this));
    Shortcut.register('s', this._moveCursorDown.bind(this));
    Shortcut.register('Space', this._spacePressed.bind(this));
    // Dynamic events
    const dynamicIcons = document.getElementById('dynamic-icons');
    for (let i= 0; i < dynamicIcons.children.length; ++i) {
      this._evtIds.push(Events.addEvent('click', dynamicIcons.children[i], this._dynamicClicked, this));
    }
    // Chord events
    this._evtIds.push(Events.addEvent('click', document.getElementById('add-chord'), this._addChord, this));
    this._evtIds.push(Events.addEvent('click', document.getElementById('remove-chord'), this._removeChord, this));
    // Section events
    this._evtIds.push(Events.addEvent('click', document.getElementById('add-section'), this._addSection, this));
    this._evtIds.push(Events.addEvent('click', document.getElementById('remove-section'), this._removeSection, this));
    // Syllabe events
    this._evtIds.push(Events.addEvent('click', document.getElementById('add-syllabe'), this._addSyllabe, this));
    this._evtIds.push(Events.addEvent('click', document.getElementById('remove-syllabe'), this._removeSyllabe, this));
    // Tempo events
    this._evtIds.push(Events.addEvent('click', document.getElementById('add-tempo'), this._addTempo, this));
    this._evtIds.push(Events.addEvent('click', document.getElementById('remove-tempo'), this._removeTempo, this));
    // Time signature events
    this._evtIds.push(Events.addEvent('click', document.getElementById('add-time-signature'), this._addTimeSignature, this));
    this._evtIds.push(Events.addEvent('click', document.getElementById('remove-time-signature'), this._removeTimeSignature, this));
    // Local keayboard event
    this._evtIds.push(Events.addEvent('keydown', document, this._keyboardClicked, this));
    // Playback events
    this._evtIds.push(Events.addEvent('click', document.getElementById('toggle-playback'), this._togglePlayback, this));
    this._evtIds.push(Events.addEvent('click', document.getElementById('toggle-click'), this._toggleClick, this));
  }


  _initTab() {
    // Init cursor position to first beat, first sub beat on lowest instrument string
    this._cursor = {
      x: this._lineSpace + (this._lineSpace / 2),
      y: this._headerHeight + this._tabLineHeight + (this._tabLineMargin / 2) - (this._lineSpace / 2),
      measure: 0,
      beat: 0,
      line: 0,
      string: this._strings.length
    };
    // Fill first line with
    if (this._measures.length === 0) {
      for (let i = 0; i < this._measurePerLines; ++i) {
        const timeSignature = Object.assign({}, this._timeSignature);
        timeSignature.measureNumber = i;
        // Then create the first measure, its index refer to its position
        this._measures.push({
          subBeats: timeSignature.beat * timeSignature.measure,
          timeSignature: timeSignature,
          length: this._measureLength,
          tempo: [],
          notes: [],
          dynamics: [],
          chords: [],
          sections: [],
          syllabes: []
        });
      }

      this._measures[0].tempo.push({
        master: true, // Master tempo can't be removed
        beat: 0,
        value: this._bpm
      });
    }

    this._ctx.imageSmoothingEnabled = true;
    this._refreshTab();
  }


  _refreshTab() {
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._ctx.translate(0.5, 0.5); // AA enable
    this._drawHeader();
    this._drawTabMeasures();
    this._drawCursor();
    this._updateSectionList();
    this._ctx.translate(-0.5, -0.5); // AA restore
    // Update local storae value each redraw to store any new data
    window.localStorage.setItem(this._lsName, JSON.stringify({
      info: {
        name: this._name,
        composer: this._composer,
        bpm: this._bpm,
        type: this._type,
        timeSignature: this._timeSignature,
        instrumentType: this._type,
        version: '0.1.6'
      },
      measures: this._measures
    }));
  }


  _drawHeader() {
    this._ctx.fillStyle = this._colors.text;
    this._ctx.font = `bold ${this._fontSize * 3}px sans-serif`;
    // Draw title and composer
    this._ctx.textBaseline = 'middle';
    this._ctx.textAlign = 'center';
    this._ctx.fillText(this._name, this._canvas.width / 2, (this._headerHeight / 2) - (this._fontSize * 1.5));
    this._ctx.font = `bold ${this._fontSize * 2}px sans-serif`;
    this._ctx.fillText(this._composer, this._canvas.width / 2, (this._headerHeight / 2) + (this._fontSize * 2));
    // Draw instrument type
    let instrumentString = '';
    if (this._type === 'Bass') {
      instrumentString = `${this._type}`;
    }
    this._ctx.textAlign = 'right';
    this._ctx.font = `${this._fontSize * 1.5}px sans-serif`;
    this._ctx.fillText(
      `${this._type} Guitar`,
      this._canvas.width,
      (this._lineSpace * 3) + (this._fontSize * 1.5)
    );
    // Restore text alignment
    this._ctx.textAlign = 'left';
  }


  _drawTabMeasures() {
    let lineNumber = 0;
    for (let measureNumber = 0; measureNumber < this._measures.length; ++measureNumber) {
      // Append a new line
      if (measureNumber % this._measurePerLines === 0) {
        this._drawTabLine(lineNumber);
        ++lineNumber;
      }
      // measure count module measure per line to properly position measure in line
      // line number minus 1 for generic use, because j is alway line + 1
      const drawPlaybackCursor = (this._playbackCursor.visible === true && measureNumber === this._playbackCursor.measure);
      this._drawMeasure(this._measures[measureNumber], measureNumber % this._measurePerLines, (lineNumber - 1), drawPlaybackCursor);
    }
  }


  _drawMeasure(measure, measureNumber, lineNumber, drawPlaybackCursor) {
    const yOffset = this._headerHeight + (this._tabLineMargin / 2) + (lineNumber * (this._tabLineHeight + this._tabLineMargin));
    this._ctx.strokeStyle = this._colors.subBar;
    // Compute offset according to line previous measures length
    let measureOffset = 0;
    for (let i = lineNumber * this._measurePerLines; i < lineNumber * this._measurePerLines + measureNumber; ++i) {
      measureOffset += this._measures[i].length;
    }
    // Draw sub beat bars for current measure
    for (let i = 0; i < measure.subBeats; i += measure.timeSignature.beat) {
      // Draw sub beat vertical line
      this._ctx.beginPath();
      this._ctx.moveTo((this._lineSpace * 2) + (i * this._lineSpace) + measureOffset, yOffset);
      this._ctx.lineTo((this._lineSpace * 2) + (i * this._lineSpace) + measureOffset, yOffset + ((this._lineCount - 1) * this._lineSpace));
      this._ctx.stroke();
      this._ctx.closePath();
    }
    // Draw measure end vertical line
    this._ctx.strokeStyle = this._colors.bar;
    this._ctx.lineWidth = 1.5;
    this._ctx.beginPath();
    this._ctx.moveTo((this._lineSpace * 2) + (measure.subBeats * this._lineSpace) + measureOffset, yOffset);
    this._ctx.lineTo((this._lineSpace * 2) + (measure.subBeats * this._lineSpace) + measureOffset, yOffset + ((this._lineCount - 1) * this._lineSpace));
    this._ctx.stroke();
    this._ctx.lineWidth = 1;
    this._ctx.closePath();
    // Draw playback cursor if needed
    if (drawPlaybackCursor) {
      this._ctx.strokeStyle = 'blue';
      this._ctx.lineWidth = 3;
      this._ctx.beginPath();
      this._ctx.moveTo((this._lineSpace * 2) + (this._playbackCursor.beat * this._lineSpace) + measureOffset, yOffset - this._lineSpace);
      this._ctx.lineTo((this._lineSpace * 2) + (this._playbackCursor.beat * this._lineSpace) + measureOffset, yOffset + ((this._lineCount - 1) * this._lineSpace) + this._lineSpace);
      this._ctx.stroke();
      this._ctx.lineWidth = 1;
      this._ctx.strokeStyle = this._colors.bar;
      this._ctx.closePath();
      document.getElementById('tab-container').scrollTo(0, (yOffset / this._resolutionFactor) - (document.getElementById('tab-container').offsetHeight / 2));
    }
    // Draw tempo indication
    for (let i = 0; i < measure.tempo.length; ++i) {
      // BPM indication
      this._quarterNote(
        (this._lineSpace * 2) + (measure.tempo[i].beat * this._lineSpace) + (measureNumber * measure.length),
        yOffset - (this._tabLineMargin / 2) + (36 / 2),
        6,
        36
      );
      this._ctx.font = `${this._fontSize}px sans-serif`;
      this._ctx.fillText(
        `= ${measure.tempo[i].value}`,
        (this._lineSpace * 2) + (measure.tempo[i].beat * this._lineSpace) + (measureNumber * measure.length) + (6 * 2),
        yOffset - (this._tabLineMargin / 2) + (36 / 2)
      );
    }
    // Draw measure notes if any
    if (measure.notes.length > 0) {
      for (let i = 0; i < measure.notes.length; ++i) {
        this._ctx.fillStyle = this._colors.text;
        this._ctx.strokeStyle = this._colors.bar;
        this._ctx.font = `bold ${this._fontSize}px sans-serif`;
        let align = this._fontSize / 3;
        // Note has more than one digit
        if (measure.notes[i].value / 10 >= 1) {
          align = (2 * this._fontSize) / 3;
        }
        // Write the line associated string
        this._ctx.fillText(
          measure.notes[i].value,
          (this._lineSpace * 2) + (measure.notes[i].beat * this._lineSpace) + (measureNumber * measure.length) - align,
          yOffset + ((measure.notes[i].string - 1) * this._lineSpace),
          this._lineSpace,
          this._lineSpace
        );
      }
    }
    // Draw mesure dynamics if any
    if (measure.dynamics.length > 0) {
      this._ctx.font = `bold italic ${this._fontSize * 1.3}px serif`;
      for (let i = 0; i < measure.dynamics.length; ++i) {
        this._ctx.fillText(
          measure.dynamics[i].value,
          (this._lineSpace * 2) + (measure.dynamics[i].beat * this._lineSpace) + (measureNumber * measure.length),
          yOffset + ((this._lineCount - 1) * this._lineSpace) + (this._lineSpace)
        );
      }
      this._ctx.font = `bold ${this._fontSize}px sans-serif`;
    }
    // Draw chords if any
    if (measure.chords.length > 0) {
      this._ctx.font = `italic ${this._fontSize * 1.1}px sans-serif`;
      this._ctx.textAlign = 'center';
      for (let i = 0; i < measure.chords.length; ++i) {
        this._ctx.fillText(
          measure.chords[i].value,
          (this._lineSpace * 2) + (measure.chords[i].beat * this._lineSpace) + (measureNumber * measure.length),
          yOffset - (this._lineSpace / 2)
        );
      }
      this._ctx.textAlign = 'left';
      this._ctx.font = `bold ${this._fontSize}px sans-serif`;
    }
    // Draw sections if any
    if (measure.sections.length > 0) {
      this._ctx.font = `bold ${this._fontSize * 1.6}px sans-serif`;
      for (let i = 0; i < measure.sections.length; ++i) {
        this._ctx.fillText(
          measure.sections[i].value,
          (this._lineSpace * 2) + (measure.sections[i].beat * this._lineSpace) + (measureNumber * measure.length),
          yOffset - ((5 * this._lineSpace) / 3)
        );
      }
      this._ctx.font = `bold ${this._fontSize}px sans-serif`;
    }
    // Draw syllabes if any
    if (measure.syllabes.length > 0) {
      this._ctx.font = `italic ${this._fontSize}px sans-serif`;
      for (let i = 0; i < measure.syllabes.length; ++i) {
        this._ctx.fillText(
          measure.syllabes[i].value,
          (this._lineSpace * 2) + (measure.syllabes[i].beat * this._lineSpace) + (measureNumber * measure.length),
          yOffset + ((this._lineCount - 1) * this._lineSpace) + (this._tabLineMargin / 3)
        );
      }
      this._ctx.font = `bold ${this._fontSize}px sans-serif`;
    }
  }


  _drawTabLine(lineNumber) {
    // The y offset depends on the line number, spaced in top/bottom with 3 lines space
    const yOffset = this._headerHeight + (this._tabLineMargin / 2) + (lineNumber * (this._tabLineHeight + this._tabLineMargin));
    // Compute line length according to line its measures length
    let lineLength = 0;
    for (let i = lineNumber * this._measurePerLines; i < lineNumber * this._measurePerLines + this._measurePerLines; ++i) {
      lineLength += this._measures[i].length;
    }
    // Start line drawing
    this._ctx.beginPath();
    this._ctx.fillStyle = this._colors.text;
    this._ctx.strokeStyle = this._colors.bar;
    this._ctx.font = `${this._fontSize}px sans-serif`;
    // Draw line first vertical bar
    this._ctx.moveTo(this._lineSpace * 2, yOffset);
    this._ctx.lineTo(this._lineSpace * 2, yOffset + ((this._lineCount - 1) * this._lineSpace));
    this._ctx.stroke();
    // Iterate over the amount of string for given instrument type
    for (let i = 0; i < this._lineCount; ++i) {
      // Write the line associated string
      this._ctx.fillText(this._strings[i], 0, yOffset + (i * this._lineSpace));
      // Draw horizontal line
      this._ctx.moveTo((this._lineSpace * 2), yOffset + (i * this._lineSpace));
      this._ctx.lineTo(lineLength + (this._lineSpace * 2), yOffset + (i * this._lineSpace));
      this._ctx.stroke();
    }
    // Draw line final vertical bar
    this._ctx.moveTo(lineLength + (this._lineSpace * 2), yOffset);
    this._ctx.lineTo(lineLength + (this._lineSpace * 2), yOffset + ((this._lineCount - 1) * this._lineSpace));
    this._ctx.fillText((this._measurePerLines * lineNumber) + 1, 0, yOffset - (this._fontSize * 2));
    this._ctx.stroke();
    // End line drawing
    this._ctx.closePath();
  }


  // Note utils


  _updateNote(value) {
    const note = {
      beat: this._cursor.beat,
      string: this._cursor.string,
      value: value
    };

    let exists = false;
    let existingIndex = -1;
    for (let i = 0; i < this._measures[this._cursor.measure].notes.length; ++i) {
      const savedNote = this._measures[this._cursor.measure].notes[i];
      if (JSON.stringify(savedNote) === JSON.stringify(note)) { // Note already saved
        exists = true;
      } else if (savedNote.value !== note.value && savedNote.beat === note.beat && savedNote.string === note.string) {
        existingIndex = i;
      }
    }

    if (existingIndex !== -1) { // Replace existing note if already exists
      this._measures[this._cursor.measure].notes[existingIndex] = note;
    } else if (!exists) { // Create note if no matching note were found in measure
      this._measures[this._cursor.measure].notes.push(note);
    }

    this._refreshTab();
  }


  _updateSymbol(value) {
    this._toggleClickedClass(`${value}-modifier`);
    this._updateNote(value);
    this._refreshTab();
  }


  _removeNote() {
    for (let i = 0; i < this._measures[this._cursor.measure].notes.length; ++i) {
      const savedNote = this._measures[this._cursor.measure].notes[i];
      if (savedNote.beat === this._cursor.beat && savedNote.string === this._cursor.string) {
        this._measures[this._cursor.measure].notes.splice(i, 1);
        this._refreshTab();
        break;
      }
    }
  }


  // Keyboard utils


  _isInputFocused() {
    const inputActive = [
      document.getElementById('chord'),
      document.getElementById('section'),
      document.getElementById('syllabe'),
      document.getElementById('tempo'),
      document.getElementById('time-signature')
    ];

    if (inputActive.indexOf(document.activeElement) !== -1) {
      return true;
    }

    return false;
  }


  _keyboardClicked(event) {
    if (!this._isInputFocused()) {
      if (!isNaN(parseInt(event.key)) && typeof parseInt(event.key) === 'number') {
        if (this._keyEventTimeoutId !== null) {
          this._keyValue += event.key;
        } else {
          this._keyValue = event.key;

          this._keyEventTimeoutId = setTimeout(() => {
            clearTimeout(this._keyEventTimeoutId);
            this._keyEventTimeoutId = null;
            if (parseInt(this._keyValue) <= 24) {
              this._updateNote(parseInt(this._keyValue));
            }
            // Restore key value for next stroke
            this._keyValue = '';
          }, 200);
        }
      } else if (this._symbols.indexOf(event.key) !== -1) {
        event.preventDefault();
        this._updateSymbol(event.key);
      } else if (event.key === 'Delete') {
        this._removeNote();
      }
    }
  }


  // Cursor Utils


  _moveCursorLeft(withCtrl, noRefresh = false) {
    if (!this._isInputFocused()) {
      this._toggleClickedClass('arrow-left');
      this._toggleClickedClass('q-left');
      let ctrlModifier = 1;
      if (withCtrl === true) {
        ctrlModifier = (this._measures[this._cursor.measure].timeSignature.beat * this._measures[this._cursor.measure].timeSignature.measure);
      }

      if (this._cursor.x - this._lineSpace - (this._lineSpace * ctrlModifier) > 0) {
        // First decrement the measure count
        if (this._cursor.beat === 0) {
          --this._cursor.measure;
          // Then update the beat number
          if (ctrlModifier === 1) {
            this._cursor.x -= this._lineSpace;
            this._cursor.beat = (this._measures[this._cursor.measure].timeSignature.beat * this._measures[this._cursor.measure].timeSignature.measure) - 1;
          } else {
            this._cursor.x -= (this._lineSpace * (this._measures[this._cursor.measure].timeSignature.beat * this._measures[this._cursor.measure].timeSignature.measure));
            this._cursor.beat = 0;
          }
        } else {
          if (ctrlModifier === 1) {
            this._cursor.x -= this._lineSpace;
            --this._cursor.beat;
          } else {
            this._cursor.x -= (this._lineSpace * this._cursor.beat);
            this._cursor.beat = 0;
          }
        }
      } else if (this._cursor.line !== 0) { // New line for cursor
        --this._cursor.measure;
        --this._cursor.line;

        // Compute offset according to line previous measures length
        let lineLength = 0;
        for (let i = this._cursor.line * this._measurePerLines; i < this._cursor.line * this._measurePerLines + this._measurePerLines; ++i) {
          lineLength += this._measures[i].length;
        }

        if (ctrlModifier === 1) {
          this._cursor.beat = (this._timeSignature.beat * this._timeSignature.measure) - 1;
          this._cursor.x = lineLength + this._lineSpace - (this._lineSpace / 2);
        } else {
          this._cursor.beat = 0;
          this._cursor.x = lineLength + this._lineSpace - (this._lineSpace * ((this._timeSignature.beat * this._timeSignature.measure) - 1)) - (this._lineSpace / 2);
        }

        this._cursor.y -= this._tabLineHeight + this._tabLineMargin;
        // Update container scroll according to cursor position
        document.getElementById('tab-container').scrollTo(0, (this._cursor.y / this._resolutionFactor) - (document.getElementById('tab-container').offsetHeight / 2));
      }

      if (!noRefresh) {
        this._refreshTab();
      }
    }
  }


  _moveCursorRight(withCtrl, noRefresh = false) {
    if (!this._isInputFocused()) {
      this._toggleClickedClass('arrow-right');
      this._toggleClickedClass('d-right');
      let ctrlModifier = 1;
      if (withCtrl === true) {
        ctrlModifier = (this._measures[this._cursor.measure].timeSignature.beat * this._measures[this._cursor.measure].timeSignature.measure);
      }

      // Compute offset according to line previous measures length
      let lineLength = 0;
      for (let i = this._cursor.line * this._measurePerLines; i < this._cursor.line * this._measurePerLines + this._measurePerLines; ++i) {
        lineLength += this._measures[i].length;
      }

      if (this._cursor.x + (this._lineSpace * ctrlModifier) <= (lineLength   + (this._lineSpace / 2))) {
        // Cursor is on last subbeat of measure
        if (this._cursor.beat === this._measures[this._cursor.measure].subBeats - 1) {
          this._cursor.x += this._lineSpace;
          ++this._cursor.measure;
          this._cursor.beat = 0;
        } else {
          if (ctrlModifier === 1) {
            this._cursor.x += this._lineSpace;
            ++this._cursor.beat;
          } else {
            this._cursor.x += (this._lineSpace * (this._measures[this._cursor.measure].subBeats - this._cursor.beat));
            ++this._cursor.measure;
            this._cursor.beat = 0;
          }
        }
      } else { // New line for cursor
        ++this._cursor.measure;
        this._cursor.beat = 0;
        ++this._cursor.line;
        // Move cursor on the next line
        this._cursor.x = this._lineSpace + (this._lineSpace / 2);
        this._cursor.y += this._tabLineHeight + this._tabLineMargin;
        // Update container scroll according to cursor position
        document.getElementById('tab-container').scrollTo(0, (this._cursor.y / this._resolutionFactor) - (document.getElementById('tab-container').offsetHeight / 2));
        // Determine wether we should add the measures to fill new line
        if (this._measures.length <= this._measurePerLines * this._cursor.line) {
          // Resize canvas height to fit new line
          this._canvas.height += this._tabLineHeight + this._tabLineMargin;
          this._canvas.style.height = `${parseInt(this._canvas.style.height.slice(0, -2)) + ((this._tabLineHeight + this._tabLineMargin) / this._resolutionFactor)}px`;
          // Scroll to canvas bottom
          document.getElementById('tab-container').scrollTo(0, document.getElementById('tab-container').scrollHeight);
          // Append measures for new line
          for (let i = 0; i < this._measurePerLines; ++i) {
            const timeSignature = Object.assign({}, this._timeSignature);
            timeSignature.measureNumber = (this._cursor.line * this._measurePerLines) + i;
            // Then create the first measure, its index refer to its position
            this._measures.push({
              subBeats: timeSignature.beat * timeSignature.measure,
              timeSignature: timeSignature,
              length: (timeSignature.beat * timeSignature.measure) * this._lineSpace,
              tempo: [],
              notes: [],
              dynamics: [],
              chords: [],
              sections: [],
              syllabes: []
            });
          }
        }
      }

      if (!noRefresh) {
        this._refreshTab();
      }
    }
  }


  _moveCursorUp() {
    if (!this._isInputFocused()) {
      this._toggleClickedClass('arrow-up');
      this._toggleClickedClass('z-up');
      const yOffset = this._headerHeight + (this._tabLineMargin / 2) + (this._cursor.line * (this._tabLineHeight + this._tabLineMargin)) - this._lineSpace;
      if (this._cursor.y - this._lineSpace > yOffset) {
        this._cursor.y -= this._lineSpace;
        --this._cursor.string;
      }

      this._refreshTab();
    }
  }


  _moveCursorDown() {
    if (!this._isInputFocused()) {
      this._toggleClickedClass('arrow-down');
      this._toggleClickedClass('s-down');
      const yOffset = this._headerHeight + (this._tabLineMargin / 2) + (this._cursor.line * (this._tabLineHeight + this._tabLineMargin)) + (this._lineCount - 1) * this._lineSpace;
      if (this._cursor.y + this._lineSpace < yOffset) {
        this._cursor.y += this._lineSpace;
        ++this._cursor.string;
      }

      this._refreshTab();
    }
  }


  _drawCursor() {
    this._ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    this._roundRect(this._cursor.x, this._cursor.y, this._lineSpace, this._lineSpace, 3);
    this._ctx.fill();
    // Update UI feedback for tab info
    const measure = this._cursor.measure + 1;
    const beat = Math.floor(this._cursor.beat / this._measures[this._cursor.measure].timeSignature.beat) + 1;
    const subBeat = (this._cursor.beat % this._measures[this._cursor.measure].timeSignature.beat) + 1;
    document.getElementById('cursor-position').innerHTML = `Measure ${measure}, Beat ${beat}/${subBeat}`;
    // Update UI feedback for existing chord on current beat
    document.getElementById('chord').value = '';
    for (let i = 0; i < this._measures[this._cursor.measure].chords.length; ++i) {
      const savedChord = this._measures[this._cursor.measure].chords[i];
      if (savedChord.beat === this._cursor.beat) {
        document.getElementById('chord').value = savedChord.value;
      }
    }
    // Update UI feedback for existing section on current beat
    document.getElementById('section').value = '';
    for (let i = 0; i < this._measures[this._cursor.measure].sections.length; ++i) {
      const savedSection = this._measures[this._cursor.measure].sections[i];
      if (savedSection.beat === this._cursor.beat) {
        document.getElementById('section').value = savedSection.value;
      }
    }
    // Update UI feedback for existing syllabe on current beat
    document.getElementById('syllabe').value = '';
    for (let i = 0; i < this._measures[this._cursor.measure].syllabes.length; ++i) {
      const savedSyllabe = this._measures[this._cursor.measure].syllabes[i];
      if (savedSyllabe.beat === this._cursor.beat) {
        document.getElementById('syllabe').value = savedSyllabe.value;
      }
    }
    // Update UI feedback for existing tempo on current beat
    document.getElementById('tempo').value = '';
    for (let i = 0; i < this._measures[this._cursor.measure].tempo.length; ++i) {
      const savedTempo = this._measures[this._cursor.measure].tempo[i];
      if (savedTempo.beat === this._cursor.beat) {
        document.getElementById('tempo').value = savedTempo.value;
      }
    }
    // Update UI feedback for existing time signature on current beat
    document.getElementById('time-signature').value = '';
    const savedTimeSignature = this._measures[this._cursor.measure].timeSignature;
    if (savedTimeSignature.measureNumber === this._cursor.measure) {
      document.getElementById('time-signature').value = savedTimeSignature.string;
    }
  }


  // UI Utils


  _dynamicClicked(event) {
    if (!this._isInputFocused()) {
      if (event.currentTarget.dataset.value === 'x') {
        if (this._measures[this._cursor.measure].dynamics.length > 0) {
          for (let i = 0; i < this._measures[this._cursor.measure].dynamics.length; ++i) {
            if (this._measures[this._cursor.measure].dynamics[i].beat === this._cursor.beat) {
              this._measures[this._cursor.measure].dynamics.splice(i, 1);
              this._refreshTab();
              break;
            }
          }
        }

        return;
      }

      const dynamic = {
        beat: this._cursor.beat,
        value: event.target.dataset.value
      };

      let exists = false;
      let existingIndex = -1;
      for (let i = 0; i < this._measures[this._cursor.measure].dynamics.length; ++i) {
        const savedDynamics = this._measures[this._cursor.measure].dynamics[i];
        if (JSON.stringify(savedDynamics) === JSON.stringify(dynamic)) { // Note already saved
          exists = true;
        } else if (savedDynamics.value !== dynamic.value && savedDynamics.beat === dynamic.beat) {
          existingIndex = i;
        }
      }

      if (existingIndex !== -1) { // Replace existing note if already exists
        this._measures[this._cursor.measure].dynamics[existingIndex] = dynamic;
      } else if (!exists) { // Create note if no matching note were found in measure
        this._measures[this._cursor.measure].dynamics.push(dynamic);
      }

      this._refreshTab();
    }
  }


  _addChord() {
    const chordValue = document.getElementById('chord').value;
    if (chordValue !== '') {
      const chord = {
        beat: this._cursor.beat,
        value: chordValue
      };

      let exists = false;
      let existingIndex = -1;
      for (let i = 0; i < this._measures[this._cursor.measure].chords.length; ++i) {
        const savedChord = this._measures[this._cursor.measure].chords[i];
        if (JSON.stringify(savedChord) === JSON.stringify(chord)) { // Note already saved
          exists = true;
        } else if (savedChord.value !== chord.value && savedChord.beat === chord.beat) {
          existingIndex = i;
        }
      }

      if (existingIndex !== -1) { // Replace existing note if already exists
        this._measures[this._cursor.measure].chords[existingIndex] = chord;
      } else if (!exists) { // Create note if no matching note were found in measure
        this._measures[this._cursor.measure].chords.push(chord);
      }

      this._refreshTab();
    }
  }


  _removeChord() {
    for (let i = 0; i < this._measures[this._cursor.measure].chords.length; ++i) {
      if (this._measures[this._cursor.measure].chords[i].beat === this._cursor.beat) {
        this._measures[this._cursor.measure].chords.splice(i, 1);
        this._refreshTab();
        break;
      }
    }
  }


  _addSection() {
    const sectionValue = document.getElementById('section').value;
    if (sectionValue !== '') {
      const section = {
        beat: this._cursor.beat,
        value: sectionValue
      };

      let exists = false;
      let existingIndex = -1;
      for (let i = 0; i < this._measures[this._cursor.measure].sections.length; ++i) {
        const savedSection = this._measures[this._cursor.measure].sections[i];
        if (JSON.stringify(savedSection) === JSON.stringify(section)) { // Section already saved
          exists = true;
        } else if (savedSection.value !== section.value && savedSection.beat === section.beat) {
          existingIndex = i;
        }
      }

      if (existingIndex !== -1) { // Replace existing note if already exists
        this._measures[this._cursor.measure].sections[existingIndex] = section;
      } else if (!exists) { // Create note if no matching note were found in measure
        this._measures[this._cursor.measure].sections.push(section);
      }

      this._refreshTab();
    }
  }


  _removeSection() {
    for (let i = 0; i < this._measures[this._cursor.measure].sections.length; ++i) {
      if (this._measures[this._cursor.measure].sections[i].beat === this._cursor.beat) {
        this._measures[this._cursor.measure].sections.splice(i, 1);
        this._refreshTab();
        break;
      }
    }
  }


  _pasteSection(event) {
    const startSection = this._measures[parseInt(event.target.dataset.measure)].sections[parseInt(event.target.dataset.section)];
    let endSectionMeasureIndex = -1;
    let endSectionBeat = -1;
    let measuresToCopy = 0;
    // Find next section or tab ending
    for (let i = parseInt(event.target.dataset.measure); i < this._measures.length; ++i) {
      let iteratorInit = 0;
      if (this._measures[i].sections.length > 1) {
        // Cheching if start section is in studied measure
        for (let j = 0; j < this._measures[i].sections.length; ++j) {
          if (this._measures[i].sections[j] === startSection) {
            iteratorInit = j + 1;
            break;
          }
        }
      }
      //
      for (let j = iteratorInit; j < this._measures[i].sections.length; ++j) {
        if (this._measures[i].sections[j] !== startSection) {
          endSectionMeasureIndex = i;
          endSectionBeat = this._measures[i].sections[j].beat;
          ++measuresToCopy;
          break;
        }
      }
      // If we found a match, we stop loop
      if (endSectionMeasureIndex !== -1) {
        break;
      } else if (i >= this._cursor.measure) {
        endSectionMeasureIndex = this._cursor.measure;
        endSectionBeat = this._measures[this._cursor.measure].subBeats;
        break;
      } else {
        ++measuresToCopy;
      }
    }

    if (endSectionMeasureIndex === -1) {
      endSectionMeasureIndex = this._measures.length;
      endSectionBeat = timeSignature.beat * timeSignature.measure;
    }
    // Next section is in the same measure
    if (measuresToCopy === 0) {
      // Clear target measure beat that contains item in interval
      const clearValues = key => {
        if (this._measures[this._cursor.measure][key].length > 0) {
          const items = this._measures[this._cursor.measure][key];
          for (let i = items.length - 1; i >= 0; --i) {
            if (items[i].beat >= startSection.beat && items[i].beat < endSectionBeat) {
              items.splice(i, 1);
            }
          }
        }
      };

      const copyValues = (items, key) => {
        clearValues(key);
        for (let i = 0; i < items.length; ++i) {
          if (items[i].beat >= startSection.beat && items[i].beat < endSectionBeat) {
            this._measures[this._cursor.measure][key].push(items[i]);
          }
        }
      };
      // Update target measure
      const sourceMeasure = this._measures[parseInt(event.target.dataset.measure)];
      copyValues(sourceMeasure.chords, 'chords');
      copyValues(sourceMeasure.dynamics, 'dynamics');
      copyValues(sourceMeasure.notes, 'notes');
      copyValues(sourceMeasure.syllabes, 'syllabes');
    } else {
      // Clear target measure beat that contains item in interval
      const clearValues = (key, start, end, measure) => {
        if (measure[key].length > 0) {
          const items = measure[key];
          for (let i = items.length - 1; i >= 0; --i) {
            if (items[i].beat >= start && items[i].beat < end) {
              items.splice(i, 1);
            }
          }
        }
      };

      const copyValues = (items, key, start, end, measure) => {
        clearValues(key, start, end, measure);
        for (let i = 0; i < items.length; ++i) {
          if (items[i].beat >= start && items[i].beat < end) {
            measure[key].push(items[i]);
          }
        }
      };
      // Update target measures
      // First we update with the measure that contains the section start
      let sourceMeasure = this._measures[parseInt(event.target.dataset.measure)];
      copyValues(sourceMeasure.chords, 'chords', startSection.beat, sourceMeasure.length, this._measures[this._cursor.measure]);
      copyValues(sourceMeasure.dynamics, 'dynamics', startSection.beat, sourceMeasure.length, this._measures[this._cursor.measure]);
      copyValues(sourceMeasure.notes, 'notes', startSection.beat, sourceMeasure.length, this._measures[this._cursor.measure]);
      copyValues(sourceMeasure.syllabes, 'syllabes', startSection.beat, sourceMeasure.length, this._measures[this._cursor.measure]);
      // Then we iterate the following measures until we reach the endSectionMeasureIndex
      for (let i = this._cursor.measure; i < this._cursor.measure + measuresToCopy; ++i) {
        let sourceMeasure = this._measures[parseInt(event.target.dataset.measure) + (i - this._cursor.measure)];
        if (!this._measures[i]) {
          // Add one line of measures
          const index = this._measures.length;
          for (let j = 0; j < this._measurePerLines; ++j) {
            const timeSignature = Object.assign({}, this._timeSignature);
            timeSignature.measureNumber = index + j;
            // Then create the first measure, its index refer to its position
            this._measures.push({
              subBeats: timeSignature.beat * timeSignature.measure,
              timeSignature: timeSignature,
              length: this._measureLength,
              tempo: [],
              notes: [],
              dynamics: [],
              chords: [],
              sections: [],
              syllabes: []
            });
          }
          this._canvas.height += this._tabLineHeight + this._tabLineMargin;
          this._canvas.style.height = `${parseInt(this._canvas.style.height.slice(0, -2)) + ((this._tabLineHeight + this._tabLineMargin) / this._resolutionFactor)}px`;
        }
        let length = sourceMeasure.length;
        if (i + 1 === this._cursor.measure + measuresToCopy) {
          length = endSectionBeat;
        }

        copyValues(sourceMeasure.chords, 'chords', 0, length, this._measures[i]);
        copyValues(sourceMeasure.dynamics, 'dynamics', 0, length, this._measures[i]);
        copyValues(sourceMeasure.notes, 'notes', 0, length, this._measures[i]);
        copyValues(sourceMeasure.syllabes, 'syllabes', 0, length, this._measures[i]);
      }
      // Finally, we update the last measure before next section
      sourceMeasure = this._measures[parseInt(event.target.dataset.measure) + endSectionMeasureIndex];
      copyValues(sourceMeasure.chords, 'chords', startSection.beat, endSectionBeat, this._measures[this._cursor.measure + measuresToCopy]);
      copyValues(sourceMeasure.dynamics, 'dynamics', startSection.beat, endSectionBeat, this._measures[this._cursor.measure + measuresToCopy]);
      copyValues(sourceMeasure.notes, 'notes', startSection.beat, endSectionBeat, this._measures[this._cursor.measure + measuresToCopy]);
      copyValues(sourceMeasure.syllabes, 'syllabes', startSection.beat, endSectionBeat, this._measures[this._cursor.measure + measuresToCopy]);
    }

    this._refreshTab();
  }


  _jumpToSection(event) {
    if (this._cursor.measure < parseInt(event.target.dataset.measure)) {
      for (let i = this._cursor.measure; i < parseInt(event.target.dataset.measure); ++i) {
        this._moveCursorRight(true, true);
      }
    } else if (this._cursor.measure > parseInt(event.target.dataset.measure)) {
      const length = this._cursor.measure;
      for (let i = parseInt(event.target.dataset.measure); i < length; ++i) {
        this._moveCursorLeft(true, true);
      }
    }

    this._refreshTab();
  }


  _updateSectionList() {
    document.getElementById('sections-list').innerHTML = '';
    for (let i = 0; i < this._measures.length; ++i) {
      const sections = this._measures[i].sections;
      if (sections.length > 0) {
        for (let j = 0; j < sections.length; ++j) {
          const section = document.createElement('DIV');
          section.classList.add('section');

          const sectioName = document.createElement('P');
          sectioName.innerHTML = sections[j].value;

          const jumpToSection = document.createElement('IMG');
          jumpToSection.src = './img/target.svg';
          jumpToSection.dataset.measure = i;

          const pasteSection = document.createElement('IMG');
          pasteSection.src = './img/paste.svg';
          pasteSection.dataset.measure = i;
          pasteSection.dataset.section = j;

          section.appendChild(sectioName);
          section.appendChild(jumpToSection);
          section.appendChild(pasteSection);
          document.getElementById('sections-list').appendChild(section);

          this._evtIds.push(Events.addEvent('click', pasteSection, this._pasteSection, this));
          this._evtIds.push(Events.addEvent('click', jumpToSection, this._jumpToSection, this));
        }
      }
    }
  }


  _addSyllabe() {
    const syllabeValue = document.getElementById('syllabe').value;
    if (syllabeValue !== '') {
      const syllabe = {
        beat: this._cursor.beat,
        value: syllabeValue
      };

      let exists = false;
      let existingIndex = -1;
      for (let i = 0; i < this._measures[this._cursor.measure].syllabes.length; ++i) {
        const savedSyllabe = this._measures[this._cursor.measure].syllabes[i];
        if (JSON.stringify(savedSyllabe) === JSON.stringify(syllabe)) { // Note already saved
          exists = true;
        } else if (savedSyllabe.value !== syllabe.value && savedSyllabe.beat === syllabe.beat) {
          existingIndex = i;
        }
      }

      if (existingIndex !== -1) { // Replace existing note if already exists
        this._measures[this._cursor.measure].syllabes[existingIndex] = syllabe;
      } else if (!exists) { // Create note if no matching note were found in measure
        this._measures[this._cursor.measure].syllabes.push(syllabe);
      }

      this._refreshTab();
    }
  }


  _removeSyllabe() {
    for (let i = 0; i < this._measures[this._cursor.measure].syllabes.length; ++i) {
      if (this._measures[this._cursor.measure].syllabes[i].beat === this._cursor.beat) {
        this._measures[this._cursor.measure].syllabes.splice(i, 1);
        this._refreshTab();
        break;
      }
    }
  }


  _addTempo() {
    const tempoValue = document.getElementById('tempo').value;
    if (tempoValue !== '') {
      const tempo = {
        master: false,
        beat: this._cursor.beat,
        value: tempoValue
      };

      let exists = false;
      let existingIndex = -1;
      for (let i = 0; i < this._measures[this._cursor.measure].tempo.length; ++i) {
        const savedTempo = this._measures[this._cursor.measure].tempo[i];
        if (JSON.stringify(savedTempo) === JSON.stringify(tempo)) { // Note already saved
          exists = true;
        } else if (savedTempo.value !== tempo.value && savedTempo.beat === tempo.beat) {
          existingIndex = i;
        }
      }

      if (existingIndex !== -1) { // Replace existing note if already exists
        this._measures[this._cursor.measure].tempo[existingIndex] = tempo;
      } else if (!exists) { // Create note if no matching note were found in measure
        this._measures[this._cursor.measure].tempo.push(tempo);
      }

      this._refreshTab();
    }
  }


  _removeTempo() {
    for (let i = 0; i < this._measures[this._cursor.measure].tempo.length; ++i) {
      if (this._measures[this._cursor.measure].tempo[i].master === false && this._measures[this._cursor.measure].tempo[i].beat === this._cursor.beat) {
        this._measures[this._cursor.measure].tempo.splice(i, 1);
        this._refreshTab();
        break;
      }
    }
  }


  _addTimeSignature() {
    const timeSignatureValue = document.getElementById('time-signature').value;
    if (timeSignatureValue !== '') {
      const timeSignature = {
        master: false,
        beat: parseInt(timeSignatureValue.split('/')[1]),
        measure: parseInt(timeSignatureValue.split('/')[0]),
        string: timeSignatureValue,
        measureNumber: this._cursor.measure
      };

      const savedTimeSignature = this._measures[this._cursor.measure].timeSignature;
      if (JSON.stringify(savedTimeSignature) !== JSON.stringify(timeSignature)) {
        this._measures[this._cursor.measure].timeSignature = timeSignature;
        this._measures[this._cursor.measure].subBeats = timeSignature.beat * timeSignature.measure;
        this._measures[this._cursor.measure].length = (timeSignature.beat * timeSignature.measure) * this._lineSpace;
      }

      this._refreshTab();
    }
  }


  _removeTimeSignature() {
    if (this._measures[this._cursor.measure].timeSignature.master === false) {
      this._measures[this._cursor.measure].timeSignature = this._timeSignature;
      this._refreshTab();
    }
  }



  _toggleClickedClass(id) {
    document.getElementById(id).classList.add('clicked');
    setTimeout(() => {
      document.getElementById(id).classList.remove('clicked');
    }, 200);
  }


  // Exporting


  _downloadAsPDF() {
    // Store cursor x pos
    const xPos = this._cursor.x;
    this._cursor.x = -9000;
    this._refreshTab();

    var imgData = this._canvas.toDataURL('image/png');
    var pdf = new jsPDF('p', 'mm', 'a4', true);
    var position = 0;

    var imgWidth = 200;
    var pageHeight = 297;
    var imgHeight = this._canvas.height * imgWidth / this._canvas.width;
    var heightLeft = imgHeight;

    pdf.addImage(imgData, 'PNG', 5, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 5, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    pdf.save(`${this._composer} - ${this._name}.pdf`);

    // Restore cursor x pos
    this._cursor.x = xPos;
    this._refreshTab();
  }


  _exportProject() {
    // Force saving of tab
    this._refreshTab();
    // Extract info from local storage
    const lsValue = JSON.parse(window.localStorage.getItem(this._lsName));
    const filename = `${lsValue.info.composer}-${lsValue.info.name}.json`;
    const jsonStr = JSON.stringify(lsValue, null, 2);
    const element = document.createElement('A');
    // Link attributes to store output
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(jsonStr)}`);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    // Downloading part
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }


  // Playback utils


  _togglePlayback() {
    if (!this._playback.isPlaying) {
      document.getElementById('toggle-playback').src = './img/stop.svg';
      // Update playback cursor position
      this._playbackCursor.visible = true;
      this._playbackCursor.measure = this._cursor.measure;
      this._playbackCursor.beat = 0; // Playback always start at the begining of the measure
      document.getElementById('playback-type').disabled = true;
      // Find applied BPM value (reverse parse measure from cursor to first matching measure with a tempo)
      let tempo = 0;
      for (let i = this._cursor.measure; i >= 0; --i) {
        for (let j = 0; j < this._measures[i].tempo.length; ++i) {
          if (tempo !== this._measures[i].tempo[j].value) {
            tempo = this._measures[i].tempo[j].value;
            break;
          }
        }
        // Stoping measure loop as a BP¨m not equal to master's one was found
        if (tempo !== 0) {
          break;
        }
      }
      // Fallback on master BPM if no other BPM was found
      if (tempo === 0) {
        tempo = this._bpm;
      }
      // Launch playback
      this._playback.startPlayback({
        type: this._type,
        strings: this._strings,
        bpm: tempo,
        click: this._withClick,
        instrument: document.getElementById('playback-type').value,
        symbols: this._symbols
      }, this._measures, this._cursor, (index, beat, hasEnded) => {
        if (!hasEnded) {
          this._playbackCursor.measure = index;
          this._playbackCursor.beat = beat;
          requestAnimationFrame(this._refreshTab.bind(this));
        } else {
          document.getElementById('toggle-playback').src = './img/play.svg';
          document.getElementById('playback-type').disabled = false;
          this._playbackCursor.visible = false;
          this._refreshTab();
        }
      });
    } else {
      document.getElementById('toggle-playback').src = './img/play.svg';
      document.getElementById('playback-type').disabled = false;
      this._playbackCursor.visible = false;
      this._playback.stopPlayback();
      this._refreshTab();
    }
  }


  _toggleClick() {
    if (this._withClick === false) {
      this._withClick = true;
    } else {
      this._withClick = false;
    }
  }


  _spacePressed() {
    if (!this._isInputFocused()) {
      this._togglePlayback();
    }
  }


  // Canvas utils


  _roundRect(x, y, width, height, radius) {
    // MVP -> https://stackoverflow.com/a/3368118
    if (typeof radius === 'undefined') {
      radius = 5;
    }

    if (typeof radius === 'number') {
      radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else {
      const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
      for (let side in defaultRadius) {
        radius[side] = radius[side] || defaultRadius[side];
      }
    }

    this._ctx.beginPath();
    this._ctx.moveTo(x + radius.tl, y);
    this._ctx.lineTo(x + width - radius.tr, y);
    this._ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    this._ctx.lineTo(x + width, y + height - radius.br);
    this._ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    this._ctx.lineTo(x + radius.bl, y + height);
    this._ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    this._ctx.lineTo(x, y + radius.tl);
    this._ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    this._ctx.closePath();
  }


  _quarterNote(x, y, width, height) {
    // Draw quarter note ellipse
    this._ctx.beginPath();
    this._ctx.ellipse(x, y, width, (width * 1.4), 60 * Math.PI / 180, 0, 2 * Math.PI);
    this._ctx.fill();
    this._ctx.closePath();
    // Draw quarter note tail
    this._ctx.beginPath();
    this._ctx.lineWidth = width / 3;
    this._ctx.moveTo(x + (width * 1.15), y - (width / 2));
    this._ctx.lineTo(x + (width * 1.15), y - height);
    this._ctx.stroke();
    this._ctx.closePath();
    // Restore line width for further drawings
    this._ctx.lineWidth = 1;
  }


}


export default TabMaker;
