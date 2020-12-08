class TabMaker {


	constructor(options) {
		// Tab score specific internals
		this._name = options.name;
		this._type = options.instrumentType;
		this._timeSignature = {
			beat: parseInt(options.timeSignature.split('/')[0]),
			measure: parseInt(options.timeSignature.split('/')[1])
		};
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
		// Project score internals, object to save as JSON to save score
		this._measures = [];
		// Tab customisation
		this._colors = {
			text: '#000000',
			bar: '#888888',
			subBar: '#BBBBBB'
		};

		this._init();
		this._events();
	}


	_init() {
		// Here we compute the amount of sub beat in a measure (dividing a beat in 8 subbeats), with 6 measures in a line
		this._measureLength = (this._timeSignature.beat * this._timeSignature.measure) * this._lineSpace;
		while (this._lineLength <= (984 - (2 * this._lineSpace) - this._measureLength)) {
			++this._measurePerLines;
			this._lineLength += this._measureLength;
		}

		this._canvas.height = this._headerHeight + this._lineSpace + (this._lineSpace * 3) + ((this._lineCount - 1) * this._lineSpace);
		this._canvas.width = this._lineLength + (2 * this._lineSpace);

		if (this._type === 'bass') {
			this._lineCount = 4;
			this._strings = ['G', 'D', 'A', 'E'];
		}

		this._initTab();
	}


	_events() {
		Shortcut.register('ArrowLeft', this._moveCursorLeft.bind(this));
		Shortcut.register('Ctrl+ArrowLeft', this._moveCursorLeft.bind(this, true));
		Shortcut.register('ArrowRight', this._moveCursorRight.bind(this));
		Shortcut.register('Ctrl+ArrowRight', this._moveCursorRight.bind(this, true));
		Shortcut.register('ArrowUp', this._moveCursorUp.bind(this));
		Shortcut.register('ArrowDown', this._moveCursorDown.bind(this));

		Shortcut.register('q', this._moveCursorLeft.bind(this));
		Shortcut.register('d', this._moveCursorRight.bind(this));
		Shortcut.register('z', this._moveCursorUp.bind(this));
		Shortcut.register('s', this._moveCursorDown.bind(this));

		document.addEventListener('keydown', this._keyboardClicked.bind(this));
	}


	_initTab() {
		// Init cursor position to first beat, first sub beat on lowest instrument string
		this._cursor = {
			x: this._lineSpace / 2,
			y: this._headerHeight + (this._lineCount * this._lineSpace) - (this._lineSpace / 2),
			measure: 0,
			beat: 0,
			line: 0,
			string: this._strings.length
		};
		// Fill first line with
		for (let i = 0; i < this._measurePerLines; ++i) {
			// Then create the first measure, its index refer to its position
			this._measures.push({
				subBeats: this._timeSignature.beat * this._timeSignature.measure,
				timeSignature: this._timeSignature, // As it can be modified for any measure, we store the default value
				length: this._measureLength,
				notes: []
			});
		}

		this._refreshTab();
	}


	_refreshTab() {
		this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
		this._drawHeader();
		this._drawTabMeasures();
		this._drawCursor();
	}


	_drawHeader() {
		this._ctx.font = `bold ${this._fontSize * 2}px sans-serif`;
		this._ctx.textBaseline = 'middle';
		this._ctx.textAlign = 'center';
		this._ctx.fillText(
			this._name,
			this._canvas.width / 2,
			this._headerHeight / 2,
			this._headerHeight,
			this._canvas.width
		);
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
		const yOffset = this._headerHeight + this._lineSpace + (lineNumber * (this._lineSpace * 3)) + (lineNumber * ((this._lineCount - 1) * this._lineSpace));
		for (let i = 0; i < measure.subBeats; i += measure.timeSignature.measure) {
			// Draw sub beat horizontal line
			this._ctx.strokeStyle = this._colors.subBar;
			this._ctx.beginPath();
			this._ctx.moveTo(this._lineSpace + (i * this._lineSpace) + (measureNumber * measure.length), yOffset);
			this._ctx.lineTo(this._lineSpace + (i * this._lineSpace) + (measureNumber * measure.length), yOffset + ((this._lineCount - 1) * this._lineSpace));
			this._ctx.stroke();
			this._ctx.closePath();
		}
		// Draw measure end horizontal line
		this._ctx.strokeStyle = this._colors.bar;
		this._ctx.beginPath();
		this._ctx.moveTo(this._lineSpace + (measure.subBeats * this._lineSpace) + (measureNumber * measure.length), yOffset);
		this._ctx.lineTo(this._lineSpace + (measure.subBeats * this._lineSpace) + (measureNumber * measure.length), yOffset + ((this._lineCount - 1) * this._lineSpace));
		this._ctx.stroke();
		this._ctx.closePath();

		if (measure.notes.length > 0) {
			for (let i = 0; i < measure.notes.length; ++i) {
				this._ctx.fillStyle = this._colors.text;
				this._ctx.strokeStyle = this._colors.bar;
				this._ctx.font = `bold ${this._fontSize}px sans-serif`;
				let align = this._fontSize / 3;
				if (measure.notes[i].value / 10 >= 1) {
					align = (2 * this._fontSize) / 3;
				}
				// Write the line associated string
				this._ctx.fillText(
					measure.notes[i].value,
					this._lineSpace + (measure.notes[i].beat * this._lineSpace) + (measureNumber * measure.length) - align,
					yOffset + ((measure.notes[i].string - 1) * this._lineSpace) + (this._fontSize / 3),
					this._lineSpace,
					this._lineSpace
				);
			}
		}
	}


	_drawTabLine(lineNumber) {
		// The y offset depends on the line number, spaced in top/bottom with 3 lines space
		const yOffset = this._headerHeight + this._lineSpace + (lineNumber * (this._lineSpace * 3)) + (lineNumber * ((this._lineCount - 1) * this._lineSpace));
		// TODO update canvas height according to line number
		this._ctx.beginPath();
		this._ctx.fillStyle = this._colors.text;
		this._ctx.strokeStyle = this._colors.bar;
		this._ctx.font = `${this._fontSize}px sans-serif`;
		// Draw line first vertical bar
		this._ctx.moveTo(this._lineSpace, yOffset);
		this._ctx.lineTo(this._lineSpace, yOffset + ((this._lineCount - 1) * this._lineSpace));
		this._ctx.stroke();
		// Iterate over the amount of string for given instrument type
		for (let i = 0; i < this._lineCount; ++i) {
			// Write the line associated string
			this._ctx.fillText(this._strings[i], 0, yOffset + (i * this._lineSpace) + (this._fontSize / 3));
			// Draw horizontal line
			this._ctx.moveTo(this._lineSpace, yOffset + (i * this._lineSpace));
			this._ctx.lineTo(this._lineLength + this._lineSpace, yOffset + (i * this._lineSpace));
			this._ctx.stroke();
		}
		// Draw line final vertical bar
		this._ctx.moveTo(this._lineLength + this._lineSpace, yOffset);
		this._ctx.lineTo(this._lineLength + this._lineSpace, yOffset + ((this._lineCount - 1) * this._lineSpace));
		this._ctx.font = `italic ${this._fontSize}px sans-serif`;
		this._ctx.fillText(this._measurePerLines * (lineNumber + 1), this._lineLength + this._lineSpace, yOffset);
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
			this._refreshTab();
		} else if (!exists) { // Create note if no matching note were found in measure
			this._measures[this._cursor.measure].notes.push(note);
			this._refreshTab();
		}
	}


	_updateSymbol(value) {
		if (value === 'h' || value === 'p' || value === '/' || value === '\\') { // Hammer on/Pull of, only append if cursor is surrounded with notes on same string
			let hasNoteBefore = false;
			let hasNoteAfter = false;
			for (let i = 0; i < this._measures[this._cursor.measure].notes.length; ++i) {
				const note = this._measures[this._cursor.measure].notes[i];
				if (note.beat === this._cursor.beat - 1 && note.string === this._cursor.string) {
					hasNoteBefore = true;
				}
				if (note.beat === this._cursor.beat + 1 && note.string === this._cursor.string) {
					hasNoteAfter = true;
				}
			}
			if (hasNoteBefore && hasNoteAfter) {
				this._updateNote(value);
			}
		} else if (value === 'b' || value === 'v') {
			let hasNoteBefore = false;
			for (let i = 0; i < this._measures[this._cursor.measure].notes.length; ++i) {
				const note = this._measures[this._cursor.measure].notes[i];
				if (note.beat === this._cursor.beat - 1 && note.string === this._cursor.string) {
					hasNoteBefore = true;
				}
			}
			if (hasNoteBefore) {
				this._updateNote(value);
			}
		} else if (value === 'x') {
			this._updateNote(value);
		}

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
		let ctrlModifier = 1;
		if (withCtrl === true) {
			ctrlModifier = (this._timeSignature.beat * this._timeSignature.measure);
		}

		if (this._cursor.x - (this._lineSpace * ctrlModifier) > 0) {
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
			// Move cursor on the next line
			const yOffset = (this._lineSpace * 3) + ((this._lineCount - 1) * this._lineSpace);
			this._cursor.x = this._lineLength - this._lineSpace / 2;
			this._cursor.y = this._cursor.y - yOffset;
		}

		this._refreshTab();
	}


	_moveCursorRight(withCtrl) {
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
		} else { // New line for cursor
			++this._cursor.measure;
			this._cursor.beat = 0;
			++this._cursor.line;
			// Move cursor on the next line
			const yOffset = (this._lineSpace * 3) + ((this._lineCount - 1) * this._lineSpace);
			this._cursor.x = this._lineSpace / 2;
			this._cursor.y = this._cursor.y + yOffset;
			// Determine wether we should add the measures to fill new line
			if (this._measures.length <= (this._measurePerLines * this._cursor.line)) {
				this._canvas.height += this._lineSpace + (this._lineSpace * 3) + ((this._lineCount - 1) * this._lineSpace);
				for (let i = 0; i < this._measurePerLines; ++i) {
					// Then create the first measure, its index refer to its position
					this._measures.push({
						subBeats: this._timeSignature.beat * this._timeSignature.measure,
						timeSignature: this._timeSignature, // As it can be modified for any measure, we store the default value
						length: this._measureLength,
						notes: []
					});
				}
			}
		}

		this._refreshTab();
	}


	_moveCursorUp() {
		const yOffset = this._cursor.line * ((this._lineSpace * 3) + ((this._lineCount - 1) * this._lineSpace));
		if (this._cursor.y - this._lineSpace > yOffset) {
			this._cursor.y -= this._lineSpace;
			--this._cursor.string;
		}

		this._refreshTab();
	}


	_moveCursorDown() {
		const yOffset = this._cursor.line * ((this._lineSpace * 3) + ((this._lineCount - 1) * this._lineSpace));
		if (this._cursor.y + this._lineSpace < this._lineCount * this._lineSpace + yOffset) {
			this._cursor.y += this._lineSpace;
			++this._cursor.string;
		}

		this._refreshTab();
	}


	_drawCursor() {
		this._ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
		this._roundRect(this._cursor.x, this._cursor.y, this._lineSpace, this._lineSpace, 3);
		this._ctx.fill();
	}


	// Canvas utils


	_roundRect(x, y, width, height, radius, fill, stroke) {
		// MVP -> https://stackoverflow.com/a/3368118
	  if (typeof stroke === 'undefined') {
	    stroke = true;
	  }

	  if (typeof radius === 'undefined') {
	    radius = 5;
	  }

	  if (typeof radius === 'number') {
	    radius = { tl: radius, tr: radius, br: radius, bl: radius };
	  } else {
	    var defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
	    for (var side in defaultRadius) {
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


}


export default TabMaker;
