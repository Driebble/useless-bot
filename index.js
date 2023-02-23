require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');

const { Client, Collection, Events, ActivityType, GatewayIntentBits } = require('discord.js');
const { Configuration, OpenAIApi } = require("openai");

const currentDate = new Date();
const dateString = currentDate.toLocaleString();
console.log(dateString);

const discord = new Client({ intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
]});

const configuration = new Configuration({ apiKey: process.env.OPENAIKEY });
const openai = new OpenAIApi(configuration);

discord.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
	//  Set a new item in the Collection with the key as the command name and the value as the exported module
  if ('data' in command && 'execute' in command) {
    discord.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

discord.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.discord.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

// OpenAI text-completion model API call to define current mood.
let botMood = "";
async function generateMood() {
  const gptMood = await openai.createCompletion({
    model: "text-curie-001",
    prompt: `Say a random one word mood`,
    temperature: 0.75,
    max_tokens: 25,
    top_p: 1,
    presence_penalty: 0,
    frequency_penalty: 0.5,
  });
  botMood = gptMood.data.choices[0].text.trim().toLowerCase();
  console.log(`Current mood: \x1b[35m${botMood}\x1b[0m`);
}

// Set an interval to call the generateMood function in between 0 to 15 minutes.
setInterval(async function() {
  generateMood();
  setTimeout(() => {
    discord.user.setActivity(`${botMood} music`, { type: ActivityType.Listening });
  }, 3000);
}, Math.floor(Math.random() * 600000));

// Bot statuses. Modify to your preferences.
const statuses = [
  // { status: `${botMood} music`, type: ActivityType.Listening },
  // { status: `Distractible`, type: ActivityType.Listening },
  // { status: `The WAN Show`, type: ActivityType.Listening },
  // { status: `The Last of Us`, type: ActivityType.Watching },
  // { status: `Linus Tech Tips`, type: ActivityType.Watching },
  // { status: `Game Changer`, type: ActivityType.Watching },
  // { status: `BLUELOCK`, type: ActivityType.Watching },
  // { status: `Destiny 2`, type: ActivityType.Playing },
  // { status: `Rocket League`, type: ActivityType.Playing },
  // { status: `Squid Game`, type: ActivityType.Competing },
];

discord.once(Events.ClientReady, () => {
	console.log(`Ready! Logged in as ${discord.user.tag}`);
  generateMood();
  setTimeout(() => {
    discord.user.setActivity(`${botMood} music`, { type: ActivityType.Listening });
  }, 3000);
  // setInterval(() => {
  //   let randomIndex = Math.floor(Math.random() * statuses.length);
  //   const { status, type } = statuses[randomIndex]; 
  //   discord.user.setActivity(status, { type });
  // }, Math.floor(Math.random() * 30000)); // Interval between 0 and said ms of when the bot will update its status.
});

const lastResponseTime = {};
let chatWait;
let timeoutId;

discord.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const idPattern = /<@\d+>/g;
  const guildId = message.guild.id;
  const guildName = message.guild.name;
  const channelId = message.channel.id;
  const channelName = message.channel.name;
  const userName = message.author.username;
  const userMessage = message.content;
  const botNickname = message.guild.members.me.nickname || message.guild.members.me.user.username;

  const botCalled = userMessage.toLowerCase().includes(`${botNickname.toLowerCase()}`) || message.mentions.users.has(discord.user.id);

  const channel = message.channel;
  const messages = await channel.messages.fetch({ limit: 6 }); // <- Pulls out the last 6 messages for context matching.
  const messageArray = Array.from(messages.values()).reverse();
  const chatHistory = messageArray.map(msg => {
    const chatAuthor = msg.member ? msg.member.nickname || msg.author.username : msg.author.username;
    return `${chatAuthor}: ${msg.content.replace(idPattern, "").trim()}`;
  }).join('\n');

  // Set bot's personality. Leave blank for a generic chatbot. Modify to your preferences.
  const personality = (`
    ${botNickname} is a very sassy Discord bot that passive aggresively answers questions with sarcastic responses.
    It was created by Drie. It doesn't like Drie at all. It's currently feeling "${botMood}".
    Currently in #${channelName} in server ${guildName} at ${dateString}.
  `).replace(/^\s+/gm, '');
  
  // OpenAI text-completion model API call begins here. Modify to your preferences.
  async function generateResponse(prompt, userName, botNickname) {
    const gptResponse = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      temperature: 1,
      max_tokens: 50,
      top_p: 0.5,
      presence_penalty: 0.25,
      frequency_penalty: 0.25,
      stop: [` ${userName}:`, ` ${botNickname}:`],
    });
    return gptResponse;
  }

  // OpenAI text-to-image model API call begins here. Modify to your preferences.
  async function generateImage(prompt) {
    const gptCreate = await openai.createImage({
      prompt: prompt,
      n: 1,
      size: "512x512",
    });
    let gptImage = gptCreate.data.data[0].url;
    return gptImage;
  }

  async function sendResponse(message) {
    let prompt = `${personality}${chatHistory}\n${botNickname}:`;
    console.log(`${personality}${chatHistory}`);
    const gptResponse = await generateResponse(prompt, message);
    let botResponse = `${gptResponse.data.choices[0].text.trim()}`;
    message.channel.send(botResponse);
    console.log(`${botNickname}: ${botResponse}`);
  }

  async function sendGeneratedImage(message) {
    let prompt = `${userMessage.toLowerCase().replace(idPattern, "").replace(botNickname.toLowerCase(), '').replace('imagine', '').trim()}`;
    console.log(`\x1b[32mImagine prompt by ${userName} from ${guildName}: \n"${prompt}"\x1b[0m`);
    const gptImage = await generateImage(prompt);
    message.channel.send(gptImage);
  }

  function stopAttention(channelId) {
    lastResponseTime[channelId] = null;
    console.log(`\x1b[31m${botNickname} has stopped paying attention to #${channelName}.\x1b[0m`);
  }

  if (botCalled && (!lastResponseTime[channelId]) && userMessage.toLowerCase().includes('imagine')) {
    clearTimeout(timeoutId);
    sendGeneratedImage(message);
    lastResponseTime[channelId] = Date.now();
    console.log(`\x1b[33m${botNickname} is now paying attention to #${channelName} in ${guildName}.\x1b[0m`);
    timeoutId = setTimeout(() => stopAttention(channelId), 60000);
  } else if (botCalled && (!lastResponseTime[channelId])) {
    clearTimeout(timeoutId);
    sendResponse(message);
    lastResponseTime[channelId] = Date.now();
    console.log(`\x1b[33m${botNickname} is now paying attention to #${channelName} in ${guildName}.\x1b[0m`);
    timeoutId = setTimeout(() => stopAttention(channelId), 60000);
  } else if (lastResponseTime[channelId] !== null) {
    clearTimeout(chatWait);
    chatWait = setTimeout(() => {
      clearTimeout(timeoutId);
      sendResponse(message);
      lastResponseTime[channelId] = Date.now();
      timeoutId = setTimeout(() => stopAttention(channelId), 60000);
    }, 5000);
  } else if (lastResponseTime[channelId] !== null && userMessage.toLowerCase().includes('imagine')) {
    clearTimeout(chatWait);
    chatWait = setTimeout(() => {
      clearTimeout(timeoutId);
      sendGeneratedImage(message);
      lastResponseTime[channelId] = Date.now();
      timeoutId = setTimeout(() => stopAttention(channelId), 60000);
    }, 5000);
  }
});

discord.login(process.env.TOKEN);
