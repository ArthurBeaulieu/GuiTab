import TabMaker from './TabMaker.js';


class GuiTab {


	constructor() {
		this._homeContainer = null;
		this._projectOptions = null;
		this._projectContainer = null;
		this._newProjectButton = null;

		this._init();
	}


	_init() {
		this._homeContainer = document.getElementById('home-container');
		this._projectOptions = document.getElementById('project-options');
		this._projectContainer = document.getElementById('project-container');

		this._newProjectButton = document.getElementById('new-project-button');

		Events.addEvent('click', this._newProjectButton, this._createNewProject, this);
	}


	_createNewProject() {
		this._homeContainer.style.display = 'none';
		this._projectOptions.style.display = 'flex';

		const name = document.getElementById('project-name');
		const timeSignature = document.getElementById('project-time-signature');
		const instrumentType = document.getElementById('guitar-type');
		const submit = document.getElementById('create-project');

		const createNewProject = () => {
			if (name.value !== '' && timeSignature !== '') {
				Events.removeEvent(evtId);
				// Put openProject here
			}

			this._openProject({
				name: name.value,
				timeSignature: timeSignature.value,
				instrumentType: instrumentType.value
			});
		};

		const evtId = Events.addEvent('click', submit, createNewProject, this);
	}


	_openProject(options) {
		this._projectOptions.style.display = 'none';
		this._projectContainer.style.display = 'block';
		const tabMaker = new TabMaker(options);
	}


}


export default GuiTab;
