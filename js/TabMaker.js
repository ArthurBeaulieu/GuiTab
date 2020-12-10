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
				beat: parseInt(options.timeSignature.split('/')[0]),
				measure: parseInt(options.timeSignature.split('/')[1]),
				string: options.timeSignature
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
		// Tab header
		this._headerHeight = 200;
		// Tab canvas utils
		this._lineSpace = 12;
		this._tabLineHeight = 0;
		this._tabLineMargin = this._lineSpace * 8;
		this._fontSize = 10;
		this._lineLength = 0;
		this._measureLength = 0;
		this._measurePerLines = 0;
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

		this._evtIds = [];

		//1.41428571429

		this._init();
		this._events();
	}


	destroy() {
		// Remove all shortcuts
		Shortcut.removeAll();
		// Remove all standard events
		for (let i = 0; i < this._evtIds.length; ++i) {
			Events.addEvent(this._evtIds[i]);
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
		while (this._lineLength <= (984 - (2 * this._lineSpace) - this._measureLength)) {
			++this._measurePerLines;
			this._lineLength += this._measureLength;
		}

		if (this._type === 'Bass') {
			this._lineCount = 4;
			this._strings = ['G', 'D', 'A', 'E'];
		}

		this._tabLineHeight = ((this._lineCount - 1) * this._lineSpace);

		// Init canvas dimension with one line
		this._canvas.height = this._headerHeight + this._tabLineHeight + this._tabLineMargin;
		this._canvas.width = this._lineLength + (3 * this._lineSpace);
		// Save in local storage the new project
		if (this._lsName === '') {
			this._lsName = `tab-${this._name}-${this._composer}-${Date.now()}`;
			window.localStorage.setItem(this._lsName, '');
		} else {
			// Update canvas, height according to the number of measures
			for (let i = this._measurePerLines; i < this._measures.length; i += this._measurePerLines) {
				this._canvas.height += this._tabLineHeight + this._tabLineMargin;
			}
		}

		this._initTab();
	}


	_events() {
		// Save/Download events
		this._evtIds.push(Events.addEvent('click', document.getElementById('save-project'), this._refreshTab, this));
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
		// Dynamic events
		const dynamicIcons = document.getElementById('dynamic-icons');
		for (let i= 0; i < dynamicIcons.children.length; ++i) {
			this._evtIds.push(Events.addEvent('click', dynamicIcons.children[i], this._dynamicClicked, this));
		}
		// Chord events
		this._evtIds.push(Events.addEvent('click', document.getElementById('add-chord'), this._addChord, this));
		this._evtIds.push(Events.addEvent('click', document.getElementById('remove-chord'), this._removeChord, this));
		// Annotation events
		this._evtIds.push(Events.addEvent('click', document.getElementById('add-annotation'), this._addAnnotation, this));
		this._evtIds.push(Events.addEvent('click', document.getElementById('remove-annotation'), this._removeAnnotation, this));
		// Syllabe events
		this._evtIds.push(Events.addEvent('click', document.getElementById('add-syllabe'), this._addSyllabe, this));
		this._evtIds.push(Events.addEvent('click', document.getElementById('remove-syllabe'), this._removeSyllabe, this));
		// Local keayboard event
		this._evtIds.push(Events.addEvent('keydown', document, this._keyboardClicked, this));
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
				// Then create the first measure, its index refer to its position
				this._measures.push({
					subBeats: this._timeSignature.beat * this._timeSignature.measure,
					timeSignature: this._timeSignature, // As it can be modified for any measure, we store the default value
					length: this._measureLength,
					tempo: [],
					notes: [],
					dynamics: [],
					chords: [],
					annotations: [],
					syllabes: []
				});
			}

			this._measures[0].tempo.push({
				beat: 0,
				value: this._bpm
			});
		}

		this._refreshTab();
	}


	_refreshTab() {
		this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
		this._ctx.translate(0.5, 0.5); // AA enable
		this._drawHeader();
		this._drawTabMeasures();
		this._drawCursor();
		this._ctx.translate(-0.5, -0.5); // AA restore
		// Update local storae value each redraw to store any new data
		window.localStorage.setItem(this._lsName, JSON.stringify({
			info: {
				name: this._name,
				composer: this._composer,
				bpm: this._bpm,
				type: this._type,
				timeSignature: this._timeSignature,
				instrumentType: this._type
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
		this._ctx.textAlign = 'right';
		this._ctx.font = `${this._fontSize * 1.5}px sans-serif`;
		this._ctx.fillText(
			`${this._type}`,
			this._canvas.width - (this._lineSpace * 3),
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
			this._drawMeasure(this._measures[measureNumber], measureNumber % this._measurePerLines, (lineNumber - 1));
		}
	}


	_drawMeasure(measure, measureNumber, lineNumber) {
		const yOffset = this._headerHeight + (this._tabLineMargin / 2) + (lineNumber * (this._tabLineHeight + this._tabLineMargin));
		this._ctx.strokeStyle = this._colors.subBar;
		for (let i = 0; i < measure.subBeats; i += measure.timeSignature.measure) {
			// Draw sub beat horizontal line
			this._ctx.beginPath();
			this._ctx.moveTo((this._lineSpace * 2) + (i * this._lineSpace) + (measureNumber * measure.length), yOffset);
			this._ctx.lineTo((this._lineSpace * 2) + (i * this._lineSpace) + (measureNumber * measure.length), yOffset + ((this._lineCount - 1) * this._lineSpace));
			this._ctx.stroke();
			this._ctx.closePath();
		}
		// Draw measure end horizontal line
		this._ctx.strokeStyle = this._colors.bar;
		this._ctx.lineWidth = 1.5;
		this._ctx.beginPath();
		this._ctx.moveTo((this._lineSpace * 2) + (measure.subBeats * this._lineSpace) + (measureNumber * measure.length), yOffset);
		this._ctx.lineTo((this._lineSpace * 2) + (measure.subBeats * this._lineSpace) + (measureNumber * measure.length), yOffset + ((this._lineCount - 1) * this._lineSpace));
		this._ctx.stroke();
		this._ctx.lineWidth = 1;
		this._ctx.closePath();
		// Draw tempo indication
		for (let i = 0; i < measure.tempo.length; ++i) {
			// BPM indication
			this._quarterNote(
				(this._lineSpace * 2) + (measure.tempo[i].beat * this._lineSpace) + (measureNumber * measure.length),
				yOffset - (this._tabLineMargin / 2) + (18 / 2),
				3,
				18
			);
			this._ctx.font = `${this._fontSize}px sans-serif`;
			this._ctx.fillText(
				`= ${measure.tempo[i].value}`,
				(this._lineSpace * 2) + (measure.tempo[i].beat * this._lineSpace) + (measureNumber * measure.length) + (3 * 2),
				yOffset - (this._tabLineMargin / 2) + (18 / 2)
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
			this._ctx.font = `${this._fontSize * 1.1}px sans-serif`;
			for (let i = 0; i < measure.chords.length; ++i) {
				this._ctx.fillText(
					measure.chords[i].value,
					(this._lineSpace * 2) + (measure.chords[i].beat * this._lineSpace) + (measureNumber * measure.length),
					yOffset - (this._lineSpace / 2)
				);
			}
			this._ctx.font = `bold ${this._fontSize}px sans-serif`;
		}
		// Draw annotations if any
		if (measure.annotations.length > 0) {
			this._ctx.font = `bold ${this._fontSize * 1.6}px sans-serif`;
			for (let i = 0; i < measure.annotations.length; ++i) {
				this._ctx.fillText(
					measure.annotations[i].value,
					(this._lineSpace * 2) + (measure.annotations[i].beat * this._lineSpace) + (measureNumber * measure.length),
					yOffset - ((5 * this._lineSpace) / 3)
				);
			}
			this._ctx.font = `bold ${this._fontSize}px sans-serif`;
		}
		// Draw annotations if any
		if (measure.syllabes.length > 0) {
			this._ctx.font = `italic ${this._fontSize * 1.2}px sans-serif`;
			for (let i = 0; i < measure.syllabes.length; ++i) {
				this._ctx.fillText(
					measure.syllabes[i].value,
					(this._lineSpace * 2) + (measure.syllabes[i].beat * this._lineSpace) + (measureNumber * measure.length),
					yOffset + (3 * this._tabLineMargin / 4)
				);
			}
			this._ctx.font = `bold ${this._fontSize}px sans-serif`;
		}
	}


	_drawTabLine(lineNumber) {
		// The y offset depends on the line number, spaced in top/bottom with 3 lines space
		const yOffset = this._headerHeight + (this._tabLineMargin / 2) + (lineNumber * (this._tabLineHeight + this._tabLineMargin));

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
			this._ctx.lineTo(this._lineLength + (this._lineSpace * 2), yOffset + (i * this._lineSpace));
			this._ctx.stroke();
		}
		// Draw line final vertical bar
		this._ctx.moveTo(this._lineLength + (this._lineSpace * 2), yOffset);
		this._ctx.lineTo(this._lineLength + (this._lineSpace * 2), yOffset + ((this._lineCount - 1) * this._lineSpace));
		this._ctx.fillText(this._measurePerLines * lineNumber, this._lineSpace + (this._lineSpace / 2), yOffset - (this._fontSize / 2));
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


	_keyboardClicked(event) {
		const inputActive = [document.getElementById('chord'), document.getElementById('annotation'), document.getElementById('syllabe')];
		if (inputActive.indexOf(document.activeElement) !== -1) {
			return;
		}

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


	// Cursor Utils


	_moveCursorLeft(withCtrl) {
		this._toggleClickedClass('arrow-left');
		this._toggleClickedClass('q-left');
		let ctrlModifier = 1;
		if (withCtrl === true) {
			ctrlModifier = (this._timeSignature.beat * this._timeSignature.measure);
		}

		if (this._cursor.x - this._lineSpace - (this._lineSpace * ctrlModifier) > 0) {
			this._cursor.x -= (this._lineSpace * ctrlModifier);
			// First decrement the measure count
			if (this._cursor.beat === 0 || ctrlModifier > 1) {
				--this._cursor.measure;
			}
			// Then update the beat number
			if (ctrlModifier === 1) {
				this._cursor.beat = (this._cursor.beat - ctrlModifier + (this._timeSignature.beat * this._timeSignature.measure)) % (this._timeSignature.beat * this._timeSignature.measure);
			}
		} else if (this._cursor.line !== 0) { // New line for cursor
			--this._cursor.measure;
			this._cursor.beat = (this._timeSignature.beat * this._timeSignature.measure) - 1;
			--this._cursor.line;
			// Move cursor on the previous line
			this._cursor.x = this._lineLength + this._lineSpace - (this._lineSpace / 2);
			this._cursor.y -= this._tabLineHeight + this._tabLineMargin;
		}
		// Update container scroll according to cursor position
		document.getElementById('tab-container').scrollTo(0, this._cursor.y - (document.getElementById('tab-container').offsetHeight / 2));
		this._refreshTab();
	}


	_moveCursorRight(withCtrl) {
		this._toggleClickedClass('arrow-right');
		this._toggleClickedClass('d-right');
		let ctrlModifier = 1;
		if (withCtrl === true) {
			ctrlModifier = (this._timeSignature.beat * this._timeSignature.measure);
		}

		if (this._cursor.x + (this._lineSpace * ctrlModifier) < (this._lineLength + (this._lineSpace / 2))) {
			this._cursor.x += this._lineSpace * ctrlModifier;

			if (ctrlModifier === 1) {
				this._cursor.beat = (this._cursor.beat + ctrlModifier) % (this._timeSignature.beat * this._timeSignature.measure);
			}

			if (this._cursor.beat === 0 || ctrlModifier > 1) {
				++this._cursor.measure;
			}
			// Update container scroll according to cursor position
			document.getElementById('tab-container').scrollTo(0, this._cursor.y - (document.getElementById('tab-container').offsetHeight / 2));
		} else { // New line for cursor
			++this._cursor.measure;
			this._cursor.beat = 0;
			++this._cursor.line;
			// Move cursor on the next line
			this._cursor.x = this._lineSpace + (this._lineSpace / 2);
			this._cursor.y += this._tabLineHeight + this._tabLineMargin;
			// Update container scroll according to cursor position
			document.getElementById('tab-container').scrollTo(0, this._cursor.y - (document.getElementById('tab-container').offsetHeight / 2));
			// Determine wether we should add the measures to fill new line
			if (this._measures.length <= (this._measurePerLines * this._cursor.line)) {
				// Resize canvas height to fit new line
				this._canvas.height += this._tabLineHeight + this._tabLineMargin;
				// Scroll to canvas bottom
				document.getElementById('tab-container').scrollTo(0, document.getElementById('tab-container').scrollHeight);
				// Append measures for new line
				for (let i = 0; i < this._measurePerLines; ++i) {
					// Then create the first measure, its index refer to its position
					this._measures.push({
						subBeats: this._timeSignature.beat * this._timeSignature.measure,
						timeSignature: this._timeSignature, // As it can be modified for any measure, we store the default value
						length: this._measureLength,
						tempo: [],
						notes: [],
						dynamics: [],
						chords: [],
						annotations: [],
						syllabes: []
					});
				}
			}
		}

		this._refreshTab();
	}


	_moveCursorUp() {
		this._toggleClickedClass('arrow-up');
		this._toggleClickedClass('z-up');
		const yOffset = this._headerHeight + (this._tabLineMargin / 2) + (this._cursor.line * (this._tabLineHeight + this._tabLineMargin)) - this._lineSpace;
		if (this._cursor.y - this._lineSpace > yOffset) {
			this._cursor.y -= this._lineSpace;
			--this._cursor.string;
		}

		this._refreshTab();
	}


	_moveCursorDown() {
		this._toggleClickedClass('arrow-down');
		this._toggleClickedClass('s-down');
		const yOffset = this._headerHeight + (this._tabLineMargin / 2) + (this._cursor.line * (this._tabLineHeight + this._tabLineMargin)) + (this._lineCount - 1) * this._lineSpace;
		if (this._cursor.y + this._lineSpace < yOffset) {
			this._cursor.y += this._lineSpace;
			++this._cursor.string;
		}

		this._refreshTab();
	}


	_drawCursor() {
		this._ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
		this._roundRect(this._cursor.x, this._cursor.y, this._lineSpace, this._lineSpace, 3);
		this._ctx.fill();
		// Update UI feedback for tab info
		const measure = this._cursor.measure + 1;
		const beat = Math.floor(this._cursor.beat / this._timeSignature.beat) + 1;
		const subBeat = (this._cursor.beat % this._timeSignature.beat) + 1;
		document.getElementById('cursor-position').innerHTML = `Measure ${measure}, Beat ${beat}/${subBeat}`;
		// Update UI feedback for existing chord on current beat
		document.getElementById('chord').value = '';
		for (let i = 0; i < this._measures[this._cursor.measure].chords.length; ++i) {
			const savedChord = this._measures[this._cursor.measure].chords[i];
			if (savedChord.beat === this._cursor.beat) {
				document.getElementById('chord').value = savedChord.value;
			}
		}
		// Update UI feedback for existing annotation on current beat
		document.getElementById('annotation').value = '';
		for (let i = 0; i < this._measures[this._cursor.measure].annotations.length; ++i) {
			const savedAnnotation = this._measures[this._cursor.measure].annotations[i];
			if (savedAnnotation.beat === this._cursor.beat) {
				document.getElementById('annotation').value = savedAnnotation.value;
			}
		}
		// Update UI feedback for existing annotation on current beat
		document.getElementById('syllabe').value = '';
		for (let i = 0; i < this._measures[this._cursor.measure].syllabes.length; ++i) {
			const savedSyllabe = this._measures[this._cursor.measure].syllabes[i];
			if (savedSyllabe.beat === this._cursor.beat) {
				document.getElementById('syllabe').value = savedSyllabe.value;
			}
		}
	}


	// UI Utils


	_dynamicClicked(event) {
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


	_addAnnotation() {
		const annotationValue = document.getElementById('annotation').value;
		if (annotationValue !== '') {
			const annotation = {
				beat: this._cursor.beat,
				value: annotationValue
			};

			let exists = false;
			let existingIndex = -1;
			for (let i = 0; i < this._measures[this._cursor.measure].annotations.length; ++i) {
				const savedAnnotation = this._measures[this._cursor.measure].annotations[i];
				if (JSON.stringify(savedAnnotation) === JSON.stringify(annotation)) { // Note already saved
					exists = true;
				} else if (savedAnnotation.value !== annotation.value && savedAnnotation.beat === annotation.beat) {
					existingIndex = i;
				}
			}

			if (existingIndex !== -1) { // Replace existing note if already exists
				this._measures[this._cursor.measure].annotations[existingIndex] = annotation;
			} else if (!exists) { // Create note if no matching note were found in measure
				this._measures[this._cursor.measure].annotations.push(annotation);
			}

			this._refreshTab();
		}
	}


	_removeAnnotation() {
		for (let i = 0; i < this._measures[this._cursor.measure].annotations.length; ++i) {
			if (this._measures[this._cursor.measure].annotations[i].beat === this._cursor.beat) {
				this._measures[this._cursor.measure].annotations.splice(i, 1);
				this._refreshTab();
				break;
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


	_toggleClickedClass(id) {
		document.getElementById(id).classList.add('clicked');
		setTimeout(() => {
			document.getElementById(id).classList.remove('clicked');
		}, 200);
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
