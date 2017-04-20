const Discord = require('discord.js');
const botLogin = require('./config/botlogin.js');
const liveStream = require('./modules/livestream.js');
const fs = require('fs');
const bot = new Discord.Client();
bot.login(botLogin.token);

const adminRole = "admin";

var botVersion = "?#";
try{
	botVersion = require('./package.json').version;

	var notifyChannel = {}
	if((fs.existsSync('./config/notifychannels.json'))){
		notifyChannel = fs.readFileSync('./config/notifychannels.json');
		notifyChannel = JSON.parse(notifyChannel);
		
	}else{
		fs.writeFileSync('./config/notifychannels.json', "{}");
		notifyChannel = fs.readFileSync('./config/notifychannels.json');
		notifyChannel = JSON.parse(notifyChannel);
	}
	
} catch(error){
	if(error) {
		console.log("------- ERROR --------");
		console.log(error);
		console.log("----------------------");
	}
}
var CMDINT = "!";
var defaultStatus = "v"+botVersion + " | " + CMDINT + "help";

// Checks if the message is a command input from the user
function isCommand(message, command){
	var init = message.slice(0, 1);
	var cmd = (message.indexOf(' ') !== -1) ? message.slice(1, message.indexOf(' ')) : message.slice(1);

	if(init === CMDINT && cmd.toLowerCase() === command.toLowerCase())
		return true
	else 
		return false;
}

// Checks for a specific role the user is in to run admin commands
function isAdmin(message){
	var roles = message.member.roles.array();
	for(var role = 0; role < roles.length; role++){
		if(roles[role].name.toLowerCase() === adminRole)			
			return true;
	}
	message.channel.sendMessage("You aren't admin for this command.");
	return false;
}

// Sets the game the bot is "playing"
function setGame(game){
	bot.user.setGame(game);
}

function getChannelByName(guild, channelName){
	var channel = guild.channels.filterArray( channel => {
		if(channel.name === channelName)
			return channel;
	})[0];

	if(channel)
		return channel
	else
		return null;
}

function botLog(message){
	console.log("DISCORD: " + message);
}

function sendError(title, error, channel){
	console.log("-----"  + "ERROR"+ "------");
	console.log(error);
	console.log("----------");
	channel.sendMessage("**" + title + " Error**\n```" + error.message +"```");
}

function displayServers(){
	var guilds = bot.guilds.array();
	var servers = [];

	for(var i = 0; i < guilds.length; i++){
		servers.push(guilds[i].name);
	}

	return "Servers:\n" + servers.join("\n") + "\n";
}

function fileExist(path, data){
	if(!(fs.existsSync(path))){
		fs.writeFileSync(path, data);
		console.log("Config file: " + path + " created.");
	}
}

//	Credit: https://stackoverflow.com/questions/1303646/check-whether-variable-is-number-or-string-in-javascript#1303650
function isNumber(obj) {	
	return !isNaN(parseFloat(obj))
}	

bot.on('ready', () => {
	console.log("AkeBot v" + botVersion);
	console.log(displayServers());

	setGame(defaultStatus);
});

bot.on('disconnect', event =>{
	console.log("Exited with code: " + event.code);
	if(event.message)
		console.log("Message: " + event.message);
	process.exit(0);
});

bot.on('guildMemberAdd', guildMember =>{
	var generalChannel = getChannelByName(guildMember.guild, 'general');

	generalChannel.sendMessage(guildMember.user.username +" Welcome to " + guildMember.guild.name);	
	botLog(guildMember.guild.name + " welcomes " + guildMember.user.username + " to their server.");
});

bot.on('presenceUpdate', (oldGuildMember, newGuildMember) =>{
	if(newGuildMember.presence.game !== null){
		var defaultChannel = "general";
		var textChannel = getChannelByName(newGuildMember.guild, defaultChannel);			

		if(!(notifyChannel.hasOwnProperty(newGuildMember.guild.id))){
			notifyChannel[newGuildMember.guild.id] = {
				channel: defaultChannel,
				notify: true
			}			
		}
		
		textChannel = getChannelByName(newGuildMember.guild, notifyChannel[newGuildMember.guild.id].channel);
		if(textChannel === null){
			textChannel = getChannelByName(newGuildMember.guild, defaultChannel);
		}

		if(newGuildMember.presence.game.streaming){
			if(notifyChannel[newGuildMember.guild.id].notify){
				textChannel.sendMessage("**LIVE**\n" +
				newGuildMember.user.username + " is now streaming!\n**Title:** " + newGuildMember.presence.game.name +
				"\n**URL:** " + newGuildMember.presence.game.url);
			}
		}
	}		
});

bot.on('message', message => {
	const mContent = message.content;
	const mChannel = message.channel;
	const mGuild = message.guild;
	const mMember = message.member;

	// Admin commands

	if(isCommand(mContent, 'exit') && isAdmin(message)){
		bot.destroy();
		return;
	}

	if(isCommand(mContent, 'setgame') && isAdmin(message)){
		if(mContent.indexOf('') !== -1){
			var game = mContent.slice(mContent.indexOf(' ') + 1);
			setGame(game);
			botLog("Game set to: " + game);
		}
		return;
	}

	// Sets the preferred channel for live streaming notifications
	if(isCommand(mContent, 'setchannel') && isAdmin(message)){
		var file = './config/notifychannels.json';
		if(mContent.indexOf(' ') !== -1){
			var channel = mContent.split(' ')[1];
			fs.readFile(file, (error, notifyChannel) =>{
				if(error) return sendError("Reading Notify Channels File", error, mChannel);
				try{
					notifyChannel = JSON.parse(notifyChannel);
				}catch(error){
					if(error) return sendError("Parsing Notify Channels File");
				}
				if(getChannelByName(message.guild, channel) !== null){
					if(!(notifyChannel.hasOwnProperty(message.member.guild.id))){
						notifyChannel[message.member.guild.id] = {
							channel: channel,
							notify: true
						}
					} else{
						notifyChannel[message.member.guild.id].channel = channel;
					}


					fs.writeFile(file, JSON.stringify(notifyChannel, null, '\t'), error =>{
						if(error) return sendError("Writing Notify Channels File", error, mChannel);

						mChannel.sendMessage("Channel `" + channel + "` set as default notifications channel");
					});
				}else{
					mChannel.sendMessage("No channel found with that name");
				}
			});
		}
		return;
	}

	// Enables or disables streaming notifcations on a server
	if(isCommand(mContent, 'notify') && isAdmin(message)){
		var file = './config/notifychannels.json';
		fs.readFile(file, (error, notifyChannel) =>{
			if(error) return sendError("Reading Notify Channels File", error, mChannel);
			try{
				notifyChannel = JSON.parse(notifyChannel);
			}catch(error){
				if(error) return sendError("Parsing Notify Channels File", error, mChannel);
			}

			if(!(notifyChannel.hasOwnProperty(message.member.guild.id))){
				notifyChannel[message.member.guild.id] = {
					channel: "general",
					notify: true
				}
			} else{
				if(notifyChannel[message.member.guild.id].notify){
					notifyChannel[message.member.guild.id].notify = false;
				} else{
					notifyChannel[message.member.guild.id].notify = true;
				}
			}

			if(notifyChannel[message.member.guild.id].notify){
				mChannel.sendMessage("Notifications for this server set to `true`");
			} else{
				mChannel.sendMessage("Notifications for this server set to `false`");
			}

			fs.writeFile(file, JSON.stringify(notifyChannel, null, '\t'), error =>{
				if(error) return sendError("Reading Stream Black List File", error, mChannel);			
			});
		});
		return;
	}

	// GENERAL commands

  	if(isCommand(mContent, 'help')){
  		message.channel.sendMessage("**Help**\nIn progress!");
  		return;
  	}

  	if(isCommand(mContent, 'about')){
  		var content = "**About**\n" + "**Bot Version:** Akephalos Bot v" + botVersion +
  			"\n**Bot Username:** " + bot.user.username +
  			"\n**Servers Connected:** `" + bot.guilds.array().length + "`" +
  			"\n**Author:** Mesmaroth" +
  			"\n**Library:** Discord.js" +  			
  			"\n**Source:** <https://github.com/Mesmaroth/discord-AkephalosBot>"

  		message.channel.sendFile( bot.user.displayAvatarURL, 'botAvatar.jpg', content);
  		return;
  	}

  	if(isCommand(message.content, 'source')){
  		message.channel.sendMessage("**Source:** https://github.com/Mesmaroth/discord-AkephalosBot");
  		return;
  	}

  	if(isCommand(mContent, 'invite')){
  		bot.generateInvite().then( link =>{
  			mChannel.sendMessage("**Invite:** " + link);
  		});
  		return;
  	}

  	if(isCommand(mContent, 'uptime')){
  		var uptimeSeconds = 0, uptimeMinutes = 0, uptimeHours = 0;

  		uptimeSeconds = Math.floor(bot.uptime/1000);
		
		if(uptimeSeconds > 60){
			uptimeMinutes = Math.floor(uptimeSeconds/60);
			uptimeSeconds = Math.floor(uptimeSeconds % 60);
		}

		if(uptimeMinutes > 60){
			uptimeHours = Math.floor(uptimeMinutes / 60);
			uptimeMinutes = Math.floor(uptimeMinutes % 60);
		}

  		mChannel.sendMessage("**Uptime:** " + uptimeHours + " hour(s) : " + uptimeMinutes + " minute(s) : " + uptimeSeconds +" second(s)");
  		return;
  	}

  	if(isCommand(mContent, 'twitch')){
  		if(mContent.indexOf(' ') !== -1){
  			var name = mContent.split(' ')[1];

  			liveStream.getTwitchStream(name, (error, status, gameTitle, streamURL)=> {
  				if(error) return sendError("Getting Twitch Stream Data", error, mChannel);
  				if(status){
  					mChannel.sendMessage(
  					"**Twitch**\n**Name:** " + name +
  					"\n**Status:** `Online`\n**Game:** " + gameTitle +
  					"\n**URL:** " + streamURL);  	
  				} else{
  					mChannel.sendMessage(
  						"**Twitch**\n**Name:** " + name +
  						"\n**Status:** `Offline`");
  				}		
  			});
  		}
  		return;
  	}

  	if(isCommand(mContent, 'hitbox')){
  		if(mContent.indexOf(' ')!== -1){
  			var name = mContent.split(' ')[1];

  			liveStream.getHitboxStream(name, (error, status, gameTitle, streamURL) =>{
  				if(error) return sendError("Getting HitBox Stream Data", error, mChannel);
  				if(status){
  					mChannel.sendMessage(
  					"**HitBox**\n**Name:**" + name +
  					"\n**Status:** `Online`\n**Game:** " + gameTitle +
  					"\n**URL:** " + streamURL);
  				} else{
  					mChannel.sendMessage(
  					"**HitBox**\n**Name:**" + name +
  					"\n**Status:** `Offline`");
  				}
  			});
  		}
  		return;
  	}

  	if(isCommand(mContent, 'commands')){
  		if(mContent.indexOf(' ') !== -1){
  			var param = mContent.split(' ')[1];

  			if(param.toLowerCase() === "global"){
  				fs.readFile('./config/botCommands.json', (error, commands)=>{
	  				if(error) return sendError("Reading Bot Commands Config File", error, mChannel);

					try{
						commands = JSON.parse(commands);  			
					}catch(error){
						if(error) return sendError("Parsing Bot Commands Config File", error, mChannel);
					}

					if(commands.hasOwnProperty("GLOBAL")){
						var globalCommands = commands["GLOBAL"];
						var commands = [];

						for(var i = 0; i < globalCommands.length; i++){
							commands.push("**"+(i+1) + ".** " + globalCommands[i].command);
						}

						if(commands.length > 0)
							mChannel.sendMessage("**Commands**\n" + commands.join('\n'));
						else
							mChannel.sendMessage("No commands found on this server");
					}else{
						mChannel.sendMessage("No commands found on this server");
					}
	  			});
  			}
  		}else{
  			fs.readFile('./config/botCommands.json', (error, commands)=>{
  				if(error) return sendError("Reading Bot Commands Config File", error, mChannel);

				try{
					commands = JSON.parse(commands);  			
				}catch(error){
					if(error) return sendError("Parsing Bot Commands Config File", error, mChannel);
				}

				if(commands.hasOwnProperty(mGuild.id)){
					var serverCommands = commands[mGuild.id];
					var commands = [];

					for(var i = 0; i < serverCommands.length; i++){
						commands.push("**"+(i+1) + ".** " + serverCommands[i].command);
					}

					if(commands.length > 0)
						mChannel.sendMessage("**Commands**\n" + commands.join('\n'));
					else
						mChannel.sendMessage("No commands found on this server");
				}else{
					mChannel.sendMessage("No commands found on this server");
				}
  			});
  		}
  	}

  	// Custom commands
	fs.readFile('./config/botCommands.json', (error, commands) =>{
		if(error) return sendError("Reading Bot Commands Config File", error, mChannel);

		try{
			commands = JSON.parse(commands);  			
		}catch(error){
			if(error) return sendError("Parsing Bot Commands Config File", error, mChannel);
		}

		if(commands.hasOwnProperty('GLOBAL')){
			var globalCommands = commands['GLOBAL'];
			for(var i = 0; i < globalCommands.length; i++){
				if(mContent.toLowerCase() === globalCommands[i].command){
					if(globalCommands[i].type === 'text'){
						mChannel.sendMessage(globalCommands[i].message);
					}else if(globalCommands[i].type === 'image'){
						if(!fs.existsSync(serverCommands[i].file)){
							return sendError("Reading Custom Commands File", {name: "No file found: " + serverCommands[i].file, message: "File not found."}, mChannel);
						}
						if(globalCommands[i].hasOwnProperty('message')){
							mChannel.sendFile(globalCommands[i].file, globalCommands[i].filename, globalCommands[i].message);
						}else{
							mChannel.sendFile(globalCommands[i].file, globalCommands[i].filename);
						}
					}
					return;
				}
			}
		}

		if(commands.hasOwnProperty(mGuild.id)){
			var serverCommands = commands[mGuild.id];			
			for(var i = 0; i < serverCommands.length; i++){
				if(mContent.toLowerCase() === serverCommands[i].command){
					if(serverCommands[i].type === 'text'){
						mChannel.sendMessage(serverCommands[i].message);
					}else if(serverCommands[i].type === 'image'){
						if(!fs.existsSync(serverCommands[i].file)){
							return sendError("Reading Custom Commands File", {name: "No file found: " + serverCommands[i].file, message: "File not found"}, mChannel);
						}
						if(serverCommands[i].hasOwnProperty('message')){
							mChannel.sendFile(serverCommands[i].file, serverCommands[i].filename, serverCommands[i].message);
						}else{
							mChannel.sendFile(serverCommands[i].file, serverCommands[i].filename);
						}
					}
					return;
				}
			}			
		}
	});

});