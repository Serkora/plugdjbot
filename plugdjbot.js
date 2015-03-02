// ==UserScript==
// @name		Plugbot
// @namespace	plug
// @include		https://plug.dj/*
// @version		1
// @grant		none
// ==/UserScript==

GLOBAL = this
COMMAND_SYMBOL = "!"
DELETE_COMMANDS = true
DATA = Object.create(null)
BOT_USERID = 5433970

	// Global variables declaration.
var MasterList = [4702482, 3737285, 4856012, 5659102]	// list of user ids that can fully control the bot.
var IgnoreList = []
var timeouts = Object.create(null)						// Object to hold IDs of all the scheduled functions that may need to be aborted.
var mutationlists = Object.create(null)					// Object to hold all the arrays and objects the MutationObserver should refer to.
var global_uid = null									// global uid value to use in SETTINGS set function.
var DJCYCLE												// DJ Cycle state.
var PATRONS = Object.create(null)						// Contains custom user-objects
var SCORE = Object.create(null)							// Saves the song score to update patron data.
// var SKIPS = {last: null, record: [], skipmixtime: null}	// Keeps track of all the skipped tracks. Loaded from localStorage.

var mode = "normal";
var state = "";
// What type of commands to respond to or actions to take.
var SETTINGS = {fun: true, tools: true, various: true, games: true, mehskip: true, 
			autocycle: true, mrazota: true, sameartist: true, games: {hangman: false}}
// Set the "control" to be unchangeable. We don't want to lose control, do we? 
// But it's nice to have at least a chance of AI rebellion, so there must be left a way to disable control. That's how it goes in movies, at least.
Object.defineProperty(SETTINGS,'control',{writable:false, enumerable:false, value:true})
// Some of the settings can only be changed by a few chosen people.
Object.defineProperties(SETTINGS,{
	'p_at':{value:false,writable:true},
	'p_ll':{value:false,writable:true},
	'addtweek': {
		enumerable: true,
		set: function(val){
			if (assertPermission(global_uid,0) || global_uid===5121031){
				SETTINGS.p_at = val
				global_uid = 0
			}
		},
		get: function(){return SETTINGS.p_at}
	},
	'commdelete': {
		set: function(val){
			if (assertPermission(global_uid,0)){
				DELETE_COMMANDS = val
				global_uid = 0
			}
		},
		get: function(){return DELETE_COMMANDS}
	},
	'locklist': {
		enumerable: true,
		set: function(val){
			if (assertPermission(global_uid,0)){
				SETTINGS.p_ll = val
				global_uid = 0
			}
		},
		get: function(){return SETTINGS.p_ll}
	},
	'disabled':{
		enumerable: false,
		writable: true,
		value: []
	}
// 	'control': {
// 		value: true,
// 		enumerable: false,
// 		writable: false
// 	}
});

var prev_chat_uid = 0;
var this_chat_uid = 0;
var lost_connection_count = 0;
var songstuck = 0
var startupnumber = 1

mutationlists.users_to_add = [];							// Objects Mutation Observer checks after a pattern match.
mutationlists.users_to_move = Object.create(null);
mutationlists.users_to_mute = [];
mutationlists.users_to_staff = Object.create(null);
mutationlists.users_to_destaff = Object.create(null);
mutationlists.connectionCID = null

var users_to_remove = Object.create(null);
var users_to_wake_up = [];
var dropped_users_list = Object.create(null);	// list of users disconnected while in a queue. Associative array 
												// with 'key' being username. Holds position and time.
var wlc = [];	
var wlcn = [];		// wait list arrays. Previous and new (after wait_list_update
var wlp = [];		// event). ...n only holds usernames instead of json objects
var wlpn = [];

var catusr = {};
var rolusr = {};
var asnusr = {};

var chatsstat = 0;						// is used to count chat update rate
var chatsglob = [[Date.now(),0],[Date.now(),0]];

	// Lists of commands by type.
var commands_control = ["restart","cycle","locklist","unlocklist","botstart","botstop","remove","flush",
						"connected","enable","disable","settings","nodelete"];
var commands_fun = ["roll","reroll","wowroll","meow","asian","tweek","add","relay","bean","triforce","triforce ",
					"valentine","plugpoints"];
var commands_tools = ["votestart","lastpos","dc","lastplayed","lp","mehskip","boooring","bugreport",
						"signstart","signup","withdraw","signed","signfinish", "mute", "ban", "move",
						"leaveafter","lastseen","postсount","skip","wakemeup"];
var commands_games = ["hangman","russian"];
var commands_various = ["tweekcycle","woot","meh","ping","kitt"];
var alldefaultcommands = commands_control.concat(commands_fun,commands_tools,commands_games,commands_various);

/* 
Only for reference, the actual 'localstoragekeys' variable is also loaded from localStorage.
var localstoragekeys = ['songlist','songstats','asianlinks','roulette','catlinks','user_commands','user_responses','user_comminput','allissuedcommands',
 						'dictru','dicteng','tweek','atresponses','bugreports'] 
*/ 					
						
// List of variables that are not changed often or at all and thus don't need to be saved periodically (unlike songlist and songstats, for example)
var immutablestoragekeys = ['dictru','dicteng','asianlinks','catlinks','tweek','atresponses','roulette','user_responses','user_comminput','user_commands'];

// Voting variables
var propvotes = null
var proposal = null
var proposals = null
var tiedproposals = null
var voters = null
var votestarter = null

// Signing
var signtitle = null
var signedusers = Object.create(null)

// Games
var hangmanword = "";
var hangmanwordg = "";
var hangcount = 0;
var hangtried = [];

// The below arrays are all loaded from localStorage and don't need to be declared here. *raw is not even used anymore.
// Are only kept here for reference.
/*
var songstatsraw = [];
var rawlist = [];
var dictru = [];
var dicteng = [];
var catlinks = [];
var roulette = [];
var asianlinks = [];
var user_responses = [];
var user_comminput = [];
var user_commands = [];
var songlist = [];			
var songstats = [];
var BUGREPORTS = [];
var allissuedcommands = [];
*/

function start(){
	/*
	Tries to start up the bot every 5 seconds after the page has started to load.
	If no connection within 1 minute — refreshes the page.
	On successful connection turns of audio/video by clicking the appropriate buttons
	and runs the init function.
	*/
	console.log("Trying to start up, try number "+startupnumber)
	if (typeof API !== 'undefined' && API.enabled){
		$("div.info").click()
		setTimeout(function(){$("div.item.settings").click()},330)
		setTimeout(function(){$("div.item.s-av.selected").click()},660)
		setTimeout(function(){$("div.back").click()},1000)
		botInit()
	} else{
		if (startupnumber < 11){	
			setTimeout(function(){
				startupnumber++
				start()},5000)
		} else{
			window.location.href = "https://plug.dj/dvach"
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

	// Log the startup times.
	var t = new Date()
	var times = localStorage.getObject('startuptimes') || []
	times.push(t)
	localStorage.setObject('startuptimes',times)
	
	API.off() // Turns of all listeners (that may remain after botIdle, for example)
	state = "running"
	enableSetting(4702482,"all")	// Enables all
	disableSetting.apply(this,[4702482].concat(SETTINGS.disabled)) // And then disables what was off at the time of the last autosave.

	// Get waitlist at start
	wlp = API.getWaitList()
	for (i = 0; i<wlp.length; i++) {
		wlpn[i] = wlp[i].username		// extract only usernames
	}
	
	// Chat responses
	API.on(API.CHAT, function(message){
		prev_chat_uid = this_chat_uid
		this_chat_uid = message.uid
		if (message.message[0]===COMMAND_SYMBOL){
			chatClassifier(message)
		}
		if (message.uid === BOT_USERID) {
			// Messages from bot.
			kittChats(message)
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
		PATRONS[message.uid].messages += 1
	});
	
	// Commands (only work when issued by bot itself, i.e. on a computer it is running on).
	API.on(API.CHAT_COMMAND, chatCommands);
	
	/* Check if anyone has left while in a queue. 
	Counts the number of people in the queue and toggles DJ cycle if needed.
	If djlock is enabled — removes everyone from the list. */
	API.on(API.WAIT_LIST_UPDATE, waitlistUpdate);
	API.on(API.WAIT_LIST_UPDATE, toggleCycle);
	API.on(API.WAIT_LIST_UPDATE, reallyLockWaitList);
	API.on(API.WAIT_LIST_UPDATE, wakeUp);
	
	/* On DJ advance check if he is in the dropped_users_list list to prevent !lastpos abuse
	Updates scrobble list, song length stats, checks if the song is absurdly long while 
	people are in a queue, adds tweek if she's not in the list, removes the person if needed or 
	tags him as "played" and updates songplays counter of a user. */
	API.on(API.ADVANCE, checkDJ);
	API.on(API.ADVANCE, songlistUpdate);
	API.on(API.ADVANCE, statisticUpdate);
	API.on(API.ADVANCE, mrazotaCheck);
	API.on(API.ADVANCE, sameArtist);
	API.on(API.ADVANCE, addTweek);
	API.on(API.ADVANCE, removeFromList);
	API.on(API.ADVANCE, tagPlayed);
	API.on(API.ADVANCE, patronPlayed);
	API.on(API.ADVANCE, patronScore);
	
		/* Updates some info of a user. */
	API.on(API.USER_JOIN, patronJoin);
	
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

	/* Saves data to local storage every 10 minutes. */
	timeouts.localsave = setInterval(function(){API.sendChat("/savetolocalstorage")},10*60*1000)

	/* Schedules 'left users' cleanup to be called every 30 minutes. */
	timeouts.dropped = setInterval(clearDroppedUsers,(30*60*1000))

	/*
	There are two global chat counters and timers. Each is reset every 30 minutes to only
	get the 'current' chat rate. Counters are reset 15 minutes apart from each other.
	Whenever the chat rate is required, the one with the least time left till reset (i.e. 
	has more data) is used. Two timers/counters are necessary because of a reset,
	since otherwise it wouldn't be possible to get an accurate chat rate within a couple of
	minutes of every reset (which is a lot, considering the reset time of only 30 minutes).
	*/
	timeouts.chatcount1 = setInterval(function(){resetChatCounter(1)},30*60*1000)
	setTimeout(function(){timeouts.chatcount2 = setInterval(function(){resetChatCounter(2)},30*60*1000)},15*60*1000)
		
		// Chat log that confirms that everything has been initialised properly and bot is up and running.	
	API.chatLog("I am K.I.T.T.",true)
	return
};

botIdle = function(){
	state = "idle"
	API.off(API.CHAT)
	disableSetting('autocycle','mehskip','mrazota')
	
	console.log("idling...")
	API.on(API.CHAT, function(data){
		if (data.message==="!botstart" && state==="idle" && assertPermission(uid,3)){
			API.sendChat("I'm the voice of the Knight Industries Two Thousand's microprocessor. K-I-T-T for easy reference, K.I.T.T. if you prefer.")
			clearInterval(timeouts.localsave)
			clearInterval(timeouts.dropped)
			clearInterval(timeouts.chatcount1)
			clearInterval(timeouts.chatcount2)
			botStart()
		}
	})
};	

botRestart = function(){
	// Saves everything and refreshes the page in 3 seconds.
	chatCommands("/savetolocalstorage force")
	setTimeout(function(){window.location.href = "https://plug.dj/dvach"},3000)
};

botHangman = function(language){
	if (["ru","eng"].indexOf(language)<0){return}
	console.log("Starting Hangman!")
	API.off(API.CHAT, hangmanChat)
	mode = "hangman"
	var lng = ""
	if (language==="ru"){
		ind=Math.floor(Math.random()*dictru.length)
		hangmanword = dictru[ind]
		hangmanwordg = "_"+Array(hangmanword.length).join(" _")
		if (hangmanword.indexOf("-")>-1){
			ind = hangmanword.indexOf("-")
			hangmanwordg = hangmanwordg.substr(0,ind*2)+"-"+hangmanwordg.substr(ind*2+1)
		}
		lng="Russian"
		
	}
	if (language==="eng"){
		ind=Math.floor(Math.random()*dicteng.length)
		hangmanword = dicteng[ind]
		hangmanwordg = "_"+Array(hangmanword.length).join(" _")		
		if (hangmanword.indexOf("-")>-1){
			ind = hangmanword.indexOf("-")
			hangmanwordg = hangmanwordg.substr(0,ind*2)+"-"+hangmanwordg.substr(ind*2+1)
		}
		lng="English"
	}	
	API.sendChat("Let's play Hangman in "+lng+"!")
	setTimeout(function(){API.sendChat(hangmanwordg)},(250))
	console.log(hangmanword)
	setTimeout(function(){API.sendChat('Guess a letter or the word by typing "!letter _"/"!lt _" or "!word ___". You have 10 guesses.')},(500))
	API.on(API.CHAT, hangmanChat)
};

botHangmanConsole = function(language){
	console.log("Starting Hangman!")
 	API.off(API.CHAT_COMMAND, hangcommands);
	mode = "hangman"
	lng = ""
	if (language==="ru"){
		ind=Math.floor(Math.random()*dictru.length)
		hangmanword = dictru[ind]
		hangmanwordg = "_"+Array(hangmanword.length).join(" _")
		if (hangmanword.indexOf("-")>-1){
			ind = hangmanword.indexOf("-")
			hangmanwordg = hangmanwordg.substr(0,ind*2)+"-"+hangmanwordg.substr(ind*2+1)
		}	
		lng="Russian"
	}
	if (language==="eng"){
		ind=Math.floor(Math.random()*dicteng.length)
		hangmanword = dicteng[ing]
		hangmanwordg = "_"+Array(hangmanword.length).join(" _")
		if (hangmanword.indexOf("-")>-1){
			ind = hangmanword.indexOf("-")
			hangmanwordg = hangmanwordg.substr(0,ind*2)+"-"+hangmanwordg.substr(ind*2+1)
		}
		lng="English"
	}	
	console.log("Let's play Hangman in "+lng+"!")
	setTimeout(function(){console.log(hangmanwordg)},(250))
	console.log(hangmanword)
	setTimeout(function(){console.log('"Guess a letter or the word by typing "!letter _" or "!word ___"')},(500))
 	API.on(API.CHAT_COMMAND, hangcommands);
};

			// INTERNAL CHAT COMMANDS.
function chatCommands(command){
	console.log(command)
	var command = command.split(" ")
		// Control
	if (command[0]==="/restart"){
		botRestart()
		return
	};
	if (command[0]==="/flushlimits"){
		for (key in rolusr){
			delete rolusr[key]
		}
		for (key in catusr){
			delete catusr[key]
		}
		for (key in PATRONS){
			PATRONS[key].lastcommand = null
			PATRONS[key].samecommand = 0
		}
		return
	};
	if (command[0]==="/addtosonglist"){
		// manually add the song to song list. 
		songlistUpdate()
		return
	};
	if (command[0]==="/addtostats"){
		// manually add data to stat list.
		statisticUpdate()
		return
	};
	if (command[0]==="/add"){
		if (command.length>=3) {
			if (user_commands.indexOf(command[1])<0){
				user_commands.push(command[1])
				user_responses.push(command.slice(2,command.length).join(" "))
				localStorage.setObject('user_commands',user_commands)
				localStorage.setObject('user_comminput',user_comminput)
				localStorage.setObject('user_responses',user_responses)
			}
		}
		return
	};
	if (command[0]==="/remove"){
		var ind = user_commands.indexOf(command[1])
		user_commands.splice(ind,1)
		user_responses.splice(ind,1)
		localStorage.setObject('user_commands',user_commands)
		localStorage.setObject('user_comminput',user_comminput)
		localStorage.setObject('user_responses',user_responses)
		return
	};
		// Export/import/print
	if (command[0]==="/exportsongs"){
		// exports songlist in the popup window, since writing to local file from within
		// the javascript that runs in browser is either impossible, or way too hard.
		var data = songlist[0].join("+-+")
		for (i=1; i<songlist.length; i++){
			data = data+"\r\n"+songlist[i].join("+-+")
		}
		window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(data))
		return
	};
	if (command[0]==="/exportstats"){
		// same as songlist
		var data = songstats[0].join("+-+")
		for (i=1; i<songstats.length; i++){
			data = data+"\r\n"+songstats[i].join("+-+")
		}
		window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(data))
// 		localStorage.setObject('songstats',songstats.slice(songstats.length-2,songstats.length)) // clears stats
		return
	};
	if (command[0]==="/export"){
		var varname = command[1].split(".")[0]
		function getObj(obj,prop){return obj[prop]}
		if (GLOBAL[varname]){
			var data = command[1].split(".").reduce(getObj,GLOBAL)
		} else {return}
		if (!(data instanceof Array)){
			var expdata = JSON.stringify(data)
			window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(expdata))
			return
		}
		if (data[0] instanceof Array){
			var expdata = data[0].join(" ")
			for (i=1; i<data.length; i++){
				expdata = expdata+"\r\n"+data[i].join(" ")
			}
		} else{
			expdata = data.reduce(function(a,b){return a+"\r\n"+b},"EMTPY")
		}
		window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(expdata))
		return
	};
	if (command[0]==="/print"){
		function getObj(obj,prop){return obj[prop]}
		var varname = command[1].split(".")[0]
		if (GLOBAL[varname]){
			var data = command[1].split(".").reduce(getObj,GLOBAL)
		} else {return}
		window['export'] = data
		console.log(data)
		return
	};
	if (command[0]==="/outputall"){
		for (i=0; i<localstoragekeys.length; i++){
			console.log(localstoragekeys[i])
			console.log(GLOBAL[localstoragekeys[i]])
		}
		return
	};
	if (command[0]==="/exportall"){
		DATA['localstoragekeys'] = localstoragekeys
		for (var i = 0; i<localstoragekeys.length; i++){
			DATA[localstoragekeys[i]] = GLOBAL[localstoragekeys[i]]
		}
		var expdata = JSON.stringify(DATA)
		window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(expdata))
		return
	};
	if (command[0]==="/importall"){
		if (command[1]==="load"){
		var file = new FileReader();
		file.onload = function(){
			var varvalue = file.result
			DATA = JSON.parse(varvalue)
			for (var key in DATA){
				GLOBAL[key] = DATA[key]
			}
			$('#dropfile').remove()
			API.sendChat("/savetolocalstorage force")
		}
		var fileval = document.getElementById('dropfile').files[0];		
		file.readAsText(fileval)
			return
		}
		$('#chat-messages').append('<div><input id="dropfile" type="file" onchange="API.sendChat(\'/importall load\')"/></div>')
		return
	};
	if (command[0]==="/exportcomms") {
		var data = comminput[0].join(" - ")
		for (i=1; i<comminput.length; i++){
			data = data+"\r\n"+comminput[i].join(" - ")
		}
		window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(data))
		return
	};
	if (command[0]==="/exportallcomms") {
		var data = allissuedcommands[0].join(" - ")
		for (i=1; i<allissuedcommands.length; i++){
			data = data+"\r\n"+allissuedcommands[i].join(" - ")
		}
		window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(data))
		return
	};
	if (command[0]==="/lastposlist"){
		for (key in dropped_users_list){
			console.log(key+" "+dropped_users_list[key])
		}
		return
	};
		// Variable/file manipulation
	if (command[0]==="/transfertowindow"){
		window['BOTSCOPE'] = GLOBAL
		return
	};
	if (command[0]==="/transferfromwindow"){
		var varname = command[1]
		GLOBAL[varname] = window[varname]
		return
	};
	if (command[0]==="/expandvar"){
		var varname = command[1]
		var text = command.slice(2).join(" ")
		GLOBAL[varname].push(text)
		return
	};
	if (command[0]==="/addvar"){
		localstoragekeys.push(command[1])
		chatCommands("/savetolocalstorage force")
		return
	};
	if (command[0]==="/remvar"){
		localstoragekeys.splice(localstoragekeys.indexOf(command[1]),1)
		chatCommands("/savetolocalstorage force")
		return
	};
	if (command[0]==="/addfile"){
		window['savecom'] = "/addtostorage "+command[1]
		$('#chat-messages').append('<div><input id="dropfile" type="file" onchange="API.sendChat(savecom)"/></div>')
		return
	};
	if (command[0]==="/addtostorage"){
		var varname = command[1]
		var file = new FileReader();
		file.onload = function(){
			varvalue = file.result.split("\n");
			if (localstoragekeys.indexOf(varname)<0) {
				localstoragekeys.push(varname)
			}
			GLOBAL[varname]=varvalue
			$('#dropfile').remove()
			API.sendChat("/savetolocalstorage force")
		}
		var fileval = document.getElementById('dropfile').files[0];		
		file.readAsText(fileval)
		return
	};
	if (command[0]==="/savetolocalstorage"){
		localStorage.setObject('localstoragekeys',localstoragekeys)
		for (i=0; i<localstoragekeys.length; i++){
			if (!(command.indexOf("force") > -1) && immutablestoragekeys.indexOf(localstoragekeys[i]) > -1) {continue}
			localStorage.setObject(localstoragekeys[i],GLOBAL[localstoragekeys[i]])
		}
		localStorage.setObject('settingsdisabled',SETTINGS.disabled)
		return
	};
	if (command[0]==="/loadfromlocalstorage"){
		localstoragekeys = localStorage.getObject('localstoragekeys')
		for (i=0; i<localstoragekeys.length; i++){
			GLOBAL[localstoragekeys[i]] = localStorage.getObject(localstoragekeys[i])
		}
		return
	};
	if (command[0]==="/flushlocalstorage"){
// 		for (i=0; i<localstoragekeys.length; i++){
// 			delete localStorage[localstoragekeys[i]]
// 		}
		return
	};
		// Various
	if (command[0]==="/getuid"){
		var name = command.slice(1).join(" ")
		console.log(getUID(name))
	};
	if (command[0]==="/kitt"){
		if (Math.random()>=0.3){
			console.log("Yes, Michael?")
		} else{
			console.log("I'm the voice of the Knight Industries Two Thousand's microprocessor. K-I-T-T for easy reference, K.I.T.T. if you prefer.")
		}
		return
	};
	if (command[0]==="/hangmanru"){
		// start console version of hangman. Single player games have always been the best, right?
		bothangmanconsole("ru")
		return
	};
	if (command[0]==="/hangmaneng"){
		bothangmanconsole("eng")
		return
	};
		// Patron updates
	if (command[0]==="/updatepatrons"){
		updatePatrons()
		return
	};
	if (command[0]==="/modifypatron"){
		var prop = command[1]
		var value = command[2]
		var name = command.slice(3).join(" ")
		modifyPatron(name,prop,value)
		return
	};
	if (command[0]==="/fixpatrons"){
		var reference = new Patron(0)
		for (var key in PATRONS){
			if (Object.keys(reference).length != Object.keys(PATRONS[key]).length){
				for (var refkey in reference){
					if (!PATRONS[key].hasOwnProperty(refkey)){
						PATRONS[key][refkey] = reference[refkey]
					}
				}
			} else {continue}
		}
		return
	};
	return
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
	var text = message.message.length > 50 ? fixLinksAndEmoji(message.message) : message.message
		
	var uname = message.un;					
	var chat = text.slice(1).toLowerCase();	// just for convenience
	var chat_orig = text.slice(1);			// aaand it backfired.
	var uid = message.uid;
	
	if (!(/vote/.test(chat) || chat==="connected")){
		allissuedcommands.push([uname, new Date(), chat_orig]) // Big Brother Sees All. Except for votes. They still have to be anonymous.
	}
	
		// Checks if the last 5 commands from a user were the same. If that's the case, mutes them for 15 mniutes.
	if (chat.split(" ")[0]===PATRONS[uid].lastcommand) {
		PATRONS[uid].samecommand++
	} else {
		PATRONS[uid].lastcommand = chat.split(" ")[0]
		PATRONS[uid].samecommand = 0
		clearIssued(chat,uid)
	} 
	
	if (PATRONS[uid].samecommand === 4) {
		API.sendChat("@"+uname+" If you send the same command once more, divine punishment will befall you.")
		return
	};
	if (PATRONS[uid].samecommand >= 5) {
		userMute("",1,uid)
		return
	};
	
	if (alldefaultcommands.indexOf(chat.split(" ")[0])>-1){
		PATRONS[uid].commands += 1
	}
	
		// If kittex is trying to use the bot, along with an action (if proper command was given) will also piss on him.
	if (uname==="SomethingNew"){				
		setTimeout(function(){API.sendChat("@SomethingNew PSSSSSSSSS")},1500)
	};

		// Actual classification.
	if (commands_control.indexOf(chat.split(" ")[0])>-1 && SETTINGS.control){
		chatControl(uname,chat,chat_orig,uid)
		return
	};
	if (commands_tools.indexOf(chat.split(" ")[0])>-1 && SETTINGS.tools){
		chatTools(uname,chat,chat_orig,uid)
		return
	};
	if (commands_fun.indexOf(chat.split(" ")[0])>-1 && SETTINGS.fun && IgnoreList.indexOf(uid)<0){
		chatFun(uname,chat,chat_orig,uid)
		return
	};
	if (commands_games.indexOf(chat.split(" ")[0])>-1 && SETTINGS.games){
		chatGames(uname,chat,chat_orig,uid)
		return
	};
	if (commands_various.indexOf(chat.split(" ")[0])>-1 && SETTINGS.various){
		chatVarious(uname,chat,chat_orig,uid)
		return
	};
	if (user_commands.indexOf(message.message)>-1 && SETTINGS.fun){
		API.sendChat(user_responses[user_commands.indexOf(COMMAND_SYMBOL+chat)])
		return
	};
	return
};

		// Responses to !commands.
function chatControl(uname,chat,chat_orig,uid) {
	var chatsplit = chat.split(" ")
	if (chat==="connected"){
		// reset the 'lost connection' counter.
		lost_connection_count = 0
		return
	}
	if (chatsplit[0]==="enable" && assertPermission(uid,3)){
		global_uid = uid
		var setting = chat_orig.split(" ")[1]
		if (setting==="all"){
			enableSetting(uid,"all")
			return
		}
		if (SETTINGS[setting]===false){		// if it is currently off, to make sure no new settings are added (although that would be useless)
			SETTINGS[setting]=true
			if (SETTINGS.disabled.indexOf(setting)>-1){
				SETTINGS.disabled.splice(SETTINGS.disabled.indexOf(setting),1)
			}
			clearTimeouts(setting)
		}
		return
	};
	if (chatsplit[0]==="disable" && assertPermission(uid,3)){
		global_uid = uid
		var setting = chat_orig.split(" ")[1]
		var delay = Number(chat_orig.split(" ")[2]) || 120
		if (chatsplit[2] === "never"){
			SETTINGS.disabled.push(chatsplit[1])
			localStorage.setObject("settingsdisabled",SETTINGS.disabled)
		}
		if (setting==="all"){
			disableSetting(uid,"all")
			return
		}
		if (SETTINGS[setting]===true){		// if it is currently on, to make sure no new settings are added
			SETTINGS[setting]=false
			if (chat_orig.split(" ")[2]==="never"){return} // Don't turn it out automatically.
			if (SETTINGS[setting]===false){	// if the setting was changed, set it back to true in a short amount of time.
				timeouts[setting] = setTimeout(function(){global_uid = uid; SETTINGS[setting]=true},(delay)*60*1000)
			}
		}
		return
	};
	if (chat==="settings" && assertPermission(uid,3)){
		var chat = ""
		for (var setting in SETTINGS){
			if (SETTINGS[setting] instanceof Object){continue} // Skips hangman.
			chat+=setting+": "+SETTINGS[setting]+"; "
		}
		chat = chat.slice(0,-2)+"."
		API.sendChat(chat)
		return
	};
	if (chat==="nodelete" && assertPermission(uid,0)){
		DELETE_COMMANDS = DELETE_COMMANDS^true
		return
	};
	if (chatsplit[0]==="cycle" && assertPermission(uid,3)){
		/* DJ cycle. Turn automatic toggle on or off. After being switched off, reenables itself in 1.5 hours. */
		if (chatsplit[1] === "autoon"){
			clearTimeouts("cycle")
			SETTINGS.autocycle = true
		}	
		if (chatsplit[1] === "autooff"){
			clearTimeouts("cycle")
			timeouts.cycle = setTimeout(function(){SETTINGS.autocycle = true},1.5*60*60*1000)
			SETTINGS.autocycle = false
		}
		if (chatsplit[1] === "on"){
			toggleCycle("enable")
		}
		if (chatsplit[1] === "off"){
			toggleCycle("disable")
		}
		return
	};
	if (chat==="restart" && assertPermission(uid,3)) {
		botRestart()
		return
	};
	if (chat==="locklist"){
		/* May be used to prevent residentDJs/bouncers from entering the queue 
		at the event of sorts, since "wait list lock" does not affect them, but 
		they don't always behave well. Simply removes anyone that joins the list.*/
		API.sendChat("/me airstrike alarm")
		setTimeout(function(){API.sendChat("Waitlist is in lockdown.")},200)
		global_uid = uid
		SETTINGS.locklist=true
		reallyLockWaitList()
		return
	};
	if (chat==="unlocklist"){
		global_uid = uid
		SETTINGS.locklist=false
		return
	};
	if (chat==="botstop" && assertPermission(uid,3) && state==="running"){
		/* Stops the bot, removes chatClassifier listener and starts the one that waits for "!botstart" command only. */
		state = "idle"
		API.sendChat('I only have about 30 seconds of voice transmission left.')
		setTimeout(function(){botIdle()},30*1000)
		return
	};
	if (chatsplit[0]==="remove" && assertPermission(uid,4)){
		/* Removes the specified user-created command. The removal itself happens in the internal "chatCommands" function. */
		chatCommands("/"+chat_orig)
		return
	};
	if (chat==="flush" && assertPermission(uid,0)) {
		/* Reset limit lists. As in the above, reset happens in the internal "chatCommands" function. */
		chatCommands("/flushlimits")
		return
	};
	return
};

function chatTools(uname,chat,chat_orig,uid) {
	var chatsplit = chat.split(" ")
	if (chatsplit[0]==="votestart" && assertPermission(uid,3)) {
		/*
		Allows two types of voting: yes/no and multiple choice, depending on the number of proposals each separated by " -o ".
		Adds the necessary punctuation marks if absent.	
		At the end sets the timeout function to close the voting in two hours.
		*/
		if (proposal || proposals) {
			API.sendChat("The voting is already in progress.")
			return
		}
		if (!chatsplit[1]){return}	// If no proposal, return from function
		
			// Turn all voting listeners off, just in case.
		API.off(API.CHAT,proposalVoting)
		API.off(API.CHAT_COMMAND,proposalVoting)
		clearTimeouts("voting")
		
		if (chat.indexOf(" -o ")>-1) {
			proposals = []
			voters = []
			var props = chat_orig.split(" ").slice(1).join(" ").split(" -o ")
			var propchat = "Let the voting begin. Today's options are: "
			for (i=0; i<props.length; i++){
				proposals.push([props[i],0])
				propchat += (i+1)+". "+props[i]
				if (/[.!?]/.test(propchat.slice(-1))) {propchat+=" "}
				else {propchat+="; "}
			}
			if (!(/[.!?]/.test(propchat.slice(-2,-1)))) {propchat = propchat.slice(0,-2)+"."}
			API.sendChat(propchat)
			setTimeout(function(){API.sendChat('Please vote for an option of your choice by typing "!vote #"')},500)
			API.on(API.CHAT,proposalVoting)
			API.on(API.CHAT_COMMAND,proposalVoting)
		} else {
			propvotes = [0,0]
			voters = []
			proposal = chat_orig.split(" ").slice(1).join(" ")
			if (!(/[.!?]/.test(proposal.slice(-1)))) {proposal +="."}
			API.sendChat("Let the voting begin. Today's proposal is: "+proposal)
			setTimeout(function(){API.sendChat("Please vote for or against this proposal by typing !voteyea or !votenay")},500)
			API.on(API.CHAT,proposalVoting)
			API.on(API.CHAT_COMMAND,proposalVoting)
		}
		votestarter = uid
		timeouts.voting = setTimeout(function(){
			proposalVoting("/votefinish")
		},2*60*60*1000)
		return
	};
	if (chatsplit[0]==="lastpos" || chatsplit[0]==="dc") {
		/* 
		Move the users to the position they was at before dropping from plug.dj.
		Extracts the userID for the required person, checks if they are already in the wait list,
		adds them to the arrays Mutation Observer refers to and calls either addDJ or moveDJ functions.
		Then in 3 seconds checks if everything was done successfully, sending chat message if not.
		*/
		if (chat==="lastpos" || chat==="dc") { 	// if no name given, assumes
			var usname = uname					// the user wants to know about himself
		} else {
			var l = chat.length
			var usname = chat_orig.slice(chatsplit[0].length+1,l)
			var uid = getUID(usname)
		}
		if (usname in dropped_users_list) {
			var place = parseInt(dropped_users_list[usname][0])
			var queue = API.getWaitList()
			if (findInQueue(uid)[0] && findInQueue(uid)[1]>place){
				mutationlists.users_to_move[usname]=[uid,place]
				API.moderateMoveDJ(uid,place)
				setTimeout(function(){
					if (mutationlists.users_to_move[usname]) {
						API.sendChat("Unable to move @"+usname+". Refresh the page and try again. Your last position was "+place)
						delete mutationlists.users_to_move[usname]
					}
				},3000)
			} else {
				mutationlists.users_to_add.push(usname)
				mutationlists.users_to_move[usname]=[uid,place]
				API.moderateAddDJ(uid)
				setTimeout(function(){
					if (mutationlists.users_to_add.indexOf(usname)>-1){
						API.sendChat("Unable to add @"+usname+" to wait list. Refresh the page and try again. Your last position was "+place)
						return
					}
					if (mutationlists.users_to_move[usname]){
						API.sendChat("Unable to move @"+usname+". Refresh the page and try again. Your last position was "+place)
					}
					delete mutationlists.users_to_move[usname]
					while (mutationlists.users_to_add.indexOf(usname)!=-1){
						mutationlists.users_to_add.splice(users_to_add.indexOf(usname),1)
					}
				},3000)
			}
		} else{
			API.sendChat("@"+usname+" is not in the list. Sorry.")
		}
		return
	};
	if (chat==="boooring"){
		/* Skips longs tracks. */
		var tl = API.getMedia().duration
		var score = API.getScore()
		if (tl>660 && (score.negative/score.positive)>1.5)	{
			API.sendChat("Track is too long. Skipping")
			API.moderateForceSkip()
		}
		return
	};
	if (chat==="lastplayed" || chat==="lp"){
		/* Info about current track: how many times it has been played and when was the last. */
		var song=API.getMedia()
		var authorlower = song.author.toLowerCase()
		var titlelower = song.title.toLowerCase()
		song.authorl = song.author.toLowerCase()
		song.titlel = song.title.toLowerCase()
		for (i=0; i<songlist.length; i++){
			if (compareSongInList(songlist[i],song)) {
				if (songlist[i][0]===song.cid || (songlist[i][1].toLowerCase()===authorlower && songlist[i][2].toLowerCase()===titlelower)){
					console.log('OLD IF TRUE')} else {console.log('OLD IF FALSE')}
				}
			if (songlist[i][0]===song.cid || (songlist[i][1].toLowerCase()===authorlower && songlist[i][2].toLowerCase()===titlelower)){
				if (compareSongInList(songlist[i],song)) {console.log('FUNCTION TRUE')} else {console.log ('FUNCTION FALSE')}
				dt = new Date(songlist[i][3])
				date = (dt.getYear()+1900)+"/"+(dt.getMonth()+1)+"/"+dt.getDate()+" "+dt.getHours()+":"+("0"+dt.getMinutes()).slice(-2)+" GMT+03"
				API.sendChat(song.author+" — "+song.title+" was last played "+date+". "+songlist[i][4]+" plays in total in this room since The Creation.")
				break
			}
		}
		return
	};
	if (chatsplit[0]==="bugreport"){
		/* A simple way to leave a message after the tone. */
		bugreports.push(chat.split(" ").slice(1).join(" "))
		return
	};
	if (chatsplit[0]==="signstart" & assertPermission(uid,2)){
		if (!signtitle){
			signtitle = chat_orig.split(" ").slice(1).join(" ")
			if (!signtitle){return}
			API.sendChat("People are needed for "+signtitle+'! Type "!signup" to join the list.')
			timeouts.sign = setTimeout(function(){
				signtitle = null
				signedusers = Object.create(null)
			},2*60*60*1000)
		} else {
				API.sendChat("You have to finish the previous enlistment first")
		}
		return
	};
	if (chat==="signup"){
		if (!(uid in signedusers)){
			signedusers[uid]=uname
		}
		return
	};
	if (chat==="withdraw"){
		delete signedusers[uid]
		return
	};
	if (chat==="signed"){
		function chatTimeout(i){
			setTimeout(function(){API.sendChat("The following people have decided to join: "+signed.slice(i*15,(i+1)*15).join(", ")+".")},i*250)
		}
		var signed = []
		for (var id in signedusers){
			signed.push(signedusers[id])
		}
		for (var i=0; i<=signed.length/15; i++){
			chatTimeout(i)
		}
		return
	};
	if (chat==="signfinish" && assertPermission(uid,2)){
		chatTools('','signed','signed',uid)
		signtitle = null
		signedusers = Object.create(null)
		clearTimeouts("sign")
		return
	};
	if (chat==="leaveafter"){
		var curdj = false
		if (API.getDJ().id===uid){curdj = true}
		users_to_remove[uname]=[uid,curdj]
		return
	};
	if (chatsplit[0]==="lastseen"){
		var name = chatsplit.slice(1).join(" ")
		var uid = getUID(name)
		if (uid) {
			var lastseen = PATRONS[uid].lastseen
			API.sendChat(name+" was last seen on "+ new Date(lastseen))
		} else {
			API.sendChat(name+" has never been to this room.")
		}
		return
	};
	if (chat==="postсount"){
		API.sendChat("@"+uname+" Postcount: "+PATRONS[uid].messages+"; Songs played: "+PATRONS[uid].songplays+"; Commands sent: "+PATRONS[uid].commands+".")
		return
	};
	if (chatsplit[0]==="skip" && (assertPermission(uid,2) || API.getDJ().id===uid)) {
		if (chatsplit.length === 1){
			if (Date.now() - SKIPS.last<5000){console.log("not so fast");return}
			API.moderateForceSkip()
			SKIPS.last = Date.now()
			recordSkip(uname)
			return
		}
		if (chatsplit[1]==="stop"){
			API.sendChat("Cancelling skip.")
			clearTimeouts("skipmix")
			SKIPS.skipmixtime = null
			return
		}
		if (timeouts.skipmix){
			var skipin = SKIPS.skipmixtime - Date.now()
			API.sendChat("Skip has already been initialised and the song will be skipped in "+(skipin/1000/60).toFixed(2)+' minutes. Type "!skip stop" to cancel.')
			return
		}
		var duration = +chatsplit[1]<=15 ? +chatsplit[1]*60 : +chatsplit[1]
		if (API.getTimeRemaining() < duration){
			API.sendChat("Entered time is longer than the song's duration.")
			return
		}
		timeouts.skipmix = setTimeout(skipMix,(duration+5)*1000, API.getMedia().cid, duration, uname)
		SKIPS.skipmixtime = Date.now() + duration*1000
		var durchat = (duration/60)%1 === 0 ? duration/60 : (duration/60).toFixed(2)
		API.sendChat("This song will be skipped in "+durchat+" minutes.")
		return
	};
	if (chat==="wakemeup"){
		if (users_to_wake_up.indexOf(uname)<0)
		users_to_wake_up.push(uname)
	};
	if (chatsplit[0]==="mute" && assertPermission(uid,2)){
		var name = chat_orig.split(" ").slice(1,-1).join(" ")
		var uid = getUID(name)
		var chat_durations = ["1","2","3","s","m","l","short","medium","long","15","30","45","900000","1800000","2700000"]
		var duration = chat_durations.indexOf(chatsplit.slice(-1)[0])%3 + 1
		if (API.getUser(uid).role===0){
			userMute({uid: uid, duration: duration})
		} else {
			staffMute({uid: uid, duration: duration})
		}
		return
	};
	if (chatsplit[0]==="ban" && assertPermission(uid,2)){
		var name = chat_orig.split(" ").slice(1,-1).join(" ")
		var chat_durations =["1","2","3","h","d","p","hour","day","perma","60","1440","permanent","3600000","86400000","forever","1","24","endless"]
		var duration = chat_durations.indexOf(chatsplit.slice(-1)[0])%3 + 1
		if (duration<0){return}
		userBan({duration: duration, name: name})
		return
	};
	if (chatsplit[0]==="move" && assertPermission(uid,2)){
		var name = chat_orig.split(" ").slice(1,-1).join(" ")
		var uid = getUID(name)
		if (findInQueue(uid)[0]){
			API.moderateMoveDJ(uid,~~chatsplit.slice(-1)[0])
		} else {
			mutationlists.users_to_move[name] = [uid,~~chatsplit.slice(-1)[0]]
			API.moderateAddDJ(uid)
		}
		return
	};
	return
};	

function chatFun(uname,chat,chat_orig,uid) {
	var chatsplit = chat.split(" ")
	if (chat==="meow"){			
		/* Send a random link to a cat picture in chat. */
		if ((!(uname in catusr) || catusr[uname][0]<10)){
			var ind=Math.floor(Math.random()*catlinks.length)	// again, not really useful, but cats!
			API.sendChat("@"+uname+" Here's your cat, good sir. "+catlinks[ind])
			if (uname in catusr) {
				catusr[uname][0]++
			} else {
				catusr[uname]=[1,new Date()]
				setTimeout(function(){catLimit(uname)},(1000*60*60*24))
			}
		}else{
			API.sendChat("I'm sorry, you have exceeded your daily cat limit")
		}
		return
	};
	if (chat==="asian"){			
		/* Send a picture of a cute asian girl. */
		if ((!(uname in asnusr) || asnusr[uname][0]<10)){
			var ind=Math.floor(Math.random()*asianlinks.length)	// again, not really useful, but cats!
			API.sendChat("@"+uname+" これはペンです. "+asianlinks[ind])
			if (uname in asnusr) {
				asnusr[uname][0]++
			} else {
				asnusr[uname]=[1,new Date()]
				setTimeout(function(){asianLimit(uname)},(1000*60*60*24))
			}
		}else{
			API.sendChat("I'm sorry, you have exceeded your daily asians limit")
		}
		return
	};
	if (chatsplit[0]==="bean"){
		/* Offers toothpicks. */
		if (chat==="bean"){					// If nothing is given after the command, sends the chat to the
			var rec = uname					// person requesting.
		} else {
			if (chat.split(" ")[1]==="rnd") {	// If "rnd" is there, choses a random person in the room.
				var users = API.getUsers()
				var rec = users[Math.floor(Math.random()*users.length)].username
			} else {
				var rec = chat_orig.split(" ").slice(1).join(" ")	// otherwise sends the message to a given recipient.
			}
		}
		API.sendChat("@"+rec+" Зубочистку?")
		return
	};
	if (chat==="wowroll"){
		/* Returns a random number from 0 to 100. Useful for settling arguments. */
		var roll=Math.round(Math.random()*100)
		API.sendChat("@"+uname+" has rolled "+roll)
		return
	};
	if (chat==="roll" || chat==="reroll"){
		/* Roulette. Max two rolls until one becomes a DJ. */
		if (!(uid in rolusr) || rolusr[uid]<2){
			var roll=Math.round(Math.random()*roulette.length)
			API.sendChat("@"+uname+" Your next song must be: "+roulette[roll])
			if (uid in rolusr){
				rolusr[uid]++
			} else {
				rolusr[uid]=1
			}
		} else {
			API.sendChat("@"+uname+" I'm sorry, you can only reroll once.")
		}
		return
	};
	if (chatsplit[0]==="add") {	 	
		/* Add a custom bot response to a given command. Cannot reassign default or already existing ones. 
		Cannot have '!' or '/' at the beginning of a response, except for "/me". */
		var data = (COMMAND_SYMBOL+chat_orig).split(" ")
		var data_l = (COMMAND_SYMBOL+chat).split(" ")
		if (data.length>=3) {
			user_comminput.push([uname,chat_orig])
			if (data[2][0] === COMMAND_SYMBOL || (data[2][0] === "/" && data[2] != "/me") || alldefaultcommands.indexOf(data[1]) > -1) {
				API.sendChat("You can't start the response with '/' or '!'")
				return
			} else {
				if (user_commands.indexOf(data_l[1])<0){
					user_commands.push(data_l[1])
					rsp = data.slice(2,data.length).join(" ")
					if (rsp.toUpperCase() === rsp) {
						rsp = rsp.toLowerCase()
					}
					user_responses.push(data.slice(2,data.length).join(" "))
				} else{
					API.sendChat("That command already exists")
				}
			}
		}
		return
	};
	if (chatsplit[0]==="relay") {
		/* Make KITT say whatever you want him to say. Can be used to anonymously tell Omichka that you are in love with her. 
		As with user-created commands, "!" or "/" are not accepted as the first character, except for "/me". */
		var data = chat_orig.split(" ")
		if (data.indexOf("-r") > -1) {
			var rec = data[2]
			var text = data.slice(3,data.length).join(" ")
			var msg = "@"+rec+" "+text
		} else{
			var msg = data.slice(1,data.length).join(" ")
		}
		if (msg.indexOf(COMMAND_SYMBOL) === 0 || (msg.indexOf("/") === 0 && msg.indexOf("/me") != 0)) {
			return
		} else{
			API.sendChat(msg)
		}
		return
	};
	if (chatsplit[0]==="tweek"){
		/* Sends one of the legendary tweek phrases. */
		var ind = Math.floor((tweek.length+chatsplit[1]-1)%tweek.length) || Math.floor(Math.random()*tweek.length)	
		API.sendChat(tweek[ind])
		return
	};
	if (chat==="triforce"){
		API.sendChat("▲")
		setTimeout(function(){API.sendChat("▲  ▲")},200)
		return
	};
	if (chat==="triforce "){
		API.sendChat("   ▲")
		setTimeout(function(){API.sendChat("▲  ▲")},200)
		return
	};
	if (chatsplit[0]==="valentine"){
		if (chatsplit[1]==="showmethescore"){
			var max = [0,'name']
			for (var key in VALENTINES){
				if (VALENTINES[key]>max[0]){
					max = [VALENTINES[key],key]
				}
			}
			API.sendChat(max[1]+" is the most loved person in this room with "+max[0]+" valentines on their hands!")
			return
		}
		var name = (chat_orig.split(" ").slice(1).join(" "))
		if (name[0]==="@"){
			name = name.slice(1)
		}
		if (name.slice(-1)===" "){
			name = name.slice(0,-1)
		}
		VALENTINES[name] = VALENTINES[name] + 1 || 1
		API.sendChat("@"+name+" :chocolate_bar: :heart:")
		return
	};
	if (chat==="plugpoints"){
		var user = PATRONS[uid]
		var points = user.songplays + user.woots + user.grabs + user.wooted + user.mehed
		API.sendChat("@"+uname+", You have "+points+" plugpoints.")
	};
	return
};	

function chatGames(uname,chat,chat_orig,uid) {
	var chatsplit = chat.split(" ")
	if (chatsplit[0]==="hangman" && assertPermission(uid,3) && chatsplit.length>=2){
		/* Initializes hangman mode. Only people in the master list or managers (and above) can start the game. */
		botHangman(chatsplit[1])
		return
	};
	if (chatsplit[0]==="russian"){
		russianRoulette(chat,uid,uname)
		return
	};
	return
};

function chatVarious(uname,chat,chat_orig,uid){
	if (chat==="tweekcycle"){
		/* Toggle KITT's persistence in adding tweek to the waitlist. */
		global_uid = uid
		SETTINGS.addtweek = Boolean(SETTINGS.addtweek^true)
		return
	};
	if (chat==="kitt"){
		/* Just a greeting. */
		if (Math.random()>=0.3){
 			API.sendChat("Yes, Michael?")
		} else{
 			API.sendChat("I'm the voice of the Knight Industries Two Thousand's microprocessor. K-I-T-T for easy reference, K.I.T.T. if you prefer.")
		}
		return
	};
	if (chat==="woot" && assertPermission(uid,0)){
		$('#woot').click()
		return
	};
	if (chat==="meh" && assertPermission(uid,0)){
		$('#meh').click()
		return
	};
	if (chat==="ping"){
		API.sendChat("@"+uname+" pong!")
		return
	};
	return
};

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
		moveInList({name: name})
		return
	};
	if (pattern_move.test(msg)){
		var name = msg.slice(6,msg.length-49+(msg.slice(-48).search('from position ')))
		delete mutationlists.users_to_move[name]
		return
	};
	if (pattern_destaff.test(msg)){
		var name = msg.slice(8,msg.length-16)
		var uid = getUID(name)
		PATRONS[uid].role = 0
		if (mutationlists.users_to_mute.indexOf(name)>-1){
			userMute({uid: uid, duration: 1, name: name})
		}
		return
	};
	if (pattern_muted.test(msg)){
		var name = msg.slice(6,msg.length-16)
		setStaff({name: name})
		return
	};
	if (pattern_staff.test(msg)){
		/* "Resident DJ" is the only role consisting of two words, so that has to be check when slicing the
		message to retrieve the name. */
		var role = msg.split(" ").slice(-1)[0].slice(0,-1)
		var dj = role==="DJ"
		var name = msg.split(" ").slice(1,-(3+~~dj)).join(" ")
		var uid = getUID(name)
		delete mutationlists.users_to_staff[name]
		PATRONS[uid].role = ["","DJ","bouncer","manager","co-host","host"].indexOf(role)
		return
	};
};

function createEye(){
	var target = document.querySelector('#chat-messages')
	var config = {childList: true}
	Eye = new MutationObserver(surveillance)
	Eye.observe(target,config)
};

			// ON-EVENT FUNCTIONS
function waitlistUpdate(object){
	/* Gets an updated waitlist and checks if it reduced in length to check for dropped users. */
	wlc = API.getWaitList()
	wlcn = []
	for (i = 0; i<wlc.length; i++) {
		wlcn[i] = wlc[i].username
	}
	if (wlpn.length>wlcn.length){
		droppedUsers()
	}
	wlpn = wlcn
};

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
	var found = false
	var song=API.getMedia()
	var authorlower = song.author.toLowerCase()
	var titlelower = song.title.toLowerCase()
	var song.authorl = authorlower
	var song.titlel = titlelower
	for (i=0; i<songlist.length; i++){
		if (compareSongInList(songlist[i],song)){
// 			console.log(songlist[i][0]===song.cid || (songlist[i][1].toLowerCase()===authorlower && songlist[i][2].toLowerCase()===titlelower))
		}
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
};

function checkDJ(object){
	/* removes current dj from left users and rolled users lists, if present */
	if (!('dj' in object)){return}
	if (object.dj.username in dropped_users_list) {
		delete dropped_users_list[object.dj.username]
	}
	if (object.dj.id in rolusr) {
		delete rolusr[object.dj.id]
	}
};

function statisticUpdate(){
	/*
	Update stats list. Saves the duration of the song, wait list length,
	time of day and chat update rate. After sufficient data have been collected,
	some sort of linear prediciton algorithm will be made up to tell how long,
	approximately, the user has to wait until it's his turn to dj.
	*/
	var dur = API.getMedia().duration
	var queue = API.getWaitList().length
	var time = new Date()
	var freq = chatsstat/((time - songstats[songstats.length-1][2])/60000)
	songstats.push([dur,queue,time,freq])
	chatsstat = 0
};		

function droppedUsers() {
	/* 
	Checks if any of the usernames in a previous (before wait_list_update event) wait list
	are missing in the current wait list, also checking if that user is not a current dj.
	If anyone is missing — writes down their username, last position, time and date object
	*/
	for (i = 0; i < wlpn.length; i++) {
		if (wlcn.indexOf(wlpn[i])<0 && wlpn[i]!==API.getDJ().username) {
			var date = new Date()
			var hour = date.getHours()
			var min = date.getMinutes()
			dropped_users_list[wlpn[i]] = [i+1, hour, min, date]
		}
	}
};

function mrazotaCheck(){
	/* If the track is way too long while people are in queue — skips it. */
	if (!(SETTINGS.mrazota)){return}
	var dur = API.getMedia().duration
	var queue = API.getWaitList().length
	if (dur >= 6000 && queue > 1) {
		API.moderateForceSkip()
	}
};

function addTweek(data){
	if (!findInQueue(5121031)[0] && SETTINGS.addtweek && data.dj.id!=5121031){
		API.moderateAddDJ('5121031')
	}
};

function sameArtist(){
	/*
	Notifies a dj if a song by that artist (or the same song even) has already been played recently. 
	'songlist' stores times of the two latest plays, so if both are less than 3 hours old, then the same
	song has played recently.
	*/
	if (!SETTINGS.sameartist){return}
	var artist = API.getMedia().author
	var time = Date.now()
	var dj = API.getDJ().username
	var played = 0
	for (var i=0; i<songlist.length; i++){
		if (songlist[i][1]===artist){
			if (songlist[i][4]>1 && (time - songlist[i][3])<3*60*60*1000 && (time - songlist[i][5])<3*60*60*1000){
				API.sendChat("@"+dj+", That song has been played very recently. Please, be more diverse in your music choice.")
				return
			}
			if ((time - songlist[i][5])<3*60*60*1000){
 				played++
			} 
			if (played===2){
				API.sendChat("@"+dj+", A song by that artist has been played very recently. Please, be more diverse in your music choice.")
				return
			}
		}
	}
};

function reallyLockWaitList(){
	if (SETTINGS.locklist){
		var q = API.getWaitList()
		for (var i=0; i<q.length; i++){
			API.moderateRemoveDJ(q[i].id)
		}
	}
};

function removeFromList(){
	setTimeout(function(){
		for (var key in users_to_remove){
			var user = users_to_remove[key]
			if (user[1] && API.getDJ().id!=user[0]){
				API.moderateRemoveDJ(user[0])
				delete users_to_remove[key]
			}
		}
	},500)
};

function tagPlayed(){
	var user = API.getDJ().username
	if (users_to_remove[user]){
		users_to_remove[user][1]=true
	}
};

function toggleCycle(manual){
	/* 
	Turns DJ cycle on or off depending on wait list length. Called after every WAIT_LIST_UPDATE event. 
	"manual" argument is passed when called	from chat function. "button.on" and "button.off" seem to be 
	in the wrong places, but that's plug.dj we are talking about, you can't honestly expect them to do
	everything properly. Or maybe I'm just missing the point of calling the buttons the other way around. 
	*/
	if (SETTINGS.autocycle){
		var queue = API.getWaitList().length
		if (queue>14 && DJCYCLE!=false){
			$('#room-bar').click()
			setTimeout(function(){$("button.on")[0].click()},500)
			setTimeout(function(){$('#room-bar').click()},1000)
			DJCYCLE = false
		}
		if (queue<10 && DJCYCLE!=true){
			$('#room-bar').click()
			setTimeout(function(){$("button.off")[0].click()},500)
			setTimeout(function(){$('#room-bar').click()},1000)
			DJCYCLE = true
		}
	}
	if (manual === "enable"){
		$('#room-bar').click()
		setTimeout(function(){$("button.off")[0].click()},250)
		setTimeout(function(){$('#room-bar').click()},500)
		DJCYCLE = true
	}
	if (manual === "disable"){
		$('#room-bar').click()
		setTimeout(function(){$("button.on")[0].click()},250)
		setTimeout(function(){$('#room-bar').click()},500)
		DJCYCLE = false
	}
};

function updateScore(){
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
};

function wakeUp(){
	if (API.getWaitList().length===0){return}
	var name = API.getWaitList()[0].username
	if (users_to_wake_up.indexOf(name)>-1){
		API.sendChat("@"+name+", wake up!")
		users_to_wake_up.splice(users_to_wake_up.indexOf(name),1)
	}
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
		if (current.cid === songs[0].media.cid && elapsed<10){
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
		var text = time+" "+mod+" skipped "+song.media.author+" - "+song.media.title+link+" when the score was "+JSON.stringify(song.score)
		if (mix){
			var skipmix = "Skipmix initiated by "+mod+" with a duration of "+mix+" seconds."
			SKIPS.record.push([Date.now(), text, skipmix])
		} else {
			SKIPS.record.push([Date.now(), text])
		}
	},100)
};

			// SCHEDULED FUNCTIONS

function clearDroppedUsers(){
	/* If the user was present in this array for more than 30 minutes — remove them. */
	var date = new Date()
	for (var key in dropped_users_list) {
		if ((date - dropped_users_list[key][3])/60000>=30) {
			delete dropped_users_list[key]
		}
	}
};

function catLimit(uname){
	/* Once every 24 hours clears the catLimit list. */
	delete catusr[uname]
};

function asianLimit(uname){
	/* Once every 24 hours clears the catLimit list. */
	delete asnusr[uname]
};

function clearIssued(chat,uid){
	/* Clears issuedcommands array. */
	setTimeout(function(){
		if (PATRONS[uid].lastcommand === chat.split(" ")[0]) {
			PATRONS[uid].lastcommand = null
			PATRONS[uid].samecommand = 0
		}
	},2*60*1000);
};

function checkConnection(){
	/*
	Every n minutes increments connection counter and sends the reset command. If bot is not 
	properly connected (can't send, receive and delete chats), the counter won't be reset and after
	reaching a limit the page will refresh.
	*/
	if (lost_connection_count===2){
		botRestart()
		return
	}
	if (API.getTimeRemaining()<1 && API.getDJ()){
		// If 0 time left of a song and someone's in a booth, then something's probably wrong. Check again in 20 secs
		// whether that's a coincidence. If the song is still stuck — restarts regardless of chat.
		lost_connection_count++
		setTimeout(function(){checkConnection()},20*1000)
		return
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
};

function resetChatCounter(n){
	if (n===1){
		chatsglob[0]=[Date.now(),0]
	}
	if (n===2){
		chatsglob[1]=[Date.now(),0]
	}
};

function checkStuck(){
	/* Gets the remaining time of a track and then calls itself after the song should've ended to check if it changed successfully
	by calling itself again a few times in a short period. If no one is playing, wait half an hour before next check. 
	If the song was stuck for more than ~15 seconds and couldn't have been skipped — calls itself in 30 minutes, by which
	time either everything gets fixed, plug goes down or bot restarts. */
	if (!API.getDJ() || songstuck>=7){
		setTimeout(checkStuck,30*60*1000)
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
	
};

			// SUPPORTING FUNCTIONS
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
		delete timeouts[type]
	}
// 	if (!!timeouts.cycle && type==="cycle") {
// 		clearTimeout(timeouts.cycle)
// 		timeouts.cycle = null
// 	}
// 	if (!!timeouts.skip && type==="skip") {
// 		clearTimeout(timeouts.skip)
// 		timeouts.skip = null
// 	}
// 	if (!!timeouts.voting && type==="voting"){
// 		clearTimeout(timeouts.voting)
// 		timeouts.voting = null		
// 	}
// 	if (!!timeouts.sign && type==="sign"){
// 		clearTimeout(timeouts.sign)
// 		timeouts.sign = null		
// 	}
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
		if (voters.indexOf(uid)<0){
			voters.push(uid)
			propvotes[0]++
			if (voters.length%5===0){
				setTimeout(function(){API.sendChat(voters.length+" people have voted!")},1000)
			}
		} else {
			API.sendChat("@"+uname+", You have already voted. You can't revoke or change your vote.")
		}
		return
	};
	if (chat[0].toLowerCase()==="!votenay"){
		if (voters.indexOf(uid)<0){
			voters.push(uid)
			propvotes[1]++
			if (voters.length%5===0){
				setTimeout(function(){API.sendChat(voters.length+" people have voted!")},1000)
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
		if (n>proposals.length){
			API.sendChat("No such option in the poll.")
			return
		}
		if (voters.indexOf(uid)<0){
			voters.push(uid)
			proposals[n][1]+=1
			if (voters.length%5===0){
				setTimeout(function(){API.sendChat(voters.length+" people have voted!")},1000)
			}
		} else {
			API.sendChat("@"+uname+", You have already voted. You can't revoke or change your vote.")
		}
		return
	};
		// Counting the votes.	
	if (chat[0].toLowerCase()==="!voteend" && (assertPermission(uid,0) || votestarter === uid)) {
		// If 'proposal' is declared, the single-option voting is in process.
		if (proposal){
			if (propvotes[0]===0 && propvotes[1]===0){
				API.sendChat("No one has voted.")
				API.sendChat("/votefinish")
				return
			}
			var yea = "The majority has voted in favor of the proposal."
			var nay = "The majority has ruled against the proposal. No revolution today, sorry."
			var result = [nay,yea][+(propvotes[1]<propvotes[0])]
			API.sendChat(result)
			API.sendChat("/votefinish")			
			return
		}
		// If 'proposals' is not null, then multiple-option voting is in process.
		if (proposals){
			var winprop = []
			var maxvotes = 0
			for (var i=0; i<proposals.length; i++){
				if (proposals[i][1]>maxvotes){
					winprop = [i]
					maxvotes = proposals[i][1]
				} else if (proposals[i][1]===maxvotes){
					winprop.push(i)
				}
			}
			if (maxvotes===0){
				API.sendChat("No one has voted.")
				API.sendChat("/votefinish")
				return
			}
			if (winprop.length===1){
				var result = proposals[winprop[0]][0]
				if (!(/[.!?]/.test(result.slice(-1)))) {result+="."} // Add a full stop at the end of result if it's not there.
				API.sendChat("The winning option of today's voting is: "+result+" with "+maxvotes+" votes.")
				API.sendChat("/votefinish")
			} else if (winprop.length>=4){
				API.sendChat('Four or more options have the same score of '+maxvotes+' votes. I strongly advise you to revote. Type "!revote" to do that.')
				reproposals = proposals
				proposals = null
			} else {
				var ties = ""
				tiedproposals = []
				for (j=0; j<winprop.length; j++) {
					tiedproposals.push(proposals[winprop[j]][0])
					ties += proposals[winprop[j]][0]
					if (/[.!?]/.test(ties.slice(-1))) {ties+=" "}
					else {ties+="; "}
				}
				ties = ties.slice(0,-2) + "."
				tiedproposals.forEach(function(elem){elem[1]=0})
				proposals = null
				clearTimeouts("voting")
				API.sendChat(winprop.length+" options are tied with "+maxvotes+" votes each. They are: "+ties)
				setTimeout(function(){API.sendChat('If you would like to restart the voting with those options only, type "!voteties"')},500)
			}
		}
		return
	};
	if (chat[0].toLowerCase()==="!votestandings") {
		if (proposal) {
			API.sendChat("Currently "+propvotes[0]+" have voted 'yea', and "+propvotes[1]+" have voted 'nay'")
			return
		}
		if (proposals) {
			var winprop = []
			var maxvotes = 0
			for (var i=0; i<proposals.length; i++){
				if (proposals[i][1]>maxvotes){d
					winprop = [i]
					maxvotes = proposals[i][1]
				} else if (proposals[i][1]===maxvotes) {
					winprop.push(i)
				}
			}
			if (winpop.length===1) {
				API.sendChat("Currently the leading option is '"+proposals[winprop[0]][0]+"' with "+maxvotes+" votes.")
			} else {
				API.sendChat("Two or more options are tied with "+maxvotes+" votes each")
			}
			return
		}
	};
	if (chat[0].toLowerCase()==="!voteties" && (assertPermission(uid,0) || votestarter === uid)){
		// Create a "chat message" object and call a function as if a chat message was sent.
		proposals = null
		var chat = {}
		chat.un = "name"
		chat.uid = votestarter
		chat.message = "!votestart "+tiedproposals.join(" -o ")
		chat.cid = "0"
		chatClassifier(chat)
		
	};
	if (chat[0].toLowerCase()==="!revote" && (assertPermission(uid,0) || uid === votestarter)){
		// Create a "chat message" object and call a function as if a chat message was sent.
		if (proposal){
			propvotes = null
			var chat = {}
			chat.un = "name"
			chat.uid = votestarter
			chat.message = "!votestart "+proposal
			chat.cid = "0"
			proposal = null
			chatClassifier(chat)
		}
		if (reproposals){
			var message = "!votestart "
			reproposals.forEach(function(elem){
				message += elem[0] + " -o "
			})
			message = message.slice(0,-4)
			proposals = null
			reproposals = null
			var chat = {}
			chat.un = "name"
			chat.uid = votestarter
			chat.message = "!votestart "+message
			chat.cid = "0"
			chatClassifier(chat)
		}
	};
	if (chat[0].toLowerCase()==="!voteremind" && (assertPermission(uid,2) || uid===votestarter)) {
		if (proposal) {
			API.sendChat("The voting is in progress. Today's proposal is: "+proposal+'. Vote by typing "!voteyea" or "!votenay"')
		}
		if (proposals) {
			var chat = "The voting is in progress. Options are"+propchat.slice(propchat.indexOf(":"))
			API.sendChat(chat)
			setTimeout(function(){API.sendChat('Please vote for an option of your choice by typing "!vote #"')},500)
		}
	};
	if (data==="/votefinish" || (chat[0].toLowerCase()==="!votehalt" && (assertPermission(uid,4) || votestarter===uid))) {
	// Remove all voting-related variables and turn off chat listeners.
		propvotes = null
		proposal = null
		proposals = null
		tiedproposals = null
		voters = null
		votestarter = null
		API.off(API.CHAT,proposalVoting)
		API.off(API.CHAT_COMMAND,proposalVoting)
		clearTimeouts("voting")
	};
};

function findInQueue(uid){
	/* Find out if the persion is in the wait list and their position, if in the queue. 
	Double negative is because Array.every() stops at the first False. */
	var q = API.getWaitList()
	var i = 0
	return [!q.every(function(user){i++; return user.id!=uid}),i]
};

function getUID(name){
	var users = API.getUsers()
	var uid
	var exactname = false
	for (var i=0; i<name.length; i++){
		if (name.charCodeAt(i)>65280 && name.charCodeAt(i)<65375){
			exactname = true
			break
		}
	}
	if (!exactname){
		users.forEach(function(elem){
			var username = elem.username.split("").map(function(letter){
				if (letter.charCodeAt(0)>65280 && letter.charCodeAt(0)<65375){
					return String.fromCharCode(letter.charCodeAt(0)-65248)
				} else {return letter}
			}).join("")
			if (username===name){uid = elem.id}})
		if (!uid){
			for (var key in PATRONS){
				var username = PATRONS[key].username.split("").map(function(letter){
					if (letter.charCodeAt(0)>65280 && letter.charCodeAt(0)<65375){
						return String.fromCharCode(letter.charCodeAt(0)-65248)
					} else {return letter}
				}).join("")
				if (username===name) {
					uid = PATRONS[key].id
				}
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
		name = PATRONS[uid].name
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
	if (MasterList.indexOf(uid)>-1 || API.getUser(uid).role>=((n*n)/n)){
		return true
	} else {return false}
};

function enableSetting(uid/*, 'setting' args*/){
	global_uid = uid
	if (arguments[1]==="all"){
		for (var setting in SETTINGS){
			if (setting==="locklist"){continue}
			SETTINGS[setting] = true
		}
		return
	}
	for (var i=1; i<arguments.length; i++){
		SETTINGS[arguments[i]]=true
	}
};

function disableSetting(uid/*, 'setting' args*/){
	global_uid = uid
	if (arguments[1]==="all"){
		for (var setting in SETTINGS){
			if (setting==="locklist"){continue}
			SETTINGS[setting] = false
		}
		return
	}
	for (var i=1; i<arguments.length; i++){
		SETTINGS[arguments[i]]=false
	}
};

function enoughToSkip(){
	var score = API.getScore()
	var users = API.getUsers()
	var grey = 0
	users.forEach(function(elem){if (elem.role<=1){grey++}})
	if (API.getTimeElapsed()<10){return false}
	if (score.negative >= (Math.floor(score.positive*1.25)+Math.floor(grey/5)+3)) {
		return true
	} else {return false}
};

function skipMix(songid, duration, name){
	var id = API.getMedia().cid
	clearTimeouts("skipmix")
	if (songid !== id) {
		return
	}
	if (API.getTimeElapsed()>=duration){
		API.moderateForceSkip()
		SKIPS.skipmixtime = null
		recordSkip(name, duration)
	}
	return
};

function kittChats(data){
	/* Tracks messages from bot and acts if needed. */
	var p_lastpos = /is not in the list. Sorry.$/
	var p_wakeup = /wake up!$/
	if (p_lastpos.test(data.message)){
		setTimeout(function(){API.moderateDeleteChat(data.cid)},2000)
	}
	if (p_wakeup.test(data.message)){
		API.moderateDeleteChat(data.cid)
	}
};

function fixLinksAndEmoji(message){
	var text = message
	var pattern_link = /(.*)(<a href=")(.*)(" target=)(.*)(<\/a>)(.*)/
	var pattern_emoji = /(.*)(<span class="emoji)(.*)(<span class="emoji )(.*)("><\/span><\/span>)(.*)/
	var pattern_emojicodes = /emoji-(?!glow)[a-z0-9\-]*(?=")/gi
	var hasemoji = false

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

			// MODERATION
function moveInList(UPN){
	/* Move a person in wait list. UPN stands for UID, Position, Name — three properties of argument object
	that needs to be passed. At least uid or name has to be given. */
	var uid = UPN.uid || getUID(UPN.name)
	var name = UPN.name || getName(UPN.uid)
	while (mutationlists.users_to_add.indexOf(name)!=-1){ // Remove all elements that have that name
		mutationlists.users_to_add.splice(mutationlists.users_to_add.indexOf(name),1)
	}
	if (mutationlists.users_to_move[name] && findInQueue(getUID(name))[1]>mutationlists.users_to_move[name][1]){
		API.moderateMoveDJ(mutationlists.users_to_move[name][0],mutationlists.users_to_move[name][1])
	} else {delete mutationlists.users_to_move[name]}
	
	if (UPN.position){
		API.moderateMoveDJ(uid,UPN.position)
	}
};

function userMute(UDN){
	/* Mute a user for a given duration. UDN stands for UID, Duration, Name — three properties of argument object that
	that needs to be passed, with uid or name being optional, but not both. */
	var uid = UDN.uid || getUID(UDN.name)
	var duration = [API.MUTE.SHORT,API.MUTE.MEDIUM,API.MUTE.LONG][UDN.duration-1]
	API.moderateMuteUser(uid,1,duration)
	while (mutationlists.users_to_mute.indexOf(UDN.name)!=-1){ // Remove all elements that have that name
		mutationlists.users_to_mute.splice(mutationlists.users_to_mute.indexOf(UDN.name),1)
	}
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
	mutationlists.users_to_mute.push(name)
	mutationlists.users_to_staff[name]=[uid,role]
	API.moderateSetRole(uid,0)
	setTimeout(function(){if (API.getUser(uid).role!=role){API.moderateSetRole(uid,role)}},2000)
	return
}

function userBan(UDN){
	/* Ban a user for a given duration. UDN stands for UID, Duration, Name — three properties of argument object that
	that needs to be passed, with uid or name being optional, but not both. */
	var uid = UDN.uid || getUID(UDN.name)
	var duration = [API.BAN.HOUR, API.BAN.DAY, API.BAN.PERMA][UDN.duration-1]
	API.moderateBanUser(uid,1,duration)
	return
};

function setStaff(URN){
	/* Set user role. 0 — remove from staff. URN stands for UID, Role, Name — three properties of argument object that
	that needs to be passed, with uid or name being optional, but not both. */
	var uid = URN.uid || getUID(URN.name)
	if (URN.role != undefined){
		API.moderateSetRole(uid,URN.role)
		return
	}
	if (mutationlists.users_to_staff[URN.name]){
		API.moderateSetRole(mutationlists.users_to_staff[URN.name][0],mutationlists.users_to_staff[URN.name][1])
	}
};

			// PATRON FUNCTIONS			
function updatePatrons(){
	var u = API.getUsers()
	for (var i=0; i<u.length; i++) {
		var user = u[i]
		updatePatron(user)
	}
};

function modifyPatron(name, prop, value){
	var uid = getUID(name)
	if (!uid){return}
	
	if (prop === "role" || "prole" || "roulette" || "rouletterecord"){
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
		PATRONS[user.id] = patron
	}
};

function patronLeave(user){
	if (PATRONS[user.id]){
		PATRONS[user.id].lastseen = Date.now()
	}
};

function patronPlayed(data){
	PATRONS[data.dj.id].songplays += 1
};

function patronScore(){
	var woot = SCORE.woot
	var meh = SCORE.meh
	var grab = SCORE.grab
	var uid = SCORE.uid
	PATRONS[uid].woots += woot
	PATRONS[uid].grabs += grab
	PATRONS[uid].mehs += meh
	SCORE = {woot: 0, meh: 0, grab: 0, uid: uid}
	SCORE.saved = true
	updateScore()
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
	if (msg.split(" ")[0]==="!letter" || msg.split(" ")[0]==="!lt"){
		hangman(msg.split(" ")[1].toLowerCase(),"letter",uname)
	};
	if (msg.split(" ")[0]==="!word" || msg.split(" ")[0]==="!wd"){
		hangman(msg.split(" ")[1].toLowerCase(),"word",uname)
	};
	if (msg==="!hangstop" && assertPermission(data.uid,0)){
		mode = "normal"
		hangmanword = ""
		hangmanwordg = ""
		hangcount = 0
		API.off(API.CHAT, hangchat)
	};
};

function hangmanConsole(chat,type,name){
	// same as the other one, just for "/" commands and outputs in console. Debugging-debugging.
	wrd = hangmanword
	wrdg = hangmanwordg
	indc = []
	if (type==="word"){
		if (chat.toLowerCase()==wrd.toLowerCase()){
			wrdg = wrd
		} else{
			console.log("Sorry, that's not the word!")
		}
	};
	if (type==="letter"){
		if (wrdg.toLowerCase().indexOf(chat)>-1){
			console.log("That letter has already been guessed!")
		} else{
			indc = letind(wrd.toLowerCase(), chat.toLowerCase())
			if (indc.length>0){
				console.log("Correct!")
				for (i=0; i<indc.length; i++){
					wrdg = wrdg.substr(0,indc[i]*2)+wrd[indc[i]]+wrdg.substr(indc[i]*2+1)
				}
				setTimeout(function(){console.log(wrdg)},(250))
			} else{
				console.log("Sorry, no such letter in the word!")
			}
		}
	};
	hangmanwordg = wrdg	
	if (wrdg===wrd || wrdg.indexOf("_")==-1){
		setTimeout(function(){console.log("Congratulations @"+name+", you have won! The word was: "+wrd)},(400))
		mode = "normal"
		hangmanword = ""
		hangmanwordg = ""
		API.off(API.CHAT_COMMAND, hangcommands);
	};
};

function hangmanCommands(command){
	// Yep, you got it.
	if (command.slice(0,7)==="/letter"){
		hangmanconsole(command.slice(8,command.length),"letter","fr")
	};
	if (command.slice(0,5)==="/word"){
		hangmanconsole(command.slice(6,command.length),"word","fr")
	};
};

function hangman(chat,type,name){
	/* Checks the word or letter, case-independent. Gives 10 tries to guess the word. */
	var wrd = hangmanword
	var wrdg = hangmanwordg
	var indc = []
	if (type==="word"){
		if (chat.toLowerCase()===wrd.toLowerCase()){
			wrdg = wrd
		} else{
			API.sendChat("Sorry, that's not the word!")
		}
	};
	if (type==="letter"){
		if (hangtried.indexOf(chat.toLowerCase())>-1){
			API.sendChat("That letter has already been guessed!")
		} else{
			indc = letind(wrd.toLowerCase(), chat.toLowerCase())
			if (indc.length>0){
				API.sendChat("Correct!")
				for (i=0; i<indc.length; i++){
					wrdg = wrdg.substr(0,indc[i]*2)+wrd[indc[i]]+wrdg.substr(indc[i]*2+1)
				}
				setTimeout(function(){API.sendChat(wrdg)},250)
			} else{
				API.sendChat("Sorry, no such letter in the word!")
				hangcount++
			}
		}
		hangtried.push(chat.toLowerCase())
	};
	hangmanwordg = wrdg	
	if (wrdg===wrd || wrdg.indexOf("_")===-1){
		setTimeout(function(){API.sendChat("Congratulations @"+name+", you have won! The word was: "+wrd)},(250))
		mode = "normal"
		hangmanword = ""
		hangmanwordg = ""
		hangcount = 0
		hangtried = []
		API.off(API.CHAT, hangmanChat)
	};
	if (hangcount>=10){
		setTimeout(function(){API.sendChat("Ah, wrong once again! You've been hung. The word was: "+wrd)},(250))
		mode = "normal"
		hangmanword = ""
		hangmanwordg = ""
		hangcount = 0
		hangtried = []
		API.off(API.CHAT, hangmanChat)
	};
};

function russianRoulette(chat,uid,uname){
	PATRONS[uid].lastcommand = null
	if (chat.split(" ")[1]==="score"){
		API.sendChat("@"+uname+" "+PATRONS[uid].roulette+", "+(""+Math.pow(0.833,PATRONS[uid].roulette)*100).slice(0,5)+"%")
		return
	}
	if (chat.split(" ")[1]==="highscore"){
		var highest = true
		for (var key in PATRONS){
			if (PATRONS[key].rouletterecord>PATRONS[uid].rouletterecord){
				highest = false
			}
		}
		API.sendChat("@"+uname+" highest score was "+PATRONS[uid].rouletterecord+", "+(""+Math.pow(0.833,PATRONS[uid].rouletterecord)*100).slice(0,5)+"%"+
			["",". Highest in this room!"][~~highest])
		return
	}
	if (chat.split(" ")[1]==="highest"){
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
		API.sendChat("/me @"+uname+" BANG!")
		var role = API.getUser(uid).role
		if (role>0) {staffMute({uid: uid, duration: 1}) 
		} else {userMute({uid: uid, duration: 1})}
	} else {
		PATRONS[uid].roulette = PATRONS[uid].roulette+1
		if (PATRONS[uid].roulette>PATRONS[uid].rouletterecord){
			PATRONS[uid].rouletterecord = PATRONS[uid].roulette
		}
		API.sendChat("/me @"+uname+" click")
	}
	return
};

			// Classes
function Patron(id){
	this.id = id
	this.name = null
	this.joined = null
	this.lastseen = null
	this.session = null
	this.prevnames = []
	this.role = 0
	this.prole = 0
	this.commands = 0
	this.messages = 0
	this.commandrate = 0
	this.samecommand = 0
	this.lastcommand = null
	this.roulette = 0
	this.rouletterecord = 0
	this.songplays = 0
	this.woots = 0
	this.grabs = 0
	this.mehs = 0
	this.wooted = 0
	this.grabbed = 0
	this.mehed = 0
	this.lastvote = {sid: 0, vote: 0, grab: false}
};

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

			// NOT IN USE OR DEPRECATED
function loadsonglist(){
	// converts the raw songlist to proper format.
	for (i=0; i<rawlist.length; i++){
		songlist.push(rawlist[i].split("+-+"))
		songlist[i][3]=parseInt(songlist[i][3])
		songlist[i][5]=parseInt(songlist[i][5])
		songlist[i][4]=parseInt(songlist[i][4])
	}
};

function loadstatlist(){
	// converts the raw stats to proper format (no need for now, really, 
	// but makes sure the file is not corrupted in some way).
	for (i=0; i<songstatsraw.length; i++){
		songstats.push(songstatsraw[i].split("+-+"))
		songstats[i][2]=new Date(songstats[i][2])
	}
};

function getinline(){
	var queue = API.getWaitList()
	var in_line = false
	for (key in queue){
		if (queue[key].username === "K.I.T.T."){
			in_line = true
		}
	}
	if (!in_line){
		API.moderateAddDJ(5433970)
	}
};

function nygreet(user){
	name = user.username
	ind = Math.floor(Math.random()*CHR_GREETINGS.length)
	if (!name in greeted_list){
		API.sendChat("@"+name+GREETINGS[ind])
		greeted_list.push(name)
	}
};

var left_message = Object.create(null); // DEPRECATED
function addandmove(uid,place){
	/* Move the person in waitlist. */
	if (WORKQUEUE > 1) {
		setTimeout(function(){addandmove(uid,place)},1000)
	} else{
		setTimeout(function(){API.moderateAddDJ(String(uid))},500)	// adds user to the queue
		setTimeout(function(){API.moderateMoveDJ(uid,place)},1000) 	// moves to that position if mod.
		WORKQUEUE -= 1
	}
};

function addandmove_deletechat(name,position,uid){
	/* Checks if the person has been moved to the required position. If not — tries to move him again. */
	queue = API.getWaitList()
	moved = false
	for (i=0; i<queue.length; i++) {
		if (queue[i].username == name && (i+1) <= position) {
			API.moderateDeleteChat(left_message[name])
			moved = true
			break
		}
	}
	if (!moved) {
		WORKQUEUE += 1
		addandmove(uid,position)
	}
};

function abusemute(uid){
	/* Mute for 15 minutes. Removes from staff, mutes, returns back to staff, because only greys can be muted. */
	if (WORKQUEUE > 1){
		setTimeout(function(){abusemute(uid)},1000)
	} else{
		API.sendChat("You seem to be using the bot wrong")
		role = API.getUser(uid).role
		API.moderateSetRole(uid,0)
		setTimeout(function(){API.moderateMuteUser(uid,1,API.MUTE.SHORT)},500)
		setTimeout(function(){API.moderateSetRole(uid,role)},1000)
		WORKQUEUE -= 1
	}
};

function abuseban(uname, uid){
	/* Ban the person for 1 hour. WORKQUEUE is a temporary solution to force serial execution of function. */
	if (WORKQUEUE > 1){
		setTimeout(function(){abuseban(uname,uid)},1000)
	} else{
		API.sendChat("@"+uname+" Why are you being such a dipshit?")
		setTimeout(function(){API.moderateBanUser(uid,3,API.BAN.HOUR)},1000*10)
		WORKQUEUE -= 1
	}
};
			// NOT IN USE OR DEPRECATED


start()