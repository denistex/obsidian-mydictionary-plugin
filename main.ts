import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

import * as googleCloudTranslate from '@google-cloud/translate'

// Remember to rename these classes and interfaces!

interface MyDictionarySettings {
	apiKey: string;
	fromLanguage: string;
}

const DEFAULT_SETTINGS: MyDictionarySettings = {
	apiKey: '',
	fromLanguage: 'en'
}

export default class MyDictionary extends Plugin {
	settings: MyDictionarySettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-dictionary-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click XXX ', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		this.registerEvent(this.app.vault.on('modify', async f => {
			const m = f.name.match(/^.*\.(\w{2})-(\w{2})\.md$/)
			if (m == null) return
			const [, fromLanguage, toLanguage] = m

			const file = this.app.vault.getFileByPath(f.path);
			if (file == null) return

			const view = this.app.workspace.getActiveViewOfType(MarkdownView);

			const cursorLineIndex = view?.file === file
				? view.editor.getCursor().line
				: -1

			const cachedData = await f.vault.cachedRead(file)
			const processedData = (
				await Promise.all(
					cachedData
						.split('\n')
						.map(async (line, index) => {
							if (index === cursorLineIndex) return line
							if (line.includes(':')) return line

							const l = line.trim()
							if (l.length <= 0) return line

							const t = await translate(this.settings.apiKey, fromLanguage, toLanguage, l);

							return `${l} : ${t}`
						})
				)
			).join('\n')

			f.vault.process(
				file,
				data => data === cachedData ? processedData : data
			)
		}))
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyDictionary;

	constructor(app: App, plugin: MyDictionary) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('Google Cloud Translation API Key')
			.addText(text => text
				.setPlaceholder('Google Cloud Translation API Key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));
	}
}






async function translate(
	apiKey: string,
	fromLanguage: string,
	toLanguage: string,
	input: string
): Promise<string> {
	const translate = new googleCloudTranslate.v2.Translate({ key: apiKey });

	let [translations] = await translate.translate([input], toLanguage);
	translations = Array.isArray(translations) ? translations : [translations];

	return translations[0]
}


