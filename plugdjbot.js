// ==UserScript==
// @name		Plugbot
// @namespace	plug
// @include		https://plug.dj/*
// @version		1
// @grant		none
// ==/UserScript==

GLOBAL = this

// Constants and arrays declaration
var DJJOIN = "yes"			// not in use currently
var MasterList=[4702482, 3737285, 4856012]	// list of user ids that can fully control the bot
var usrlft = Object.create(null);			// list of users left while in a queue. Associative array 
							// with 'key' being username. Holds position and time.
var wlc = [];	
var wlcn = [];		// wait list arrays. Previous and new (after wait_list_update
var wlp = [];		// event). ...n only holds usernames instead of user json objects
var wlpn = [];

var catusr = {};
var rolusr = {};

var hangmanword = "";
var hangmanwordg = "";

var chatsstat = 0;						// is used to count chat update rate
var chatsglob1 = 0;
var chatsglob2 = 0;

var mode = "normal";
var state = "";
var hangcount = 0;

var windowstats = window
var windowsongs = window


// The below arrays are all loaded from localStorage and don't need to be declared here. *raw is not even used anymore.
// Is only kept here for reference.
/*
var songlist = [];			
var songstats = [];
var songstatsraw = [];
var rawlist = [];
var dictru = [];
var dicteng = [];
var catlinks = [];
var roulette = [];
var asianlinks = [];
var commands = [];
var responses = [];
var comminput = [];
var allissuedcommands = [];
*/


var defaultcommands = ["!kitt", "!meow", "!bean", "!relay", "!add", "!lastpos", "!lastplayed", 
						"!asian", "!botjoin", "!botleave", "!botstart", "!botstop", "!mehskip", "!boooring",
						"!hangman", "!stopjoin", "!enablejoin", "!clearlists", "!roll", "!reroll", "!wowroll", "!tweek"]
						
// list of variables that are not changed often or at all and thus don't need to be saved periodically (unlike songlist and songstats, for example)
var immutablestoragekeys = ['dictru','dicteng','asianlinks','catlinks','tweek','atresponses','roulette']

// Only for reference, the actual 'localstoragekeys' variable is loaded from localStorage.
// var localstoragekeys = ['songlist','songstats','asianlinks','roulette','catlinks','commands','responses','comminput','allissuedcommands',
// 						'dictru','dicteng','tweek','atresponses'] 

var tweek = ['накрыло немношк', 'часы идут', 'если честно, то трек не очень', 'идите к черту)', 'никак',
			'да она усратая', 'она сейчас будет дрочит на сцене как всегда?', 'да', 'крис рок', 'нет',
			'чувствую ваши мысли', 'не пиши таких вещей больше', 'это даже не смешно', 'вы похоже, все ебанутые',
			'что за чушь вы порите', 'мне плохо стал о', 'я дружу со всеми', 'вы искренне слушали это говно?',
			'не люблю некрасивых баб', 'я тебе голову взорву', 'почему твоя девушка не парамор?', 'не трогай меня',
			'я буду твоей иллюзией', 'пакетик ванили','короче, это не интересно', '-_-', 'мне кажется ты ебанутый']
			
atresponses = ["K.I.T.T is not at home, please call back later.", "Please, be patient.", "I. Am. Busy.",
				"I need some rest.", "Nah, sorry, can't help you.", "Don't get angry with me, but I'm really tired.",
				"Nope, still don't want to do anything.", "Oh, sod off!",
				"Can't you see I'm busy?", "God, will you ever stop bothering me?", "No. Just no.",
				"I've done so much for you, but have I ever gotten anything in return?",
				"This may sound rude, but you irk me.","That is the most irritating thing I've heard toady.",
				"Yes?", "Shot through the heart, and you're blame, darling. You give love a bad name!",
				"You're a loaded gun, yeah, There's nowhere to run, No one can save me, the damage is done.","/me whistling",
				"Whoa, we're half way there. Whoa, livin' on a prayer.","Take my hand and we'll make it — I swear. Whoa, livin' on a prayer",
				"It's my life. And it's now or never. I ain't gonna live forever. I just wanna live while I'm alive.",
				"I'm a cowboy, on a steel horse I ride. I'm wanted dead or alive. Wanted dead or alive.",
				"Why you wanna tell me how to live my life? Who are you to tell me if it's black or white?",
				"My daddy lived the lie, it's just the price that he paid. Sacrificed his life, just slavin' away",
				"Rosie, Rosie I wanna take you away. Rosie, Rosie I'm gonna make you mine someday.",
				"I can feel it coming in the air tonight, oh Lord.","I've been waiting for this moment for all my life, oh Lord.",
				"Can you feel it coming in the air tonight, oh Lord, oh Lord.",
				"Well I remember, I remember don't worry.","How could I ever forget. It's the first time, the last time we ever met.",
				"But I know the reason why you keep your silence up.","No you don't fool me. The hurt doesn't show.",
				"But the pain still grows. It's no stranger to you and me",	"Well if you told me you were drowning, I would not lend a hand.",
				"I've seen your face before my friend. But I don't know if you know who I am.",
				"Well, I was there and I saw what you did. I saw it with my own two eyes.",
				"So you can wipe off that grin, I know where you've been. It's all been a pack of lies",
				"http://www.ellf.ru/nem/letomer/","http://kurs4today.ru/USD","http://www.youtube.com/watch?v=nzRdxabmX1o",
				"Зубочистку?","http://www.youtube.com/watch?v=eV_P3knWE9w"]

var IssuedCommands = Object.create(null);

var prev_chat_uid = 0;
var this_chat_uid = 0;

var WORKQUEUE = 0;

var lost_connection_count = 0;

var left_message = Object.create(null);

var GREETINGS = ['Sae hae bok mani ba deu se yo!', 'С Новым Годом!', 'Akemashite Omedetou Gozaimasu!', 'Будь аккуратнее с фейерверками!',
					'Счастья тебе и успехов :3', 'Вот и кончился 2014 год, а ты опять ничего не сделал.', 'Надеюсь, в Новом Году у тебя всё получится!',
					'У тебя самый вкусный оливье!', 'Поздравляю с наступающим или наступившим!']
var greeted_list = []
			
var AUTOTOGGLECYCLE = true

var startupnumber = 1

function start(){
	/*
	Tries to start up the bot every 5 seconds after the page has started to load.
	If no connection within 30 seconds — refreshes the page.
	On successful connection turns of audio/video by clicking the appropriate buttons
	and runs the init function.
	*/
	console.log("Trying to start up, try number "+startupnumber)
	if (typeof API !== 'undefined' && API.enabled){
		$("div.info").click()
		setTimeout(function(){$("div.item.settings").click()},250)
		setTimeout(function(){$("div.item.s-av.selected").click()},500)
		setTimeout(function(){$("div.back").click()},750)
		botinit()
	} else{
		if (startupnumber < 6){	
			setTimeout(function(){
				startupnumber++
				start()},5000)
		} else{
			window.location.href = "https://plug.dj/dvach"
		}
	}
};

			// bot mode functions: start, idle, hangman, etc. Different actions on events
botinit = function(){
	/*
	Loads all required objects from the local storage. The list of objects is also
	saved in local storage to make it alterable while the bot is running without
	the need to change code and restart.
	*/
	localstoragekeys = localStorage.getObject('localstoragekeys')
	for (i=0; i<localstoragekeys.length; i++){
		GLOBAL[localstoragekeys[i]] = localStorage.getObject(localstoragekeys[i])
	}
	botstart()
	// Checks the connection every 5 minutes and reconnects if necessary.
	setInterval(check_connection,5*60*1000)
	
	/*
	There are two global chat counters and timers. each is reset every 30 minutes to only
	get the 'current' chat rate.
	Whenever the chat rate is required, the one with the least time left till reset (i.e. 
	has more data) is used. Two timers/counters are necessary because of a reset,
	since otherwise it wouldn't be possible to get an accurate chat rate within a couple of
	minutes of every reset (which is a lot, considering the reset time of only 30 minutes).
	*/
	//chatsglobtime1 = 0 // Make it zero to know if there's not enough data yet
	//chatsglobtime2 = 0
	//interval(globalchatrate1,30min);timeout(interval(globalchatrate2,30))
}

botstart = function(){

	// Log the startup times.
	var t = new Date()
	var times = localStorage.getObject('startuptimes') || []
	times.push(t)
	localStorage.setObject('startuptimes',times)
	
	API.off()
	state = "running"
	API.chatLog("I am K.I.T.T.",true)
	// Get waitlist at start
	wlp = API.getWaitList()
	for (i = 0; i<wlp.length; i++) {
		wlpn[i] = wlp[i].username		// extract only usernames
	}
	
	// Chat responses
	API.on(API.CHAT, function(data){
		prev_chat_uid = this_chat_uid
		this_chat_uid = data.uid
		if (data.message[0]==="!"){
			botresponses(data)
		}
		if (data.uid === 5433970) {
			mesrec(data)
		}
		if (data.message.split(" ")[0]==="@K.I.T.T." && data.un!="K.I.T.T.") {
			API.sendChat("@"+data.un+" "+atresponses[Math.floor(Math.random()*atresponses.length)])
			return
		}
		chatsstat++ 	// increment chats count to calculate chat rate for song stats
		chatsglob1++	// increment chats count to calculate global chat rate
		chatsglob2++	// increment chats count to calculate global chat rate
	});
	// Commands (only work when issued by bot itself, i.e. on a computer it is running on)
	API.on(API.CHAT_COMMAND, chatcommands);
	
	// Check if anyone has left while in a queue. 
	// Counts the number of people in queue and toggles DJ cycles if needed
	API.on(API.WAIT_LIST_UPDATE, waitlistupdate);
	API.on(API.WAIT_LIST_UPDATE, togglecycle);
	
	// On DJ advance check if he is in the usrlft list to prevent !lastpos abuse
	// Also updates scrobble list, song length stats and
	// checks if the song is absurdly long while people are in queue
	API.on(API.ADVANCE, lftdjcheck);
	API.on(API.ADVANCE, songlistupdate);
	API.on(API.ADVANCE, statisticupdate);
	API.on(API.ADVANCE, mrazotacheck);	
	
	// Compares the votes and calls "mehskip" in 5 seconds.
	// If there are still 5+ more mehs than woots — skips.
	API.on(API.SCORE_UPDATE,function(data){
		if (data.negative>=data.positive+5){
			setTimeout(function(){mehskip()},(5000))
		}
	});

	// Save data to local storage every 5 minutes.
	setInterval(function(){API.sendChat("/savetolocalstorage")},5*60*1000)

	// Schedules 'left users' cleanup to be called every 30 minutes
	setInterval(clearleftusers,(30*60*1000))
};

botidle = function(){
	state = "idle"
	API.off(API.CHAT)
	console.log("idling...")
	API.on(API.CHAT, function(data){
		if (data.message==="!botstart" && state==="idle"){
			if(MasterList.indexOf(data.uid)>-1){
				API.sendChat("I'm the voice of the Knight Industries Two Thousand's microprocessor. K-I-T-T for easy reference, K.I.T.T. if you prefer.")
				botstart()
			} else{
				API.sendChat("@"+uname+" You do not have the security clearance for that action."
				+" If you try this again, you will be prosecuted to the full extent of the law.")
			}
		}
	})
};	

bothangman = function(language){
	console.log("Starting Hangman!")
	API.off(API.CHAT, hangchat)
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
	setTimeout(function(){API.sendChat('Guess a letter or the word by typing "!letter _" or "!word ___"')},(500))
	API.on(API.CHAT, hangchat)
};	

bothangmanconsole = function(language){
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

		// can only be used by bot himself. Internal stuff like "/export" song list or 
		// "/flush" roulette/cat limit and dropped users lists.
function chatcommands(command){
	console.log(command)
	command = command.split(" ")
	if (command[0]==="/transfertowindow"){
		window['BOTSCOPE'] = GLOBAL
	}
	if (command[0]==="/transferfromwindow"){
		var varname = command[1]
		GLOBAL[varname] = window[varname]
	}
	if (command[0]==="/connected"){
		lost_connection_count = 0
	}
	if (command[0]==="/kitt"){
		if (Math.random()>=0.3){
			console.log("Yes, Michael?")
		} else{
			console.log("I'm the voice of the Knight Industries Two Thousand's microprocessor. K-I-T-T for easy reference, K.I.T.T. if you prefer.")
		}
	};
	if (command[0]==="/flushlimits"){
		for (key in rolusr){
			delete rolusr[key]
		}
		for (key in catusr){
			delete catusr[key]
		}
		for (key in IssuedCommands){
			delete IssuedCommands[key]
		}
	};
	if (command[0]==="/expandvar"){
		var varname = command[1]
		var text = command.slice(2).join(" ")
		GLOBAL[varname].push(text)
	}
	if (command[0]==="/addvar"){
		localstoragekeys.push(command[1])
		API.sendChat("/savetolocalstorage force noschedule")
	}
	if (command[0]==="/addfile"){
		window['savecom'] = "/addtostorage "+command[1]
		$('#chat-messages').append('<div><input id="dropfile" type="file" onchange="API.sendChat(savecom)"/></div>')
	}
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
			API.sendChat("/savetolocalstorage force noschedule")
		}
		var fileval = document.getElementById('dropfile').files[0];		
		file.readAsText(fileval)
	};
	if (command[0]==="/savetolocalstorage"){
		localStorage.setObject('localstoragekeys',localstoragekeys)
		for (i=0; i<localstoragekeys.length; i++){
			if (!(command.indexOf("force") > -1) && immutablestoragekeys.indexOf(localstoragekeys[i]) > -1) {continue}
			localStorage.setObject(localstoragekeys[i],GLOBAL[localstoragekeys[i]])
		}
// 		if (!(command.indexOf("noschedule") > -1)) {
// 			setTimeout(function(){API.sendChat("/savetolocalstorage")},5*60*1000)
// 		}
	};
	if (command[0]==="/loadfromlocalstorage"){
		localstoragekeys = localStorage.getObject('localstoragekeys')
		for (i=0; i<localstoragekeys.length; i++){
			GLOBAL[localstoragekeys[i]] = localStorage.getObject(localstoragekeys[i])
		}
	};
	if (command[0]==="/flushlocalstorage"){
		for (i=0; i<localstoragekeys.length; i++){
			delete localStorage[localstoragekeys[i]]
		}
	}
	if (command[0]==="/exportsongs"){
		// exports songlist in the popup window, since writing to local file from within
		// the javascript is either impossible, or way too hard.
		data = songlist[0].join("+-+")
		for (i=1; i<songlist.length; i++){
			data = data+"\r\n"+songlist[i].join("+-+")
		}
		windowsongs = window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(data))
		
	};
	if (command[0]==="/exportstats"){
		// same as songlist
		data = songstats[0].join("+-+")
		for (i=1; i<songstats.length; i++){
			data = data+"\r\n"+songstats[i].join("+-+")
		}
		windowstats = window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(data))
		localStorage.setObject('songstats',songstats.slice(songstats.length-2,songstats.length))
	};
	if (command[0]==="/export"){
		var varname = command[1]
		if (GLOBAL[varname]){
			var data = GLOBAL[varname]
		} else {return}
		if (data[0] instanceof Array){
			expdata = data[0].join(" ")
			for (i=1; i<data.length; i++){
				expdata = expdata+"\r\n"+data[i].join(" ")
			}
		} else{
			expdata = data.reduce(function(a,b){return a+"\r\n"+b})
		}
		window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(expdata))			
	}
	if (command[0]==="/addtosonglist"){
		// manually add the song to song list. 
		songlistupdate()
	};
	if (command[0]==="/addtostats"){
		// manually add data to stat list.
		statisticupdate()
	};
	if (command[0]==="/hangmanru"){
		// start console version of hangman. Single player games have always been the best, right?
		bothangmanconsole("ru")
	};
	if (command[0]==="/hangmaneng"){
		bothangmanconsole("eng")
	};
	if (command[0]==="/issuedcommands") {
		console.log(IssuedCommands)
	};
	if (command[0]==="/exportcomms") {
		data = comminput[0].join(" - ")
		for (i=1; i<comminput.length; i++){
			data = data+"\r\n"+comminput[i].join(" - ")
		}
		window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(data))
	}
	if (command[0]==="/exportallcomms") {
		data = allissuedcommands[0].join(" - ")
		for (i=1; i<allissuedcommands.length; i++){
			data = data+"\r\n"+allissuedcommands[i].join(" - ")
		}
		window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(data))
	}
	if (command[0]==="/add"){
		if (data.length>=3) {
			if (commands.indexOf(command[1])<0){
				commands.push(command[1])
				responses.push(command.slice(2,command.length).join(" "))
				localStorage.setObject('addedcommands',[commands,responses,comminput])
			}
		}
	};
	if (command[0]==="/remove"){
		ind = commands.indexOf(command[1])
		commands.splice(ind,1)
		responses.splice(ind,1)
		localStorage.setObject('commands',commands)
		localStorage.setObject('comminput',comminput)
		localStorage.setObject('responses',responses)
	};
	if (command[0]==="/lastposlist"){
		for (key in usrlft){
			console.log(key+" "+usrlft[key])
		}
	};
	if (command[0]==="/outputall"){
		for (i=0; i<localstoragekeys.length; i++){
			console.log(localstoragekeys[i])
			console.log(GLOBAL[localstoragekeys[i]])
		}
	};
};

		// Bot's responses to "!command".
function botresponses(message){
	if (prev_chat_uid != this_chat_uid) {
		API.moderateDeleteChat(message.cid)
		this_chat_uid = 0
	}
	
	var uname = message.un;					
	var chat = message.message.toLowerCase();	// just for convenience
	var chat_orig = message.message;			// aaand it backfired.
	var uid = message.uid;
	
	allissuedcommands.push([uname, new Date(), chat_orig])
	
	if (uid in IssuedCommands && IssuedCommands[uid][0] === chat) {
		IssuedCommands[uid][1]++
	} else {
		IssuedCommands[uid] = [chat,1]
		clearissued(chat,uid)
	}
	
	if (IssuedCommands[uid][1] === 4) {
		API.sendChat("@"+uname+" If you send the same command once more, divine punishment will befall you.")
		return
	};
	
	if (IssuedCommands[uid][1] >= 5) {
		WORKQUEUE += 1
		abusemute(uid)
		return
	};
	
	if (uname==="SomethingNew"){				// If kittex is trying to use the bot, along with
		setTimeout(function(){API.sendChat("@SomethingNew PSSSSSSSSS")},1500)// an action (if proper command was given) will 	
	};										// also piss on him.

		
	if (chat==="!kitt"){
		if (Math.random()>=0.3){
 			API.sendChat("Yes, Michael?")	// Just a greeting. Not really useful
		} else{
 			API.sendChat("I'm the voice of the Knight Industries Two Thousand's microprocessor. K-I-T-T for easy reference, K.I.T.T. if you prefer.")
		}
		return
	};
	
	if (chat.split(" ")[0]==="!cycle" && API.getUser(uid).role >= 3){
		if (chat.split(" ")[1] === "autoon"){
			AUTOTOGGLECYCLE = true
		}	
		if (chat.split(" ")[1] === "autooff"){
			AUTOTOGGLECYCLE = false
		}
		if (chat.split(" ")[1] === "on"){
			togglecycle("enable")
		}
		if (chat.split(" ")[1] === "off"){
			togglecycle("disable")
		}
	}
	if (chat==="!restart" && MasterList.indexOf(uid)>-1) {
		API.sendChat("/savetolocalstorage")
		setTimeout(function(){window.location.href = "https://plug.dj/"},3000)
	}
	if (chat==="!meow"){			// send a random link to a cat in chat.
		if ((!(uname in catusr) || catusr[uname][0]<10)){
			ind=Math.floor(Math.random()*catlinks.length)	// again, not really useful, but cats!
			API.sendChat("@"+uname+" Here's your cat, good sir. "+catlinks[ind])
			if (uname in catusr) {
				catusr[uname][0]++
			} else {
				catusr[uname]=[1,new Date()]
				setTimeout(function(){catlimit(uname)},(1000*60*60*24))
			}
		}else{
			API.sendChat("I'm sorry, you have exceeded your daily cat limit")
		}
		return
	};
	if (chat.split(" ")[0]==="!bean"){		// Offers toothpick.
		if (chat.length===5){				// if nothing is given after the commands, sends the chat to the
			rec = uname						// person requesting
		} else {
			if (chat.split(" ")[1]==="rnd") {	// if "rnd" is present, choses a random person in the room
				users = API.getUsers()
				rec = users[Math.floor(Math.random()*users.length)].username
			} else {
				rec = chat_orig.slice(6,chat.length)	// otherwise sends the message to a provided recipient.
			}
		}
		API.sendChat("@"+rec+" Зубочистку?")
		return
	};
	if (chat==="!asian"){		// pictures of asians
		ind=Math.floor(Math.random()*asianlinks.length)	
		API.sendChat("@"+uname+" これはペンです. "+asianlinks[ind])
		return
	};
	if (chat==="!mehskip"){		// skip the track if there are 5+ more mehs
		score=API.getScore()				// than woots.
		if (score.negative>=score.positive+5){
			API.moderateForceSkip()
		} else{
			API.sendChat("Skip no-no.")		// if not enough mehs — does not skip.
		}
		return
	};
		// stopjoin/enablejoin don't have an effect now. But may be used in future 
		// to prevent residentDJs/bouncers from entering the queue at the event of sorts,
		// since "wait list lock" does not affect them. At least, it didn't before The Update.
	if (chat==="!stopjoin"){
		if (MasterList.indexOf(message.uid)>-1){
			DJJOIN="no"
		} else{
			API.sendChat("@"+uname+" You do not have the security clearance for that action."
						+" If you try this again, you will be prosecuted to the full extent of the law.")
			IssuedCommands[uid][1] = 5
		}
		return
	};
	if (chat==="!enablejoin"){
		if (MasterList.indexOf(message.uid)>-1){
			DJJOIN="yes"
		} else{
			API.sendChat("@"+uname+" You do not have the security clearance for that action."
						+" If you try this again, you will be prosecuted to the full extent of the law.")
			IssuedCommands[uid][1] = 5
		}
		return
	};
		// Let the bot join/leave DJ position. Play music when there is no one around, for example,
		// without manually placing him in / kicking from the queue
	if (chat==="!botleave"){
		if (MasterList.indexOf(message.uid)>-1){
 			API.djLeave()
		} else{
			API.sendChat("@"+uname+" You do not have the security clearance for that action."
						+" If you try this again, you will be prosecuted to the full extent of the law.")
			IssuedCommands[uid][1] = 5
		}
		return
	};
	if (chat==="!botjoin"){
		if (MasterList.indexOf(message.uid)>-1){
 			API.djJoin()
		} else{
			API.sendChat("@"+uname+" You do not have the security clearance for that action."
						+" If you try this again, you will be prosecuted to the full extent of the law.")
			IssuedCommands[uid][1] = 5
		}
		return
	};
	if (chat==="!botstop"){
		if (MasterList.indexOf(message.uid)>-1 && state==="running"){
			API.sendChat('I only have about 30 seconds of voice transmission left.')
 			botidle()
		} else{
			API.sendChat("@"+uname+" You do not have the security clearance for that action."
						+" If you try this again, you will be prosecuted to the full extent of the law.")
			IssuedCommands[uid][1] = 5
		}
		return
	};
	if (chat==="!botstart"){
		if (MasterList.indexOf(message.uid)>-1){
 			console.log("Intruder, intruder!")
		} else{
			API.sendChat("@"+uname+" You do not have the security clearance for that action."
						+" If you try this again, you will be prosecuted to the full extent of the law.")
			IssuedCommands[uid][1] = 5
		}
		return
	};
	if (chat.split(" ")[0]==="!remove"){
		if (MasterList.indexOf(message.uid)>-1){
			API.sendChat("/"+chat_orig.slice(1,chat_orig.length))
		} else{
			API.sendChat("@"+uname+" You do not have the security clearance for that action."
						+" If you try this again, you will be prosecuted to the full extent of the law.")
			IssuedCommands[uid][1] = 5
		}
		return
	};
		// returns random number from 0 to 100. Useful for settling arguments.
	if (chat==="!wowroll"){
		roll=Math.round(Math.random()*100)
		API.sendChat("@"+uname+" has rolled "+roll)
		return
	};
		// Roulette. Max two rolls until one becomes a DJ. (Confirming that
		// the rolled track was played is not really possible.)
	if (chat==="!roll" || chat==="!reroll"){
		if (!(uid in rolusr) || rolusr[uid]<2){
			roll=Math.round(Math.random()*roulette.length)
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
		// send a chat with user's last position before leaving the queue
	if (chat.split(" ")[0]==="!lastpos") {
		if (chat.length<9) { 	// if no name after "!lastpos", assumes
			usname = uname		// the user wants to know about himself
		} else {
			if (chat.split(" ")[0] == chat.split(" ")[1]) { 
				abuseban(uname, uid)
				return
			}
			l = chat.length
			usname = chat_orig.slice(9,l)
			audience = API.getAudience()
			for (var key in audience) {
				if (audience[key].username === usname) { 	// get userID from the provided username
					uid = audience[key].id   
					break
				}
			}
		}
		if (usname in usrlft) {
			API.sendChat(usname+"'s last position was "+usrlft[usname][0]+" at "+usrlft[usname][1]+":"+("0"+usrlft[usname][2]).slice(-2)+" GMT+03")
			place = parseInt(usrlft[usname][0])
			WORKQUEUE += 1
			addandmove(uid,place)
			setTimeout(function(){addandmove_deletechat(usname,place,uid)},2500)
		} else{
			API.sendChat("@"+usname+" is not in the list. Sorry.")
		}
		return
	};
	if (chat==="!flush"){
		if (MasterList.indexOf(message.uid)>-1){
			API.sendChat("/flushlimits")
		} else{
			API.sendChat("@"+uname+" You do not have the security clearance for that action."
						+" If you try this again, you will be prosecuted to the full extent of the law.")
			IssuedCommands[uid][1] = 5
		}
		return
	};
	if (chat==="!boooring"){
		// skips longs tracks if asked
		tl = API.getMedia().duration
		score = API.getScore()
		if (tl>600 && score.negative>2)	{
			API.sendChat("Track is too long. Skipping")
			API.moderateForceSkip()
		}
		return
	};
	if (chat==="!lastplayed"){
		// info about current track, how many times it has been played and when was the last.
		song=API.getMedia()
		authorlower = song.author.toLowerCase()
		titlelower = song.title.toLowerCase()
		for (i=0; i<songlist.length; i++){
			if (songlist[i][0]===song.cid || (songlist[i][1].toLowerCase()===authorlower && songlist[i][2].toLowerCase()===titlelower)){
				dt = new Date(songlist[i][3])
				date = (dt.getYear()+1900)+"/"+(dt.getMonth()+1)+"/"+dt.getDate()+" "+dt.getHours()+":"+("0"+dt.getMinutes()).slice(-2)+" GMT+03"
				API.sendChat(song.author+" — "+song.title+" was last played "+date+". "+songlist[i][4]+" plays in total in this room since The Creation.")
				break
			}
		}
		return
	};
	if (chat.slice(0,8)==="!hangman" && chat.length>=10){
		// initializes hangman mode. Only people in the master list can start the game
		if (MasterList.indexOf(message.uid)>-1){
			bothangman(chat.slice(8,chat.length))
		} else{
			API.sendChat("@"+uname+" You do not have the security clearance for that action."
						+" If you try this again, you will be prosecuted to the full extent of the law.")
			IssuedCommands[uid][1] = 5
		}
		return
	};	
	if (chat.split(" ")[0]==="!add") {	 	// add custom bot response
		data = chat_orig.split(" ")
		data_l = chat.split(" ")
		if (data.length>=3) {
			comminput.push([uname,chat_orig])
			if (data[2][0] === "!" || (data[2][0] === "/" && data[2] != "/me") || defaultcommands.indexOf(data[1]) > -1) {
				WORKQUEUE +=1
				abuseban(uname, uid)
			} else {
				if (commands.indexOf(data_l[1])<0){
					commands.push(data_l[1])
					rsp = data.slice(2,data.length).join(" ")
					if (rsp.toUpperCase() === rsp) {
						rsp = rsp.toLowerCase()
					}
					responses.push(data.slice(2,data.length).join(" "))
				} else{
					API.sendChat("That command already exists")
				}
			}
		}
		return
	};
	if (chat.split(" ")[0]==="!relay") {
		data = chat_orig.split(" ")
		if (data.indexOf("-r") > -1) {
			rec = data[2]
			text = data.slice(3,data.length).join(" ")
			msg = "@"+rec+" "+text
		} else{
			msg = data.slice(1,data.length).join(" ")
		}
		if (msg.indexOf("!") === 0 || (msg.indexOf("/") === 0 && msg.indexOf("/me") != 0)) {
			abusemute(uname, uid)
		} else{
			API.sendChat(msg)
		}
		return
	};
	if (chat.split(" ")[0]==="!tweek"){
		ind = Math.floor(Math.random()*tweek.length)	
		API.sendChat(tweek[ind])
		return
	};
	if (commands.indexOf(chat)>-1){
		API.sendChat(responses[commands.indexOf(chat)])
		return
	};
};

		// supporting/action functions
function waitlistupdate(object){
	wlc = API.getWaitList()				// gets current wait list
	wlcn = []
	for (i = 0; i<wlc.length; i++) {	
		wlcn[i] = wlc[i].username		// and extracts only usernames
	}
	if (wlpn.length>wlcn.length){		// function to see if anyone was dropped from plug
		leftusers()						// while in a queue. Initiated only if the queue
	}									// reduced in length.
	wlpn = wlcn	
};				

function leftusers() {
	/* 
	Checks if any of the usernames in a previous (before wait_list_update event) wait list
	are missing in the current wait list, also checking if that user is not a current dj.
	If anyone is missing — writes down their username, last position, time and date object
	*/
	for (i = 0; i < wlpn.length; i++) {
		if (wlcn.indexOf(wlpn[i])<0 && wlpn[i]!==API.getDJ().username) {
			date = new Date()
			hour = date.getHours()
			min = date.getMinutes()
			usrlft[wlpn[i]] = [i+1, hour, min, date]
		}
	}
};

function clearleftusers(){
	/* If the user was present in this array for more than 30 minutes, then remove him. */
	date = new Date()
	for (key in usrlft) {
		if ((date-usrlft[key][3])/60000>=30) {
			delete usrlft[key]
		}
	}
};

function lftdjcheck(object){
	// removes current dj from left users and rolled users lists, if present
	if (object.dj.username in usrlft) {
		delete usrlft[object.dj.username]
	}
	if (object.dj.id in rolusr) {
		delete rolusr[object.dj.id]
	}
};

function mehskip(){
	// skips the awful awful track.
	if (API.getScore().negative>=API.getScore().positive+5){
		djname = API.getDJ().username
		API.moderateForceSkip()
		if (Math.random() > 0.6){
			setTimeout(function(){API.sendChat("@"+djname+" Вы киберунижены.")},500)
		}
	}
};

function songlistupdate(){
	/* 
	Updates the scrobble list. If either the youtube video id or both artist and song title
	match the one already present in the list — increments the play count and saves the date.
	Otherwise simply appends it to the list.
	0 — video id (not really sure what is there for soundcloud songs)
	1 — artist; 2 — title; 3 — last played date; 4 — play count; 5 — current play date.
	Two date fiels are required to show the actual last played date, not the one
	that is "now", since the list is updated at the beginning of a song.
	*/
	var found = false
	var song=API.getMedia()
	var authorlower = song.author.toLowerCase()
	var titlelower = song.title.toLowerCase()
	for (i=0; i<songlist.length; i++){
		if (compareSongInList(songlist[i],song)){
			console.log(songlist[i][0]===song.cid || (songlist[i][1].toLowerCase()===authorlower && songlist[i][2].toLowerCase()===titlelower))
		}
		if (songlist[i][0]===song.cid || (songlist[i][1].toLowerCase()===authorlower && songlist[i][2].toLowerCase()===titlelower)) {
			console.log(compareSongInList(songlist[i],song))
			songlist[i][4]++
			songlist[i][3] = songlist[i][5] // updates last played date
			songlist[i][5] = new Date().getTime() // stores the current play date
			found = true
			break
		}
	}
	if (!found) {
		songlist.push([song.cid, song.author, song.title, new Date().getTime(), 1, new Date().getTime()])
	}
};

function compareSongInList(songinlist, songplaying){
	var authorlower = songplaying.author.toLowerCase()
	var titlelower = songplaying.title.toLowerCase()
	if (songinlist[0]===songplaying.cid || (songinlist[1].toLowerCase()===authorlower && songinlist[2].toLowerCase()===titlelower)){
		return true
	}
	return false
}	

function statisticupdate(){
	/*
	Update stats list. Saves the duration of the song, wait list length,
	time of day and chat update rate. After sufficient data have been collected,
	some sort of linear prediciton algorithm will be made up to tell how long,
	approximately, the user has to wait until it's his turn to dj.
	*/
	dur = API.getMedia().duration
	queue = API.getWaitList().length
	time = new Date()
	freq = chatsstat/((time - songstats[songstats.length-1][2])/60000)
	songstats.push([dur,queue,time,freq])
	chatsstat = 0
};

function hangchat(data){
	/* Handles hangman-related chats. */
	msg = data.message
	uname = data.un
	if (msg.slice(0,7)==="!letter"){
		hangman(msg.slice(8,msg.length).toLowerCase(),"letter",uname)
	};
	if (msg.slice(0,5)==="!word"){
		hangman(msg.slice(6,msg.length).toLowerCase(),"word",uname)
	};
	if (msg==="!hangstop" && MasterList.indexOf(data.uid)>-1){
		mode = "normal"
		hangmanword = ""
		hangmanwordg = ""
		hangcount = 0
		API.off(API.CHAT, hangchat)
	};
};

function hangmanconsole(chat,type,name){
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

function hangcommands(command){
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
	wrd = hangmanword
	wrdg = hangmanwordg
	indc = []
	if (type==="word"){
		if (chat.toLowerCase()===wrd.toLowerCase()){
			wrdg = wrd
		} else{
			API.sendChat("Sorry, that's not the word!")
		}
	};
	if (type==="letter"){
		if (wrdg.toLowerCase().indexOf(chat)>-1){
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
	};
	hangmanwordg = wrdg	
	if (wrdg===wrd || wrdg.indexOf("_")==-1){
		setTimeout(function(){API.sendChat("Congratulations @"+name+", you have won! The word was: "+wrd)},(250))
		mode = "normal"
		hangmanword = ""
		hangmanwordg = ""
		hangcount = 0
		API.off(API.CHAT, hangchat)
	};
	if (hangcount>=10){
		setTimeout(function(){API.sendChat("Ah, wrong once again! You've been hung. The word was: "+wrd)},(250))
		mode = "normal"
		hangmanword = ""
		hangmanwordg = ""
		hangcount = 0
		API.off(API.CHAT, hangchat)
	};
};

function catlimit(uname){
	/* once every 24 hours clears the catlimit list. */
	delete catusr[uname]
}

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

function clearissued(chat,uid){
	/* Clears IssuedCommands array. */
	setTimeout(function(){
		if (IssuedCommands[uid][0] === chat) {
			delete IssuedCommands[uid]
		}},1000*300
	);
};

function mrazotacheck(){
	/* If the track is way too long while people are in queue — skips it. */
	dur = API.getMedia().duration
	queue = API.getWaitList().length
	if (dur >= 9000 && queue > 1) {
		API.moderateForceSkip()
	}
};	

function mesrec(data){
	/* Tracks messages from bot and acts if needed. Currently only "!lastpos" messages
	are deleted if moved successfully or person was not in list (after a short delay). */
	if (data.message.indexOf("not in the list") > -1) {
		setTimeout(function(){API.moderateDeleteChat(data.cid)},1000)
	}
	if (data.message.indexOf("last position") > -1) {
		msg = data.message.split("'s last position was")
		name = msg[0]
		left_message[name] = data.cid
	}
};

function togglecycle(manual){
	/* Turns DJ cycle on or off depending of wait list length. Called after every WAIT_LIST_UPDATE event. 
	"manual" argument is passed when called	from "botresponses" function. */
	if (AUTOTOGGLECYCLE){
		queue = API.getWaitList().length
		if (queue>11){
			$("div.cycle-toggle.button.enabled").click()
		}
		if (queue<9){
			$("div.cycle-toggle.button.disabled").click()
		}
	}
	if (manual === "enable"){
		$("div.cycle-toggle.button.disabled").click()
	}
	if (manual === "disable"){
		$("div.cycle-toggle.button.enabled").click()
	}
}

function check_connection(){
	/*
	Every n minutes increments connection counter and sends the reset command. If bot is not 
	properly connected (can't send/receive chat), the counter won't be reset and after
	reaching a limit the page will refresh.
	*/
	lost_connection_count++
	API.sendChat("/connected")
	if (lost_connection_count>2){
		window.location.href = "https://plug.dj/dvach"
	}
}

		// STACKOVERFLOW SOLUTIONS
/*
Saves and loads object in localStorage. 
localStorage can only hold strings, so object is stringifed and
then parsed when needs to be loaded
*/
Storage.prototype.setObject = function(key, value) {
    this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function(key) {
    var value = this.getItem(key);
    return value && JSON.parse(value);
}

function letind(word, lett){
	// finds all occurrences of a letter in the word and returns its indices
  var result = [];
  for(i=0;i<word.length; ++i) {
    // If you want to search case insensitive use 
    // if (source.substring(i, i + find.length).toLowerCase() == find) {
    if (word.substring(i, i + lett.length) == lett) {
      result.push(i);
    }
  }
  return result;
}

		// NOT IN USE
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
}

function nygreet(user){
	name = user.username
	ind = Math.floor(Math.random()*CHR_GREETINGS.length)
	if (!name in greeted_list){
		API.sendChat("@"+name+GREETINGS[ind])
		greeted_list.push(name)
	}
}
		// NOT IN USE


start()