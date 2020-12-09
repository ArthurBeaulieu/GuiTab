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

		this._fillExistingProjects();
		Events.addEvent('click', this._newProjectButton, this._createNewProject, this);
	}


	_fillExistingProjects() {
		const lsObject = { ...window.localStorage };
		const ls = [];

    const keys = Object.keys(lsObject);
    let count = keys.length;

    while (count--) {
      ls.push({
				name: keys[count],
				value: lsObject[keys[count]]
			});
    }

		if (ls.length > 0) {
			for (let i = 0; i < ls.length; ++i) {
				const project = document.createElement('DIV');
				project.innerHTML = ls[i].name;
				project.dataset.key = ls[i].name;
				project.dataset.value = ls[i].value;
				document.getElementById('existing-project').appendChild(project);
				Events.addEvent('click', project, this._createExistingProject, this);
			}
		}
	}


	_createNewProject() {
		this._homeContainer.style.display = 'none';
		this._projectOptions.style.display = 'flex';

		const name = document.getElementById('project-name');
		const composer = document.getElementById('project-composer');
		const bpm = document.getElementById('project-bpm');
		const timeSignature = document.getElementById('project-time-signature');
		const instrumentType = document.getElementById('guitar-type');
		const submit = document.getElementById('create-project');

		const createNewProject = () => {
			if (name.value !== '' && composer.value !== '' && bpm.value !== '' && timeSignature.value !== '') {
				Events.removeEvent(evtId);
				// Put openProject here
				this._openProject({
					name: name.value,
					composer: composer.value,
					bpm: bpm.value,
					timeSignature: timeSignature.value,
					instrumentType: instrumentType.value
				});
			} else { // Add or remove errors in new project inputs
				if (name.value === '') {
					name.classList.add('error');
				} else {
					name.classList.remove('error');
				}

				if (composer.value === '') {
					composer.classList.add('error');
				} else {
					composer.classList.remove('error');
				}

				if (bpm.value === '') {
					bpm.classList.add('error');
				} else {
					bpm.classList.remove('error');
				}

				if (timeSignature.value === '') {
					timeSignature.classList.add('error');
				} else {
					timeSignature.classList.remove('error');
				}
			}
		};

		const evtId = Events.addEvent('click', submit, createNewProject, this);
	}


	_createExistingProject(event) {
		this._homeContainer.style.display = 'none';
		this._projectContainer.style.display = 'flex';
		const item = JSON.parse(event.target.dataset.value);
		const tabMaker = new TabMaker({
			name: item.info.name,
			composer: item.info.composer,
			bpm: item.info.bpm,
			timeSignature: item.info.timeSignature,
			instrumentType: item.info.instrumentType,
			measures: item.measures,
			lsKey: event.target.dataset.key
		});
	}


	_openProject(options) {
		this._projectOptions.style.display = 'none';
		this._projectContainer.style.display = 'flex';
		const tabMaker = new TabMaker(options);
	}


}


export default GuiTab;
