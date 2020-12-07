class TabMaker {


	constructor(options) {
		this._type = options.instrumentType;
		// Instrument specific internals (default to Guitar)
		this._lineCount = 6;
		this._strings = ['E', 'B', 'G', 'D', 'A', 'E'];
		// Canvas internals
		this._canvas = document.getElementById('tab-canvas');
		this._ctx = this._canvas.getContext('2d');
		this._lineSpace = 12;
		this._fontSize = 10;
		// User cursor
		this._cursor = {
			x: 0,
			y: 0
		};

		this._init();
		this._events();
	}


	_init() {
		if (this._type === 'bass') {
			this._lineCount = 4;
			this._strings = ['G', 'D', 'A', 'E'];
		}
		// Test area
		this._drawTabLine(0);
		this._drawTabLine(1);
		this._drawTabLine(2);

		this._initCursor();
	}


	_events() {
		Shortcut.register('ArrowRight', () => {

		});
		Shortcut.register('ArrowLeft', () => {

		});
	}


	_drawTabLine(lineNumber) {
		// The y offset depends on the line number, spaced in top/bottom with 3 lines space
		const yOffset = this._lineSpace + (lineNumber * (this._lineSpace * 3)) + (lineNumber * ((this._lineCount - 1) * this._lineSpace));
		// TODO update canvas height according to line number

		this._ctx.beginPath();
		this._ctx.strokeStyle = '#444444';
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
			this._ctx.lineTo(900 - this._lineSpace, yOffset + (i * this._lineSpace));
			this._ctx.stroke();
		}
		// Draw line final vertical bar
		this._ctx.moveTo(900 - this._lineSpace, yOffset);
		this._ctx.lineTo(900 - this._lineSpace, yOffset + ((this._lineCount - 1) * this._lineSpace));
		this._ctx.stroke();
		// End line drawing
		this._ctx.closePath();
	}


	_initCursor() {
		this._cursor = {
			x: this._lineSpace,
			y: (this._lineCount * this._lineSpace) - (this._lineSpace / 2)
		};

		this._ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
		this._ctx.rect(this._cursor.x, this._cursor.y, this._lineSpace, this._lineSpace);
		this._ctx.fill();
	}


	_moveCursorLeft() {

	}


	_moveCursorRight() {

	}


}


export default TabMaker;
