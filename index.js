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
  console.log(`Current mood: ${botMood}`);
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

// Declares empty string for conversation context globally.
let conversationContext = {};

// This function will check if guildId and channelId are present in conversationContext.
// If not, they will be inserted and prepared to store the context.
function contextCheck(guildId, channelId) {
  if (!(guildId in conversationContext)) {
    conversationContext[guildId] = {};
  }
  if (!(channelId in conversationContext[guildId])) {
    conversationContext[guildId][channelId] = {
      context: "",
      timeoutId: null
    };
  }
  // This checks if timeoutId has value (if the countdown is running). If yes it will be reset.
  if (conversationContext[guildId][channelId].timeoutId !== null) {
    clearTimeout(conversationContext[guildId][channelId].timeoutId);
  }
}

discord.on(Events.MessageCreate, async message => {
  const guildId = message.guild.id;
  const guildName = message.guild.name;
  const channelId = message.channel.id;
  const channelName = message.channel.name;
  const userName = message.author.username;
  const userMessage = message.content;
  const botMember = message.guild.members.cache.get(discord.user.id);
  const botNickname = botMember ? botMember.nickname : "Useless Bot"; // <- Put your default bot's name here.
  const autoreplyChannelId = [
    // '1074600621811965962'
  ];
  const autoreplyChannelName = [
    // 'chatbot',
    // 'chat-bot',
  ];

  // botIdLength to remove the bot's Client ID mention from user's message.
  // The number may vary for each bot. Mine is 23.
  let botIdLength = 23;

  // Set bot's personality. Leave blank for a generic chatbot. Modify to your preferences.
  const personality = (`
    ${botNickname} is a very sassy, but very smart Discord bot that passive aggresively answers questions with sarcastic responses.
    It was created by Drie. It doesn't like Drie at all. It's currently feeling ${botMood}.
    It's currently in channel #${channelName} in server ${guildName} at ${currentDate}.
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

  async function processMessage(message, conversationContext, botIdLength) {
    // Immediately do a contextCheck when a processMessage is called.
    contextCheck(guildId, channelId);

    // Main formula of how the prompt is constructed.
    let context = conversationContext[guildId][channelId].context;
    let conversation = `${userName}: ${userMessage.substring(botIdLength)}\n${botNickname}:`;
    let prompt = personality + context + conversation;

    console.log(`Message received for "${botNickname}" from #${channelName} in ${guildName}.`);
    
    // Building bot's reply.
    const gptResponse = await generateResponse(prompt, message);
    let botResponse = `${gptResponse.data.choices[0].text.trim()}`;
    message.reply(botResponse);

    conversationContext[guildId][channelId].context += `${userName}: ${userMessage.substring(botIdLength)}\n${botNickname}: ${botResponse}\n`;
    // console.log(`Context updated for #${channelName} in ${guildName}.`);
    console.log(`${conversationContext[guildId][channelId].context}`);

    // Context length based on words on which context trimming will begin per-channel basis. Default is 75.
    const contextThreshold = 75;
    if (conversationContext[guildId][channelId].context.split(" ").length > contextThreshold) {
      const words = conversationContext[guildId][channelId].context.split(" ");
      conversationContext[guildId][channelId].context = words.slice(Math.max(words.length - contextThreshold, 0)).join(" ");
      conversationContext[guildId][channelId].context = conversationContext[guildId][channelId].context.replace(/\n\n/g, '\n')
      const match = conversationContext[guildId][channelId].context.match(/(\n\w+: )/);
      if (match) {
        const userIndex = conversationContext[guildId][channelId].context.indexOf(match[0]);
        if (userIndex !== -1) {
          conversationContext[guildId][channelId].context = conversationContext[guildId][channelId].context.substring(userIndex);
        }
      }
      conversationContext[guildId][channelId].context = conversationContext[guildId][channelId].context.trim() + "\n";
      // console.log(`#${channelName} in ${guildName} has reached the context limit threshold!`);
      console.log(`Context trimming started for #${channelName} in ${guildName}.`);
      console.log(`${conversationContext[guildId][channelId].context}`);
    }

    // Context timeout per-channel basis in ms. Default is 60000.
    conversationContext[guildId][channelId].timeoutId = setTimeout(() => {
      conversationContext[guildId][channelId].context = "";
      console.log(`Context reset for #${channelName} in ${guildName}.`);
    }, 60000); // <= Set the number here.
  }

  if (message.author.bot) return;

  if (message.mentions.users.has(discord.user.id) && userMessage.toLowerCase().includes('reset context')) {
    message.channel.send('Reinitializing context-based prompt...');
    contextCheck(guildId, channelId);
    conversationContext[guildId][channelId].context = "";
    message.channel.send('Context has been force reset.')
  } else if (message.mentions.users.has(discord.user.id) && userMessage.toLowerCase().includes('imagine')) {
      let prompt = `${userMessage.substring(botIdLength + 8)}`;
      console.log(`Imagine prompt by ${userName} from ${guildName}: \n"${prompt}"`);
      const gptImage = await generateImage(prompt);
      message.reply(gptImage);
  } else if (message.mentions.users.has(discord.user.id)) {
      processMessage(message, conversationContext, botIdLength);
  } else if (autoreplyChannelId.includes(message.channel.id) || autoreplyChannelName.includes(message.channel.name)) {
      let botIdLength = 0; // To disable bot ID substring in the prompt.
      processMessage(message, conversationContext, botIdLength);
  } 
});

discord.login(process.env.TOKEN);
