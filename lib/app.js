const os = require('os');
const fs = require('fs');
const path = require('path');
const utils = require('./utils');
const FlowRPC = require('./rpc');
const EventEmitter = require('events');


class FlowApp extends EventEmitter{
	constructor(options={}){
		super();
		
		this.options = Object.assign({
			ident:'flow-app',
			rpc:{},
			config:false,
		}, options);
		this.log = Function.prototype.bind.call(
			console.log,
			console,
			`[${this.options.logPrefix || this.constructor.name}]`
		);

		let {rpc} = this.options;
		if(rpc && !rpc.bcastChannel)
			rpc.bcastChannel = this.options.ident;

		this.isNw = utils.isNw;
		this.ident = this.options.ident;
		this.utils = utils;
		this.appFolder = options.appFolder;
		this.init();
	}

	/**
	* initlizing starts here
	*/
	async init(){
		this.flags = {};
		this.initFlags();
		await this.initConfig(this.options.config);
		if(this.isNw && utils.isObject(this.options.rpc))
			await this.initRPC();

		this.emit("init");
	}

	/**
	* initlize flags from process.argv or nw.App.fullArgv
	*/
	initFlags(){
		let args;
		if (this.isNw){
			args = nw.App.fullArgv;
		}else{
			args = process.argv.slice(2);
		}
		this.flags = utils.args(args);
	}

	/**
	* initlize config object
	*/
	async initConfig(config){
		if(config){
			this.config = config;
			return;
		}
		this.configFolder = this.getConfigFolderPath();
		this.ensureDirSync(this.configFolder);
		this.config = {};
		this.configFile = this.getConfigFilePath();
		if(!fs.existsSync(this.configFile) || this.flags['reset-config']){
			await this.initConfigFromDefault();
		}else{
			this.config = await this.getConfig();
			await this.loadConfig(this.config);
		}
	}

	ensureDirSync(dir){
		if(!fs.existsSync(dir))
			return fs.mkdirSync(dir);
		let stat = fs.statSync(dir);
		if(stat.isDirectory())
			return true;
		fs.mkdirSync(dir)
	}

	readJSONSync(filePath, defaults={}){
		if(!fs.existsSync(filePath))
			return defaults;
		let stat = fs.statSync(filePath);
		if(stat.isDirectory())
			return defaults;
		try{
			let data = fs.readFileSync(filePath)+"";
			return JSON.parse(data);
		}catch(e){
			return defaults;
		}
	}

	/**
	* @return {String} config folder path
	*/
	getConfigFolderPath(){
		return path.join(os.homedir(), `.${this.ident}`);
	}

	/**
	* @return {String} config file path
	*/
	getConfigFilePath(){
		return path.join(this.getConfigFolderPath(), "config.json");
	}

	/**
	* @return {Object} default config
	*/
	getDefaultConfig(){
		let file = path.join(this.appFolder, "default-config.json");
		return this.readJSONSync(file, {});
	}

	/**
	* initlize config from defaults
	*/
	async initConfigFromDefault(){
		this.config = await this.getDefaultConfig();
		await this.loadConfig(this.config);
	}

	/**
	* config initlizing
	*/
	async loadConfig(config){
		await this.setConfig(config)
	}

	/**
	* save theme
	* @param {String} theme theme name (dark/light)
	*/
	async setTheme(theme){
		this.config.theme = theme;
		await this.setConfig(this.config);
	}

	/**
	* set config
	* @param {Object} config JSON config
	*/
	async setConfig(config){
		if(typeof config == 'object')
			config = JSON.stringify(config, null, "\t")
		await this.saveConfig(config);
		this.config = await this.getConfig();
	}

	/**
	* save config, implement/define in your inherited class
	* @param {Object} config JSON config
	*/
	async saveConfig(config={}){
		if(this.configFile)
			fs.writeFileSync(this.configFile, config);
	}

	/**
	* read config file and return config as JSON object
	* @param {Object} [defaults={}] default config object
	* @return {Object} config as JSON
	*/
	async getConfig(defaults = {}){
		if(this.configFile){
			let text = fs.readFileSync(this.configFile, 'utf-8');
			return eval(`(${text})`);
		}
		return this.config || defaults;
	}

	/**
	* initilize FlowRPC
	*/
	async initRPC(){
		let klass = this.options.RPC || FlowRPC;
		let rpc = new klass(this.options.rpc);
		this.rpc = rpc;
		this.initRPCHooks();
	}
	initRPCHooks(rpc){
		rpc = rpc || this.rpc;
		let {op} = this.options.rpc;
		this._defaultRPCHooks = {
			'get-app-config':(args, callback)=>{
				console.log("get-app-config:args", args)
				callback(null, this.config)
			},
			'set-app-config':async(args)=>{
				let {config} = args;
				if(!config || !config.modules)
					return
				this.setConfig(config);
			},
			'get-app-data':(args, callback)=>{
				let {config, configFolder, appFolder, dataFolder} = this;
				let {modules} = config;
				callback(null, {config, configFolder, modules, appFolder, dataFolder})
			},
			'set-app-theme':(args)=>{
				let {theme} = args;
				if(!theme)
					return
				this.setTheme(theme);
			},
			'set-app-i18n-entries':(args, callback)=>{
				let {entries} = args;
				if(!entries)
					return callback({error:"Invalid entries"});
				this.saveI18nEntries(entries);
			},
			'get-app-i18n-entries':(args, callback)=>{
				let entries = this.getI18nEntries();
				console.log("get-app-i18n-entries", entries)
				callback(null, {entries});
			}
		}
		let ops = Object.assign({}, this._defaultRPCHooks, op || {});

		Object.entries(ops).forEach(([k, fn])=>{
			if(this.utils.isString(fn)){
				let _k = fn;
				fn = this._defaultRPCHooks[k];
				k = _k;
			}
			if(!fn)
				return
			rpc.on(k, fn);
		})
		
	}

	/**
	* @return {String} path i18n entries file
	*/
	getI18nFilePath(name){
		return path.join(this.appFolder, name);
	}

	/**
	* @return {Array} i18n entries
	*/
	getI18nEntries(){
		let localEntries = this._getI18nEntries('i18n.entries');
		let dataEntries = this._getI18nEntries('i18n.data');
		if(!dataEntries.length)
			return localEntries;
		let localEntriesMap = this.createI18nEntriesMap(localEntries);
		let dataEntriesMap = this.createI18nEntriesMap(dataEntries);
		return Object.values(Object.assign(localEntriesMap, dataEntriesMap))
	}
	createI18nEntriesMap(entries){
		let map = {}
		entries.forEach(e=>{
			if(!e.en)
				return
			map[e.en] = e;
		});

		return map;
	}
	_getI18nEntries(fileName){
		let dataFile = this.getI18nFilePath(fileName);
		if(!fs.existsSync(dataFile))
			return [];

		let data = (fs.readFileSync(dataFile)+"").trim();
		if(!data.length)
			return [];
		try{
			data = JSON.parse(data);
		}catch(e){
			return [];
		}

		return data || [];
	}

	/**
	* saves i18n entries
	* @param {Array} i18n entries
	*/
	saveI18nEntries(entries){
		fs.writeFileSync(
			this.getI18nFilePath('i18n.entries'),
			JSON.stringify(entries, null, "\t")
		)
	}

	/**
	* Logs given variables
	* @param {...*} args
	*/
	log(...args) {
		args.unshift('FlowApp:');
		console.log(args);
	}

	/**
	* Exit App
	*/
	exit(){
		process.exit(0);
	}

	/**
	* Reload App
	*/
	reload(){
		if(this.isNw)
			chrome.runtime.reload();
	}
}

module.exports = FlowApp;