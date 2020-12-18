import DropElement from './lib/DropElement.js';
import TabMaker from './TabMaker.js';


class GuiTab {


  constructor() {
    this._homeContainer = null;
    this._projectOptions = null;
    this._projectContainer = null;

    this._dropTabContainer = null;
    this._newProjectButton = null;
    this._homeButton = null;
    this._aboutButton = null;

    this._dropElement = null;
    this._tab = null;
    this._evtIds = [];

    this._init();
  }


  _init() {
    this._homeContainer = document.getElementById('home-container');
    this._projectOptions = document.getElementById('project-options');
    this._projectContainer = document.getElementById('project-container');

    this._dropTabContainer = document.getElementById('drop-container');
    this._newProjectButton = document.getElementById('new-project-button');
    this._homeButton = document.getElementById('home-button');
    this._aboutButton = document.getElementById('about-button');

    this._dropElement = new DropElement({
      target: this._dropTabContainer,
      onDrop: this._droppedTab.bind(this)
    });

    Events.addEvent('click', this._dropTabContainer, this._droppedTab, this);
    Events.addEvent('click', this._newProjectButton, this._createNewProject, this);
    Events.addEvent('click', this._homeButton, this._homePage, this);
    Events.addEvent('click', this._aboutButton, this._aboutModal, this);

    this._loadProjectFromLs();
  }


  _loadProjectFromLs() {
    if (this._evtIds.length > 0) {
      for (let i = 0; i < this._evtIds.length; ++i) {
        Events.removeEvent(this._evtIds[i]);
      }
    }

    for (let i = document.getElementById('existing-project').children.length - 1; i >= 0; --i) {
      if (document.getElementById('existing-project').children[i].tagName !== 'BUTTON') {
        document.getElementById('existing-project').removeChild(document.getElementById('existing-project').children[i]);
      }
    }

    const lsObject = { ...window.localStorage };
    const ls = [];

    const keys = Object.keys(lsObject);
    let count = keys.length;

    while (count--) {
      // Only load guitab items
      if (keys[count].indexOf('guitab') !== -1) {
        ls.push({
          name: keys[count],
          value: lsObject[keys[count]]
        });
      }
    }

    if (ls.length > 0) {
      for (let i = 0; i < ls.length; ++i) {
        const project = document.createElement('DIV');
        const title = document.createElement('H1');
        const composer = document.createElement('P');
        const icon = document.createElement('IMG');
        const deleteIcon = document.createElement('IMG');

        project.classList.add('saved-project');
        project.dataset.key = ls[i].name;
        project.dataset.value = ls[i].value;
        title.innerHTML = ls[i].name.split('-')[1];
        composer.innerHTML = ls[i].name.split('-')[2];
        icon.src = './img/guitar.svg';
        deleteIcon.src = './img/delete.svg';
        deleteIcon.classList.add('delete');

        project.appendChild(title);
        project.appendChild(composer);
        project.appendChild(icon);
        project.appendChild(deleteIcon);
        document.getElementById('existing-project').insertBefore(project, document.getElementById('existing-project').firstChild);
        this._evtIds.push(Events.addEvent('click', project, this._createExistingProject, this));
        this._evtIds.push(Events.addEvent('click', deleteIcon, this._removeExistingProject, this));
      }
    }
  }


  _droppedTab(event) {
    if (event.dataTransfer && event.dataTransfer.files) {
      const files = event.dataTransfer.files;
      for (let i = 0, file; file = files[i]; ++i) {
        const reader = new FileReader();
        reader.onload = (theFile => {
          return raw => {
            this._createDroppedProject(JSON.parse(raw.target.result));
          };
        })(file);
        reader.readAsText(file);
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
    const item = JSON.parse(event.currentTarget.dataset.value);

    if (this._tab !== null) {
      this._tab.destroy();
      this._tab = null;
    }

    this._tab = new TabMaker({
      name: item.info.name,
      composer: item.info.composer,
      bpm: item.info.bpm,
      timeSignature: item.info.timeSignature,
      instrumentType: item.info.instrumentType,
      measures: item.measures,
      lsKey: event.currentTarget.dataset.key
    });
  }


  _createDroppedProject(file) {
    this._homeContainer.style.display = 'none';
    this._projectContainer.style.display = 'flex';

    if (this._tab !== null) {
      this._tab.destroy();
      this._tab = null;
    }

    this._tab = new TabMaker({
      name: file.info.name,
      composer: file.info.composer,
      bpm: file.info.bpm,
      timeSignature: file.info.timeSignature,
      instrumentType: file.info.instrumentType,
      measures: file.measures,
      lsKey: `guitab-${file.info.composer}-${file.info.name}-${Date.now()}`
    });
  }


  _removeExistingProject(event) {
    event.stopPropagation();
    window.localStorage.removeItem(event.target.parentNode.dataset.key);
    this._loadProjectFromLs();
  }


  _homePage() {
    if (this._tab !== null) {
      this._tab.destroy();
      this._tab = null;
    }

    this._homeContainer.style.display = 'flex';
    this._projectOptions.style.display = 'none';
    this._projectContainer.style.display = 'none';

    this._loadProjectFromLs();
  }


  _aboutModal() {
    const close = event => {
      if (event.target === document.getElementById('modal-overlay')) {
        document.getElementById('modal-overlay').style.display = 'none';
        Events.removeEvent(evtId);
      }
    };

    document.getElementById('modal-overlay').style.display = 'flex';
    const evtId = Events.addEvent('click', document.getElementById('modal-overlay'), close);
  }


  _openProject(options) {
    this._projectOptions.style.display = 'none';
    this._projectContainer.style.display = 'flex';

    if (this._tab !== null) {
      this._tab.destroy();
      this._tab = null;
    }

    this._tab = new TabMaker(options);
  }


}


export default GuiTab;
