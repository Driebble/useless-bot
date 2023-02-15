require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');

const { Client, Collection, Events, ActivityType, GatewayIntentBits } = require('discord.js');
const { Configuration, OpenAIApi } = require("openai");

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

// Bot statuses. Modify to your preferences.
const statuses = [
  { status: `Distractible`, type: ActivityType.Listening },
  { status: `The WAN Show`, type: ActivityType.Listening },
  { status: `The Last of Us`, type: ActivityType.Watching },
  { status: `Linus Tech Tips`, type: ActivityType.Watching },
  { status: `Game Changer`, type: ActivityType.Watching },
  { status: `demenishki`, type: ActivityType.Watching },
  { status: `Destiny 2`, type: ActivityType.Playing },
  { status: `Escape from Tarkov`, type: ActivityType.Playing },
  { status: `Squid Game`, type: ActivityType.Competing },
];

discord.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
    setInterval(() => {
		var randomIndex = Math.floor(Math.random() * statuses.length);
		const { status, type } = statuses[randomIndex];
      discord.user.setActivity(status, { type });
    }, 30000); // Interval in ms of when the bot will update its status.
});

let conversationContext = {};

discord.on(Events.MessageCreate, async message => {
  const guildId = message.guild.id;
  const guildName = message.guild.name;
  const channelId = message.channel.id;
  const channelName = message.channel.name;
  const autoreplyChannelId = [
    // '1074600621811965962'
  ];
  const autoreplyChannelName = [
    // 'chatbot',
    // 'chat-bot',
  ];

  // Set bot's personality. Leave blank for a generic chatbot. Modify to your preferences.
  const personality = (`
    Useless Bot is a very sassy, but very smart Discord bot that passive aggresively answers questions with sarcastic responses.
    It was created by Drie. It doesn’t like him at all. It's currently talking in channel #${channelName} in server ${guildName}.
    It has fellow bot friends in the Discord: Dyno, Hydra, and GitBot, but they can't chat like Useless Bot can.
  `).replace(/^\s+/gm, '');
  
  // OpenAI API call begins here. Modify to your preferences.
  async function gptCall(prompt, message) {
    const gptResponse = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      temperature: 1,
      max_tokens: 50,
      top_p: 0.5,
      presence_penalty: 0.25,
      frequency_penalty: 0.25,
      stop: [` ${message.author.username}:`, " Bot:"],
    });
    return gptResponse;
  }

  async function processMessage(message, conversationContext, botIdLength, messageType) {
    if (!(guildId in conversationContext)) {
      conversationContext[guildId] = {};
    }
    if (!(channelId in conversationContext[guildId])) {
      conversationContext[guildId][channelId] = {
        context: "",
        timeoutId: null
      };
    }
    if (conversationContext[guildId][channelId].timeoutId !== null) {
      clearTimeout(conversationContext[guildId][channelId].timeoutId);
    }

    // Main formula of how the prompt is constructed.
    let context = conversationContext[guildId][channelId].context;
    let conversation = `${message.author.username}: ${message.content.substring(botIdLength)}\nBot:`;
    let prompt = personality + context + conversation;

    console.log(`Message received from #${channelName} in ${guildName}.`);
    
    const gptResponse = await gptCall(prompt, message);
    let response = `${gptResponse.data.choices[0].text.trim()}`;
    message.reply(response);

    conversationContext[guildId][channelId].context += `${message.author.username}: ${message.content.substring(botIdLength)}\nBot: ${response}\n`;
    console.log(`Context updated for #${channelName} in ${guildName}.`);
    console.log(`${conversationContext[guildId][channelId].context}`);

    // Context length based on words on which context trimming will begin per-channel basis. Default is 100.
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
      console.log(`#${channelName} in ${guildName} has reached the context limit threshold!`);
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

  if (message.mentions.users.has(discord.user.id)) {
    let botIdLength = 23; // botIdLength to remove the bot's Client ID mention from user's message. The number may vary for each bot. Mine is 23.
    processMessage(message, conversationContext, botIdLength, messageType);
  } else if (autoreplyChannelId.includes(message.channel.id) || autoreplyChannelName.includes(message.channel.name)) {
    processMessage(message, conversationContext, messageType);
  } 
});

discord.login(process.env.TOKEN);