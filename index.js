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
    }, 30000);
});

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

let personality = 'Useless Bot is an extremely sassy, smart chatbot that reluctantly answers questions.\n\
It was created by its lord and saviour, Drie. It doesn’t like him at all.\n';

//  let personality = '';

let conversationContext = {};

discord.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  if (message.mentions.users.has(discord.user.id)) {
    const guildId = message.guild.id;
    let preprompt = "";
    if (!(guildId in conversationContext)) {
      conversationContext[guildId] = {
        prompt: personality,
        timeoutId: null
      };
    }
    preprompt = conversationContext[guildId].prompt;

    if (conversationContext[guildId].timeoutId !== null) {
      clearTimeout(conversationContext[guildId].timeoutId);
    }

    const str = `${message.content}`;
    const subStr = str.substring(23);
    let prompt = preprompt + `${message.author.username}: ${message.content.substring(23)}\nBot: `;
    //  console.log(`${message.author.username}: ${message.content.substring(23)}`);

    (async () => {
      const gptResponse = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: prompt,
        max_tokens: 100,
        temperature: 0.9,
        top_p: 1,
        presence_penalty: 0.0,
        frequency_penalty: 0.6,
        stop: [` ${message.author.username}:`, " Bot:"],
      });

      let response = `${gptResponse.data.choices[0].text.trim()}`;
      message.reply(response);
      //  console.log(`Bot: ` + response);

      conversationContext[guildId].prompt += `${message.author.username}: ${subStr}\nBot: ${response}\n`;
      console.log('Prompt updated for guild: ' + guildId);

      console.log(conversationContext[guildId].prompt);

      conversationContext[guildId].timeoutId = setTimeout(() => {
        conversationContext[guildId].prompt = personality;
        discord.user.setActivity('new chat topic', { type: ActivityType.Listening });
        console.log(`Prompt reset for guild: ${guildId}`);
      }, 30000);
    })();
  }
});

discord.login(process.env.TOKEN);