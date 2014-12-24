// ==UserScript==
// @name		Plugbot
// @namespace	plug
// @include		https://plug.dj/*
// @version		1
// @grant		none
// ==/UserScript==


// Constants
var DJJOIN = "yes"			// not in use currently
							// list of user ids that can fully control the bot
var MasterList=[4702482, 3737285, 4856012]	// — frederik.torve, Вася Пупкин, dbons
var usrlft = Object.create(null);			// list of users left while in a queue. associative array 
							// with 'key' being username. Holds position and time.
var wlc = [];	
var wlcn = [];		// wait list arrays. Previous and new (after wait_list_update
var wlp = [];		// event). ...n only holds usernames instead of user json objects
var wlpn = [];

var catusr = {};
var rolusr = {};

var songlist = [];			// "associative list". Actually, no.
var songstats = [];
var songstatsraw = [];

var rawlist = [];
var dictru = [];
var dicteng = [];
var catlinks = [];
var roulette = [];
var asianlinks = [];
var hangmanword = "";
var hangmanwordg = "";

var chats = 0;						// used to count chat update rate

var mode = "normal";
var state = "";
var hangcount = 0;

var windowstats = window
var windowsongs = window

var commands = [];
var responses = [];
var comminput = [];
var defaultcommands = ["!kitt", "!meow", "!bean", "!relay", "!add", "!lastpos", "!lastplayed", 
						"!asian", "!botjoin", "!botleave", "!botstart", "!botstop", "!mehskip", "!boooring",
						"!hangman", "!stopjoin", "!enablejoin", "!clearlists", "!roll!", "!reroll", "!woworoll"]
var allissuedcommands = [];

var IssuedCommands = Object.create(null);

var s = "/start";

var prev_chat_uid = 0;
var this_chat_uid = 0;

var fouls = Object.create(null);

var WORKQUEUE = 0;

var left_message = Object.create(null);



function start(){
	// When plug loads — start up the bot. Otherwise calls itself in 5 seconds.
	// Shamelessly stole that from plugcubed.
	// Also adds the "file input" field in the chat to upload necessary files
	// As soon as the files have been selected (all at once), automatically sends the 
	// "/start" command and bot turns on, saying "I am K.I.T.T." in chat log.
	// for some reason autosend of "/start" is not always working.
	if (typeof API !== 'undefined' && API.enabled){
		s = "/start"
		$('#chat-messages').append('<div><input id="dropfile" type="file" multiple onchange="API.sendChat(s)"/></div>')
		botinit()
	} else{
		setTimeout(function(){
			start()},5000)
	}
};

			// bot mode functions: start, idle, hangman, etc. Different actions on events
			
botinit = function(){
	// Starts the chat_command listener that is used only for the "/start" command.
	console.log("Yes, Michael?")
	API.on(API.CHAT_COMMAND, startup);
};

function startup(command){
	// Basically loads all input files with data/links/roulette and formats them properly.
	if (command==="/start"){
		file1 = new FileReader();
		file2 = new FileReader();
		file3 = new FileReader();		
		file4 = new FileReader();
		file5 = new FileReader();
		file6 = new FileReader();
		file7 = new FileReader();
		var rwlst = document.getElementById('dropfile').files[0];		
		var rlt = document.getElementById('dropfile').files[1];
		var cats = document.getElementById('dropfile').files[2];
		var dctru = document.getElementById('dropfile').files[3];
		var dcteng = document.getElementById('dropfile').files[4];
		var asians = document.getElementById('dropfile').files[5];
		var stats = document.getElementById('dropfile').files[6];
		file1.readAsText(rwlst)
		file2.readAsText(rlt)
		file3.readAsText(cats)
		file4.readAsText(dctru)
		file5.readAsText(dcteng)
		file6.readAsText(asians)
		file7.readAsText(stats)
		API.off(API.CHAT_COMMAND) // turns off chat_command listener to not accept "/start" anymore.
		setTimeout(function(){rawlist = file1.result.split("\n")},(500))
		setTimeout(function(){roulette = file2.result.split("\n")},(500))
		setTimeout(function(){catlinks = file3.result.split("\n")},(500))
		setTimeout(function(){dictru = file4.result.split("\n")},(500))
		setTimeout(function(){dicteng = file5.result.split("\n")},(500))	
		setTimeout(function(){asianlinks = file6.result.split("\n")},(500))	
		setTimeout(function(){songstatsraw = file7.result.split("\n")},(500))	
		setTimeout(function(){botstart()},(5000))
	}
};

botstart = function(){
	state = "running"
	// get past songs list and stat list in proper format
	loadsonglist()
	loadstatlist()
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
		}// else{
	//		if (data.message.slice(0,2) ==="@K.I.T.T."){
	//			botresponses(data)
	//		}
	//	}
		chats++
	});
	// Commands (only work when issued by bot itself, i.e. on a computer it is running on)
	API.on(API.CHAT_COMMAND, chatcommands);
	
	// Check if anyone has left while in a queue
	API.on(API.WAIT_LIST_UPDATE, waitlistupdate);
	
	// On DJ advance check if he is in the usrlft list to prevent !lastpos abuse
	// Also updates scrobble list and song length stats
	API.on(API.ADVANCE, lftdjcheck);
	API.on(API.ADVANCE, songlistupdate);
	API.on(API.ADVANCE, statisticupdate);
	API.on(API.ADVANCE, mrazotacheck);
	
	API.on(API.SCORE_UPDATE,function(data){				// compares the votes and calls
		if (data.negative>=data.positive+5){			// "mehskip" in 5 seconds.
			setTimeout(function(){mehskip()},(5000))	// if there are still 5+ more mehs
		}												// than woots — skips.
	});
	
	// Calls export commands in 15 minutes to start the open-close loop to make sure
	// no data is lost due to connection loss or plug maintenance (a bit more info
	// in the 'chatcommands' function
	setTimeout(function(){API.sendChat("/export")},15*60*1000)
	setTimeout(function(){API.sendChat("/exportstats")},15*60*1000)
};

botidle = function(){
	state = "idle"
	API.off(API.CHAT)
	console.log("idling...")
	API.on(API.CHAT, function(data){
		if (data.message==="!botstart" && state==="idle"){
			if(MasterList.indexOf(data.uid)>-1){
				API.off(API.CHAT)
				API.off(API.WAIT_LIST_UPDATE)
				API.off(API.ADVANCE)
				API.off(API.SCORE_UPDATE)
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

		// can only be used by bot himself. Mostly copies of 'botresponses' with console.log
		// instead of API.sendChat. Info on those can be found in the respective
		// "botrespones" commands. Some internal stuff like "/export" song list or 
		// "/flush" roulette/cat limit and dropped users lists.
function chatcommands(command){
	if (command==="/kitt"){
		if (Math.random()>=0.3){
			console.log("Yes, Michael?")
		} else{
			console.log("I'm the voice of the Knight Industries Two Thousand's microprocessor. K-I-T-T for easy reference, K.I.T.T. if you prefer.")
		}
	};
	if (command==="/flush"){
		for (key in usrlft){
			delete usrlft[key]
		}
		for (key in rolusr){
			delete rolusr[key]
		}
		for (key in catusr){
			delete catusr[key]
		}
		for (key in IssuedCommands){
			delete issuedCommands[key]
		}
	};
	if (command==="/export"){
		// exports songlist in the popup window, since writing to local file from within
		// the javascript is either impossible, or way too hard.
		// Calls the close popup function in 60 minutes. Calls via chat command
		// to make sure the plug/internet connection has not gone down.
		data = songlist[0].join("+-+")
		for (i=1; i<songlist.length; i++){
		data = data+"\r\n"+songlist[i].join("+-+")
		}
		windowsongs = window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(data))
		setTimeout(function(){API.sendChat("/closesonglistpopup")},60*60*1000)
		
	};
	if (command==="/closesonglistpopup"){
		// closes the popup and opens the new one, updated
		windowsongs.close()
		API.sendChat("/export")
	};
	if (command==="/exportstats"){
		// same as songlist
		data = songstats[0].join("+-+")
		for (i=1; i<songstats.length; i++){
		data = data+"\r\n"+songstats[i].join("+-+")
		}
		windowstats = window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(data))
		setTimeout(function(){API.sendChat("/closestatlistpopup")},60*60*1000)
	};
	if (command==="/closestatlistpopup"){
		// same as closesonglistpopup
		windowstats.close()
		API.sendChat("/exportstats")
	};
	if (command==="/addtosonglist"){
		// manually add the song to song list. 
		songlistupdate()
	};
	if (command==="/addtostats"){
		// manually add data to stat list.
		statisticupdate()
	};
	if (command==="/hangmanru"){
		// start console version of hangman. Single player games have always been the best, right?
		bothangmanconsole("ru")
	};
	if (command==="/hangmaneng"){
		bothangmanconsole("eng")
	};
	if (command==="/issuedcommands") {
		console.log(IssuedCommands)
	};
	if (command==="/exportcomms") {
		data = comminput[0].join(" - ")
		for (i=1; i<comminput.length; i++){
			data = data+"\r\n"+comminput[i].join(" - ")
		}
		window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(data))
	}
	if (command==="/exportallcomms") {
		data = allissuedcommands[0].join(" - ")
		for (i=1; i<allissuedcommands.length; i++){
			data = data+"\r\n"+allissuedcommands[i].join(" - ")
		}
		window.open("data:text/plain;charset=UTF-8," + encodeURIComponent(data))
	}
	if (command.split(" ")[0]==="/add"){
		data = command.split(" ")
		if (data.length>=3) {
			if (commands.indexOf(data[1])<0){
				commands.push(data[1])
				responses.push(data.slice(2,data.length).join(" "))
			}
		}
	};
	if (command.split(" ")[0]==="/remove"){
		data = command.split(" ")
		ind = commands.indexOf(data[1])
		commands.splice(ind,1)
		responses.splice(ind,1)
	};
};

		// Bot's responses to "!command".
function botresponses(message){
	//if (message.message.slice(0,5)=="!word" && message.message.slice(0,7)=="!letter"){	// if that wasn't a hangman
	//	API.moderateDeleteChat(message.cid)  							// command, then deletes it.
	//}											// leaves hangman commands so that people know the wrong letters/words.

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
		API.sendChat("@"+uname+" If you send the same command once more, divine punishment will befall you")
	};
	
	if (IssuedCommands[uid][1] >= 5) {
		WORKQUEUE += 1
		abusemute(uid)
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
	if (chat.split(" ")[0]==="!bean"){
		if (chat.length===5){
			rec = uname
		} else {
			if (chat.split(" ")[1]==="rnd") {
				users = API.getUsers()
				rec = users[Math.floor(Math.random()*users.length)].username
			} else {
				rec = chat_orig.slice(6,chat.length)
			}
		}
		API.sendChat("@"+rec+" Зубочистку?")
		return
	};
	if (chat==="!asian"){		// personal collection of clothed asian cuties
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
				if (audience[key].username === usname) {
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
			API.sendChat("/flush")
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
		// info about current track, how many times it was played and when was the last.
		song=API.getMedia()
		authorlower = song.author.toLowerCase()
		titlelower = song.title.toLowerCase()
		for (i=0; i<songlist.length; i++){
			if (songlist[i][0]===song.cid || (songlist[i][1].toLowerCase()===authorlower && songlist[i][2].toLowerCase()===titlelower)){
				dt = songlist[i][3]
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
	if (chat.split(" ")[0]==="!add") {
		data = chat.split(" ")
		if (data.length>=3) {
			comminput.push([uname,chat_orig])
			if (data[2][0] === "!" || data[2][0] === "/" || defaultcommands.indexOf(data[1]) > -1) {
				WORKQUEUE +=1
				abuseban(uid)
			} else {
				if (commands.indexOf(data[1])<0){
					commands.push(data[1])
					responses.push(data.slice(2,data.length).join(" "))
				} else{
					API.sendChat("That command already exists")
				}
			}
		}
		return
	};
	if (commands.indexOf(chat)>-1){
		API.sendChat(responses[commands.indexOf(chat)])
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
		if (msg.indexOf("!") === 0 || msg.indexOf("/") === 0) {
			abuseban(uid)
		} else{
			API.sendChat(msg)
		}
		return
	};
	if (chat.split(" ")[0]==="!tweek"){
		API.sendChat("накрыло немношк")
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
										// reduced in length.
	}
	wlpn = wlcn	
};				

function leftusers() {
	// Checks if any of the usernames in a previous (before wait_list_update event) wait list
	// are missing in the current wait list, also checking if that user is not a current dj.
	// If anyone is missing — writes down his/her username, last position, time and date object
	for (i = 0; i < wlpn.length; i++) {
		if (wlcn.indexOf(wlpn[i])<0 && wlpn[i]!==API.getDJ().username) {
			date = new Date()
			hour = date.getHours()
			min = date.getMinutes()
			usrlft[wlpn[i]] = [i+1, hour, min, date]
		}
	}
		// if there are left users in an array, starts a cleanup function in 30 minutes.
	if (Object.keys(usrlft).length>0) {		
		setTimeout(function(){clearleftusers()},(1800*1000))
	} 
};

function clearleftusers(){
	// If the user was present in this array for more than 30 minutes, then remove him
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
			setTimeout(function(){API.sendChat("@"+djname+" Вы киберунижены.")},250)
		}
	}
};

function songlistupdate(){
	// Updates the scrobble list. If either the youtube video id or both artist and song title
	// match the one already present in the list — increments the play count.
	// Otherwise simply appends it to the list.
	// 0 — video id (not really sure what is there for soundcloud songs)
	// 1 — artist; 2 — title; 3 — last played date; 4 — play count; 5 — current play date.
	// Two date fiels are required to show the actual last played date, not the one
	// that is "now", since the list is updated at the beginning of a song.
	found = "no"
	song=API.getMedia()
	authorlower = song.author.toLowerCase()
	titlelower = song.title.toLowerCase()
	for (i=0; i<songlist.length; i++){
		if (songlist[i][0]===song.cid || (songlist[i][1].toLowerCase()===authorlower && songlist[i][2].toLowerCase()===titlelower)) {
			songlist[i][4]++
			songlist[i][3] = songlist[i][5] // updates last played date
			songlist[i][5] = new Date()
			found = "yes"
			break
		}
	}
	if (found !="yes"){
			songlist.push([song.cid, song.author, song.title, new Date(), 1, new Date()])
	}
};	

function loadsonglist(){
	// converts the raw songlist to proper format.
	for (i=0; i<rawlist.length; i++){
		songlist.push(rawlist[i].split("+-+"))
		songlist[i][3]=new Date(songlist[i][3])
		songlist[i][5]=new Date(songlist[i][5])
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

function statisticupdate(){
	// Update stats list. Saves the duration of the song, wait list length,
	// time of day and chat update rate. After sufficient data have been collected,
	// some sort of linear prediciton algorithm will be made up to tell how long,
	// approximately, the user has to wait until it's his turn to dj.
	dur = API.getMedia().duration
	queue = API.getWaitList().length
	time = new Date()
	freq = chats/((time - songstats[songstats.length-1][2])/60000)
	songstats.push([dur,queue,time,freq])
	chats = 0
};

function hangchat(data){
	// catches hangman chats
	msg = data.message
	uname = data.un
	if (msg.slice(0,7)==="!letter"){
		hangman(msg.slice(8,msg.length).toLowerCase(),"letter",uname)
	};
	if (msg.slice(0,5)==="!word"){
		hangman(msg.slice(6,msg.length).toLowerCase(),"word",uname)
	};
	if (msg==="!hangmanstop" && data.uid in MasterList){
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
	// checks the word or letter, case-independent. Gives 10 tries to guess the word.
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

function catlimit(uname){
	// once every 24 hours clears the catlimit list
	delete catusr[uname]
}

function addandmove(uid,place){
	if (WORKQUEUE > 1) {
		setTimeout(function(){addandmove(uid,place)},1000)
	} else{
		setTimeout(function(){API.moderateAddDJ(String(uid))},500)							// adds user to the queue
		setTimeout(function(){API.moderateMoveDJ(uid,place)},1000) 	// moves to that position if mod.
		WORKQUEUE -= 1
	}
};

function addandmove_deletechat(name,position,uid){
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
	if (WORKQUEUE > 1){
		setTimeout(function(){abuseban(uname,uid)},1000)
	} else{
		API.sendChat("@"+uname+" Why are you being such a dipshit?")
		setTimeout(function(){API.moderateBanUser(uid,3,API.BAN.HOUR)},1000*10)
		WORKQUEUE -= 1
	}
};

function clearissued(chat,uid){
	setTimeout(function(){
		if (IssuedCommands[uid][0] === chat) {
			console.log("deleting key"+chat)
			delete IssuedCommands[uid]
		}},1000*300
	);
};

function mrazotacheck(){
	dur = API.getMedia().duration
	queue = API.getWaitList().length
	if (dur >= 9000 && queue > 1) {
		API.moderateForceSkip()
	}
};	

function mesrec(data){
	if (data.message.indexOf("not in the list") > -1) {
		setTimeout(function(){API.moderateDeleteChat(data.cid)},1000)
	}
	if (data.message.indexOf("last position") > -1) {
		msg = data.message.split("'s last position was")
		name = msg[0]
		left_message[name] = data.cid
		console.log(name)
	}
};

start()