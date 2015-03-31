// ==UserScript==
// @name		Plugbot
// @namespace	plug
// @include		https://plug.dj/*
// @version		1
// @grant		none
// ==/UserScript==

/* 
TO DO:
5. Song titles filtering/fixing. (add video-id array, (and|ft[.]*|&), case-independent, artist-title switched up).
9. Add mute for longer than 45 minutes and ban for longer than one day (but not permanent). Has to be localStorage then.
12. Redo the way commands are called again. make them all have one single argument with relevant properties.
14.  
*/


const GLOBAL = this
const COMMAND_SYMBOL = "!"
var DELETE_COMMANDS = true
const BOT_USERID = 5433970
const BOT_ROOM = "dvach"

	// Global variables declaration.
var STATE
const MasterList = [4702482, 3737285, 4856012, 5659102]	// List of user ids that can fully control the bot.
var IgnoreList = []										// List is users to ignore some commands from. Should probably be in the localStorage.
var timeouts = Object.create(null)						// Object to hold IDs of all the scheduled functions that may need to be aborted.
var mutationlists = Object.create(null)					// Object to hold all the arrays and objects the MutationObserver should refer to.
var global_uid = null									// global uid value to use in SETTINGS setters.
var DJCYCLE												// DJ Cycle state.
var WAITLIST = []										// Current array of the queue.
var PATRONS = Object.create(null)						// Contains custom user-objects.
var SCORE = Object.create(null)							// Saves the song score to update patron data.
var VOTING = Object.create(null)						// Hold voting proposals and enlistments.
var HANGMAN = Object.create(null)						// Hangman words, number of attempts, tried letters, etc
var WLCMSG = ""											// Welcome message.
// var SKIPS = {last: null, record: [], skipmixtime: null}	// Keeps track of all the skipped tracks. Loaded from the localStorage.

// What type of commands to respond to or actions to take.
var SETTINGS = {fun: true, tools: true, various: true, usercomm: true, mehskip: true, scrobble: true,
				autocycle: true, mrazota: true, sameartist: true, setstaff: true, spam: true,
				stuck: true, welcome: true, swear: true, games: {hangman: true, russian: true}}
// Some of the settings can only be changed by a few chosen people.
Object.defineProperties(SETTINGS,{
	'_addtweek':{value:false,writable:true},
	'_locklist':{value:false,writable:true},
	'addtweek': {
		enumerable: false,
		set: function(val){
			if (assertPermission(global_uid,0) || global_uid===5121031){
				this._addtweek = val
				global_uid = 0
			}
			return
		},
		get: function(){return this._addtweek}
	},
	'commdelete': {
		set: function(val){
			if (assertPermission(global_uid,0)){
				DELETE_COMMANDS = val
				global_uid = 0
			}
			return
		},
		get: function(){return DELETE_COMMANDS}
	},
	'locklist': {
		enumerable: true,
		set: function(val){
			if (assertPermission(global_uid,0)){
				this._locklist = val
				global_uid = 0
			}
		},
		get: function(){return this._locklist}
	},
	'disabled':{
		enumerable: false,
		writable: true,
		value: []
	},
	'concheck':{
		enumerable: false,
		writable: true,
		value: true
	},
	'setup': {
		/* Log the time, turn off any existing event listeners, clear timeouts,
		get initial waitlist, turn off disabled settings, flush limits, fix patron 
		objects in case something has been changed, update command list and add
		alternatives ways to call certain functions. */
		enumerable: false,
		writable: false,
		value: function(){
					var t = new Date()
					var times = localStorage.getObject('startuptimes') || []
					times.push(t)
					localStorage.setObject('startuptimes',times)
					API.off()
					clearTimeouts('all')
					WAITLIST = API.getWaitList().map(function(elem){return elem.id})
					STATE = "running"
					enableSetting(4702482,'all')
					disableSetting.apply(this, [4702482, 'swear', 'locklist'].concat(this.disabled))
					chatCommands.flushlimits()
					chatCommands.fixpatrons()
					ALLCOMMANDS.update()
					chatTools.alternatives()
					chatFun.alternatives()
					getBansAndMutes()
					timeouts.log = setTimeout(function(){SETTINGS.log = false},5000)
					Object.defineProperty(PATRONS,'length', {
						get: function(){var l=0; for (var key in this){l++}; return l}
					})
					return
		}
	},
	'control': {
		enumerable: false,
		writable: false,
		value: true
	},
	'log': {
		enumerable: false,
		writable: true,
		value: true
	}
});
Object.seal(SETTINGS)

var ALLCOMMANDS = {
	/* Keep track of all existing commands. */
	default: []
	, user: []
	, all: []
	, update: function(){
		this.default = [].concat(Object.keys(chatControl), Object.keys(chatTools), Object.keys(chatFun),
								Object.keys(chatGames), Object.keys(chatVarious))
		this.user = Object.keys(chatUser)
		this.all = [].concat(this.default, this.user)
	}
	, check: function(command){
		//	Check if the command already exists.
		return this.all.indexOf(command) > -1
	}
	, type: function(command){
		// Returns the type of the command.
		if (command in chatControl)	{return "Control"}
		if (command in chatTools)	{return "Tools"}
		if (command in chatFun)		{return "Fun"}
		if (command in chatGames)	{return "Games"}
		if (command in chatVarious)	{return "Various"}
		if (command in chatUser)	{return "User"}
		return false
	}
}

var LASTFM = {
	apikey: JSON.parse(localStorage.APIKEY)
	, apiscr: JSON.parse(localStorage.APISCR)
	, apisk: JSON.parse(localStorage.APISK)
	, apiroot: "http://ws.audioscrobbler.com/2.0/"
	, middle: "&user=dvachbot&api_key="
	, middleun: "&user=dvachbot&username=dvachbot&api_key="
	, fjson: "&format=json"
	, getinfo: function(artist){return this.apiroot+"?method=artist.getInfo&artist="+artist+this.middleun+this.apikey+this.fjson}
	, scrobble: function(adv){
		/* If _scrobble is called directly on the API.ADVANCE event — plug.dj blocks the POST method
		(405 METHOD NOT ALLOWED), so had to make this wrapper. */
		setTimeout(function(){LASTFM._scrobble(adv)})
		return
	}
	, _scrobble: function(adv){
		if (!(adv.lastPlay && SETTINGS.scrobble)){return}
		if (LASTFM.noscrobble){
			LASTFM.noscrobble = false
			kittLog(adv.lastPlay.media+" is not being scrobbled")
			return
		}
		var duration = adv.lastPlay.media.duration
		if (duration < 60 || (Date.now() - this.prevscrobble) < 1000*Math.min(duration/2, 240)){
			kittLog("Not scrobbling. Track duration: "+duration+"; passed: "+Math.round((Date.now() - this.prevscrobble)/1000)+".")
			return
		}
		this.prevscrobble = Date.now()
		var artist = adv.lastPlay.media.author
		var track = adv.lastPlay.media.title
		var timestamp = Math.round(Date.now()/1000)
		var toHash = 'api_key'+this.apikey+'artist'+artist+'methodtrack.scrobble'+'sk'+
					  this.apisk+'timestamp'+timestamp+'track'+track+this.apiscr
		var apisig = MD5.md5(toHash)
		var postdata = 'artist='+artist+'&track='+track+'&timestamp='+timestamp+'&sk='+
					   this.apisk+'&api_sig='+apisig+'&api_key='+this.apikey+'&method=track.scrobble'
		$.post(this.apiroot,postdata, function(resp){kittLog(resp)})
		return
	}
	, prevscrobble: Date.now()
}

var prev_chat_uid = 0;										// Some global counters/trackers.
var this_chat_uid = 0;
var lost_connection_count = 0;
var songstuck = 0
var startupnumber = 1
var chatsstat = 0;											// is used to count chat update rate
var chatsglob = [[Date.now(),0],[Date.now(),0]];

mutationlists.users_to_add = Object.create(null);							// Objects Mutation Observer checks after a pattern match.
mutationlists.users_to_move = Object.create(null);
mutationlists.users_to_mute = Object.create(null);
mutationlists.users_to_staff = Object.create(null);
mutationlists.users_to_destaff = Object.create(null);
mutationlists.user_to_skipadd = null
mutationlists.user_to_skipmove = null
mutationlists.connectionCID = null

/* 
Only for reference, the actual 'localstoragekeys' variable is also loaded from localStorage.
var localstoragekeys = ['songlist','songstats','asianlinks','roulette','catlinks','allissuedcommands',
 						'dictru','dicteng','tweek','atresponses','bugreports','VALENTINES','PATRONS',
 						'EMOJIDICT','chatUser','SKIPS', 'SWEARS'] 
*/ 					
						
// List of variables that are not changed often or at all and thus don't need to be saved periodically (unlike songlist and songstats, for example)
var immutablestoragekeys = ['dictru','dicteng','asianlinks','catlinks','tweek','atresponses','roulette','chatUser',"EMOJIDICT"];

function start(){
	/*
	Tries to start up the bot every 5 seconds after the page has started to load.
	If no connection within 1 minute — refreshes the page.
	On successful connection turns of audio/video by clicking the appropriate buttons
	and runs the init function.
	*/
	console.log("Trying to start up, try number "+startupnumber)
	if (typeof API !== 'undefined' && API.enabled){
		botInit()
	} else{
		if (startupnumber < 11){	
			setTimeout(function(){
				startupnumber++
				start()},5000)
		} else{
			window.location.href = "https://plug.dj/"+BOT_ROOM
		}
	}
};

			// BOT MODE FUNCTION
botInit = function(){
	/*
	Loads all required objects from the local storage. The list of objects is also
	saved in local storage to make it alterable while the bot is running without
	the need to change code and restart.
	*/
	localstoragekeys = localStorage.getObject('localstoragekeys') || []
	if (localstoragekeys.length===0){API.chatLog("DELETED AGAIN. ARRRGH",true)}
	for (i=0; i<localstoragekeys.length; i++){
		GLOBAL[localstoragekeys[i]] = localStorage.getObject(localstoragekeys[i]) || 
					GLOBAL[localstoragekeys[i]] || API.chatLog("Couldn't load "+localstoragekeys[i],true)
	}
	SETTINGS.disabled = localStorage.getObject("settingsdisabled")
	botStart()
	// Checks the connection every 5 minutes and reconnects if necessary.
	setInterval(checkConnection,5*60*1000)
	// Start the stuck song loop
	checkStuck()
	// Wake Big Brother up.
	createEye()
};

botStart = function(){

	// Set up the bot.
	SETTINGS.setup()

			// EVENT LISTENERS //
			
	// Commands (only work when issued by bot itself, i.e. on a computer it is running on).
	API.on(API.CHAT_COMMAND, chatCommands.input);	
	
	// Chat responses
	API.on(API.CHAT, function(message){
		kittLog(message)
		prev_chat_uid = this_chat_uid
		this_chat_uid = message.uid
// 		if (swearingMute(message)){return} // Community did not like this feature.
		if (message.message[0]===COMMAND_SYMBOL){
			chatClassifier(message)
		}
		if (message.uid === BOT_USERID) {
			// Messages from bot.
			kittChats(message)
			return
		}
			// Random reply (either a short phrase or a line from some song; KITT loves Bon Jovi and Phil Collins)
		if (message.message.split(" ")[0]==="@K.I.T.T." && message.un!="K.I.T.T." && message.uid!=5433970) {
			if (Math.random()>1){
				API.sendChat("@"+message.un+" "+atresponses[Math.floor(Math.random()*atresponses.length)])
			}
			return
		}
		chatsstat++ 		// increment chats count to calculate chat rate for song stats
		chatsglob[0][1]++	// increment chats count to calculate global chat rate
		chatsglob[1][1]++	// increment chats count to calculate global chat rate
		if (PATRONS[message.uid]){PATRONS[message.uid].messages += 1}
		return
	});
	
	/* Check if anyone has left while in a queue. 
	Counts the number of people in the queue and toggles DJ cycle if needed.
	If djlock is enabled — removes everyone from the list.
	Wakes up people that are first in the wait list, if they have set an alarm. 
	Removes the last person in the queue if they've asked to. */
	API.on(API.WAIT_LIST_UPDATE, waitlistUpdate);
	API.on(API.WAIT_LIST_UPDATE, toggleCycle);
	API.on(API.WAIT_LIST_UPDATE, reallyLockWaitList);
	API.on(API.WAIT_LIST_UPDATE, wakeUp);
	API.on(API.WAIT_LIST_UPDATE, removeFromList);
	
	/* On DJ advance check if he is in the dropped_users_list list to prevent !lastpos abuse
	Updates scrobble list, song length stats, checks if the song is absurdly long while 
	people are in a queue, adds tweek if she's not in the list, tags users as "played"
	and updates songplays/score counters of a user. Scrobbles to last.fm! */
	API.on(API.ADVANCE, checkDJ);
	API.on(API.ADVANCE, songlistUpdate);
	API.on(API.ADVANCE, statisticUpdate);
	API.on(API.ADVANCE, mrazotaCheck);
	API.on(API.ADVANCE, sameArtist);
	API.on(API.ADVANCE, addTweek);
	API.on(API.ADVANCE, tagPlayed);
	API.on(API.ADVANCE, patronPlayed);
	API.on(API.ADVANCE, patronScore);
	API.on(API.ADVANCE, addNoCycle);
	API.on(API.ADVANCE, LASTFM.scrobble);

		/* Updates some info of a user. Sends him a welcome message, if set. */
	API.on(API.USER_JOIN, patronJoin);
	API.on(API.USER_JOIN, welcomeUser);
	
	/* Updates some info of a user. */
	API.on(API.USER_LEAVE, patronLeave);
	
	/* Vote events */
	API.on(API.VOTE_UPDATE, patronVote);
	
	/* Score update events */	
	API.on(API.SCORE_UPDATE, updateScore);
	/* Compares the votes and calls "mehSkip" in 5 seconds.
	If there are still 5+ more mehs than woots — skips.
	If at any point mehs go below the threshold, resets the timer. */
	API.on(API.SCORE_UPDATE,function(score){
		if (!timeouts.skip && enoughToSkip()){
			timeouts.skip = setTimeout(function(){mehSkip()},(5000))
		}
		if (!!timeouts.skip && !enoughToSkip()) {
			clearTimeouts("skip")
		}
		return
	});

	/* Saves who skipped the song and its latest score. */
	API.on(API.MOD_SKIP, recordSkip)
	
			// SCHEDULED FUNCTIONS

	/* Saves data to local storage every 10 minutes. */
	timeouts.localsave = setInterval(chatCommands.savetolocalstorage,10*60*1000)

	/*
	There are two global chat counters and timers. Each is reset every 30 minutes to only
	get the 'current' chat rate. Counters are reset 15 minutes apart from each other.
	Whenever the chat rate is required, the one with the least time left till reset (i.e. 
	has more data) is used. Two timers/counters are necessary because of a reset,
	since otherwise it wouldn't be possible to get an accurate chat rate within a couple of
	minutes of every reset (which is a lot, considering the reset time of only 30 minutes).
	*/
	timeouts.chatcount1 = setInterval(resetChatCounter,30*60*1000,1)
	setTimeout(function(){timeouts.chatcount2 = setInterval(resetChatCounter,30*60*1000,2)},15*60*1000)
		
		// Chat log that confirms that everything has been initialised properly and bot is up and running.	
	API.chatLog("I am K.I.T.T.",true)
	return
};

botIdle = function(){
	STATE = "idle"
	API.off(API.CHAT)
	disableSetting(4702482,'autocycle','mehskip','mrazota', 'stuck', 'sameartist', 'welcome', 'swear')
	
	console.log("idling...")
	API.on(API.CHAT, function(data){
		if (data.message==="!botstart" && STATE==="idle" && assertPermission(data.uid,3)){
			API.sendChat("I'm the voice of the Knight Industries Two Thousand's microprocessor. K-I-T-T for easy reference, K.I.T.T. if you prefer.")
			clearTimeouts("all")
			botStart()
			return
		}
		if (data.message==="!lastpos"){
			var args = [data.uid, data.username].concat(data.message.split(" ").slice(1))
			chatTools.lastpos.apply(this, args)
		}		
	})
};

botRestart = function(){
	// Saves everything and refreshes the page in 3 seconds.
	chatCommands.savetolocalstorage(true)
	setTimeout(function(){window.location.href = "https://plug.dj/"+BOT_ROOM},3000)
};

botHangman = function(language){
	if (["ru","eng"].indexOf(language)<0){return}
// 	if (mode === "hangman"){API.sendChat("You are already playing the game!")}
	kittLog("Starting Hangman!")
	API.off(API.CHAT, hangmanChat)
	mode = "hangman"
	if (language==="ru"){
		ind=Math.floor(Math.random()*dictru.length)
		HANGMAN.word = dictru[ind]
		HANGMAN.language="Russian"		
	}
	if (language==="eng"){
		ind=Math.floor(Math.random()*dicteng.length)
		HANGMAN.word = dicteng[ind]
		HANGMAN.language="English"
	}
	HANGMAN.uword = "_"+Array(HANGMAN.word.length).join(" _")
	if (HANGMAN.word.indexOf("-")>-1){
		ind = HANGMAN.word.indexOf("-")
		HANGMAN.uword = HANGMAN.uword.substr(0,ind*2)+"-"+HANGMAN.uword.substr(ind*2+1)
	}
	HANGMAN.count = 0
	HANGMAN.tried = []
	API.sendChat("Let's play Hangman in "+HANGMAN.language+"!")
	setTimeout(function(){API.sendChat(HANGMAN.uword)},(250))
	kittLog(HANGMAN.word)
	setTimeout(function(){API.sendChat('Guess a letter or the word by typing "!letter _"/"!lt _" or "!word ___". You have 10 guesses.')},(500))
	API.on(API.CHAT, hangmanChat)
};

			// INTERNAL CHAT COMMANDS.
chatCommands = {
	input: function(input){
		kittLog(input)
		var command = input.slice(1).split(" ")[0]
		var args = input.split(" ").slice(1)
		if (command in chatCommands){
			chatCommands[command].apply(this,args)
		}
		return
	}
		// Control
	, restart: function(time){
		setTimeout(botRestart,time*1000)
		return
	}
	, stream: function(on){
		$("div.settings.button").click()
		if (on){
			setTimeout(function(){$("div.item.s-av").click()},250)
		} else {
			setTimeout(function(){$("div.item.s-av.selected").click()},250)
		}
		setTimeout(function(){$("div.back").click()},500)
		API.sendChat("/cap 1")
	}
	, flushlimits: function(){
		for (key in PATRONS){
			PATRONS[key].lastcommand = null
			PATRONS[key].samecommand = 0
			PATRONS[key].cats = 0
			PATRONS[key].asians = 0
			PATRONS[key].rolls = 0
		}
		return
	}
	, addtosonglist: function(){
		songlistUpdate()
		return
	}
	, addtostats: function(){
		statisticUpdate()
		return
	}
	, add: function(command, response/*, *text */){
		/* 'response' is just the first word of an actual response, so need to get it all from 'arguments'. */
		if (!(command && response) || command in chatUser) {return}
		chatUser[command] = argumentsSlice(arguments,1)
		chatCommands.savetolocalstorage(true)
		ALLCOMMANDS.update()
		return
	}
	, remove: function(command){
		delete chatUser[command]
		chatCommands.savetolocalstorage(true)
		return	
	}
	, enable: function(/* *settings */){
		var settings = argumentsSlice(arguments,0).split(" ")
		enableSetting.apply(this,[4702482].concat(settings))
		for (var i=0; i<settings.length; i++){
			while (SETTINGS.disabled.indexOf(settings[i])>-1){
				SETTINGS.disabled.splice(SETTINGS.disabled.indexOf(settings[i]),1)
			}
		}
		if (settings[0]==="all"){SETTINGS.disabled = []}
		localStorage.setObject("settingsdisabled",SETTINGS.disabled)
		return	
	}
	, disable: function(/* *settings */){
		var settings = argumentsSlice(arguments,0).split(" ")
		disableSetting.apply(this,[4702482].concat(settings))
		SETTINGS.disabled = SETTINGS.disabled.concat(settings)
		localStorage.setObject("settingsdisabled",SETTINGS.disabled)
		return
	}
	, eval: function(){
		var code = argumentsSlice(arguments,0)
		eval(code)
		return
	}
		// Export/import/print
	, export: function(path, start, stop){
		/* Export the contents of an object to the new window. If an array, can be sliced to export only part of it. */
		var variable = path.split(".")[0]
		if (GLOBAL[variable]){
			var data = path.split(".").reduce(deepObject,GLOBAL)
		} else {return}
		if (!(data instanceof Array)){
			var expdata = JSON.stringify(data)
			window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(expdata))
			return
		}
		if (data[0] instanceof Array){
			var expdata = data.slice((+start || 0),(+stop || undefined)).map(function(elem){return elem = elem.join(" ")}).join("\r\n")
		} else{
			var expdata = data.length > 0 ? data.slice((+start || 0), (+stop || undefined)).reduce(function(a,b){return a+"\r\n"+b}) : "EMTPY"
		}
		window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(expdata))
		return
	}
	, exportall: function(){
		var DATA = Object.create(null)
		DATA['localstoragekeys'] = localstoragekeys
		for (var i = 0; i<localstoragekeys.length; i++){
			DATA[localstoragekeys[i]] = GLOBAL[localstoragekeys[i]]
		}
		var expdata = JSON.stringify(DATA)
		window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(expdata))
		return
	}
	, importall: function(load){
		/* 'load' will actually be just a word "load", not a boolean, but it's converted then. */
		if (load){
			var file = new FileReader();
			file.onload = function(){
				var value = file.result
				DATA = JSON.parse(value)
				for (var key in DATA){
					GLOBAL[key] = DATA[key]
				}
				$('#dropfile').remove()
				chatCommands.savetolocalstorage(true)
			}
			var fileval = document.getElementById('dropfile').files[0];		
			file.readAsText(fileval)
			return
		}
		$('#chat-messages').append('<div><input id="dropfile" type="file" onchange="API.sendChat(\'/importall load\')"/></div>')
		return
	}
	, print: function(path, start, stop){
		/* Prints only a slice of an array, but transfers all of it to the window. */
		var variable = path.split(".")[0]
		if (GLOBAL[variable]){
			var data = path.split(".").reduce(deepObject,GLOBAL)
		} else {return}
		window['exported'] = data
		if (data instanceof Array){
			if (data[0] instanceof Array){
				data = data.map(function(elem){return elem.join(" ")})
			}
			data = data.slice((+start || 0),(+stop || undefined))
			data = data.join("; ")
		} else if (data instanceof Object){
			data = JSON.stringify(data)
		}
		API.chatLog(path+": "+String(data))
		return
	}
	, printall: function(){
		for (i=0; i<localstoragekeys.length; i++){
			console.log(localstoragekeys[i])
			console.log(GLOBAL[localstoragekeys[i]])
		}
		return
	}
		// Variable/file manipulation
	, transfertowindow: function(path, variable){
		/* Transfers data from a given path from GM to window scope under the name 'variable', if given, or last 
		property in 'path', unless it is a number. If no arguments — transfers everything. */
		var path = path.split(".")
		var variable = variable || isNaN(+path.slice(-1)[0]) ? path.slice(-1)[0] : "transfered"
		if (path){
			window[variable] = path.reduce(deepObject,GLOBAL)
		} else {
			window['BOTSCOPE'] = GLOBAL
		}
		return
	}
	, transferfromwindow: function(variable, path){
		/* Transfers variable 'variable' from window to the GM scope at the specified path 
		(can be dot-notated deep property of some object). */
		var props = path.split(".")
		var obj = GLOBAL[props[0]]
		var last = props.pop();
		props.reduce(deepObject,GLOBAL)[last] = window[variable]
		return
	}
	, expvar: function(variable, text/*, *text */){
		if (!text){return}
		GLOBAL[variable].push(argumentsSlice(arguments,1))
		return
	}
	, addvar: function(variable){
		if (localstoragekeys.indexOf(variable)<0){
			localstoragekeys.push(variable)
			chatCommands.savetolocalstorage(true)
		}
		return
	}
	, remvar: function(variable){
		var ind = localstoragekeys.indexOf(variable)
		if (ind>=0){
			localstoragekeys.splice(localstoragekeys.indexOf(variable),1)
			chatCommands.savetolocalstorage(true)
		}
		return
	}
	, clrvar: function(variable){
		GLOBAL[variable] = GLOBAL[variable].constructor()
		chatCommands.savetolocalstorage(true)
	}
	, loadfile: function(variable, type, save){
		/* 'type' is either "json" or "lines", i.e. how to process the loaded file */
		if (variable === "remove"){
			$('#dropfile').remove()
			return
		}
		if (save) {
			var file = new FileReader();
			file.onload = function(){
				if (type==="json"){
					var value = JSON.parse(file.result)
				} else if (type==="lines"){
					var value = file.result.replace(/\r/g,"").split("\n")
				} else {return}
				GLOBAL[variable] = value
				if (localstoragekeys.indexOf(variable)<0) {
					localstoragekeys.push(variable)
				}
				$('#dropfile').remove()
				chatCommands.savetolocalstorage(true)
			}
			var fileval = document.getElementById('dropfile').files[0];		
			file.readAsText(fileval)
		} else {
			window['savecom'] = "/loadfile "+variable+" "+type+" save"
			$('#chat-messages').append('<div><input id="dropfile" type="file" onchange="API.sendChat(savecom)"/></div>') 
		}
		return
		
	}
	, savetolocalstorage: function(force, variable){
		/* 'force' might not be boolean if manually called from chat. */
		if (variable){
			localStorage.setObject(variable,GLOBAL[variable])
			return
		}
		localStorage.setObject('localstoragekeys',localstoragekeys)
		for (i=0; i<localstoragekeys.length; i++){
			if (!force && immutablestoragekeys.indexOf(localstoragekeys[i]) > -1) {continue}
			localStorage.setObject(localstoragekeys[i],GLOBAL[localstoragekeys[i]])
		}
		localStorage.setObject('settingsdisabled',SETTINGS.disabled)
		return
	}
	, loadfromlocalstorage: function(){
		localstoragekeys = localStorage.getObject('localstoragekeys')
		for (i=0; i<localstoragekeys.length; i++){
			GLOBAL[localstoragekeys[i]] = localStorage.getObject(localstoragekeys[i])
		}
		return
	}
	, flushlocalstorage: function(){
		for (i=0; i<localstoragekeys.length; i++){
			delete localStorage[localstoragekeys[i]]
		}
		return
	}
		// Various
	, whomehed: function(){
		var u = API.getUsers()
		var m = []
		for (var i=0; i<u.length; i++){
			if (u[i].vote<0){m.push(u[i].username)}	
		}
		API.chatLog(m.join("; "))
		return
	}
	, getuid: function(name/*, *name */){
		API.chatLog(getUID(argumentsSlice(arguments,0)).toString())
		return
	}
	, hangman: function(lng){
		bothangmanconsole(lng)
		return
	}
		// Patrons
	, updatepatrons: function(){
		updatePatrons()
		return
	}
	, modifypatron: function(name/*, *name, property, value */){
		var name = argumentsSlice(arguments,0,-2)
		var property = argumentsSlice(arguments,-2,-1)
		var value = argumentsSlice(arguments,-1)
		modifyPatron(name, property, value)
		return
	}
	, fixpatrons: function(force){
		var reference = new Patron(0)
		for (var key in PATRONS){
			if (Object.keys(reference).length != Object.keys(PATRONS[key]).length){
				for (var refkey in reference){
					if (!PATRONS[key].hasOwnProperty(refkey)){
						PATRONS[key][refkey] = reference[refkey]
					}
				}
			} else {if (force){continue}else{break}}
		}
		return
	}
		// temp
};

			// USER CHAT
function chatClassifier(message){
	/*
	Classifier of !commands, to separate important and not so important ones.
	Processes all the command rates, whether it is in a block etc, etc.
	The response to user-created commands is also done here.
	*/
	if (prev_chat_uid != this_chat_uid && SETTINGS.commdelete) {		// Deletes the chat if the command is not in a block of 
		API.moderateDeleteChat(message.cid)							// messages (i.e. previous chat was not from that user).
		this_chat_uid = 0						// Removes the last chat uid in case the command did not require any text response from bot.
	}
	if (message.message===COMMAND_SYMBOL+"connected"){	// It has to be a chat and not chat_command, because the latter works even without connection.
		mutationlists.connectionCID = message.cid
		API.moderateDeleteChat(message.cid) // Deletes the "!connected" message regardless of blocks.
	}

		// Only run fix function if the length of a chat is large enough to even contain a link.
	var input = message.message.length > 50 ? fixLinksAndEmoji(message.message) : message.message
	var command = input.split(" ")[0].slice(1).toLowerCase()
	var text = input.split(" ").slice(1)
	var name = message.un
	var uid = message.uid;

	if (!(/vote/.test(input) || command==="connected")){
		allissuedcommands.push([name, new Date(), input]) // Big Brother Sees All. Except for votes. They still have to be anonymous.
	}
	
		// Check for spam.
	if (checkSpam(uid, name, command)){return}
	
		// If kittex is trying to use the bot, along with an action (if proper command was given) will also piss on him.
	if (name==="SomethingNew"){				
		setTimeout(function(){API.sendChat("@SomethingNew PSSSSSSSSS")},1500)
	};

		// Actual classification.
	if (command in chatControl && SETTINGS.control){
		chatControl[command].apply(this,[uid].concat(text))
		return
	}
	if (command in chatTools && SETTINGS.tools){
		chatTools[command].apply(this,[uid,name].concat(text))
		return
	}
	if (command in chatFun && SETTINGS.fun){
		chatFun[command].apply(this,[uid,name].concat(text))
		return
	}
	if (command in chatGames && SETTINGS.games[command]){
		chatGames[command].apply(this,[uid,name].concat(text))
		return
	}
	if (command in chatVarious && SETTINGS.various){
		chatVarious[command].apply(this,[uid,name].concat(text))
		return
	}
	if (command in chatUser && SETTINGS.usercomm){
		API.sendChat(chatUser[command])
		return
	}
	return
};

		// Responses to !commands.

chatControl = {
	/* Control of the bot. */
	botstop: function(uid){
		/* In 30 seconds stops the bot, removes chatClassifier listener and 
		starts the one that waits for "!botstart" command only. */
		if (assertPermission(uid,3) && STATE === "running"){
			STATE = "idle"
			API.sendChat('I only have about 30 seconds of voice transmission left.')
			timeout.idle = setTimeout(botIdle,30*1000)
		}
		return
	}
	, restart: function(uid){
		if (assertPermission(uid,3)){
			botRestart()
		}
		return
	}
	, settings: function(uid, setting){
		/* Prints the list of settings and their status. */
		if (!assertPermission(uid,3)){return}
		if (setting){
			var val = setting.split(".").reduce(deepObject,SETTINGS)
			if (val !== undefined){API.sendChat(setting+": "+['off','on'][+val]); return}
		}
		var chat = ""
		for (var setting in SETTINGS){
			if (SETTINGS[setting] instanceof Object){
				chat += setting+": ["
				for (var subsetting in SETTINGS[setting]){
					chat += subsetting+": "+['off','on'][+SETTINGS[setting][subsetting]]+", "
				}
				chat = chat.slice(0,-2)+"]; "
			} else {
				chat += setting+": "+['off','on'][+SETTINGS[setting]]+"; "
			}
		}
		chat = chat.slice(0,-2)+"."
		API.sendChat(chat)
		return
	}
	, enable: function(uid, setting){
		/* Turn 'setting' on. */
		if (!assertPermission(uid,3)){return}
		global_uid = uid
		var setting = setting.toLowerCase()
		if (setting==="all"){
			enableSetting(uid,"all")
			return
		}
		enableSetting(uid,setting)
		while (SETTINGS.disabled.indexOf(setting)>-1){
			SETTINGS.disabled.splice(SETTINGS.disabled.indexOf(setting),1)
		}
		localStorage.setObject("settingsdisabled",SETTINGS.disabled)
		clearTimeouts(setting)
		return

	}
	, disable: function(uid, setting, time){
		/* Turn 'setting' off. Will automatically be turned on in 'time' minutes, never,
		or in 2 hours, if no time specified. */
		if (!assertPermission(uid,3)){return}
		global_uid = uid
		var setting = setting.toLowerCase()
		var delay = Number(time) || 120
		disableSetting(uid,setting)
		if (time === "never"){
			SETTINGS.disabled.push(setting)
			localStorage.setObject("settingsdisabled",SETTINGS.disabled)
		} else {
			clearTimeouts(setting)
			timeouts[setting] = setTimeout(function(){global_uid = uid; enableSetting(uid,setting); clearTimeouts(setting)},delay*60*1000)
		}
		return
	}
	, letusswear: function(uid){
		if (!assertPermission(uid,3)){return}
		clearTimeouts('swear')
		SETTINGS.swear = false
		return
	}
	, nodelete: function(uid){
		/* Turn off command removal from chat. */
		if (!assertPermission(uid,0)){return}
		DELETE_COMMANDS = DELETE_COMMANDS^true
		return
	}
	, cycle: function(uid, argument){
		/* DJ cycle. Turn automatic toggle on or off. After being switched off, reenables itself in one hour. */
		if (!assertPermission(uid,2)){return}
		if (!argument){
			toggleCycle(['enable','disable'][+DJCYCLE])
			return
		}
		if (argument === "autoon"){
			clearTimeouts("cycle")
			SETTINGS.autocycle = true
			return
		}	
		if (argument === "autooff"){
			clearTimeouts("cycle")
			timeouts.cycle = setTimeout(function(){SETTINGS.autocycle = true},1*60*60*1000)
			SETTINGS.autocycle = false
			return
		}
		if (argument === "on"){
			toggleCycle("enable")
			return
		}
		if (argument === "off"){
			toggleCycle("disable")
			return
		}	
		return
	}
	, locklist: function(uid){
		/* May be used to prevent residentDJs/bouncers from entering the queue 
		at the event of sorts, since "wait list lock" does not affect them, but 
		they don't always behave well. Simply removes anyone that joins the list.*/
		if (!assertPermission(uid,0)){return}
		API.sendChat("/me airstrike alarm")
		setTimeout(function(){API.sendChat("Waitlist is in lockdown.")},500)
		global_uid = uid
		SETTINGS.locklist=true
		API.moderateLockWaitList(true,true)
		return
	}
	, unlocklist: function(uid){
		if (!assertPermission(uid,0)){return}
		global_uid = uid
		SETTINGS.locklist=false
		API.moderateLockWaitList(false)
		return
	}
	, flush: function(uid){
		/* Reset the cat/roll/command/etc limits. */
		if (!assertPermission(uid,0)){return}
		chatCommands.flushlimits()
		return
	}
	, remove: function(uid, command){
		/* Remove user-created command. */
		if (!assertPermission(uid,0)){return}
		chatCommands.remove(command.toLowerCase())
		return
	}
	, destroy: function(uid){
		/* Sayonara. */
		if (!assertPermission(uid,0)){return}
		var u = API.getUsers()
		API.moderateDJCycle(false)
		API.moderateLockWaitList(true,true)
		API.moderateForceSkip()
		for (var key in PATRONS){
			setStaff({uid: PATRONS[key].id, role: 0})
			userBan({uid: PATRONS[key].id, duration: "forever"})
		}
		for (var key in localStorage){
			localStorage[key] = null
		}
		for (var i=0; i<100; i++){
			API.sendChat("FUCK YOU FUCK YOU FUCK YOU")
		}
		return
	}
	, noscrobble: function(uid){
		if (!assertPermission(uid,3)){return}
		LASTFM.noscrobble = true
		return
	}
};

chatTools = {
	/* Main/important commands.
	All arguments are usually single words/numbers, except for 'name'. If an argument should 
	consist of more (as denoted by *arg), it is then obtained from 'arguments'.  There may 
	be a different argument after the *arg, so it is obtained by taking last argument. */
	alternatives: function(){
		this.dc = this.lastpos
		this.lp = this.lastplayed
		this.bugreport = this.message
		this.iwanttocycleevenwithdjcycleturnedoff = this.cycleadd
	}
	, lastpos: function(uid, name, target/*, target */){
		/* 
		Move the users to the position they was at before dropping from plug.dj.
		Extracts the userID for the required person, checks if they have disconnected recently,
		adds them to the arrays Mutation Observer refers to and calls either addDJ or moveDJ functions.
		Then in 3 seconds checks if everything was done successfully, sending chat message if not.
		*/
		if (target){
			var target = argumentsSlice(arguments,2)
			if (target==="_chat"){
				API.sendChat(name+"'s place was "+PATRONS[uid].dropped[1]+" on "+String(new Date(PATRONS[uid].dropped[0])))
				return
			}
			var tid = getUID(target)
			var target = getName(tid) || target
			if (!tid){API.sendChat("Invalid name '"+target+"'."); return}
		} else {var tid = uid; var target = name}
		
		var place = PATRONS[tid].dropped[1]
		var time = PATRONS[tid].dropped[0]
		if ((Date.now() - time) > 1*60*60*1000){
			API.sendChat("@"+target+", You've been disconnected for too long. But your last place was "+place+" on "+String(new Date(time))+".")
			return
		}
		if (time == 0){API.sendChat("@"+target+", You are not in the list, sorry."); return}
		if (!findInQueue(tid)[0] || !(findInQueue(tid)[1]<place)){
			chatTools.move("lastpos",tid,place)
			setTimeout(function(){
					if (mutationlists.users_to_add[tid]){
						API.sendChat("Unable to add @"+target+" to wait list. Refresh the page and try again. Your last position was "+place)
					}
					if (mutationlists.users_to_move[tid] && !mutationlists.users_to_add[tid]){
						API.sendChat("Unable to move @"+target+". Refresh the page and try again. Your last position was "+place)
					}
					delete mutationlists.users_to_move[tid]
					delete mutationlists.users_to_add[tid]
				},3000)
		}
		return
	}
	, lastplayed: function(){
		/* Info about current track: how many times it has been played and when was the last. */
		var song=API.getMedia()
		var authorlower = song.author.toLowerCase()
		var titlelower = song.title.toLowerCase()
		song.authorl = song.author.toLowerCase()
		song.titlel = song.title.toLowerCase()
		for (i=0; i<songlist.length; i++){
			if (compareSongInList(songlist[i],song)) {
// 				if (songlist[i][0]===song.cid || (songlist[i][1].toLowerCase()===authorlower && songlist[i][2].toLowerCase()===titlelower)){
// 					console.log('OLD IF TRUE')} else {console.log('OLD IF FALSE')}
			}
			if (songlist[i][0]===song.cid || (songlist[i][1].toLowerCase()===authorlower && songlist[i][2].toLowerCase()===titlelower)){
// 				if (compareSongInList(songlist[i],song)) {console.log('FUNCTION TRUE')} else {console.log ('FUNCTION FALSE')}
				dt = new Date(songlist[i][3])
				date = (dt.getYear()+1900)+"/"+(dt.getMonth()+1)+"/"+dt.getDate()+" "+dt.getHours()+":"+("0"+dt.getMinutes()).slice(-2)+" GMT+03"
				API.sendChat(song.author+" — "+song.title+" was last played "+date+". "+songlist[i][4]+" plays in total in this room since The Creation.")
				break
			}
		}
		return
	}
	, skip: function(uid, name, arg){
		/* Skips the tracks immediately or after a certain period. If the video was unavailable,
		will push the dj to the head of the queue. */
		if (!(assertPermission(uid,2) || API.getDJ().id === uid)){return}
		if (!arg || +arg <= 0.3){
			if (Date.now() - SKIPS.last<5000){console.log("not so fast");return}
			API.moderateForceSkip()
			SKIPS.last = Date.now()
			recordSkip(name)
			return
		}
		if (arg==="stop"){
			API.sendChat("Cancelling skip.")
			clearTimeouts("skipmix")
			SKIPS.skipmixtime = null
			return
		}
		if (arg==="error" && (API.getTimeElapsed()<15 || (assertPermission(uid,2) && API.getDJ().id != uid) || assertPermission(uid,0))) {
			var djname = API.getDJ().username
			var djuid = API.getDJ().id
			if (DJCYCLE){
				mutationlists.user_to_skipmove = djuid
			} else {
				mutationlists.user_to_skipadd = djuid
				mutationlists.users_to_move[djuid] = 1
			}
			API.moderateForceSkip()
			return
		}
		if (isNaN(+arg)){return}
		if (timeouts.skipmix){
			var skipin = SKIPS.skipmixtime - Date.now()
			API.sendChat("Skip has already been initialised and the song will be skipped in "+(skipin/1000/60).toFixed(2)+' minutes. Type "!skip stop" to cancel.')
			return
		}
		var duration = +arg<=15 ? +arg*60 : +arg
		if (API.getTimeRemaining() < duration){
			API.sendChat("Entered time is longer than the song's duration.")
			return
		}
		timeouts.skipmix = setTimeout(skipMix,duration*1000, API.getMedia().cid, duration, name)
		SKIPS.skipmixtime = Date.now() + duration*1000
		var durchat = (duration/60)%1 === 0 ? duration/60 : (duration/60).toFixed(2)
		API.sendChat("This song will be skipped in "+durchat+" minutes.")
		return
	}
	, boooring: function(uid, name){
		/* Skips longs tracks. */
		var dur = API.getMedia().duration
		if (dur>660 && enoughToSkip("loong")){
			API.sendChat("Track is too long. Skipping")
			API.moderateForceSkip()
		}
		return
	}
	, leaveafter: function(uid, name){
		/* Get kicked out of a queue at the end of you track. */
		PATRONS[uid].leave = [true, API.getDJ().id===uid]
		return
	}
	, wakemeup: function(uid, name){
		/* Set the alarm to set off when you become the first in the queue. */
		PATRONS[uid].alarm = true
	}
	, cycleadd: function(uid, name){
		if (findInQueue(uid)[0] && findInQueue(uid)[1]<6){
			PATRONS[uid].cycleadd = true
		}
		return
	}
	, message: function(uid, name, text/*, *text */){
		/* Leave a message after the tone. */
		if (!text){return}
		bugreports.push(argumentsSlice(arguments,2))
		return
	}
	, lastseen: function(uid, name, target/*, *target */){
		/* Tells you when was the last time the person you are looking for was in the room. */
		if (!target){return}
		var target = argumentsSlice(arguments,2)
		var tid = getUID(target)
		target = getName(tid) || target
		if (tid) {
			if (PATRONS[tid].online){
				API.sendChat(target+" is in the room, dummy!")
			} else {
				var lastseen = PATRONS[tid].lastseen
				API.sendChat(target+" was last seen on "+ new Date(lastseen))
			}
		} else {
			API.sendChat(target+" has never been to this room.")
		}
		return
	}
	, postсount: function(uid, name){
		API.sendChat("@"+name+" Postcount: "+PATRONS[uid].messages+"; Songs played: "+PATRONS[uid].songplays+"; Commands sent: "+PATRONS[uid].commands+".")
	}
	, staff: function(uid, name, target/*, *target, role */){
		/* Set the role of a user. */
		if (!SETTINGS.setstaff || arguments.length<4){return}
		var valid_roles = ["0","1","2","3","4","5","grey","resident","bouncer","manager","cohost","host"]
		var setter_role = Number(API.getUser(uid).role)
		var target_role = valid_roles.indexOf(arguments[arguments.length-1]) % 6
		if (target_role < 0){
			API.sendChat("Invalid role.")
			return
		}
		var target = argumentsSlice(arguments,2,-1)
		var tid = getUID(target)
		if (!tid){
			API.sendChat("No one by the name of "+target+" has ever been to this room.")
			return
		}
		var target_name = getName(tid)
		var current_role = PATRONS[tid].role
		if ((assertPermission(uid,Math.min(target_role+1,5)) && setter_role>(current_role-(uid===tid))) || assertPermission(uid,0)) {
			setStaff({name: target_name, role: target_role})
		}
		return
	}
	, move: function(uid, name, target/*, *target, place */){
		/* Move target user to a specified place in queue. Automatically adds them to the wait list
		if not already there. If this is called from the 'lastpos' function, name becomes the target uid,
		and target becomes the place to move the user to. 'uid' is numeric, so there should be no way
		to abuse this (there is no permission check if uid==="lastpos"). */
		if (uid !== "lastpos"){
			if (!assertPermission(uid,2)){return}
			var target = argumentsSlice(arguments,2,-1)
			var place = Number(arguments[arguments.length-1])
			var tid = getUID(target)
			if (!tid){return}
			target = getName(tid)
			var direct = true
		} else {var tid = name; var place = target; var direct = false}
		if (findInQueue(tid)[0]){
			if (!direct){mutationlists.users_to_move[tid] = place}
			API.moderateMoveDJ(tid,place)
		} else {
			if (!direct){mutationlists.users_to_add[tid] = true; mutationlists.users_to_move[tid] = place}
			API.moderateAddDJ(String(tid))
		}
		return
	}
	, mute: function(uid, name, target/*, *target, duration */){
		/* 'duration' is positioned as the last argument, so the name consists of all the words between arguments 2 and (n-1).
		if 'uid' is not a number ("swearing", for example), that means that this function is being called from somewhere else,
		not chat, thus omitting some of the functionality (like sending the chat with duration), as it will be done in the
		function this is called from. */
		if (!(assertPermission(uid,2) || typeof uid !='number')){return}
		var target = argumentsSlice(arguments,2,-1)
		var tid = getUID(target)
		if (!tid){API.sendChat("Invalid target"); return}
		target = getName(tid)
		var chat_durations = ["s","m","l","short","medium","long","15","30","45"]
		var duration = chat_durations.indexOf(arguments[arguments.length-1])%3
		if (duration>=0){
			if (API.getUser(tid).role===0){
				userMute({uid: tid, duration: duration})
			} else {
				staffMute({uid: tid, duration: duration})
			}
			API.sendChat("@"+target+", you've been muted for "+(duration+1)*15+" minutes.")
		} else {
			var dur = Number(argumentsSlice(arguments,-1))
			if (isNaN(dur) || dur<0.3){API.sendChat("Invalid duration"); return}
			if (dur>45){API.sendChat("Can't mute for longer than 45 minutes yet. Coming soon!"); return}
			duration = ~~(dur/15)
			if (typeof uid === 'number'){API.sendChat("@"+target+", you've been muted for "+dur+" minutes.")}
			if (API.getUser(tid).role===0){
				userMute({uid: tid, duration: duration})
			} else {
				staffMute({uid: tid, duration: duration})
			}
			setTimeout(userUnmute,dur*60*1000,tid)
		}
		return
	}
	, ban: function(uid, name, target/*, *target, duration */){
		if (!assertPermission(uid,2)){return}
		var target = argumentsSlice(arguments,2,-1)
		var tid = getUID(target)
		if (!tid || tid===3737285){API.sendChat("Invalid target."); return}
		var chat_durations =["h","d","p","hour","day","perma","h","d","permanent","h","d","forever","1","24","endless"]
		var duration = chat_durations.indexOf(arguments[arguments.length-1])%3
		if (duration>=0){
			userBan({uid: tid, duration: duration})
		} else {
			var dur = Number(argumentsSlice(arguments,-1))
			if (isNaN(dur) || dur<0.005){API.sendChat("Invalid duration."); return}
			if (dur > 24){API.sendChat("Unable to ban for longer than 24 hours for now. Coming soon!"); return}
			duration = dur > 1 ? 1 : 0
			userBan({uid: tid, duration: duration})
			setTimeout(userUnban,dur*60*60*1000,tid)
		}
		return
	}
	, unmute: function(uid, name, target/*, *target */){
		if (!assertPermission(uid,2)){return}
		var target = argumentsSlice(arguments, 2)
		var tid = getUID(target)
		if (!tid){API.sendChat("Invalid target"); return}
		userUnmute(tid)
		return
	}
	, unban: function(uid, name, target/*, *target */){
		if (!assertPermission(uid,2)){return}
		var target = argumentsSlice(arguments, 2)
		var tid = getUID(target)
		if (!tid){API.sendChat("Invalid target"); return}
		userUnban(tid)
		return
	}
	, votestart: function(uid, name, text/*, *text */){
		/*
		Allows two types of voting: yes/no and multiple choice, depending on the number of proposals each separated by " -o ".
		Adds the necessary punctuation marks if absent.	
		At the end sets the timeout function to close the voting in two hours.
		*/
		if (!assertPermission(uid,3)){return}
		if (VOTING.proposal || VOTING.proposals) {
			API.sendChat("The voting is already in progress.")
			return
		}
		if (!text){return} // If no proposal, return from function
		
			// Turn all voting listeners off, just in case.
		API.off(API.CHAT,proposalVoting)
		API.off(API.CHAT_COMMAND,proposalVoting)
		clearTimeouts("voting")

			// Combine all the 'arguments' into one string.
		var text = argumentsSlice(arguments,2)
			
		if (text.indexOf(" -o ")>-1) {
				// Multiple choice
			VOTING.proposals = []
			VOTING.voters = []
			var props = text.split(" -o ")
			VOTING.propchat = "Let the voting begin. Today's options are: "
			for (i=0; i<props.length; i++){
				VOTING.proposals.push([props[i],0])
				VOTING.propchat += (i+1)+". "+props[i]
				if (/[.!?]/.test(VOTING.propchat.slice(-1))) {VOTING.propchat += " "}
				else {VOTING.propchat+="; "}
			}
			if (!(/[.!?]/.test(VOTING.propchat.slice(-2,-1)))) {VOTING.propchat = VOTING.propchat.slice(0,-2)+"."}
			API.sendChat(VOTING.propchat)
			setTimeout(function(){API.sendChat('Please vote for an option of your choice by typing "!vote #".')},500)
			API.on(API.CHAT,proposalVoting)
			API.on(API.CHAT_COMMAND,proposalVoting)
		} else {
				// Yes/no
			VOTING.propvotes = [0,0]
			VOTING.voters = []
			VOTING.proposal = text
			if (!(/[.!?]/.test(VOTING.proposal.slice(-1)))) {VOTING.proposal += "."}
			API.sendChat("Let the voting begin. Today's proposal is: "+VOTING.proposal)
			setTimeout(function(){API.sendChat('Please vote for or against this proposal by typing "!voteyea" or "!votenay".')},500)
			API.on(API.CHAT,proposalVoting)
			API.on(API.CHAT_COMMAND,proposalVoting)
		}
		VOTING.votestarter = uid
		timeouts.voting = setTimeout(proposalVoting, 2*60*60*1000, "/votefinish")
		return
	}
	, voteties: function(uid, name){
		if (!(assertPermission(uid,3) || VOTING.votestarter === uid)){return}
		if (!VOTING.tiedproposals){return}
		chatTools.votestart(uid, name, VOTING.tiedproposals.join(" -o "))
		setTimeout(function(){delete VOTING.tiedproposals},5000)
	}
	, votehalt: function(uid){
		if (!assertPermission(uid,3)){return}
		var s1 = VOTING.signtitle
		var s2 = VOTING.signedusers
		VOTING = Object.create(null)
		if (s1 || s2){VOTING.signtitle = s1; VOTING.signedusers = s2}
		API.off(API.CHAT, proposalVoting)
		API.off(API.CHAT_COMMAND, proposalVoting)
		clearTimeouts("voting")
	}
	, signstart: function(uid, name, text/*, *text */){
		if (!(assertPermission(uid,2) && text)){return}
		if (!VOTING.signtitle){
			var text = argumentsSlice(arguments,2)
			VOTING.signtitle = text
			VOTING.signedusers = Object.create(null)
			API.sendChat('People are needed for '+VOTING.signtitle+'! Type "!signup" to join the list.')
			timeouts.sign = setTimeout(function(){
				API.off(API.CHAT, enlistment)
				delete VOTING.signtitle
				delete VOTING.signedusers
			},2*60*60*1000)
		} else {
				API.sendChat("You have to finish the current enlistment first.")
		}
		API.on(API.CHAT, enlistment)
		return

	}
	, signhalt: function(uid){
		if (!assertPermission(uid,3)){return}
		delete VOTING.signtitle
		delete VOTING.signedusers
		API.off(API.CHAT, enlistment)
		clearTimeouts('sing')
	}
	, joinmessage: function(uid, name, timeout, /* time */ text/*, *text*/){
		if (!assertPermission(uid,3)){return}
		if (timeout === "-t"){
			var timeout = Number(text)*60*60*1000
			WLCMSG = argumentsSlice(arguments,4)
		} else {
			WLCMSG = argumentsSlice(arguments,2)
			var timeout = 1*60*60*1000
		}
		clearTimeouts('welcome')
		timeouts.welcome = setTimeout(function(){WLCMSG = ""; return},timeout)
		return
	}
	, tags: function(uid, name, artist){
		var artist = !!artist ? argumentsSlice(arguments,2) : API.getMedia().author
		$.getJSON(LASTFM.getinfo(artist), function(data){
			if (data.error){API.sendChat(data.message); return}
			if (typeof data.artist.tags !== "object"){API.sendChat("No tags found for "+artist); return}
			API.sendChat(data.artist.tags.tag.map(function(a){return a.name[0].toUpperCase()+a.name.slice(1)}).join(", ")+".")
		})
	}
	, playcount: function(uid, name, artist){
		var artist = !!artist ? argumentsSlice(arguments,2) : API.getMedia().author
		$.getJSON(LASTFM.getinfo(artist), function(data){
			if (data.error){API.sendChat(data.message); return}
			if (!data.artist.stats.userplaycount){API.sendChat(artist+" haven't been played in this room before."); return}
			API.sendChat(artist+" has been played "+data.artist.stats.userplaycount+" times in this room.")
		})
	}
};

chatFun = {
	/* Entertaining chat commands.
	All arguments are single words/numbers, except for 'name'. If an argument should consist of more
	(as denoted by *arg), it is then obtained from 'arguments'. There may be a different argument
	after the *arg, so it is obtained by taking last argument. */
	alternatives: function(){
		this.reroll = this.roll
	}
	, meow: function(uid, name, target/*, *target */){
		/* Send a random link to a cat picture in chat. */
		if (target){
			var target = argumentsSlice(arguments,2)
			var tid = getUID(target)
			target = getName(tid) || target
		} else {
			var target = name
		}
		if (PATRONS[uid].cats<10){
			var ind=Math.floor(Math.random()*catlinks.length)	// again, not really useful, but cats!
			API.sendChat("@"+target+" Here's your cat, good sir. "+catlinks[ind])
			PATRONS[uid].cats++
			if (PATRONS[uid].cats===1){
				setTimeout(function(){PATRONS[uid].cats=0},1000*60*60*24)
			}
		}else{
			API.sendChat("I'm sorry, you have exceeded your daily cat limit.")
		}
		return
	}
	, asian: function(uid, name, target/*, *target */){
		/* Send a picture of a cute asian girl. */
		if (target){
			var target = argumentsSlice(arguments,2)
			var tid = getUID(target)
			target = getName(tid) || target
		} else {
			var target = name
		}
		if (PATRONS[uid].asians<10){
			var ind=Math.floor(Math.random()*asianlinks.length)	// again, not really useful, but asians!
			API.sendChat("@"+target+" これはペンです. "+asianlinks[ind])
			PATRONS[uid].asians++
			if (PATRONS[uid].asians===1){
				setTimeout(function(){PATRONS[uid].asians=0},(1000*60*60*24))
			}
		}else{
			API.sendChat("I'm sorry, you have exceeded your daily asians limit")
		}
		return
	}
	, bean: function(uid, name, target/*, *target */){
		/* Offers toothpicks to you, a person of your choice or a random user in the room. */
		if (target){
			if (target === "rnd"){
				var users = API.getUsers()
				var target = users[Math.floor(Math.random()*users.length)].username
			} else {
				var target = argumentsSlice(arguments,2)
				var tid = getUID(target)
				target = getName(tid) || target
			}
		} else {
			var target = name
		}
		API.sendChat("@"+target+" Зубочистку?")
		return
	}
	, wowroll: function(uid, name){
		/* Returns a random number from 0 to 100. Useful for settling arguments. */
		var roll=Math.round(Math.random()*100)
		API.sendChat("@"+name+" has rolled "+roll)
		return
	}
	, roll: function(uid, name){
		/* Roulette. Max two rolls until one becomes a DJ. */
		if (PATRONS[uid].rolls < 2){
			var roll=Math.floor(Math.random()*roulette.length)
			API.sendChat("@"+name+" Your next song must be: "+roulette[roll])
			PATRONS[uid].rolls++
		} else {
			API.sendChat("@"+name+" I'm sorry, you can only reroll once.")
		}
		return
	}
	, tweek: function(uid, name, target/*, *target, number */){
		/* Sends one of the legendary tweek phrases. */
		var n = +arguments[arguments.length-1]
// 		if (!isNaN(n) && (n<-10000 || n > 10000)){return}
		var tind = n > 0 ? Math.floor((n-1)%tweek.length) : (Math.floor(n)%tweek.length + tweek.length)%tweek.length
		var index = isNaN(n) ? Math.floor(Math.random()*tweek.length) : tind
		if (target && isNaN(+target)){
			var target = argumentsSlice(arguments,2,arguments.length-(n!=NaN))
			target = getName(getUID(target)) || target
			target = "@" + target + " "
		} else {var target = ""}
		API.sendChat(target+tweek[index])
		return
	}
	, triforce: function(uid, name, proper){
		if (proper===""){
			API.sendChat("   ▲")
			setTimeout(function(){API.sendChat("▲  ▲")},200)
		} else {
			API.sendChat("▲")
			setTimeout(function(){API.sendChat("▲  ▲")},200)	
		}
		return
	}
	, plugpoints: function(uid, name, target/*, *target */){
		if (target){
			var target = argumentsSlice(arguments,2)
			var tid = getUID(target)
			if (!tid){
				API.sendChat(target+" has never been to this room.")
				return
			}
			var user = PATRONS[tid]
		} else {
			var user = PATRONS[uid]
		}
		var points = user.songplays + user.woots + user.grabs + user.wooted + user.mehed
		API.sendChat("@"+user.name+", You have "+points+" plugpoints.")
	}
	, add: function(uid, name, command, response/*, *response */){
		/* Add a custom bot response to a given command. Cannot reassign default or already existing ones. 
		Cannot have '!' or '/' at the beginning of a response, except for "/me". */
		if (!(command && response)) {return}
		if ((response[0]==="!" || response[0]==="/") && response != "/me"){
			API.sendChat("You can't start the response with '/' or '!'.")
			return
		}
		var command = command.toLowerCase()
		if (command[0]==="!"){command = command.slice(1)}
		if (command in chatUser){
			API.sendChat("That command already exists.")
			return
		}
		var response = argumentsSlice(arguments,3)	
		chatUser[command] = response
		chatUser.comminput.push([new Date(), name, command, response])
		chatCommands.savetolocalstorage(true)
		ALLCOMMANDS.update()
		return
	}
	, relay: function(uid, name, at,/* *target, */ text/*, *text */){
		/* Make KITT say whatever you want him to say. Can be used to anonymously tell Omichka that you are in love with her. 
		As with user-created commands, "!" or "/" are not accepted as the first character, except for "/me". 
		The way username is obtained out is the following: first, check what is the current longest name in the room (in words),
		then slice that many words from arguments. Starting from the longest, try to get the UID. If found — break the loop.*/
		PATRONS[uid].lastcommand = null
		if (at==="-r"){
			var longest = 0
			var name, length
			API.getUsers().forEach(function(elem){if (elem.username.split(" ").length > longest){longest = elem.username.split(" ").length}})
			var possible_name = argumentsSlice(arguments,3,3+longest)
			for (var i=longest; i>=1; i--){
				name = possible_name.split(" ").slice(0,i+1).join(" ")
				var tid = getUID(name, true)
				if (tid){length = i; break}
			}
			if (!tid){
				var text = "@"+argumentsSlice(arguments,3)
			} else {
				name = getName(tid)
				var text = "@"+name+" "+argumentsSlice(arguments,3+length)
			}
		} else {
			var text = argumentsSlice(arguments,2)
			if ((text[0]==="!" || text[0]==="/") && at != "/me" && !assertPermission(uid,0)){return}
		}
		API.sendChat(text)
		return
	}
};

chatGames = {
	hangman: function(uid, name, language){
		/* Initializes hangman mode. Only people in the master list or managers (and above) can start the game. */
		if (!assertPermission(uid,3) || !(SETTINGS.games.hangman || assertPermission(uid,0))){return}
		botHangman(language)
		return
	}
	, russian: function(uid, name, argument){
		/* Russian roulette. 1/6 chance to shoot yourself and be muted for 15 minutes. */
		russianRoulette(uid, name, argument)
		return
	}
};

chatVarious = {
	/* Some temporary and not frequently used function that have almost no benefit. */
	kitt: function(){
		/* Just a greeting. */
		if (Math.random()>=0.3){
 			API.sendChat("Yes, Michael?")
		} else{
 			API.sendChat("I'm the voice of the Knight Industries Two Thousand's microprocessor. K-I-T-T for easy reference, K.I.T.T. if you prefer.")
		}
		return
	}
	, valentine: function(uid, name, target/*, *target */){
		if (!target){return}
		if (target==="showmethescore"){
			var max = [0,'name']
			for (var key in VALENTINES){
				if (VALENTINES[key]>max[0]){
					max = [VALENTINES[key],key]
				}
			}
			API.sendChat(max[1]+" is the most loved person in this room with "+max[0]+" valentines on their hands!")
			return
		}
		var target = argumentsSlice(arguments,2)
		if (target.slice(-1)===" "){
			target = target.slice(0,-1)
		}
		if (target[0]==="@"){
			target = target.slice(1)
		}
		VALENTINES[target] = VALENTINES[target] + 1 || 1
		API.sendChat("@"+target+" :chocolate_bar: :heart:")
		return
	}
	, woot: function(uid){if (!assertPermission(uid,0)){return}; $('#woot').click()}
	, meh: function(uid){if (!assertPermission(uid,0)){return}; $('#meh').click()}
	, ping: function(uid, name){
		API.sendChat("@"+name+" pong!")
	}
	, tweekcycle: function(uid, name){
		/* Toggle KITT's persistence in adding tweek to the waitlist. */
		global_uid = uid
		SETTINGS.addtweek = Boolean(SETTINGS.addtweek^true)
		return
	}
	, sweartest: function(uid, name, text/*, *text */){
		var text = argumentsSlice(arguments, 2)
		swearingDetect({message: text, un: name}, true)
		return
	}
};

chatUser = {/* User commands are loaded from localStorage, with property being the command and value — response. */};

			// MUTATION OBSERVER
function surveillance(mutation){
	/* 
	Observes changes in the chat, catching when exactly something happened in order to avoid
	the swamp of setTimeouts in some functions. After each step checks if there even are things to do.
	Usually, after matching the pattern of a certain event, the next action is carried out (e.g. 
	after matching the "added to wait list", inside the if(){} clause user movement is happening).
	A kind of weird way to get a username in "move" is because the length of the message can vary a bit (±1 symbol).
	*/
	if (mutation[0].addedNodes.length===0 && mutation[0].removedNodes.length===0) {return}

	if (mutation[0].removedNodes.length > 0 && mutation[0].removedNodes[0].attributes[1].value===mutationlists.connectionCID){
		lost_connection_count = 0
		mutationlists.connectionCID = null
		return
	}
	
	if (mutation[0].addedNodes.length===0){return}
	
	if (mutation[0].addedNodes[0].className!="cm moderation") {return}
	
		//Patterns to look for.
	var pattern_add = /added .* to the wait list./
	var pattern_move = /moved .* from position .* to position .* in the wait list./
	var pattern_staff = /set .* as (a|the) (host|co-host|manager|bouncer|resident DJ)./
	var pattern_destaff = /removed .* from the staff./
	var pattern_muted = /muted .* for .* minutes./
	var pattern_skipped = /skipped the current DJ./
	var pattern_banned = /(banned .* from the community for one (hour|day).)|(permanently banned .* from the community.)/
	
		// Get message text.
	var msg = mutation[0].addedNodes[0].childNodes[1].childNodes[1].textContent

		// Track the dj cycle status
	if (msg==="enabled DJ cycle."){
		DJCYCLE = true
		return
	};
	if (msg==="disabled DJ cycle."){
		DJCYCLE = false
		return
	};

		// Pattern matching.
	if (pattern_add.test(msg)){
		var name = msg.slice(6,msg.length-18)
		var uid = getUID(name)
		delete mutationlists.users_to_add[uid]
		moveInList({uid: uid, name: name})
		return
	};
	if (pattern_move.test(msg)){
		var name = msg.slice(6,msg.length-49+(msg.slice(-48).search('from position ')))
		var uid = getUID(name)
		delete mutationlists.users_to_move[uid]
		return
	};
	if (pattern_destaff.test(msg)){
		var name = msg.slice(8,msg.length-16)
		var uid = getUID(name)
		PATRONS[uid].role = 0
		if (mutationlists.users_to_mute[uid]){
			userMute({uid: uid, duration: mutationlists.users_to_mute[uid][1], name: name})
		}
		return
	};
	if (pattern_muted.test(msg)){
		var name = msg.slice(6,msg.length-16)
		var uid = getUID(name)
		delete mutationlists.users_to_mute[uid]
		if (mutationlists.users_to_staff[uid]){
			setStaff({uid: uid})
		}
		setTimeout(getBansAndMutes,2000)
		return
	};
	if (pattern_banned.test(msg)){
		setTimeout(getBansAndMutes,2000)
		return
	}
	if (pattern_staff.test(msg)){
		/* "Resident DJ" is the only role consisting of two words, so that has to be check when slicing the
		message to retrieve the name. */
		var role = msg.split(" ").slice(-1)[0].slice(0,-1)
		var dj = role==="DJ"
		var name = msg.split(" ").slice(1,-(3+~~dj)).join(" ")
		var uid = getUID(name)
		delete mutationlists.users_to_staff[uid]
		PATRONS[uid].role = ["","DJ","bouncer","manager","co-host","host"].indexOf(role)
		return
	};
	if (pattern_skipped.test(msg)){
		if (mutationlists.user_to_skipadd){
			API.moderateAddDJ(mutationlists.user_to_skipadd.toString())
			mutationlists.user_to_skipadd = null
			return
		}
		if (mutationlists.user_to_skipmove){
			moveInList({uid: mutationlists.user_to_skipmove, position: 1})
			mutationlists.user_to_skipmove = null
			return
		}
		return
	}
	return
};

function createEye(){
	var target = document.querySelector('#chat-messages')
	var config = {childList: true}
	Eye = new MutationObserver(surveillance)
	Eye.observe(target,config)
	return
};

			// ON-EVENT FUNCTIONS
function waitlistUpdate(){
	/* Gets an updated waitlist and checks if it reduced in length to check for dropped users.
	If reduced, checks which user ID has been removed from the waitlist to record as "dropped". */
	var newlist = API.getWaitList().map(function(elem){return elem.id})
	if (WAITLIST.length>newlist.length){
		for (var i=0; i<WAITLIST.length; i++){
			if (newlist.indexOf(WAITLIST[i])<0 && WAITLIST[i] != API.getDJ().id){
				PATRONS[WAITLIST[i]].dropped = [Date.now(), i+1]
				chatCommands.savetolocalstorage("","PATRONS")
			}
		}
	}
	WAITLIST = [].concat(newlist) // To make sure it is copied and not referenced.
	return
}			

function mehSkip(){
	/* Skips the awful awful track. */
	if (!(SETTINGS.mehskip)){return}
	if (enoughToSkip()){
		var djname = API.getDJ().username
		API.moderateForceSkip()
		if (Math.random() > 0.6){
			setTimeout(function(){API.sendChat("@"+djname+" Вы киберунижены.")},500)
		}
	}
	return
};

function songlistUpdate(){
	/* 
	Updates the scrobble list. If either the youtube video id or both artist and song title
	match the one already present in the list — increments the play count and saves the date.
	Otherwise simply appends it to the list.
	0 — video id (not really sure what is there for soundcloud)
	1 — artist; 2 — title; 3 — last played date; 4 — play count; 5 — current play date.
	Two date fields are required to show the actual last played date, not the one
	that is "now", since the list is updated at the beginning of a song.
	*/
	if (!API.getMedia()){return}
	var found = false
	var song=API.getMedia()
	var authorlower = song.author.toLowerCase()
	var titlelower = song.title.toLowerCase()
	song.authorl = authorlower
	song.titlel = titlelower
	for (i=0; i<songlist.length; i++){
// 		if (compareSongInList(songlist[i],song)){
// 			console.log(songlist[i][0]===song.cid || (songlist[i][1].toLowerCase()===authorlower && songlist[i][2].toLowerCase()===titlelower))
// 		}
		if (songlist[i][0]==song.cid || (songlist[i][1].toLowerCase()===authorlower && songlist[i][2].toLowerCase()===titlelower)) {
// 			console.log(compareSongInList(songlist[i],song))
			songlist[i][4]++
			songlist[i][3] = songlist[i][5] // updates last played date
			songlist[i][5] = Date.now() // stores the current play date
			found = true
			break
		}
	}
	if (!found) {
		songlist.push([song.cid, song.author, song.title, Date.now(), 1, Date.now()])
	}
	return
};

function checkDJ(object){
	/* Removes current dj from left users list and resets rolls count. */
	if (!(object.dj)){return}
	PATRONS[object.dj.id].rolls = 0
	PATRONS[object.dj.id].dropped = [0,0]
	return
};

function statisticUpdate(){
	/*
	Update stats list. Saves the duration of the song, wait list length,
	time of day and chat update rate. After sufficient data have been collected,
	some sort of linear prediciton algorithm will be made up to tell how long,
	approximately, the user has to wait until it's his turn to dj.
	*/
	if (!API.getMedia()){return}
	var dur = API.getMedia().duration
	var queue = API.getWaitList().length
	var time = new Date()
	var freq = chatsstat/((time - songstats[songstats.length-1][2])/60000)
	songstats.push([dur,queue,time,freq])
	chatsstat = 0
	return
};		

function mrazotaCheck(){
	/* If the track is way too long while people are in queue — skips it. */
	if (!(SETTINGS.mrazota && API.getMedia())){return}
	var dur = API.getMedia().duration
	var queue = API.getWaitList().length
	if (dur >= 6000 && queue > 1) {
		API.moderateForceSkip()
	}
	return
};

function addTweek(data){
	if (!findInQueue(5121031)[0] && SETTINGS.addtweek && data.dj && data.dj.id!=5121031){
		API.moderateAddDJ('5121031')
	}
	return
};

function sameArtist(){
	/*
	Notifies a dj if a song by that artist (or the same song even) has already been played recently. 
	'songlist' stores times of the two latest plays, so if both are less than 3 hours old, then the same
	song has played recently.
	*/
	if (!(SETTINGS.sameartist && API.getMedia())){return}
	var date = new Date()
	var hrs = date.getHours()
	if (hrs > 0 && hrs < 8){
		chatControl.disable(4702482,'sameartist',60*(7-hrs)+10)
		return
	}
	var ql = API.getWaitList().length
	if (ql<4){return}
	var artist = API.getMedia().author
	var time = date.getTime()
	var dj = API.getDJ().username
	var played = 0
	for (var i=0; i<songlist.length; i++){
		if (songlist[i][1]===artist){
			if (songlist[i][4]>1 && (time - songlist[i][3])<3*60*60*1000 && (time - songlist[i][5])<3*60*60*1000){
				API.sendChat("@"+dj+", That song has been played very recently. Please, be more diverse in your music choice.")
				return
			}
			if ((time - songlist[i][5])<ql*4*60*1000){
 				played++
			} 
			if (played===2){
				API.sendChat("@"+dj+", A song by that artist has been played very recently. Please, be more diverse in your music choice.")
				return
			}
		}
	}
	return
};

function reallyLockWaitList(){
	if (SETTINGS.locklist){
		var q = API.getWaitList()
		for (var i=0; i<q.length; i++){
			API.moderateRemoveDJ(q[i].id)
		}
	}
	return
};

function removeFromList(){
	if (API.getWaitList().length===0){return}
	var uid = API.getWaitList().slice(-1)[0].id
	if (PATRONS[uid].leave[1]){
		API.moderateRemoveDJ(uid)
		PATRONS[uid].leave = [false, false]
	}
	return
};

function tagPlayed(){
	if (!API.getDJ()){return}
	var uid = API.getDJ().id
	if (PATRONS[uid].leave[0]){
		PATRONS[uid].leave[1] = true
	}
	return
};

function toggleCycle(manual){
	/* Turns DJ cycle on or off depending on wait list length. Called after every WAIT_LIST_UPDATE event. 
	"manual" argument is passed when called	from chat. */
	if (SETTINGS.autocycle){
		var queue = API.getWaitList().length
		if (queue>14 && DJCYCLE!=false){
			API.moderateDJCycle(false)
			DJCYCLE = false
			API.sendChat("@djs Цикл отключен! Не забываем вставать в очередь!")
		}
		if (queue<10 && DJCYCLE!=true){
			API.moderateDJCycle(true)
			DJCYCLE = true
		}
	}
	if (manual === "enable"){
		API.moderateDJCycle(true)
		chatControl.disable(4702482,'autocycle',1)
		DJCYCLE = true
	}
	if (manual === "disable"){
		API.moderateDJCycle(false)
		chatControl.disable(4702482,'autocycle',1)
		DJCYCLE = false
	}
	return
};

function updateScore(){
	if (!API.getDJ()){return}
	if (API.getTimeElapsed()<3 && !SCORE.saved){
		setTimeout(updateScore,3000)
		return
	}
	var score = API.getScore()
	var uid = API.getDJ().id
	SCORE.uid = uid
	SCORE.woot = score.positive
	SCORE.grab = score.grabs
	SCORE.meh = score.negative
	SCORE.saved = false
	return
};

function wakeUp(){
	if (API.getWaitList().length===0){return}
	var uid = API.getWaitList()[0].id
	var name = API.getWaitList()[0].username
	if (PATRONS[uid].alarm){
		API.sendChat("@"+name+", wake up!")
		PATRONS[uid].alarm = false
	}
	return
};

function recordSkip(mod,mix){
	/* Records the skipped song, mod who skipped and score at the time of skip. 
	Grabs two last songs in the history, checks if the history has been already updated
	at the time of function call (lags and all) and chooses the correct one. */
	SKIPS.last = Date.now()
	setTimeout(function(){
		var current = API.getMedia()
		var songs = API.getHistory().slice(0,2)
		var elapsed = API.getTimeElapsed()
		var total = API.getMedia().duration
		var queue = API.getWaitList().length
		if (elapsed<10){
			var song = songs[1]
		} else {
			var song = songs[0]
		}
		if (song.media.image.contains("ytimg")){
			var link = " (http://www.youtube.com/watch?v="+song.media.cid+")"
		} else {
			var link = " ("+song.media.cid+")"
		}
		var time = new Date()
		time = time.getFullYear()+"/"+(time.getMonth()+1)+"/"+time.getDate()+" "+("0"+time.getHours()).slice(-2)+":"+("0"+time.getMinutes()).slice(-2)
		var text = time+" "+mod+" skipped "+song.media.author+" - "+song.media.title+link+" when the score was "+JSON.stringify(song.score)+
				   ". Total time: "+total+"; Elapsed time: "+elapsed+"; People in queue: "+queue
		if (mix){
			var skipmix = "Skipmix initiated by "+mod+" with a duration of "+mix+" seconds."
			SKIPS.record.push([Date.now(), text, skipmix])
		} else {
			SKIPS.record.push([Date.now(), text])
		}
	},2500)
	return
};

function welcomeUser(user){
	if (!(WLCMSG && SETTINGS.welcome)){return}
	API.sendChat("@"+user.username+" "+WLCMSG)
	return
};

			// SCHEDULED FUNCTIONS

function clearIssued(command,uid){
	/* Clears issuedcommands array. */
	setTimeout(function(){
		if (PATRONS[uid].lastcommand === command) {
			PATRONS[uid].lastcommand = null
			PATRONS[uid].samecommand = 0
		}
	},2*60*1000);
	return
};

function checkConnection(){
	/*
	Every n minutes increments connection counter and sends the reset command. If bot is not 
	properly connected (can't send, receive and delete chats), the counter won't be reset and after
	reaching a limit the page will refresh.
	*/
	if (lost_connection_count===4){
		botRestart()
		return
	}
	if (API.getTimeRemaining()<1 && API.getDJ()){
		// If 0 time left of a song and someone's in a booth, then something's probably wrong. Check again in 20 secs
		// whether that's a coincidence. If the song is still stuck — restarts regardless of chat.
		lost_connection_count++
		setTimeout(function(){checkConnection()},20*1000)
	}
	if (getChatRate('short')===0){
		lost_connection_count++
		API.sendChat("!connected")
		// MutationObserver should catch the message deletion. If that didn't happen (twice in a row) — restart.
		// Timeout is because it takes some time to send and delete the message.
		// 5 seconds is long enough to not classify lags as a lost connection.
		setTimeout(function(){
			if (lost_connection_count>1){
				botRestart()
			}
		},5000)
	}
	return
};

function resetChatCounter(n){
	chatsglob[n-1]=[Date.now(),0]
	return
};

function checkStuck(){
	/* Gets the remaining time of a track and then calls itself after the song should've ended to check if it changed successfully
	by calling itself again a few times in a short period. If no one is playing, wait half an hour before next check. 
	If the song was stuck for more than ~15 seconds and couldn't have been skipped — calls itself in 30 minutes, by which
	time either everything gets fixed, plug goes down or bot restarts. */
	if (!API.getDJ() || songstuck>=7 || !SETTINGS.stuck){
		setTimeout(checkStuck,10*60*1000)
		songstuck = 0
		return
	}
	var timeleft = API.getTimeRemaining()
	if (timeleft>=3){
		songstuck = 0
		setTimeout(checkStuck,(timeleft+1)*1000)
		return
	}
	if (songstuck<3){
		songstuck++
		setTimeout(checkStuck,2000)
		return
	}
	if (songstuck<7){
		songstuck++
		API.moderateForceSkip()
		setTimeout(checkStuck,2000)
		return
	}
	return
};

			// SUPPORTING FUNCTIONS
function kittLog(object){
	if (SETTINGS.log){
		var dt = new Date()
		var time = dt.getDate()+"/"+(dt.getMonth()+1)+" "+dt.getHours()+":"+dt.getMinutes()+" "
		console.log(time, object)
	}
}

function deepObject(object,property){
	if (object[property] !== undefined){
		return object[property] = object[property]
	}
};

function argumentsSlice(object, start, stop){
	/* Recursive slice of 'arguments' object to join the necessary properties into one string. 
	Negative start/stop mean 'x from the end of an object'. First ('start') property is always returned, 
	regardless of the value of 'stop'. */
	stop = stop<0 ? object.length + stop : stop
	start = start<0 ? object.length + start : start
	if ((start<(stop-1)) || (!stop && start<object.length-1)){
		return object[start]+" "+argumentsSlice(object,start+1,stop)
	} else {
		return object[start]
	}
};

function copyObject(object){
	var copy = Object.create(null)
	for (var key in object){
		copy[key] = object[key]
	}
	if (object.length != undefined){copy.length = object.length}
	return copy
};

function nameReplacement(name){
	var ret = name.toLowerCase()
	for (var key in name_replacement_map){
		ret = ret.replace(new RegExp(key,'g'),name_replacement_map[key])
	}
	return ret
};

function swearingDetect(chatobj, test){
	/* Words from swearing list are replaced with a lot of regexp cases to make the matching very likely,
	possibly introducing false positives, which are then corrected with a list of exceptions and known
	false matchings (type II errors are imposible to correct). */
	if (chatobj.rec) {
		kittLog(chatobj)
		var text = chatobj.message
	} else {
		var orig = chatobj.message
		var text = swearParseText(chatobj.message)
	}
	var swear = false
	if (text.indexOf("!sweartest")===0 || test){var test = "TEST"} else {var test = ""}
	for (var i=0; i<swearing_list_compiled.length; i++){
		var pattern = new RegExp(swearing_list_compiled[i],'i')
		if (pattern.test(text)){swear = true; break}
	}
	if (swear){
		// check for type I errors and fix recursively.
		var word
		for (var i=0; i<swearing_list_exceptions.length; i++){
			var pattern_e = new RegExp(swearing_list_exceptions[i],'g')
			if (pattern_e.test(text)){
				word = text.match(pattern_e)[0]
				text = text.slice(0,text.indexOf(word))+text.slice(text.indexOf(word)+word.length)
				return swearingDetect({message: text, un: chatobj.un, rec: true, orig: chatobj.orig || orig}, !!test)
			}
		}
	}
	if (swear){
		// Log everything.
		var date = new Date()
		var match = text.match(pattern)
		var time = date.getDate()+"/"+(date.getMonth()+1)+" "+date.getHours()+":"+date.getMinutes()
		if (text.indexOf("sweartest")<0){
			SWEARS.push([time, chatobj.un, test, text, pattern.toString(), match[0], "ORIGINAL: "+(chatobj.orig || orig)])
		}
		kittLog(SWEARS[SWEARS.length-1])
		if (test){API.sendChat("That's swearing."); return false}
	} else if (test){
		SWEARS.push([time, chatobj.un, test, text, "NOT A SWEAR"])
	}
// 	return !test&&swear
	return swear
};

function swearingMute(chatobj){
	var swear = swearingDetect(chatobj)
	if (SETTINGS.disabled.indexOf("swear")>-1){return false}
	if (!SETTINGS.swear){
		if (!timeouts.swear){
			var now = new Date()
			var thudate = now.getDate() -  now.getDay() + 4
			var thu = new Date(now.getFullYear(), now.getMonth(), thudate, 18)
			if (now>thu){thu.setDate(thu.getDate()+7)}
			kittLog(console.log((thu.getTime() - now.getTime())/1000/60))
			timeouts.swear = setTimeout(function(){
				clearTimeouts('swear')
				clearTimeouts('welcome')
				SETTINGS.swear = true
				var wlc = SETTINGS.welcome
				var wlcm = WLCMSG
				SETTINGS.welcome = true
				WLCMSG = "Добро пожаловать на вечер чистого языка! Не ругаемся матом и прочими некрасивыми словами."
				API.sendChat("Культурный вечер начался! Пожалуйста, следите за выражениями!")
				timeouts.swear = setTimeout(function(){
					SETTINGS.swear = false
					SETTINGS.welcome = wlc
					chatTools.joinmessage(4702482, 'frederik.torve', wlcm)
					clearTimeouts('swear')
				},4*60*60*1000)
			}, thu.getTime() - now.getTime())
		}
		return false
	}
	if (swear){
		chatTools.mute('swearing', 'frederik.torve', chatobj.un, 1)
		PATRONS[chatobj.uid].chchmutes++
		API.sendChat("@"+chatobj.un+", You've been muted for 1 minute for swearing. Please don't.")
	}
	return
};
			
function compareSongInList(songinlist, songplaying){
	/* Compares the currently playing song to the one in list to find if it had been already played. Currently not in use. */
	if (songinlist[0]===songplaying.cid || (songinlist[1].toLowerCase()===songplaying.authorl && songinlist[2].toLowerCase()===songplaying.titlel)){
		return true
	}
	return false
};

function clearTimeouts(type){
	/* Clear the scheduled function of a specified type. */
	if (!!timeouts[type]){
		clearTimeout(timeouts[type])
		clearInterval(timeouts[key])
		delete timeouts[type]
		return
	}
	if (type==="all"){
		for (var key in timeouts){
			clearTimeout(timeouts[key])
			clearInterval(timeouts[key])
		}
		timeouts = Object.create(null)
		return
	}
	return
};

function proposalVoting(data){
	try {
		if (data.message[0]!="!") {
			return									// Instantly end the function if not !command.
		}
		var chat = data.message.split(" ")
		var uid = data.uid
		var uname = data.un
	} catch(e){var chat=[""];var uid=0}				// Makes it possible to call this function from chat and as a /command
		// Single proposal.
	if (chat[0].toLowerCase()==="!voteyea"){
		if (VOTING.voters.indexOf(uid)<0){
			VOTING.voters.push(uid)
			VOTING.propvotes[0]++
			if (VOTING.voters.length%5===0){
				setTimeout(function(){API.sendChat(VOTING.voters.length+" people have voted!")},1000)
			}
		} else {
			API.sendChat("@"+uname+", You have already voted. You can't revoke or change your vote.")
		}
		return
	};
	if (chat[0].toLowerCase()==="!votenay"){
		if (VOTING.voters.indexOf(uid)<0){
			VOTING.voters.push(uid)
			VOTING.propvotes[1]++
			if (VOTING.voters.length%5===0){
				setTimeout(function(){API.sendChat(VOTING.voters.length+" people have voted!")},1000)
			}
		} else {
			API.sendChat("@"+uname+", You have already voted. You can't revoke or change your vote.")
		}
		return
	};
		
		// Multiple proposals.
	if (chat[0].toLowerCase()==="!vote"){
		try {
			n = Number(chat[1])-1
		} catch(e){return}
		if (n>VOTING.proposals.length){
			API.sendChat("No such option in the poll.")
			return
		}
		if (VOTING.voters.indexOf(uid)<0){
			VOTING.voters.push(uid)
			VOTING.proposals[n][1]+=1
			if (VOTING.voters.length%5===0){
				setTimeout(function(){API.sendChat(VOTING.voters.length+" people have voted!")},1000)
			}
		} else {
			API.sendChat("@"+uname+", You have already voted. You can't revoke or change your vote.")
		}
		return
	};
		// Counting the votes.	
	if (chat[0].toLowerCase()==="!voteend" && (assertPermission(uid,3) || VOTING.votestarter === uid)) {
		// If 'proposal' is declared, the single-option voting is in process.
		if (VOTING.proposal){
			if (VOTING.propvotes[0]===0 && propvotes[1]===0){
				API.sendChat("No one has voted.")
				API.sendChat("/votefinish")
				return
			}
			var yea = "The majority has voted in favor of the proposal."
			var nay = "The majority has ruled against the proposal. No revolution today, sorry."
			var result = [nay,yea][+(VOTING.propvotes[1]<VOTING.propvotes[0])]
			API.sendChat(result)
			API.sendChat("/votefinish")			
			return
		}
		// If 'proposals' is not null, then multiple-option voting is in process.
		if (VOTING.proposals){
			var winprop = []
			var maxvotes = 0
			for (var i=0; i<VOTING.proposals.length; i++){
				if (VOTING.proposals[i][1]>maxvotes){
					winprop = [i]
					maxvotes = VOTING.proposals[i][1]
				} else if (VOTING.proposals[i][1]===maxvotes){
					winprop.push(i)
				}
			}
			if (maxvotes===0){
				API.sendChat("No one has voted.")
				API.sendChat("/votefinish")
				return
			}
			if (winprop.length===1){
				var result = VOTING.proposals[winprop[0]][0]
				if (!(/[.!?]/.test(result.slice(-1)))) {result+="."} // Add a full stop at the end of result if it's not there.
				API.sendChat("The winning option of today's voting is: "+result.slice(0,-1)+", with "+maxvotes+" votes.")
				API.sendChat("/votefinish")
			} else if (winprop.length>=4){
				API.sendChat('Four or more options have the same score of '+maxvotes+' votes. I strongly advise you to revote. Type "!revote" to do that.')
				VOTING.reproposals = VOTING.proposals
				VOTING.proposals = null
			} else {
				var ties = ""
				VOTING.tiedproposals = []
				for (j=0; j<winprop.length; j++) {
					VOTING.tiedproposals.push(VOTING.proposals[winprop[j]][0])
					ties += VOTING.proposals[winprop[j]][0]
					if (/[.!?]/.test(ties.slice(-1))) {ties+=" "}
					else {ties+="; "}
				}
				ties = ties.slice(0,-2) + "."
				VOTING.tiedproposals.forEach(function(elem){elem[1]=0})
				VOTING.proposals = null
				clearTimeouts("voting")
				API.sendChat(winprop.length+" options are tied with "+maxvotes+" votes each. They are: "+ties)
				setTimeout(function(){API.sendChat('If you would like to restart the voting with those options only, type "!voteties"')},500)
				proposalVoting("/votefinish")
			}
		}
		return
	};
	if (chat[0].toLowerCase()==="!votestandings") {
		if (VOTING.proposal) {
			if (VOTING.propvotes[0] === 0 && VOTING.propvotes[1] === 0){
				API.sendChat("No one has voted yet")
			} else {
				API.sendChat("Currently "+VOTING.propvotes[0]+" have voted 'yea', and "+VOTING.propvotes[1]+" have voted 'nay'")
			}
			return
		}
		if (VOTING.proposals) {
			var winprop = []
			var maxvotes = 0
			for (var i=0; i<VOTING.proposals.length; i++){
				if (VOTING.proposals[i][1]>maxvotes){
					winprop = [i]
					maxvotes = VOTING.proposals[i][1]
				} else if (VOTING.proposals[i][1]===maxvotes) {
					winprop.push(i)
				}
			}
			if (maxvotes === 0){
				API.sendChat("No one has voted yet")
				return
			}
			if (winprop.length === 1) {
				API.sendChat("Currently the leading option is '"+VOTING.proposals[winprop[0]][0]+"' with "+maxvotes+" votes.")
			} else {
				API.sendChat("Two or more options are tied with "+maxvotes+" votes each")
			}
			return
		}
	};
	if (chat[0].toLowerCase()==="!revote" && (assertPermission(uid,0) || VOTING.votestarter === uid)){
		// Create a "chat message" object and call a function as if a chat message was sent.
		if (VOTING.proposal){
			VOTING.propvotes = null
			var chat = {}
			chat.un = "name"
			chat.uid = VOTING.votestarter
			chat.message = "!votestart "+VOTING.proposal
			chat.cid = "0"
			VOTING.proposal = null
			chatClassifier(chat)
		}
		if (VOTING.reproposals || VOTING.proposals){
			var message = "!votestart "
			if (VOTING.reproposals){
				VOTING.reproposals.forEach(function(elem){
					message += elem[0] + " -o "
				})
			} else {
				VOTING.proposals.forEach(function(elem){
					message += elem[0] + " -o "
				})			
			}
			message = message.slice(0,-4)
			VOTING.proposals = null
			VOTING.reproposals = null
			var chat = {}
			chat.un = "name"
			chat.uid = VOTING.votestarter
			chat.message = message
			chat.cid = "0"
			chatClassifier(chat)
		}
	};
	if (chat[0].toLowerCase()==="!voteremind" && (assertPermission(uid,2) || VOTING.votestarter === uid)) {
		if (VOTING.proposal) {
			API.sendChat("The voting is in progress. Today's proposal is: "+VOTING.proposal+'. Vote by typing "!voteyea" or "!votenay"')
		}
		if (VOTING.proposals) {
			var chat = "The voting is in progress. Options are"+VOTING.propchat.slice(VOTING.propchat.indexOf(":"))
			API.sendChat(chat)
			setTimeout(function(){API.sendChat('Please vote for an option of your choice by typing "!vote #"')},500)
		}
	};
	if (data==="/votefinish"){
		// Remove all voting-related variables (except for ties) and turn off chat listeners.
		var ties = VOTING.tiedproposals
		VOTING = Object.create(null)
		if (ties){VOTING.tiedproposals = ties}
		API.off(API.CHAT,proposalVoting)
		API.off(API.CHAT_COMMAND,proposalVoting)
		clearTimeouts("voting")
	};
	return
};

function enlistment(data){
	if (data.message[0]!="!"){return}
	var command = data.message.slice(1)
	var uid = data.uid
	if (command === "signup"){
		VOTING.signedusers[uid] = data.un
		return
	}
	if (command === "withdraw"){
		delete VOTING.signedusers[uid]
		return
	}
	if (command === "signed"){
		function chatTimeout(i){
			setTimeout(function(){API.sendChat("The following people have decided to join: "+signed.slice(i*15,(i+1)*15).join(", ")+".")},i*250)
		}
		var signed = []
		for (var id in VOTING.signedusers){
			signed.push(VOTING.signedusers[id])
		}
		for (var i=0; i<=signed.length/15; i++){
			chatTimeout(i)
		}
		return
	}
	if (command === "signend" && assertPermission(uid,2)){
		enlistment({message:'!signed',uid:uid})
		delete VOTING.signtitle
		delete VOTING.signedusers
		clearTimeouts("sign")
		API.off(API.CHAT,enlistment)
		return
	}
	if (command === "signhalt" && assertPermission(uid,3)){
		delete VOTING.signtitle
		delete VOTING.signedusers
		clearTimeouts("sign")
		API.off(API.CHAT,enlistment)
		return	
	}
	return
};

function findInQueue(uid){
	/* Find out if the persion is in the wait list and their position, if in the queue. 
	Double negative is because Array.every() stops at the first False. */
	var q = API.getWaitList()
	var i = 0
	return [!q.every(function(user){i++; return user.id!=uid}),i]
};

function getUID(name, online){
	var users = API.getUsers()
	var uid
	if (name[0]==="@"){var name = name.slice(1)}
	var exactname = false
	for (var i=0; i<name.length; i++){
		if (name.charCodeAt(i)>65278 && name.charCodeAt(i)<65375){
			exactname = true
			break
		}
	}
	if (!exactname){
		var pattern = new RegExp(nameReplacement(name),'i')
		users.forEach(function(elem){
			var username = elem.username.split("").map(wideLetters).join("").replace(/[\s]+/g,"")
			if (pattern.test(username)){uid = elem.id}
		})
		if (!(uid || online)){
			for (var key in PATRONS){
				var username = PATRONS[key].name.split("").map(wideLetters).join("").replace(/[\s]+/g,"")
				if (pattern.test(username)){uid = PATRONS[key].id; break}
			}
		}
		return uid
	} else {
		users.forEach(function(elem){if (elem.username===name){uid = elem.id}})
		if (!uid){
			for (var key in PATRONS){
				if (PATRONS[key].name === name){
					uid = PATRONS[key].id
				}
			}
		}
		return uid	
	}
};

function getName(uid){
	var users = API.getUsers()
	var name
	users.forEach(function(elem){if (elem.id===uid){name = elem.username}})
	if (!name){
		if (PATRONS[uid]){
			name = PATRONS[uid].name
		}
	}
	return name
};

function getChatRate(type){
	/* 
	Gets chat rate from one of the two counters. Either the one that was
	reset most recently (checkConnection function uses it to catch connection failure sooner),
	or the one that was collecting chats for at least 15 minutes. At any point in time one of them
	has number of chats from the last 15-30 minutes, and the other from the last 0-15 minutes.
	'short' will still pick the longer counter if the actual short one has the data for less than 5 mintues (i.e. has been just reset).
	Nice XOR allows to have only one if/else to get the required one.
	*/
	if (((Date.now()-chatsglob[0][0])>15*60*1000)^(type==="short" && (Date.now()-chatsglob[0][0])>5*60*1000)) {
		var chatrate = chatsglob[0][1]/(Date.now()-chatsglob[0][0])
	} else {
		var chatrate = chatsglob[1][1]/(Date.now()-chatsglob[1][0])
	}
	return chatrate
};

function assertPermission(uid,n){
	/* Checks if the user has permission to do a certain action. 
	1 — resident DJ; 2 — bouncer; 3 — manager; 4 — cohost; 5 — host; 0 — MasterList only. 
	"n^2/n" is there to make n=0 always fail that check regardless of any changes in plug roles,
	at the same time retaining the simple ">=n" for n!=0. */
	return MasterList.indexOf(uid)>-1 || API.getUser(uid).role>=((n*n)/n)
};

function enableSetting(uid, setting/*, *settings */){
	global_uid = uid
	if (arguments[1]==="all"){
		var args = [uid].concat(Object.keys(SETTINGS))
		args.splice(args.indexOf("locklist"),1)
		enableSetting.apply(this, args)
		return
	}
	for (var i=1; i<arguments.length; i++){
		var path = arguments[i].split(".")
		var last = path.pop()
		if (typeof path.reduce(deepObject,SETTINGS)[last] === "boolean") {
			path.reduce(deepObject,SETTINGS)[last] = true
		} else if (typeof path.reduce(deepObject,SETTINGS)[last] === "object"){
			for (var key in path.reduce(deepObject,SETTINGS)[last]){
				if (typeof path.reduce(deepObject,SETTINGS)[last][key] === "boolean"){
					path.reduce(deepObject,SETTINGS)[last][key] = true
				}
			}
		}
	}
	return
};

function disableSetting(uid, setting/*, *settings */){
	global_uid = uid
	if (arguments[1]==="all"){
		var args = [uid].concat(Object.keys(SETTINGS))
		args.splice(args.indexOf("locklist"),1)
		disableSetting.apply(this, args)
		return
	}
	for (var i=1; i<arguments.length; i++){
		var path = arguments[i].split(".")
		var last = path.pop()
		if (typeof path.reduce(deepObject,SETTINGS)[last] === "boolean") {
			path.reduce(deepObject,SETTINGS)[last] = false
		} else if (typeof path.reduce(deepObject,SETTINGS)[last] === "object"){
			for (var key in path.reduce(deepObject,SETTINGS)[last]){
				if (typeof path.reduce(deepObject,SETTINGS)[last][key] === "boolean"){
					path.reduce(deepObject,SETTINGS)[last][key] = false
				}
			}
		}
	}
	return
};

function enoughToSkip(loong){
	var score = API.getScore()
	var users = API.getUsers()
	var grey = 0
	users.forEach(function(elem){if (elem.role<=1){grey++}})
	if (API.getTimeElapsed()<10){return false}
	if (loong){
		return score.negative >= (Math.floor(score.positive*1)+Math.floor(grey/5)+2)
	} else {
		return score.negative >= (Math.floor(score.positive*1.25)+Math.floor(grey/5)+3)
	}
};

function skipMix(songid, duration, name){
	var id = API.getMedia().cid
	clearTimeouts("skipmix")
	SKIPS.skipmixtime = null
	if (songid !== id) {
		return
	}
	if (API.getTimeElapsed()>=(duration-5)){
		API.moderateForceSkip()
		recordSkip(name, duration)
	}
	return
};

function kittChats(data){
	/* Tracks messages from bot and acts if needed. */
	kittLog(data.cid)
	var p_lastpos = /is not in the list of disconnected users.$/
	var p_wakeup = /wake up!$/
	var p_hangman = /(That letter has already been guessed!)|(Sorry, no such letter in the word!)|(Sorry, that's not the word!)/
	if (p_lastpos.test(data.message)){
		setTimeout(function(){API.moderateDeleteChat(data.cid)},3000)
	}
	if (p_wakeup.test(data.message)){
		API.moderateDeleteChat(data.cid)
	}
	if (p_hangman.test(data.message)){
		setTimeout(API.moderateDeleteChat,5000,data.cid)
	}
	return
};

function checkSpam(uid, name, command){
	/* Checks if the last 5 commands from a user were the same. If that's the case, mutes them for 15 mniutes. */
	if (ALLCOMMANDS.check(command)>-1){
		PATRONS[uid].commands += 1
	}
	if (!SETTINGS.spam){return false}
	if (command===PATRONS[uid].lastcommand) {
		PATRONS[uid].samecommand++
	} else {
		PATRONS[uid].lastcommand = command
		PATRONS[uid].samecommand = 0
		clearIssued(command,uid)
	}
	
	if (PATRONS[uid].samecommand === 4) {
		API.sendChat("@"+name+" If you send the same command once more, divine punishment will befall you.")
		return true
	};
	if (PATRONS[uid].samecommand >= 5) {
		userMute({uid: uid, duration: 1})
		return true
	};
	return false
};

function addNoCycle(advance_object){
	if (!advance_object.lastPlay){return}
	var dj = advance_object.lastPlay.dj
	if (PATRONS[dj.id].cycleadd){
		API.moderateAddDJ(String(dj.id))
		PATRONS[dj.id].cycleadd = false
	}
};

			// MODERATION
function moveInList(UPN){
	/* Move a person in wait list. UPN stands for UID, Position, Name — three properties of argument object
	that needs to be passed. At least uid or name has to be given. */
	var uid = UPN.uid || getUID(UPN.name)
	var name = UPN.name || getName(UPN.uid)
	if (mutationlists.users_to_move[uid] && findInQueue(uid)[1]>mutationlists.users_to_move[uid]){
		API.moderateMoveDJ(uid,mutationlists.users_to_move[uid])
	} else {delete mutationlists.users_to_move[uid]}
	
	if (UPN.position){
		API.moderateMoveDJ(uid,UPN.position)
	}
	return
};

function userMute(UDN){
	/* Mute a user for a given duration. UDN stands for UID, Duration, Name — three properties of argument object that
	that needs to be passed, with uid or name being optional, but not both. */
	var uid = UDN.uid || getUID(UDN.name)
	var duration = [API.MUTE.SHORT,API.MUTE.MEDIUM,API.MUTE.LONG][UDN.duration]
	API.moderateMuteUser(uid,1,duration)
	return
};

function staffMute(UDN){
	/* Mutes staff member by removing them from staff, muting and adding back to staff (with the help of The Eye).
	In two seconds checks if the role has been given back properly.
	UDN stands for UID, Duration, Name — three properties of argument object that that needs to be passed, 
	with uid or name being optional, but not both. */
	var uid = UDN.uid || getUID(UDN.name)
	var name = UDN.name || getName(UDN.uid)
	var role = API.getUser(UDN.uid).role
	mutationlists.users_to_mute[uid] = [true,UDN.duration]
	mutationlists.users_to_staff[uid]=role
	API.moderateSetRole(uid,0)
	setTimeout(function(){if (API.getUser(uid).role!=role){API.moderateSetRole(uid,role)}},2000)
	return
};

function userBan(UDN){
	/* Ban a user for a given duration. UDN stands for UID, Duration, Name — three properties of argument object that
	that needs to be passed, with uid or name being optional, but not both. */
	var uid = UDN.uid || getUID(UDN.name)
	var duration = [API.BAN.HOUR, API.BAN.DAY, API.BAN.PERMA][UDN.duration]
	API.moderateBanUser(uid,1,duration)
	return
};

function userUnmute(uid){
	API.moderateUnmuteUser(uid)
	return
};

function userUnban(uid){
	API.moderateUnbanUser(uid)
	return
};

function setStaff(URN){
	/* Set user role. 0 — remove from staff. URN stands for UID, Role, Name — three properties of argument object that
	that needs to be passed, with uid or name being optional, but not both. */
	var uid = URN.uid || getUID(URN.name)
	if (URN.role != undefined){
		API.moderateSetRole(uid,URN.role)
		PATRONS[uid].role = URN.role
		return
	}
	if (mutationlists.users_to_staff[URN.uid]){
		API.moderateSetRole(URN,uid,mutationlists.users_to_staff[URN.uid])
	}
	return
};

function getBansAndMutes(){
	$('#users-button').click()
	setTimeout(function(){$('div.button.bans').click()},333)
	setTimeout(function(){$('div.button.mutes').click()},666)
	setTimeout(function(){$('#chat-button').click()},1000)
}

			// PATRON FUNCTIONS			
function updatePatrons(){
	var u = API.getUsers()
	for (var i=0; i<u.length; i++) {
		var user = u[i]
		updatePatron(user)
	}
	return
};

function modifyPatron(name, prop, value){
	var uid = getUID(name)
	if (!uid){return}
	
	if (typeof PATRONS[uid][prop] === "number"){
		PATRONS[uid][prop] = parseInt(value)
	}
	return
};

function updatePatron(user){
	if (!PATRONS[user.id]){
		var patron = new Patron(user.id)
		patron.joined = Date.now()
		patron.name = user.username
		patron.session = Date.now()
	} else {
		var patron = PATRONS[user.id]
	}
	if (patron.name != user.username) {
		patron.prevnames.push(patron.name)
		patron.name = user.username
	}
	patron.lastseen = Date.now()
	patron.role = user.role
	patron.prole = user.role
	PATRONS[user.id] = patron
	return
};

function patronJoin(user){
	if (!PATRONS[user.id]){
		updatePatron(user)
	} else {
		var patron = PATRONS[user.id]
		if (patron.name != user.username) {
			patron.prevnames.push(patron.name)
			patron.name = user.username
		}
		if (patron.role != user.role){
			API.moderateSetRole(user.id,patron.role)
		}
		patron.session = Date.now()
		patron.online = true
		PATRONS[user.id] = patron
		if (patron.name === "твик"){
			chatFun.meow(patron.id, patron.name, patron.name)
			PATRONS[user.id].cats -= 1
		}
	}
	return
};

function patronLeave(user){
	if (PATRONS[user.id]){
		PATRONS[user.id].lastseen = Date.now()
		PATRONS[user.id].online = false
		PATRONS[user.id].alarm = false
		PATRONS[user.id].leave = [false, false]
	}
	return
};

function patronPlayed(data){
	if (!data.dj){return}
	PATRONS[data.dj.id].songplays += 1
	return
};

function patronScore(){
	var woot = SCORE.woot
	var meh = SCORE.meh
	var grab = SCORE.grab
	var uid = SCORE.uid
	if (!uid){return}
	PATRONS[uid].woots += woot
	PATRONS[uid].grabs += grab
	PATRONS[uid].mehs += meh
	SCORE = {woot: 0, meh: 0, grab: 0, uid: uid}
	SCORE.saved = true
	updateScore()
	return
};

function patronVote(data){
	/* Updates the votes of a patrons. If the song id of the last vote is not the same is this one,
	simply adds the score/grabs, otherwise checks what the last vote was and removes it from 
	the patron object, adding the new one. */
	var uid = data.user.id
	var score = data.vote
	var grab = data.user.grab
	var user = PATRONS[uid]
	var sid = API.getMedia().cid
	if (user.lastvote.sid != sid){
		score > 0 ? user.wooted += 1 : user.mehed += 1
		user.lastvote.grab = grab
		user.grabbed += +grab
		user.lastvote.sid = sid
		user.lastvote.vote = score
		PATRONS[uid] = user
		return
	}
	if (!user.lastvote.grab && grab){
		user.grabbed += 1
		user.lastvote.grab = true
	}
	if (user.lastvote.vote === score || score === 0){PATRONS[uid] = user; return}
	if (user.lastvote.vote != 0){
		user.lastvote.vote > 0 ? user.wooted -= 1 : user.mehed -= 1
	}
	score > 0 ? user.wooted += 1 : user.mehed += 1
	user.lastvote.vote = score
	PATRONS[uid] = user
	return
};

			// GAMES
function hangmanChat(data){
	/* Handles hangman-related chats. */
	var msg = data.message
	var uname = data.un
	var uid = data.uid
	if ((msg.split(" ")[0]==="!letter" || msg.split(" ")[0]==="!lt") && msg.split(" ").length>1){
		hangman(msg.split(" ")[1].toLowerCase(),"letter",uname)
		PATRONS[uid].samecommand = 0
	};
	if ((msg.split(" ")[0]==="!word" || msg.split(" ")[0]==="!wd") && msg.split(" ").length>1){
		hangman(msg.split(" ")[1].toLowerCase(),"word",uname)
		PATRONS[uid].samecommand = 0
	};
	if (msg==="!hangstop" && assertPermission(data.uid,3)){
		mode = "normal"
		HANGMAN.word = ""
		HANGMAN.uword = ""
		HANGMAN.count = 0
		API.off(API.CHAT, hangchat)
	};
};

function hangman(chat,type,name){
	/* Checks the word or letter, case-independent. Gives 10 tries to guess the word. */
	var wrd = HANGMAN.word
	var wrdg = HANGMAN.uword
	var indc = []
	if (type==="word"){
		if (chat.toLowerCase()===wrd.toLowerCase()){
			wrdg = wrd
		} else{
			API.sendChat("Sorry, that's not the word!")
		}
	};
	if (type==="letter"){
		if (HANGMAN.language=="Russian" && !/^[а-яёй]$/.test(chat)){return}
		if (HANGMAN.language=="English" && !/^[a-z]$/.test(chat)){return}
		if (HANGMAN.tried.indexOf(chat.toLowerCase())>-1){
			API.sendChat("That letter has already been guessed!")
		} else{
			indc = letind(wrd.toLowerCase(), chat.toLowerCase())
			if (indc.length>0){
				API.sendChat("Correct!")
				for (i=0; i<indc.length; i++){
					wrdg = wrdg.substr(0,indc[i]*2)+wrd[indc[i]]+wrdg.substr(indc[i]*2+1)
				}
				if (wrdg.indexOf("_")>=0){setTimeout(function(){API.sendChat(wrdg)},250)}
			} else{
				API.sendChat("Sorry, no such letter in the word!")
				HANGMAN.count++
			}
		}
		HANGMAN.tried.push(chat.toLowerCase())
	};
	HANGMAN.uword = wrdg	
	if (wrdg===wrd || wrdg.indexOf("_")===-1){
		setTimeout(function(){API.sendChat("Congratulations @"+name+", you have won! The word was: "+wrd)},(250))
		var uid = getUID(name)
		PATRONS[uid].hangmanwords.push(HANGMAN.word)
		PATRONS[uid].hangmanwins++
		mode = "normal"
		HANGMAN = Object.create(null)
		API.off(API.CHAT, hangmanChat)
		return
	};
	if (HANGMAN.count>=10){
		setTimeout(function(){API.sendChat("Ah, wrong once again! You've been hung. The word was: "+wrd)},(250))
		mode = "normal"
		HANGMAN = Object.create(null)
		API.off(API.CHAT, hangmanChat)
		return
	};
	return
};

function russianRoulette(uid, name, argument){
	PATRONS[uid].lastcommand = null
	if (argument==="score"){
		API.sendChat("@"+name+" "+PATRONS[uid].roulette+", "+(""+Math.pow(0.833,PATRONS[uid].roulette)*100).slice(0,5)+"%")
		return
	}
	if (argument==="highest"){
		var highest = true
		for (var key in PATRONS){
			if (PATRONS[key].rouletterecord>PATRONS[uid].rouletterecord){
				highest = false
			}
		}
		API.sendChat("@"+name+"'s highest score was "+PATRONS[uid].rouletterecord+", "+(""+Math.pow(0.833,PATRONS[uid].rouletterecord)*100).slice(0,5)+"%"+
			["",". Highest in this room!"][~~highest])
		return
	}
	if (argument==="highscore"){
		var max = [0,'name']
		for (var key in PATRONS){
			if (PATRONS[key].rouletterecord>max[0]){
				max = [PATRONS[key].rouletterecord,PATRONS[key].name]
			}
		}
		API.sendChat(max[1]+" is the luckiest person in this room with "+max[0]+" consecutive clicks.")
		return
	}
	if (Math.random()<=(1/6)){
		PATRONS[uid].roulette = 0
		API.sendChat("/me @"+name+" BANG!")
		var role = API.getUser(uid).role
		if (role>0) {staffMute({uid: uid, duration: 0}) 
		} else {userMute({uid: uid, duration: 0})}
		setTimeout(function(){API.sendChat("@"+name+" You've been muted for 15 minutes.")},250)
	} else {
		PATRONS[uid].roulette = PATRONS[uid].roulette+1
		if (PATRONS[uid].roulette>PATRONS[uid].rouletterecord){
			PATRONS[uid].rouletterecord = PATRONS[uid].roulette
		}
		API.sendChat("/me @"+name+" click")
	}
	return
};

			// Classes
function Patron(id){
		// essential
	this.id = id
	this.name = null
	this.joined = null
	this.lastseen = null
	this.session = null
	this.prevnames = []
	this.role = 0
	this.prole = 0
	this.online = true
	this.alarm = false
	this.leave = [false, false]
	this.dropped = [0,0]
	this.cycleadd = false
		// stats
	this.commands = 0
	this.messages = 0
	this.songplays = 0
	this.woots = 0
	this.grabs = 0
	this.mehs = 0
	this.wooted = 0
	this.grabbed = 0
	this.mehed = 0
	this.lastvote = {sid: 0, vote: 0, grab: false}
		// limits
	this.commandrate = 0
	this.samecommand = 0
	this.lastcommand = null
	this.cats = 0
	this.asians = 0
	this.rolls = 0
		// games
	this.roulette = 0
	this.rouletterecord = 0
	this.hangmanwins = 0
	this.hangmanwords = []
	this.chchmutes = 0
};

			// RegExp replacements and text parsing
function fixLinksAndEmoji(message){
	var text = message
	var pattern_link = /(.*)(<a href=")(.*)(" target=)(.*)(<\/a>)(.*)/
	var pattern_emoji = /(.*)(<span class="emoji)(.*)(<span class="emoji )(.*)("><\/span><\/span>)(.*)/
	var pattern_emojicodes = /emoji-(?!glow)[a-z0-9\-]*(?=")/gi
	var hasemoji = false

	text = text.replace(/&#34;/g,'"').replace(/&#39;/,"'")

	while (pattern_link.test(text)){
		text = text.replace(pattern_link,'$1$3$7')	// replace <a href>...</a> (if present) with just a text link
	}
		// If no emojis — return the text now
	if (pattern_emoji.test(text)){
		hasemoji = true
		var emojicodes = text.match(pattern_emojicodes)
	} else {
		return text
	}
	while (pattern_emoji.test(text)){
		text = text.replace(pattern_emoji,'$1$5$7')	// replace emoji <span>s with "emoji-xxxxx"
	}
	function getEmoji(text){
		// Either gets the emoji from dictionary (emoji-1f521 -> :accept:) or, 
		// if lucky, simply slices the text (e.g. emoji-shipit -> :shipit:)
		if (text in EMOJIDICT){
			return ":"+EMOJIDICT[text]+":"
		} else {
			return ":"+text.slice(6)+":"
		}
	}
	for (var i=0; i<emojicodes.length; i++){
		// Replace all "emoji-xxxxx" with the corresponding ":emoji:"
		text = text.replace(emojicodes[i],getEmoji(emojicodes[i]))
	}
	return text
};

function wideLetters(letter){
	if (letter.charCodeAt(0)>65280 && letter.charCodeAt(0)<65375){
		return String.fromCharCode(letter.charCodeAt(0)-65248)
	} else if (letter.charCodeAt(0)==65279){
		return ""
	} else if (letter==="." || letter==="_"){
		return ""
	} else {
		return letter
	}
};

function removeSpecialCharacters(string){
	var pattern = /[^a-z0-9а-яёй\s]/gi
	var out = string.replace(pattern,"")
	return out
};

function swearParseText(string){
	/* Prepares the message for swearing check. Fixes links and emojis (as usual),
	checks whether it has someone's username at the beginning and removes it,
	in canse it is 'bitolhuitol' or similar, then converts all the stupid 'wide'
	letters into their proper counterparts and, at the end, removes all special characters,
	leaving only letters and spaces in the text. */
	var out = fixLinksAndEmoji(string.toLowerCase())
	if (out[0]==="@"){
		var name = out.split(" ")[0].slice(1)
		if (getUID(name, true)){
			name = getName(getUID(name))
			out = out.slice(name.length+1)
		}
	}
	out = out.split("").map(wideLetters).join("")
	out = removeSpecialCharacters(out)
	return out
};

var name_replacement_map = {'[аa]+': "[аa]+", '[bв]+': "[bв]+", '[сc]+': "[сc]+", '[d]+': "[d]+",
	'[eе]+': "[eе]+", '[f]+': "[f]+", '[hн]+': "[hн]+", '[il]+': "[il]+", '[j]+': "[j]+", '[kк]+': "[kк]+", '[mм]+': "[mм]+",
	'[nп]+': "[nп]+", '[oо]+': "[oо]+", '[pр]+': "[pр]+", '[q]+': "[q]+", '[rг]+': "[rг]+", '[s]+': "[s]+", '[tт]+': "[tт]+",
	'[u]+': "[u]+", '[v]+': "[v]+", '[w]+': "[w]+", '[xх]+': "[xх]+", '[уy]+': "[уy]+", '[z]+': "[z]+", '[д]+': "[д]+", 
	'[ё]+': "[ё]+", '[ж]+': "[ж]+", '[з]+': "[з]+", '[и]+': "[и]+", '[й]+': "[й]+", '[л]+': "[л]+", '[ф]+': "[ф]+", 
	'[ц]+': "[ц]+", '[ч]+': "[ч]+", '[ш]+': "[ш]+", '[щ]+': "[щ]+", '[ьъ]+': "[ьъ]+", '[ы]+': "[ы]+", '[э]+': "[э]+", 
	'[ю]+': "[ю]+", '[я]+': "[я]+", '[\\s]+':"[\\s]*", '[.]+': "[.]*", '[\\_]+':"[\\_]*"};

var swearing_replacement_map = {'а+': "[аa]+[\\s]*", 'б+': "[бb6]+[\\s]*", 'в+': "[vвb]+[\\s]*", '[гrg]+': "[гrg]+[\\s]*", '[дd]+': "[дd]+[\\s]*",
	'[её]+': "([еёe]+|(ye)+|(yo)+|(jo)+|(je)+)[\\s]*", 'ж+': "([жjg]+|(zh)+|(jh)+)[\\s]*", 'з+': "[3зz]+[\\s]*", '[ий]+': "([ийujyieеn]+)[\\s]*",
	'к+': "[кk]+[\\s]*", 'л+': "([лl]+|(jl)+|(ji)+)[\\s]*", 'м+': "([мm]+|(rn)+)[\\s]*", 'н+': "[нh]+[\\s]*", 'о+': "[оo0]+[\\s]*",
	'п+': "[пnpр]+[\\s]*", 'р+(?!\\])': "[рrp]+[\\s]*", 'с+': "[сcs]+[\\s]*", 'т+': "[тt]+[\\s]*", 'у+': "[уuy]+[\\s]*", 'ф+': "([фf]+|(ph)+)[\\s]*",
	'х+': "[хxh]+[\\s]*", 'ц+': "([цc]+|(ts)+)[\\s]*", 'ч+': "([ч]+|(ch)+)[\\s]*", 'ш+': "([ш]+|(sh)+)[\\s]*", 'щ+': "([щ]+|(sh)+|(sh')+[\\s]*",
	'[ъь]+': "[bъь']+[\\s]*", 'ы+': "([ыi]+|(bi)+|(bl)+)[\\s]*", 'э+': "[e]+[\\s]*", 'ю+': "([ю]+|([йи]+у)+|(yu)+|(ju)+)[\\s]*",
	'я+': "([я]+|(ий]+а)+|(ya)+|(ja)+)[\\s]*"};

var swearing_list_source = ['пидор', 'пидр', 'пидар', 'педик', 'бля', 'блядь', 'блять', 'сука',
	'сучка', 'сцука', 'мудак', 'мудил', 'хуй', 'хуе', 'хуя', 'блеать', 'блеадь', 'пизд', 'пзд',
	'пезд', 'говно', 'гавно', 'гавен', 'говен', 'гавён', 'говён', 'ебк','ебу', 'падла', 'параш',
	'далбо', 'долбо', 'епт', 'хуле', 'хули', 'блад', 'мразь', 'блят', 'бляд', 'сосат', 'сасат',
	'блджа', 'уеб', 'еба', 'ебёт', 'ебёшь', 'мудл', 'мудач', 'шлюх', 'шлюш', '[\\s]+ипат', '[\\s]ипал', 'куес', 'куил',
	'хуе', '[\\s]бле[\\s]', 'ублюдок', 'манда'];

var swearing_list_compiled = ['cerf','ыглф',',kz'].concat.apply([],swearing_list_source.map(function(elem){
		var word = elem
		for (var key in swearing_replacement_map){
			var pattern = new RegExp(key,'g')
			if (pattern.test(elem)){
				word = word.replace(pattern,swearing_replacement_map[key])
			}
		}
		return word
}));

var swearing_list_exceptions = ['требушет', 'габен', 'бляшка', 'из (?!да[tт\\s]|до[^jyий]|де[tт\\s]|дющ|дё[jhжн]|ди[шт])',
	'вла', '[её] бу[^щ\\s]', 'до[мтнквд][ауио]', '[^\\s]е[\\s]*р[\\s]*т[^\\s]', 'употребл', 'потребле',
	'[^\\s]е[\\s]*п[\\s]*т[^\\sе]', '([^\\s]ent)|(ent[^\\s])', 'govnosuka', 'http.*([\\s\\b]|$)', 'en t', '[^\\s]еп т[^\\s]',
	'[^\\sауъь]е[\\s]*б[\\s]*а[^нт]', '[^\\s]ебу[^\\s]', 'bitohuitol', 'любл', '[^\\s]ебе т', 'ред', 'рубл',
	'[^\\sг]e[\\s]*b[\\s]*[au][^\\stn]', 'н[её]б[ао]', 'ридо', '[^\\s]м уд[^\\s]', '[^\\s]му д[^\\s]'];

			// STACKOVERFLOW SOLUTIONS
/*
Saves and loads object in localStorage. 
localStorage can only hold strings, so object is stringifed and
then parsed when needs to be loaded.
*/
Storage.prototype.setObject = function(key, value) {
    this.setItem(key, JSON.stringify(value));
};

Storage.prototype.getObject = function(key) {
    var value = this.getItem(key);
    return value && JSON.parse(value);
};

function letind(word, letter){
	// finds all occurrences of a letter in the word and returns its indices
  var result = [];
  for(i=0;i<word.length; ++i) {
    // If you want to search case insensitive use 
    // if (source.substring(i, i + find.length).toLowerCase() == find) {
    if (word.substring(i, i + letter.length) == letter) {
      result.push(i);
    }
  }
  return result;
};

/* MD5 by Joseph Myers */
var MD5 = {
	md5: function(s){
		var txt = '';
		var n = s.length;
		var state = [1732584193, -271733879, -1732584194, 271733878];
		var i;
		for (i=64; i<=s.length; i+=64) {
			this.md5cycle(state, this.md5blk(s.substring(i-64, i)));
		}
		s = s.substring(i-64);
		var tail = [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
		for (i=0; i<s.length; i++){
			tail[i>>2] |= s.charCodeAt(i) << ((i%4) << 3);
		}
		tail[i>>2] |= 0x80 << ((i%4) << 3);
		if (i > 55) {
			this.md5cycle(state, tail);
			for (i=0; i<16; i++) tail[i] = 0;
		}
		tail[14] = n*8;
		this.md5cycle(state, tail);
		return this.hex(state);
	}
	, md5blk: function(s){
		var md5blks = [], i;
		for (i=0; i<64; i+=4) {
			md5blks[i>>2] = s.charCodeAt(i)
			+ (s.charCodeAt(i+1) << 8)
			+ (s.charCodeAt(i+2) << 16)
			+ (s.charCodeAt(i+3) << 24);
		}
		return md5blks;
	}
	, md5cycle: function(x,k){
		var a = x[0], b = x[1], c = x[2], d = x[3];
		
		a = this.ff(a, b, c, d, k[0], 7, -680876936);
		d = this.ff(d, a, b, c, k[1], 12, -389564586);
		c = this.ff(c, d, a, b, k[2], 17,  606105819);
		b = this.ff(b, c, d, a, k[3], 22, -1044525330);
		a = this.ff(a, b, c, d, k[4], 7, -176418897);
		d = this.ff(d, a, b, c, k[5], 12,  1200080426);
		c = this.ff(c, d, a, b, k[6], 17, -1473231341);
		b = this.ff(b, c, d, a, k[7], 22, -45705983);
		a = this.ff(a, b, c, d, k[8], 7,  1770035416);
		d = this.ff(d, a, b, c, k[9], 12, -1958414417);
		c = this.ff(c, d, a, b, k[10], 17, -42063);
		b = this.ff(b, c, d, a, k[11], 22, -1990404162);
		a = this.ff(a, b, c, d, k[12], 7,  1804603682);
		d = this.ff(d, a, b, c, k[13], 12, -40341101);
		c = this.ff(c, d, a, b, k[14], 17, -1502002290);
		b = this.ff(b, c, d, a, k[15], 22,  1236535329);
		
		a = this.gg(a, b, c, d, k[1], 5, -165796510);
		d = this.gg(d, a, b, c, k[6], 9, -1069501632);
		c = this.gg(c, d, a, b, k[11], 14,  643717713);
		b = this.gg(b, c, d, a, k[0], 20, -373897302);
		a = this.gg(a, b, c, d, k[5], 5, -701558691);
		d = this.gg(d, a, b, c, k[10], 9,  38016083);
		c = this.gg(c, d, a, b, k[15], 14, -660478335);
		b = this.gg(b, c, d, a, k[4], 20, -405537848);
		a = this.gg(a, b, c, d, k[9], 5,  568446438);
		d = this.gg(d, a, b, c, k[14], 9, -1019803690);
		c = this.gg(c, d, a, b, k[3], 14, -187363961);
		b = this.gg(b, c, d, a, k[8], 20,  1163531501);
		a = this.gg(a, b, c, d, k[13], 5, -1444681467);
		d = this.gg(d, a, b, c, k[2], 9, -51403784);
		c = this.gg(c, d, a, b, k[7], 14,  1735328473);
		b = this.gg(b, c, d, a, k[12], 20, -1926607734);
		
		a = this.hh(a, b, c, d, k[5], 4, -378558);
		d = this.hh(d, a, b, c, k[8], 11, -2022574463);
		c = this.hh(c, d, a, b, k[11], 16,  1839030562);
		b = this.hh(b, c, d, a, k[14], 23, -35309556);
		a = this.hh(a, b, c, d, k[1], 4, -1530992060);
		d = this.hh(d, a, b, c, k[4], 11,  1272893353);
		c = this.hh(c, d, a, b, k[7], 16, -155497632);
		b = this.hh(b, c, d, a, k[10], 23, -1094730640);
		a = this.hh(a, b, c, d, k[13], 4,  681279174);
		d = this.hh(d, a, b, c, k[0], 11, -358537222);
		c = this.hh(c, d, a, b, k[3], 16, -722521979);
		b = this.hh(b, c, d, a, k[6], 23,  76029189);
		a = this.hh(a, b, c, d, k[9], 4, -640364487);
		d = this.hh(d, a, b, c, k[12], 11, -421815835);
		c = this.hh(c, d, a, b, k[15], 16,  530742520);
		b = this.hh(b, c, d, a, k[2], 23, -995338651);
		
		a = this.ii(a, b, c, d, k[0], 6, -198630844);
		d = this.ii(d, a, b, c, k[7], 10,  1126891415);
		c = this.ii(c, d, a, b, k[14], 15, -1416354905);
		b = this.ii(b, c, d, a, k[5], 21, -57434055);
		a = this.ii(a, b, c, d, k[12], 6,  1700485571);
		d = this.ii(d, a, b, c, k[3], 10, -1894986606);
		c = this.ii(c, d, a, b, k[10], 15, -1051523);
		b = this.ii(b, c, d, a, k[1], 21, -2054922799);
		a = this.ii(a, b, c, d, k[8], 6,  1873313359);
		d = this.ii(d, a, b, c, k[15], 10, -30611744);
		c = this.ii(c, d, a, b, k[6], 15, -1560198380);
		b = this.ii(b, c, d, a, k[13], 21,  1309151649);
		a = this.ii(a, b, c, d, k[4], 6, -145523070);
		d = this.ii(d, a, b, c, k[11], 10, -1120210379);
		c = this.ii(c, d, a, b, k[2], 15,  718787259);
		b = this.ii(b, c, d, a, k[9], 21, -343485551);
		
		x[0] = this.add32(a, x[0]);
		x[1] = this.add32(b, x[1]);
		x[2] = this.add32(c, x[2]);
		x[3] = this.add32(d, x[3]);
	}
	, hex_chr: '0123456789abcdef'.split('')
	, rhex: function(n){
		var s='', j=0;
		for(; j<4; j++){
			s += this.hex_chr[(n >> (j * 8 + 4)) & 0x0F]
			+ this.hex_chr[(n >> (j * 8)) & 0x0F];
		}
		return s;
	}
	, hex: function (x) {
		for (var i=0; i<x.length; i++){
			x[i] = this.rhex(x[i]);
		}
		return x.join('');
	}
	, add32: function(a,b){
		return (a + b) & 0xFFFFFFFF;
	}
	, cmn: function(q, a, b, x, s, t){
		a = this.add32(this.add32(a, q), this.add32(x, t));
		return this.add32((a << s) | (a >>> (32 - s)), b);
	}
	, ff: function(a, b, c, d, x, s, t){
		return this.cmn((b & c) | ((~b) & d), a, b, x, s, t);
	}
	, gg: function(a, b, c, d, x, s, t){
		return this.cmn((b & d) | (c & (~d)), a, b, x, s, t);
	}
	, hh: function(a, b, c, d, x, s, t){
		return this.cmn(b ^ c ^ d, a, b, x, s, t);
	}
	, ii: function(a, b, c, d, x, s, t){
		return this.cmn(c ^ (b | (~d)), a, b, x, s, t);
	}
	, some_fix: function(){
		if (this.md5('hello') != '5d41402abc4b2a76b9719d911017c592'){
			this.add32 = function(x,y){
				var lsw = (x & 0xFFFF) + (y & 0xFFFF),
				msw = (x >> 16) + (y >> 16) + (lsw >> 16);
				return (msw << 16) | (lsw & 0xFFFF);
			}
		}
	}
}

start()